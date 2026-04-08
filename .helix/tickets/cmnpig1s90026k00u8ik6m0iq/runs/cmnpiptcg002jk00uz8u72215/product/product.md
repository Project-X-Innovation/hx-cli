# Product: Fix Intermittent Runtime Log Inspection Failures

## Problem Statement

Agents and users intermittently cannot view runtime logs or run database inspection queries. The system reports "sometimes it works flawlessly and sometimes it doesn't work at all." During diagnosis, 100% of ClickHouse `remote()` log queries and Prisma-table database queries failed, while lightweight endpoints (repo listing, simple queries like `SELECT 1`) succeeded consistently. The failures stem from a compound issue across the DigitalOcean infrastructure proxy, the server's error handling, and the CLI's lack of resilience.

## Product Vision

Runtime inspection (logs and database queries) should be reliable and provide clear, actionable feedback when failures occur. Agents should be able to query logs and databases without manual retries, and when transient failures happen, the system should recover automatically or surface useful diagnostics.

## Users

- **AI Agents** (primary): Automated agents using the `hlx` CLI to inspect runtime logs and databases during ticket workflows. They cannot retry manually or interpret HTML error pages.
- **Human developers**: Occasionally use the CLI directly for debugging. They experience the same failures but can retry manually.

## Use Cases

1. **Agent inspects runtime logs**: An agent runs `hlx inspect logs` to check production behavior during a ticket workflow. Today, this fails intermittently with a generic HTML 504 page, giving the agent no actionable information.
2. **Agent queries production database**: An agent runs `hlx inspect db` to verify data shapes or record counts. Today, queries against application tables fail and return HTML instead of a JSON error message.
3. **Transient failure recovery**: A gateway timeout or external service hiccup occurs. Today, a single transient failure is immediately fatal. The system should retry automatically and succeed on subsequent attempts.

## Core Workflow

```
Agent/CLI  -->  DigitalOcean Gateway  -->  Express Server  -->  External Service
                                                                (BetterStack/PG)
```

**Current failure mode**: Express returns HTTP 502 on external query failure. The DigitalOcean App Platform proxy intercepts 502, replaces the JSON error body with a generic HTML page, and returns 504. The CLI receives HTML, cannot parse it, and calls `process.exit(1)` with no retry.

**Desired behavior**: The server avoids status codes intercepted by the DO proxy and retries transient external failures. The CLI retries retryable errors with backoff and surfaces clear error messages when all attempts are exhausted.

## Essential Features (MVP)

### Server (helix-global-server)

1. **Avoid DO proxy interception**: Change HTTP error responses for failed inspection queries to a status code that the DigitalOcean proxy does not intercept (e.g., use 500 or 422 instead of 502), preserving actionable JSON error messages.
2. **Retry transient external query failures**: Apply retry logic (following the existing `waitWithRetry` pattern) to BetterStack/ClickHouse and PG inspection queries before returning an error.
3. **Configurable query timeouts**: Make the hardcoded 15s inspection query timeout configurable via environment variables.

### CLI (hx-cli)

4. **Request timeouts**: Add `AbortSignal.timeout` to all `hxFetch` calls (e.g., 30s) to prevent indefinite hangs.
5. **Retry with exponential backoff**: Retry retryable HTTP status codes (429, 502, 503, 504) with exponential backoff (e.g., 3 attempts, ~2s base delay).
6. **Error classification**: Distinguish retryable errors from permanent errors; only retry on transient failures.
7. **Meaningful error output**: When the response body is HTML (not JSON), surface a clear error message instead of dumping raw HTML.

## Features Explicitly Out of Scope (MVP)

- **Connection pooling for PG inspection queries**: Would improve performance but is not the root cause of the current failures.
- **Distributed rate limiter**: The in-memory rate limiter works for single-instance deployments; scaling is a separate concern.
- **Verbose/debug mode for CLI**: Useful but not required to fix the core reliability issue.
- **Caching resolveRepo()**: Would reduce redundant network calls but does not address the failure mode.
- **Sandbox log streaming retry** (`log-stream.ts`): A separate code path from the inspection proxy; not part of this ticket's reported failures.
- **Test coverage for inspection code**: Important but should be a follow-up effort.
- **BetterStack ClickHouse `remote()` function fix**: The `remote()` failures may be a BetterStack-side issue. The product fix ensures the system handles these failures gracefully rather than fixing the external service.

## Success Criteria

1. **Actionable errors**: When an inspection query fails, the CLI receives and displays a JSON error message with the failure reason -- not a generic HTML page.
2. **Automatic transient recovery**: Retryable failures (gateway timeouts, transient external errors) are retried automatically at both the server and CLI layers, with at least 3 attempts before surfacing an error.
3. **No indefinite hangs**: All CLI HTTP requests have a finite timeout; agents never hang waiting for a response.
4. **Error classification**: The CLI distinguishes retryable errors from permanent errors and only retries on transient failures.
5. **No regression**: Successful inspection queries (repo listing, simple database queries) continue to work as before.

## Key Design Principles

- **Minimal change**: Fix the specific failure modes identified in diagnosis without restructuring the inspection architecture.
- **Defense in depth**: Apply resilience at both server and CLI layers so that a fix in either one improves reliability independently.
- **Follow existing patterns**: The server already has `waitWithRetry` and the login command already has `AbortSignal.timeout` -- extend these patterns rather than introducing new abstractions.
- **Preserve zero-dependency CLI**: The CLI uses only Node.js built-ins; keep it that way.

## Scope & Constraints

- **Two repos changed**: `helix-global-server` and `hx-cli`. `helix-global-client` is context-only (not involved in the inspection flow).
- **DigitalOcean proxy behavior is external**: We cannot change DO's proxy interception rules. The server must work around them by avoiding intercepted status codes.
- **BetterStack ClickHouse availability is external**: The `remote()` function failure may be on BetterStack's side. Our fix ensures graceful handling, not fixing their service.
- **Backward compatibility**: Changes to HTTP status codes and error formats must not break existing CLI versions or other consumers of the inspection API.

## Future Considerations

- Add PG connection pooling for inspection queries to reduce latency and connection overhead.
- Add test coverage for the inspection code path (currently zero test files).
- Add a verbose/debug mode to the CLI for diagnostic output.
- Cache `resolveRepo()` results in the CLI to avoid redundant network calls.
- Investigate BetterStack `remote()` failures at the provider level if graceful handling proves insufficient.
- Consider a distributed rate limiter if the server scales to multiple instances.

## Open Questions / Risks

| Question / Risk | Notes |
|----------------|-------|
| What DigitalOcean status codes are intercepted? | Diagnosis confirmed 502 is intercepted. Need to verify 500 and other codes are passed through. |
| Is 500 safe from DO proxy interception? | If DO also intercepts 500, we may need to use 2xx with an error envelope or a less common 4xx code. |
| Will BetterStack `remote()` ever succeed? | All tested `remote()` calls failed during diagnosis. If the table source is fundamentally broken, retry alone won't help. The error message surfacing will at least give agents diagnostic info. |
| Backward compatibility of status code change | If other consumers expect HTTP 502, changing it could break them. Need to check if any other clients depend on the 502 status code. |
| Rate limiter under retry pressure | If both server and CLI retry, a single failed request could generate up to 9 total attempts. The 60 req/60s rate limit could be hit under load. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/scout-summary.md (helix-global-server) | Server-side architecture and failure analysis | 504 from DO gateway, not Express; 15s hardcoded timeouts; no retry; no connection pooling |
| scout/reference-map.json (helix-global-server) | Detailed file-level evidence | HttpError(502) triggers DO proxy interception; multi-step auth chain; fire-and-forget audit |
| diagnosis/diagnosis-statement.md (helix-global-server) | Root cause analysis | DO proxy intercepts 502->504 (confirmed via x-do-orig-status header); remote() queries always fail; simple queries succeed |
| diagnosis/apl.json (helix-global-server) | Structured diagnosis answers with evidence | Compound failure: DO proxy interception + ClickHouse remote() failure + no server retry |
| scout/scout-summary.md (hx-cli) | CLI architecture and failure analysis | No timeout, no retry, process.exit(1) on any error; login has timeout but inspection doesn't |
| scout/reference-map.json (hx-cli) | Detailed file-level evidence | Bare fetch(), immediate exit, uncached resolveRepo() |
| diagnosis/diagnosis-statement.md (hx-cli) | CLI root cause | Zero resilience; existing patterns (login timeout, server waitWithRetry) not applied to inspection |
| diagnosis/apl.json (hx-cli) | Structured diagnosis answers | Retry + timeout + error classification needed; follow existing patterns |
| repo-guidance.json (helix-global-client) | Repo intent classification | helix-global-server and hx-cli are targets; helix-global-client is context-only |
| /tmp/helix-inspect/manifest.json | Runtime inspection config | helix-global-server has DATABASE and LOGS types |

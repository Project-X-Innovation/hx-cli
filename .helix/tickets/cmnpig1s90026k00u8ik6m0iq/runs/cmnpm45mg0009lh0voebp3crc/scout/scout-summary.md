# Scout Summary — hx-cli

## Problem

The hx-cli (`hlx`) now has retry logic (3 attempts), 30s per-request timeout, and retries on 504/502/503/500/429 — these were added after the prior run identified their absence. **Despite this hardening, agents still cannot reliably access runtime logs** because the upstream 504 Gateway Timeout from DigitalOcean persists across all retry attempts. The CLI's retry mechanism works correctly but cannot overcome a persistent gateway-level timeout.

The user's continuation context asks: "how are we going to get production runtime logs for this application?" — signaling that the current approach (CLI → server proxy → external service) may need an architectural alternative rather than further CLI hardening.

## Analysis Summary

### Current state of CLI hardening (verified in source)

The prior run's scout said hx-cli had "NO timeout, NO retry logic, process.exit(1) on any error." The current code at `src/lib/http.ts` now has:
- `MAX_ATTEMPTS = 3` (line 3)
- `BASE_DELAY_MS = 2000` with exponential backoff + jitter (line 4, 24-26)
- `REQUEST_TIMEOUT_MS = 30_000` via `AbortSignal.timeout` (line 5, 72)
- `RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]` (line 6)
- HTML error page detection with user-friendly message (lines 28-35)
- 429 Retry-After header support (lines 80-88)

### Key observations

1. **CLI retry is working but insufficient**: When a 504 occurs, the CLI correctly identifies it as retryable (line 91), waits with backoff, and retries. But if the gateway consistently returns 504 for that query type, all 3 attempts fail. Total time: up to ~96 seconds of waiting for persistent failures.

2. **Double-retry chain**: CLI retries (3× at 30s timeout) around server retries (3× at 15s timeout). The server may still be processing retry attempt #2 when the gateway has already returned 504 to the CLI, which then starts a new request that triggers another 3-attempt server cycle.

3. **Two network calls per command**: Every inspection command calls `resolveRepo()` first (GET /repositories), then the actual query. The repos call typically succeeds, but the query call hits 504. No caching of the repos result.

4. **No per-attempt diagnostics**: The CLI provides no verbose/debug mode showing per-attempt timing, HTTP status codes, or retry decisions. Agents see only the final error message.

## Relevant Files

| File | Role |
|------|------|
| `src/lib/http.ts` | Core HTTP client: retry logic (3 attempts), 30s timeout, 504 retryable, HTML error detection |
| `src/inspect/logs.ts` | Log query command: resolveRepo + hxFetch POST |
| `src/inspect/db.ts` | DB query command: resolveRepo + hxFetch POST |
| `src/inspect/index.ts` | Command dispatcher for inspect subcommands |
| `src/lib/resolve-repo.ts` | Repo resolution: uncached full-list fetch per command |
| `src/lib/config.ts` | Config: 3 env var names for auth + URL, file fallback |
| `package.json` | v1.2.0, zero runtime deps, tsc build |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement and continuation context | User asks how to get logs reliably; current approach is insufficient |
| src/lib/http.ts | Verify CLI hardening | Retry logic IS present (3 attempts, 30s timeout, 504 retryable) — prior run's findings were addressed |
| Prior run scout/reference-map.json | Compare with current state | Prior run said "no timeout, no retry" — code now has both. Problem persists |
| Runtime: hlx inspect repos (from all attempts) | Verify CLI connectivity | repos endpoint succeeds — CLI auth and connectivity work |
| Runtime: hlx inspect db/logs (multiple attempts) | Reproduce flakiness | Query endpoints return 504 despite CLI retry logic |

# Product: Make Runtime Inspection Return JSON Errors Instead of HTML 502/504

## Problem Statement

Agents cannot reliably access production runtime logs or database query results. The behavior appears intermittent — some queries succeed, others fail with opaque HTML error pages — but diagnosis proves the failure is **deterministic**: any inspection query that triggers a server-side error causes the Express server to never send a response, DigitalOcean's gateway generates HTML 502, and Cloudflare serves it as 504. Agents receive unparseable HTML and get no actionable information.

The CLI has a specific compounding issue: retry/timeout code was written in source (`src/lib/http.ts`) but **never published to npm**. The deployed `@projectxinnovation/helix-cli@1.2.0` still has the old single-fetch, `process.exit(1)` code. Both show version 1.2.0 — the version was bumped but the package was never rebuilt and republished.

## Product Vision

Every runtime inspection query returns a parseable JSON response — either data on success or a clear error message on failure — so agents can perform production debugging without manual intervention.

## Users

- **AI Agents (primary)**: Automated agents in sandboxes calling `hlx inspect db/logs` for production context during ticket workflows.
- **Human developers (secondary)**: Engineers using `hlx` CLI for ad-hoc debugging.

## Use Cases

1. **Agent queries production database** — expects JSON result or JSON error with failure reason.
2. **Agent queries production logs** — expects log rows or clear JSON error.
3. **Transient failure auto-recovery** — CLI retries gateway hiccups transparently.
4. **Permanent failure clarity** — CLI shows a parseable error message, not raw HTML.

## Core Workflow

```
Agent issues hlx inspect db/logs
  → CLI sends request (retries transient 429/500/502/503/504)
    → Server returns JSON (success or error)
      → CLI parses and displays result
```

**Today (deployed CLI)**: Single fetch, no retry, no timeout. On any non-200, prints truncated response text and calls `process.exit(1)`. HTML error pages are dumped raw.

**Today (source CLI)**: Full retry logic (3 attempts, 30s timeout, backoff, HTML detection) — but this code is not in the published package.

## Essential Features (MVP)

1. **Publish the CLI with existing retry logic** — Rebuild and republish `@projectxinnovation/helix-cli` so the deployed binary matches the source. No source code changes needed in this repo.

2. **Server returns JSON errors** (helix-global-server change) — This is the prerequisite. Without proper JSON error responses from the server, CLI retries just repeat the same 504 three times. The server fix must land first or concurrently.

## Features Explicitly Out of Scope (MVP)

- **CLI source code changes** — The existing retry/timeout/error-classification code is already correct.
- **Verbose/debug mode** — Per-attempt timing and retry diagnostics are a future enhancement.
- **Caching repo resolution** — Each command fetches the repo list; optimization, not a fix.
- **Client UI changes** — helix-global-client is not in the query path.

## Success Criteria

1. The deployed CLI package contains the retry loop — verifiable by inspecting `dist/lib/http.js` for `MAX_ATTEMPTS`, `RETRYABLE_STATUS_CODES`, and `AbortSignal.timeout`.
2. `hlx inspect db "SELECT 1/0"` (after server fix) returns a parseable JSON error, not HTML.
3. CLI properly retries on 429/500/502/503/504 with exponential backoff.
4. CLI has 30s per-request timeout.
5. No regression: `hlx inspect db "SELECT 1"` continues to work.

## Key Design Principles

- **Ship what's already built**: The retry logic is written and correct. Just publish it.
- **Agents are the primary consumer**: Error responses must be machine-parseable.
- **Zero runtime dependencies**: The CLI uses only Node.js built-ins; preserve this.

## Scope & Constraints

- **hx-cli**: Rebuild and republish only. No source code changes.
- **helix-global-server**: Primary code changes (error handling + table name fix) — separate product spec in that repo.
- **helix-global-client**: Context only, no changes.
- **Dependency ordering**: Server fix should land first/concurrently. CLI retries are only useful when the server returns proper JSON errors.

## Future Considerations

- CLI verbose/debug mode for retry observability.
- Cache repo resolution to reduce per-command HTTP calls.
- Monitoring/alerting on CLI-side failure rates.

## Open Questions / Risks

| Question / Risk | Notes |
|-----------------|-------|
| Does publishing require npm credentials / CI pipeline? | Deployment concern. The mechanism for publishing needs to be identified. |
| Will CLI retry on 4xx errors it shouldn't? | Source code has RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]. 400-level errors (except 429) are not retried. This is correct. |
| Server fix dependency | CLI retries are meaningless if the server still returns HTML 502/504 for all errors. The server fix is the critical path. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| diagnosis/diagnosis-statement.md (hx-cli) | CLI root cause | Deployed package has old code; source correct but unpublished |
| diagnosis/apl.json (hx-cli) | CLI evidence | Deployed http.js: single fetch, process.exit(1). 310ms = single request + Node startup. |
| scout/scout-summary.md (hx-cli) | CLI architecture | Retry logic in source works but can't overcome persistent server-side failure |
| scout/reference-map.json (hx-cli) | CLI file analysis | MAX_ATTEMPTS=3, 30s timeout, HTML error detection in source |
| diagnosis/diagnosis-statement.md (helix-global-server) | Server root cause (cross-repo) | Server must return JSON errors for CLI retries to be useful |
| diagnosis/apl.json (helix-global-server) | Server evidence | Express never sends error response; gateway generates HTML 502 |
| repo-guidance.json (helix-global-client run root) | Repo intent | server=target, CLI=target, client=context |
| ticket.md (helix-global-server) | Original ticket + continuation context | User asks how to get logs; prior feedback about db push verification |

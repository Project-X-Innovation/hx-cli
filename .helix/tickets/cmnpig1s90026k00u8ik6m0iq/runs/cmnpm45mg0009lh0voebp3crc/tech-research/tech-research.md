# Tech Research: CLI Rebuild and Republish (No Source Changes)

## Technology Foundation

| Component | Version | Role |
|-----------|---------|------|
| Node.js | >=18 | Runtime (built-in fetch, AbortSignal.timeout) |
| TypeScript | ^5.7.3 | Build |
| npm | N/A | Package distribution |

## Architecture Decision: Rebuild and Republish Only

### Problem

The deployed npm package `@projectxinnovation/helix-cli@1.2.0` contains the pre-hardening code: single `fetch()` call, no retry, no timeout, `process.exit(1)` on any error. The source code has full retry logic but was never published.

### Prior run's tech-research was incorrect

The prior run prescribed extensive source code changes to hx-cli (retry logic, timeout, HTML detection, process.exit removal). The current diagnosis proves all these changes **already exist in source**:

- `src/lib/http.ts`: `MAX_ATTEMPTS = 3`, `BASE_DELAY_MS = 2000`, `REQUEST_TIMEOUT_MS = 30_000`
- `RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])`
- HTML error detection via `buildErrorMessage()` checking content-type for `text/html`
- 429 Retry-After header support
- Exponential backoff with jitter
- Error classification (retryable vs permanent)

All that's missing is publishing the package.

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Rewrite retry logic | Prior run's approach: add retry/timeout/error handling | Redundant -- code already exists | Wastes effort, risks bugs |
| B. Rebuild and republish | Build the existing source and publish new npm version | Zero risk, minimal effort | Requires npm credentials/CI |
| C. Do nothing until server is fixed | Server fix is prerequisite for CLI retry to help | Avoids publishing overhead | Leaves CLI without timeout, HTML detection, or retry for transient errors |

### Chosen: Option B -- Rebuild and Republish

**Rationale:** The source code is already correct and complete. The `dist/lib/http.js` in the published package simply needs to match the source `src/lib/http.ts`. No code review needed for the retry logic -- it was already written and reviewed in a prior run.

**Dependency:** The server fix (helix-global-server) should land first or concurrently. Without proper JSON error responses from the server, CLI retries just repeat the same 504 three times. However, the CLI timeout and HTML detection are valuable even without the server fix.

## Core API/Methods

### No files to modify

All source code changes were already made in the prior run:
- `src/lib/http.ts` -- Full retry loop with timeout, backoff, error classification, HTML detection
- `src/index.ts` -- Error handling at entry point (already updated)
- `src/inspect/*.ts` -- Error propagation (already updated)
- `src/lib/resolve-repo.ts` -- Error handling (already updated)

### Key behaviors already in source

| Feature | Implementation | File:Line |
|---------|---------------|-----------|
| Per-request timeout | `AbortSignal.timeout(30_000)` | http.ts:72 |
| Retry loop | `for (attempt = 1; attempt <= MAX_ATTEMPTS; ...)` | http.ts:66-125 |
| Retryable status codes | `new Set([429, 500, 502, 503, 504])` | http.ts:6 |
| Backoff delay | `2000 * 2^(attempt-1) + random(0..500)` | http.ts:24-26 |
| 429 Retry-After | Parses header, caps at 60s | http.ts:80-88 |
| HTML detection | Checks content-type for `text/html` | http.ts:29-31 |
| Error propagation | Throws Error instead of process.exit | http.ts:98 |

## Technical Decisions

### CLI retry + server 422 status code alignment

The server tech-research directs using HTTP 422 for deterministic query errors. The CLI's `RETRYABLE_STATUS_CODES` already does NOT include 422, so deterministic errors will fail fast (no retry). This is the correct behavior without any CLI source changes.

### Version bump

The package should be published with a new version (e.g., 1.2.1 or 1.3.0) to distinguish the published binary from the unpublished 1.2.0. The version bump should happen in `package.json` before publishing.

## Cross-Platform Considerations

Not applicable. CLI runs in Node.js only.

## Performance Expectations

| Scenario | Current (deployed) | After Publish |
|----------|-------------------|---------------|
| Successful query | ~310ms (250ms Node + 60ms fetch) | Same |
| Transient failure | Immediate exit | ~2-4s retry then success |
| Permanent failure | Immediate exit | Immediate error (422 not retried) |
| Server hang | CLI hangs indefinitely | 30s timeout then error |
| All retries fail | N/A (single attempt) | ~8-12s then clear error |

## Dependencies

No new dependencies. Zero runtime dependencies preserved.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| npm publish requires credentials/CI | Medium | Deployment concern; not a code issue |
| Server fix not landed when CLI publishes | Low | CLI timeout and HTML detection still valuable standalone |
| Version 1.2.0 already deployed in running sandboxes | Low | New sandboxes get new version; running sandboxes unaffected |

## Deferred to Round 2

1. **CLI verbose/debug mode** -- Show per-attempt timing and retry info
2. **Configurable timeout/retry** -- Allow env vars to override defaults
3. **Cache repo resolution** -- Reduce per-command network calls

## Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Source changes | None needed | All retry/timeout/error handling code already exists in source |
| Action | Rebuild and republish npm package | Deployed binary must match source |
| Version | Bump to distinguish from unpublished 1.2.0 | Avoids confusion about which binary is deployed |

## APL Statement Reference

See `tech-research/apl.json`.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| diagnosis/diagnosis-statement.md (hx-cli) | CLI root cause | Deployed package has old code; source correct but unpublished |
| diagnosis/apl.json (hx-cli) | CLI evidence | Deployed http.js: single fetch, process.exit(1), 310ms = no retry |
| product/product.md (hx-cli) | CLI product scope | Rebuild and republish only; no source changes needed |
| hx-cli/src/lib/http.ts | Direct code inspection (this run) | Confirmed: full retry logic present (MAX_ATTEMPTS=3, 30s timeout, backoff, HTML detection) |
| Prior tech-research (this repo) | Comparison | Prior run incorrectly prescribed source code changes that already exist |
| diagnosis/diagnosis-statement.md (helix-global-server) | Cross-repo dependency | Server must return JSON errors for CLI retries to be useful |
| helix-global-server tech-research (this run) | Cross-repo direction | Server will use 422 for query errors; CLI's RETRYABLE_STATUS_CODES already excludes 422 |

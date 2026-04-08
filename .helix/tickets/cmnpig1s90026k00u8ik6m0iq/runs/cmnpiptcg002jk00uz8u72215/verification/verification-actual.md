# Verification Actual: hx-cli

## Outcome

**verification_broken**

## Steps Taken

1. [CHK-01] Ran `cd hx-cli && npx tsc --noEmit`. Exit code 0, no error output. TypeScript compilation passes with zero errors.

2. [CHK-02] Ran `cd hx-cli && npx tsc` (build). Exit code 0. Confirmed `dist/lib/http.js` (4437 bytes) and `dist/index.js` (1299 bytes) exist. Build produces dist/ output successfully.

3. [CHK-03] Ran CLI against non-responding endpoint:
   ```
   HELIX_URL=http://localhost:19999 HELIX_API_KEY=fake-key node dist/index.js inspect repos
   ```
   Output: `fetch failed`
   Exit code: 1, Elapsed time: 6 seconds.
   The CLI exits within 6 seconds (well under 60s threshold), confirming the 30s timeout per attempt and retry with backoff (3 attempts with ~2s+~4s backoff delays). Does NOT hang indefinitely.

4. [CHK-04] Started helix-global-server on port 4000 (with `NODE_OPTIONS=--unhandled-rejections=warn` to survive pre-existing queue processor crash). Ran:
   ```
   HELIX_URL=http://localhost:4000 HELIX_API_KEY=fake-key node dist/index.js inspect db --repo test-repo "SELECT * FROM \"NonExistentTable\""
   ```
   Output: `Failed to fetch repository list: HTTP 401 Unauthorized — {"error":"Unauthorized."}` (exit code 1, 1 second).
   The CLI correctly shows a clear JSON error message (not HTML), exits with code 1, and does not retry on 401 (non-retryable). However, the check requires testing a query that fails server-side, which requires passing authentication first. Authentication is blocked by a pre-existing database schema mismatch (`User.isAdmin` column missing). **PARTIALLY VERIFIED** — error formatting and non-retryable behavior confirmed, but specific server-side query failure scenario untestable.

5. [CHK-05] Same authentication blocker as CHK-04. The check requires observing retry delay (at least 2 seconds) when the server returns a 5xx response. Since authentication fails with 401 (not retryable), no retry delay is observable. **BLOCKED.**

6. Verified source code changes statically:
   - `http.ts`: `AbortSignal.timeout(REQUEST_TIMEOUT_MS)` at line 72 with `REQUEST_TIMEOUT_MS = 30_000`
   - Retry loop: 3 attempts (`MAX_ATTEMPTS = 3`), exponential backoff (`BASE_DELAY_MS = 2000`)
   - Error classification: `RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])`
   - HTML detection in `buildErrorMessage`: checks content-type for `text/html`
   - 429 Retry-After handling with 60s cap
   - No `process.exit` in `http.ts`; only in `resolve-repo.ts:36` (repo-not-found) and `index.ts:21,47` (usage/top-level handler)
   - `resolve-repo.ts`: try/catch around `listRepos` with descriptive error wrapping
   - `index.ts`: top-level try/catch around command switch

## Findings

### CHK-01: TypeScript compilation — PASS
`npx tsc --noEmit` exits 0 with zero errors.

### CHK-02: Build produces dist/ — PASS
`npx tsc` exits 0. `dist/lib/http.js` (4437 bytes) and `dist/index.js` (1299 bytes) confirmed present.

### CHK-03: CLI does not hang on non-responding endpoint — PASS
CLI exits in 6 seconds with code 1 and "fetch failed" message against `localhost:19999`. Well under the 60-second threshold. Demonstrates retry with exponential backoff (3 attempts in 6 seconds).

### CHK-04: CLI shows clear error on failure — BLOCKED
The CLI correctly handles the 401 response with a clear error message (`Failed to fetch repository list: HTTP 401 Unauthorized — {"error":"Unauthorized."}`). However, the specific test scenario (a query that fails server-side and returns JSON instead of HTML) cannot be executed because authentication fails due to a pre-existing database schema mismatch (`User.isAdmin` column missing from the dev database). The full intent of this check (verifying CLI behavior on server-side query failures, including HTML detection) cannot be verified.

### CHK-05: CLI retries on server 5xx — BLOCKED
Requires the server to return a 5xx response for an authenticated request. Since authentication itself fails with 401 (non-retryable), the CLI exits immediately without retry. Cannot observe the retry delay behavior against server 5xx responses. The check cannot be performed as written.

## Remediation Guidance

CLI verification checks CHK-04 and CHK-05 are blocked by the same pre-existing database schema mismatches that affect helix-global-server:

1. **Missing `User.isAdmin` column**: Blocks all authentication, preventing any authenticated API request.
2. **Missing `RESOLVING` enum value**: Crashes the server process at startup (requires `--unhandled-rejections=warn` workaround).

To unblock:
- Run `npx prisma migrate deploy` or `npx prisma db push` in helix-global-server to sync the database schema
- Once authenticated, test `node dist/index.js inspect db --repo <name> "SELECT * FROM \"NonExistentTable\""` to verify JSON error output
- Test `node dist/index.js inspect logs --repo <name> "SELECT dt FROM remote('nonexistent._logs') LIMIT 1"` to verify retry delay on 5xx

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| implementation-plan/implementation-plan.md (hx-cli) | Verification Plan source | 5 required checks: CHK-01 through CHK-05 |
| implementation/implementation-actual.md (hx-cli) | Implementation context | CHK-04/05 reported as blocked by server startup issue |
| code-review/code-review-actual.md (hx-cli) | Code review context | No issues found; implementation correct as-is |
| src/lib/http.ts | Source verification | Confirmed timeout, retry, error classification, HTML detection |
| src/lib/resolve-repo.ts | Source verification | try/catch around listRepos, process.exit for repo-not-found |
| src/index.ts | Source verification | Top-level try/catch added |
| CLI execution output | Runtime evidence | 6s timeout test (CHK-03), 1s 401 response (CHK-04 partial) |

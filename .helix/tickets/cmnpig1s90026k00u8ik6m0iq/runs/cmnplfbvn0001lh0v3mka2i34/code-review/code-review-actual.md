# Code Review: hx-cli

## Review Scope

Reviewed all three files changed by the implementation: `src/lib/http.ts`, `src/lib/resolve-repo.ts`, and `src/index.ts`. Cross-referenced changes against the ticket, product spec, diagnosis, and implementation plan.

## Files Reviewed

| File | Lines Reviewed | Verdict |
|------|---------------|---------|
| `src/lib/http.ts` | Full file (129 lines) | Clean. Complete rewrite with timeout, retry, error classification, and HTML detection. |
| `src/lib/resolve-repo.ts` | Full file (37 lines) | Clean. Try/catch around listRepos with descriptive error wrapping. process.exit(1) preserved for repo-not-found. |
| `src/index.ts` | Full file (48 lines) | Clean. Top-level try/catch catches thrown errors and exits cleanly. |

## Missed Requirements & Issues Found

### Requirements Gaps

None found. All product spec CLI requirements are implemented:
1. **Request timeouts** (30s via AbortSignal.timeout) - `http.ts:72` ✅
2. **Retry with exponential backoff** (3 attempts, 2s base, backoff + jitter) - `http.ts:66,92` ✅
3. **Error classification** (retryable: 429/500/502/503/504, TypeError, TimeoutError, AbortError; permanent: 4xx) - `http.ts:6,12-22` ✅
4. **Meaningful error output** (HTML detection returns clear message instead of raw HTML) - `http.ts:28-35` ✅
5. **429 Retry-After handling** (respects header, capped at 60s) - `http.ts:80-88` ✅

### Correctness/Behavior Issues

None found. The retry logic, error classification, and error propagation are correct:
- Network errors (TypeError, TimeoutError, AbortError) are retried ✅
- Formatted errors from non-retryable responses are thrown immediately without retry ✅
- The catch block correctly distinguishes own thrown errors from network errors ✅
- Last-attempt timeout gives a user-friendly message ✅

### Regression Risks

- `process.exit(1)` removed from `http.ts`, now only in `index.ts` (top-level handler), `resolve-repo.ts` (repo-not-found), and other pre-existing locations. This preserves exit-code-1 behavior while enabling retry. No regression.

### Code Quality/Robustness

- Zero new dependencies maintained (Node.js built-ins only) ✅
- `RETRYABLE_STATUS_CODES` includes 500 (aligned with server change from 502->500) ✅
- Error messages are descriptive and actionable ✅
- `buildErrorMessage` handles both HTML and text responses gracefully ✅

### Verification/Test Gaps

- Integration testing against live server blocked by pre-existing Prisma schema mismatch (unrelated)
- CLI timeout test (CHK-03) passed during implementation, confirming retry behavior

## Changes Made by Code Review

No code changes made. The hx-cli implementation is correct as-is.

## Remaining Risks / Deferred Items

1. **Integration testing blocked**: CLI integration tests against the server inspection endpoints are blocked by a pre-existing server startup crash (Prisma schema mismatch). This affects CHK-04 and CHK-05 in the verification plan.
2. **Retry amplification**: Both server and CLI retry on transient failures. A single failed request could generate up to 9 total attempts (3 server retries x 3 CLI retries). The 60 req/60s rate limit could be stressed under load. This is acknowledged in the product spec as a known risk.

## Verification Impact Notes

| Check ID | Impact | Assessment |
|----------|--------|------------|
| CHK-01 | No impact | TypeScript compilation still passes. |
| CHK-02 | No impact | Build still succeeds. |
| CHK-03 | Still valid | CLI timeout behavior unchanged. |
| CHK-04 | Still valid | Blocked by server startup issue. |
| CHK-05 | Still valid | Blocked by server startup issue. |

## APL Statement Reference

Reviewed all 3 changed files in hx-cli. No issues found. The implementation correctly adds 30s request timeout, retry with exponential backoff for retryable errors, HTML response detection, error classification, and top-level error handling. TypeScript compiles with zero errors.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (hx-cli) | Problem statement | Runtime logs intermittently fail; CLI exits immediately |
| product/product.md (hx-cli) | Requirements cross-check | CLI must have timeout, retry, error classification, meaningful output |
| diagnosis/diagnosis-statement.md (hx-cli) | Root cause context | Zero resilience: no timeout, no retry, process.exit(1) on any error |
| implementation-plan/implementation-plan.md (hx-cli) | Implementation spec | 4-step plan: rewrite hxFetch, update resolve-repo, add top-level handler |
| implementation/implementation-actual.md (hx-cli) | Scope map | 3 files changed, all plan steps executed |
| repo-guidance.json | Repo intent | hx-cli is target repo |

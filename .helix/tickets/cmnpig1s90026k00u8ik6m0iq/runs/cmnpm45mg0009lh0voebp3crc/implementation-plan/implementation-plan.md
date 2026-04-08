# Implementation Plan: hx-cli — Fix CLI Resilience for Runtime Log Inspection

## Overview

Fix the CLI's zero-resilience HTTP layer that causes agents to fail fatally on any transient server error. The CLI currently has no request timeout (can hang indefinitely), no retry logic, no error classification, and calls `process.exit(1)` on any non-ok HTTP response. The fix adds a 30s request timeout via `AbortSignal.timeout`, retry with exponential backoff for retryable status codes, error classification, HTML response detection, and moves `process.exit(1)` to the top-level entry point.

All changes are in the existing `src/lib/http.ts`, `src/lib/resolve-repo.ts`, and `src/index.ts`. Zero new dependencies.

## Implementation Principles

- **Centralized in hxFetch**: All commands (db, logs, api, repos) call `hxFetch`. Centralizing retry ensures all paths benefit.
- **Follow existing patterns**: Login command already uses `AbortSignal.timeout` (120s). Server's `waitWithRetry` uses 3 attempts, 2s base, exponential backoff + jitter. Apply the same patterns here.
- **Zero runtime dependencies**: Use only Node.js built-in APIs (`AbortSignal.timeout`, `fetch`, `setTimeout`).
- **Preserve user-visible behavior**: Exit code 1 on failure is maintained; errors just propagate through retry first.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add timeout, retry, error classification, and HTML detection to hxFetch | Updated `src/lib/http.ts` |
| 2 | Update resolve-repo.ts error handling | Updated `src/lib/resolve-repo.ts` |
| 3 | Add top-level error handler to CLI entry point | Updated `src/index.ts` |
| 4 | Run quality gates | Passing typecheck and build |

## Detailed Implementation Steps

### Step 1: Rewrite hxFetch with timeout, retry, error classification, and HTML detection

**Goal**: Transform `hxFetch` from a single-shot, exit-on-error function into a resilient HTTP layer with bounded retry and clear error messages.

**What to Build**:
- In `src/lib/http.ts`:
  - **Remove `process.exit(1)`** from the error handling path (line 35).
  - **Add request timeout**: Pass `signal: AbortSignal.timeout(30_000)` to the `fetch()` call (line 30). This prevents indefinite hangs. `AbortSignal.timeout()` is available in Node.js >=18 (matches CLI's `engines` requirement).
  - **Add retry constants** at module level:
    ```
    const MAX_ATTEMPTS = 3;
    const BASE_DELAY_MS = 2000;
    const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
    ```
  - **Add a `sleep` helper**: `function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }`
  - **Add an `isRetryable` function**: Takes a `Response` or error. Returns `true` for:
    - HTTP responses with status in `RETRYABLE_STATUS_CODES`
    - `TypeError` (network failure from fetch)
    - Errors with `name === "TimeoutError"` or `name === "AbortError"` (from `AbortSignal.timeout`)
  - **Add retry loop** in `hxFetch`:
    - Loop up to `MAX_ATTEMPTS`.
    - On each attempt: call `fetch()` with the timeout signal.
    - If response is ok: return `response.json()` as before.
    - If response is not ok and retryable and not last attempt: sleep with exponential backoff (`BASE_DELAY_MS * 2^(attempt-1) + Math.floor(Math.random() * 500)`) then retry.
    - If response is not ok and not retryable, or it's the last attempt: throw an error with a clear message.
    - On catch (network error / timeout): if retryable and not last attempt, sleep and retry. Otherwise throw.
  - **Add HTML response detection**: When building the error message for a non-ok response, check `response.headers.get("content-type")`. If it contains `text/html`, use the message: `"Server returned an HTML error page (HTTP ${response.status}). The request may have timed out or the service may be temporarily unavailable."` instead of dumping raw HTML. If content-type is JSON or text, include the first 500 chars of the body.
  - **Throw instead of exit**: `hxFetch` throws `new Error(message)` on exhausted retries or permanent failures. It no longer calls `process.exit(1)`.
  - **Handle 429 Retry-After**: On HTTP 429, check for `Retry-After` header. If present (as seconds), use that as the sleep duration instead of the exponential backoff formula. Cap at 60s.

**Verification (AI Agent Runs)**:
- `cd /vercel/sandbox/workspaces/cmnpiptcg002jk00uz8u72215/hx-cli && npx tsc --noEmit` should pass.

**Success Criteria**:
- `hxFetch` includes `AbortSignal.timeout(30_000)` on the fetch call.
- Retry loop with 3 attempts and exponential backoff.
- Error classification: retryable (429, 500, 502, 503, 504, network errors, timeouts) vs permanent (4xx).
- HTML detection: non-HTML error bodies show content, HTML bodies show a clear message.
- No `process.exit` calls in `http.ts`.

---

### Step 2: Update resolve-repo.ts error handling

**Goal**: Ensure `resolveRepo` works correctly with the new throwing `hxFetch` while preserving the explicit exit for "repo not found" (a usage error, not a transient failure).

**What to Build**:
- In `src/lib/resolve-repo.ts`:
  - The `listRepos` function (line 7) calls `hxFetch` which now throws on failure instead of exiting. No change needed to `listRepos` — the thrown error propagates up naturally.
  - The `resolveRepo` function (line 11) still has its own `process.exit(1)` at line 32 for the "repo not found" case. **Keep this** — it's a usage error (wrong repo name), not a transient failure. The user should see the available repos and the process should exit.
  - Wrap the `listRepos` call in a try/catch. On error, re-throw with a more descriptive message: `throw new Error("Failed to fetch repository list: " + (error instanceof Error ? error.message : String(error)))`.

**Verification (AI Agent Runs)**:
- `cd /vercel/sandbox/workspaces/cmnpiptcg002jk00uz8u72215/hx-cli && npx tsc --noEmit` should pass.

**Success Criteria**:
- Network errors from `listRepos` propagate as thrown errors (not `process.exit`).
- "Repo not found" still shows available repos and exits (line 32).

---

### Step 3: Add top-level error handler to CLI entry point

**Goal**: Catch errors thrown by command handlers (from the new throwing `hxFetch`) and exit with code 1, preserving the same user-visible behavior.

**What to Build**:
- In `src/index.ts`:
  - Wrap the `switch` statement (lines 24-43) in a `try/catch` block.
  - In the catch block: `console.error(error instanceof Error ? error.message : String(error)); process.exit(1);`
  - This ensures any unhandled error from command execution prints a clean message and exits with code 1, matching the previous behavior where `hxFetch` called `process.exit(1)` directly.

**Verification (AI Agent Runs)**:
- `cd /vercel/sandbox/workspaces/cmnpiptcg002jk00uz8u72215/hx-cli && npx tsc --noEmit` should pass.
- `cd /vercel/sandbox/workspaces/cmnpiptcg002jk00uz8u72215/hx-cli && npx tsc` (build) should pass.

**Success Criteria**:
- Top-level try/catch in `src/index.ts` catches errors from all command paths.
- Error messages are printed cleanly to stderr.
- Process exits with code 1 on error.

---

### Step 4: Run quality gates

**Goal**: Verify the changes compile correctly.

**What to Build**: No code changes. Run verification commands.

**Verification (AI Agent Runs)**:
- `cd /vercel/sandbox/workspaces/cmnpiptcg002jk00uz8u72215/hx-cli && npx tsc --noEmit` — must pass (typecheck).
- `cd /vercel/sandbox/workspaces/cmnpiptcg002jk00uz8u72215/hx-cli && npx tsc` — must pass (build).

**Success Criteria**:
- TypeScript compiles with zero errors.
- Build produces output in `dist/`.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >=18 available | available | hx-cli package.json `engines: ">=18"` | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| npm dependencies installed | available | `npm install` in hx-cli | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| TypeScript compiler (tsc) | available | devDependency in package.json | CHK-01, CHK-02 |
| helix-global-server running on port 4000 | available | Dev setup config provides server startup command and .env | CHK-03, CHK-04, CHK-05 |
| Inspection API credentials configured (API key or token) | available | Dev setup login credentials can generate inspection token | CHK-03, CHK-04, CHK-05 |
| helix-global-server changes deployed (Step 3 of server plan) | unknown | Server plan must complete first for full integration testing; CLI tests still meaningful against current server | CHK-04, CHK-05 |

### Required Checks

[CHK-01] TypeScript compilation passes with zero errors.
- Action: Run `cd /vercel/sandbox/workspaces/cmnpiptcg002jk00uz8u72215/hx-cli && npx tsc --noEmit`.
- Expected Outcome: Exit code 0 with no error output.
- Required Evidence: Command output showing successful compilation (no errors printed).

[CHK-02] Build produces dist/ output successfully.
- Action: Run `cd /vercel/sandbox/workspaces/cmnpiptcg002jk00uz8u72215/hx-cli && npx tsc`.
- Expected Outcome: Exit code 0. The `dist/` directory contains compiled JS files including `dist/lib/http.js`, `dist/index.js`.
- Required Evidence: Command output (no errors) plus file listing of `dist/lib/http.js` and `dist/index.js`.

[CHK-03] CLI does not hang indefinitely on a non-responding endpoint.
- Action: Run the built CLI (`node dist/index.js inspect repos`) against a non-existing server URL (e.g., set `HELIX_URL=http://localhost:19999`). Time the execution.
- Expected Outcome: The CLI exits with an error within ~35 seconds (30s timeout + retry backoff overhead). It does NOT hang indefinitely.
- Required Evidence: Command output showing error message and the elapsed wall-clock time (must be under 60 seconds).

[CHK-04] CLI retries on transient failure and shows clear error message.
- Action: Start the helix-global-server on port 4000. Configure the CLI to point at `http://localhost:4000`. Run `node dist/index.js inspect db --repo <repoName> "SELECT * FROM \"NonExistentTable\""` (a query that will fail server-side). Observe the output.
- Expected Outcome: The CLI shows a clear JSON error message from the server (not raw HTML). The error message includes the failure reason. The process exits with code 1.
- Required Evidence: Full CLI output showing the error message. If the server returns HTML (because server-side fix not yet deployed), the CLI should show the HTML detection message ("Server returned an HTML error page...") instead of raw HTML tags.

[CHK-05] CLI retries on server 5xx and eventually reports failure clearly.
- Action: Start the helix-global-server on port 4000. Run `node dist/index.js inspect logs --repo <repoName> "SELECT dt FROM remote('nonexistent._logs') LIMIT 1"` which is expected to fail. Observe timing and output.
- Expected Outcome: The CLI retries (observable by the ~4-8 second delay before the error appears, compared to the previous instant failure). After retries are exhausted, it shows a clear error message and exits with code 1.
- Required Evidence: CLI output showing the error message and approximate wall-clock time demonstrating retry delay (at least 2 seconds, indicating at least one retry occurred).

## Success Metrics

1. `hxFetch` uses `AbortSignal.timeout(30_000)` — no indefinite hangs.
2. Retry loop with 3 attempts and exponential backoff for retryable errors.
3. Error classification: 429/5xx and network errors retried; 4xx fails immediately.
4. HTML responses detected and surfaced as clear messages.
5. `process.exit(1)` only in `resolve-repo.ts` (repo-not-found) and `index.ts` (top-level handler).
6. TypeScript compiles with zero errors.
7. Build succeeds.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (hx-cli) | Problem statement | Runtime logs intermittently fail; flaky behavior across CLI and server |
| scout/scout-summary.md (hx-cli) | CLI architecture analysis | No timeout, no retry, process.exit(1) on any error; login has 2-min timeout |
| scout/reference-map.json (hx-cli) | File-level code map | Bare fetch at line 30, process.exit(1) at line 36, uncached resolveRepo |
| diagnosis/diagnosis-statement.md (hx-cli) | CLI root cause | Zero resilience; login has timeout pattern not applied to inspection |
| diagnosis/apl.json (hx-cli) | Structured evidence | process.exit(1) prevents retry; pattern exists in login.ts |
| product/product.md (hx-cli) | Product requirements | CLI timeout, retry with backoff, error classification, meaningful output; preserve zero deps |
| tech-research/tech-research.md (hx-cli) | Technical decisions | Centralized in hxFetch; 30s timeout; 3 attempts; status-code classification; HTML detection |
| tech-research/apl.json (hx-cli) | Q&A decisions | Include 500 in retryable set (server will return 500 for external failures) |
| src/lib/http.ts | Source code | Bare fetch, no signal, process.exit(1) on !response.ok — 39 lines total |
| src/lib/resolve-repo.ts | Source code | Own process.exit(1) at line 32 for repo-not-found (keep) |
| src/index.ts | Source code | CLI entry point with switch; no top-level error handling |
| src/inspect/logs.ts, db.ts, api.ts | Source code | Simple call-through to hxFetch + resolveRepo; no error handling of their own |
| package.json (hx-cli) | CLI config | engines >=18, zero runtime deps, tsc-only build |
| tsconfig.json (hx-cli) | Build config | target ES2022, module Node16 — AbortSignal.timeout in type defs |
| tech-research/tech-research.md (helix-global-server) | Cross-repo context | Server will change 502→500; CLI should retry 500 |

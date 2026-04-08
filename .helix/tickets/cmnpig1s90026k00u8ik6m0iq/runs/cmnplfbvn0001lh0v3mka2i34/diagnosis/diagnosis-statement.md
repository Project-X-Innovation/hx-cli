# Diagnosis Statement

## Problem Summary

The hx-cli is the primary interface agents use to execute runtime inspection queries. It has zero resilience against transient server failures: no timeout, no retry, no error classification. When the server returns 504 (which the DigitalOcean proxy does when intercepting 502 errors from Express), the CLI exits immediately with `process.exit(1)` and no recovery path.

## Root Cause Analysis

### CLI-specific root cause: Fatal error handling with no retry

The `hxFetch` function (`src/lib/http.ts:30-36`) calls bare `fetch()` with no `AbortSignal` timeout and calls `process.exit(1)` on any non-ok HTTP response. There is no distinction between retryable errors (429, 502, 503, 504) and permanent errors (400, 401, 403, 404).

### Cross-cutting: DO proxy strips error messages

The DigitalOcean App Platform proxy intercepts HTTP 502 responses from Express, replacing the JSON error body with generic HTML. The CLI receives HTML instead of the actionable JSON error message, making diagnostics impossible for agents.

### Missing patterns that exist elsewhere

- The login command (`src/login.ts:100-103`) has a 2-minute `AbortSignal.timeout`, showing timeout awareness
- The server's `waitWithRetry` (`wait-retry.ts`) has 3 attempts with exponential backoff and jitter
- Neither pattern was applied to inspection query commands

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| `src/lib/http.ts:30` | Bare `fetch()` with no `AbortSignal` - requests hang indefinitely |
| `src/lib/http.ts:36` | `process.exit(1)` on any non-ok response - no error classification |
| `src/lib/resolve-repo.ts:7` | Uncached repo list re-fetched on every command |
| `src/login.ts:100-103` | Login HAS timeout - pattern exists but not applied to inspection |
| Runtime testing | 10+ inspection queries returning 504 - CLI exits immediately each time |
| `hlx inspect repos` | Succeeds consistently - server is reachable, auth works |

## Success Criteria

1. CLI retries retryable errors (429, 502, 503, 504) with exponential backoff (3 attempts, ~2s base delay)
2. CLI has request timeout (e.g., 30s) via AbortSignal.timeout
3. CLI classifies errors: retryable vs permanent
4. CLI shows meaningful error output (not truncated HTML)
5. Optional: CLI caches repo list for resolveRepo to avoid redundant network calls

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/reference-map.json (hx-cli) | Understand CLI architecture | No timeout, no retry, process.exit(1), zero runtime deps |
| scout/scout-summary.md (hx-cli) | Full CLI analysis | Two sequential HTTP calls per query, login has timeout but inspection doesn't |
| src/lib/http.ts | Core HTTP implementation | Bare fetch, immediate exit on error |
| src/lib/resolve-repo.ts | Repo resolution | Uncached fetch on every invocation |
| src/inspect/logs.ts | Log query command | Two sequential calls, no error handling |
| src/inspect/db.ts | Database query command | Same pattern as logs |
| Runtime inspection: curl headers | Cross-repo evidence | x-do-orig-status: 502 from server, converted to 504 by DO proxy |

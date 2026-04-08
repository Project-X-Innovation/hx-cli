# Scout Summary — hx-cli

## Problem

The `hlx` CLI is the tool agents use to run runtime inspection queries (database, logs, API). It has no timeout on HTTP requests, no retry logic, and immediately exits the process on any non-ok HTTP response. When the server's inspection endpoints return 504 Gateway Timeout (which happened on all 5 attempts during this scout session), the CLI fails instantly with no recovery path. This directly contributes to the reported flakiness: agents have zero resilience against transient server/gateway failures.

## Analysis Summary

### Request flow for a log query via CLI
```
hlx inspect logs --repo <name> "<query>"
  → loadConfig() (env vars or ~/.hlx/config.json)
  → resolveRepo() → GET /api/inspect/repositories (fetch, no timeout)
  → hxFetch() → POST /api/inspect/<repoId>/logs (fetch, no timeout)
  → on success: console.log(JSON.stringify(result))
  → on ANY HTTP error: console.error + process.exit(1)
```

### Key observations

1. **No timeout on fetch**: `hxFetch` (src/lib/http.ts:30) calls `fetch()` without an `AbortSignal`. If the server hangs (e.g., processing a slow BetterStack query), the CLI hangs indefinitely. Node.js built-in fetch does not impose a default timeout.

2. **Immediate process.exit on any error**: Any non-ok response triggers `process.exit(1)` (line 36). There is no distinction between retryable errors (429, 502, 503, 504) and permanent errors (400, 401, 404). A transient 504 is treated the same as a bad request.

3. **Two sequential network calls per query**: Every inspection command first calls `resolveRepo()` which fetches the entire repository list, then makes the actual query call. The repo list is not cached — even back-to-back queries re-fetch it.

4. **No debug/diagnostic output**: There is no verbose mode, no request timing, and no way to diagnose where in the chain a failure occurred. Agents see only `Error: HTTP 504 Gateway Timeout` with truncated HTML.

5. **Zero runtime dependencies**: The CLI uses only Node.js built-ins (fetch, crypto, fs). This simplifies the package but means no retry libraries, no HTTP agents with keepalive, no sophisticated error handling.

6. **Contrast with login command**: The login flow (src/login.ts) has a 2-minute timeout, showing awareness of timeout needs — but this pattern was not applied to inspection commands.

## Relevant Files

| File | Role |
|------|------|
| `src/lib/http.ts` | Core HTTP layer: no timeout, no retry, process.exit(1) on error |
| `src/inspect/logs.ts` | Log query command: two sequential fetch calls, no error recovery |
| `src/inspect/db.ts` | Database query command: same vulnerable pattern |
| `src/lib/resolve-repo.ts` | Repo resolution: uncached full-list fetch on every command |
| `src/lib/config.ts` | Config loading: env vars with 3 name variants + file fallback |
| `src/inspect/index.ts` | Command router: no retry wrapping |
| `src/index.ts` | CLI entry point: no global error handling |
| `package.json` | Version 1.2.0, zero runtime deps, tsc-only build |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement | "sometimes it works sometimes it doesn't" — agents cannot access runtime logs intermittently, issue spans CLI and server |
| src/lib/http.ts | Core HTTP implementation | No timeout, no retry, process.exit(1) on any HTTP error — zero resilience |
| src/inspect/logs.ts | Log query implementation | Two sequential fetch calls with no error recovery |
| src/lib/resolve-repo.ts | Repo resolution | Uncached repo list fetched on every command adds an extra network call |
| src/lib/config.ts | Configuration | Multiple env var names for same config; clean fallback chain |
| Runtime inspection: hlx inspect logs (3 attempts) | Reproduce flakiness | All returned 504; CLI exits immediately |
| Runtime inspection: hlx inspect db (2 attempts) | Reproduce flakiness | All returned 504; same pattern |
| Runtime inspection: hlx inspect repos (2 attempts) | Verify partial connectivity | Succeeded both times — lightweight endpoint works |

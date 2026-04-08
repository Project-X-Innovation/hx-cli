# Tech Research: Fix CLI Resilience for Runtime Log Inspection

## Technology Foundation

- **Runtime**: Node.js >=18 (built-in `fetch`, `AbortSignal.timeout()`, `crypto`)
- **Build**: TypeScript 6, ESM modules, tsc-only build
- **Dependencies**: Zero runtime dependencies (intentional constraint)
- **Distribution**: npm package `@projectxinnovation/helix-cli` v1.2.0

## Architecture Decision

### Problem

The CLI has zero resilience against transient server/gateway failures:
- `hxFetch` calls bare `fetch()` with no `AbortSignal` timeout — can hang indefinitely
- Any non-ok HTTP response triggers `process.exit(1)` — no retry, no error classification
- When DO proxy returns HTML (504), the CLI dumps raw HTML to stderr

### Options Considered

#### Option A: Add retry at each command handler level
- **Approach**: Wrap `cmdLogs`, `cmdDb`, etc. in retry loops.
- **Pros**: Per-command retry configuration.
- **Cons**: Duplicate retry logic in every command. Risk of inconsistency. `resolveRepo` also calls `hxFetch` but wouldn't get retry.
- **Rejected because**: Violates DRY; `hxFetch` is the universal bottleneck.

#### Option B: Centralized retry in hxFetch (CHOSEN)
- **Approach**: Add timeout, retry, error classification, and HTML detection all within `hxFetch`.
- **Pros**: Every command (db, logs, api, repos) benefits automatically. Single place to maintain. Consistent behavior.
- **Cons**: All commands share the same retry policy (acceptable for this use case).
- **Chosen because**: All commands use `hxFetch`; centralizing ensures completeness.

#### Option C: Add a retry library dependency
- **Approach**: Use `p-retry`, `async-retry`, or similar.
- **Pros**: Battle-tested retry implementations.
- **Cons**: Breaks the zero-dependency constraint. Adds supply chain risk. The retry logic needed is simple (~30 lines).
- **Rejected because**: Zero-dependency constraint is a deliberate design choice per product spec.

### Chosen Architecture: Option B

Modify `src/lib/http.ts` to add:
1. `AbortSignal.timeout(30_000)` on all fetch calls
2. Retry loop with exponential backoff for retryable status codes
3. Error classification (retryable vs permanent)
4. HTML response detection and clear messaging
5. Remove `process.exit(1)` from `hxFetch`; throw errors instead
6. Add top-level error handler in entry point

## Core API/Methods

### hxFetch changes (src/lib/http.ts)

**Current signature** (unchanged):
```
hxFetch(config: HxConfig, path: string, options?: {...}): Promise<unknown>
```

**Behavioral changes**:
- Adds `signal: AbortSignal.timeout(30_000)` to the fetch init
- On non-ok response: classifies as retryable or permanent
- Retryable: sleeps with exponential backoff, retries up to 3 times
- Permanent or all retries exhausted: throws an Error with a clear message
- On HTML response: extracts status info and provides a human-readable error instead of raw HTML
- No longer calls `process.exit(1)` — throws instead

**Retry constants** (inline, matching server pattern):
- `MAX_ATTEMPTS = 3`
- `BASE_DELAY_MS = 2000`
- Delay formula: `BASE_DELAY_MS * 2^(attempt-1) + random(0..500)`
- Retryable codes: `429, 500, 502, 503, 504`
- Also retry on `TypeError` (network failure) and `TimeoutError` (`AbortSignal.timeout` expiry)

### Error propagation changes

**Current**: `hxFetch` calls `process.exit(1)` internally. Callers assume it never throws.
**New**: `hxFetch` throws. All call sites need to handle errors:

- `src/inspect/logs.ts`: `cmdLogs` — called from command dispatch, error propagates up
- `src/inspect/db.ts`: `cmdDb` — same pattern
- `src/lib/resolve-repo.ts`: `resolveRepo` calls `listRepos` which calls `hxFetch` — currently has its own `process.exit(1)` for "not found" (line 31). Keep that exit for the "repo not found" case (it's a usage error, not a transient failure). The network failure case will now throw from `hxFetch`.
- `src/index.ts`: Add top-level try/catch around command dispatch. On error: `console.error(error.message)` then `process.exit(1)`.

## Technical Decisions

### 1. Timeout value: 30 seconds

**Decision**: 30s timeout for CLI fetch calls.

**Rationale**: The server has a 15s timeout for external queries (configurable after this fix). With server-side retry (3 attempts), the server could take up to ~25s before returning a failure. The CLI's 30s allows the server to complete its retry cycle before the CLI times out. If the server responds faster (success or fast failure), the CLI proceeds immediately.

**Rejected**: 15s (matches server but doesn't allow for server retries), 60s (too long for agent workflows), 120s (current login timeout, too long for queries).

### 2. Include HTTP 500 in retryable set

**Decision**: CLI retries HTTP 500 responses.

**Rationale**: After the server-side fix, external query failures return 500 instead of 502. These are often transient (network glitch, external service overload). Permanent validation errors (bad query, missing credentials) return 400/404, not 500, so they won't be retried.

### 3. Remove process.exit from hxFetch

**Decision**: Throw errors instead of calling `process.exit(1)`.

**Rationale**: `process.exit(1)` in `hxFetch` makes retry impossible at any level. It also prevents proper error handling by callers. Moving exit to the top-level entry point maintains the same user-visible behavior (exit code 1 on failure) while allowing retry internally.

### 4. HTML response detection

**Decision**: Check `content-type` header for `text/html`. When detected, show: `"Server returned an HTML error page (HTTP {status}). The request may have timed out or the service may be temporarily unavailable."`

**Rationale**: The DO proxy returns `content-type: text/html` with its error page. Displaying raw HTML to agents is useless. A clear message with the status code is actionable.

## Cross-Platform Considerations

Not applicable. CLI runs in Node.js only (agent sandboxes and developer machines).

## Performance Expectations

| Scenario | Current | After Fix |
|----------|---------|-----------|
| Successful query | ~40-100ms | ~40-100ms (no change, timeout not triggered) |
| Transient failure, 1 retry succeeds | Immediate exit | ~2-4s then success |
| All retries fail | Immediate exit | ~8-12s then clear error |
| Server hangs (no response) | CLI hangs indefinitely | 30s timeout then error |

## Dependencies

- **No new dependencies**. All changes use Node.js built-in APIs:
  - `AbortSignal.timeout()` (Node.js >=18)
  - `fetch` (Node.js >=18)
  - `setTimeout` / `Promise` for delay

### Modified files
- `src/lib/http.ts` — timeout, retry, error classification, remove process.exit
- `src/lib/resolve-repo.ts` — remove process.exit on network errors (keep for "not found" usage error)
- `src/inspect/logs.ts` — propagate errors (minimal change)
- `src/inspect/db.ts` — propagate errors (minimal change)
- `src/index.ts` — add top-level error handler with process.exit(1)

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Retrying 500 masks permanent server bugs | Low | Permanent errors (bad query, auth failure) return 4xx, not 500. Only external call failures return 500. Max 3 retries with backoff limits impact. |
| AbortSignal.timeout not available in older Node | Low | CLI requires Node.js >=18 per engines field. AbortSignal.timeout available since Node 18. |
| Retry delays slow down agent workflows | Low | Max retry overhead ~8-12s. Without retry, the query would fail immediately and the agent would need to handle the failure or be stuck. |
| process.exit removal changes error propagation | Low | All callers are in-repo and updated together. Top-level handler preserves exit code 1 behavior. |

## Deferred to Round 2

- **Verbose/debug mode**: Useful for showing retry attempts, timing, and headers. Not required for core fix.
- **resolveRepo caching**: Would eliminate 1 redundant network call per command. Does not fix the failure mode.
- **Configurable timeout**: Currently hardcoded to 30s. Can be made configurable via env var or flag later.
- **Configurable retry count**: Currently hardcoded to 3. Can be made configurable later.

## Summary Table

| Area | Decision | File |
|------|----------|------|
| Timeout | 30s via AbortSignal.timeout | `src/lib/http.ts` |
| Retry | 3 attempts, 2s base exponential backoff | `src/lib/http.ts` |
| Error classification | Status-code based (429/5xx retryable, 4xx permanent) | `src/lib/http.ts` |
| HTML detection | Content-type check, clear message | `src/lib/http.ts` |
| process.exit | Moved to top-level entry point | `src/lib/http.ts`, `src/index.ts` |

## APL Statement Reference

See `tech-research/apl.json` for the structured question-answer pairs that drove these decisions.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| diagnosis/diagnosis-statement.md (hx-cli) | CLI root cause | Zero resilience: no timeout, no retry, process.exit(1) on any error |
| diagnosis/apl.json (hx-cli) | Structured evidence | Login has timeout pattern, server has waitWithRetry pattern — neither applied to inspection |
| product/product.md (hx-cli) | Product direction | CLI timeout, retry with backoff, error classification, meaningful error output; preserve zero deps |
| scout/reference-map.json (hx-cli) | File-level code map | Bare fetch at line 30, process.exit(1) at line 36, no AbortSignal |
| scout/scout-summary.md (hx-cli) | CLI analysis | Two sequential HTTP calls per query, no debug mode, login has 2-min timeout |
| src/lib/http.ts | Source code | Confirmed: bare fetch, no signal, process.exit(1) on !response.ok |
| src/inspect/logs.ts, src/inspect/db.ts | Source code | Confirmed: simple call-through to hxFetch, no error handling |
| src/lib/resolve-repo.ts | Source code | Confirmed: uncached repo list fetch, own process.exit(1) for not-found |
| package.json | CLI config | engines: node >=18, zero runtime deps, version 1.2.0 |
| tsconfig.json | Build config | target ES2022, module Node16 — AbortSignal.timeout in type defs |
| diagnosis/diagnosis-statement.md (helix-global-server) | Server-side context | Server will change 502->500; CLI should retry 500 |
| Web search: Node.js AbortSignal.timeout | API availability | Available since Node.js 18; fetch has no default timeout; throws TimeoutError |

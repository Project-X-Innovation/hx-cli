# Tech Research: Resolve archived ticket references in hlx CLI

## Technology Foundation

- **Language**: TypeScript 6.x with strict mode, ES2022 target, Node16 module resolution
- **Runtime**: Node.js >=18 (current dev environment: Node 24.14.1)
- **Test runner**: Node's built-in `node:test` with `node:assert`; zero external test dependencies
- **Build**: `tsc` compilation to `dist/`; tests run from compiled JS (`node --test dist/**/*.test.js`)
- **HTTP**: Custom `hxFetch()` utility in `src/lib/http.ts` with retry logic, already supporting `queryParams`
- **No frontend**: This is a pure CLI fix; no React/Next.js/Tailwind involvement

## Architecture Decision

### Problem

`resolveTicket()` in `src/lib/resolve-ticket.ts` (line 89) fetches only active tickets via `GET /api/tickets` with no query parameters. Archived tickets are never queried, causing all 9 commands that route through this shared resolver to fail with "ticket not found" for archived ticket references.

### Options Considered

#### Option A: Parallel fetch (always fetch both active and archived)

Use `Promise.all` to fetch active and archived tickets simultaneously on every resolution call.

- **Pro**: Fastest worst-case resolution (both fetches happen concurrently)
- **Pro**: Simpler control flow — both datasets always available
- **Con**: Always makes 2 API calls, even when the common case (active match) needs only 1
- **Con**: Wastes bandwidth and server resources for the majority of resolutions
- **Con**: Contradicts the product spec's "fallback" framing

#### Option B: Sequential/lazy archived fetch (chosen)

Fetch active tickets first. Only fetch archived tickets if no active match is found.

- **Pro**: 1 API call in the common case (active match found)
- **Pro**: Aligns with the product spec's "search active first, fall back to archived" workflow
- **Pro**: No unnecessary server load for the majority of resolutions
- **Con**: 2 sequential API calls in the worst case (slightly slower than parallel for archived lookups)

#### Option C: Single combined API call

Send a single request that returns both active and archived tickets.

- **Not viable**: The API does not support this. `GET /api/tickets` returns active; `GET /api/tickets?archived=true` returns archived. There is no combined mode. (Evidence: `list.ts:43-44` and `latest.ts:24-25` use `archived=true` as a toggle.)

### Chosen: Option B — Sequential/lazy archived fetch

**Rationale**: Active ticket matches are the common case. The product spec explicitly describes archived as a "fallback." Lazy fetching avoids doubling API calls for every resolution. The 2-call worst case only occurs when the ticket is genuinely archived or missing, which is the minority scenario.

## Core API/Methods

### Modified function: `resolveTicket()`

**Location**: `src/lib/resolve-ticket.ts`, lines 83-127

**Current signature**:
```
resolveTicket(config: HxConfig, ref: string): Promise<{ id: string; shortId: string }>
```

**New signature** (backward-compatible):
```
resolveTicket(config: HxConfig, ref: string, options?: { fetchFn?: typeof hxFetch }): Promise<{ id: string; shortId: string }>
```

The optional `options.fetchFn` parameter enables dependency injection for testing. All 9 existing call sites pass exactly 2 arguments and remain unchanged.

### Unchanged functions

- **`matchTicket()`** (`resolve-ticket.ts:44-77`): Pure function that matches a ref against any items array. Already works for archived items when they are included in the input. No modification needed.
- **`extractTicketRef()`** (`resolve-ticket.ts:17-31`): Extracts the ref from CLI args. Not involved in the fetch/match logic. No modification needed.
- **`hxFetch()`** (`http.ts:37-134`): Already supports `queryParams` option (lines 40, 46-49). The archived API call pattern `queryParams: { archived: "true" }` is already established by `list.ts` and `latest.ts`. No modification needed.

### New control flow for `resolveTicket()`

1. Fetch active tickets: `fetchFn(config, "/tickets", { basePath: "/api" })` → `activeItems`
2. `matchTicket(activeItems, ref)` → if match found, return immediately (active priority)
3. Fetch archived tickets: `fetchFn(config, "/tickets", { basePath: "/api", queryParams: { archived: "true" } })` → `archivedItems`
4. `matchTicket(archivedItems, ref)` → if match found, return (archived fallback)
5. If ref is numeric, scan `[...activeItems, ...archivedItems]` for ambiguous matches → throw ambiguity error if >1 matches
6. Throw "not found" error

## Technical Decisions

### 1. Dependency injection for testability

**Decision**: Add optional `options?: { fetchFn?: typeof hxFetch }` parameter to `resolveTicket()`.

**Rejected alternatives**:
- `mock.module` from `node:test`: Not available in the runtime (`mock.module` returned `undefined` in Node 24.14.1). Cannot use it to mock the `hxFetch` import.
- `mock.method`: Requires an object target. `hxFetch` is a standalone function import, not a method on an object. Would require restructuring exports.
- Module-level setter (`setFetchFn`): Introduces mutable module state. More complex and error-prone than a parameter.
- External mocking library: Package has zero runtime dependencies and only `@types/node` + `typescript` in devDependencies. Adding a test library is out of scope.

**Why DI is correct**: The optional parameter is backward-compatible (no call site changes), requires no external dependencies, and follows a standard TypeScript pattern. Tests create a `mock.fn()` that inspects `queryParams` to return different data for active vs. archived calls.

### 2. Active-first priority

**Decision**: If `matchTicket(activeItems, ref)` finds a match, return immediately without fetching archived tickets.

**Rationale**: Ticket requirement — "If active lookup succeeds, do not override it with archived data." This also means the archived API call is skipped entirely when the active match succeeds, which is the performance-optimal path.

### 3. Cross-set ambiguity detection

**Decision**: When no match is found in either set and the ref is numeric, combine both arrays for ambiguity scanning: `[...activeItems, ...archivedItems]`.

**Rationale**: Ticket acceptance criterion #9 requires detecting numeric ambiguity across active and archived results. A numeric ref like "339" matching one active ticket and one archived ticket is ambiguous. The current code only checks the active array (lines 102-121); the fix must check the combined array.

**Note on deduplication**: Based on the API's toggle behavior (`list.ts:43-44`), active and archived sets are disjoint (the `archived=true` param returns only archived tickets). No deduplication is expected. If the API returned overlapping items, the behavior is still correct: matchTicket would find the match in the active set first (step 2) and return early.

### 4. Error handling for archived fetch failures

**Decision**: If the active fetch succeeds with no match, and the archived fetch then fails (network/server error), throw an error that:
- Identifies "resolution" as the failing stage
- Includes the underlying error message
- Does NOT fall through to a "ticket not found" error

**Rationale**: Ticket Failure Behavior section: "Do not silently drop the archived lookup path on network or parsing errors." Product spec: "if the archived lookup itself fails, the CLI must report a resolution-stage error."

**Error message pattern**: `"Failed to fetch archived ticket list for resolution: <original error>"` — parallel to the existing active-fetch error at lines 92-95.

### 5. Disjoint active/archived sets assumption

**Decision**: Treat the API's active and archived ticket responses as disjoint sets. Do not deduplicate.

**Rationale**: `list.ts:43-44` uses `archived=true` as a toggle, suggesting the parameter switches the result set rather than adding to it. Even if this assumption is wrong, the code is still correct because active match has priority (step 2 returns before step 4).

**Risk**: Low. If the sets overlap, the only effect is that a ticket could match in both. Active priority ensures the correct result. The ambiguity check on the combined array would see duplicates, but only for the same ticket — which is not ambiguous.

## Cross-Platform Considerations

Not applicable. This is a Node.js CLI tool with no platform-specific behavior. The fix is in pure TypeScript logic and HTTP calls.

## Performance Expectations

| Scenario | API calls | Latency impact |
|----------|-----------|----------------|
| Active ticket match (common case) | 1 (active only) | No change from current behavior |
| Archived ticket match | 2 (active, then archived) | +1 sequential API call (~30ms-200ms depending on server) |
| No match / ambiguous | 2 (active, then archived) | +1 sequential API call |

The common case (active match) has zero performance regression. The archived fallback path adds one sequential API call, which is acceptable for the infrequent case of resolving archived tickets.

## Dependencies

### Runtime dependencies

None added. The fix uses only existing infrastructure:
- `hxFetch()` from `src/lib/http.ts` (already imported by `resolve-ticket.ts`)
- `matchTicket()` from `src/lib/resolve-ticket.ts` (same file)

### Dev dependencies

None added. Tests use:
- `node:test` (`describe`, `it`, `mock.fn`) — built into Node.js >=18
- `node:assert` — built into Node.js

### External API contract

- `GET /api/tickets` → `{ items: TicketItem[] }` (active tickets, already used)
- `GET /api/tickets?archived=true` → `{ items: TicketItem[] }` (archived tickets, already used by `list.ts` and `latest.ts`)

## Deferred to Round 2

No items deferred. The fix is fully scoped to `resolveTicket()` and its tests. All technical questions are resolved.

## Summary Table

| Decision | Choice | Key Reason |
|----------|--------|------------|
| Fetch strategy | Sequential/lazy | Active match (common case) uses 1 call; archived only fetched on miss |
| Testability | Dependency injection via optional param | No external libs; backward-compatible; mock.module unavailable |
| Ambiguity detection | Combined active+archived array | Ticket requires cross-set ambiguity detection |
| Active priority | Return immediately on active match | Ticket invariant; skip archived fetch for performance |
| Archived fetch error | Throw resolution-stage error | Ticket requires honest error reporting, not silent "not found" |
| Active/archived overlap | Treat as disjoint, no dedup | Toggle API pattern; correct even if assumption is wrong |
| Files changed | resolve-ticket.ts + resolve-ticket.test.ts only | Localized fix; no caller or downstream changes |

## APL Statement Reference

The fix is localized to `resolveTicket()` in `src/lib/resolve-ticket.ts` and its test file. The function should use sequential (lazy) fetching: try active tickets first, fall back to archived tickets only when no active match is found. Dependency injection via an optional third parameter makes the function testable with `node:test`'s `mock.fn()`. Numeric ambiguity detection must combine both active and archived item sets. Error handling must distinguish between "not found" and "resolution failure" when the archived fetch fails. `matchTicket()` and `hxFetch()` need no changes. No caller modifications are required.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement, acceptance criteria, invariants, failure behavior rules | Fix scoped to resolveTicket(); must search both active and archived; cross-set ambiguity required; no new flags; honest error reporting |
| diagnosis/diagnosis-statement.md | Root cause analysis and fix scope | Single root cause at resolve-ticket.ts:89; secondary defect in ambiguity detection (lines 102-121); fix localized to 2 files |
| diagnosis/apl.json | Structured Q&A with evidence for each finding | Confirmed matchTicket/hxFetch need no changes; 9 call sites verified; node:test is test runner; no mocking library available |
| product/product.md | Product vision, core workflow, essential features | Active-first priority; archived as fallback; error transparency; no caller changes; clear failure on resolution errors |
| scout/scout-summary.md | Consolidated analysis of resolver and file roles | Confirmed resolver behavior, established API pattern, boundary preservation for list/latest, test gap |
| scout/reference-map.json | File map with line-level evidence and unknowns | Confirmed defect location, all call sites, API pattern, hxFetch queryParams support, test infrastructure |
| repo-guidance.json | Repository intent classification | helix-cli is sole target repo |
| src/lib/resolve-ticket.ts | Direct source inspection (fix target) | Verified current flow: single active-only fetch at line 89; matchTicket pure function at lines 44-77; ambiguity check at lines 102-121 |
| src/lib/resolve-ticket.test.ts | Existing test coverage and patterns | Tests for matchTicket and extractTicketRef only; uses node:test describe/it pattern; no resolveTicket tests exist |
| src/lib/http.ts | API infrastructure verification | hxFetch supports queryParams at lines 40,46-49; retry/error handling built in; no changes needed |
| src/tickets/list.ts | Archived API pattern reference | Confirms queryParams.archived = "true" toggle pattern at lines 43-44; does not use resolveTicket |
| src/lib/config.ts | HxConfig type definition | Confirmed config shape including orgName used in error messages |
| package.json | Build/test/dependency audit | tsc build; node --test runner; zero runtime deps; Node >=18; devDeps: @types/node, typescript only |
| tsconfig.json | TypeScript compilation settings | Strict mode, ES2022, Node16 modules, compiles to dist/ |
| Runtime mock.fn check | Verified node:test mock API availability | mock.fn and mock.method available; mock.module undefined; mockImplementation and call tracking work |

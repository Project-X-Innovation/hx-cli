# Implementation Actual: Resolve archived ticket references in hlx CLI

## Summary of Changes

Fixed `resolveTicket()` in `src/lib/resolve-ticket.ts` to search both active and archived tickets when resolving a ticket reference. Previously, only active tickets were fetched, causing all 9 commands that use the shared resolver to fail with "ticket not found" for archived ticket references. The fix uses a sequential fetch strategy: try active first, fall back to archived on miss. Numeric ambiguity detection now considers both active and archived sets combined.

Added 9 new unit tests in `src/lib/resolve-ticket.test.ts` covering all acceptance criteria for the resolver behavior.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/lib/resolve-ticket.ts` | Core fix: added optional `fetchFn` DI parameter (line 89), archived ticket fetch fallback (lines 115-128), exact match early return for active (lines 108-111), archived exact match fallback (lines 130-136), combined numeric ambiguity check across both sets (lines 138-160). This is the **shared resolver used by 9 command call sites** (`tickets/index.ts` x7, `comments/index.ts` x2) — the signature change is backward-compatible (optional 3rd param). |
| `src/lib/resolve-ticket.test.ts` | Added `resolveTicket` test suite (lines 123-281) with 9 test cases using `node:test` mock.fn() DI. Added imports for `mock`, `resolveTicket`, and `HxConfig` type. |

## Steps Executed

### Step 1: Add optional `fetchFn` parameter (Plan Step 1)
- Added `options?: { fetchFn?: typeof hxFetch }` as optional third parameter to `resolveTicket()`.
- At function top: `const fetchFn = options?.fetchFn ?? hxFetch;`
- Replaced `hxFetch` call with `fetchFn` call.
- Verified: `npx tsc --noEmit` passed.

### Step 2: Add archived ticket fetch fallback and combined ambiguity detection (Plan Step 2)
- Implemented active-first priority: if `matchTicket(activeItems, ref)` matches by exact ID or exact short ID, return immediately without fetching archived.
- For numeric matches (where `activeMatch` exists but is not an exact ID/short ID match), continue to fetch archived for cross-set ambiguity.
- Added archived ticket fetch with `queryParams: { archived: "true" }` wrapped in try/catch that throws "Failed to fetch archived ticket list for resolution" on error.
- For non-active-match cases, try `matchTicket(archivedItems, ref)` for exact ID/short ID.
- Combined numeric ambiguity check across `[...activeItems, ...archivedItems]` — returns single match, throws ambiguity error for 2+ matches.
- Deviation from plan: The plan specified "if match found, return immediately" for all active matches. This was refined to only return immediately for exact ID/short ID matches, because numeric matches require cross-set ambiguity checking per AC #9.
- Verified: `npx tsc --noEmit` passed, `npm test` passed.

### Step 3: Add resolveTicket unit tests (Plan Step 3)
- Added `describe("resolveTicket", ...)` block with 9 test cases.
- Used `mock.fn()` from `node:test` with the `fetchFn` DI parameter to control API responses.
- Mock inspects `queryParams.archived` to distinguish active vs archived calls.
- Test cases: archived by ID, archived by short ID, archived by number, active priority (callCount=1), missing ticket, cross-set ambiguity, archived-only regression, archived fetch error, active fetch error.
- Verified: `npm test` — all 51 tests pass.

### Step 4: Verify quality gates (Plan Step 4)
- `npx tsc --noEmit` — zero errors.
- `npm run build` — zero errors.
- `npm test` — 51 tests, 51 pass, 0 fail.
- Confirmed only `src/lib/resolve-ticket.ts` and `src/lib/resolve-ticket.test.ts` modified.
- Confirmed `src/tickets/list.ts`, `src/tickets/latest.ts`, `src/tickets/index.ts`, `src/comments/index.ts` are unmodified.

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npx tsc --noEmit` | Exit 0, zero errors |
| `npm run build` | Exit 0, successful compilation |
| `npm test` | Exit 0, 51 tests pass, 0 fail |

## Test/Build Results

```
tests 51
suites 17
pass 51
fail 0
cancelled 0
skipped 0
```

All 9 new `resolveTicket` test cases passed:
- resolves archived ticket by internal ID
- resolves archived ticket by short ID
- resolves archived ticket by numeric ticket number
- active match takes priority over archived (no archived fetch)
- returns not-found error for missing ticket
- detects cross-set numeric ambiguity
- resolves archived-only ticket (regression test)
- archived fetch failure produces resolution-stage error
- active fetch failure propagates error

All 42 pre-existing tests passed unchanged.

## Deviations from Plan

| Deviation | Rationale |
|-----------|-----------|
| Active-first return refined for numeric refs | The plan specified returning immediately for any active match. This was refined to only return immediately for exact ID/short ID matches. Numeric matches require fetching archived to detect cross-set ambiguity per AC #9. Without this refinement, the "detects cross-set numeric ambiguity" test would fail because a single active numeric match (e.g., BLD-42 for ref "42") would be returned before checking if archived also has a match (e.g., ARC-42). The refinement distinguishes match type by comparing `activeMatch.id === ref` (exact ID) or `activeMatch.shortId.toLowerCase() === ref.toLowerCase()` (exact short ID) vs numeric suffix matching. |

## Known Limitations / Follow-ups

- No limitations identified. All acceptance criteria are covered by the implementation and tests.
- The `resolveTicket()` function now makes 2 API calls (active + archived) when the ref is not found in active by exact ID or short ID. This is the expected cost of archived ticket support and only adds latency for the fallback case.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npx tsc --noEmit` exited with code 0, zero error output |
| CHK-02 | pass | `npm run build` exited with code 0, successful compilation |
| CHK-03 | pass | `npm test` output shows all `matchTicket` (10 cases) and `extractTicketRef` (6 cases) tests passing |
| CHK-04 | pass | `npm test` output shows all 9 `resolveTicket` test cases passing: archived by ID, archived by short ID, archived by number, active priority, missing ticket, cross-set ambiguity, archived-only regression, archived fetch error, active fetch error |
| CHK-05 | pass | Direct file inspection confirmed only `src/lib/resolve-ticket.ts` and `src/lib/resolve-ticket.test.ts` were modified. `src/tickets/list.ts`, `src/tickets/latest.ts`, `src/tickets/index.ts`, `src/comments/index.ts` confirmed unmodified. (git diff blocked in runtime; verified by reading boundary files.) |
| CHK-06 | pass | `resolveTicket()` signature at line 86-89 shows optional third parameter: `options?: { fetchFn?: typeof hxFetch }`. Caller files `src/tickets/index.ts` and `src/comments/index.ts` confirmed unmodified (still pass only 2 args). |
| CHK-07 | pass | Test "archived fetch failure produces resolution-stage error" passes. Test source confirms it asserts error contains "Failed to fetch archived ticket list for resolution" and does NOT contain "not found". |

## APL Statement Reference

Implementation complete. resolveTicket() in src/lib/resolve-ticket.ts now searches both active and archived tickets. Active exact ID/short ID matches return immediately without an archived fetch. Numeric refs always check both sets for cross-set ambiguity. 9 new tests cover all acceptance criteria. All 51 tests pass, typecheck and build succeed, and only the 2 expected files were modified.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement, acceptance criteria, invariants | Fix scoped to resolveTicket() in resolve-ticket.ts; must search both active and archived; cross-set numeric ambiguity required; no new flags; honest error reporting |
| implementation-plan/implementation-plan.md | Step-by-step implementation guide and verification plan | 4 steps: DI param, archived fallback, tests, quality gates. 7 verification checks. Sequential lazy fetch. |
| diagnosis/diagnosis-statement.md | Root cause and secondary defect analysis | Single root cause: active-only fetch at line 89. Secondary: ambiguity check also active-only. Fix localized to 2 files. |
| implementation-plan/apl.json | Structured Q&A confirming approach | 4 sequential steps, DI via optional param, 7 verification checks |
| repo-guidance.json | Repository intent classification | helix-cli is the sole target repo |
| src/lib/resolve-ticket.ts | Direct source of fix target | Current resolveTicket() at lines 83-127; matchTicket at lines 44-77; single active-only fetch at line 89 |
| src/lib/resolve-ticket.test.ts | Existing test patterns and import style | Tests use node:test describe/it; cover matchTicket and extractTicketRef only; no resolveTicket tests |
| src/lib/http.ts | hxFetch type signature for DI parameter typing | queryParams support confirmed; function signature for typeof hxFetch |
| src/lib/config.ts | HxConfig type definition for test fixtures | Confirmed HxConfig shape: apiKey, url, orgName |
| package.json | Build/test commands | tsc, tsc --noEmit, tsc && node --test dist/**/*.test.js |

# Implementation Plan: Resolve archived ticket references in hlx CLI

## Overview

Fix the `resolveTicket()` function in `src/lib/resolve-ticket.ts` so it searches both active and archived tickets when resolving a ticket reference. Currently it only fetches active tickets, causing all 9 commands that route through this shared resolver to fail with "ticket not found" for archived ticket references. The fix uses sequential (lazy) fetching: try active first, fall back to archived only on miss. An optional dependency-injection parameter enables testability with `node:test`'s `mock.fn()`. Numeric ambiguity detection is updated to combine both active and archived sets.

## Implementation Principles

- **Smallest correct change**: Modify only `resolveTicket()` and its test file. No caller or downstream changes.
- **Active-first priority**: If the ref matches an active ticket, return immediately without fetching archived tickets.
- **Honest error reporting**: Distinguish between "not found" (ticket absent from both sets) and "resolution failure" (archived fetch error).
- **Backward compatibility**: The new optional third parameter does not affect any of the 9 existing call sites.
- **No new flags**: Commands do not gain `--archived`; resolution is transparent to archive state.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add optional `fetchFn` parameter to `resolveTicket()` for testability | Modified `resolveTicket()` signature in `src/lib/resolve-ticket.ts` |
| 2 | Add archived ticket fetch fallback to `resolveTicket()` | Modified control flow: active-first, archived fallback, combined ambiguity check |
| 3 | Add `resolveTicket()` unit tests | New test suite in `src/lib/resolve-ticket.test.ts` covering archived resolution, cross-set ambiguity, error handling, active priority |
| 4 | Verify quality gates and regression | Passing typecheck, build, and test commands |

## Detailed Implementation Steps

### Step 1: Add optional `fetchFn` parameter to `resolveTicket()`

**Goal**: Make `resolveTicket()` testable via dependency injection without changing any callers.

**What to Build**:
- In `src/lib/resolve-ticket.ts`, change the `resolveTicket()` signature from `(config: HxConfig, ref: string)` to `(config: HxConfig, ref: string, options?: { fetchFn?: typeof hxFetch })`.
- At the top of the function body, destructure the option: `const fetchFn = options?.fetchFn ?? hxFetch;`
- Replace the existing `hxFetch(config, "/tickets", { basePath: "/api" })` call at line 89 with `fetchFn(config, "/tickets", { basePath: "/api" })`.
- No changes to `matchTicket()`, `extractTicketRef()`, or any other functions in this file.
- No changes to any caller files (`src/tickets/index.ts`, `src/comments/index.ts`).

**Verification (AI Agent Runs)**:
1. Run `npx tsc --noEmit` — must compile with no errors.
2. Run `npm test` — all existing `matchTicket` and `extractTicketRef` tests must pass unchanged.

**Success Criteria**:
- `resolveTicket()` accepts an optional third parameter.
- All existing callers continue to work (they pass only 2 args).
- Typecheck passes.
- Existing tests pass.

---

### Step 2: Add archived ticket fetch fallback and combined ambiguity detection

**Goal**: Implement the core fix — archived ticket fallback with active-first priority and cross-set numeric ambiguity detection.

**What to Build**:

Modify the body of `resolveTicket()` in `src/lib/resolve-ticket.ts` to implement this control flow:

1. **Fetch active tickets** (same as today): `fetchFn(config, "/tickets", { basePath: "/api" })` → `activeItems`. Keep existing try/catch with the "Failed to fetch ticket list for resolution" error message.
2. **Match against active items**: `matchTicket(activeItems, ref)` — if match found, return immediately. This preserves active-first priority and avoids the archived fetch entirely for the common case.
3. **Fetch archived tickets** (new): `fetchFn(config, "/tickets", { basePath: "/api", queryParams: { archived: "true" } })` → `archivedItems`. Wrap in try/catch: on failure, throw `"Failed to fetch archived ticket list for resolution: <original error>"` — do NOT fall through to "not found".
4. **Match against archived items**: `matchTicket(archivedItems, ref)` — if match found, return it.
5. **Combined ambiguity check**: If no match in either set and ref is numeric, scan `[...activeItems, ...archivedItems]` for numeric matches. If >1 match, throw the existing ambiguity error with all matching items listed.
6. **Not found**: Throw the existing "Ticket not found" error (unchanged message format).

Key constraints:
- `matchTicket()` is not modified — it is called with different item arrays.
- The ambiguity error message format remains the same (with `config.orgName`).
- The "not found" error message format remains the same.
- The active-fetch error handling at lines 91-96 remains the same.

**Verification (AI Agent Runs)**:
1. Run `npx tsc --noEmit` — must compile with no errors.
2. Run `npm test` — existing tests must pass.

**Success Criteria**:
- `resolveTicket()` fetches archived tickets when no active match is found.
- Active match returns immediately without archived fetch.
- Archived fetch error produces a resolution-stage error, not "not found".
- Numeric ambiguity detection uses the combined active + archived array.
- TypeScript compiles cleanly.

---

### Step 3: Add `resolveTicket()` unit tests

**Goal**: Add comprehensive tests for the new archived resolution behavior, covering all acceptance criteria that pertain to the resolver.

**What to Build**:

Add a new `describe("resolveTicket", ...)` block in `src/lib/resolve-ticket.test.ts`. Import `resolveTicket` alongside the existing imports. Use `node:test`'s `mock.fn()` to create a mock fetch function that is passed via the `options.fetchFn` parameter.

The mock fetch function should inspect the `queryParams` argument to determine whether the call is for active tickets (no `queryParams.archived`) or archived tickets (`queryParams.archived === "true"`) and return appropriate test data.

**Test cases to add** (maps to acceptance criteria):

1. **Archived ticket resolved by internal ID** (AC #1):
   - Active items: empty or no match. Archived items: contains the target ticket.
   - Assert: returns `{ id, shortId }` of the archived ticket.

2. **Archived ticket resolved by short ID** (AC #2):
   - Active items: no match. Archived items: contains the target by short ID.
   - Assert: returns the archived ticket.

3. **Archived ticket resolved by numeric ticket number** (AC #3):
   - Active items: no match. Archived items: contains an unambiguous numeric match.
   - Assert: returns the archived ticket.

4. **Active match takes priority over archived** (AC #7 — active behavior unchanged):
   - Active items: contains a match. Archived items: also contains a match for the same ref.
   - Assert: returns the active ticket. Assert mock was called only once (no archived fetch).

5. **Missing ticket returns not-found error** (AC #6):
   - Active items: no match. Archived items: no match.
   - Assert: throws an error containing "not found".

6. **Cross-set numeric ambiguity detection** (AC #9):
   - Active items: contains ticket with shortId suffix "42". Archived items: contains ticket with shortId suffix "42" in a different project prefix.
   - Assert: throws an error containing "Ambiguous".

7. **Archived-only ticket is resolvable** (AC #8 — regression test):
   - Active items: empty. Archived items: contains exactly one ticket.
   - Assert: returns the archived ticket.

8. **Archived fetch failure produces resolution-stage error**:
   - Active items: no match. Archived fetch: throws an error.
   - Assert: thrown error message contains "Failed to fetch archived ticket list for resolution".

9. **Active fetch failure propagates error**:
   - Active fetch: throws an error.
   - Assert: thrown error message contains "Failed to fetch ticket list for resolution" (unchanged from current behavior).

**Verification (AI Agent Runs)**:
1. Run `npm test` — all tests (existing + new) must pass.
2. Verify test output shows all new test cases reported as passing.

**Success Criteria**:
- All 9 new test cases pass.
- All existing `matchTicket` and `extractTicketRef` tests still pass.
- Test output confirms the new `resolveTicket` test suite with all cases.

---

### Step 4: Verify quality gates and regression

**Goal**: Confirm all quality gates pass and no regressions exist.

**What to Build**: Nothing — this is a verification-only step.

**Verification (AI Agent Runs)**:
1. Run `npx tsc --noEmit` — must produce zero errors.
2. Run `npm run build` — must produce zero errors.
3. Run `npm test` — all tests must pass (existing + new).
4. Confirm only `src/lib/resolve-ticket.ts` and `src/lib/resolve-ticket.test.ts` have been modified. No other files changed.
5. Confirm `src/tickets/list.ts` and `src/tickets/latest.ts` are unmodified.

**Success Criteria**:
- Zero typecheck errors.
- Zero build errors.
- All tests pass.
- Only the 2 expected files are modified.
- Boundary files (`list.ts`, `latest.ts`) are untouched.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >=18 installed | available | `package.json` engines field; dev environment has Node 24.14.1 | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| TypeScript compiler (`tsc`) available via `npx` | available | `package.json` devDependencies: `typescript ^6.0.2` | CHK-01, CHK-02 |
| `node:test` built-in test runner | available | Node >=18 includes `node:test`; confirmed by existing tests | CHK-03, CHK-04 |
| `npm install` completed | available | Required before any build/test command | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |

### Required Checks

[CHK-01] TypeScript typecheck passes with no errors.
- Action: Run `npx tsc --noEmit` from the `helix-cli` repository root.
- Expected Outcome: Command exits with code 0 and produces no error output.
- Required Evidence: Command output showing zero errors and exit code 0.

[CHK-02] Full build succeeds.
- Action: Run `npm run build` from the `helix-cli` repository root.
- Expected Outcome: Command exits with code 0 and compiles all `.ts` files to `dist/` with no errors.
- Required Evidence: Command output showing successful compilation and exit code 0.

[CHK-03] All existing tests pass (regression).
- Action: Run `npm test` from the `helix-cli` repository root.
- Expected Outcome: All pre-existing `matchTicket` and `extractTicketRef` tests pass. The test runner reports zero failures for these suites.
- Required Evidence: Test runner output showing all `matchTicket` and `extractTicketRef` test cases passing with their names visible.

[CHK-04] New `resolveTicket` tests pass and cover required scenarios.
- Action: Run `npm test` from the `helix-cli` repository root and inspect the output for the `resolveTicket` test suite.
- Expected Outcome: The `resolveTicket` test suite passes with at minimum these test cases reported:
  - Archived ticket resolved by internal ID
  - Archived ticket resolved by short ID
  - Archived ticket resolved by numeric ticket number
  - Active match takes priority (no archived fetch occurs)
  - Missing ticket returns not-found error
  - Cross-set numeric ambiguity detected
  - Archived-only ticket is resolvable (regression test)
  - Archived fetch failure produces resolution-stage error
  - Active fetch failure propagates error
- Required Evidence: Test runner output showing all `resolveTicket` test cases passing with names matching the above scenarios. Zero test failures in the full run.

[CHK-05] Only expected files modified; boundary files untouched.
- Action: Run `git diff --name-only` from the `helix-cli` repository root to list all modified files.
- Expected Outcome: Only `src/lib/resolve-ticket.ts` and `src/lib/resolve-ticket.test.ts` appear in the diff. Files `src/tickets/list.ts`, `src/tickets/latest.ts`, `src/tickets/index.ts`, and `src/comments/index.ts` do not appear.
- Required Evidence: `git diff --name-only` output showing exactly the 2 expected files and no others.

[CHK-06] resolveTicket() signature is backward-compatible.
- Action: Inspect `src/lib/resolve-ticket.ts` to verify the third parameter is optional (has `?` or a default value). Inspect `src/tickets/index.ts` and `src/comments/index.ts` to verify no callers were modified.
- Expected Outcome: The `resolveTicket()` function signature has an optional third parameter. No caller file was changed.
- Required Evidence: Source content of `resolveTicket()` signature showing the optional parameter. `git diff --name-only` confirming `src/tickets/index.ts` and `src/comments/index.ts` are not listed.

[CHK-07] Archived fetch error handling does not produce "not found".
- Action: In the `resolveTicket` test suite, verify the test case for archived fetch failure: the mock throws an error when called with `queryParams.archived = "true"`, and the test asserts the thrown error contains "Failed to fetch archived ticket list for resolution" (not "not found").
- Expected Outcome: The test passes, confirming that an archived fetch failure surfaces a resolution-stage error message.
- Required Evidence: Test runner output showing the archived-fetch-failure test case passing. Source inspection of the test confirming it asserts on the resolution-stage error text.

## Success Metrics

1. Zero typecheck errors (`tsc --noEmit` exits 0).
2. Zero build errors (`npm run build` exits 0).
3. All tests pass (`npm test` exits 0) — existing + new.
4. New `resolveTicket` test suite covers: archived resolution by all 3 ref forms, active priority, missing ticket, cross-set ambiguity, archived-only resolution, archived fetch error, active fetch error.
5. Only 2 files modified: `src/lib/resolve-ticket.ts` and `src/lib/resolve-ticket.test.ts`.
6. Boundary files (`list.ts`, `latest.ts`) are untouched.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement, acceptance criteria, invariants | Fix scoped to `resolveTicket()` in resolve-ticket.ts; must search both active and archived; cross-set ambiguity required; no new flags; honest error reporting. |
| scout/scout-summary.md | File roles, API patterns, test gap | Confirmed matchTicket is pure; list.ts/latest.ts use separate code paths; existing tests cover only matchTicket/extractTicketRef. |
| scout/reference-map.json | Line-level evidence for the defect and all call sites | Confirmed defect at resolve-ticket.ts:89; 9 call sites identified; hxFetch queryParams support at http.ts:40,46-49. |
| diagnosis/diagnosis-statement.md | Root cause and secondary defect analysis | Single root cause: active-only fetch at line 89. Secondary: ambiguity check at lines 102-121 also active-only. Fix localized to 2 files. |
| diagnosis/apl.json | Structured Q&A with evidence | Confirmed no caller changes needed; node:test is the test runner; zero mocking libraries; mock.fn available. |
| product/product.md | Product vision, core workflow, essential features | Active-first priority; archived as fallback; error transparency; no caller changes; clear failure on resolution errors. |
| tech-research/tech-research.md | Architecture decision, DI approach, control flow design | Sequential/lazy fetch chosen; DI via optional param; mock.module unavailable; combined array for ambiguity; disjoint sets assumption. |
| tech-research/apl.json | Technical Q&A answers with evidence | Confirmed sequential fetch, DI pattern, cross-set ambiguity approach, archived fetch error handling strategy. |
| repo-guidance.json | Repository intent classification | helix-cli is the sole target repo. |
| src/lib/resolve-ticket.ts | Direct source of fix target | Current resolveTicket() at lines 83-127; matchTicket at lines 44-77; single active-only fetch at line 89; ambiguity check at lines 102-121. |
| src/lib/resolve-ticket.test.ts | Existing test patterns and coverage | Tests use node:test describe/it; cover matchTicket and extractTicketRef only; no resolveTicket tests. |
| src/lib/http.ts | hxFetch utility confirmation | queryParams support at lines 40,46-49; retry logic built in; function signature for DI typing. |
| package.json | Build/test commands and dependencies | `tsc`, `tsc --noEmit`, `tsc && node --test dist/**/*.test.js`; zero runtime deps; Node >=18. |

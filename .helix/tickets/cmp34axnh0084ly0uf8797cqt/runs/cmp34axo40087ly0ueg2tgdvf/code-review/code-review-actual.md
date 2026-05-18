# Code Review: Resolve archived ticket references in hlx CLI

## Review Scope

Reviewed the implementation of archived ticket resolution in `resolveTicket()` against all 10 acceptance criteria, 5 non-negotiable invariants, 4 failure behavior requirements, and 3 batch/cardinality rules from ticket.md. Verified both changed files, all 9 caller sites, and 4 boundary files.

## Files Reviewed

| File | Status | Review Notes |
|------|--------|--------------|
| `src/lib/resolve-ticket.ts` | Changed | Core fix: archived fallback, cross-set ambiguity, DI parameter. 168 lines. All logic paths traced. |
| `src/lib/resolve-ticket.test.ts` | Changed | 9 new test cases added in `resolveTicket` describe block. All test assertions verified. |
| `src/tickets/index.ts` | Unchanged | 7 `resolveTicket(config, rawRef)` call sites confirmed unmodified. Backward-compatible. |
| `src/comments/index.ts` | Unchanged | 2 `resolveTicket(config, rawRef)` call sites confirmed unmodified. Backward-compatible. |
| `src/tickets/list.ts` | Unchanged | Boundary file. Uses own `hxFetch` call with `--archived` flag. Not affected by fix. |
| `src/tickets/latest.ts` | Unchanged | Boundary file. Uses own `hxFetch` call with `--archived` flag. Not affected by fix. |
| `src/lib/http.ts` | Unchanged | `hxFetch` already supports `queryParams`. No modification needed. |
| `src/lib/config.ts` | Unchanged | `HxConfig` type unchanged. `orgName` used in error messages confirmed optional. |

## Missed Requirements & Issues Found

### Requirements Gaps

None. All 10 acceptance criteria are satisfied:

| AC# | Requirement | Evidence |
|-----|-------------|----------|
| 1 | Archived by internal ID | Test: "resolves archived ticket by internal ID" passes. Code path: lines 131-135. |
| 2 | Archived by short ID | Test: "resolves archived ticket by short ID" passes. Code path: lines 131-135. |
| 3 | Archived by numeric number | Test: "resolves archived ticket by numeric ticket number" passes. Code path: lines 138-160. |
| 4 | Comments resolve archived | `comments/index.ts` uses shared `resolveTicket()` unchanged. |
| 5 | Artifacts resolve archived | `tickets/index.ts` uses shared `resolveTicket()` unchanged. |
| 6 | Missing ref → not found | Test: "returns not-found error for missing ticket" passes. Code: lines 162-166. |
| 7 | Existing tests pass | 42 pre-existing tests pass unchanged. |
| 8 | Archived-only regression test | Test: "resolves archived-only ticket (regression test)" passes. |
| 9 | Cross-set numeric ambiguity | Test: "detects cross-set numeric ambiguity" passes. Code: lines 138-160. |
| 10 | tickets list unchanged | `list.ts` unmodified; does not use `resolveTicket()`. |

### Correctness/Behavior Issues

None. Logic paths verified by tracing through 8 scenarios:

1. Active exact ID/shortID match → returns immediately, no archived fetch (line 109-111)
2. Active numeric match → falls through to archived fetch for cross-set check (line 112-113)
3. No active match, archived exact ID/shortID match → returns archived (lines 131-136)
4. No active match, archived numeric match → falls through to combined numeric check (lines 138-160)
5. Cross-set numeric ambiguity (active + archived both match) → ambiguity error (lines 154-159)
6. Single numeric match across combined set → returns it (line 153)
7. No match in either set → "not found" error (lines 162-166)
8. Archived fetch error → resolution-stage error, not "not found" (lines 123-128)

### Regression Risks

None identified. The optional third parameter (`options?: { fetchFn?: typeof hxFetch }`) is backward-compatible. All 9 callers pass exactly 2 arguments and remain unmodified. The `matchTicket()` function is unchanged.

### Code Quality/Robustness

No issues. The implementation:
- Uses sequential (lazy) fetching — 1 API call for the common case (active match)
- Properly wraps both active and archived fetch errors in distinct, identifiable error messages
- Uses the established `queryParams: { archived: "true" }` pattern from `list.ts`/`latest.ts`
- Follows existing code style and TypeScript strictness

### Verification/Test Gaps

None. The 9 test cases cover:
- All 3 reference forms for archived tickets (ID, shortID, numeric)
- Active-first priority with call count assertion (only 1 fetch)
- Missing ticket error
- Cross-set numeric ambiguity
- Archived-only ticket (regression)
- Archived fetch failure → resolution-stage error (not "not found")
- Active fetch failure → propagated error (not "archived" variant)

## Changes Made by Code Review

None. No issues were found that required code fixes.

## Remaining Risks / Deferred Items

- **Performance**: When an active numeric match exists but no archived match does, the archived fetch still occurs to check for cross-set ambiguity. This is the correct trade-off per AC #9 and adds latency only for numeric refs with no exact match.
- **Disjoint set assumption**: The implementation treats active and archived API responses as disjoint sets (no deduplication). This is correct per the API's toggle behavior (`archived=true` returns only archived tickets). If the API ever returned overlapping sets, active-first priority (step 2) would still produce correct results.

## Verification Impact Notes

No changes were made by code review. All verification checks from the implementation plan remain valid:

| Check ID | Status | Notes |
|----------|--------|-------|
| CHK-01 | Valid | TypeScript typecheck confirmed passing |
| CHK-02 | Valid | Build confirmed passing |
| CHK-03 | Valid | All existing tests confirmed passing |
| CHK-04 | Valid | All 9 resolveTicket tests confirmed passing |
| CHK-05 | Valid | Only 2 files modified confirmed by file inspection |
| CHK-06 | Valid | Optional 3rd parameter confirmed; callers unmodified |
| CHK-07 | Valid | Archived fetch error test confirmed passing |

## APL Statement Reference

Code review complete. The implementation in `src/lib/resolve-ticket.ts` correctly implements archived ticket resolution with active-first priority, cross-set numeric ambiguity detection, and honest error reporting. All 10 acceptance criteria are satisfied. 9 new tests cover the full resolver behavior. Quality gates pass (typecheck, build, 51/51 tests). No code changes were needed. The implementation is ready for verification.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary requirements: 10 ACs, invariants, failure behavior, batch rules | All 10 ACs satisfied; invariants preserved; failure behavior correct |
| implementation/implementation-actual.md | Scope map: files changed, steps executed, deviations | 2 files changed as expected; deviation (numeric active match → fetch archived) is correct |
| implementation/apl.json | Implementation Q&A and statement | Confirmed completion claims against actual code |
| implementation-plan/implementation-plan.md | Expected implementation steps and verification plan | 4 steps completed; 7 verification checks all valid |
| implementation-plan/apl.json | Structured plan Q&A | Confirmed 4-step sequence and 7 verification checks |
| product/product.md | Product vision, core workflow, essential features | Active-first priority, archived fallback, error transparency all implemented |
| diagnosis/diagnosis-statement.md | Root cause and secondary defect analysis | Single root cause at line 89 (active-only fetch) fixed; ambiguity detection updated |
| tech-research/tech-research.md | Architecture decisions, DI approach, performance | Sequential/lazy fetch implemented; DI via optional param; cross-set ambiguity approach |
| repo-guidance.json | Repository intent classification | helix-cli confirmed as sole target repo |
| src/lib/resolve-ticket.ts | Direct code review of fix | All logic paths traced and verified correct |
| src/lib/resolve-ticket.test.ts | Direct test review | 9 tests verified against acceptance criteria |
| src/tickets/index.ts | Caller verification | 7 call sites confirmed unmodified and backward-compatible |
| src/comments/index.ts | Caller verification | 2 call sites confirmed unmodified and backward-compatible |
| src/tickets/list.ts | Boundary verification | Unmodified; uses own API call with --archived flag |
| src/tickets/latest.ts | Boundary verification | Unmodified; uses own API call with --archived flag |
| src/lib/http.ts | hxFetch API verification | queryParams support confirmed; no changes needed |
| src/lib/config.ts | HxConfig type verification | orgName optional field confirmed for error messages |

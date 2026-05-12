# Code Review Actual -- BLD-430

## Review Scope

Reviewed all files changed in the implementation of BLD-430: fixing `hlx tickets bundle` to pass `runId` to the artifact summary endpoint and adding a `--run` flag for explicit run override. Cross-referenced against ticket requirements, product spec, diagnosis, tech research, and implementation plan. Verified pattern consistency against sibling commands (`artifacts.ts`, `artifact.ts`) and the shared utilities (`flags.ts`, `http.ts`).

## Files Reviewed

| File | What Was Reviewed |
|------|-------------------|
| `src/tickets/bundle.ts` | Full file (91 lines). Verified: `getFlag` import, `--run` flag parsing at line 31, runId precedence chain at line 37, `queryParams: { runId }` at lines 44-47, type safety of `runId` after `process.exit` guard, no unintended side effects on existing `--out` flag parsing |
| `src/tickets/index.ts` | Full file (149 lines). Verified: usage string at line 27, help text at line 136, consistency with sibling commands' usage/help patterns |
| `src/tickets/artifacts.ts` (reference) | Full file. Compared queryParams pattern (conditional spread) against bundle's unconditional approach; confirmed unconditional is correct because bundle guards runId at lines 38-41 |
| `src/tickets/artifact.ts` (reference) | Full file. Compared `--run` flag and runId resolution pattern; confirmed bundle follows same precedence (explicit > currentRun > runs[0]) |
| `src/lib/flags.ts` (reference) | Full file. Verified `getFlag` returns `string | undefined`, `requireFlag` calls `process.exit(1)` on missing |
| `src/lib/http.ts` (reference) | Full file. Verified `queryParams` type is `Record<string, string>`, values are appended via `url.searchParams.set`. Confirmed no risk with the always-pass approach |

## Missed Requirements & Issues Found

### Requirements gaps
None. All ticket requirements are addressed:
1. Core fix: `runId` is passed to the artifact summary endpoint via `queryParams: { runId }` (lines 44-47).
2. `--run` flag added for explicit override (line 31), with precedence over auto-resolution (line 37).
3. Usage string (index.ts:27) and help text (index.ts:136) updated.
4. No regression for active-status tickets (runId is always valid after guard; server handles it for all statuses).

### Correctness/behavior issues
None found.

- **Type safety verified**: `runId` is `string | undefined` after the nullish coalescing chain. The `process.exit(1)` guard at lines 38-41 returns `never`, narrowing `runId` to `string` for the `queryParams: { runId }` usage. This satisfies the `Record<string, string>` type of `hxFetch`'s `queryParams`.
- **Unconditional queryParams vs conditional spread**: The implementation passes `queryParams: { runId }` unconditionally, while the sibling `artifacts.ts` uses `...(runId ? { queryParams: { runId } } : {})`. This divergence is intentional and correct -- `bundle.ts` validates `runId` before the call (line 38), so the conditional is unnecessary. The tech research explicitly documents this design decision.
- **Flag parsing non-interference**: `getFlag` reads from `args` without mutation. The `--run` flag (line 31) and `--out` flag (line 30) parse independently without conflicts.
- **Existing step-artifact fetch**: The individual step-artifact fetch at line 59 already uses `runId` in the URL path. No change needed there.

### Regression risks
None identified.

- Passing `runId` to the artifact summary endpoint does not break active-status tickets. The server already accepts `runId` for all statuses (verified by the working `artifacts` command pattern).
- The import change adds `getFlag` alongside the existing `requireFlag` import -- no breakage.
- No shared utility code was modified.

### Code quality/robustness
No issues.

- The implementation follows the established patterns in the codebase.
- The change is minimal: 3 changes in `bundle.ts` (import, flag parse, queryParams) and 2 in `index.ts` (usage, help text).
- No unnecessary abstractions or over-engineering.

### Verification/test gaps
No new test files were added, but this is consistent with the codebase (no command-level tests exist) and was explicitly scoped out in the product spec and tech research. Existing tests (30/30) pass.

## Changes Made by Code Review

None. The implementation is correct and complete. No code fixes were needed.

## Remaining Risks / Deferred Items

| Item | Risk Level | Notes |
|------|-----------|-------|
| No command-level tests for bundle | Low | Consistent with codebase -- no command tests exist. Future consideration per product spec. |
| CHK-04 partial verification | Low | Implementation confirmed structural correctness against staging API, but could not verify with a PREVIEW_READY ticket having populated step artifacts (test data not available in staging org). The fix is structurally sound based on code analysis and pattern consistency with working sibling commands. |
| `ticket.runs` ordering convention | Low | Whether `runs[0]` is latest or earliest is undocumented. The `--run` flag provides an explicit override safety net. |

## Verification Impact Notes

No changes were made by code review, so all verification checks remain valid as-is:

| Check ID | Status | Notes |
|----------|--------|-------|
| CHK-01 | Still valid | Build passes (independently verified by code review) |
| CHK-02 | Still valid | Typecheck passes (independently verified by code review) |
| CHK-03 | Still valid | All 30 tests pass (independently verified by code review) |
| CHK-04 | Still valid (partial) | Same limitation as implementation -- staging test data availability |

## APL Statement Reference

Code review complete. All changed files reviewed against ticket requirements, product spec, and sibling command patterns. Implementation is correct: `runId` is passed to the artifact summary endpoint via `queryParams`, `--run` flag is added with proper precedence, and usage/help documentation is updated. No issues found, no code changes needed. All quality gates pass independently (build, typecheck, 30/30 tests).

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements -- what the fix must achieve | PREVIEW_READY returns empty summary without runId; bundle needs `--run` parity with sibling commands |
| `product/product.md` | MVP requirements and success criteria | Three essential features: always pass runId, add --run flag, no active-ticket regression |
| `diagnosis/diagnosis-statement.md` | Root cause confirmation | Missing `queryParams` at bundle.ts:43 is the sole root cause; server API works correctly with runId |
| `tech-research/tech-research.md` | Architecture decisions and rationale | Option A chosen (unconditional pass); conditional spread rejected as unnecessary given guard |
| `implementation-plan/implementation-plan.md` | Step-by-step plan and verification checks | Four-step plan: import+flag, queryParams, usage/help, quality gates |
| `implementation/implementation-actual.md` | Scope map of changed files and self-reported outcomes | Two files changed; used as starting review map, not as proof |
| `implementation/apl.json` | Structured implementation answers | Cross-referenced claims against code |
| `src/tickets/bundle.ts` (direct read) | Primary changed file -- code correctness review | All changes verified: import, flag parsing, precedence, queryParams |
| `src/tickets/index.ts` (direct read) | Secondary changed file -- documentation review | Usage string and help text both correctly updated |
| `src/tickets/artifacts.ts` (direct read) | Sibling command pattern comparison | Conditional spread pattern context; verified bundle's unconditional approach is intentional |
| `src/tickets/artifact.ts` (direct read) | Sibling command pattern comparison | `--run` flag and runId resolution pattern verified consistent |
| `src/lib/flags.ts` (direct read) | Shared utility -- `getFlag` behavior verification | Returns `string \| undefined`; reads without mutating args |
| `src/lib/http.ts` (direct read) | Shared utility -- `queryParams` handling verification | `Record<string, string>` type; appended via `searchParams.set` |
| `repo-guidance.json` | Repo intent verification | helix-cli is sole target repo; confirmed |

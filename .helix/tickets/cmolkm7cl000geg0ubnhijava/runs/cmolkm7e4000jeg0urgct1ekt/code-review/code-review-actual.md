# Code Review: Improve Helix CLI Ticket Lookup, Help, JSON Output, and Inspection Ergonomics

## Review Scope

Reviewed all 14 changed files from the implementation against the ticket requirements (11 acceptance criteria), product spec (features F1-F8, success criteria SC1-SC11), diagnosis root causes (RC-1 through RC-5), and implementation plan (12 steps). No ticket attachments to review.

## Files Reviewed

| File | Review Focus |
|------|-------------|
| `src/lib/resolve-ticket.ts` | Core resolver logic: match priority, ambiguity handling, error messages with org context |
| `src/lib/resolve-ticket.test.ts` | Test coverage: internal ID, short ID, numeric, ambiguity, empty, priority, env vars |
| `src/lib/flags.ts` | `isHelpRequested` utility, shared flag helpers |
| `src/lib/flags.test.ts` | Test coverage for help detection, hasFlag, getFlag, getPositionalArgs |
| `src/index.ts` | Global `--help`/`-h`, `configOrHelp()` for auth-free help, usage output stream |
| `src/tickets/index.ts` | Router refactoring: shared resolver adoption, per-command help, usage text |
| `src/tickets/get.ts` | `formatDate()`, `--json` output, `printTicketDetail` return type, timestamp fix |
| `src/tickets/list.ts` | `--json` output, internal ID in text output |
| `src/tickets/latest.ts` | Help check before command logic |
| `src/tickets/create.ts` | Help check before validation |
| `src/tickets/continue.ts` | `rawRef` parameter for positional arg filtering, help check |
| `src/comments/index.ts` | Duplicate `resolveTicketId` removal, shared resolver adoption, help handling |
| `src/inspect/index.ts` | `--query` flag for `db`, help checks for all subcommands, PowerShell examples |
| `package.json` | `test` script addition |

Additionally reviewed for context: `src/lib/config.ts` (HxConfig type, loadConfig, requireConfig), `src/lib/http.ts` (hxFetch), `src/lib/resolve-repo.ts` (pattern template), `src/tickets/rerun.ts`, `src/tickets/artifacts.ts`, `src/tickets/artifact.ts`, `src/tickets/bundle.ts`, `tsconfig.json`.

## Missed Requirements & Issues Found

### Correctness/Behavior Issues

1. **Global `usage()` output goes to stderr even for `--help`** (severity: low-medium)
   - **File:** `src/index.ts:33`
   - **Evidence:** `usage()` unconditionally uses `console.error()`, so `hlx --help` sends output to stderr. In contrast, `ticketsUsage()` (tickets/index.ts:15), `commentsUsage()` (comments/index.ts:8), and `inspectUsage()` (inspect/index.ts:9) all use `const output = exitCode === 0 ? console.log : console.error` to correctly send help output to stdout.
   - **Impact:** `hlx --help` output goes to stderr (not capturable via stdout redirection), inconsistent with `hlx tickets --help` which outputs to stdout. The implementation actual explicitly noted this as a known limitation.
   - **Fix applied:** Yes. Changed `usage()` to use the same conditional pattern as the router-level usage functions.

### Requirements Gaps

None. All 11 acceptance criteria are addressed by the implementation.

### Regression Risks

None identified. The shared resolver replaces a raw-passthrough function that was already broken. All existing commands maintain their function signatures or have compatible extensions (optional parameters).

### Code Quality/Robustness

1. **`list.ts` uses unsafe Date construction** (severity: low, not fixed)
   - **File:** `src/tickets/list.ts:97`
   - **Evidence:** `new Date(ticket.updatedAt).toLocaleString()` uses the same unsafe Date pattern that RC-3 identified in `get.ts`. The `formatDate()` function (exported from `get.ts`) could be used here for consistency.
   - **Reason not fixed:** The ticket scope (AC-8, RC-3) specifically targets run timestamps in `tickets get`. The `updatedAt` field on tickets is always set by the backend and is typed as `string` (not nullable). The risk of `Invalid Date` is much lower for this field. Fixing it is trivial but outside explicit ticket scope.

2. **`extractTicketRef` does not filter flag values from positional args** (severity: low, not fixed)
   - **File:** `src/lib/resolve-ticket.ts:25`
   - **Evidence:** `args.find((a) => !a.startsWith("-"))` finds the first non-dash arg, which could be a flag value (e.g., `["--step", "implementation", "339"]` would extract `"implementation"` instead of `"339"`).
   - **Reason not fixed:** The documented usage convention puts `<ticket-ref>` as the first positional arg (before named flags). This matches the original `resolveTicketId` behavior. The `--ticket` flag provides an explicit alternative. Not a regression.

3. **No unit tests for `formatDate`** (severity: low, not fixed)
   - **File:** `src/tickets/get.ts:32-44`
   - **Evidence:** `formatDate` is exported and testable but has no dedicated tests. The function is straightforward (7 lines, clear conditionals) and exercises well-understood Date APIs. Implementation plan step 11 mentioned "date formatting" tests but the resolver and flag tests were prioritized.

4. **Test files compiled into `dist/` and included in npm package** (severity: low, not fixed)
   - **Files:** `src/lib/resolve-ticket.test.ts`, `src/lib/flags.test.ts`
   - **Evidence:** `tsconfig.json` includes all of `src/`, and `package.json` `"files": ["dist"]` includes everything in dist. Test files add ~5KB to the published package. This is harmless but could be excluded with a tsconfig exclude or a `.npmignore`.

### Verification/Test Gaps

No critical test gaps. 30 tests pass covering all major resolution scenarios, flag utilities, and help detection. Live API tests (CHK-06/07/08) remain blocked by missing credentials as expected.

## Changes Made by Code Review

| File | Line | Description |
|------|------|-------------|
| `src/index.ts` | 34 | Changed `usage()` to use `console.log` for exit code 0 and `console.error` for exit code 1, matching the pattern used by `ticketsUsage()`, `commentsUsage()`, and `inspectUsage()`. |

## Remaining Risks / Deferred Items

1. **Pagination risk (Q1 from product spec):** If the org has more tickets than the API returns in a single `/api/tickets` call, resolution of older tickets by numeric number may fail silently with a "not found" error. Accepted risk per product/product.md.
2. **`list.ts` unsafe Date:** Low risk but could be hardened in a follow-up by using `formatDate` from `get.ts`.
3. **Test files in npm package:** Test `.test.js` files are compiled to `dist/` and would be included in any npm publish. Could be excluded with `.npmignore` or separate tsconfig for production builds.
4. **Live API verification:** CHK-06, CHK-07, CHK-08 remain blocked. Resolution correctness for actual API responses is unverified in sandbox.

## Verification Impact Notes

The code review change (global `usage()` stdout/stderr fix) does not affect any verification checks. All check IDs remain valid:

- **CHK-01 through CHK-05:** Unaffected. Typecheck and tests pass after fix.
- **CHK-06, CHK-07, CHK-08:** Still blocked by missing API access. Unaffected by this change.
- **CHK-09:** Unaffected. Inspect help still works correctly.
- **CHK-10:** Unaffected. No resolveTicketId remnants.

No verification checks are stale or need extra scrutiny due to the code review change.

## APL Statement Reference

Reviewed all 14 changed files against ticket requirements, product spec, and diagnosis. Implementation correctly addresses all 11 acceptance criteria: shared resolver (F1), JSON output for list and get (F2/F3), three-level help (F4), timestamp fix (F5), clear error messages (F6), PowerShell-safe inspect db (F7), and 30 unit tests (F8). One fix applied: global usage() function now sends help output to stdout (consistent with router-level help). No missed requirements, no regressions, no critical issues. Quality gates pass (typecheck 0 errors, 30/30 tests pass).

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification with acceptance criteria | 11 acceptance criteria verified; all addressed by implementation |
| `implementation/implementation-actual.md` | Scope map of changed files and deviations | Used as starting point; verified all 14 files directly; confirmed deviation (configOrHelp) was well-justified |
| `implementation/apl.json` | Implementation completion evidence | Confirmed all 12 steps completed, 30 tests pass, 3 checks blocked |
| `product/product.md` | Product features and success criteria | Cross-checked F1-F8 features and SC1-SC11 criteria against implementation |
| `implementation-plan/implementation-plan.md` | Detailed implementation steps and verification plan | Verified all 12 steps completed; check IDs CHK-01 through CHK-10 validated |
| `diagnosis/diagnosis-statement.md` | Root cause analysis (RC-1 through RC-5) | Confirmed all 5 root causes addressed; RC-1 (raw passthrough), RC-2 (help), RC-3 (dates), RC-4 (JSON), RC-5 (PowerShell) |
| `src/lib/config.ts` | HxConfig type definition | Verified stub config in configOrHelp is type-safe |
| `src/lib/http.ts` | hxFetch API surface | Confirmed resolver correctly uses hxFetch with basePath |
| `src/lib/resolve-repo.ts` | Pattern template for resolver | Confirmed resolve-ticket.ts follows same fetch-list-match pattern |

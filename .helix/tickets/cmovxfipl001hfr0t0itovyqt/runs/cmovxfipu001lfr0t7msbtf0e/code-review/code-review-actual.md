# Code Review: helix-cli — Four CLI Ergonomics Improvements

## Review Scope

Reviewed all five changed files in helix-cli implementing four independent CLI improvements: run display field name fix, `--dry-run` for `tickets continue`, `--search` for `tickets list`, and `--query-file` + PowerShell help for `inspect db`. Cross-referenced against ticket requirements (BLD-403), product spec (F1-F4), implementation plan (S1-S5), and diagnosis (all four root causes).

## Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `src/tickets/get.ts` | Fixed | `startedAt` type changed to `string \| null` to match server reality |
| `src/tickets/continue.ts` | OK | `--dry-run` gate correctly placed before API call; no side effects |
| `src/tickets/list.ts` | OK | `--search` flag correctly parsed and passed as server query param |
| `src/tickets/index.ts` | OK | Help text correctly updated for `--search` and `--dry-run` |
| `src/inspect/index.ts` | Fixed | PS 5.1 help example quoting corrected (single -> double quotes) |
| `src/lib/flags.ts` | OK (read-only) | Verified `getFlag`, `hasFlag`, `getPositionalArgs` signatures match usage |

## Missed Requirements & Issues Found

### Correctness/Behavior Issues

1. **`TicketDetail.runs[].startedAt` typed as `string` but can be `null`** (get.ts:17)
   - Severity: Low (type safety, not a runtime bug)
   - The server returns `null` for `startedAt` on QUEUED runs (confirmed by implementation testing: `tickets get HLX-65` shows null timestamps). The `formatDate` function handles `null` correctly at runtime, but the TypeScript type declaration was `string` instead of `string | null`. This could mislead future developers into writing code that assumes `startedAt` is always populated, causing runtime crashes.
   - Evidence: Implementation report shows "QUEUED in progress in progress" for HLX-65, confirming null `startedAt`. Server's `mapRunHistoryItem` (ticket-service.ts:462) passes through `runRecord.startedAt` which is nullable in the Prisma schema.

2. **PS 5.1 help example uses single quotes with backtick escaping** (inspect/index.ts:26,63)
   - Severity: Medium (documentation correctness affecting acceptance criteria AC-11)
   - In PowerShell, backtick (`` ` ``) is only an escape character inside double-quoted strings. Inside single-quoted strings, backticks are literal characters. The original example `'SELECT \`"Ticket\`"...'` would pass literal backtick characters to the SQL query, causing a PostgreSQL syntax error.
   - Fix: Changed outer quotes from single to double, making `` `" `` a proper PS escape sequence for a literal double quote.
   - Evidence: PowerShell language specification: single-quoted strings have no escape processing; backtick escaping requires double-quoted strings.

### Requirements Gaps

None. All four ticket requirements (search, run display, dry-run, PS ergonomics) are implemented.

### Regression Risks

None identified. All existing invocations continue to work:
- `--query` and positional SQL arguments unaffected by `--query-file` addition
- `tickets continue` without `--dry-run` still makes the POST call
- `tickets list` without `--search` passes no search param
- `tickets get` field name change is a fix, not a regression

### Code Quality/Robustness

- `--dry-run` correctly placed after context validation, before API call. This means `--dry-run` without context still errors, which is correct behavior (you need context to preview).
- `--query-file` error handling is robust: catches file read errors and empty files.
- `--search` follows the exact same pattern as existing flags.
- All quality gates pass (typecheck, build, 30/30 tests).

### Verification/Test Gaps

- No new unit tests for the four features. This is noted in the implementation and is acceptable given the simplicity of the changes and the thorough integration testing performed.

## Changes Made by Code Review

| File | Line | Description |
|------|------|-------------|
| `src/tickets/get.ts` | 17 | Changed `startedAt: string` to `startedAt: string \| null` to match server API reality for QUEUED runs |
| `src/inspect/index.ts` | 25-26 | Fixed PS 5.1 example in `inspectUsage()`: changed outer quotes from single to double so backtick escaping works correctly |
| `src/inspect/index.ts` | 62-63 | Fixed PS 5.1 example in `db --help` text: same quoting fix as above |

## Remaining Risks / Deferred Items

- **PS 5.1 native command argument passing quirks**: Even with double-quoted strings, PS 5.1 may have edge cases with argument passing to external commands. The `--query-file` approach (documented and implemented) is the most reliable cross-shell solution and should be recommended for PS 5.1 users with complex SQL.
- **No new unit tests**: Acceptable for this ticket's scope, but future changes to these features should add test coverage.
- **`--search` depends on server deployment**: The CLI `--search` flag sends a query param that the server ignores unless the server-side change is also deployed. Both repos must deploy together for end-to-end functionality.

## Verification Impact Notes

No behavioral changes that would invalidate verification checks. The two fixes are:
1. Type accuracy (no runtime change) - all verification checks remain valid
2. Help text quoting (cosmetic/documentation) - CHK-10 (help output check) still valid; the PS 5.1 example is now more correct

All verification check IDs (CHK-01 through CHK-10) remain valid.

## APL Statement Reference

See `code-review/apl.json` for the formal artifact provenance.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Ticket requirements and acceptance criteria | Verified all four features implemented; identified PS 5.1 quoting as acceptance criterion AC-11 |
| implementation/implementation-actual.md (helix-cli) | Scope map of all changed files | Guided file-by-file review; noted HLX-65 QUEUED run test as evidence for null startedAt |
| implementation/apl.json (helix-cli) | Implementation provenance | Confirmed field name fix evidence and testing approach |
| implementation-plan/implementation-plan.md (helix-cli) | Planned approach for all four features | Verified implementation followed plan; no deviations |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis for all four issues | Confirmed startedAt/finishedAt mismatch; formatDate behavior for undefined/null |
| product/product.md | Product spec F1-F4 and success criteria | Cross-referenced features against implementation |
| repo-guidance.json | Repo intent | Confirmed helix-cli is primary target for all 4 issues |
| implementation/implementation-actual.md (helix-global-server) | Server-side search implementation | Verified search endpoint change is minimal and correct |
| src/tickets/get.ts (code) | Direct code review | Found type inaccuracy: startedAt typed as string but can be null |
| src/inspect/index.ts (code) | Direct code review | Found PS 5.1 quoting bug in help text |
| src/lib/flags.ts (code) | Utility verification | Confirmed getFlag/hasFlag/getPositionalArgs signatures match usage |
| ticket-service.ts:457-473 (server code) | Cross-repo field verification | Confirmed server returns nullable startedAt |

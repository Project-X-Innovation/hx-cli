# Implementation Actual: helix-cli — Four CLI Ergonomics Improvements

## Summary of Changes

Four independent CLI improvements implemented:
1. **Run display fix** (S1): Corrected field name mismatch in `TicketDetail` type from `createdAt`/`completedAt` to `startedAt`/`finishedAt`, matching the server API response.
2. **Dry-run flag** (S2): Added `--dry-run` flag to `tickets continue` that prints the resolved continuation payload and exits without making an API call.
3. **Search flag** (S3): Added `--search <text>` flag to `tickets list` that passes a `search` query parameter to the server for server-side title filtering.
4. **Query-file and PS help** (S4): Added `--query-file <path>` to `inspect db` to read SQL from a file, and enhanced help text with PowerShell 7 and 5.1 examples using quoted Postgres identifiers.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/tickets/get.ts` | Fixed `TicketDetail.runs` type to use `startedAt`/`finishedAt` (matching server API); updated `printTicketDetail` to use correct field names | Type definition affects all consumers of `TicketDetail`; public interface change |
| `src/tickets/continue.ts` | Added `hasFlag` import; added `--dry-run` check before API call to print preview and exit 0; updated inline help text | Dry-run gate must prevent all side effects; added before unconditional POST |
| `src/tickets/list.ts` | Added `--search` flag parsing via `getFlag` and added `search` to `queryParams` object | Server-side search param; composes with existing filters |
| `src/tickets/index.ts` | Updated usage strings and help text for `list` (added `--search <text>`) and `continue` (added `[--dry-run]`) | Help text consistency across top-level usage and per-command help |
| `src/inspect/index.ts` | Added `readFileSync` import from `node:fs`; added `--query-file` handling with priority over `--query` and positional; expanded help text with PowerShell 7/5.1 examples | Uses `readFileSync` (established pattern); error handling for missing/empty files |

## Steps Executed

### S1: Fix run display field names
- Changed `createdAt` to `startedAt` in `TicketDetail.runs` type (line 17)
- Changed `completedAt` to `finishedAt` in `TicketDetail.runs` type (line 18)
- Updated `run.createdAt` to `run.startedAt` in `printTicketDetail` (line 71)
- Updated `run.completedAt` to `run.finishedAt` in `printTicketDetail` (line 72)

### S2: Add `--dry-run` flag to `tickets continue`
- Added `hasFlag` to import from `../lib/flags.js` (line 3)
- Added dry-run check at line 30-36 (after context validation, before API call)
- Updated inline help text at line 11 to include `[--dry-run]`
- Updated help text in `index.ts` at lines 22, 87-89

### S3: Add `--search` flag to `tickets list`
- Added `--search` flag parsing at lines 66-70 in `list.ts`
- Updated help text in `index.ts` at lines 17, 42

### S4: Add `--query-file` and improved help to `inspect db`
- Added `import { readFileSync } from "node:fs"` at line 1
- Updated `inspectUsage` help text (lines 11-29) with `--query-file`, PowerShell 7/5.1 examples
- Updated `db --help` text (lines 52-66) with same content
- Added `--query-file` flag handling (lines 70-88) with file reading, error handling
- Priority: `--query-file` > `--query` > positional

### S5: Quality gates
- `npm run typecheck` — passed
- `npm run build` — passed
- `npm run test` — 30/30 tests passed

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npm run typecheck` | Exit 0, no errors |
| `npm run build` | Exit 0, `dist/` populated |
| `npm run test` | 30 tests passed, 0 failures |
| `tickets get HLX-11` (formatted) | Shows `3/31/2026, 6:02:55 AM  3/31/2026, 6:48:48 AM` with SUCCEEDED status |
| `tickets get HLX-11 --json` | JSON shows `startedAt: "2026-03-31T06:02:55.455Z"`, `finishedAt: "2026-03-31T06:48:48.030Z"` |
| `tickets get HLX-65` (QUEUED run) | Shows `in progress  in progress` for null timestamps |
| `tickets continue HLX-11 "test" --dry-run` | Prints payload, exits 0 |
| `tickets get HLX-11 --json` (after dry-run) | Still 1 run, no new run created |
| `tickets list --search "Delivery"` (local server) | Returns 1 ticket: HLX-11 |
| `tickets list --search "zzz-no-match"` (local server) | Returns "No tickets found.", exit 0 |
| `tickets list --search "Delivery" --json` | Returns valid JSON array with 1 item |
| `inspect db --help` | Shows `--query-file`, PowerShell 7/5.1 examples with `"Ticket"."ticketNumber"` |
| `inspect db --query-file /tmp/test-query.sql` | Query read and submitted (404 = API-level, not CLI error) |
| `inspect db --query-file /tmp/nonexistent.sql` | `Error: Could not read query file` |
| `inspect db --query-file /tmp/empty-query.sql` | `Error: query file is empty.` |
| `inspect db --query 'SELECT 1'` (regression) | Existing behavior unchanged |

## Test/Build Results

- **TypeScript typecheck**: PASS (exit 0)
- **Build**: PASS (exit 0, dist/ populated)
- **Tests**: 30/30 passed, 0 failures, 6 test suites (flags.test.js, resolve-ticket.test.js)

## Deviations from Plan

None. All changes followed the implementation plan exactly.

## Known Limitations / Follow-ups

- No new unit tests added for the four features. The existing test suite covers the flag utilities used. Integration testing was done via live CLI invocations against the staging/local API.
- The `--search` flag requires the server-side change (helix-global-server) to be deployed for production use. Against the current staging server (without the change), `--search` is ignored by the server and all tickets are returned.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npm run typecheck` exit 0, no errors |
| CHK-02 | pass | `npm run build` exit 0, dist/ populated |
| CHK-03 | pass | `npm run test` 30/30 tests passed, 0 failures |
| CHK-04 | pass | `tickets get HLX-11` formatted output: `SUCCEEDED  3/31/2026, 6:02:55 AM  3/31/2026, 6:48:48 AM` |
| CHK-05 | pass | `tickets get HLX-11 --json` shows `startedAt` and `finishedAt` with ISO date values |
| CHK-06 | pass | `tickets get HLX-65` shows `QUEUED  in progress  in progress` for null startedAt/finishedAt |
| CHK-07 | pass | `tickets list --search "Delivery"` against local server returns 1 ticket: HLX-11 |
| CHK-08 | pass | `tickets list --search "zzz-no-match-xyz-999"` against local server returns "No tickets found." exit 0 |
| CHK-09 | pass | `tickets continue HLX-11 "test" --dry-run` prints payload, exits 0; post-check shows no new run |
| CHK-10 | pass | `inspect db --help` shows --query-file and PS examples; `--query-file /tmp/test-query.sql` reads and submits query (404 = API-level) |

## APL Statement Reference

See `implementation/apl.json` for the formal artifact provenance.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Requirements and acceptance criteria | Four independent features; server-side search required; dry-run must not mutate |
| implementation-plan/implementation-plan.md (helix-cli) | Step-by-step plan with file paths and line numbers | S1-S5 steps with exact insertion points and verification checks |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause of field name mismatch and all four issues | createdAt/completedAt vs startedAt/finishedAt confirmed; formatDate handles undefined |
| repo-guidance.json | Repo intent for both repos | helix-cli is primary target; helix-global-server is target for search only |
| src/tickets/get.ts (code) | Run display bug source | TicketDetail type with wrong field names confirmed at lines 14-19 |
| src/tickets/continue.ts (code) | Continuation flow | Unconditional POST at line 30; insertion point for dry-run gate |
| src/tickets/list.ts (code) | Current flag parsing | getFlag already imported; queryParams pattern established |
| src/tickets/index.ts (code) | Help text routing | All usage strings updated for --search and --dry-run |
| src/inspect/index.ts (code) | Inspect db flag handling | --query flag at line 57; help text at lines 45-53 |
| src/lib/flags.ts (code) | Flag utility API | getFlag, hasFlag, getPositionalArgs signatures confirmed |

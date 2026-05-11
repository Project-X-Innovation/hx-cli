# Diagnosis Statement — helix-cli

## Problem Summary

Four independent CLI ergonomics gaps in the `hlx` CLI:

1. **No server-side ticket search**: `hlx tickets list` has no `--search` flag. Users must fetch all tickets and filter locally.
2. **Run display bug**: `hlx tickets get` shows placeholder text instead of actual run timestamps and misreports terminal run status, due to a field name mismatch between CLI type and server response.
3. **No dry-run for continue**: `hlx tickets continue` immediately starts a run with no way to preview the resolved continuation payload.
4. **PowerShell inspect db fragility**: `hlx inspect db` with quoted Postgres identifiers is fragile under PowerShell; no `--query-file` escape hatch exists.

## Root Cause Analysis

### Issue 1: `tickets list --search` — Missing feature (CLI + server)

The CLI's `cmdTicketsList` (`src/tickets/list.ts:38-72`) builds `queryParams` from flags (`--archived`, `--status-not-in`, `--sprint`, `--user`) and sends GET `/api/tickets`. No `--search` flag is parsed, and the server endpoint (`ticket-controller.ts:190-213`) doesn't accept a `search` query parameter. The Prisma query in `listTicketsForOrganization` (`ticket-service.ts:1522-1531`) has no title filter.

**Required change**: CLI adds `--search` flag → passes `search` query param. Server parses `search` param → adds `title: { contains: search, mode: 'insensitive' }` to Prisma where clause. No migration needed.

### Issue 2: `tickets get` run display — Field name mismatch (CLI only)

**Root cause confirmed**: The CLI's `TicketDetail` type (`get.ts:14-19`) declares run fields as `createdAt: string` and `completedAt: string | null`. The server's `mapRunHistoryItem` (`ticket-service.ts:457-473`) returns `startedAt` and `finishedAt`. At runtime, `run.createdAt` and `run.completedAt` are both `undefined`.

The `formatDate` function (`get.ts:32-44`) handles `undefined` values:
- `formatDate(undefined)` → `"in progress"` (for the start timestamp column — no `runStatus` arg passed at line 71)
- `formatDate(undefined, "SUCCEEDED")` → `"N/A"` (for the completion column — terminal status path at line 34-35)

Production data confirms the server returns valid ISO dates: a SUCCEEDED run had `startedAt: "2026-05-07T22:07:53.219Z"` and `finishedAt: "2026-05-07T22:13:27.951Z"`. The data exists but the CLI never reads it due to wrong field names.

**Note**: The ticket describes `Invalid Date` rendering, but the current `formatDate` code has an `isNaN` guard (line 40) that returns `"unknown"` for invalid dates. The actual symptom with the current code is `"in progress"` for all start timestamps. The core bug — wrong field names — is the same regardless.

**Required change**: Update `TicketDetail.runs` type to `startedAt`/`finishedAt`. Update `printTicketDetail` to use `run.startedAt` and `run.finishedAt`.

### Issue 3: `tickets continue --dry-run` — Missing feature (CLI only)

The `cmdTicketsContinue` function (`continue.ts:30-34`) immediately POSTs to `/tickets/{ticketId}/rerun` with `{ continuationContext }`. No `--dry-run` flag check exists. The ticket resolution step (`index.ts:91-92`) already runs before `cmdTicketsContinue`, and the continuation context is assembled at lines 17-22, so all data needed for a preview is available before the API call.

**Required change**: Add `hasFlag(args, "--dry-run")` check before the API call. If true, print the resolved payload and exit 0.

### Issue 4: `inspect db` PowerShell — Documentation/ergonomics gap (CLI only)

The `--query` flag already exists (`inspect/index.ts:57`). Help text already includes a single-quote PowerShell example. However:
- No `--query-file <path>` option exists for complex SQL with mixed quoting
- The example query (`SELECT * FROM "Tickets" LIMIT 5`) doesn't demonstrate the specific problematic pattern (`"Ticket"."ticketNumber"`)
- No explicit guidance for PS 5.1 vs 7.x differences

The CLI already uses `readFileSync` in multiple modules (`config.ts`, `version.ts`, `bundle.ts`), so adding `--query-file` follows established patterns.

**Required change**: Add `--query-file` option, improve help text with explicit PS 5.1/7 examples showing quoted identifiers, make `--query` the documented canonical form.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| CLI TicketDetail type | `get.ts:14-19` | Expects `createdAt`/`completedAt` on run objects |
| Server mapRunHistoryItem | `ticket-service.ts:457-473` | Returns `startedAt`/`finishedAt` — no `createdAt`/`completedAt` |
| Production run data | Runtime DB query | SUCCEEDED run: `startedAt` and `finishedAt` contain valid ISO dates |
| formatDate behavior | `get.ts:32-44` | `undefined` input → `"in progress"` or `"N/A"` depending on status |
| Server getTickets handler | `ticket-controller.ts:190-213` | No `search` query param parsed |
| Server listTicketsForOrganization | `ticket-service.ts:1522-1531` | No title filter in Prisma where clause |
| Ticket count | Runtime DB query | 468 total tickets — ILIKE safe without index |
| continue.ts API call | `continue.ts:30-34` | Unconditional POST; no `--dry-run` check |
| inspect --query flag | `inspect/index.ts:57` | Already exists; no `--query-file` |
| CLI fs usage | `config.ts`, `version.ts`, `bundle.ts` | `readFileSync` pattern established |

## Success Criteria

1. `hlx tickets list --search "<fragment>"` returns matching tickets filtered server-side.
2. `hlx tickets list --search "no-match"` returns empty result without error.
3. `hlx tickets list --search "..." --json` returns valid JSON.
4. `hlx tickets get` shows correct status for SUCCEEDED runs (not `in progress`).
5. Run timestamps render as readable dates using `startedAt`/`finishedAt` from the API.
6. Runs with null `startedAt` show clear placeholder (e.g., `—`), not `Invalid Date`.
7. `hlx tickets continue <ref> "..." --dry-run` prints payload and exits 0 without starting a run.
8. `hlx tickets continue <ref> "..."` (no flag) behaves exactly as before.
9. `hlx inspect db --help` includes working PowerShell examples with quoted Postgres identifiers.
10. `--query-file <path>` provides an unambiguous escape hatch for complex SQL.
11. Existing `--query` invocations continue to work unchanged.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/reference-map.json (helix-cli) | Mapped all affected CLI files and field name mismatch | Confirmed createdAt/completedAt vs startedAt/finishedAt mismatch; listed all files needing changes |
| scout/scout-summary.md (helix-cli) | Understood analysis of all four issues from CLI perspective | All four issues are independent; server change needed only for search |
| scout/reference-map.json (helix-global-server) | Mapped server files for search endpoint and run field names | Confirmed no search param exists; mapRunHistoryItem returns correct field names |
| scout/scout-summary.md (helix-global-server) | Understood server-side requirements | Prisma contains + insensitive mode is sufficient; no migration needed |
| ticket.md | Requirements, acceptance criteria, non-negotiables | Server-side search required; dry-run must not mutate; API response format out of scope |
| src/tickets/get.ts (code) | Verified TicketDetail type and formatDate logic | Type declares wrong field names; formatDate handles undefined with placeholders |
| src/tickets/list.ts (code) | Verified current flag parsing and API call | No --search flag; queryParams built from 4 existing flags |
| src/tickets/continue.ts (code) | Verified immediate POST with no dry-run check | Unconditional API call at line 30 |
| src/inspect/index.ts (code) | Verified --query flag exists, reviewed help text | Flag works; help example is basic; no --query-file |
| ticket-controller.ts:190-213 (code) | Verified server handler lacks search param | Parses 4 query params; no search |
| ticket-service.ts:1477-1556 (code) | Verified Prisma query lacks title filter | where clause has no title filter |
| ticket-service.ts:457-473 (code) | Verified server run field names | Returns startedAt/finishedAt, not createdAt/completedAt |
| Production SandboxRun query | Confirmed field values at runtime | SUCCEEDED run has valid ISO dates in startedAt/finishedAt |
| Production Ticket count query | Assessed search performance | 468 tickets — ILIKE safe without index |

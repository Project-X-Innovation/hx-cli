# Ticket Context

- ticket_id: cmovxfipl001hfr0t0itovyqt
- short_id: BLD-403
- run_id: cmovxfipu001lfr0t7msbtf0e
- run_branch: helix/build/BLD-403-hlx-cli-ergonomics-polish-search-run-display-dry
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
hlx CLI ergonomics polish: search, run display, dry-run, inspect db PowerShell

## Description
# Ticket: `hlx` CLI ergonomics polish

## Summary
Four targeted CLI polish items: add server-side ticket search, fix run display fields in `tickets get`, add a dry-run mode to `tickets continue`, and provide PowerShell-safe ergonomics for `inspect db` queries that contain quoted Postgres identifiers.

## Why

### No first-class ticket search
- There is no first-class search today. Callers have to fetch all tickets in JSON and filter locally — this does not scale and forces every consumer to reimplement search.

### `hlx tickets get` run display is broken
- `hlx tickets get` formats run timestamps as `Invalid Date` and shows the completion status as `in progress` even for runs that the same response reports as `SUCCEEDED`. This is a formatting/mapping bug in the CLI's formatted output path. The API returns valid run state — the data is available; the formatted output path is the gap.

### `hlx tickets continue` has no preview mode
- `hlx tickets continue <ticket-ref> "<context>"` immediately starts a run when invoked. Continuation prompts are easy to draft incorrectly, especially from agent contexts where quoting, line breaks, and context substitution are fragile. There is no way to preview the resolved continuation context before the run begins.

### `hlx inspect db` is fragile under PowerShell
- `hlx inspect db --repo <name> "<sql>"` is fragile under PowerShell quoting when the SQL contains quoted Postgres identifiers like `"Ticket"` or `"ticketNumber"`. Quotes get stripped or mismatched and the query fails with errors like `relation "ticket" does not exist`. PowerShell's double-quote interpolation rules make the positional form especially error-prone.

## Required Behavior

### `hlx tickets list --search <text>`
- New `--search <text>` flag filters tickets by title (case-insensitive). Server-side, not client-side.
- Composes with `--json`.
- Empty result returns an empty list/table without error.

### `hlx tickets get` run display
- Run timestamps must render using the actual API fields for `createdAt` and `completedAt`. If a field is genuinely absent, render a clear placeholder (e.g. `—` or `not started`), never `Invalid Date`.
- Run status must reflect the real terminal status. A `SUCCEEDED` run must not display as `in progress`.

### `hlx tickets continue --dry-run`
- Add `--dry-run` (or equivalent preview flag) to `hlx tickets continue` that resolves the ticket reference, prints the continuation payload that would be sent, and exits without starting a run.
- No run, run record, or status change must occur in dry-run mode.

### `hlx inspect db` PowerShell ergonomics
- Treat `--query <sql>` as the canonical form for `hlx inspect db` and update help text and examples to reflect that, OR add an unambiguous PowerShell-safe input mode (e.g. `--query-file <path>` for SQL pulled from disk).
- Help output must include a working PowerShell example with a quoted Postgres identifier.

## Non-Negotiable
- `tickets list --search` must filter on the server. Do not pull all tickets and filter client-side.
- `tickets continue --dry-run` must not start a run, must not increment any counter, must not write any artifact, and must not change ticket status.

## Out of Scope
- Searching comments, runs, or artifacts.
- Changing the API response format for runs.
- Changing the underlying SQL execution path in `inspect db`.
- Editing existing continuation history.

## Acceptance Criteria

### `tickets list --search`
1. `hlx tickets list --search "<known title fragment>"` returns matching ticket(s).
2. `hlx tickets list --search "no-such-text"` returns an empty result without erroring.
3. `hlx tickets list --search "..." --json` returns valid JSON.

### `tickets get` run display
4. For a ticket with a `SUCCEEDED` run, `hlx tickets get <ref>` shows the correct completion status (not `in progress`).
5. Run start and completion timestamps render as readable dates, not `Invalid Date`.
6. Tickets with runs that have not started display a clear placeholder, not `Invalid Date`.

### `tickets continue --dry-run`
7. `hlx tickets continue <ref> "..." --dry-run` prints the resolved continuation payload and exits 0.
8. After running with `--dry-run`, `hlx tickets get <ref>` shows no new run.
9. `hlx tickets continue <ref> "..."` without the flag continues to behave exactly as today.

### `inspect db` PowerShell
10. The documented PowerShell example from `hlx inspect db --help` runs successfully against a quoted-identifier query.
11. A SQL string referencing `"Ticket"."ticketNumber"` succeeds via the documented invocation, on PowerShell 5.1 and 7.x.
12. Existing `--query` invocations continue to behave as today.

## Attachments
- (none)

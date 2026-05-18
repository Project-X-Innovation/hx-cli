# Ticket Context

- ticket_id: cmp34axnh0084ly0uf8797cqt
- short_id: FIX-436
- run_id: cmp34axo40087ly0ueg2tgdvf
- run_branch: helix/fix/FIX-436-hlx-cli-cannot-resolve-archived-ticket-references
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
hlx CLI cannot resolve archived ticket references for direct ticket and comments commands

## Description
# Ticket: hlx CLI cannot resolve archived ticket references for direct ticket and comments commands

## Summary
The `hlx` CLI currently fails to resolve archived ticket references for commands that operate on a specific ticket ref. The server can return archived ticket details directly, but the CLI's shared resolver only searches the active ticket list. This causes archived tickets to appear as "not found" even when they exist and are otherwise accessible by ID through the API.

## Why
The current behavior is inconsistent and misleading:

- `hlx tickets list --archived` and `hlx tickets latest --archived` already acknowledge archived tickets as a first-class concept.
- `hlx tickets get <archived-ref>` fails before it even tries the direct ticket endpoint.
- The same broken resolution path also blocks `update-description`, `rerun`, `continue`, `artifacts`, `artifact`, `bundle`, and `comments` commands from even attempting their server call.

This is a CLI bug in ticket reference resolution, not a server-side inability to access archived tickets.

## Decisions Already Made
- The fix belongs in `helix-cli`.
- The problem is the shared resolver in `src/lib/resolve-ticket.ts`, not the formatted output path.
- Commands that target one specific ticket ref must be able to resolve archived tickets without requiring the user to know or declare archive state up front.
- `tickets list` and `tickets latest` keep their existing `--archived` behavior. Do not redesign list semantics in this ticket.
- If a command resolves an archived ticket successfully and the downstream server endpoint later rejects the operation for business reasons, that server error must surface normally. The CLI must not convert that into a fake "ticket not found" error during resolution.

## Do Not Re-Decide
- Do not add a new required flag like `--archived` to `tickets get`, `tickets rerun`, `tickets continue`, `tickets artifacts`, `tickets artifact`, `tickets bundle`, `tickets update-description`, `comments list`, or `comments post`.
- Do not change how `tickets list` or `tickets latest` decide whether to include archived tickets.
- Do not move this fix into `helix-global-server`.
- Do not narrow the fix to `tickets get` only. The shared resolver is used by multiple commands and the fix must cover the full affected surface.

## Non-Negotiable Invariants
- Ticket reference resolution for specific-ticket commands must search both active and archived tickets.
- The CLI must continue to accept the same ticket reference forms it claims today: internal ID, short ID, and numeric ticket number.
- Active ticket resolution behavior must remain unchanged.
- Archived ticket support must apply consistently anywhere `resolveTicket` is used today.
- A resolver miss must mean the ticket truly does not exist in either active or archived results for the current org.

## In Scope
- Update `src/lib/resolve-ticket.ts` so archived tickets are considered during resolution for specific-ticket commands.
- Update or add tests covering archived ticket resolution.
- Verify affected commands that route through `resolveTicket`, including:
  - `hlx tickets get`
  - `hlx tickets update-description`
  - `hlx tickets rerun`
  - `hlx tickets continue`
  - `hlx tickets artifacts`
  - `hlx tickets artifact`
  - `hlx tickets bundle`
  - `hlx comments list`
  - `hlx comments post`
- Update help or inline documentation only if needed to reflect real behavior.

## Out of Scope
- Any server-side ticket archive model changes.
- Redesigning ticket list, latest, or search UX.
- Adding new archive-management commands.
- UI changes outside the CLI.

## Required Behavior
1. When a user runs a specific-ticket command with an archived ticket ref, the CLI must resolve that ref successfully and proceed to the command's normal endpoint call.
2. Resolution must preserve current priority and ambiguity behavior for internal ID, short ID, and numeric ticket-number matching.
3. If an archived ticket is resolved and the downstream endpoint is not allowed for archived tickets, the CLI must show the real server error from that endpoint instead of failing early with "ticket not found."
4. If the ticket does not exist in either active or archived tickets, the CLI must still fail with a clear not-found error.
5. `hlx tickets list` and `hlx tickets latest` must continue to require their existing archived behavior and must not silently change scope.

## Failure Behavior
- Fail closed on real resolution misses: if the ticket is absent from both active and archived datasets, report not found.
- Do not silently drop the archived lookup path on network or parsing errors.
- If active lookup succeeds, do not override it with archived data.
- If archived lookup is needed and fails due to transport or server error, return a clear error that identifies resolution as the failing stage.

## Batch / Cardinality Rules
- Resolve against the active ticket set and the archived ticket set as separate collections, then combine the results logically for matching.
- Do not use only the first returned collection as a proxy for all ticket states.
- For numeric ticket refs, ambiguity detection must consider matches across both active and archived tickets, not just one set.

## Acceptance Criteria
1. `hlx tickets get <archived-internal-id>` succeeds for an archived ticket and prints ticket details instead of "not found."
2. `hlx tickets get <archived-short-id>` succeeds for an archived ticket.
3. `hlx tickets get <archived-ticket-number>` succeeds when the numeric ref is unambiguous across active and archived tickets.
4. `hlx comments list --ticket <archived-ref>` resolves the archived ticket and reaches the comments endpoint.
5. `hlx tickets artifacts <archived-ref>` resolves the archived ticket and reaches the artifacts endpoint.
6. A command against a genuinely missing ref still reports not found.
7. Existing active-ticket resolution tests still pass unchanged.
8. Add a regression test proving that an archived-only ticket is resolvable by the shared resolver.
9. Add a regression test proving numeric ambiguity is detected across active and archived results, not only within active results.
10. Negative: `hlx tickets list` without `--archived` must not start returning archived tickets as a side effect of this fix.

## Attachments
- (none)

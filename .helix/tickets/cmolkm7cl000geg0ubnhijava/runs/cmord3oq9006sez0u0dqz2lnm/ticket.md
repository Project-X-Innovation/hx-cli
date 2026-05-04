# Ticket Context

- ticket_id: cmolkm7cl000geg0ubnhijava
- short_id: HLX-342
- run_id: cmord3oq9006sez0u0dqz2lnm
- run_branch: helix/auto/HLX-342-improve-helix-cli-ticket-lookup-help-json-output
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Improve Helix CLI Ticket Lookup, Help, JSON Output, And Inspection Ergonomics

## Description
# Ticket: Improve Helix CLI Ticket Lookup, Help, JSON Output, And Inspection Ergonomics

## Summary
Improve the Helix CLI so agents and operators can reliably inspect tickets without falling back to database lookups or fragile terminal parsing. Ticket commands must accept internal ids, short ids such as `BLD-339`, and numeric ticket numbers such as `339`; list/get/artifact commands should expose machine-readable output; subcommand help must work without executing command behavior; and run timestamps must display correctly.

## Why
While inspecting tickets `339` and `340`, the CLI showed the tickets in `hlx tickets list` but `hlx tickets get 339`, `hlx tickets get 340`, `hlx tickets get BLD-339`, and `hlx tickets get BLD-340` all returned `HTTP 404 Not Found`. The only working path was to resolve the internal ids with `hlx inspect db` and then call `hlx tickets get <internal-id>`. That defeats the purpose of the CLI as an agent workbench and creates unnecessary production DB dependency. Several help commands also executed normal command behavior instead of showing help, and `tickets get` printed run timestamps as `Invalid Date`.

## Decisions Already Made
- Fix the CLI itself rather than relying on a skill workaround.
- Ticket lookup must support internal ids, short ids, and numeric ticket numbers.
- Ticket lookup behavior must be shared across ticket subcommands, not reimplemented command by command.
- JSON output is required for agent use; formatted text output may remain the default for humans.
- This ticket is scoped to the CLI and any minimal API support required for the CLI to work correctly.

## Do Not Re-Decide
- Do not require agents to query the database just to resolve a visible ticket number.
- Do not make `tickets get` internal-id-only.
- Do not solve this by documenting the current workaround as the primary path.
- Do not remove existing human-readable output.
- Do not redesign authentication, org selection, or token storage.

## Non-Negotiable Invariants
- `hlx tickets get 339`, `hlx tickets get BLD-339`, and `hlx tickets get <internal-id>` must resolve the same ticket when they refer to the same ticket in the current org.
- Shared ticket id resolution must be used by `tickets get`, `tickets artifacts`, `tickets artifact`, `tickets rerun`, and `tickets continue` unless a command has a documented reason not to.
- `hlx tickets list --json` must include the internal ticket id, short id, status, title, reporter, timestamps, and any existing fields currently shown in text output.
- `hlx tickets get --json` must return structured ticket details including internal id, short id, status, title, branch, reporter, repositories, runs, archived flag, and description.
- Subcommand `--help` must print usage and must not execute the command's normal API behavior.
- Run timestamps displayed by `hlx tickets get` must not show `Invalid Date` when the API has valid timestamp data.
- Existing text output must remain readable and backwards compatible where practical.

## In Scope
- Add shared ticket reference resolution for internal ids, short ids, and numeric ticket numbers.
- Update ticket subcommands to use the shared resolver.
- Add `--json` output to `tickets list` and `tickets get`.
- Add or fix `--help` handling for ticket subcommands.
- Fix `tickets get` run timestamp formatting and completed/in-progress display.
- Improve `inspect db` ergonomics or documentation for PowerShell-safe SQL with quoted Postgres identifiers.
- Add focused tests for the new CLI behavior.

## Out of Scope
- Reworking CLI authentication.
- Changing org selection semantics.
- Replacing the current API client layer.
- Changing ticket statuses or backend workflow behavior.
- Broad CLI redesign outside the ticket and inspect commands named here.
- Building a Helix skill as the primary fix.

## Required Behavior
1. Create a shared resolver that accepts a ticket reference string and returns the internal ticket id plus useful display metadata when available.
2. The resolver must support internal ids, short ids like `BLD-339`, and numeric strings like `339`.
3. `hlx tickets get <ref>` must use the resolver before calling the ticket detail endpoint.
4. `hlx tickets artifacts <ref>` and `hlx tickets artifact <ref> --step <step> --repo <repo>` must use the same resolver.
5. `hlx tickets rerun <ref>` and `hlx tickets continue <ref>` must use the same resolver.
6. `hlx tickets list --json` must print JSON and avoid human table formatting.
7. `hlx tickets get --json` must print JSON and avoid truncating the description.
8. `hlx tickets get` text output may keep truncating long descriptions, but JSON output must not.
9. Every ticket subcommand must treat `--help` and `-h` as help flags and exit before validation or API calls.
10. Fix run date handling so valid `createdAt` and `completedAt` values render as dates, and null `completedAt` renders as `in progress` only when the run is actually incomplete.
11. Add PowerShell-safe examples for `hlx inspect db`, or add a CLI option that avoids shell quoting problems for SQL with quoted identifiers.

## Failure Behavior
- If a ticket reference cannot be resolved, print a clear error that includes the input reference and the current org context.
- If a numeric ticket number matches no ticket, do not fall back to an unrelated internal id or latest ticket.
- If a short id matches no ticket, do not fall back to a title search.
- If resolution is ambiguous, fail with a clear message instead of choosing one silently.
- If JSON output is requested, errors should still be clear and should not emit partial success JSON.

## Batch / Cardinality Rules
- Ticket resolution is per ticket reference.
- Do not use the first ticket returned by list as a proxy for a requested ticket number.
- Do not use the latest ticket as a fallback for an unresolved reference.
- If a command later accepts multiple ticket references, resolve each independently and report which references failed.

## Persistence / Artifact Rules
- Do not persist ticket resolution caches unless explicitly needed.
- Do not change ticket artifacts or run artifacts as part of this CLI fix.
- Do not write local files as part of normal `tickets get`, `tickets list`, `tickets artifacts`, or `tickets artifact` commands unless the command already has an explicit output flag.

## Acceptance Criteria
1. `hlx tickets get 339` resolves and prints the same ticket as `hlx tickets get BLD-339` and `hlx tickets get <internal-id>`.
2. `hlx tickets artifacts 339` resolves the same ticket and lists its artifacts.
3. `hlx tickets artifact 339 --step implementation --repo helix-global-server` resolves the same ticket and prints the implementation artifact.
4. `hlx tickets rerun 339` and `hlx tickets continue 339` resolve the same ticket before executing their existing behavior.
5. `hlx tickets list --json` emits valid JSON with internal ids included.
6. `hlx tickets get 339 --json` emits valid JSON with full description and structured repositories/runs.
7. `hlx tickets get --help`, `hlx tickets list --help`, and `hlx tickets latest --help` print usage and make no ticket API call.
8. `hlx tickets get` no longer prints `Invalid Date` for runs when valid run timestamps exist.
9. Unresolved references fail clearly and do not fall back to latest, first, or partial matches.
10. Tests cover internal id lookup, short id lookup, numeric ticket number lookup, unresolved lookup, JSON output, and help behavior.
11. The CLI docs or command help include a PowerShell-safe example for `hlx inspect db` queries with quoted Postgres identifiers, or the CLI provides an equivalent safer input option.

## Source Notes
Use `HELIX_CLI_NOTES.md` at the workspace root as the field report for the failures that motivated this ticket. The important observed failures were:
- numeric `tickets get` returned 404 for visible tickets;
- short-id `tickets get` returned 404 for visible tickets;
- internal id worked only after resolving through DB inspection;
- subcommand help flags executed normal behavior or failed validation;
- run dates printed as `Invalid Date`;
- PowerShell SQL quoting made `inspect db` difficult for quoted Postgres identifiers.

## Attachments
- (none)

## Discussion
- **Helix** (2026-04-30T15:06:06.038Z) [Agent]: Changes applied to 1 repository. Verification could not be fully completed — please review the changes manually.
- **Helix** (2026-04-30T23:25:10.076Z) [Agent]: Your changes are ready! Updated 1 repository.
- **Helix** (2026-04-30T23:55:23.907Z) [Agent]: Your changes are ready! Updated 1 repository.

## Continuation Context
## ROLE
This is a CONFLICT RESOLUTION run. Your only job is to resolve git merge conflicts.
Do NOT re-implement the original ticket. Do NOT add new features or refactor code.

## TASK
Read `.helix/merge-conflicts.json` in each repo for the list of conflicted files.
Each entry includes `ticketCommits` and `stagingCommits` context explaining what each side changed.
You MUST resolve conflicts in EVERY file listed in merge-conflicts.json. Do not stop until all files are clean.

## RESOLUTION STRATEGY
Process files one at a time. Read the file, resolve all markers, write it back, then move to the next file.
1. For each conflicted file, understand the intent of both the ticket changes and the staging changes.
2. Remove all `<<<<<<<`, `=======`, and `>>>>>>>` conflict markers.
3. Reconcile both sets of changes so both intents are preserved.
4. When both intents cannot coexist, favor the staging version and re-implement the ticket's intent on top.

## FILE-TYPE GUIDANCE
- **JSON files**: Carefully parse the structure around conflict markers. Merge array items and object keys from both sides. Ensure valid JSON after resolution.
- **Test files**: Include all test cases from both sides. Do not drop tests from either branch.
- **TypeScript/JavaScript source**: Merge imports from both sides. Ensure no duplicate imports or missing references.

## VERIFICATION
After resolving ALL files, verify no conflict markers remain by searching every resolved file for `<<<<<<<`, `=======`, and `>>>>>>>`. If any remain, fix them before finishing.

## CONSTRAINTS
- Do NOT modify files that are not listed in merge-conflicts.json.
- Do NOT re-implement the original ticket description — only resolve merge conflicts.
- Do NOT run scout, diagnosis, or planning steps — go straight to resolving conflicts in the source files.
- Only touch files with conflict markers or files listed in merge-conflicts.json.

## FALLBACK
If no `.helix/merge-conflicts.json` exists in a repo, the merge was clean for that repo — no changes needed.

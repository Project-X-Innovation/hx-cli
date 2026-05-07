# Product: hlx CLI Ergonomics Polish

## Problem Statement

The `hlx` CLI has four independent ergonomics gaps that degrade the developer experience:

1. **No ticket search**: There is no way to search tickets by title. Consumers must fetch every ticket and filter locally, which does not scale and forces each caller to reimplement filtering.
2. **Broken run display**: `hlx tickets get` shows placeholder text (`in progress` or `N/A`) instead of actual run timestamps, and misreports terminal run status. The API returns valid data; the CLI reads the wrong field names.
3. **No continuation preview**: `hlx tickets continue` immediately starts a run with no way to preview the resolved payload. Continuation prompts are easy to draft incorrectly, especially from agent contexts with fragile quoting.
4. **PowerShell quoting fragility**: `hlx inspect db` breaks under PowerShell when SQL contains quoted Postgres identifiers (e.g. `"Ticket"."ticketNumber"`). There is no unambiguous input mode that avoids shell quoting issues.

## Product Vision

Make the four most common `hlx` CLI friction points feel polished and reliable: searchable ticket lists, accurate run display, safe continuation previews, and cross-shell database inspection.

## Users

- **Developers** using the `hlx` CLI interactively to manage tickets, inspect runs, and query databases.
- **Agent/automation contexts** invoking `hlx` programmatically, where quoting, output parsing, and idempotent preview operations matter.
- **PowerShell users** (Windows developers) running `inspect db` with quoted SQL identifiers.

## Use Cases

| Use Case | Current Pain | Desired Outcome |
|----------|-------------|-----------------|
| Search for a ticket by title fragment | Must fetch all tickets, pipe to jq/grep, reimplement filtering per consumer | `hlx tickets list --search "deploy"` returns matches directly |
| Review a ticket's run history | Timestamps show `in progress`/`N/A`; SUCCEEDED runs appear as `in progress` | Accurate dates and status shown for all run states |
| Preview a continuation before triggering | No preview; incorrect context text starts a wasted run | `--dry-run` prints resolved payload without side effects |
| Run a quoted-identifier SQL query on PowerShell | Query fails with `relation "ticket" does not exist` | `--query-file` or documented `--query` form works on PS 5.1 and 7.x |

## Core Workflow

1. **Search** (`tickets list --search`): User provides a title fragment; CLI passes it as a query parameter; server filters and returns matches. Composes with `--json` for programmatic use.
2. **View** (`tickets get`): User views ticket detail with run history; timestamps and status render accurately from the API response fields.
3. **Preview + Continue** (`tickets continue --dry-run`): User previews the resolved continuation payload, verifies it, then re-runs without `--dry-run` to actually start the run.
4. **Query** (`inspect db`): User runs SQL via `--query`, `--query-file`, or positional arg; all forms work across Bash, Zsh, and PowerShell.

## Essential Features (MVP)

### F1: Server-side ticket search (`--search`)
- New `--search <text>` flag on `hlx tickets list`.
- Server performs case-insensitive title substring match (not client-side filtering).
- Composes with existing flags (`--archived`, `--status-not-in`, `--sprint`, `--user`, `--json`).
- Empty results return an empty list/table without error.

### F2: Accurate run display in `tickets get`
- CLI reads the correct API field names (`startedAt`/`finishedAt`) for run timestamps.
- Run status reflects actual terminal state (a `SUCCEEDED` run shows as succeeded).
- Absent timestamps render a clear placeholder (e.g. `--` or `not started`), never `Invalid Date`.

### F3: Dry-run mode for `tickets continue`
- New `--dry-run` flag on `hlx tickets continue`.
- Resolves the ticket reference, prints the continuation payload that would be sent, and exits 0.
- Must not start a run, create a run record, change ticket status, or write any artifact.
- Without the flag, behavior is identical to today.

### F4: PowerShell-safe `inspect db` ergonomics
- Add `--query-file <path>` option to read SQL from a file, bypassing all shell quoting.
- Update help text to make `--query` the documented canonical form.
- Help output includes a working PowerShell example with quoted Postgres identifiers (e.g. `"Ticket"."ticketNumber"`).
- Existing `--query` and positional invocations continue to work unchanged.

## Features Explicitly Out of Scope (MVP)

- Searching ticket comments, runs, or artifacts (title search only).
- Changing the API response format for runs (CLI field mapping fix only).
- Changing the underlying SQL execution path in `inspect db`.
- Editing existing continuation history.
- Full-text search or fuzzy matching (case-insensitive substring is sufficient).
- Database index changes for search (468 tickets; ILIKE is safe at this scale).

## Success Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| SC-1 | `hlx tickets list --search "<fragment>"` returns matching tickets | Run with a known title fragment; verify results contain match |
| SC-2 | `--search "no-such-text"` returns empty result without error | Run with non-matching text; verify exit 0 and empty output |
| SC-3 | `--search "..." --json` returns valid JSON | Pipe output through JSON parser |
| SC-4 | SUCCEEDED run shows correct status (not `in progress`) | `hlx tickets get` on a ticket with completed run |
| SC-5 | Run timestamps render as readable dates | Visual check of formatted output |
| SC-6 | Absent timestamps show clear placeholder, not `Invalid Date` | Check runs that haven't started |
| SC-7 | `--dry-run` prints payload and exits 0 without starting a run | Run with flag; verify no new run via `tickets get` |
| SC-8 | Without `--dry-run`, continue behaves as before | Regression check |
| SC-9 | `hlx inspect db --help` PowerShell example works with quoted identifiers | Execute documented example on PowerShell |
| SC-10 | `--query-file` reads SQL from file and executes | Create file with quoted-identifier SQL; run command |
| SC-11 | Existing `--query` invocations unchanged | Regression check |

## Key Design Principles

- **No behavior regressions**: All existing CLI invocations must continue to work identically.
- **Server-side filtering**: Search must not pull all records and filter client-side.
- **Dry-run safety**: Preview mode must be truly side-effect-free.
- **Cross-shell compatibility**: `inspect db` must work on Bash, Zsh, PS 5.1, and PS 7.x.
- **Smallest correct change**: Each of the four features is independent; changes should be isolated.

## Scope & Constraints

- **Two repos involved**: helix-cli (all four features) and helix-global-server (search endpoint only).
- **No database migration**: Server-side search uses Prisma's `contains` operator, which requires no schema change.
- **No new runtime dependencies**: helix-cli is zero-dependency; changes must stay that way.
- **Backward compatibility**: All existing command invocations and flags must remain functional.

## Future Considerations

- If ticket volume grows significantly beyond current ~468, a database index (GIN/trigram) on `Ticket.title` may become necessary for search performance.
- Server could expose `createdAt` from `SandboxRun` in addition to `startedAt`/`finishedAt` if callers need run creation time distinct from start time.
- Richer search (fuzzy matching, multi-field) could be added if simple substring proves insufficient.

## Open Questions / Risks

| Question/Risk | Context |
|--------------|---------|
| Should `--dry-run` output be JSON or human-readable? | Ticket says "prints the resolved continuation payload." JSON is more useful for agent contexts; human-readable is better for interactive use. Consider JSON with `--json` flag, human-readable by default. |
| PS 5.1 single-quote behavior for external commands | Single quotes pass literals correctly for external commands in PS 5.1, but edge cases with nested quotes may require explicit documentation or `--query-file` as the recommended path. |
| Ticket describes `Invalid Date` but code produces `in progress` | Diagnosis confirmed the actual symptom is `in progress`/`N/A` placeholders due to `undefined` field access, not `Invalid Date`. The root cause (wrong field names) is the same; the fix resolves both described and actual symptoms. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/scout-summary.md (helix-cli) | Understand analysis of all four CLI issues | All four issues independent; field name mismatch confirmed as root cause of run display bug |
| scout/scout-summary.md (helix-global-server) | Understand server-side search requirements | Prisma `contains` + `insensitive` mode sufficient; no migration needed |
| scout/reference-map.json (helix-cli) | Identify affected files and established patterns | 12 CLI files mapped; `readFileSync` pattern established for `--query-file` |
| scout/reference-map.json (helix-global-server) | Identify server files for search endpoint | Controller + service + schema mapped; no route changes needed |
| diagnosis/diagnosis-statement.md (helix-cli) | Confirm root causes for all four issues | Field name mismatch (createdAt/completedAt vs startedAt/finishedAt) confirmed with production data |
| diagnosis/diagnosis-statement.md (helix-global-server) | Confirm server scope is limited to search | Only search endpoint needs server change; run display is CLI-only |
| diagnosis/apl.json (helix-cli) | Detailed evidence for all four issues | Production run data confirms valid ISO dates exist; 468 tickets confirms ILIKE safety |
| diagnosis/apl.json (helix-global-server) | Server-side evidence for search | Controller parses 4 params, no search; Prisma where clause needs title filter |
| repo-guidance.json (helix-cli) | Confirm both repos are targets | helix-cli is primary target for all 4 issues; helix-global-server for search only |
| ticket.md | Requirements, acceptance criteria, non-negotiables | Server-side search required; dry-run must not mutate; existing behavior preserved |

# Product — Bug In Chaining (helix-cli)

## Problem Statement

Users and agents have no CLI mechanism to independently fetch a research report from a ticket. The only way research reports reach downstream workflows today is through `implementFromTicketId`-triggered inline injection by the orchestrator. When that injection fails (as it does for the 4 production tickets identified in this bug), there is no fallback. The user explicitly expects CLI to be one of several independent report access paths.

The server already has a functioning `GET /tickets/:ticketId/report` endpoint that returns report content. The CLI simply never wraps it, despite having the `hxFetch` utility for authenticated API calls and the `resolveTicketRef` utility for flexible ticket references.

## Product Vision

Research reports should be independently accessible through the CLI, giving users a direct way to fetch any ticket's report and providing agents with a potential fallback access path outside the orchestrator injection flow.

## Users

- **Helix platform users**: Users who want to read a research report from the command line without navigating the web UI.
- **Developers debugging chaining issues**: Users investigating why a downstream ticket ran with incorrect context (like BLD-444).
- **Agents (potential future use)**: If CLI becomes available in agent sandboxes, this command provides an independent report access path.

## Use Cases

1. **User fetches a report by short ID**: `hlx tickets report RSH-443` outputs the research report content for RSH-443.
2. **User checks a ticket with no report**: `hlx tickets report BLD-444` outputs a clear message that no report exists for this ticket.
3. **User uses ticket number**: `hlx tickets report 443` resolves the ticket and fetches the report.
4. **User pipes report output**: `hlx tickets report RSH-443 > report.md` saves the report content to a file.

## Core Workflow

1. User runs `hlx tickets report <ticket-ref>`.
2. CLI resolves the ticket reference via `resolveTicketRef` (supports short ID, number, or full ID).
3. CLI calls `GET /tickets/:ticketId/report` via `hxFetch`.
4. If a report exists, CLI outputs the report content (markdown) to stdout.
5. If no report exists, CLI outputs a clear message and exits with a non-error status.

## Essential Features (MVP)

1. **`hlx tickets report` subcommand**: Register a `report` subcommand under the `tickets` command group in `src/tickets/index.ts`.
2. **Report fetch and output**: Call `GET /tickets/:ticketId/report` via `hxFetch`, output `report.content` to stdout when present, output a clear "no report" message otherwise.
3. **Ticket reference resolution**: Use existing `resolveTicketRef` for flexible ticket reference input (short ID, number, full ID).

## Features Explicitly Out of Scope (MVP)

- Format conversion (e.g., rendering markdown to terminal with color/formatting).
- Saving to a specific file path (users can redirect stdout).
- Listing all available reports across tickets.
- Adding report content to the `hlx tickets get` output (separate concern).
- Exposing relationship fields (`afterTicketId`, `implementFromTicketId`) in `hlx tickets get` output.
- Ensuring CLI works in agent sandbox environments (depends on sandbox configuration outside this ticket's scope).

## Success Criteria

1. `hlx tickets report <ticket-ref>` outputs research report content for any ticket with a report.
2. `hlx tickets report <ticket-ref>` outputs a clear message when no report exists.
3. The command uses `resolveTicketRef` for flexible ticket reference input.
4. TypeScript typecheck and tests pass.

## Key Design Principles

- **Follow existing patterns**: The new command should match the structure of existing ticket subcommands (e.g., `get.ts`, `artifact.ts`).
- **Simple output**: Raw markdown content to stdout, matching how `artifact` outputs content.
- **Clear absence signaling**: When no report exists, output a human-readable message rather than failing silently or throwing an error.

## Scope & Constraints

- **Change target**: `src/tickets/index.ts` (register subcommand) and new `src/tickets/report.ts` (command implementation).
- **Server endpoint exists**: `GET /tickets/:ticketId/report` is already functional; no server changes needed.
- **Utilities available**: `hxFetch` for API calls, `resolveTicketRef` for ticket resolution, `getOrganizationId` for org context.
- **Test coverage**: Follow existing test patterns (e.g., `src/tickets/*.test.ts` if they exist).

## Future Considerations

- If CLI becomes available in agent sandboxes, this command provides agents an independent report access path, reducing dependence on orchestrator injection.
- The `hlx tickets get` command could be extended to show ticket relationships and mode, giving users visibility into chaining state.
- A `--json` flag could output structured report metadata (content, filename, generatedAt) for programmatic use.

## Open Questions / Risks

| Question | Context |
|----------|---------|
| Can agents use CLI commands during sandbox runs? | CLI utility for agents depends on sandbox environment configuration (CLI installation, auth credentials, network access). Value as user-facing tool is clear regardless. |
| Should the command exit with non-zero status when no report exists? | Matching `artifact` behavior is preferred; need to check what that command does when no artifact is found. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Scope and context for RSH-449 | User expects CLI as one of multiple independent report access paths |
| Continuation context | User guidance on report access expectations | "The agent can use the CLI to look it up" — explicit expectation for CLI report access |
| scout/scout-summary.md (helix-cli) | CLI architecture and available utilities | No report command exists; hxFetch and resolveTicketRef available; server endpoint wrappable |
| diagnosis/diagnosis-statement.md (helix-cli) | Confirmed gap and proposed fix | CLI lacks report command; server endpoint returns { report: { content, filename, generatedAt } } |
| diagnosis/apl.json (helix-cli) | Validated evidence | No report subcommand in index.ts; hxFetch available for authenticated API calls |
| repo-guidance.json | Repo intent and scope | helix-cli is a tertiary change target for the CLI report command |
| diagnosis/diagnosis-statement.md (helix-global-server) | Cross-repo context | Server-side auto-populate is the primary fix; CLI is an independent access path |

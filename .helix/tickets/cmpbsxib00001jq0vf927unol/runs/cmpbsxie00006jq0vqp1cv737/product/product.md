# Product Spec — RSH-493: Ticket Relationship Support in hlx CLI

## Problem Statement

CLI users cannot create tickets with dependency chains, cross-references, or research-implementation links. The web UI supports all three relationship types (`/after`, `#` references, `/implement`), but the CLI has zero support — meaning users who manage projects primarily through the CLI cannot break work into ordered ticket chains or link related work. Additionally, relationship data is invisible when viewing tickets via CLI, even if set through the UI.

## Product Vision

Give CLI users full parity with the web UI for ticket relationships: the ability to create dependency chains, add informational cross-references, and link research tickets at creation time, plus visibility into these relationships when viewing tickets.

## Users

- **CLI-primary users** who manage tickets, plan projects, and orchestrate work from the terminal.
- **Agent/automation workflows** that create tickets programmatically via `hlx tickets create` and need to chain dependent work.

## Use Cases

1. **Project decomposition**: A user breaks a project into multiple tickets and chains them with `--after` so each ticket starts only when its predecessor completes.
2. **Informational linking**: A user creates a ticket and references related tickets so reviewers can see broader context.
3. **Research-to-implementation**: A user creates an implementation ticket linked to a completed research ticket using `--implement-from`.
4. **Visibility**: A user runs `hlx tickets get` or `hlx tickets list` and sees which tickets depend on others or reference each other — without needing to switch to the web UI.

## Core Workflow

```
# Create a ticket that depends on another
hlx tickets create --title "Build API" --after RSH-490

# Create a ticket that references related work
hlx tickets create --title "Update docs" --reference RSH-490,RSH-491

# Create implementation from a research ticket
hlx tickets create --title "Implement caching" --implement-from RSH-485

# View dependency info on a ticket
hlx tickets get RSH-493
# Output shows: "Depends on: RSH-490 (Build API) — IN_PROGRESS"

# List tickets showing dependency indicators
hlx tickets list
# Output shows dependency marker for chained tickets
```

## Essential Features (MVP)

1. **`--after <ticket-ref>` flag** on `tickets create` — resolves the reference (shortId, ID, or number) and sends `afterTicketId` to the server.
2. **`--reference <ref1,ref2,...>` flag** on `tickets create` — resolves each reference and sends `referencedTicketIds` (max 5) to the server.
3. **`--implement-from <ticket-ref>` flag** on `tickets create` — resolves the reference and sends `implementFromTicketId` to the server.
4. **Relationship display in `tickets get`** — shows "Depends on", "Implements", and "References" sections when relationship data is present.
5. **Dependency indicator in `tickets list`** — shows a compact marker when a ticket has an `afterTicketId`.
6. **Clear error surfacing** — server validation errors (circular dependency, wrong ticket status, not found) are displayed in user-friendly CLI output.
7. **Documentation updates** — all help text, usage strings, and documentation surfaces (`cli-content.ts`, `SKILL.md`, `commands.md`) reflect the new flags.

## Features Explicitly Out of Scope (MVP)

- **Editing relationships on existing tickets** — this spec covers creation-time relationships only; updating relationships post-creation is a separate concern.
- **Interactive ticket picker** — flag values are passed as arguments, not through an interactive selection UI.
- **Graph visualization** — no dependency tree/graph rendering; just flat relationship display.
- **`saveToDraft` and `directorUserId` flags** — other unsupported server fields are not part of this ticket.
- **Server or client changes** — the server API and web UI already fully support all relationship types.

## Success Criteria

1. `hlx tickets create --after <ref>` successfully creates a ticket with a dependency chain; the server receives `afterTicketId`.
2. `hlx tickets create --reference <refs>` successfully creates a ticket with cross-references; the server receives `referencedTicketIds`.
3. `hlx tickets create --implement-from <ref>` successfully creates a ticket linked to a research ticket; the server receives `implementFromTicketId`.
4. `hlx tickets get <ref>` displays relationship data (Depends on, Implements, References) when present.
5. `hlx tickets list` shows a dependency indicator for tickets with `afterTicketId`.
6. Server validation errors are surfaced clearly (not raw JSON or stack traces).
7. All documentation surfaces are updated.
8. Build (`tsc`), typecheck (`tsc --noEmit`), and tests pass.

## Key Design Principles

- **Parity, not novelty**: match the web UI's relationship capabilities without introducing new relationship types.
- **Existing patterns**: use the established `resolveTicket()` utility and `getFlag()`/`requireFlag()` patterns — no new abstractions.
- **Minimal surface**: add only the three flags needed; keep the create command's existing behavior unchanged when flags are omitted.
- **Fail clearly**: resolve ticket references eagerly before the POST so users get clear errors for invalid references.

## Scope & Constraints

- **Single-repo change**: only `helix-cli` requires code changes. Server and client are reference context only.
- **Server contract is fixed**: the CLI must conform to the existing server Zod schema (`afterTicketId`: optional string; `referencedTicketIds`: optional array of max 5 strings; `implementFromTicketId`: optional string).
- **Reference resolution**: ticket refs must support the same formats `resolveTicket()` handles: internal ID, shortId (e.g., RSH-490), and numeric ticket number.
- **No new dependencies**: helix-cli has minimal deps (only `@types/node` and `typescript`); this should remain true.

## Future Considerations

- Editing relationships on existing tickets (e.g., `hlx tickets update --after <ref>`).
- Batch ticket creation with dependency chaining in a single command.
- Dependency tree visualization for project planning.
- Additional create-time fields (`saveToDraft`, `directorUserId`) if user demand emerges.

## Open Questions / Risks

| Question | Impact |
|----------|--------|
| What is the exact shape of server error responses for relationship validation failures (circular dependency, wrong status, not found)? | Determines how the CLI formats user-facing error messages. May need runtime verification during implementation. |
| Does the list endpoint return `afterTicketId` on every item, or only when populated? | Affects whether the list view can reliably show dependency indicators without extra API calls. Diagnosis evidence (ticket-service.ts:1500-1533) suggests it is returned per item. |
| Should `--reference` accept space-separated args or comma-separated? | UX decision. Comma-separated is simpler and avoids shell quoting issues; recommend comma-separated. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli) | Ticket description and requirements | CLI lacks relationship/reference capabilities present in the UI |
| `scout/scout-summary.md` (helix-cli) | Comprehensive scout analysis | Server API ready; CLI has complete gap; existing resolveTicket() utility is reusable |
| `scout/reference-map.json` (helix-cli) | Structured file map, facts, and unknowns | Confirmed all affected files, server schema shape, and open questions |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause and evidence-backed success criteria | Feature gap (not bug); single-repo fix; server responses confirmed to include relationship data |
| `diagnosis/apl.json` (helix-cli) | Diagnosis questions, answers, and evidence links | Confirmed no cross-repo changes needed; resolveTicket() pattern applicable |

# Product Specification: Ticket Relationship Support in hlx CLI

## Problem Statement

CLI-primary users and automation workflows cannot create tickets with dependency chains, cross-references, or research-to-implementation links. They also cannot see any relationship data when viewing or listing tickets. These capabilities are fully available in the web UI, creating a significant feature gap that blocks users who manage projects through the CLI from decomposing work into ordered sequences or linking related tickets.

## Product Vision

Bring the `hlx` CLI to parity with the web UI for ticket relationship management. Users should be able to create tickets with relationships and view relationship data in ticket details and lists, using the same intuitive reference formats they already use for other CLI commands.

## Users

- **CLI-primary developers** who create and manage tickets from the terminal rather than the web UI.
- **Automation scripts and CI pipelines** that create tickets programmatically and need to set up dependency chains or cross-references.
- **Project leads** who decompose projects into ordered ticket sequences from the command line.

## Use Cases

1. **Dependency chaining**: A user creates a ticket that should run only after a predecessor completes (e.g., "build API endpoints" after "set up database schema").
2. **Cross-referencing**: A user creates a ticket and links it to related tickets for context (e.g., "update docs" references the API and schema tickets).
3. **Research-to-implementation**: A user creates an implementation ticket linked to a completed research ticket, carrying forward the research report as specification.
4. **Viewing relationships**: A user runs `tickets get` and sees which ticket it depends on, implements from, or references.
5. **Scanning dependencies in list view**: A user runs `tickets list` and immediately sees which tickets are blocked on predecessors.

## Core Workflow

1. User runs `hlx tickets create` with optional `--after`, `--reference`, and/or `--implement-from` flags, using ticket short IDs (e.g., `RSH-490`) or other supported reference formats.
2. CLI resolves each reference to an internal ticket ID (using the existing `resolveTicket` utility) and includes the resolved IDs in the create request.
3. Server validates relationships (existence, org membership, status constraints, circular dependency detection) and returns clear error messages on failure.
4. CLI surfaces server validation errors directly to the user.
5. When viewing tickets (`tickets get`, `tickets list`), relationship data is displayed alongside existing ticket information.

## Essential Features (MVP)

| Feature | Description |
|---------|-------------|
| `--after <ticket-ref>` flag | Create a ticket that depends on a predecessor. Ticket starts as WAITING until predecessor completes. |
| `--reference <ref1,ref2>` flag | Attach up to 5 informational cross-references (comma-separated). Does not affect scheduling. |
| `--implement-from <ticket-ref>` flag | Link to a completed RESEARCH ticket with REPORT_READY status. |
| Detail view relationships | `tickets get` shows "Depends on", "Implements", and "References" lines when present. |
| List view dependency indicator | `tickets list` appends `[after RSH-XXX]` to tickets with a dependency. |
| Server error surfacing | Validation errors (circular deps, wrong status, not found) display clearly in the terminal. |
| Help text updates | Usage strings for `tickets create` include the new flags. |
| Documentation updates | CLI docs, skill docs, and command reference reflect the new flags with examples. |

## Features Explicitly Out of Scope (MVP)

| Feature | Reason |
|---------|--------|
| Editing relationships on existing tickets | Requires a new server PATCH endpoint; separate feature. |
| Batch ticket creation with chaining (e.g., YAML plan import) | Builds on individual flags; future enhancement. |
| Batch reference resolution (performance optimization) | Sequential resolution is acceptable for ticket creation; optimize later if needed. |
| Interactive ticket picker for references | UX enhancement; users can use short IDs for now. |
| Dependency tree visualization (`tickets deps` command) | New command; separate feature scope. |
| Changes to helix-global-server or helix-global-client | Server API already supports all relationship fields; web UI already renders them. |

## Success Criteria

1. `hlx tickets create --after RSH-490 ...` correctly creates a ticket with `afterTicketId` set to the resolved ID.
2. `hlx tickets create --reference RSH-490,RSH-491 ...` creates a ticket with up to 5 resolved `referencedTicketIds`.
3. `hlx tickets create --implement-from RSH-485 ...` creates a ticket with `implementFromTicketId` set to the resolved ID.
4. All three flags are optional and can be combined with each other and existing flags.
5. Ticket references resolve correctly using internal IDs, short IDs, and numeric ticket numbers.
6. Server validation errors (circular dependency, wrong status, not found, wrong mode) display as clear, actionable messages.
7. `hlx tickets get <ref>` displays relationship sections only when relationship data is present.
8. `hlx tickets list` shows `[after <shortId>]` tag on tickets with a dependency.
9. Help text and all documentation surfaces include the new flags with usage examples.
10. TypeScript compilation (`tsc --noEmit`) passes with no errors.
11. All existing tests continue to pass.
12. No new runtime dependencies are introduced.
13. Tickets without relationships display identically to current behavior (no regressions).

## Key Design Principles

- **Follow existing patterns**: The new flags use the same resolve-then-use pattern as `--repos`, the same `getFlag()` utility, and the same error handling approach.
- **Minimal surface area**: Three optional flags on one existing command; conditional display additions on two existing commands. No new commands.
- **Server-authoritative validation**: The CLI resolves references and passes them to the server, which handles all constraint validation. The CLI surfaces server errors directly rather than duplicating validation logic.
- **Zero additional API calls for display**: The server already returns relationship data in both detail and list responses, so viewing commands need only type extensions and rendering additions.

## Scope & Constraints

- **Single-repo change**: Only `helix-cli` requires modifications. `helix-global-server` and `helix-global-client` are reference context only.
- **7 files changed**: `create.ts`, `get.ts`, `list.ts`, `index.ts`, `cli-content.ts`, `SKILL.md`, `commands.md`.
- **No new dependencies**: Uses existing `resolveTicket()`, `getFlag()`, and `hxFetch()` utilities.
- **Comma-separated references**: `--reference` uses comma separation to match the existing `--repos` flag convention.

## Future Considerations

- Editing relationships post-creation via `tickets update` (requires server endpoint).
- Batch creation from a project plan file.
- Performance optimization via batch reference resolution if users report slowness with many references.
- Interactive fuzzy-search ticket picker for reference selection.
- `tickets deps` command for dependency tree visualization.

## Open Questions / Risks

| Question | Context |
|----------|---------|
| Does `hxFetch` error message format reliably include the JSON body for 400 responses? | `buildErrorMessage` in `http.ts` appends `response.text()` to the error. Static inspection suggests this works, but runtime verification during implementation is recommended. |
| Have server response field line numbers drifted since the research report? | Research report cites specific lines in `ticket-service.ts`. Implementation should verify actual response shapes rather than relying on line numbers. |
| Should tests be added for the new flag parsing and display logic? | Existing tests cover `resolveTicket()` and `getFlag()` utilities but not command functions. Adding integration-style tests for the new flags would improve confidence but is not mandated by the research report. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli run root) | Primary specification via Research Report section | Single-repo change: 3 new flags on create, relationship display on get/list, 7 files, server API ready. |
| `scout/scout-summary.md` (helix-cli) | Verified scope, file inventory, and reuse points | 7 target files confirmed against HEAD. resolveTicket() and getFlag() available. Quality gates: tsc, tsc --noEmit, node --test. |
| `scout/reference-map.json` (helix-cli) | Detailed facts, file roles, and unknowns | Zero existing relationship support. Server Zod schema verified. hxFetch error format supports extraction. |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause and success criteria from diagnosis | Feature gap: relationship fields never implemented. 11 success criteria defined. |
| `diagnosis/apl.json` (helix-cli) | Structured Q&A confirming scope and feasibility | Confirmed single-repo change, server API ready, utilities available, error format supports surfacing. |
| `/tmp/helix-inspect/manifest.json` | Checked runtime inspection availability | Available for helix-global-server (DATABASE, LOGS). Not needed for this CLI-only feature gap. |

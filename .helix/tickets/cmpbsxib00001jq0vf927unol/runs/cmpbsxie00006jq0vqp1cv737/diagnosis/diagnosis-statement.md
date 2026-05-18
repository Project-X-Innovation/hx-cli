# Diagnosis Statement — RSH-493: hlx CLI doesn't include after or other ticket reference

## Problem Summary

The `hlx tickets create` command cannot create tickets with dependency chains (`afterTicketId`), informational cross-references (`referencedTicketIds`), or research-implementation links (`implementFromTicketId`). The web UI provides all three via `/after`, `#`, and `/implement` interaction patterns, but the CLI has zero support for any of them. Additionally, `hlx tickets get` and `hlx tickets list` do not render relationship data, making dependency relationships invisible to CLI users.

## Root Cause Analysis

The root cause is a **feature gap** in the helix-cli, not a bug. When `create.ts` was implemented, only the minimum required fields were wired into the POST body: `{ title, description, repositoryIds, mode }` (lines 89-93). The three optional relationship fields that the server API already accepts were never added to the CLI.

The gap extends to the display side: `TicketDetail` type in `get.ts` (lines 5-23) and `TicketItem` type in `list.ts` (lines 5-12) both omit relationship fields entirely, even though the server already returns them in its API responses.

Key evidence:

1. **Server is ready**: `createTicketSchemaGeneral` in `ticket-controller.ts` (lines 29-40) accepts `afterTicketId`, `referencedTicketIds`, and `implementFromTicketId`. Server-side validation includes same-org checks, circular dependency detection (up to 20 ancestors), predecessor status guards, and RESEARCH/REPORT_READY requirements.

2. **CLI has zero support**: Grep for `afterTicketId|referencedTicketIds|implementFromTicketId` across the entire helix-cli codebase returns zero matches.

3. **Existing patterns available**: `resolveTicket()` in `resolve-ticket.ts` already resolves ticket references (ID, shortId, number) against the API — the same pattern needed for `--after` and `--reference` flag value resolution.

4. **Server responses include relationship data**: `getTicketDetailForOrganization` (lines 1789-1828) returns `afterTicket`, `implementFromTicket`, and `referencedTickets` as nested objects with id, title, status, shortId. The list endpoint also returns `afterTicketId` per item.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| CLI create POST body | `helix-cli/src/tickets/create.ts:89-93` | Only sends title, description, repositoryIds, mode |
| Server Zod schema | `helix-global-server/src/controllers/ticket-controller.ts:29-40` | Accepts afterTicketId, referencedTicketIds (max 5), implementFromTicketId |
| Server afterTicketId validation | `helix-global-server/src/services/ticket-service.ts:689-736` | Same-org check, status guard, circular walk (20 depth), WAITING/QUEUED status setting |
| Server implementFromTicketId validation | `helix-global-server/src/services/ticket-service.ts:668-685` | RESEARCH mode + REPORT_READY status required |
| Server referencedTicketIds validation | `helix-global-server/src/services/ticket-service.ts:760-777` | All IDs must exist in same org |
| Server detail response | `helix-global-server/src/services/ticket-service.ts:1789-1828` | Returns afterTicket, implementFromTicket, referencedTickets (nested objects) |
| Server list response | `helix-global-server/src/services/ticket-service.ts:1500-1533` | Returns afterTicketId per item |
| CLI get display type | `helix-cli/src/tickets/get.ts:5-23` | TicketDetail type omits all relationship fields |
| CLI list display type | `helix-cli/src/tickets/list.ts:5-12` | TicketItem type omits relationship fields |
| Existing ticket resolver | `helix-cli/src/lib/resolve-ticket.ts:86-167` | resolveTicket() resolves ID/shortId/number — reusable for flag values |
| CLI flag utilities | `helix-cli/src/lib/flags.ts` | getFlag/requireFlag pattern available for new flags |
| Client API types | `helix-global-client/src/types/api.ts:379-390` | CreateTicketRequest includes afterTicketId, implementFromTicketId |
| Client detail view | `helix-global-client/src/routes/ticket-detail.tsx:2117-2144` | Renders Related Tickets with afterTicket, implementFromTicket, referencedTickets |
| No CLI relationship code | Grep across helix-cli | Zero matches for afterTicketId, referencedTicketIds, implementFromTicketId |

## Success Criteria

1. `hlx tickets create` supports `--after <ticket-ref>` flag that resolves the reference and sends `afterTicketId` in the POST body.
2. `hlx tickets create` supports `--reference <ref1,ref2,...>` flag that resolves each reference and sends `referencedTicketIds` in the POST body (max 5).
3. `hlx tickets create` supports `--implement-from <ticket-ref>` flag that resolves the reference and sends `implementFromTicketId` in the POST body.
4. `hlx tickets get` displays relationship data (Depends on, Implements, References sections) when present on a ticket.
5. `hlx tickets list` shows a dependency indicator when a ticket has an `afterTicketId`.
6. All help text, usage strings, and documentation (`cli-content.ts`, `SKILL.md`, `commands.md`) are updated to document the new flags.
7. Server error messages for validation failures (circular dependency, wrong status, not found) are surfaced clearly to the CLI user.
8. Build (`tsc`), typecheck (`tsc --noEmit`), and tests pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli) | Ticket description and scope | CLI lacks ticket relationship capabilities that exist in the UI |
| `scout/reference-map.json` (helix-cli) | Scout findings on relevant files, facts, unknowns | Mapped all affected files and confirmed server API readiness |
| `scout/scout-summary.md` (helix-cli) | Scout analysis summary | Confirmed complete gap in CLI; server and client already support all relationships |
| `helix-cli/src/tickets/create.ts` | Direct inspection of create command | POST body at lines 89-93 sends only { title, description, repositoryIds, mode } |
| `helix-cli/src/tickets/get.ts` | Direct inspection of get command | TicketDetail type (lines 5-23) and printTicketDetail omit relationship fields |
| `helix-cli/src/tickets/list.ts` | Direct inspection of list command | TicketItem type (lines 5-12) omits relationship fields |
| `helix-cli/src/tickets/index.ts` | Ticket subcommand router | Usage text and help for create omit relationship flags |
| `helix-cli/src/lib/resolve-ticket.ts` | Ticket resolution utility | resolveTicket() already resolves ID/shortId/number — reusable pattern |
| `helix-cli/src/lib/flags.ts` | Flag parsing utilities | getFlag/requireFlag pattern for new flags |
| `helix-cli/src/docs/cli-content.ts` | CLI documentation export | tickets create flags table omits relationship flags |
| `helix-cli/skill-content/references/commands.md` | Command reference docs | tickets create section omits relationship flags |
| `helix-global-server/src/controllers/ticket-controller.ts` | Server API Zod schema | Confirmed afterTicketId, referencedTicketIds, implementFromTicketId accepted |
| `helix-global-server/src/services/ticket-service.ts` | Server validation and response logic | Confirmed validation rules and response shapes for both detail and list |
| `helix-global-client/src/types/api.ts` | Client API types | Confirmed CreateTicketRequest shape matches server schema |
| `helix-global-client/src/routes/ticket-detail.tsx` | Client ticket detail rendering | Confirmed UI renders Related Tickets section with all three relationship types |

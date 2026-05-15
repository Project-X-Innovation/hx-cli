# Scout Summary — helix-cli

## Problem

The CLI displays raw `ticket.status` (e.g., `PREVIEW_READY`) in both `hlx tickets get` and `hlx tickets list` commands. There is no indication when a ticket is pending peer approval. No CLI commands exist for the peer approval workflow.

## Analysis Summary

### Status Display in CLI

The `hlx tickets get` command (get.ts lines 46-83) prints `Status: ${ticket.status}` (line 52) and optionally `Merge Status: ${ticket.mergeQueueStatus}` (lines 57-59). The `TicketDetail` type (lines 5-22) has `status: string` and `mergeQueueStatus: string | null` but no approval-related fields.

The `hlx tickets list` command (list.ts lines 38-107) prints `ticket.status.padEnd(12)` (line 105). The `TicketItem` type (lines 5-12) has `status: string` but no approval field.

### Missing CLI Capabilities

No commands exist in `src/tickets/index.ts` (subcommand registry) for:
- Submitting a defense (approval request)
- Approving/flagging a defense
- Viewing approval status for a ticket

### Dependency on Server API

The CLI fetches ticket data from `GET /api/tickets/:ticketId` (get.ts line 47) and `GET /api/tickets` (list.ts line 75). These endpoints do not currently include approval data. Any CLI improvement depends on the server exposing approval status in these responses.

## Relevant Files

| File | Role |
|------|------|
| `src/tickets/get.ts` | `hlx tickets get` — detail display with no approval info |
| `src/tickets/list.ts` | `hlx tickets list` — list display with no approval info |
| `src/tickets/index.ts` | Ticket subcommand definitions — no approval commands |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement | Approval status must be visible across all surfaces including CLI |
| src/tickets/get.ts | CLI detail command | Prints status and mergeQueueStatus; no approval field in type |
| src/tickets/list.ts | CLI list command | Prints status; no approval awareness |
| src/tickets/index.ts | Command registry | No approval subcommands registered |

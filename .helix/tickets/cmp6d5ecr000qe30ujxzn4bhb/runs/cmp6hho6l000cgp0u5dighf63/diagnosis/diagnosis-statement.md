# Diagnosis Statement — helix-cli

## Problem Summary

The CLI displays raw `ticket.status` (e.g., `PREVIEW_READY`) with no indication of peer approval state in both `hlx tickets get` and `hlx tickets list`. The CLI types do not include any approval-related fields, and the server currently does not include this data in its responses.

## Root Cause Analysis

The CLI's `TicketDetail` type (get.ts lines 5-22) and `TicketItem` type (list.ts lines 5-12) both have `status: string` but no approval field. The `hlx tickets get` command prints `Status: ${ticket.status}` (line 52) and `hlx tickets list` prints `ticket.status.padEnd(12)` (line 105). Since the server does not currently include approval data in the ticket list/detail API responses, the CLI has no data to display even if it wanted to.

**Approach**: Once the server adds `approvalStatus` to ticket responses:
1. Add `approvalStatus?: string` to `TicketDetail` and `TicketItem` types.
2. In `hlx tickets get`, display approval status when present (e.g., `Approval:   PENDING`).
3. In `hlx tickets list`, incorporate approval status into the display — either by blending it with the status column or adding a brief indicator.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| src/tickets/get.ts lines 5-22 | TicketDetail has status, mergeQueueStatus — no approval field |
| src/tickets/get.ts line 52 | Prints raw status with no approval context |
| src/tickets/list.ts lines 5-12 | TicketItem has status only — no approval field |
| src/tickets/list.ts line 105 | Prints ticket.status padded, no approval indicator |

## Success Criteria

1. `hlx tickets get` displays approval status when the ticket has a pending, approved, or needs-defense approval request.
2. `hlx tickets list` shows an approval indicator for tickets awaiting approval.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement | Approval status must be visible across all surfaces including CLI |
| scout/reference-map.json (CLI) | File map | Identified get.ts and list.ts as change targets |
| scout/scout-summary.md (CLI) | Analysis | Confirmed no approval fields in types, CLI depends on server API changes |
| src/tickets/get.ts | Direct inspection | Verified TicketDetail type and display code lack approval |
| src/tickets/list.ts | Direct inspection | Verified TicketItem type and display code lack approval |

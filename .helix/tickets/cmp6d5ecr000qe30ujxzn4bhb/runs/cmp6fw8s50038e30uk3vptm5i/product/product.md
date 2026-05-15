# Product Specification — Peer Approval Status Visibility & Auto-Enqueue

**Ticket**: FIX-468 — Peer Approval status

## Problem Statement

When a ticket has peer approval enabled and a defense has been submitted, the ticket status shows "Preview ready" across every surface — dashboard, board, CLI, and notifications. The only signal that approval is pending is a one-time notification that is easy to miss. Users cannot scan their ticket list and identify which tickets are blocked on peer approval versus ready to merge.

Separately, after a peer grants approval, the ticket owner must manually navigate back to the ticket detail page and click the merge button. This is unnecessary friction: submitting a defense already signals merge intent, so the system should automatically enqueue the ticket once approval is granted.

## Product Vision

Make peer approval status a first-class, always-visible dimension across every ticket surface. Eliminate the manual merge step after approval so that the approval workflow feels like a gate — not a dead-end requiring re-engagement.

## Users

| User | Need |
|------|------|
| **Ticket owner** | Know at a glance which of my tickets are blocked on approval vs. ready to merge, without opening each one |
| **Peer reviewer / approver** | Understand quickly which tickets in the org need my attention |
| **Team lead / manager** | See workflow bottlenecks at the board/dashboard level — how many tickets are waiting on approval? |

## Use Cases

1. **Ticket owner scans dashboard**: Sees amber "Pending approval" badge on tickets awaiting peer review, distinct from green "Preview ready" on merge-ready tickets.
2. **Approver checks board**: Identifies approval-blocked tickets at a glance in the board columns.
3. **CLI user lists tickets**: `hlx tickets list` and `hlx tickets get` display approval status inline, so the user doesn't need to open the web UI.
4. **Approval granted, auto-proceed**: A peer approves a defense. The ticket is automatically enqueued for staging merge without the owner lifting a finger.
5. **Approval denied / needs defense**: Status updates to reflect the ticket needs attention, visible from list views.

## Core Workflow

```
1. Owner submits defense  -->  Ticket stays PREVIEW_READY
                                + approvalStatus = PENDING
                                  (visible in dashboard, board, CLI)

2. Peer responds:
   a. APPROVED   -->  approvalStatus = APPROVED
                      + auto-enqueue for staging merge
   b. NEEDS_DEFENSE  -->  approvalStatus = NEEDS_DEFENSE
                           (visible; owner must resubmit)

3. Dashboard/board/CLI always reflect the current approvalStatus
   alongside the ticket pipeline status.
```

## Essential Features (MVP)

1. **Approval status in ticket list API**: The `GET /tickets` response includes the latest `approvalStatus` (null | PENDING | APPROVED | NEEDS_DEFENSE) for each ticket.
2. **Dashboard & board show approval state**: Tickets at `PREVIEW_READY` with `PENDING` approval display an amber "Pending approval" badge instead of the green "Preview ready" badge.
3. **CLI shows approval state**: `hlx tickets get` and `hlx tickets list` display approval status when present.
4. **Auto-enqueue on approval**: When a peer responds with APPROVED and the request transitions to APPROVED, the server automatically enqueues the ticket for staging merge (best-effort; failures do not block the approval response).

## Features Explicitly Out of Scope (MVP)

- **New CLI approval workflow commands** (submit defense, approve, respond from CLI) — this ticket is about status visibility and auto-enqueue, not adding full CLI approval operations.
- **New TicketStatus enum value** — approval is an orthogonal dimension to the pipeline status and should not be conflated with QUEUED/RUNNING/PREVIEW_READY/etc.
- **Email or Slack notification changes** — existing notification mechanisms are unchanged; this ticket adds persistent visual indicators, not new push channels.
- **Approval workflow for FIX-mode tickets** — FIX-mode already bypasses the approval gate.
- **Retroactive approval status backfill** — only newly-submitted/updated approval requests will appear.

## Success Criteria

| # | Criterion | Measurable |
|---|-----------|------------|
| 1 | Ticket list API includes `approvalStatus` field for each ticket when the org has peer approval enabled | Field present in `GET /tickets` response |
| 2 | Dashboard and board display amber "Pending approval" for PREVIEW_READY + PENDING tickets | Visual badge change; green "Preview ready" only when no pending approval |
| 3 | CLI `hlx tickets get` shows approval line (e.g., `Approval: PENDING`) | Present in CLI output when approval exists |
| 4 | CLI `hlx tickets list` includes approval indicator | Visible in list output |
| 5 | Approving a defense automatically enqueues the ticket for staging merge | No manual merge click needed after approval |
| 6 | Auto-enqueue failure does not block the approval response | Approval succeeds even if enqueue fails (e.g., already in queue) |

## Key Design Principles

- **Approval is a separate dimension**: Do not add a new TicketStatus enum value. Keep approval status as a joined/computed field alongside the existing pipeline status.
- **Server-driven**: Auto-enqueue is entirely server-side. The client reflects state changes through normal data fetching.
- **Best-effort side effects**: Auto-enqueue after approval is best-effort. The approval response must always succeed; enqueue errors are handled gracefully.
- **Minimal surface changes**: Dashboard and board pick up the new status through the existing StatusBadge pipeline — no component restructuring.

## Scope & Constraints

- **Three repos touched**: Server (API + auto-enqueue), client (types + display), CLI (types + display).
- **Server is the primary driver**: Client and CLI are downstream consumers of the new `approvalStatus` field.
- **Feature-gated**: Peer approval is gated by `Organization.peerApprovalEnabled` (default false). Changes only affect orgs with the feature enabled.
- **No schema migration**: No new database columns or enum values. Approval status is derived by joining the existing `ApprovalRequest` table.

## Future Considerations

- Full CLI approval workflow commands (submit defense, respond to approval) as a separate enhancement.
- Board column or filter for "Pending approval" tickets specifically.
- Approval SLA tracking (time-in-pending metrics).
- Bulk approval views for approvers with many pending requests.

## Open Questions / Risks

| # | Question / Risk |
|---|-----------------|
| 1 | **Auto-enqueue edge cases**: What happens if auto-enqueue fires but the ticket has no changed repos or is already in the queue? Diagnosis recommends best-effort (log and continue), but the exact error-handling UX for the ticket owner is undefined. |
| 2 | **Defense submission = merge intent?**: Should submitting a defense always imply "enqueue as soon as approved"? Currently assumed yes, but there may be cases where a user wants approval without auto-merge. |
| 3 | **Multiple approval rounds**: If a ticket goes PENDING -> NEEDS_DEFENSE -> PENDING again (resubmitted defense), does the latest approval status always reflect the most recent request? Diagnosis says yes (uses latest ApprovalRequest), but edge cases need testing. |
| 4 | **Runtime inspection limitation**: Database query permissions were denied for the ApprovalRequest table, so production usage patterns (how many tickets are currently pending approval) could not be verified. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-global-server) | Problem statement and requirements | Two distinct issues: invisible approval status and no auto-enqueue after approval |
| scout/scout-summary.md (helix-global-server) | Server analysis | Approval data absent from ticket list API; no post-approval side effect in controller |
| scout/reference-map.json (helix-global-server) | Server file map and evidence | Confirmed approval gate in enqueueForStaging would pass for auto-enqueue |
| diagnosis/diagnosis-statement.md (helix-global-server) | Root cause analysis | RC1: missing approval join in ticket list query; RC2: no auto-enqueue trigger |
| diagnosis/apl.json (helix-global-server) | Structured diagnosis answers | Confirmed TicketStatus has no approval value; approval is a separate model |
| scout/scout-summary.md (helix-global-client) | Client analysis | Mapped full display pipeline: format.ts -> StatusBadge -> dashboard/board |
| scout/reference-map.json (helix-global-client) | Client file map | Identified format.ts, StatusBadge, api.ts types as change targets |
| diagnosis/diagnosis-statement.md (helix-global-client) | Client root cause | StatusBadge pipeline lacks approval awareness; changes flow through existing pipeline |
| diagnosis/apl.json (helix-global-client) | Client structured diagnosis | Auto-enqueue is server-side; client just reflects updated state |
| scout/scout-summary.md (helix-cli) | CLI analysis | CLI types and display lack approval fields; depends on server API changes |
| scout/reference-map.json (helix-cli) | CLI file map | get.ts and list.ts are change targets |
| diagnosis/diagnosis-statement.md (helix-cli) | CLI root cause | CLI needs approvalStatus field in types and conditional display lines |
| diagnosis/apl.json (helix-cli) | CLI structured diagnosis | No new CLI commands needed — scope is status visibility only |
| repo-guidance.json | Repo intent mapping | All three repos are targets: server (primary), client, CLI |
| Runtime logs (helix-global-server) | Production evidence attempt | DB permission denied for ApprovalRequest; logs showed only workflow activity |

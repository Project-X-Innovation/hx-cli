# Implementation Plan — Peer Approval Status Visibility (helix-cli)

**Ticket**: FIX-468 — Peer Approval status

## Overview

Add approval status display to the CLI `hlx tickets get` and `hlx tickets list` commands. The approval status is a new optional field from the server API response. Display as a separate "Approval:" line in `get` (matching the existing `mergeQueueStatus` pattern) and as a brief indicator in `list`. Two files changed: `get.ts` and `list.ts`.

## Implementation Principles

- **Follow existing patterns**: The `mergeQueueStatus` conditional line in `get.ts` (lines 57-59) is the exact pattern to replicate for approval status.
- **Optional and backward compatible**: The `approvalStatus` field is typed as optional; CLI gracefully handles its absence (older server versions).
- **No new commands**: Scope is status visibility only, not full approval workflow CLI operations.
- **JSON output automatic**: The `--json` flag outputs the raw server response, so `approvalStatus` appears automatically.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| L1 | Add approvalStatus to TicketDetail type and display in get | Modified `src/tickets/get.ts` |
| L2 | Add approvalStatus to TicketItem type and indicator in list | Modified `src/tickets/list.ts` |
| L3 | Quality gates | Pass typecheck |

## Detailed Implementation Steps

### Step L1: Add approvalStatus to TicketDetail type and display in get

**Goal**: Show approval status in `hlx tickets get` output when present.

**What to Build**:
- File: `src/tickets/get.ts`
- Add to `TicketDetail` type (lines 5-22):
  ```
  approvalStatus: string | null;
  ```
  Place after `mergeQueueStatus` (line 20).
- In `printTicketDetail` (lines 46-83), add after the `mergeQueueStatus` conditional (lines 57-59):
  ```
  if (ticket.approvalStatus) {
    console.log(`Approval:     ${ticket.approvalStatus}`);
  }
  ```
  This follows the exact same pattern as the mergeQueueStatus display.

**Verification (AI Agent Runs)**:
1. `cd /vercel/sandbox/workspaces/cmp6d5ed3000ve30u4tan6py4/helix-cli && npx tsc --noEmit` — must pass.

**Success Criteria**:
- `TicketDetail` type includes `approvalStatus: string | null`.
- `printTicketDetail` conditionally displays "Approval:" line when present.

---

### Step L2: Add approvalStatus to TicketItem type and indicator in list

**Goal**: Show approval indicator in `hlx tickets list` output when present.

**What to Build**:
- File: `src/tickets/list.ts`
- Add to `TicketItem` type (lines 5-12):
  ```
  approvalStatus: string | null;
  ```
  Place after `updatedAt` (line 10) or at the end.
- In `cmdTicketsList` (line 105), modify the list output to include a brief approval indicator when `approvalStatus` is present. Append to the existing console.log:
  ```
  const approvalTag = ticket.approvalStatus ? ` [${ticket.approvalStatus}]` : "";
  console.log(`${ticket.shortId}  ${idAbbr}  ${ticket.status.padEnd(12)}  ${reporter.padEnd(20)}  ${updated}  ${ticket.title}${approvalTag}`);
  ```

**Verification (AI Agent Runs)**:
1. `cd /vercel/sandbox/workspaces/cmp6d5ed3000ve30u4tan6py4/helix-cli && npx tsc --noEmit` — must pass.

**Success Criteria**:
- `TicketItem` type includes `approvalStatus: string | null`.
- List output appends `[PENDING]`, `[APPROVED]`, or `[NEEDS_DEFENSE]` when present.
- No indicator shown when `approvalStatus` is null.

---

### Step L3: Quality gates

**Goal**: Ensure all changes pass the project's quality gates.

**What to Build**: No code changes. Run quality gates.

**Verification (AI Agent Runs)**:
1. `cd /vercel/sandbox/workspaces/cmp6d5ed3000ve30u4tan6py4/helix-cli && npx tsc --noEmit` — typecheck.

**Success Criteria**:
- Zero typecheck errors.

---

## Cross-Repo Coordination

- CLI changes depend on the server adding `approvalStatus` to `GET /api/tickets` and `GET /api/tickets/:id` responses (server steps S1 and S2).
- The `approvalStatus` field on CLI types is non-optional (`string | null`) since the server will always include it. Older server versions without the field will pass `undefined` from JSON parsing, which is falsy and the conditional display will simply not trigger.
- No new CLI commands are added. This is status visibility only.

## Verification Plan

### Pre-conditions

| # | Dependency | Status | Source/Evidence | Affects checks |
|---|-----------|--------|-----------------|----------------|
| 1 | Node.js installed | available | Required for tsc | CHK-01 |
| 2 | npm dependencies installed (`npm install`) | available | Must run in helix-cli | CHK-01 |

### Required Checks

[CHK-01] TypeScript typecheck passes.
- Action: Run `cd /vercel/sandbox/workspaces/cmp6d5ed3000ve30u4tan6py4/helix-cli && npx tsc --noEmit`.
- Expected Outcome: Command exits with code 0 and no type errors.
- Required Evidence: Full command output showing no errors.

## Success Metrics

1. `TicketDetail` and `TicketItem` types include `approvalStatus` field.
2. `hlx tickets get` displays "Approval:" line when approval status is present.
3. `hlx tickets list` appends approval indicator (e.g., `[PENDING]`) when present.
4. Typecheck passes with zero errors.
5. Only two files modified: `get.ts` and `list.ts`.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement | Approval status must be visible in CLI |
| diagnosis/diagnosis-statement.md (CLI) | Root cause | CLI types and display lack approval fields |
| diagnosis/apl.json (CLI) | Structured diagnosis | No new CLI commands — scope is status visibility only |
| product/product.md | Product requirements | CLI shows approval line in get; approval indicator in list |
| tech-research/tech-research.md (CLI) | Architecture decisions | Separate line in get; brief indicator in list; optional typing |
| tech-research/apl.json (CLI) | Tech research answers | Confirmed two-file approach |
| repo-guidance.json | Repo intent | CLI is target for display updates |
| get.ts (direct) | Detail display | Lines 5-22: TicketDetail type; lines 57-59: mergeQueueStatus pattern to replicate |
| list.ts (direct) | List display | Lines 5-12: TicketItem type; line 105: list output format |

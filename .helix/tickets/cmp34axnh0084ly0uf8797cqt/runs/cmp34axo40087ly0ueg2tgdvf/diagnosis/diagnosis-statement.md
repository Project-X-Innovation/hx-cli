# Diagnosis Statement

## Problem Summary

The `resolveTicket()` function in `src/lib/resolve-ticket.ts` only fetches active tickets from the API. When a user passes an archived ticket reference to any of the 9 commands that route through this shared resolver (`tickets get`, `update-description`, `rerun`, `continue`, `artifacts`, `artifact`, `bundle`, `comments list`, `comments post`), the CLI reports "ticket not found" even though the server can return that archived ticket by ID. The bug is entirely in the resolution step — the CLI never asks the server for archived tickets during resolution.

## Root Cause Analysis

**Single root cause:** `resolveTicket()` at line 89 calls `hxFetch(config, '/tickets', { basePath: '/api' })` with no query parameters. This returns only active tickets. There is no code path that fetches archived tickets (via `queryParams: { archived: 'true' }`).

**Why this matters across all affected commands:** All 9 affected commands follow the same pattern — call `resolveTicket(config, ref)` to get `{ id, shortId }`, then pass `resolved.id` to their downstream endpoint function. The resolver is the single bottleneck; downstream commands work fine with archived ticket IDs because they call the server by ID directly (e.g., `GET /api/tickets/${ticketId}`).

**Secondary defect (ambiguity detection):** The numeric ambiguity check at lines 102-121 re-scans the same active-only `items` array. This means a numeric ref like "339" that matches one active ticket and one archived ticket will not be flagged as ambiguous — the archived match is invisible.

**What does NOT need to change:**
- `matchTicket()` (lines 44-77) is a pure function that works on any items array. No modification needed.
- `hxFetch()` already supports `queryParams` (http.ts lines 40, 46-49). No modification needed.
- `tickets list` and `tickets latest` call the API directly (not through `resolveTicket()`) and manage their own `--archived` flag. They are not affected by this fix.
- No caller of `resolveTicket()` needs to change — the function signature and return type remain the same.

**Alternative hypothesis considered and rejected:** Could the server be at fault? No — the ticket explicitly states this is a CLI bug. The server already returns archived ticket details by ID (`get.ts:47` uses `/tickets/${ticketId}` and the `TicketDetail` type includes `isArchived: boolean` at line 21). The API endpoint `GET /api/tickets?archived=true` is already used by `list.ts:43-44` and `latest.ts:24-25`.

## Evidence Summary

| Evidence | Location | Finding |
|----------|----------|---------|
| Active-only fetch | `resolve-ticket.ts:89` | `hxFetch(config, '/tickets', { basePath: '/api' })` — no archived query param |
| matchTicket is pure | `resolve-ticket.ts:44-77` | Takes `items[]` and `ref`, works on whatever data it receives |
| Ambiguity check is active-only | `resolve-ticket.ts:102-121` | Re-scans `items` (active only) for numeric matches |
| Archived API pattern exists | `list.ts:43-44`, `latest.ts:24-25` | `queryParams.archived = 'true'` is the established way to fetch archived tickets |
| hxFetch supports queryParams | `http.ts:40,46-49` | Already supports `queryParams?: Record<string, string>` |
| Server models archived state | `get.ts:21` | `TicketDetail.isArchived: boolean` exists and is printed at `get.ts:55` |
| 9 call sites | `tickets/index.ts:66,85,96,107,118,129,140`, `comments/index.ts:32,43` | All use `resolveTicket(config, rawRef)` then pass `resolved.id` downstream |
| list/latest not affected | `list.ts`, `latest.ts` | Call `hxFetch('/tickets', ...)` directly, not through `resolveTicket()` |
| No resolveTicket tests exist | `resolve-ticket.test.ts` | Only `matchTicket` and `extractTicketRef` are tested |
| Test runner: node:test | `package.json:18` | `tsc && node --test dist/**/*.test.js`, no external mocking libraries |

## Success Criteria

1. `resolveTicket()` fetches both active and archived tickets from the API.
2. Active ticket matches take priority — if a ref matches an active ticket, return it without consulting archived results.
3. If no active match, fall back to matching against archived tickets.
4. Numeric ambiguity detection considers the combined active + archived ticket set.
5. Error handling: if the active fetch succeeds but the archived fetch fails, and no active match exists, surface a clear error about resolution failure rather than silently reporting "not found."
6. `tickets list` and `tickets latest` behavior is completely unchanged.
7. All existing `matchTicket` and `extractTicketRef` tests continue to pass.
8. New tests cover: archived-only ticket resolution (by ID, short ID, numeric number), cross-set numeric ambiguity, genuinely-missing ticket, and active-match-priority.

### Files to Change

| File | Change Type | Rationale |
|------|-------------|-----------|
| `src/lib/resolve-ticket.ts` | Modify | Add archived ticket fetch to `resolveTicket()`, update ambiguity detection to consider both sets |
| `src/lib/resolve-ticket.test.ts` | Modify | Add `resolveTicket()` tests using `node:test` mock support for `hxFetch` |

### Files Explicitly NOT Changed

| File | Rationale |
|------|-----------|
| `src/lib/http.ts` | Already supports `queryParams` |
| `src/tickets/index.ts` | Call sites don't change; resolver signature is unchanged |
| `src/comments/index.ts` | Call sites don't change; resolver signature is unchanged |
| `src/tickets/list.ts` | Boundary file; does not use `resolveTicket()` |
| `src/tickets/latest.ts` | Boundary file; does not use `resolveTicket()` |
| `src/tickets/get.ts` | Downstream command; works with any ticket ID already |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement, decisions, acceptance criteria | Fix scoped to `resolveTicket()` in resolve-ticket.ts; must search both active and archived; must not change list/latest behavior; must detect cross-set ambiguity |
| scout/reference-map.json | File map with line-level evidence and unknowns | Confirmed resolve-ticket.ts:89 as the exact defect location; identified all 9 call sites; cataloged API pattern from list.ts/latest.ts; noted hxFetch queryParams support |
| scout/scout-summary.md | Consolidated analysis of the resolver behavior | Confirmed matchTicket is pure and needs no change; confirmed downstream readiness with isArchived field; confirmed boundary preservation for list/latest |
| src/lib/resolve-ticket.ts | Direct source inspection of fix target | Single active-only fetch at line 89; matchTicket pure function at lines 44-77; ambiguity check at lines 102-121 also active-only |
| src/lib/resolve-ticket.test.ts | Existing test coverage assessment | Tests exist for matchTicket and extractTicketRef only; no resolveTicket tests; uses node:test and node:assert |
| src/lib/http.ts | API infrastructure verification | hxFetch already supports queryParams option at lines 40,46-49; no changes needed |
| src/tickets/index.ts | Call site verification | 7 resolveTicket() call sites confirmed; all use same pattern; no caller changes needed |
| src/comments/index.ts | Call site verification | 2 resolveTicket() call sites confirmed; same pattern |
| src/tickets/list.ts | Boundary and API pattern reference | Confirms queryParams.archived = 'true' pattern; does not use resolveTicket; must remain unchanged |
| src/tickets/latest.ts | Boundary and API pattern reference | Same archived pattern; does not use resolveTicket; must remain unchanged |
| src/tickets/get.ts | Downstream behavior verification | Confirms server returns isArchived: boolean; confirms /tickets/${ticketId} endpoint works for any ticket |
| src/lib/config.ts | HxConfig type definition | Confirmed HxConfig shape including orgName used in error messages |
| package.json | Build and test infrastructure | node:test runner, zero runtime deps, Node >=18 |

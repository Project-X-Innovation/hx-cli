# Diagnosis Statement -- BLD-427

## Problem Summary

The `hlx tickets artifacts <ticket-ref>` command prints only "No artifacts found." and "No step artifacts found." when the API response is empty. Users need a run ID to fall back to `hlx tickets artifact --run <runId> --step <stepId> --repo <repoKey>`, but the CLI never surfaces the run ID in the empty-result path.

## Root Cause Analysis

The root cause is a **missing code path** in `src/tickets/artifacts.ts`. The `cmdTicketsArtifacts()` function handles the empty-result case with two independent blocks (lines 34-35 for items, lines 44-45 for stepArtifactSummary), each printing a generic "not found" message. There is no combined empty-result check and no run-ID resolution logic.

Key contributing factors:

1. **No run-ID resolution in artifacts.ts**: Unlike `artifact.ts` (lines 29-40) and `bundle.ts` (lines 33-39) which both resolve run IDs via `GET /api/tickets/${ticketId}` and `ticket.currentRun?.id ?? ticket.runs[0]?.id`, the `artifacts.ts` function never attempts to resolve or display a run ID.

2. **ArtifactsResponse lacks a runId field**: The API response type (lines 5-16) only contains `items[]` and `stepArtifactSummary[]`. Even when `--run` is supplied and passed as a query parameter, the flag value is discarded after the API call (line 19-23). It is not retained for later display.

3. **No combined empty-result detection**: The items-empty and stepArtifactSummary-empty checks are independent. There is no unified check to trigger run-ID display only when both are empty (the condition described in the ticket scope).

## Evidence Summary

### Primary change target
- **`src/tickets/artifacts.ts`** (47 lines): Lines 34-35 print "No artifacts found.\n" when items is empty. Lines 44-45 print "No step artifacts found." when stepArtifactSummary is empty. Line 19 extracts `--run` via `getFlag` but only uses it as a query param (line 22) -- the value is not retained.

### Established run-ID resolution pattern
- **`src/tickets/artifact.ts` lines 29-40**: `let runId = getFlag(args, '--run')` -> if absent, fetch ticket detail -> `ticket.currentRun?.id ?? ticket.runs[0]?.id`. Defines local `TicketDetail` type (lines 5-8).
- **`src/tickets/bundle.ts` lines 33-39**: Identical pattern with identical local types (lines 7-13).

### Router context
- **`src/tickets/index.ts` lines 112-121**: Dispatches `cmdTicketsArtifacts(config, resolved.id, rest)`. The `rawRef` is extracted (line 117) but NOT passed to the function. No signature change is needed because the follow-up suggestion uses placeholder tokens.

### Error handling
- **`src/lib/http.ts` lines 70-133**: `hxFetch` retries 3 times with exponential backoff, then throws `Error`. The ticket requires try/catch around the run-ID resolution so the command can exit 0 gracefully on failure.

## Scope of Change

**Single file**: `src/tickets/artifacts.ts`

Changes needed:
1. Retain the `runId` value from `getFlag(args, '--run')` for potential display.
2. After the existing output blocks, add a combined empty check (`items.length === 0 && stepArtifactSummary.length === 0`).
3. In the combined empty branch:
   - If `--run` was supplied, use that value directly.
   - If `--run` was NOT supplied, fetch ticket detail to resolve the run ID (with try/catch).
   - If resolution succeeds and a run ID exists: print the run ID and the follow-up suggestion with the actual run ID.
   - If the ticket has no runs: print a "no runs available" message with no suggestion.
   - If the resolution fetch fails: print "No artifacts found." and a note that the run ID could not be resolved.
4. Add local `TicketDetail` and `TicketResponse` types (consistent with artifact.ts/bundle.ts pattern).

**No changes needed to**:
- `src/tickets/index.ts` (no new parameters needed)
- `src/tickets/artifact.ts` or `bundle.ts` (reference only)
- Success-path output (when either items or stepArtifactSummary is non-empty)
- The existing follow-up suggestion on line 43 (non-empty stepArtifactSummary path)

## Success Criteria

1. Empty response prints the latest run ID and a follow-up command suggestion.
2. `--run <runId>` with empty response prints the exact user-supplied run ID.
3. Success-path output is byte-identical to current behavior.
4. Zero-runs ticket prints "no runs available" with no suggestion.
5. Run-ID resolution failure exits 0 with "No artifacts found." and a note.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification for acceptance criteria and constraints | 5 acceptance criteria, non-negotiable invariants (user-supplied --run echoed exactly), failure behavior (exit 0 on resolution error), scope limited to empty-result branch only. |
| scout/reference-map.json | File inventory with line-level anchors | Identified artifacts.ts as primary target, artifact.ts and bundle.ts as run-ID resolution reference patterns, and index.ts routing showing rawRef is not passed. |
| scout/scout-summary.md | Synthesized analysis of codebase patterns | Confirmed the run-ID resolution pattern is duplicated in two files, quality gates (tsc + node --test), and the test coverage gap in src/tickets/. |
| src/tickets/artifacts.ts (direct read) | Verified current empty-result behavior | Lines 34-35 and 44-45 print generic messages; line 19 extracts --run but discards after use as query param. No combined empty check exists. |
| src/tickets/artifact.ts (direct read) | Verified run-ID resolution pattern | Lines 5-10 define TicketDetail/TicketResponse types; lines 29-40 show getFlag + ticket-detail fallback pattern. |
| src/tickets/bundle.ts (direct read) | Confirmed pattern consistency | Lines 7-13 duplicate types; lines 33-39 duplicate resolution logic. Establishes the pattern as codebase convention. |
| src/tickets/index.ts (direct read) | Verified router dispatch and parameter passing | Line 119 passes only resolved.id, not rawRef. Confirms no signature change is needed. |
| src/lib/http.ts (direct read) | Verified hxFetch throw behavior | Lines 70-133 show retry loop; throws Error on failure. Confirms try/catch is required for graceful handling. |

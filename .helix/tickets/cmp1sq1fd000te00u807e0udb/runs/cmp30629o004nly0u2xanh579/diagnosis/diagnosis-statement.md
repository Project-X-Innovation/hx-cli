# Diagnosis Statement — BLD-430

## Problem Summary

`hlx tickets bundle` produces an empty archive (0 artifact files) for tickets with `PREVIEW_READY` status and other non-active statuses. The command resolves a valid `runId` from ticket detail but does not pass it to the artifact summary API call, causing the server to return an empty `stepArtifactSummary` array. The loop that fetches individual step artifacts never executes. Sibling commands (`artifacts`, `artifact`) work correctly because they pass `runId` to the same endpoint.

## Root Cause Analysis

**Root cause:** `bundle.ts` line 43 fetches `GET /api/tickets/:id/artifacts` without any query parameters. For non-active ticket statuses, the server API requires an explicit `runId` query parameter to return artifact data.

**Code path:**

1. `bundle.ts:36` — resolves `runId` via `ticket.currentRun?.id ?? ticket.runs[0]?.id`. This succeeds and produces a valid run ID.
2. `bundle.ts:43` — calls `hxFetch(config, /tickets/${ticketId}/artifacts, { basePath: "/api" })`. **No `queryParams`** — `runId` is not passed.
3. Server returns `{ stepArtifactSummary: [] }` for non-active statuses without `runId`.
4. `bundle.ts:53` — `for (const entry of artifacts.stepArtifactSummary)` iterates zero times.
5. `bundle.ts:55` — the individual step-artifact fetch (which correctly uses `runId` in the URL) is never reached.
6. Result: `totalFiles` remains 0, output says "0 artifact file(s)".

**Why sibling commands work:**

| Command | Summary call passes runId? | Has --run flag? |
|---------|---------------------------|-----------------|
| `bundle` (bundle.ts:43) | **No** | **No** |
| `artifacts` (artifacts.ts:20-22) | Yes (when --run provided) | Yes |
| `artifact` (artifact.ts:29-44) | N/A (direct step-artifact fetch) | Yes |

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| Missing runId in summary call | `bundle.ts:43` | `hxFetch` called with `{ basePath: "/api" }` only — no `queryParams` |
| runId resolved but unused for summary | `bundle.ts:36` | `const runId = ticket.currentRun?.id ?? ticket.runs[0]?.id` — valid before line 43 |
| Working pattern in artifacts command | `artifacts.ts:20-22` | Same endpoint called with `...(runId ? { queryParams: { runId } } : {})` |
| hxFetch supports queryParams | `http.ts:46-49` | Appends queryParams to URL via `url.searchParams.set()` |
| No --run flag on bundle | `index.ts:27` | Usage: `hlx tickets bundle <ticket-ref> --out <dir>` — no `[--run <runId>]` |
| No test coverage for bundle | `src/**/*.test.ts` glob | Only `flags.test.ts` and `resolve-ticket.test.ts` exist; no bundle tests |
| Ticket type lacks status field | `bundle.ts:7-11` | `TicketDetail` has `id`, `currentRun`, `runs` — no `status` |
| Alternative causes disconfirmed | Grep + code comparison | Same response type, same transport layer, same endpoint — only difference is missing queryParams |

## Success Criteria

1. `hlx tickets bundle <ticket-ref> --out <dir>` produces a populated archive for `PREVIEW_READY` tickets (and other non-active statuses) when step artifacts exist on the latest run.
2. The auto-resolved `runId` (from `ticket.currentRun?.id ?? ticket.runs[0]?.id`) is passed to the artifact summary endpoint.
3. Existing behavior for active-status tickets is preserved (no regression).
4. Build (`tsc`) and existing tests (`node --test`) pass.
5. Optionally: a `--run <runId>` flag is added to `bundle` for explicit override, matching sibling command patterns.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement, repro steps, expected behavior | PREVIEW_READY returns empty summary without runId; sibling commands work with --run; bundle has no equivalent |
| scout/reference-map.json | File inventory and per-file analysis from scout | Confirmed bundle.ts:43 omits runId; artifacts.ts:20-22 includes it; no bundle tests exist |
| scout/scout-summary.md | Consolidated scout analysis and comparison table | Confirmed the exact code comparison showing the missing queryParams pattern |

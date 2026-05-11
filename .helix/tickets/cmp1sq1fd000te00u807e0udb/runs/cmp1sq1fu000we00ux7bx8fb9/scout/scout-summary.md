# Scout Summary — BLD-430

## Problem

`hlx tickets bundle <ticket-ref> --out <dir>` produces 0 artifact files for tickets with `PREVIEW_READY` status (and other non-active statuses). The command fetches the artifact summary endpoint without passing a `runId` query parameter. For non-active tickets, this endpoint returns an empty `stepArtifactSummary` array, so no individual step artifacts are fetched. The sibling commands `hlx tickets artifacts` and `hlx tickets artifact` both support a `--run` flag that makes them work correctly for the same tickets.

## Analysis Summary

The bundle command (`src/tickets/bundle.ts`) makes two sequential API calls:

1. **Line 33**: `GET /api/tickets/:id` — fetches ticket detail and resolves `runId` from `ticket.currentRun?.id ?? ticket.runs[0]?.id` (line 36).
2. **Line 43**: `GET /api/tickets/:id/artifacts` — fetches the artifact summary list. This call has **no `queryParams`**, so `runId` is not sent.

The resolved `runId` from step 1 is only used later at line 55 for individual step-artifact fetches (`/tickets/:id/runs/:runId/step-artifacts/:stepId`). But since the artifact summary in step 2 returns an empty `stepArtifactSummary` array for non-active tickets, the loop at line 53 never executes, and no step artifacts are fetched.

By contrast, `artifacts.ts` (lines 20-23) conditionally passes `runId` as `queryParams` to the same `/tickets/:id/artifacts` endpoint when the `--run` flag is provided — this is why `hlx tickets artifacts --run <runId>` works for PREVIEW_READY tickets.

The `bundle` command also lacks a `--run` flag entirely (usage at `tickets/index.ts` line 27), so users cannot override the behavior.

### Key code comparison

| Command | Artifact summary call | Passes runId? | --run flag? |
|---------|----------------------|---------------|-------------|
| `bundle` (bundle.ts:43) | `hxFetch(config, /tickets/${ticketId}/artifacts, { basePath: "/api" })` | No | No |
| `artifacts` (artifacts.ts:20-23) | `hxFetch(config, /tickets/${ticketId}/artifacts, { basePath: "/api", ...(runId ? { queryParams: { runId } } : {}) })` | Yes (optional) | Yes |
| `artifact` (artifact.ts:29-44) | N/A (fetches step-artifact directly) | N/A | Yes |

### Bundle.ts TicketDetail type lacks `status` field

`bundle.ts` defines `TicketDetail` (lines 7-11) with only `id`, `currentRun`, and `runs`. It does not include `status`. By contrast, `get.ts` (lines 6-22) defines a richer type that includes `status`. This means bundle cannot inspect the ticket status for conditional behavior without expanding its type.

### No existing tests for bundle

The repo has test files for `flags.ts` and `resolve-ticket.ts` in `src/lib/`, but no test file exists for `bundle.ts` or any other command in `src/tickets/`.

## Relevant Files

| File | Role |
|------|------|
| `src/tickets/bundle.ts` | Primary bug location — artifact summary fetch omits runId |
| `src/tickets/artifacts.ts` | Working comparison — passes runId as queryParams |
| `src/tickets/artifact.ts` | Working comparison — accepts --run flag |
| `src/tickets/index.ts` | Subcommand router with usage strings |
| `src/lib/flags.ts` | Flag parsing utilities (getFlag, requireFlag) |
| `src/lib/http.ts` | HTTP transport (hxFetch with queryParams support) |
| `src/tickets/get.ts` | Shows richer TicketDetail type with status field |
| `src/index.ts` | CLI entry point |
| `package.json` | Build/test scripts, version 1.3.2 |
| `tsconfig.json` | TypeScript strict mode, ES2022 target |
| `.github/workflows/publish.yml` | CI: build, test, publish pipeline |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and repro steps | PREVIEW_READY tickets return empty artifact summary; artifacts and artifact commands work with --run flag; bundle has no equivalent path |

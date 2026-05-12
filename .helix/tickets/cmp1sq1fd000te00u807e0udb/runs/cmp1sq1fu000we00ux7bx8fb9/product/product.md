# Product — BLD-430

## Problem Statement

`hlx tickets bundle` silently produces an empty archive (0 artifact files) for tickets in `PREVIEW_READY` status and other non-active statuses, even though those same artifacts are individually fetchable via `hlx tickets artifact` and `hlx tickets artifacts`. Users expecting a bundled export of all step artifacts get nothing, with only per-step warnings indicating failure. The only workaround is to manually fetch each step artifact one-by-one and reassemble the bundle by hand.

## Product Vision

`hlx tickets bundle` should reliably produce a complete artifact archive for any ticket whose run artifacts exist — regardless of ticket status. The command should behave consistently with its sibling commands (`artifacts`, `artifact`) that already work for non-active statuses.

## Users

- **Helix CLI users** who use `hlx tickets bundle` to export a complete set of step artifacts for review, handoff, or archival purposes.

## Use Cases

1. **Bundle artifacts for a PREVIEW_READY ticket**: A user runs `hlx tickets bundle <ticket-ref> --out <dir>` on a ticket awaiting preview approval and expects all step artifacts (scout, diagnosis, implementation, etc.) in the output directory.
2. **Bundle artifacts for other non-active tickets**: Same expectation applies for tickets in `DEPLOYED`, `UNVERIFIED`, or `FAILED` status.
3. **Bundle artifacts for a specific run**: A user wants to export artifacts from a particular run (not necessarily the latest) by specifying it explicitly.

## Core Workflow

1. User runs `hlx tickets bundle <ticket-ref> --out <dir>`.
2. CLI resolves the ticket and identifies the relevant run.
3. CLI fetches the artifact summary for that run.
4. CLI iterates over the summary entries and downloads each step artifact.
5. CLI writes all artifacts to the output directory and reports the count.

Today, step 3 fails silently for non-active tickets because the run context is not sent to the server, so the server returns an empty summary and no artifacts are downloaded.

## Essential Features (MVP)

1. **Always pass run context to the artifact summary endpoint**: The bundle command must include the resolved run ID when fetching the artifact summary, so the server returns populated data for non-active statuses.
2. **Add `--run` flag for explicit run override**: Match the interface of sibling commands (`artifacts`, `artifact`) so users can target a specific run when the auto-resolved one is not desired.
3. **Preserve existing behavior for active-status tickets**: No regression for tickets whose artifacts are currently bundled correctly.

## Features Explicitly Out of Scope (MVP)

- **Server-side API changes**: The server already returns correct data when `runId` is supplied. No backend work is needed.
- **New output formats**: The archive structure and file layout remain unchanged.
- **Retry or partial-failure recovery**: If individual step artifacts fail to fetch, existing warning behavior is acceptable.
- **Comprehensive test suite for all ticket commands**: Only bundle-specific coverage for the fix is in scope.

## Success Criteria

1. `hlx tickets bundle <ticket-ref> --out <dir>` produces a populated archive for `PREVIEW_READY` tickets when step artifacts exist on the latest run.
2. The same works for other non-active statuses (`DEPLOYED`, `UNVERIFIED`, `FAILED`).
3. A `--run <runId>` flag is available on `bundle`, matching sibling command patterns.
4. Existing behavior for active-status tickets is unchanged.
5. Build (`tsc`) and existing tests pass.

## Key Design Principles

- **Consistency**: Bundle should behave like its sibling commands — same flags, same status-handling logic.
- **Smallest correct change**: Fix the specific omission; do not restructure the command architecture.
- **Fail-open for active tickets**: For active-status tickets where the summary endpoint already works without `runId`, the fix must not break that path.

## Scope & Constraints

- **Single repository**: Change is confined to `helix-cli` (`src/tickets/bundle.ts` and `src/tickets/index.ts`).
- **No runtime dependencies**: The CLI is a pure TypeScript tool with zero runtime dependencies — no database or external service changes.
- **CI gates**: Must pass `tsc` (build), `tsc --noEmit` (typecheck), and `node --test` (test runner).
- **No server-side changes**: The API already supports the `runId` query parameter on the artifact summary endpoint.

## Future Considerations

- **Status-aware messaging**: Bundle could report ticket status to help users understand why an explicit `--run` might be needed in edge cases.
- **Broader test coverage**: Ticket commands currently lack test files; future work could add integration or unit tests for all subcommands.
- **Auto-detect latest run**: If `currentRun` is null for terminal statuses, bundle could automatically select `runs[0]` and inform the user which run was used.

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|----------------|--------|
| 1 | The exact server behavior for `GET /api/tickets/:id/artifacts?runId=...` is inferred from sibling command success, not from direct API documentation. If the server has additional status-specific logic, the fix may need adjustment. | Medium — mitigated by the fact that `artifacts --run` works for the same tickets. |
| 2 | Whether `currentRun` is null/undefined for `PREVIEW_READY` tickets is unknown. The fallback `ticket.runs[0]?.id` may or may not be exercised. | Low — the existing fallback chain already handles this. |
| 3 | The ordering convention of `ticket.runs` (latest-first vs. earliest-first) is not documented in the CLI codebase. If `runs[0]` is the earliest run, auto-resolution could pick the wrong run. | Low — the `--run` flag provides an explicit override as a safety net. |
| 4 | No runtime inspection credentials were available to verify current production behavior or error rates. | Low — static evidence from scout/diagnosis is sufficient for this client-side fix. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement, repro steps, expected behavior | PREVIEW_READY returns empty artifact summary without runId; sibling commands work with `--run`; bundle lacks equivalent |
| `scout/scout-summary.md` | Consolidated scout analysis with code comparison | Confirmed bundle.ts:43 omits runId; artifacts.ts:20-22 includes it; no bundle tests exist |
| `scout/reference-map.json` | Detailed per-file analysis and evidence inventory | Confirmed root cause at bundle.ts:43, working pattern at artifacts.ts:20-22, hxFetch supports queryParams |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and success criteria | Root cause is missing queryParams on artifact summary call; fix is single-expression change plus optional --run flag |
| `diagnosis/apl.json` | Structured diagnosis answers with evidence chains | Confirmed alternative causes disconfirmed; fix pattern is established in sibling command |
| `repo-guidance.json` | Repo intent classification | Confirmed helix-cli is the sole target repo; no cross-repo changes needed |

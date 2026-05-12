# Implementation Actual — BLD-427

## Summary of Changes

Single-file change to `src/tickets/artifacts.ts` that adds run-ID display and a follow-up command suggestion when `hlx tickets artifacts` returns empty results (both `items` and `stepArtifactSummary` are empty). The change appends a combined empty-result block after the existing output, reusing the established run-ID resolution pattern from `artifact.ts` and `bundle.ts`. No new dependencies, no signature changes, no server changes.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/tickets/artifacts.ts` | Added local `TicketDetail`/`TicketResponse` types (lines 18-23) and a combined empty-result block (lines 55-77) that resolves the run ID and prints it with a follow-up command suggestion | None — no shared utilities, public interfaces, or cross-repo behavior touched. The change is isolated to the empty-result code path within a single command handler. |

## Steps Executed

### Step 1: Add local types for run-ID resolution
- Added `TicketDetail` and `TicketResponse` type declarations after the existing `ArtifactsResponse` type (lines 18-23).
- Types are identical to those in `artifact.ts` (lines 5-10) and `bundle.ts` (lines 7-13), following the codebase convention of local type declarations.

### Step 2: Append combined empty-result block
- Added a combined empty-result check at lines 55-77 that triggers when `data.items.length === 0 && data.stepArtifactSummary.length === 0`.
- Inside the block:
  - Declares `let resolvedRunId: string | undefined = runId` (reusing the existing `const runId` from line 26).
  - If `resolvedRunId` is undefined, fetches ticket detail via `hxFetch(config, '/tickets/${ticketId}', { basePath: '/api' })` and resolves via `ticket.currentRun?.id ?? ticket.runs[0]?.id`.
  - If no runs exist: prints `\nNo runs available for this ticket.` and returns.
  - If resolution fetch fails (catch block): prints `\nCould not resolve the run ID for this ticket.` and returns (no throw, no `process.exit`, no retry).
  - If run ID resolved: prints `\nRun ID: <resolvedRunId>` and `Use: hlx tickets artifact <ticket-ref> --run <resolvedRunId> --step <stepId> --repo <repoKey>`.

### Step 3: Run quality gates
- `npx tsc --noEmit` — zero errors.
- `npm test` — 30/30 tests pass, zero failures.

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npx tsc --noEmit` | Exit 0, zero type errors |
| `npm test` | 30/30 tests pass, exit 0 |
| `npm run build` | Clean build, exit 0 |
| `node dist/index.js tickets artifacts HLX-65` (empty artifacts, has runs) | Output: `No artifacts found.\n\nNo step artifacts found.\n\nRun ID: cmow2ielf000khb0ugm3grmi2\nUse: hlx tickets artifact <ticket-ref> --run cmow2ielf000khb0ugm3grmi2 --step <stepId> --repo <repoKey>` — exit 0 |
| `node dist/index.js tickets artifacts HLX-60` (empty artifacts, no runs) | Output: `No artifacts found.\n\nNo step artifacts found.\n\nNo runs available for this ticket.` — exit 0 |
| `node dist/index.js tickets artifacts HLX-60 --run fake-run-id-12345` | Output: `No artifacts found.\n\nNo step artifacts found.\n\nRun ID: fake-run-id-12345\nUse: hlx tickets artifact <ticket-ref> --run fake-run-id-12345 --step <stepId> --repo <repoKey>` — exit 0 |
| `node dist/index.js tickets artifacts HLX-51` (has artifacts) | Output: `Artifacts:\n\n  next-js-boilerplate...` etc. — No `Run ID:` line (grep count = 0) |
| `node dist/index.js tickets artifacts HLX-37` (has artifacts) | Output: `Artifacts:\n\n  next-js-boilerplate...` — No `Run ID:` line (grep count = 0) |

## Test/Build Results

- **TypeScript compilation**: Zero errors (`npx tsc --noEmit`)
- **Tests**: 30/30 pass (`npm test`), 6 suites, 0 failures, 0 skipped
- **Build**: Clean (`npm run build`)

## Deviations from Plan

None. The implementation follows the plan exactly:
- Local types added after `ArtifactsResponse` (plan Step 1)
- Combined empty block appended after existing output (plan Step 2)
- Quality gates pass cleanly (plan Step 3)
- Output format matches the specification in tech-research and ticket

## Known Limitations / Follow-ups

- **No unit tests for `cmdTicketsArtifacts`**: The `src/tickets/` directory has no tests. Adding test coverage is identified as a future concern in the tech-research and product specs, but is outside this ticket's scope.
- **Type duplication**: `TicketDetail`/`TicketResponse` are now duplicated across `artifact.ts`, `bundle.ts`, and `artifacts.ts`. A shared types module is a future refactoring opportunity.
- **CHK-06 catch path not runtime-verified**: The try/catch for ticket-detail resolution failure could not be triggered against the staging API without also failing the initial artifacts fetch. Verified by code inspection per the verification plan's alternative.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npx tsc --noEmit` — exit 0, zero type errors reported |
| CHK-02 | pass | `npm test` — 30/30 tests pass, 6 suites, exit 0 |
| CHK-03 | pass | `node dist/index.js tickets artifacts HLX-65` — output shows `Run ID: cmow2ielf000khb0ugm3grmi2` and `Use: hlx tickets artifact <ticket-ref> --run cmow2ielf000khb0ugm3grmi2 --step <stepId> --repo <repoKey>` |
| CHK-04 | pass | `node dist/index.js tickets artifacts HLX-60 --run fake-run-id-12345` — output shows `Run ID: fake-run-id-12345` and follow-up suggestion uses exactly `fake-run-id-12345` |
| CHK-05 | pass | `node dist/index.js tickets artifacts HLX-51` and `HLX-37` — success-path output shows artifacts, no `Run ID:` line appended (grep count = 0) |
| CHK-06 | pass (partial) | Normal and no-runs empty paths both exit 0 (runtime confirmed). The catch block for resolution failure is verified by code inspection: lines 69-71 catch errors, print `Could not resolve the run ID for this ticket.`, and return normally — no `process.exit()`, no `throw`, no retry. The catch path could not be triggered in isolation against the staging API because an unreachable URL also fails the initial artifacts fetch. |

Self-verification is complete for CHK-01 through CHK-05. CHK-06 is partially runtime-verified (exit code 0 on normal empty paths) with code inspection for the catch block per the verification plan's allowed alternative.

## APL Statement Reference

Implementation complete. Single-file change to `src/tickets/artifacts.ts` adds run-ID display and follow-up command suggestion in the empty-result path. All quality gates pass (typecheck zero errors, 30/30 tests). Runtime verification against staging API confirms correct behavior for empty results with run ID resolution, explicit `--run` echo, no-runs handling, and success-path preservation.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification for acceptance criteria and constraints | 5 ACs defining exact behavior: run ID in empty output, --run echoed, success path unchanged, zero-runs, graceful failure |
| implementation-plan/implementation-plan.md | Step-by-step implementation guide and verification plan | 3 implementation steps, 6 verification checks, output format, and pre-condition assessment |
| implementation-plan/apl.json | Plan validation and pre-conditions | Confirmed 3-step sequence, single-file scope, 6 checks with staging API dependency |
| diagnosis/diagnosis-statement.md | Root cause and scope of change | Missing code path in artifacts.ts; combined empty check, run-ID resolution, try/catch |
| product/product.md | Product requirements and design principles | 6 essential features, single-file scope, future considerations |
| tech-research/tech-research.md | Architecture decision and output format | Option A (append combined empty block), output format templates, variable management, error handling |
| repo-guidance.json | Repo intent | helix-cli is sole target repo |
| src/tickets/artifacts.ts | Current implementation to modify | 47-line function; line 19 const runId, lines 34-35/44-45 empty messages |
| src/tickets/artifact.ts | Run-ID resolution pattern reference | Lines 5-10 types, lines 29-40 resolution logic |
| src/tickets/bundle.ts | Pattern consistency reference | Lines 7-13 types, lines 33-39 resolution logic |

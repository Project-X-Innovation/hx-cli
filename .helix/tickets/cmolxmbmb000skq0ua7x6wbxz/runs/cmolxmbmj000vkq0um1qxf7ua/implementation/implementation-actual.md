# Implementation Actual: Add --run Selection to `hlx tickets artifacts` and Harden Missing Artifact Errors

## Summary of Changes

Two independent defects fixed across three files in helix-cli:

1. **`hlx tickets artifacts` now supports `--run <runId>`**: Added `getFlag` import, `args: string[]` parameter, `--run` flag reading, and conditional `queryParams` forwarding to the server endpoint.

2. **`hlx tickets artifact` 404 now handled cleanly**: Wrapped the `hxFetch` call in a try-catch that prints a contextual error message (naming step and repo) and exits with code 1, preventing raw HTTP errors from reaching the global handler.

## Files Changed

| File | Why Changed | Shared/Review Hotspot |
|------|-------------|----------------------|
| `src/tickets/artifacts.ts` | Added `getFlag` import, `args: string[]` param, `--run` flag reading, conditional `queryParams` on `hxFetch` | Public interface change: function signature now requires 3rd `args` param — must match caller in index.ts |
| `src/tickets/index.ts` | Updated usage text at line 36 to include `[--run <runId>]`; forwarded `rest` to `cmdTicketsArtifacts` at line 79 | Subcommand router: coordinates with artifacts.ts signature change |
| `src/tickets/artifact.ts` | Wrapped `hxFetch` call (lines 42-47) in try-catch with clean error message and `process.exit(1)` | Error handling change: prevents error propagation to global handler |

## Steps Executed

### Step 1: Add `--run` flag support to `src/tickets/artifacts.ts`

- Added `import { getFlag } from "../lib/flags.js";` (line 3)
- Changed function signature from `(config: HxConfig, ticketId: string)` to `(config: HxConfig, ticketId: string, args: string[])` (line 18)
- Added `const runId = getFlag(args, "--run");` (line 19)
- Changed `hxFetch` call to use conditional queryParams via object spread: `...(runId ? { queryParams: { runId } } : {})` (lines 20-23)

### Step 2: Forward args in router and update usage text in `src/tickets/index.ts`

- Updated usage text at line 36 from `hlx tickets artifacts <ticket-id>` to `hlx tickets artifacts <ticket-id> [--run <runId>]`
- Changed router call at line 79 from `cmdTicketsArtifacts(config, ticketId)` to `cmdTicketsArtifacts(config, ticketId, rest)`

### Step 3: Harden 404 error handling in `src/tickets/artifact.ts`

- Declared `let data: StepArtifactResponse;` before try block (line 42)
- Wrapped `hxFetch` call in try-catch (lines 43-54)
- Catch block prints `Error: Could not fetch artifact for step "${stepId}" in repo "${repoKey}".` via `console.error`
- Optionally prints the original error message for debugging context (when `err instanceof Error`)
- Calls `process.exit(1)` in catch block

### Step 4: Verify typecheck and build

- Ran `npm run typecheck` (tsc --noEmit) — passed with exit code 0, no errors
- Ran `npm run build` (tsc) — passed with exit code 0, no errors

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npm run typecheck` | Exit 0, no errors |
| `npm run build` | Exit 0, no errors |
| Source inspection of `src/tickets/artifacts.ts` | Confirmed: getFlag import (line 3), args param (line 18), getFlag call (line 19), conditional queryParams (lines 20-23) |
| Source inspection of `src/tickets/index.ts` | Confirmed: usage text includes `[--run <runId>]` (line 36), rest forwarded (line 79) |
| Source inspection of `src/tickets/artifact.ts` | Confirmed: try-catch wraps hxFetch (lines 43-54), console.error with step/repo context (line 49), process.exit(1) (line 53) |

## Test/Build Results

- **TypeScript typecheck**: `npm run typecheck` (tsc --noEmit) — PASS, exit code 0, zero errors
- **TypeScript build**: `npm run build` (tsc) — PASS, exit code 0, compiled successfully
- **No test infrastructure**: No test files, CI, or lint scripts exist in this repository (confirmed by scout)

## Deviations from Plan

None. All changes match the implementation plan exactly.

## Known Limitations / Follow-ups

- **No live API testing**: No dev setup config or Helix API server available in this environment. The `--run` flag forwarding and 404 handling have been verified via source inspection and typecheck, but not via actual CLI invocation against a server.
- **No automated tests**: The repository has no test infrastructure. Both fixes follow established patterns from working sibling commands.

## Verification Plan Results

| Required Check ID | Outcome | Evidence/Notes |
|-------------------|---------|----------------|
| CHK-01 | pass | `npm run typecheck` exited 0 with no error output |
| CHK-02 | pass | `npm run build` exited 0 with no error output |
| CHK-03 (artifacts.ts a) | pass | Line 3: `import { getFlag } from "../lib/flags.js";` confirmed present |
| CHK-03 (artifacts.ts b) | pass | Line 18: function signature includes `args: string[]` parameter |
| CHK-03 (artifacts.ts c) | pass | Line 19: `const runId = getFlag(args, "--run");` confirmed present |
| CHK-03 (artifacts.ts d) | pass | Lines 20-23: `queryParams: { runId }` conditionally included via spread when runId is defined |
| CHK-03 (index.ts a) | pass | Line 36: usage text includes `[--run <runId>]` for artifacts subcommand |
| CHK-03 (index.ts b) | pass | Line 79: router call passes `rest` as third argument to `cmdTicketsArtifacts` |
| CHK-03 (artifact.ts a) | pass | Lines 43-54: `hxFetch` call wrapped in try-catch |
| CHK-03 (artifact.ts b) | pass | Line 49: catch block prints clean error message including step and repo context |
| CHK-03 (artifact.ts c) | pass | Line 53: `process.exit(1)` called in catch block |

All required checks pass.

## APL Statement Reference

Implementation complete. Three files modified in helix-cli: artifacts.ts (--run flag support), index.ts (router forwarding and usage text), artifact.ts (404 error handling). Both typecheck and build pass. All changes follow established patterns from sibling commands. No followups.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement | Two defects: missing --run on artifacts, noisy 404 on artifact |
| implementation-plan/implementation-plan.md | Step-by-step change specification | Four steps across three files; verification plan with CHK-01 through CHK-03 |
| implementation-plan/apl.json | Structured plan summary | Confirmed four sequential steps, three verification checks, no cross-repo deps |
| diagnosis/diagnosis-statement.md | Root cause analysis | Three-file change scope, two independent defects, established patterns |
| src/tickets/artifacts.ts | Primary change target (before) | Confirmed: no args param (line 17), no queryParams (line 18) |
| src/tickets/artifact.ts | Change target and reference pattern | Confirmed: --run pattern at lines 29-40, unguarded hxFetch at lines 42-45 |
| src/tickets/index.ts | Router and usage text change target | Confirmed: line 79 missing rest, line 36 missing --run, line 85 correct pattern |
| src/tickets/bundle.ts | Reference pattern for try-catch | Confirmed: try-catch at lines 68-71 with console.error warning |

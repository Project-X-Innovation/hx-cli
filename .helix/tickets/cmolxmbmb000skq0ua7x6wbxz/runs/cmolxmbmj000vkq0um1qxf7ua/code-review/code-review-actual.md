# Code Review: Add --run Selection to `hlx tickets artifacts` and Harden Missing Artifact Errors

## Review Scope

Reviewed three modified files implementing two independent defect fixes:
1. `--run <runId>` flag support for `hlx tickets artifacts` (artifacts.ts + index.ts)
2. Graceful 404 error handling for `hlx tickets artifact` (artifact.ts)

Also reviewed supporting library code (`src/lib/flags.ts`, `src/lib/http.ts`), sibling reference patterns (`src/tickets/bundle.ts`), global error handler (`src/index.ts`), and compiled JavaScript output (`dist/tickets/artifacts.js`, `dist/tickets/artifact.js`) to verify correctness.

## Files Reviewed

| File | Lines | Why Reviewed |
|------|-------|-------------|
| `src/tickets/artifacts.ts` | 1-47 | Primary change target: added `--run` flag support |
| `src/tickets/index.ts` | 1-99 | Router and usage text changes |
| `src/tickets/artifact.ts` | 1-68 | 404 error handling change |
| `src/lib/flags.ts` | 1-31 | Verified `getFlag` API contract: returns `string \| undefined` |
| `src/lib/http.ts` | 1-134 | Verified `hxFetch` `queryParams` support and error throw behavior |
| `src/tickets/bundle.ts` | 1-86 | Verified reference try-catch pattern at lines 54-71 |
| `src/index.ts` | 1-98 | Verified global error handler at lines 95-97 |
| `dist/tickets/artifacts.js` | 1-32 | Verified compiled output matches source intent |
| `dist/tickets/artifact.js` | 1-47 | Verified compiled output matches source intent |

## Missed Requirements & Issues Found

**No issues found.** All ticket requirements are correctly implemented.

### Requirements verification:

| # | Requirement | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `--run <runId>` flag on `hlx tickets artifacts` | Met | `artifacts.ts:19`: `getFlag(args, "--run")` reads flag; lines 20-23 conditionally pass `queryParams: { runId }` |
| 2 | Forward `runId` as query parameter to server | Met | `artifacts.ts:22`: `queryParams: { runId }` included via spread only when `runId` is defined |
| 3 | Updated usage text for `artifacts` subcommand | Met | `index.ts:36`: `hlx tickets artifacts <ticket-id> [--run <runId>]` |
| 4 | Graceful 404 handling on `hlx tickets artifact` | Met | `artifact.ts:43-54`: try-catch wraps hxFetch, prints contextual error, exits with code 1 |
| 5 | No behavior change when `--run` is omitted | Met | `artifacts.ts:22`: spread is empty `{}` when `runId` is undefined, so no `queryParams` sent |
| 6 | TypeScript typecheck passes | Met | `npm run typecheck` exits 0, no errors |
| 7 | TypeScript build passes | Met | `npm run build` exits 0, no errors |

### Specific verification details:

**artifacts.ts** - Correct:
- Line 3: `import { getFlag } from "../lib/flags.js";` properly added
- Line 18: Function signature updated to `(config: HxConfig, ticketId: string, args: string[])` matching the pattern in `artifact.ts:19`
- Line 19: `const runId = getFlag(args, "--run");` correctly reads the flag value
- Lines 20-23: Conditional queryParams via `...(runId ? { queryParams: { runId } } : {})` avoids sending `runId=undefined`
- Only caller (`index.ts:79`) was updated, confirmed by grep — no other imports of `cmdTicketsArtifacts`

**index.ts** - Correct:
- Line 36: Usage text includes `[--run <runId>]` for the artifacts subcommand
- Line 79: `rest` forwarded as third argument to `cmdTicketsArtifacts(config, ticketId, rest)`, matching the pattern at line 85 for `cmdTicketsArtifact`

**artifact.ts** - Correct:
- Line 42: `let data: StepArtifactResponse;` declared before try block
- Lines 43-47: hxFetch call wrapped in try block
- Line 49: Catch block prints `Error: Could not fetch artifact for step "${stepId}" in repo "${repoKey}".` — includes step and repo context
- Lines 50-52: Optional original error message preserved via `err instanceof Error` check
- Line 53: `process.exit(1)` called unconditionally in catch block — ensures exit
- TypeScript control flow correctly handles `data` assignment after try-catch (`process.exit` returns `never`)

### Regression risk assessment:
- **No regression risk**: The `artifacts.ts` signature change from `(config, ticketId)` to `(config, ticketId, args)` has exactly one caller (`index.ts:79`), which was updated simultaneously.
- **No shared utility changes**: `hxFetch` and `getFlag` are unchanged.
- **Error handling is local**: The try-catch in `artifact.ts` does not affect the global error handler or other commands.
- **Compiled output verified**: Both `dist/tickets/artifacts.js` and `dist/tickets/artifact.js` match the expected compiled behavior.

## Changes Made by Code Review

None. No issues were found that required correction.

## Remaining Risks / Deferred Items

| # | Item | Risk Level | Notes |
|---|------|-----------|-------|
| 1 | Server query parameter name (`runId` vs `run`) is unverified | Low | Ticket states `runId`; if wrong, results would be unfiltered rather than errors. One-character fix. |
| 2 | No automated tests to catch future regressions | Medium | Pre-existing; repository has no test infrastructure. Out of scope per product spec. |
| 3 | No live API testing performed | Low | Both fixes verified via source inspection, typecheck, and build. Runtime behavior follows established patterns from working sibling commands. |

## Verification Impact Notes

No changes were made by code review, so all verification checks remain valid as specified:

| Required Check ID | Status | Notes |
|-------------------|--------|-------|
| CHK-01 | Still valid | TypeScript typecheck passes |
| CHK-02 | Still valid | TypeScript build passes |
| CHK-03 (all sub-checks) | Still valid | All source code changes verified correct against specification |

## APL Statement Reference

Code review complete. All three modified files (artifacts.ts, index.ts, artifact.ts) reviewed against ticket requirements, product spec, and implementation plan. No issues found. Both quality gates (typecheck, build) pass. Implementation correctly follows established patterns from sibling commands. No changes made by code review.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary requirements source | Two defects: missing --run on artifacts, noisy 404 on artifact |
| implementation/implementation-actual.md | Scope map for review | Three files changed, four implementation steps, all checks claimed passing |
| implementation/apl.json | Implementation summary and evidence | Confirmed three-file scope and clean quality gate results |
| implementation-plan/implementation-plan.md | Step-by-step specification and verification plan | Defined exact changes expected in each file; verification checks CHK-01 through CHK-03 |
| product/product.md | Scope boundaries and exclusions | No auto-resolve on artifacts, no bundle.ts changes, no global handler changes |
| diagnosis/diagnosis-statement.md | Root cause analysis | Confirmed two independent defects with line-level evidence |
| tech-research/tech-research.md | Architecture decision rationale | Option A (pattern replication) chosen; no new abstractions or dependencies |
| repo-guidance.json | Repository scope | helix-cli is the sole change target |
| src/lib/flags.ts | API contract verification | `getFlag` returns `string \| undefined`, does not mutate args array |
| src/lib/http.ts | API contract verification | `hxFetch` supports `queryParams` option; throws on non-retryable HTTP errors |
| src/tickets/bundle.ts | Reference pattern verification | try-catch pattern at lines 54-71 matches artifact.ts implementation |
| src/index.ts | Global error handler context | Catch at lines 95-97 confirms why command-level try-catch is needed |
| dist/tickets/artifacts.js | Compiled output verification | JS output matches TypeScript source intent |
| dist/tickets/artifact.js | Compiled output verification | JS output matches TypeScript source intent |

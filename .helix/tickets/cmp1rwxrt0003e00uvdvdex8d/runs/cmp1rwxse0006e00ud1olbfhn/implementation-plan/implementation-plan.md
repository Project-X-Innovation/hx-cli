# Implementation Plan — BLD-427

## Overview

Single-file change to `src/tickets/artifacts.ts` to add run-ID display and a follow-up command suggestion when the `hlx tickets artifacts` response is empty. The change appends a combined empty-result block after the existing output, reusing the established run-ID resolution pattern from sibling commands (`artifact.ts`, `bundle.ts`). No new dependencies, no signature changes, no server changes.

## Implementation Principles

- **Smallest correct change**: Only the empty-result branch in `artifacts.ts` is modified. The success path remains byte-identical.
- **Pattern reuse**: Follow the `TicketDetail`/`TicketResponse` type duplication and `currentRun?.id ?? runs[0]?.id` resolution pattern already used in `artifact.ts` (lines 5-10, 29-40) and `bundle.ts` (lines 7-13, 33-39).
- **Fail-safe**: The run-ID resolution fetch is wrapped in try/catch so it never crashes the command or causes a non-zero exit.
- **No over-engineering**: No shared utility extraction, no function signature changes, no new modules.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add local types for run-ID resolution | `TicketDetail` and `TicketResponse` type declarations in `artifacts.ts` |
| 2 | Append combined empty-result block with run-ID resolution and follow-up output | New code block at end of `cmdTicketsArtifacts` in `artifacts.ts` |
| 3 | Run quality gates | Clean typecheck and test results |

## Detailed Implementation Steps

### Step 1: Add local types for run-ID resolution

**Goal**: Declare the `TicketDetail` and `TicketResponse` types needed for the ticket-detail fetch, following the codebase convention of local type declarations.

**What to Build**:
- Add two type declarations to `src/tickets/artifacts.ts`, placed after the existing `ArtifactsResponse` type (after line 16) and before the function declaration:
  - `type TicketDetail = { currentRun?: { id: string }; runs: Array<{ id: string }> };`
  - `type TicketResponse = { ticket: TicketDetail };`
- These are identical to the types in `artifact.ts` (lines 5-10) and `bundle.ts` (lines 7-13).

**Verification (AI Agent Runs)**:
- Run `npx tsc --noEmit` — should pass with no errors.

**Success Criteria**:
- `TicketDetail` and `TicketResponse` types exist in `artifacts.ts`.
- Typecheck passes cleanly.

### Step 2: Append combined empty-result block

**Goal**: After the two existing output blocks (items and stepArtifactSummary), add a combined empty-result check that resolves the run ID and prints it with a follow-up command suggestion.

**What to Build**:
- At the end of `cmdTicketsArtifacts` (after the existing stepArtifactSummary block, line 46), add a new block that checks `data.items.length === 0 && data.stepArtifactSummary.length === 0`.
- Inside that block:
  1. Determine the run ID:
     - If `runId` (from `getFlag` on line 19) has a value, use it directly — this is the user-supplied `--run` value (satisfies AC 2).
     - If `runId` is `undefined`, fetch ticket detail via `hxFetch(config, '/tickets/${ticketId}', { basePath: '/api' })` as `TicketResponse`, then resolve via `ticket.currentRun?.id ?? ticket.runs[0]?.id`.
     - Wrap the ticket-detail fetch in a try/catch.
  2. Output logic based on resolution result:
     - **Run ID resolved (user-supplied or fetched)**: Print `\nRun ID: <resolvedRunId>` followed by `Use: hlx tickets artifact <ticket-ref> --run <resolvedRunId> --step <stepId> --repo <repoKey>`.
     - **No runs available** (resolution succeeded but `ticket.currentRun` absent and `ticket.runs` empty): Print `\nNo runs available for this ticket.` with no follow-up suggestion.
     - **Resolution failed** (catch block): Print `\nCould not resolve the run ID for this ticket.` — no follow-up suggestion, no throw, no non-zero exit.
- The existing "No artifacts found.\n" (line 35) and "No step artifacts found." (line 45) messages remain unchanged and will have already printed by the time the combined block runs.

**Key constraints**:
- The existing `const runId = getFlag(args, "--run")` on line 19 is reused. Inside the combined block, declare `let resolvedRunId: string | undefined = runId;` to keep the scope narrow and avoid changing the existing `const`.
- The follow-up suggestion format follows the ticket specification: `Use: hlx tickets artifact <ticket-ref> --run <runId> --step <stepId> --repo <repoKey>` — only the run ID is a concrete value; all other tokens are placeholders.
- The try/catch must NOT rethrow, call `process.exit()`, or retry. The catch block prints the fallback message and allows the function to return normally (exit 0).

**Verification (AI Agent Runs)**:
- Run `npx tsc --noEmit` — should pass with no errors.
- Run `npm test` — all existing 30 tests should still pass.

**Success Criteria**:
- Combined empty-result block exists and is structurally correct.
- Typecheck passes.
- All existing tests pass (success path unchanged).

### Step 3: Run quality gates

**Goal**: Confirm the change passes all configured quality gates.

**What to Build**: Nothing — this is a verification-only step.

**Verification (AI Agent Runs)**:
- Run `npx tsc --noEmit` — zero errors.
- Run `npm test` — 30/30 tests pass.

**Success Criteria**:
- Typecheck: zero errors.
- Tests: all pass, no regressions.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects Checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 installed | available | `package.json` engines field; sandbox environment | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06 |
| `npm install` completed | available | dev setup configuration | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06 |
| TypeScript compiler (`tsc`) available | available | devDependency `typescript: ^6.0.2` in package.json | CHK-01, CHK-02 |
| `.env` file with `HELIX_API_KEY` and `HELIX_URL` written to repo root | available | dev setup configuration provides values | CHK-03, CHK-04, CHK-05, CHK-06 |
| A real ticket ID accessible via the configured `HELIX_URL` staging API | unknown | depends on staging server state and available test tickets | CHK-03, CHK-04, CHK-05, CHK-06 |
| `hlx` CLI runnable via `node dist/index.js` after build | available | package.json `bin` field points to `dist/index.js` | CHK-03, CHK-04, CHK-05, CHK-06 |

### Required Checks

[CHK-01] TypeScript compilation succeeds with no errors.
- Action: Run `npx tsc --noEmit` from the helix-cli repo root.
- Expected Outcome: Exit code 0, no type errors reported.
- Required Evidence: Full command output showing zero errors.

[CHK-02] All existing tests pass without regressions.
- Action: Run `npm test` from the helix-cli repo root.
- Expected Outcome: All 30 tests pass (exit code 0). No test failures or new errors.
- Required Evidence: Full test runner output showing pass count and exit code.

[CHK-03] Empty-result output includes run ID and follow-up suggestion.
- Action: Build the CLI (`npm run build`), then run `node dist/index.js tickets artifacts <ticket-ref>` against a real ticket (via the staging API configured in `.env`) whose artifacts response is empty (e.g., a ticket in DEPLOYED or FAILED status).
- Expected Outcome: Output includes "No artifacts found." and "No step artifacts found." followed by a line `Run ID: <some-run-id>` and a line `Use: hlx tickets artifact <ticket-ref> --run <some-run-id> --step <stepId> --repo <repoKey>` where `<some-run-id>` is a concrete resolved value and the other tokens are placeholders.
- Required Evidence: Full command stdout showing the run ID line and the follow-up suggestion line.

[CHK-04] Explicit `--run` value is echoed exactly in empty-result output.
- Action: Run `node dist/index.js tickets artifacts <ticket-ref> --run fake-run-id-12345` against the staging API (any ticket — the response will likely be empty for a non-existent run ID).
- Expected Outcome: Output includes `Run ID: fake-run-id-12345` and the follow-up suggestion uses `fake-run-id-12345` as the run ID. No other run ID appears in the output.
- Required Evidence: Full command stdout showing the exact user-supplied run ID echoed back.

[CHK-05] Success-path output is unchanged.
- Action: Run `node dist/index.js tickets artifacts <ticket-ref>` against a real ticket whose artifacts response is non-empty (has items or step-artifact summaries).
- Expected Outcome: Output shows "Artifacts:" and/or "Step Artifact Summary:" sections with item details. No "Run ID:" line, no new follow-up suggestion appended.
- Required Evidence: Full command stdout showing the success-path output without any new lines appended.

[CHK-06] Run-ID resolution failure exits 0 with graceful message.
- Action: Run `node dist/index.js tickets artifacts <ticket-ref>` against a ticket whose artifacts response is empty, with the `HELIX_URL` temporarily set to an unreachable URL (e.g., `http://localhost:1`) OR by passing a `--run` flag that makes the artifacts response empty so the combined block runs but the ticket-detail fetch is not needed. As an alternative: verify the code path by inspecting that the try/catch in the combined empty block catches errors from hxFetch, prints `Could not resolve the run ID for this ticket.`, and does not throw or call `process.exit`.
- Expected Outcome: The command exits with code 0. Output includes "No artifacts found." and either the resolved run ID or the fallback message "Could not resolve the run ID for this ticket." — no stack trace, no non-zero exit.
- Required Evidence: Command exit code (captured via `echo $?`) and full stdout/stderr showing no crash.

## Success Metrics

1. `src/tickets/artifacts.ts` is the only file changed.
2. Typecheck (`tsc --noEmit`) passes with zero errors.
3. All 30 existing tests pass without regressions.
4. The empty-result path prints the run ID and follow-up command suggestion.
5. The user-supplied `--run` value is echoed exactly when provided.
6. The success path (non-empty response) output is byte-identical to the current behavior.
7. Run-ID resolution failure results in exit 0 with a graceful note.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | 5 acceptance criteria defining exact behavior: run ID in empty output, --run echoed, success path unchanged, zero-runs handled, graceful failure. |
| scout/scout-summary.md | Codebase analysis | Identified `artifacts.ts` as primary target, run-ID resolution pattern in `artifact.ts`/`bundle.ts`, routing boundary (rawRef not passed), quality gates (tsc, node --test). |
| scout/reference-map.json | Line-level file inventory | Precise line anchors for empty-result branches (L34-35, L44-45), run-ID resolution (artifact.ts L29-40), ArtifactsResponse type (no runId field). |
| diagnosis/diagnosis-statement.md | Root cause and change scope | Confirmed missing code path as root cause; single-file change with combined empty check, run-ID resolution, try/catch. |
| diagnosis/apl.json | Investigation answers | Validated no signature change needed, hxFetch throws requiring try/catch, follow-up uses placeholder tokens with only runId resolved. |
| product/product.md | Product requirements | 6 essential features, single-file scope, future considerations (shared utility, --json). |
| tech-research/tech-research.md | Architecture decision and technical details | Chose Option A (append combined empty block), defined output format, confirmed local type duplication convention, specified variable management (`let resolvedRunId`). |
| tech-research/apl.json | Technical direction validation | Confirmed approach: append block, reuse getFlag, try/catch, local types, no new deps. |
| repo-guidance.json | Repo intent | helix-cli is sole target repo for this CLI-only change. |
| src/tickets/artifacts.ts (direct read) | Verified current implementation | 47-line function; line 19 `const runId`, lines 34-35/44-45 empty messages, line 43 existing suggestion format. |
| src/tickets/artifact.ts (direct read) | Verified run-ID resolution pattern | Lines 5-10 types, lines 29-40 resolution logic with getFlag + ticket-detail fallback. |
| src/tickets/index.ts (direct read) | Verified router dispatch | Line 119: only `resolved.id` passed, not rawRef. No signature change needed. |
| src/lib/http.ts (direct read) | Verified hxFetch throw behavior | Retries 3x, throws Error on failure. Confirms try/catch required. |
| package.json (direct read) | Quality gate commands | `tsc --noEmit` (typecheck), `tsc && node --test dist/**/*.test.js` (test). |

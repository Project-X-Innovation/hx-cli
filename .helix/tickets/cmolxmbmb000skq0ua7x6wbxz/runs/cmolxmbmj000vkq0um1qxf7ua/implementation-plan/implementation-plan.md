# Implementation Plan: Add --run Selection to `hlx tickets artifacts` and Harden Missing Artifact Errors

## Overview

Two independent defects in the helix-cli artifact commands need fixing:

1. **`hlx tickets artifacts` ignores `--run <runId>`**: The `cmdTicketsArtifacts` function lacks an `args` parameter, the router does not forward CLI args, and the `hxFetch` call sends no query params. The server already supports a `runId` query parameter.

2. **`hlx tickets artifact` 404 triggers noisy error**: When a step artifact is missing, the 404 response propagates as a raw HTTP error through the global catch handler, producing confusing output. A command-level try-catch is needed.

Both fixes follow established patterns from sibling commands in the same directory. Three files are changed using only existing utilities. No new dependencies or abstractions.

## Implementation Principles

- **Pattern replication**: Mirror the `--run` flag pattern from `artifact.ts` (lines 29-40) and the try-catch pattern from `bundle.ts` (lines 68-71).
- **Minimal surface**: Only touch `src/tickets/artifacts.ts`, `src/tickets/index.ts`, and `src/tickets/artifact.ts`.
- **No auto-resolve on `artifacts`**: When `--run` is omitted, behavior stays as-is (server default). The `artifacts` command does NOT add fallback logic.
- **Command-level error handling**: Handle 404 at the `artifact.ts` call site, not in `hxFetch` or the global handler.
- **Existing utilities only**: Use `getFlag` from `src/lib/flags.ts` and `queryParams` option on `hxFetch`.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add `--run` flag support to `artifacts` command | Modified `src/tickets/artifacts.ts` with args param, getFlag import, and conditional queryParams |
| 2 | Forward args to `artifacts` in router and update usage text | Modified `src/tickets/index.ts` lines 36 and 79 |
| 3 | Harden 404 error handling in `artifact` command | Modified `src/tickets/artifact.ts` with try-catch around hxFetch call |
| 4 | Verify typecheck and build pass | Clean `tsc --noEmit` and `tsc` output |

## Detailed Implementation Steps

### Step 1: Add `--run` flag support to `src/tickets/artifacts.ts`

**Goal**: Enable `cmdTicketsArtifacts` to accept and forward a `--run <runId>` flag as a query parameter to the server endpoint.

**What to Build**:

Modify `src/tickets/artifacts.ts`:
1. Add import for `getFlag` from `../lib/flags.js` (new import line).
2. Change function signature at line 17 from `(config: HxConfig, ticketId: string)` to `(config: HxConfig, ticketId: string, args: string[])`.
3. After the signature, read the flag: `const runId = getFlag(args, "--run");`
4. Modify the `hxFetch` call at line 18 to conditionally include `queryParams`. When `runId` is defined, pass `queryParams: { runId }`. When `runId` is undefined, do not include `queryParams` (to avoid sending `runId=undefined`).

Reference pattern: `src/tickets/artifact.ts` line 29 uses `getFlag(args, "--run")` and passes the result to `hxFetch` via `queryParams`.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — Confirm no type errors after signature change.
- Inspect the modified file to verify: import added, args param present, getFlag call present, queryParams conditionally included.

**Success Criteria**:
- Function signature includes `args: string[]` parameter.
- `getFlag(args, "--run")` is called and the result is used in `queryParams`.
- `queryParams` only includes `runId` when the flag is provided.
- No type errors.

---

### Step 2: Forward args in router and update usage text in `src/tickets/index.ts`

**Goal**: Ensure the subcommand router passes CLI args to `cmdTicketsArtifacts` and the usage text documents the `--run` option.

**What to Build**:

Modify `src/tickets/index.ts`:
1. At line 36, change the usage text from:
   `hlx tickets artifacts <ticket-id>`
   to:
   `hlx tickets artifacts <ticket-id> [--run <runId>]`
2. At line 79, change the router call from:
   `await cmdTicketsArtifacts(config, ticketId);`
   to:
   `await cmdTicketsArtifacts(config, ticketId, rest);`

Reference pattern: Line 85 already passes `rest` to `cmdTicketsArtifact(config, ticketId, rest)`.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — Confirm the new call signature matches the updated function.
- Inspect line 36 for `[--run <runId>]` in usage text.
- Inspect line 79 for `rest` being passed as third argument.

**Success Criteria**:
- `rest` is forwarded to `cmdTicketsArtifacts` at line 79.
- Usage text at line 36 shows `[--run <runId>]`.
- No type errors.

---

### Step 3: Harden 404 error handling in `src/tickets/artifact.ts`

**Goal**: Prevent raw HTTP 404 errors from propagating to the global handler when a step artifact is missing. Instead, print a clean user-facing message.

**What to Build**:

Modify `src/tickets/artifact.ts`:
1. Wrap the `hxFetch` call at lines 42-45 in a try-catch block.
2. In the catch block:
   - Print a clean, contextual error message via `console.error`, e.g.: `Error: Could not fetch artifact for step "${stepId}" in repo "${repoKey}".`
   - Optionally include the original error message for debugging context (e.g., on a second line).
   - Call `process.exit(1)`.

This prevents the raw `HTTP 404 Not Found — {"error":"No artifacts found..."}` from reaching the global handler and eliminates the Node assertion failure trigger.

Reference pattern: `src/tickets/bundle.ts` lines 68-71:
```typescript
} catch {
  console.error(`Warning: Could not fetch artifact for step=${entry.stepId} repo=${entry.repoKey}`);
}
```

The `artifact` command version should exit with code 1 (since this is the primary operation, not a loop iteration), and should include the step/repo context in the message.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — Confirm no type errors.
- Inspect the modified file to verify: try-catch wraps the hxFetch call, catch block has console.error with step/repo context, process.exit(1) is called.

**Success Criteria**:
- `hxFetch` call at lines 42-45 is wrapped in try-catch.
- Catch block prints a clean error message naming the step and repo.
- `process.exit(1)` is called in the catch block.
- No type errors.

---

### Step 4: Verify typecheck and build

**Goal**: Confirm all changes pass the project's quality gates.

**What to Build**: No code changes — verification only.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — Must exit 0 with no errors.
- `npm run build` — Must exit 0 with no errors.

**Success Criteria**:
- `tsc --noEmit` passes cleanly.
- `tsc` (build) passes cleanly and produces updated files in `dist/`.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|-----------------|----------------|
| Node.js >= 18 installed | available | `package.json` engines field; workspace environment | CHK-01, CHK-02, CHK-03 |
| npm dependencies installed (`npm install`) | available | workspace setup | CHK-01, CHK-02, CHK-03 |
| TypeScript compiler (`tsc`) available via npm scripts | available | `package.json` scripts: `build: "tsc"`, `typecheck: "tsc --noEmit"` | CHK-01, CHK-02 |
| Helix API server for live CLI testing | unknown | No dev setup config provided; no runtime inspection available | CHK-03 |

### Required Checks

[CHK-01] **TypeScript typecheck passes with no errors**
- Action: Run `npm run typecheck` (which executes `tsc --noEmit`) from the helix-cli repository root.
- Expected Outcome: Command exits with code 0 and produces no error output.
- Required Evidence: Full command output showing zero errors, or empty stderr with exit code 0.

[CHK-02] **TypeScript build compiles successfully**
- Action: Run `npm run build` (which executes `tsc`) from the helix-cli repository root.
- Expected Outcome: Command exits with code 0, producing compiled JavaScript files in `dist/`.
- Required Evidence: Command output showing successful compilation and exit code 0.

[CHK-03] **Source code implements both defect fixes correctly**
- Action: Read the three modified files (`src/tickets/artifacts.ts`, `src/tickets/index.ts`, `src/tickets/artifact.ts`) and verify each change against the specification:
  - `artifacts.ts`: (a) imports `getFlag` from `../lib/flags.js`, (b) function signature includes `args: string[]` parameter, (c) calls `getFlag(args, "--run")`, (d) passes `runId` conditionally via `queryParams` to `hxFetch`.
  - `index.ts`: (a) line 36 usage text includes `[--run <runId>]` for the artifacts subcommand, (b) line 79 router call passes `rest` as the third argument to `cmdTicketsArtifacts`.
  - `artifact.ts`: (a) `hxFetch` call is wrapped in try-catch, (b) catch block prints a clean error message including step and repo context, (c) catch block calls `process.exit(1)`.
- Expected Outcome: All six sub-checks (a-d for artifacts.ts, a-b for index.ts, a-c for artifact.ts) are confirmed present in the source.
- Required Evidence: Excerpts from each modified file showing the specific changed lines that satisfy each sub-check.

## Success Metrics

| # | Metric | How to Verify |
|---|--------|---------------|
| 1 | `hlx tickets artifacts <ticket-id> --run <runId>` sends `runId` as a query parameter | Source inspection confirms queryParams includes runId when flag is provided (CHK-03) |
| 2 | `hlx tickets artifacts <ticket-id>` (without --run) behavior unchanged | Source inspection confirms queryParams is only set when runId is defined (CHK-03) |
| 3 | `hlx tickets artifact` for missing artifact shows clean error | Source inspection confirms try-catch with contextual error message (CHK-03) |
| 4 | Usage text shows `[--run <runId>]` for artifacts subcommand | Source inspection confirms updated usage string (CHK-03) |
| 5 | `tsc --noEmit` passes with no errors | CHK-01 |
| 6 | `tsc` build passes with no errors | CHK-02 |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement | Two defects: missing --run on artifacts, noisy 404 on artifact |
| scout/scout-summary.md | File-level analysis and established patterns | Identified all change surfaces, reference patterns in sibling commands, build gates |
| scout/reference-map.json | Detailed evidence with line-level citations | Confirmed function signatures, missing args forwarding, error propagation path, 3 unknowns |
| diagnosis/diagnosis-statement.md | Root cause analysis | Three-file change scope, two independent defects, five success criteria |
| diagnosis/apl.json | Structured diagnosis with evidence chains | Validated root causes; confirmed both fixes follow existing patterns |
| product/product.md | Product spec with scope and exclusions | No auto-resolve on artifacts, no bundle.ts changes, no global handler changes |
| tech-research/tech-research.md | Architecture decision and technical details | Chose Option A (pattern replication); confirmed no new dependencies or abstractions |
| tech-research/apl.json | Structured tech decisions | Validated approach: command-level try-catch, optional passthrough queryParams, pattern replication |
| repo-guidance.json | Repository role classification | helix-cli is sole change target |
| src/tickets/artifacts.ts | Direct source verification | Confirmed: no args param (line 17), no queryParams (line 18), 42 lines total |
| src/tickets/artifact.ts | Direct source verification | Confirmed: --run pattern (lines 29-40), unguarded hxFetch (lines 42-45), 59 lines total |
| src/tickets/index.ts | Direct source verification | Confirmed: line 79 doesn't pass rest, line 36 missing --run, line 85 shows correct pattern |
| src/lib/http.ts | Direct source verification | Confirmed: queryParams support (lines 46-49), 404 → throw (lines 101-103) |
| src/lib/flags.ts | Direct source verification | Confirmed: getFlag returns string or undefined (lines 5-8) |
| src/tickets/bundle.ts | Direct source verification | Confirmed: try-catch at lines 68-71 with console.error warning |
| src/index.ts | Direct source verification | Confirmed: global catch at lines 95-97 |
| package.json | Build scripts and dependencies | Build: tsc, typecheck: tsc --noEmit, no runtime deps |

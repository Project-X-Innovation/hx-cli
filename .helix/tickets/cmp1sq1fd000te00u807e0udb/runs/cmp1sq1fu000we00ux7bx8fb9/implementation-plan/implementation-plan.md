# Implementation Plan — BLD-430

## Overview

Fix `hlx tickets bundle` to produce a populated artifact archive for tickets in `PREVIEW_READY` and other non-active statuses. The root cause is that `bundle.ts` line 43 fetches the artifact summary endpoint without passing the already-resolved `runId` as a query parameter. For non-active statuses, the server requires this parameter. The fix passes `runId` to the summary call and adds a `--run` flag for explicit override, matching sibling commands.

**Files changed:** `src/tickets/bundle.ts`, `src/tickets/index.ts`

## Implementation Principles

- **Smallest correct change:** Only add the missing `queryParams` and the `--run` flag — no refactoring, type expansion, or architectural changes.
- **Pattern consistency:** Follow the established `getFlag` + `hxFetch` queryParams patterns already used by `artifacts.ts` and `artifact.ts`.
- **No regression:** Active-status tickets continue to work because the server handles `runId` for all statuses.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add `getFlag` import and `--run` flag parsing to `bundle.ts` | Updated import + flag parsing before runId resolution |
| 2 | Pass `runId` to artifact summary call in `bundle.ts` | `queryParams: { runId }` added to the hxFetch call at line 43 |
| 3 | Update usage string and help text in `index.ts` | `[--run <runId>]` added to bundle's usage and help |
| 4 | Run quality gates | Build, typecheck, and tests pass |

## Detailed Implementation Steps

### Step 1: Add `getFlag` import and `--run` flag parsing to `bundle.ts`

**Goal:** Enable bundle to accept an optional `--run` flag and use it with precedence over auto-resolved runId.

**What to Build:**

In `src/tickets/bundle.ts`:

1. **Line 5** — Change the import from:
   ```ts
   import { requireFlag } from "../lib/flags.js";
   ```
   to:
   ```ts
   import { requireFlag, getFlag } from "../lib/flags.js";
   ```

2. **After line 30** (the `requireFlag` call for `--out`) — Add `--run` flag parsing:
   ```ts
   const explicitRunId = getFlag(args, "--run");
   ```

3. **Line 36** — Change the runId resolution to prefer the explicit flag value:
   ```ts
   const runId = explicitRunId ?? ticket.currentRun?.id ?? ticket.runs[0]?.id;
   ```
   This gives `--run` precedence over auto-resolution, matching the pattern in `artifact.ts:29-35`.

**Verification (AI Agent Runs):**
- `npx tsc --noEmit` passes with no type errors.

**Success Criteria:**
- `getFlag` is imported alongside `requireFlag`.
- `explicitRunId` is parsed from `--run` flag before runId resolution.
- `runId` resolution chain is `explicitRunId ?? ticket.currentRun?.id ?? ticket.runs[0]?.id`.

### Step 2: Pass `runId` to artifact summary call in `bundle.ts`

**Goal:** Fix the root cause — the artifact summary endpoint receives `runId` so it returns populated data for non-active statuses.

**What to Build:**

In `src/tickets/bundle.ts`, **line 43** — Change the hxFetch call from:
```ts
const artifacts = (await hxFetch(config, `/tickets/${ticketId}/artifacts`, { basePath: "/api" })) as ArtifactsResponse;
```
to:
```ts
const artifacts = (await hxFetch(config, `/tickets/${ticketId}/artifacts`, {
  basePath: "/api",
  queryParams: { runId },
})) as ArtifactsResponse;
```

The `runId` is always non-null at this point (guarded by the exit at line 37-40), so unconditional passing is safe and simpler than the conditional spread pattern in `artifacts.ts`.

**Verification (AI Agent Runs):**
- `npx tsc --noEmit` passes with no type errors.

**Success Criteria:**
- The hxFetch call for `/tickets/${ticketId}/artifacts` includes `queryParams: { runId }`.
- `runId` is passed unconditionally (not conditionally).

### Step 3: Update usage string and help text in `index.ts`

**Goal:** Document the new `--run` flag in bundle's usage and help output, matching sibling commands.

**What to Build:**

In `src/tickets/index.ts`:

1. **Line 27** — Change:
   ```
   hlx tickets bundle <ticket-ref> --out <dir>
   ```
   to:
   ```
   hlx tickets bundle <ticket-ref> --out <dir> [--run <runId>]
   ```

2. **Line 136** — Change the help text in the `case "bundle"` block from:
   ```ts
   console.log("Usage: hlx tickets bundle <ticket-ref> --out <dir>\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
   ```
   to:
   ```ts
   console.log("Usage: hlx tickets bundle <ticket-ref> --out <dir> [--run <runId>]\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
   ```

**Verification (AI Agent Runs):**
- `npx tsc --noEmit` passes with no type errors.

**Success Criteria:**
- Usage string at line 27 includes `[--run <runId>]`.
- Help text at line 136 includes `[--run <runId>]`.
- Both match the pattern used by `artifacts` (line 25) and `artifact` (line 26).

### Step 4: Run quality gates

**Goal:** Confirm no regressions from the changes.

**What to Build:** Nothing — this is a verification-only step.

**Verification (AI Agent Runs):**
- `npm run build` — TypeScript compilation succeeds.
- `npm run typecheck` — No type errors.
- `npm test` — All existing tests pass.

**Success Criteria:**
- All three commands exit with code 0.
- No new warnings or errors in output.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 | available | `package.json` engines field; sandbox environment | CHK-01, CHK-02, CHK-03, CHK-04 |
| npm dependencies installed | available | Run `npm install` in repo root | CHK-01, CHK-02, CHK-03, CHK-04 |
| TypeScript compiler | available | `devDependencies` in `package.json`: `typescript: ^6.0.2` | CHK-01, CHK-02, CHK-03 |
| HELIX_API_KEY and HELIX_URL env vars | available | Dev setup config provides `.env` values | CHK-04 |
| Network access to Helix staging API | unknown | Required to call live API for bundle verification | CHK-04 |
| Known PREVIEW_READY ticket with artifacts | unknown | Ticket `cmp1jfwt5002lmo0tts95de2q` (BLD-425) referenced in ticket description | CHK-04 |

### Required Checks

[CHK-01] TypeScript build succeeds
- Action: Run `npm run build` in the helix-cli repository root.
- Expected Outcome: `tsc` compiles all `.ts` files to `dist/` with exit code 0, no errors.
- Required Evidence: Command output showing successful compilation with exit code 0.

[CHK-02] TypeScript typecheck passes
- Action: Run `npm run typecheck` in the helix-cli repository root.
- Expected Outcome: `tsc --noEmit` exits with code 0, no type errors reported.
- Required Evidence: Command output confirming zero errors with exit code 0.

[CHK-03] Existing tests pass
- Action: Run `npm test` in the helix-cli repository root.
- Expected Outcome: All existing tests (flags.test.ts, resolve-ticket.test.ts) pass. Exit code 0.
- Required Evidence: Test runner output showing all tests passed and exit code 0.

[CHK-04] Bundle command produces artifacts for a PREVIEW_READY ticket
- Action: Write the `.env` file with `HELIX_API_KEY` and `HELIX_URL` from dev setup config. Build the CLI with `npm run build`. Run `node dist/index.js tickets bundle cmp1jfwt5002lmo0tts95de2q --out /tmp/bundle-test` against the staging API using ticket `cmp1jfwt5002lmo0tts95de2q` (BLD-425, status PREVIEW_READY).
- Expected Outcome: The command produces a populated output directory with `ticket.json`, `manifest.json`, and one or more artifact files. The final console output reports more than 0 artifact file(s).
- Required Evidence: Command stdout showing the artifact file count > 0, plus directory listing of `/tmp/bundle-test` showing `ticket.json`, `manifest.json`, and at least one file under `artifacts/`.

## Success Metrics

1. `hlx tickets bundle <ticket-ref> --out <dir>` produces a non-empty archive for PREVIEW_READY tickets.
2. The `--run` flag is available and documented in usage/help output.
3. Build, typecheck, and all existing tests pass.
4. Only two files are modified: `src/tickets/bundle.ts` and `src/tickets/index.ts`.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Problem statement, repro steps, concrete ticket references | PREVIEW_READY tickets return empty summary without runId; BLD-425 (`cmp1jfwt5002lmo0tts95de2q`) as test target |
| `scout/reference-map.json` | File inventory with per-line analysis | Confirmed bundle.ts:43 omits runId; artifacts.ts:20-22 includes it; no bundle tests exist |
| `scout/scout-summary.md` | Consolidated code comparison table | Confirmed exact code differences between bundle, artifacts, artifact commands |
| `diagnosis/diagnosis-statement.md` | Root cause trace and success criteria | Root cause is missing queryParams at bundle.ts:43; runId is resolved but not passed |
| `diagnosis/apl.json` | Structured answers with evidence chains | Alternative causes disconfirmed; server API works correctly with runId |
| `product/product.md` | MVP requirements and design principles | Always pass runId + add --run flag + preserve active-ticket behavior |
| `tech-research/tech-research.md` | Architecture decision and technical details | Option A (always pass runId) chosen; unconditional pass preferred over conditional spread |
| `tech-research/apl.json` | Technical decision rationale | Confirmed no regression risk; --run flag pattern from artifact.ts |
| `repo-guidance.json` | Repo intent classification | helix-cli is sole target repo |
| `src/tickets/bundle.ts` (direct) | Verified current code at root cause location | Line 43 has no queryParams; line 36 resolves runId; line 5 imports only requireFlag |
| `src/tickets/index.ts` (direct) | Verified usage strings and help text | Line 27 bundle usage lacks --run; line 136 help text lacks --run |
| `src/tickets/artifacts.ts` (direct) | Working pattern reference | Line 19-22: getFlag + conditional queryParams spread |
| `src/tickets/artifact.ts` (direct) | --run flag pattern reference | Line 29: getFlag for --run; lines 32-39: fallback resolution |
| `src/lib/flags.ts` (direct) | Flag utility signatures | getFlag returns `string \| undefined`; requireFlag exits on missing |
| `package.json` (direct) | Build/test scripts | build=tsc, typecheck=tsc --noEmit, test=tsc && node --test |

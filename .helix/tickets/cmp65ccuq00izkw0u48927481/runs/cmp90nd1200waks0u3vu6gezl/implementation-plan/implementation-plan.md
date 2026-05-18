# Implementation Plan — FIX-467: Conflict Resolution (helix-cli)

## Overview

This is a **conflict resolution run** for `helix-cli`. The collateral merge conflict in `src/tickets/index.ts` (HLX-342 CLI improvements vs staging) is already fully resolved. Zero conflict markers remain. No code changes are needed.

The CLI has no involvement in library credential routing or library repo creation. The only requirement is that the resolved merge compiles correctly.

## Implementation Principles

1. **No code changes**: The collateral conflict is already resolved. Do not modify any source files.
2. **Quality gates only**: Run typecheck to confirm the resolved file compiles correctly. CLI has no lint script.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Install dependencies | `npm install` succeeds |
| 2 | Verify no conflict markers | Grep scan confirms zero markers in tickets/index.ts |
| 3 | Write .env | CLI .env file with required vars |
| 4 | Run quality gates | `npm run typecheck` passes |

## Detailed Implementation Steps

### Step 1: Install Dependencies

**Goal**: Ensure CLI dependencies are installed.

**What to Build**: No code changes.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmp8y06s900s4ks0u4ysut0ef/helix-cli && npm install
```

**Success Criteria**: `npm install` completes successfully.

---

### Step 2: Verify No Conflict Markers Remain

**Goal**: Confirm the resolved file has zero conflict markers.

**What to Build**: No code changes. Verification scan only.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmp8y06s900s4ks0u4ysut0ef/helix-cli
grep -rn '<<<<<<<\|=======\|>>>>>>>' src/tickets/index.ts || echo "CLEAN"
```

**Success Criteria**: "CLEAN" output — zero conflict markers.

---

### Step 3: Write .env

**Goal**: Set up CLI environment variables.

**What to Build**: Write `.env` file with `HELIX_API_KEY` and `HELIX_URL` from dev setup config.

**Verification (AI Agent Runs)**:
```bash
cat /vercel/sandbox/workspaces/cmp8y06s900s4ks0u4ysut0ef/helix-cli/.env | grep -c 'HELIX_API_KEY\|HELIX_URL'
```

**Success Criteria**: `.env` file exists with both variables.

---

### Step 4: Run Quality Gates

**Goal**: Confirm CLI compiles after collateral conflict resolution.

**What to Build**: No code changes. Quality gate execution only.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmp8y06s900s4ks0u4ysut0ef/helix-cli
npm run typecheck
```

**Success Criteria**: Command exits 0. (CLI has no lint script.)

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| `npm install` for helix-cli | available | Standard dev setup | [CHK-01] |
| `.env` with `HELIX_API_KEY` and `HELIX_URL` | available | Dev setup config | [CHK-01] |

### Required Checks

[CHK-01] CLI TypeScript type checking passes.
- Action: Run `cd /vercel/sandbox/workspaces/cmp8y06s900s4ks0u4ysut0ef/helix-cli && npm run typecheck` against the current codebase after `npm install`.
- Expected Outcome: Exit code 0 with no type errors.
- Required Evidence: Terminal output showing successful completion with exit code 0.

## Success Metrics

1. Zero conflict markers in `src/tickets/index.ts`.
2. `npm run typecheck` exits 0.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `diagnosis/diagnosis-statement.md` (cli) | CLI conflict scope | Collateral conflict resolved; no library involvement |
| `scout/reference-map.json` (cli) | File structure and quality gates | index.ts is 149 lines; typecheck = tsc --noEmit; no lint script |
| `.helix/merge-conflicts.json` (cli) | Conflict file list | index.ts — 4 ticket vs 1 staging commit; already resolved |
| Conflict marker grep (index.ts) | Direct verification | Zero matches confirmed |

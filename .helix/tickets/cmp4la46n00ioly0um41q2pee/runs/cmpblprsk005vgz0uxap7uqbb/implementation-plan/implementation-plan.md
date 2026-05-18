# Implementation Plan — Conflict Resolution (helix-cli)

## Overview

This is a **conflict resolution run**. The staging refresh introduced a merge conflict in `src/tickets/index.ts` between the ticket branch (library CLI + ticket lookup, 4 commits) and the staging branch (ticket command updates, 1 commit). The conflict has been **pre-resolved** — zero conflict markers remain. No source code changes are required. The implementation step must verify the resolved state is correct and the build passes cleanly.

## Implementation Principles

1. **No code changes** — Conflicts are already resolved; do not modify any source files.
2. **Verify, don't re-implement** — Confirm the resolved merge preserves both intents via build verification.
3. **Minimal touch** — Only the 1 file listed in `merge-conflicts.json` (`src/tickets/index.ts`) is in scope.
4. **Build is the gate** — TypeScript compilation is the primary correctness signal.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Confirm no conflict markers in resolved file or repo-wide | Grep verification output showing 0 markers |
| 2 | Install dependencies | `npm install` completes without errors |
| 3 | Run TypeScript build | `npm run build` passes with zero errors |

## Detailed Implementation Steps

### Step 1: Verify no conflict markers remain

**Goal**: Confirm `src/tickets/index.ts` and the entire `src/` tree contain zero conflict markers.

**What to Build**: Nothing — verification only.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpblprsk005vgz0uxap7uqbb/helix-cli
grep -rn '<<<<<<<\|=======\|>>>>>>>' src/tickets/index.ts || echo "0 markers in resolved file"
grep -rn '<<<<<<<\|>>>>>>>' src/ --include='*.ts' || echo "0 markers repo-wide"
```

**Success Criteria**: Both commands return 0 matches.

### Step 2: Install dependencies

**Goal**: Ensure all npm dependencies are installed.

**What to Build**: Nothing — run `npm install`.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpblprsk005vgz0uxap7uqbb/helix-cli
npm install
```

**Success Criteria**: Exits with code 0.

### Step 3: Run TypeScript build

**Goal**: Confirm the resolved merge produces a clean TypeScript build.

**What to Build**: Nothing — run the build command.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpblprsk005vgz0uxap7uqbb/helix-cli
npm run build
```

**Success Criteria**: Exits with code 0, zero TypeScript errors.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|-----------------|----------------|
| Node.js runtime available | available | Sandbox environment | [CHK-01], [CHK-02], [CHK-03] |
| npm dependencies installable | available | package.json + package-lock.json present in repo | [CHK-02], [CHK-03] |
| Source files in pre-resolved state | available | Diagnosis confirmed 0 conflict markers in all source files | [CHK-01] |

### Required Checks

[CHK-01] Verify zero conflict markers in resolved file and repo-wide.
- Action: Run `grep -rn '<<<<<<<\|=======\|>>>>>>>' src/tickets/index.ts` and `grep -rn '<<<<<<<\|>>>>>>>' src/ --include='*.ts'` from the helix-cli repo root.
- Expected Outcome: Both commands return zero matches (exit code 1 from grep indicating no matches).
- Required Evidence: Command output showing empty results or explicit "no matches" for both grep commands.

[CHK-02] Verify TypeScript build passes.
- Action: Run `npm install && npm run build` from the helix-cli repo root at `/vercel/sandbox/workspaces/cmpblprsk005vgz0uxap7uqbb/helix-cli`.
- Expected Outcome: Build completes with exit code 0 and zero TypeScript errors.
- Required Evidence: Terminal output of the build command showing successful completion with exit code 0.

[CHK-03] Verify resolved file preserves both ticket and staging intents.
- Action: Read `src/tickets/index.ts` and confirm: (a) all 10 subcommand handler imports are present (list, latest, get, create, rerun, continue, artifacts, artifact, bundle, update-description); (b) the switch-case dispatcher routes all subcommands correctly; (c) ticket resolution utilities (`extractTicketRef`, `resolveTicket`) are imported and used for subcommands that need them.
- Expected Outcome: All 10 imports present (lines 4-14), switch statement has cases for all 10 subcommands, and `resolveTicket` is used for ref-based commands.
- Required Evidence: File content excerpt showing the import block (lines 1-14) and the switch statement (lines 43-148).

## Success Metrics

| Metric | Target |
|--------|--------|
| Conflict markers remaining | 0 |
| TypeScript build errors | 0 |
| Files modified during this step | 0 (no source changes needed) |
| Both merge intents preserved | Yes — ticket subcommand dispatch + library CLI integration intact |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `.helix/merge-conflicts.json` (CLI) | Identified the single conflicted file | `src/tickets/index.ts` between 4 ticket + 1 staging commit |
| `diagnosis/diagnosis-statement.md` (CLI) | Confirmed pre-resolved state | Zero conflict markers; both intents preserved by inspection |
| `product/product.md` (client, shared) | Scope definition | Conflict resolution only — build verification is the gate |
| `tech-research/tech-research.md` (client, shared) | Chosen approach: no-op with build verify | TypeScript build is the primary correctness signal |
| `repo-guidance.json` (client, shared) | Repo intent: target for build verification | All 3 repos need build confirmation |
| `scout/scout-summary.md` (CLI) | File state and conflict sweep results | tickets/index.ts clean; all 6 library CLI files present |
| `ticket.md` (CLI) | Research report context | CLI Phase 2b fully implemented; this run resolves staging conflict |
| `src/tickets/index.ts` (direct read) | Verified resolved file content | 150 lines; all 10 subcommand imports present; standard dispatch logic intact |

# Implementation Plan: Conflict Resolution — helix-cli

## Overview

This is a **conflict resolution run** after a staging refresh merge. `merge-conflicts.json` lists `src/tickets/index.ts` as the sole conflicted file (4 ticket commits vs 1 staging commit). The auto-merge has already resolved the conflict — **zero conflict markers remain**.

The conflicted file is the ticket subcommand dispatcher, which is **unrelated to the library CLI module** (`src/library/`). All library CLI implementation files (module router, list, show, comments router, comments-list, comments-post, resolver utility, SKILL.md) are separate and unaffected.

**Required action**: Verify zero conflict markers, install dependencies, and run the TypeScript build.

## Implementation Principles

1. **No source code changes** — the auto-merge resolved cleanly; the conflicted file is a ticket dispatcher unrelated to library commands.
2. **Build verification as primary gate** — `npm run build` runs `tsc`, catching any import or type breakages from the merge.
3. **Feature files untouched** — all 6 library command files in `src/library/` and the library dispatcher registration in `src/index.ts` were only on the ticket side and not involved in any conflict.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Verify zero conflict markers in conflicted file and repo-wide | Grep confirmation output |
| 2 | Install dependencies | `node_modules` up to date |
| 3 | Run TypeScript build | Clean `npm run build` output |

## Detailed Implementation Steps

### Step 1: Verify Zero Conflict Markers

**Goal**: Confirm `src/tickets/index.ts` and all source files contain no conflict markers.

**What to Build**: No code changes. Grep verification only.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpc2n3y00073ml0u2yya9ah5/helix-cli
grep -rn '<<<<<<<\|=======\|>>>>>>>' src/tickets/index.ts || echo "PASS: No markers in conflicted file"
grep -rn '<<<<<<<\|=======\|>>>>>>>' --include='*.ts' --exclude-dir=node_modules --exclude-dir=.helix src/ || echo "PASS: No markers in any source file"
```

**Success Criteria**: Zero matches in source files.

### Step 2: Install Dependencies

**Goal**: Ensure `node_modules` are current after the staging refresh.

**What to Build**: No code changes. Run npm install.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpc2n3y00073ml0u2yya9ah5/helix-cli
npm install
```

**Success Criteria**: Install completes with exit code 0.

### Step 3: Run TypeScript Build

**Goal**: Confirm the auto-merged codebase compiles cleanly.

**What to Build**: No code changes. Run the build.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpc2n3y00073ml0u2yya9ah5/helix-cli
npm run build
```

**Success Criteria**: `tsc` exits with code 0 and zero errors.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|----------------|----------------|
| Node.js runtime | available | Sandbox environment | CHK-01, CHK-02 |
| npm dependencies installable | available | `package.json` present, no new deps required | CHK-01, CHK-02 |
| TypeScript compiler (tsc) | available | Part of devDependencies | CHK-02 |
| Source files in pre-resolved state | available | Diagnosis confirmed 0 conflict markers in all source files | CHK-01, CHK-02, CHK-03 |

### Required Checks

[CHK-01] Verify zero conflict markers in all source files.
- Action: Run `grep -rn '<<<<<<<\|=======\|>>>>>>>' --include='*.ts' --exclude-dir=node_modules --exclude-dir=.helix src/` in the repo root at `/vercel/sandbox/workspaces/cmpc2n3y00073ml0u2yya9ah5/helix-cli`.
- Expected Outcome: Zero matches. No conflict markers in any source file.
- Required Evidence: Command output showing zero matches or explicit "no matches" message.

[CHK-02] TypeScript build passes with zero errors.
- Action: Run `npm install && npm run build` in the repo root.
- Expected Outcome: `tsc` completes with exit code 0 and zero TypeScript errors.
- Required Evidence: Full command output showing successful compilation with exit code 0.

[CHK-03] Verify resolved file preserves both ticket and staging intents.
- Action: Read `src/tickets/index.ts` and confirm: (a) all 10 subcommand handler imports are present (list, latest, get, create, rerun, continue, artifacts, artifact, bundle, update-description); (b) the switch-case dispatcher routes all subcommands correctly.
- Expected Outcome: All 10 subcommand imports and dispatch cases are present. Library module registration at `src/index.ts` lines 98-102 is intact.
- Required Evidence: File content showing the import block and switch statement with all 10 subcommands, plus grep output of `library` case in `src/index.ts`.

## Success Metrics

1. Zero conflict markers in all source files.
2. `npm run build` exits with code 0 and zero errors.
3. Both ticket-side (library CLI, ticket lookup) and staging-side changes preserved in the resolved file.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (Research Report) | Primary spec for Phase 2b CLI | All 9 CLI steps complete from prior iterations |
| ticket.md (Discussion) | Feedback history | CLI feature-complete; conflict is in unrelated ticket dispatcher |
| merge-conflicts.json | Conflict declaration | Single file: `tickets/index.ts` (4 ticket + 1 staging commits) |
| scout/scout-summary.md | CLI feature status and conflict analysis | All 6 library command files intact; tickets/index.ts is subcommand dispatcher |
| diagnosis/diagnosis-statement.md | Conflict root cause | Auto-merge resolved cleanly; library module unaffected |
| repo-guidance.json | Repo intent | CLI = target for conflict resolution |

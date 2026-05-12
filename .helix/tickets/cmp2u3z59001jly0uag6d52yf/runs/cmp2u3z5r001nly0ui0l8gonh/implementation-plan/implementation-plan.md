# Implementation Plan: Clean helix-cli Tracked Dependencies

## Overview

Remove `node_modules` from the Git index on the current run branch so that it is no longer tracked. Verify `.gitignore` already contains `node_modules/`. No code changes, no dependency changes, no `.gitignore` modifications needed -- this is purely a Git index cleanup.

## Implementation Principles

- **Index cleanup only**: Use `git rm -r --cached` to remove from the index without touching disk files.
- **No history rewrite**: Do not use filter-branch or BFG. The server-side fix provides generic protection going forward.
- **Verify before acting**: Check if `node_modules` is actually tracked on the current branch before attempting removal.
- **Preserve .gitignore**: The `node_modules/` rule is already line 1; do not modify it.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Remove node_modules from Git index | Git index cleaned on run branch |
| 2 | Verify .gitignore | Confirmed `node_modules/` present |
| 3 | Run quality gates | Pass typecheck |

## Detailed Implementation Steps

### Step 1: Remove node_modules from Git index

**Goal**: Remove `node_modules` from the Git index on the current run branch if it is tracked.

**What to Build**:

1. Check if `node_modules` is tracked in the Git index:
   ```
   git ls-files --cached node_modules
   ```
   If the output is non-empty, `node_modules` entries are tracked and need removal.

2. If tracked, remove from the index without deleting disk files:
   ```
   git rm -r --cached node_modules
   ```
   This removes all `node_modules` entries from the index. Since `node_modules/` does not exist in the working tree (confirmed by scout), this will record the deletion in the index.

3. If not tracked (empty output from step 1), no action is needed. The run branch may have been created from a state that already had the cleanup, or the tracked state may only exist on other remote branches.

Note: The implementation agent should not fail if `node_modules` is not found in the index -- this is an expected possible state.

**Verification (AI Agent Runs)**:
- Run `git ls-files --cached node_modules` after cleanup -- must return empty output.
- Run `git status` to confirm the removal is staged (if removal was performed).

**Success Criteria**:
- `node_modules` is not tracked in the Git index on the run branch.
- No files were deleted from disk (the `--cached` flag ensures this).

### Step 2: Verify .gitignore

**Goal**: Confirm `.gitignore` contains the `node_modules/` ignore rule.

**What to Build**: Read `.gitignore` and verify `node_modules/` is present. No modifications needed.

Current `.gitignore` content (confirmed by scout):
```
node_modules/
dist/
.env
.env.*
```

**Verification (AI Agent Runs)**:
- Read `.gitignore` and confirm `node_modules/` is present.

**Success Criteria**:
- `.gitignore` contains `node_modules/` as an ignore rule.

### Step 3: Run quality gates

**Goal**: Confirm quality gates pass (no regressions from index cleanup).

**What to Build**: No code; only verification commands.

**Verification (AI Agent Runs)**:
1. `tsc --noEmit` (typecheck) - must exit 0

Note: The index cleanup (removing tracked `node_modules`) should not affect TypeScript compilation since `node_modules` does not exist in the working tree and TypeScript resolves from disk, not the Git index. However, run the check to confirm no regressions.

**Success Criteria**:
- TypeScript typecheck passes with exit code 0.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js installed | available | helix-cli package.json exists | CHK-03 |
| npm dependencies installed (`npm install`) | required | Must run before typecheck | CHK-03 |
| Git available | available | Repo is a git work tree | CHK-01, CHK-02 |
| node_modules tracked state on run branch | unknown | Scout confirms tracked on remote branches; current branch state must be checked at implementation time | CHK-01 |

### Required Checks

[CHK-01] node_modules is not tracked in Git index
- Action: Run `git ls-files --cached node_modules` from the helix-cli repo root.
- Expected Outcome: The command produces empty output (no lines), confirming no `node_modules` entries exist in the Git index.
- Required Evidence: Command output showing empty result (zero lines). If the command produces any output, node_modules is still tracked and the cleanup failed.

[CHK-02] .gitignore contains node_modules/ ignore rule
- Action: Read the file `.gitignore` in the helix-cli repo root.
- Expected Outcome: The file contains `node_modules/` as an ignore rule (currently line 1).
- Required Evidence: File content showing `node_modules/` as a line in `.gitignore`.

[CHK-03] TypeScript typecheck passes
- Action: Run `tsc --noEmit` from the helix-cli repo root.
- Expected Outcome: Command exits with code 0 and produces no type errors.
- Required Evidence: Command exit code and stdout/stderr output showing no errors.

## Success Metrics

1. `node_modules` is not tracked in the Git index on the run branch.
2. `.gitignore` contains `node_modules/` (already present, unchanged).
3. TypeScript typecheck passes.
4. No disk files were deleted (cleanup used `--cached` flag only).

## Cross-Repo Coordination

This plan covers the helix-cli Git index cleanup. The helix-global-server repo has a separate plan for the code change (tracked-ignored-path filter in `commitBranchChanges`). Both must be completed for the ticket to be resolved. The CLI cleanup is independent of and can be implemented before or after the server-side fix.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Scope, constraints, acceptance criteria | Must remove node_modules from index on active branches; .gitignore must have node_modules/ |
| scout/reference-map.json (helix-cli) | Repo state facts | .gitignore has node_modules/; node_modules not on disk; tracked on remote branches |
| scout/scout-summary.md (helix-cli) | Analysis and cleanup approach | git rm -r --cached is the standard approach; branch list unknown |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause | Legacy index state; .gitignore rule already correct |
| diagnosis/apl.json (helix-cli) | Root cause confirmation | git rm --cached per branch; no .gitignore change needed |
| product/product.md (helix-cli) | Cross-repo coordination | Both repos must be fixed; CLI cleanup alone is insufficient |
| tech-research/tech-research.md (helix-cli) | Cleanup approach validation | Option A (git rm --cached) chosen; no history rewrite |
| tech-research/apl.json (helix-cli) | Technical validation | .gitignore already correct; --cached flag operates on index only |
| repo-guidance.json | Repo intent | helix-cli: Git index cleanup (no code changes) |
| .gitignore (direct read) | Verified ignore rule | node_modules/ is line 1; dist/, .env, .env.* also present |

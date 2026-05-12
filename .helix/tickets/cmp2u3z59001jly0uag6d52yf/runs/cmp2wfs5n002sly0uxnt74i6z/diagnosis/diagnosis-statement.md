# Diagnosis Statement — helix-cli

## Problem Summary

`helix-cli` has `node_modules` tracked in the Git index on active remote branches, even though `.gitignore` correctly lists `node_modules/`. This legacy tracked state causes the `helix-global-server` implementation commit phase to fail because `git ls-files -m` reports `node_modules` entries as modified tracked files, which are then included in the staging pathspec and rejected by `git add -A`.

## Root Cause Analysis

**Cause**: `node_modules` was committed to the Git index at some point in the repository's history and was never removed from the index, even after `.gitignore` was updated. Git's ignore rules only prevent new untracked files from being staged — they do not affect files already in the index.

**Effect**: When the helix-global-server workflow runs `git ls-files -m -d -- .` against `helix-cli`, it sees `node_modules` entries as tracked modified files. These end up in the staging pathspec, and `git add -A` fails because the paths match `.gitignore`.

**Fix**: Remove `node_modules` from the Git index using `git rm -r --cached node_modules` on each Helix-relevant base branch, and commit the removal. The `.gitignore` entry (`node_modules/` at line 1) is already correct and needs no modification.

**Note**: This cleanup alone is necessary but not sufficient — the server-side staging logic in `helix-global-server` must also be hardened to handle any future occurrence of tracked-ignored paths generically.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| .gitignore line 1 | `node_modules/` ignore rule already present and correct |
| Scout reference-map | `node_modules` directory does not exist in working tree |
| Scout reference-map | `node_modules` is tracked on remote branches (index state) |
| package.json | Zero runtime dependencies; only devDependencies: @types/node, typescript |

## Success Criteria

1. `node_modules` is removed from the Git index on all active Helix base branches.
2. `.gitignore` retains the `node_modules/` entry (already present, no change needed).
3. The removal is committed as a normal Git change on each affected branch.
4. Future `npm install` does not re-track `node_modules` (ensured by existing `.gitignore` rule).

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/reference-map.json (helix-cli) | Understand repo state and tracked-file issue | node_modules tracked on remote branches; .gitignore already correct; cleanup via `git rm --cached` |
| scout/scout-summary.md (helix-cli) | Confirm analysis and branch verification gap | Branch list requires orchestrator git commands; standard cleanup approach applies |
| helix-cli/.gitignore (direct read) | Verify ignore rule presence | `node_modules/` is line 1 — no change needed |
| ticket.md (helix-global-server) | Understand cross-repo scope and constraints | Both repos must be fixed; cleanup must cover all Helix-relevant branches |

# Scout Summary — helix-cli

## Problem

`helix-cli` has `node_modules` tracked in the Git index on active remote branches, even though `.gitignore` lists `node_modules/`. When the helix-global-server workflow runs against `helix-cli`, `git ls-files -m` reports `node_modules` entries as modified tracked files. These get included in the staging path list passed to `git add -A`, which refuses to stage files matching ignore rules without `-f`, aborting the implementation commit phase.

## Analysis Summary

### Current State
- `.gitignore` already contains `node_modules/` as the first rule (line 1). The ignore rule is present and correct.
- `node_modules` directory does NOT exist in the current working tree — it is only tracked in the Git index on remote branches.
- The repo has zero runtime dependencies (only devDependencies: `@types/node` and `typescript`).

### Required Cleanup
The fix requires removing `node_modules` from the Git index on each Helix-relevant base branch without deleting any local files. The standard approach is `git rm -r --cached node_modules` followed by a commit. This must be applied to every branch Helix may use as a ticket base.

### Repo Structure
- Simple TypeScript CLI project compiled with `tsc` to `dist/`.
- Published to npm via GitHub Actions workflow (`.github/workflows/publish.yml`).
- Two test files: `src/lib/flags.test.ts`, `src/lib/resolve-ticket.test.ts`.
- No ORM, no database, no migrations.

### Branch Verification Gap
Which specific remote branches have `node_modules` tracked cannot be determined by static inspection alone — this requires git commands that are orchestrator-managed. The ticket specifies that each Helix-relevant base branch must be verified explicitly.

## Relevant Files

| File | Role |
|------|------|
| `.gitignore` | Contains `node_modules/` ignore rule (already present) |
| `package.json` | Project metadata; zero runtime deps; quality gate commands |
| `tsconfig.json` | TypeScript config (ES2022, Node16, strict) |
| `.github/workflows/publish.yml` | CI/CD for npm publishing |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli run root) | Understand helix-cli-specific scope and requirements | Must remove node_modules from Git index on all Helix-relevant branches; .gitignore must have node_modules/ |
| .gitignore | Check if node_modules ignore rule already exists | Rule is already present as line 1; issue is tracked-in-index state, not missing ignore rule |
| package.json | Understand project structure, dependencies, and quality gates | Zero runtime deps; test/typecheck/build commands defined |
| Working tree inspection | Check if node_modules exists on disk | Does not exist in working tree; problem is index-only on remote branches |

# Tech Research: Clean helix-cli Tracked Dependencies

## Technology Foundation

- **Repository**: Simple TypeScript CLI compiled with `tsc` to `dist/`
- **Dependencies**: Zero runtime deps; devDependencies only (`@types/node`, `typescript`)
- **CI**: GitHub Actions workflow for npm publishing (`.github/workflows/publish.yml`)
- **Issue**: `node_modules` tracked in Git index on remote branches despite `.gitignore` listing `node_modules/`

## Architecture Decision

### Problem Restatement

`helix-cli` has `node_modules` tracked in the Git index on active remote branches. Even though `.gitignore` correctly lists `node_modules/` as line 1, Git ignore rules only prevent NEW untracked files from being staged — they do not remove files already in the index. When the helix-global-server workflow runs `git ls-files -m -d` against `helix-cli`, `node_modules` entries appear as tracked modified files and cause `git add -A` to fail.

### Options Considered

#### Option A: `git rm -r --cached node_modules` + commit (Chosen)

Remove `node_modules` from the Git index without deleting files from disk, then commit the removal on each affected branch.

**Pros**:
- Standard Git operation for this exact scenario
- Preserves any local `node_modules` on disk (not that any exist currently)
- `.gitignore` rule prevents re-tracking on future `npm install`
- Clean, minimal change — single commit per branch

**Cons**:
- Must be applied to each Helix-relevant branch individually
- Cannot determine affected branches from static inspection alone (orchestrator-managed)

#### Option B: Git filter-branch / history rewrite

Rewrite Git history to remove `node_modules` from all commits.

**Rejected because**: Ticket explicitly states "Broad Git history rewriting across unrelated branches unless strictly required" is out of scope. A simple index removal is sufficient.

#### Option C: Only add `.gitignore` entry

Just ensure `.gitignore` has the rule.

**Rejected because**: `.gitignore` already has `node_modules/` as line 1. The rule is present; the issue is tracked-in-index state. Adding `.gitignore` entries does not untrack files.

### Chosen Approach: Option A

**Rationale**: Standard, minimal, and sufficient. The `.gitignore` rule already exists, so the only action is removing `node_modules` from the index. This is a one-time cleanup per branch.

## Core API/Methods

No code changes in helix-cli. The change is purely a Git index cleanup:

1. **`git rm -r --cached node_modules`** — Removes `node_modules` from the Git index without touching disk files
2. **`git commit`** — Commits the removal as a normal change
3. **Verify `.gitignore`** — Confirm `node_modules/` entry is present (already line 1)

This must be executed on each Helix-relevant base branch.

## Technical Decisions

### 1. Index removal only, no history rewrite

**Decision**: Use `git rm --cached` to remove from index on current branches. Do not rewrite history.

**Rationale**: History rewriting is explicitly out of scope. Index removal on active branches is sufficient — the server-side fix in helix-global-server provides generic protection against any future tracked-ignored paths.

### 2. Branch coverage requires explicit verification

**Decision**: Each Helix-relevant base branch must be verified individually for tracked `node_modules`.

**Rationale**: The ticket specifies "Do not assume one cleaned branch is a proxy for all branches Helix may use." The specific set of affected branches cannot be determined from static inspection and requires orchestrator-managed git commands at implementation time.

### 3. No `.gitignore` changes needed

**Decision**: `.gitignore` already has `node_modules/` as line 1. No modification required.

**Rationale**: Direct file inspection confirms the rule is present and correct. The issue is entirely about index state, not ignore rules.

## Cross-Platform Considerations

Not applicable. Git operations are standard across platforms.

## Performance Expectations

- One-time cleanup operation per branch
- No runtime performance impact — this is a Git repository state fix
- Future `npm install` will NOT re-track `node_modules` thanks to the existing `.gitignore` rule

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| `git rm --cached` | Git command | Standard in all Git versions |
| Orchestrator git command access | Runtime | Required for branch operations |
| helix-global-server fix (FIX-432) | Cross-repo | Server-side filter provides generic protection; CLI cleanup resolves the immediate trigger |

## Deferred to Round 2

| Item | Reason |
|------|--------|
| Audit other repos for tracked-ignored files | Future enhancement; not in scope |
| Pre-commit hook to prevent tracking ignored files | Not required by ticket |

## Summary Table

| Aspect | Decision |
|--------|----------|
| Cleanup method | `git rm -r --cached node_modules` + commit |
| `.gitignore` change | None needed (already has `node_modules/` as line 1) |
| Branch coverage | Each Helix-relevant branch verified individually |
| History rewrite | Not performed (out of scope) |
| Code changes | None |
| New dependencies | None |

## APL Statement Reference

`helix-cli` has `node_modules` tracked in the Git index on active remote branches despite `.gitignore` correctly listing `node_modules/`. The cleanup is `git rm -r --cached node_modules` followed by a commit on each Helix-relevant base branch. No code changes or `.gitignore` modifications are needed. This cleanup resolves the immediate trigger, while the server-side fix in helix-global-server provides generic protection against any future tracked-ignored paths.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Scope and constraints | Must clean all Helix-relevant branches; no history rewrite; both repos required |
| scout/reference-map.json (helix-cli) | Repo state facts | `.gitignore` has `node_modules/`; node_modules not on disk; tracked on remote branches |
| scout/scout-summary.md (helix-cli) | Analysis and cleanup approach | `git rm -r --cached` is the standard approach; branch list requires orchestrator |
| diagnosis/apl.json (helix-cli) | Root cause confirmation | Legacy index state; `.gitignore` rule already correct |
| diagnosis/diagnosis-statement.md (helix-cli) | Fix approach | `git rm -r --cached node_modules` per branch; no `.gitignore` change |
| product/product.md | Cross-repo coordination | Both repos must be fixed; CLI cleanup alone is insufficient |
| helix-cli/.gitignore (direct read) | Verify ignore rule | `node_modules/` is line 1 — confirmed present and correct |
| repo-guidance.json | Repo intent | helix-cli: Git index cleanup (no code changes) |

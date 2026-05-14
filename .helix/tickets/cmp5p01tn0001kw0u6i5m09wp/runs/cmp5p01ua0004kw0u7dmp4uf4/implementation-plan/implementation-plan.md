# Implementation Plan: Automate helix-cli Release Tagging from Version Bumps

## Overview

Create a single new GitHub Actions workflow file (`.github/workflows/auto-tag.yml`) that triggers on pushes to `main`, reads the version from `package.json`, and creates/pushes a `v<version>` Git tag when it does not already exist. The tag push triggers the existing `publish.yml` workflow for npm publication. No existing files are modified.

## Implementation Principles

- **Additive only**: One new file; zero modifications to existing files.
- **Source-of-truth respect**: `package.json` version field is the sole input for tag name.
- **Idempotent**: Tag existence check before creation; safe to re-run.
- **Fail-closed**: Workflow fails on version read errors or tag push failures; exits successfully only when tag is created or already exists.
- **Simplicity**: Minimal shell commands; no third-party actions; no Node.js setup needed.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Create auto-tag workflow file | `.github/workflows/auto-tag.yml` |
| 2 | Validate workflow does not break existing quality gates | Passing typecheck, build, and tests |

## Detailed Implementation Steps

### Step 1: Create `.github/workflows/auto-tag.yml`

**Goal**: Add the auto-tagging workflow that bridges version bumps on `main` to Git tag creation.

**What to Build**:

Create a new file `.github/workflows/auto-tag.yml` with the following structure (pseudocode — implementation agent writes the actual YAML):

1. **Name**: `Auto-tag release`
2. **Trigger**: `on: push: branches: [main]` (no path filter)
3. **Permissions**: `contents: read` (GITHUB_TOKEN scope; PAT handles write)
4. **Job**: `auto-tag` on `ubuntu-latest`
5. **Steps**:
   - **Checkout**: `actions/checkout@v4` with `token: ${{ secrets.RELEASE_TOKEN }}` to persist PAT credentials for git push.
   - **Read version**: Extract version using `jq -r .version package.json`. Fail if result is empty, null, or the command fails.
   - **Check existing tag**: Run `git ls-remote --tags origin "refs/tags/v$VERSION"` to query the remote for the tag. If the tag already exists, log a message and exit 0 (success, no-op).
   - **Create and push tag**: Run `git tag "v$VERSION"` then `git push origin "v$VERSION"`. If either command fails, the step fails (fail-closed).
   - **Summary**: Log a confirmation message indicating the tag was created.

**Key design decisions** (from tech-research):
- `jq` over `node -p`: no Node.js setup needed; `jq` is pre-installed on `ubuntu-latest`.
- `git ls-remote` over local tag check: works with shallow clone (default `fetch-depth: 1`), queries authoritative remote.
- `actions/checkout@v4` to match existing `publish.yml` (not upgrading to v6).
- PAT via `secrets.RELEASE_TOKEN` instead of `GITHUB_TOKEN`: required because GitHub Actions suppresses downstream workflow triggers from `GITHUB_TOKEN`-initiated events. The PAT makes the tag push an "external" event that triggers `publish.yml`.
- No path filter on trigger: idempotency check makes no-op runs essentially free (< 30 seconds).
- `permissions: contents: read` for GITHUB_TOKEN scope (principle of least privilege); the actual write is via PAT.

**Verification (AI Agent Runs)**:
- Confirm `.github/workflows/auto-tag.yml` exists
- Validate YAML syntax: `npx yaml-lint .github/workflows/auto-tag.yml` or use `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/auto-tag.yml'))"`
- Verify `publish.yml` is unchanged: diff against known content

**Success Criteria**:
- File exists at `.github/workflows/auto-tag.yml`
- YAML is syntactically valid
- Workflow triggers on `push: branches: [main]`
- Uses `actions/checkout@v4` with `token: ${{ secrets.RELEASE_TOKEN }}`
- Reads version via `jq -r .version package.json`
- Checks tag existence via `git ls-remote`
- Creates/pushes tag only when absent
- Exits successfully when tag already exists
- Fails when version read fails or tag push fails
- `permissions: contents: read` is set
- `.github/workflows/publish.yml` is unchanged

### Step 2: Validate Quality Gates

**Goal**: Ensure the new file does not break existing build, typecheck, or test pipelines.

**What to Build**: Nothing — this is a validation-only step.

**Verification (AI Agent Runs)**:
- `npm run typecheck` (tsc --noEmit) — should pass (no TypeScript changes)
- `npm run build` (tsc) — should pass (no TypeScript changes)
- `npm test` (tsc && node --test dist/**/*.test.js) — should pass (no test changes)

**Success Criteria**:
- All three quality gate commands exit with code 0
- No regressions in existing functionality

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js and npm installed in sandbox | available | Dev setup config specifies `npm run dev`; package.json exists with scripts | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| `npm ci` or `npm install` completes | available | package.json and package-lock.json present in repo | CHK-03, CHK-04, CHK-05 |
| Python3 with PyYAML or equivalent YAML validator available | unknown | ubuntu-based sandbox likely has python3; PyYAML may need install | CHK-02 |
| `RELEASE_TOKEN` repository secret configured in GitHub | missing | Required for workflow to function at runtime, but not needed for static/build verification; must be created in GitHub repo settings before first real run | CHK-06 |

### Required Checks

[CHK-01] Verify auto-tag workflow file exists with correct structure.
- Action: Read the file `.github/workflows/auto-tag.yml` and inspect its top-level YAML structure.
- Expected Outcome: The file exists and contains: `name` field, `on.push.branches` including `main`, `permissions.contents: read`, a job with `runs-on: ubuntu-latest`, steps using `actions/checkout@v4` with `token: ${{ secrets.RELEASE_TOKEN }}`, a version extraction step using `jq -r .version package.json`, a tag existence check using `git ls-remote`, and a tag create/push step.
- Required Evidence: Full file content showing all required structural elements with line numbers.

[CHK-02] Verify auto-tag workflow YAML is syntactically valid.
- Action: Run a YAML syntax validator against `.github/workflows/auto-tag.yml` (e.g., `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/auto-tag.yml'))"` or equivalent).
- Expected Outcome: The validator exits with code 0 and produces no errors.
- Required Evidence: Command output and exit code from the YAML validation command.

[CHK-03] Verify typecheck passes.
- Action: Run `npm install` (if not already done) then `npm run typecheck` in the repo root.
- Expected Outcome: The command exits with code 0, indicating no TypeScript type errors.
- Required Evidence: Command output and exit code from `npm run typecheck`.

[CHK-04] Verify build passes.
- Action: Run `npm run build` in the repo root.
- Expected Outcome: The command exits with code 0, producing compiled output in `dist/`.
- Required Evidence: Command output and exit code from `npm run build`.

[CHK-05] Verify tests pass.
- Action: Run `npm test` in the repo root.
- Expected Outcome: The command exits with code 0, with all tests passing.
- Required Evidence: Command output and exit code from `npm test`.

[CHK-06] Verify publish.yml is unchanged.
- Action: Compute the diff between the current `.github/workflows/publish.yml` and the version prior to this ticket's changes.
- Expected Outcome: There are zero differences — the file is identical to its pre-change state.
- Required Evidence: Output of a diff command (e.g., `git diff .github/workflows/publish.yml`) showing no changes, or the explicit statement "0 lines changed" from the diff output.

[CHK-07] Verify fail-closed behavior for version read errors.
- Action: Inspect the version extraction step in `.github/workflows/auto-tag.yml` for error handling. Verify the step uses `set -e` or equivalent shell strictness, and explicitly checks for empty/null version output before proceeding.
- Expected Outcome: The workflow step either uses shell strict mode (`set -euo pipefail` or `set -e`) and/or includes an explicit conditional that exits non-zero when the version is empty, null, or the `jq` command fails.
- Required Evidence: The exact lines from the workflow file showing the error handling logic for version extraction, with line numbers.

[CHK-08] Verify idempotent tag handling.
- Action: Inspect the tag existence check step in `.github/workflows/auto-tag.yml`. Verify the step queries the remote via `git ls-remote` and conditionally skips tag creation when the tag already exists, exiting with code 0.
- Expected Outcome: The workflow checks `git ls-remote --tags origin` for the target tag, and when the tag exists, logs a message and exits the job successfully without attempting to create or push a tag.
- Required Evidence: The exact lines from the workflow file showing the tag existence check and the conditional skip logic, with line numbers.

## Success Metrics

1. `.github/workflows/auto-tag.yml` exists with valid YAML syntax and correct GitHub Actions structure.
2. Workflow triggers on `push: branches: [main]` with no path filter.
3. Workflow uses `actions/checkout@v4` with `token: ${{ secrets.RELEASE_TOKEN }}`.
4. Version is extracted via `jq -r .version package.json` with fail-closed error handling.
5. Tag existence is checked via `git ls-remote --tags origin` (remote, not local).
6. Tag is created and pushed only when it does not already exist.
7. Workflow exits successfully (code 0) when tag already exists (idempotent no-op).
8. Workflow fails (non-zero exit) when version read fails or tag push fails.
9. `permissions: contents: read` is set (least-privilege GITHUB_TOKEN scope).
10. `.github/workflows/publish.yml` is completely unchanged.
11. All quality gates (typecheck, build, test) pass with no regressions.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification | Required behavior: auto-tag on main push, idempotent, fail-closed; preserve publish.yml unchanged; tag format `v<version>` |
| `scout/reference-map.json` | File map and facts | Only publish.yml exists in workflows dir; version is 1.3.3; GITHUB_TOKEN limitation flagged as critical unknown |
| `scout/scout-summary.md` | Scout analysis | No main-push workflow exists; publish.yml permissions id-token:write + contents:read; GITHUB_TOKEN chaining limitation |
| `diagnosis/diagnosis-statement.md` | Root cause and solution | Missing auto-tag workflow is root cause; PAT/App token required for workflow chaining; single new file solution |
| `diagnosis/apl.json` | Diagnosis evidence | Confirmed GITHUB_TOKEN events don't trigger workflows; purely additive change; PAT via actions/checkout token parameter |
| `product/product.md` | Product requirements | MVP features defined; explicit out-of-scope items; success criteria aligned with ticket |
| `tech-research/tech-research.md` | Technical decisions | PAT over GITHUB_TOKEN; jq over node; git ls-remote over local; no path filter; actions/checkout@v4; fail-closed handling |
| `tech-research/apl.json` | Research conclusions | Confirmed all technical decisions with evidence; no followups remaining |
| `repo-guidance.json` | Repo intent | helix-cli is sole target repo with no cross-repo dependencies |
| `.github/workflows/publish.yml` | Existing workflow (direct read) | Triggers on v* tags; validates tag-version match; Node 24 + npm OIDC; must remain unchanged |
| `package.json` | Version and build config (direct read) | Version 1.3.3; scripts: build/typecheck/test/prepare; devDependencies: @types/node + typescript only |

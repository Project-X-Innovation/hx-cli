# Tech Research: Automate helix-cli Release Tagging from Version Bumps

## Technology Foundation

- **Platform**: GitHub Actions (workflow YAML)
- **Runtime**: GitHub-hosted `ubuntu-latest` runner
- **Tools used in workflow**: `jq` (pre-installed), `git` (pre-installed)
- **Actions**: `actions/checkout@v4` (matches existing `publish.yml`)
- **No additional actions or runtime setup required** — no `actions/setup-node`, no third-party actions

The entire solution is a single GitHub Actions workflow file containing shell commands. No application code changes, no new dependencies, no build steps.

## Architecture Decision

### Options Considered

| Option | Description | Pros | Cons | Verdict |
|--------|-------------|------|------|---------|
| **A. Push-to-main + PAT checkout** | New workflow triggers on `push: branches: [main]`, checks out with PAT, reads version, creates/pushes tag | Simple, direct, one file, no modifications to existing workflows | Requires PAT secret setup; PAT needs rotation | **Chosen** |
| **B. Push-to-main + `workflow_dispatch`** | Auto-tag workflow calls `workflow_dispatch` on publish.yml instead of pushing a tag | Avoids PAT for tag push | Requires modifying `publish.yml` to add `workflow_dispatch` trigger — explicitly out of scope | Rejected |
| **C. Push-to-main + `repository_dispatch`** | Auto-tag workflow fires `repository_dispatch` to trigger publish | Avoids tag creation entirely | Requires modifying `publish.yml`; changes the fundamental release model from tag-based to event-based | Rejected |
| **D. Push-to-main + GitHub App token** | Same as A but uses `actions/create-github-app-token` to generate a short-lived installation token | More secure than PAT (fine-grained, auto-expiring) | Requires creating a GitHub App, installing it, storing App ID + private key as secrets — significantly more complex | Rejected for MVP; viable future enhancement |
| **E. Third-party tag action** | Use `anothrNick/github-tag-action` or similar | Pre-built logic | Adds supply chain risk; simple enough to do in shell; third-party maintenance risk | Rejected |

### Chosen Option: A — Push-to-main with PAT Checkout

**Rationale**: This is the simplest approach that satisfies all requirements. It adds one file, modifies nothing, and uses only built-in GitHub Actions capabilities. The PAT requirement is a well-documented standard pattern for workflow chaining (confirmed by GitHub Actions docs via Context7). The ticket's design principles explicitly call for simplicity and minimal scope.

## Core API/Methods

### Workflow Structure (pseudocode — not implementation code)

```
trigger: push to main
permissions: contents: read
job: auto-tag on ubuntu-latest

step 1: checkout with PAT token (secrets.RELEASE_TOKEN)
step 2: read version from package.json using jq
         → fail if version is empty or null
step 3: check if tag v<version> exists on remote (git ls-remote)
step 4: if tag does not exist → create and push tag
         if tag exists → exit 0 (success, no-op)
```

### Key Commands

| Operation | Command | Why This Approach |
|-----------|---------|-------------------|
| Version extraction | `jq -r .version package.json` | Pre-installed on runners; no Node setup needed; purpose-built for JSON |
| Tag existence check | `git ls-remote --tags origin refs/tags/v$VERSION` | Queries remote directly; authoritative; works with shallow clone |
| Tag creation | `git tag v$VERSION` | Standard git; tag created at HEAD (the pushed commit) |
| Tag push | `git push origin v$VERSION` | Uses PAT credentials persisted by `actions/checkout` |

## Technical Decisions

### 1. PAT over GITHUB_TOKEN for tag push

**Decision**: Use a repository secret (`RELEASE_TOKEN`) containing a PAT with `contents: write` permission, passed to `actions/checkout` via the `token` parameter.

**Why**: GitHub Actions documentation confirms: "When using the repository's GITHUB_TOKEN to perform tasks, events triggered by this token will not create a new workflow run, with the exception of workflow_dispatch and repository_dispatch events." (Source: Context7 /websites/github_en_actions). A tag pushed with `GITHUB_TOKEN` would silently fail to trigger `publish.yml`, breaking the automation chain.

**Rejected alternative**: GitHub App installation token (Option D). More secure but requires creating a GitHub App, installing it on the repo, and storing two secrets (App ID + private key) plus an additional action (`actions/create-github-app-token`). This complexity is disproportionate for a single-repo, single-workflow use case. Can be revisited later if PAT management becomes a concern.

### 2. jq over node -p for version extraction

**Decision**: Use `jq -r .version package.json` instead of `node -p "require('./package.json').version"`.

**Why**: `jq` is pre-installed on GitHub-hosted runners, requires no `actions/setup-node` step, and is the standard tool for JSON field extraction. The existing `publish.yml` uses the `node -p` pattern, but that workflow already requires Node.js for npm operations. The auto-tag workflow has no other Node dependency.

**Rejected alternative**: `node -p` pattern. Works but adds an implicit dependency on the runner's default Node version. Shell parsing (grep/sed) is fragile and not appropriate for JSON.

### 3. Remote tag check over local tag check

**Decision**: Use `git ls-remote --tags origin refs/tags/v$VERSION` to check tag existence.

**Why**: With `actions/checkout` using `fetch-depth: 1` (default) and `fetch-tags: false` (default), local tags are not available. `git ls-remote` queries the remote directly, which is the authoritative source. This avoids needing `fetch-tags: true` and works correctly with shallow clones.

**Rejected alternative**: `fetch-tags: true` + `git tag -l`. Requires fetching all tags (slower for repos with many tags) and introduces a local-vs-remote consistency window.

### 4. No path filter on the trigger

**Decision**: Trigger on every push to `main` without `paths: ['package.json']` filtering.

**Why**: The ticket specifies "On a push to main, inspect the root package.json version in the pushed commit." The idempotency check (tag exists → skip) makes non-version-bump runs essentially free (3 shell commands, < 30 seconds). Path filtering adds a condition that could have edge cases with merge commits or rebase strategies, for negligible cost savings.

**Rejected alternative**: `paths: ['package.json']` filter. Would reduce workflow runs but adds complexity and risk of missed triggers for minimal benefit.

### 5. actions/checkout@v4 for consistency

**Decision**: Use `actions/checkout@v4` to match the existing `publish.yml`.

**Why**: Maintains consistency within the repository's CI configuration. The latest version is v6, but upgrading checkout versions across the repo is out of scope. All required features (`token`, `fetch-tags`) are available in v4.

### 6. Fail-closed error handling

**Decision**: The workflow fails (non-zero exit) if version cannot be read or tag push fails. It exits successfully (zero exit) only when the tag is created or already exists.

**Why**: Ticket requirement: "If package.json cannot be read, the workflow must fail." and "If tag creation or push fails, the workflow must fail and not attempt to publish as a fallback." The only successful no-op is when the tag already exists (idempotency case).

### 7. Permissions block set to contents: read

**Decision**: Set `permissions: contents: read` in the workflow YAML, even though the actual write operation uses the PAT.

**Why**: The `permissions` block controls `GITHUB_TOKEN` scope, not the PAT. The workflow only reads repository contents via `GITHUB_TOKEN`; the tag push uses the PAT credential persisted by `actions/checkout`. Setting minimal `GITHUB_TOKEN` permissions follows the principle of least privilege.

## Cross-Platform Considerations

Not applicable. This is a GitHub Actions workflow running on `ubuntu-latest`. No cross-platform concerns.

## Performance Expectations

| Scenario | Expected Duration | Cost |
|----------|-------------------|------|
| Non-version-bump merge (tag exists) | ~15-25 seconds | Checkout + 2 shell commands |
| Version bump merge (tag created) | ~20-30 seconds | Checkout + 3 shell commands |
| Error case (bad package.json) | ~10-15 seconds | Checkout + 1 failed shell command |

The workflow is extremely lightweight. No dependency installation, no build step, no test execution. The heaviest operation is `actions/checkout` itself.

## Dependencies

### Code Dependencies

None. The workflow uses only pre-installed tools (`jq`, `git`) and a single first-party GitHub Action (`actions/checkout@v4`).

### Infrastructure Prerequisites

| Prerequisite | Details | Status |
|--------------|---------|--------|
| **Repository secret `RELEASE_TOKEN`** | Must contain a PAT (classic or fine-grained) with `contents: write` permission on `Project-X-Innovation/helix-cli` | **Required before workflow can function** — must be configured in GitHub repo settings |
| **No tag protection rules blocking automation** | If tag protection rules exist on `v*` patterns, the PAT user must be allowed to create matching tags | **Unknown** — must be verified; workflow will fail with clear error if blocked |
| **No branch protection blocking the workflow** | The workflow triggers on push to `main`; branch protection should not affect this since it runs after the push | Low risk — push events fire after protection checks pass |

### PAT Configuration Notes

- **Fine-grained PAT (recommended)**: Scope to the single repository `Project-X-Innovation/helix-cli` with `Contents: Read and write` permission. Set expiration to maximum (1 year for fine-grained PATs) and document rotation schedule.
- **Classic PAT (alternative)**: Requires `repo` scope (broader than needed). Not recommended due to overly broad permissions.
- **The PAT must belong to an account with push access to the repository.** A service account / machine user is recommended over a personal developer account.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `RELEASE_TOKEN` secret not configured | **High** — workflow fails on first run | Document the prerequisite; the workflow will produce a clear checkout failure mentioning the missing token |
| PAT expiration | **Medium** — workflow silently fails after expiry | Use fine-grained PAT with maximum expiry; document rotation schedule; consider GitHub App token migration later |
| Tag protection rules block tag push | **Medium** — tag creation fails | Verify no conflicting tag protection exists; workflow failure will be visible in Actions UI |
| PAT user account deactivated | **Medium** — workflow fails | Use a service/machine account rather than a personal developer account |
| Race condition: two rapid pushes to main | **Low** — second run may attempt to create an existing tag | Idempotency check (git ls-remote before tag creation) handles this; git push also fails gracefully if tag exists remotely |
| jq not available on runner | **Very Low** — jq is pre-installed on all ubuntu-latest images | Extremely unlikely; if it occurs, the step fails with a clear "command not found" error |

## Deferred to Round 2

- **GitHub App token migration**: Replace PAT with a GitHub App installation token for better security (fine-grained permissions, automatic expiration, no user account dependency). This is a viable enhancement but not needed for MVP.
- **GitHub Release creation**: The ticket explicitly excludes GitHub Release objects. If desired later, a release-creation step can be added to the auto-tag workflow or as a separate workflow triggered by the new tag.
- **Changelog generation**: Out of scope. Can be added to a release workflow later.
- **Monorepo version management**: The ticket operates on a single package.json. If the repo evolves to a monorepo, the version detection logic would need revision.
- **actions/checkout version upgrade**: Both workflows could be upgraded from v4 to v6 in a separate housekeeping ticket.

## Summary Table

| Aspect | Decision |
|--------|----------|
| New file | `.github/workflows/auto-tag.yml` |
| Modified files | None |
| Trigger | `push: branches: [main]` (no path filter) |
| Checkout action | `actions/checkout@v4` with `token: ${{ secrets.RELEASE_TOKEN }}` |
| Version extraction | `jq -r .version package.json` |
| Tag existence check | `git ls-remote --tags origin refs/tags/v$VERSION` |
| Tag creation | `git tag v$VERSION && git push origin v$VERSION` |
| Token type | PAT (fine-grained preferred) stored as `RELEASE_TOKEN` secret |
| Permissions | `contents: read` (GITHUB_TOKEN); PAT handles write |
| Error handling | Fail-closed on read/push errors; exit-0 on existing tag |
| Third-party actions | None |
| Node.js required | No |

## APL Statement Reference

The auto-tag workflow is a single new YAML file (`.github/workflows/auto-tag.yml`) that triggers on every push to main, reads the version from `package.json` via `jq`, checks the remote for an existing tag via `git ls-remote`, and creates/pushes `v<version>` when absent. The critical technical constraint is that the default `GITHUB_TOKEN` cannot be used for the tag push because GitHub Actions suppresses downstream workflow triggers from `GITHUB_TOKEN` events. A PAT stored as `RELEASE_TOKEN` must be passed to `actions/checkout`'s token parameter so the tag push triggers the existing `publish.yml`. No existing files are modified. The only infrastructure prerequisite is the repository secret configuration.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification | Defined required behavior (auto-tag, idempotent, fail-closed), invariants (package.json is source of truth, preserve publish.yml), and explicit scope boundaries (no publish.yml modification) |
| `scout/reference-map.json` | File map and verified facts | Confirmed only publish.yml exists in workflows dir; version is 1.3.3; publish.yml validates tag-version match (safety net); identified GITHUB_TOKEN limitation as critical unknown |
| `scout/scout-summary.md` | Structured analysis | Confirmed no main-push workflow exists; detailed publish.yml permissions (id-token:write, contents:read); flagged GITHUB_TOKEN chaining as critical design boundary |
| `diagnosis/apl.json` | Root cause investigation answers | Confirmed GITHUB_TOKEN events don't trigger workflows (with Context7 evidence); confirmed purely additive change set; confirmed PAT requirement |
| `diagnosis/diagnosis-statement.md` | Root cause analysis | Confirmed missing auto-tag workflow as root cause; documented PAT/App token requirement; scoped implementation to one new file |
| `product/product.md` | Product requirements and success criteria | Defined MVP features (main-push trigger, version extraction, idempotent tag creation, fail-closed, workflow chaining); confirmed out-of-scope items |
| `repo-guidance.json` | Repo intent metadata | Confirmed helix-cli is sole target repo with no cross-repo dependencies |
| `.github/workflows/publish.yml` | Direct file inspection | Verified trigger (push tags v*), permissions (id-token:write, contents:read), version validation (lines 31-38), Node 24 + npm OIDC setup, actions/checkout@v4 usage |
| `package.json` | Direct file inspection | Confirmed version 1.3.3, package name, publishConfig, scripts (build/test/typecheck), no runtime dependencies |
| Context7: GitHub Actions docs | GITHUB_TOKEN behavior verification | Confirmed: "events triggered by GITHUB_TOKEN will not create a new workflow run" except workflow_dispatch/repository_dispatch; recommended PAT or GitHub App token for chaining |
| Context7: actions/checkout docs | Token parameter behavior | Confirmed: token parameter accepts PAT; "The PAT is configured with the local git config, which enables your scripts to run authenticated git commands"; latest version is v6 but v4 supports needed features |

# Implementation Actual — BLD-527: Replace hlx self-update with GitHub release assets

## Summary of Changes

Replaced the `hlx update` and auto-update mechanism to use prebuilt GitHub Release assets instead of `npm install -g git+https://...#main`. Three areas changed: (1) CI workflows — new `build-release.yml` publishing a prebuilt tarball on every `main` merge, `auto-tag.yml` deleted; (2) the `src/update/` module rewritten to implement staged download-validate-swap using the GitHub REST API; (3) documentation in 4 files updated to remove all `npm install -g git+https://...` references.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `.github/workflows/build-release.yml` | **New.** CI workflow triggered on push to `main` — builds, tests, creates tarball, publishes as GitHub Release under rolling `latest` tag using `GITHUB_TOKEN` with `contents: write`. | CI/CD — review workflow permissions, concurrency, tarball contents, and tag naming (must not match `v*`). |
| `.github/workflows/auto-tag.yml` | **Deleted.** Removed auto-tag workflow that pushed `v{version}` tags on every `main` merge, chaining to npm publish. | N/A — deletion only. |
| `src/update/check.ts` | **Rewritten.** Replaced `git ls-remote` with GitHub REST API (`GET /repos/{owner}/{repo}/releases/tags/latest`). Added `getGitHubToken()` auth discovery chain. Removed `GIT_INSTALL_SPEC` constant. New exports: `ReleaseInfo`, `ReleaseCheckResult`, `fetchLatestRelease()`, `getGitHubToken()`. `isUpdateAvailable()` now async. | **Shared public API** — `fetchLatestRelease` and types are consumed by `index.ts`. Auth token chain is a security-relevant code path. |
| `src/update/validate.ts` | **Rewritten.** Replaced npm-path-dependent validation (`npm root -g` + `@projectxinnovation/helix-cli/dist/index.js`) with staged directory validation. New export: `validateStaged(stagingDir)`. | **Shared utility** — consumed by `perform.ts`. Validates staged candidate before swap. |
| `src/update/perform.ts` | **Rewritten.** Replaced `npm install -g` with staged tarball download → extract → validate → rename-based swap. New exports: `performStagedUpdate()`, `getInstallRoot()`. Implements backup/rollback with `.bak` directories, EXDEV cross-filesystem fallback, and Windows retry logic. | **Critical path** — this is the core update mechanism. Swap logic, rollback, and cleanup are high-scrutiny areas. Uses `import.meta.url` for install root discovery. |
| `src/update/index.ts` | **Updated.** Rewired orchestration to use `fetchLatestRelease()` and `performStagedUpdate()`. Removed `GIT_INSTALL_SPEC` import. Added explicit GitHub auth error messaging (GITHUB_TOKEN, GH_TOKEN, gh auth login). Updated recovery messages to point to `hlx update` and GitHub Releases instead of npm. | **Orchestration** — fail-open (auto-update) / fail-closed (manual update) behavior must be preserved. Error messages are user-facing. |
| `src/docs/cli-content.ts` | **Updated.** Replaced Installation section npm install command with GitHub release download instructions. Replaced "Stale Symlink After Update" troubleshooting with "CLI Not Working After Update" pointing to `hlx update` and GitHub release. | User-facing documentation. |
| `src/skill/show.ts` | **Updated.** Replaced npm install recovery message with `hlx update` and GitHub release URL. | Error message path — only triggers when SKILL.md is missing from installation. |
| `src/skill/paths.ts` | **Updated.** Replaced npm install recovery message with `hlx update` and GitHub release URL. | Error message path — only triggers when skill-content/ is missing from installation. |

## Steps Executed

### Step 1: Create CI Workflow for Prebuilt Release Artifacts
Created `.github/workflows/build-release.yml` with:
- Trigger: `on: push: branches: [main]`
- Permissions: `contents: write`
- Concurrency: `group: build-release, cancel-in-progress: true`
- Steps: checkout → setup-node@v4 (Node 22) → npm ci → npm test → generate build-metadata.json → create tarball (dist/, skill-content/, package.json, build-metadata.json, excluding test files) → delete existing `latest` release → create new `latest` release with tarball asset
- Tag `latest` does NOT match `v*`, so publish.yml will NOT trigger

### Step 2: Remove Auto-Tag Workflow
Deleted `.github/workflows/auto-tag.yml`.

### Step 3: Rewrite Remote SHA Check and Auth Discovery
Rewrote `src/update/check.ts`:
- Removed `GIT_INSTALL_SPEC` constant
- Kept `CANONICAL_REPO_URL`, `CANONICAL_BRANCH`, `CANONICAL_REPO`
- Added `getGitHubToken()`: `GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token` → null
- Added `fetchLatestRelease()`: calls GitHub REST API, handles 401/403 (auth required), 404 (no release), parses `target_commitish` and `assets[0].url`
- Added types: `ReleaseInfo`, `ReleaseCheckResult`
- Updated `isUpdateAvailable()` to use `fetchLatestRelease()` (now async)

### Step 4: Rewrite Staged Validation
Rewrote `src/update/validate.ts`:
- Removed all npm-specific logic (`npm root -g`, npm package path)
- New `validateStaged(stagingDir)`: checks `dist/index.js` exists, checks `package.json` exists, runs `node <dir>/dist/index.js --version` with `HLX_SKIP_UPDATE_CHECK=1`

### Step 5: Rewrite Update Execution with Staged Download+Swap
Rewrote `src/update/perform.ts`:
- Removed `npm install -g` call and `GIT_INSTALL_SPEC` import
- Added `getInstallRoot()` using `import.meta.url` (same pattern as version.ts and paths.ts)
- Added staging directory management: `~/.hlx/staging/<sha>/`
- New `performStagedUpdate(assetUrl, commitSha, token?)`:
  - Downloads tarball via `fetch()` with `Accept: application/octet-stream`
  - Extracts via `tar -xzf` using `execSync`
  - Validates via `validateStaged()`
  - Rename-based swap: live dirs → `.bak`, staged dirs → live
  - EXDEV fallback: copy+delete instead of rename
  - Windows retry: `Atomics.wait()` for 500ms then retry
  - Rollback: restores `.bak` dirs on any swap failure
  - Cleanup: removes staging and backup dirs

### Step 6: Update Orchestration and Error Messages
Updated `src/update/index.ts`:
- Imports: `fetchLatestRelease`, `getGitHubToken` from check.ts; `performStagedUpdate` from perform.ts; removed `fetchRemoteSha`, `GIT_INSTALL_SPEC`, `performUpdate`, `validateInstall`
- `runUpdate()`: calls `fetchLatestRelease()`, handles auth-required with explicit guidance, calls `performStagedUpdate()`, updated recovery messages
- `checkAutoUpdate()`: same flow changes, fail-open preserved, calls `fetchLatestRelease()` and `performStagedUpdate()`
- `isCanonicalSource()`: unchanged

### Step 7: Update Documentation and Error Recovery Messages
- `src/docs/cli-content.ts`: Installation section now points to GitHub release download. Troubleshooting now says "CLI Not Working After Update" with `hlx update` and GitHub release URL.
- `src/skill/show.ts`: Recovery message points to `hlx update` and GitHub release URL
- `src/skill/paths.ts`: Recovery message points to `hlx update` and GitHub release URL
- `skill-content/references/commands.md`: Already says "Check for and apply CLI updates from GitHub" — no changes needed

### Step 8: Quality Gates and CLI Verification
All gates pass (see Verification Commands below).

## Verification Commands Run + Outcomes

| Command | Exit Code | Result |
|---------|-----------|--------|
| `npx tsc --noEmit` | 0 | No type errors |
| `npm run build` | 0 | Compiled to dist/ |
| `npm test` | 0 | 51 tests passed, 0 failed |
| `node dist/index.js --version` | 0 | Output: `1.3.4` |
| `grep 'npm install -g git+https' src/` | 0 matches | No references in source |
| `grep 'npm install -g git+https' skill-content/` | 0 matches | No references in skill content |
| `grep 'npm install -g git+https' .github/` | 0 matches | No references in workflows |
| `grep 'GIT_INSTALL_SPEC' src/` | 0 matches | Constant fully removed |
| `grep 'git ls-remote' src/update/check.ts` | 0 matches | Replaced with GitHub REST API |
| `grep 'npm root' src/update/validate.ts` | 0 matches | Replaced with staged directory validation |
| `grep 'npm install -g' src/update/perform.ts` | 0 matches | Replaced with staged download+swap |
| `ls .github/workflows/auto-tag.yml` | 2 (not found) | Confirmed deleted |
| `ls .github/workflows/` | 0 | `build-release.yml`, `publish.yml` present |
| `ls dist/update/` | 0 | All compiled files present: check.js, index.js, perform.js, validate.js, version.js |

## Test/Build Results

- **TypeScript typecheck:** PASS — zero errors
- **Build:** PASS — `tsc` compiled to `dist/`
- **Tests:** PASS — 51/51 tests passed (flag parsing, ticket resolution, skill operations)
- **CLI --version:** PASS — outputs `1.3.4`

## Deviations from Plan

1. **Windows retry mechanism:** Plan suggested shelling out to `ping` for delay. Used `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)` instead — cleaner synchronous wait without shell dependency, avoids ESM `require` issues.
2. **No `require()` in ESM:** Initial implementation attempted dynamic `require("node:child_process")` for the Windows retry path. This doesn't work in ESM modules (`"type": "module"` in package.json). Fixed by using `Atomics.wait()`.

## Known Limitations / Follow-ups

1. **End-to-end update test requires CI run:** Cannot test the full update flow until the `build-release.yml` workflow runs on GitHub and creates the `latest` release. This is noted in the plan pre-conditions (CHK-08 dependency on live release).
2. **No update module unit tests:** The `src/update/` module has zero test files. Adding tests was noted as a gap in the product spec but is not in scope for this ticket.
3. **Publish.yml preserved unchanged:** Verified by re-reading the file — identical to original content.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | **pass** | `npx tsc --noEmit` exits 0, no type errors |
| CHK-02 | **pass** | `npm run build` exits 0; `dist/update/` contains check.js, perform.js, validate.js, index.js, version.js |
| CHK-03 | **pass** | `npm test` exits 0; 51 tests passed, 0 failed |
| CHK-04 | **pass** | `node dist/index.js --version` exits 0, outputs `1.3.4` |
| CHK-05 | **pass** | `ls .github/workflows/auto-tag.yml` returns "No such file or directory"; `ls .github/workflows/` shows only `build-release.yml` and `publish.yml` |
| CHK-06 | **pass** | Re-read `.github/workflows/publish.yml` — content identical to original (triggers on `v*` tags, OIDC trusted publishing, `npm publish *.tgz --provenance`) |
| CHK-07 | **pass** | `build-release.yml` verified: triggers on `push: branches: [main]`, permissions `contents: write`, concurrency `build-release` with `cancel-in-progress: true`, steps include npm ci, npm test, build-metadata.json generation, tarball creation, `gh release delete latest` + `gh release create latest` with tag `latest` (not `v*`) |
| CHK-08 | **pass** | Grep for `npm install -g git+https` across src/, skill-content/, .github/ returns 0 matches. Grep for `GIT_INSTALL_SPEC` in src/ returns 0 matches. |
| CHK-09 | **pass** | No `git ls-remote` in check.ts. `fetchLatestRelease()` exported, calls `api.github.com`. `getGitHubToken()` exported with GITHUB_TOKEN → GH_TOKEN → gh auth token chain. |
| CHK-10 | **pass** | `performStagedUpdate()` exported in perform.ts. Stages to `~/.hlx/staging/<sha>/`, downloads via fetch, extracts via tar, calls validateStaged(), does rename-based swap with `.bak` backup, cleans up on success, restores on failure. No `npm install -g` in file. |
| CHK-11 | **pass** | `validateStaged()` exported in validate.ts. Takes directory path, checks `dist/index.js` existence, checks `package.json` existence, runs `node <dir>/dist/index.js --version` with `HLX_SKIP_UPDATE_CHECK=1`. No `npm root` in file. |
| CHK-12 | **pass** | Auth failure handling in index.ts mentions `GITHUB_TOKEN`, `GH_TOKEN`, and `gh auth login` (lines 62-64). |

All 12 required checks pass. Self-verification is complete.

## APL Statement Reference

Implementation complete. All 8 plan steps executed: build-release.yml CI workflow created, auto-tag.yml deleted, src/update/ module rewritten (check.ts, validate.ts, perform.ts, index.ts) with GitHub REST API and staged download-validate-swap mechanism, documentation updated in 4 files. All quality gates pass: typecheck, build, 51 tests, CLI --version. Zero npm install -g git+https references remain. publish.yml preserved unchanged. Fail-open (auto-update) / fail-closed (manual update) behavior preserved. Explicit GitHub auth error messaging implemented.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements and acceptance criteria | Staged update required; failed updates must never brick CLI; `latest` tag must not trigger npm publish; explicit auth messaging required |
| `implementation-plan/implementation-plan.md` | Step-by-step implementation guide and verification plan | 8 steps with exact file changes, function signatures, and 12 verification checks |
| `implementation-plan/apl.json` | Structured implementation dependencies | Step ordering confirmed, zero blocking dependencies |
| `diagnosis/diagnosis-statement.md` | Root cause analysis | 4 root causes: source-based install requires build tools, destructive npm install -g, auto-tag chains to publish, no prebuilt artifact |
| `product/product.md` | Product vision, use cases, success criteria | MVP features, fail-open/fail-closed split, never-brick principle |
| `tech-research/tech-research.md` | Architecture decisions and API design | Option A (GitHub Releases + rolling `latest` tag), rename-based swap, build-metadata.json, auth chain, cross-platform considerations |
| `scout/reference-map.json` | File inventory and evidence | 5 update files, 2 workflows, 6 npm references, zero tests |
| `src/update/check.ts` (original) | Current remote SHA check | `git ls-remote` and `GIT_INSTALL_SPEC` to replace |
| `src/update/perform.ts` (original) | Current update executor | `npm install -g` mechanism to replace |
| `src/update/validate.ts` (original) | Current post-update validation | npm-path-dependent validation to replace |
| `src/update/index.ts` (original) | Current orchestration | Fail-open/fail-closed patterns to preserve |
| `src/update/version.ts` | Version display | Confirmed `import.meta.url` pattern; no changes needed |
| `src/lib/config.ts` | Config and InstallSource type | `InstallSource` already has `mode: 'github'` — no type changes needed |
| `.github/workflows/auto-tag.yml` (original) | Auto-tag workflow | Confirmed to delete |
| `.github/workflows/publish.yml` | npm publish workflow | Confirmed to preserve unchanged |
| `package.json` | Project configuration | Zero production deps, prepare → tsc, ESM, Node >= 18 |

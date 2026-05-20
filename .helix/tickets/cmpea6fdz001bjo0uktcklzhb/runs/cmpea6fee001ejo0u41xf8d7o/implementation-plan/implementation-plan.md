# Implementation Plan — BLD-527: Replace hlx self-update with GitHub release assets

## Overview

Replace the `hlx update` and auto-update mechanism to use prebuilt GitHub Release assets instead of `npm install -g git+https://...#main`. The change spans three areas: (1) a new CI workflow that publishes a prebuilt tarball on every `main` merge, (2) a rewrite of the `src/update/` module to implement staged download-validate-swap, and (3) documentation updates to remove all hardcoded npm install references. The `auto-tag.yml` workflow is deleted; `publish.yml` is preserved unchanged.

## Implementation Principles

- **Never brick the CLI:** The live install is never modified until a staged candidate passes validation.
- **Zero new dependencies:** Use only Node.js built-in APIs (`fetch`, `fs`, `child_process`, `path`, `url`, `os`). No new npm packages.
- **Minimal surface:** Touch only files identified by diagnosis. No unrelated changes.
- **Preserve behavior contracts:** Fail-open for auto-update, fail-closed for manual update. `--version` format preserved. Config read-merge-write pattern preserved.
- **Existing type reuse:** `InstallSource` already has `mode: 'github'`, `repo`, `branch`, `commit` fields — no type changes needed.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Create CI workflow for prebuilt release artifacts | `.github/workflows/build-release.yml` (new) |
| 2 | Remove auto-tag workflow | `.github/workflows/auto-tag.yml` (deleted) |
| 3 | Rewrite remote SHA check and auth discovery | `src/update/check.ts` (rewritten) |
| 4 | Rewrite staged validation | `src/update/validate.ts` (rewritten) |
| 5 | Rewrite update execution with staged download+swap | `src/update/perform.ts` (rewritten) |
| 6 | Update orchestration and error messages | `src/update/index.ts` (updated) |
| 7 | Update documentation and error recovery messages | `src/docs/cli-content.ts`, `src/skill/show.ts`, `src/skill/paths.ts`, `skill-content/references/commands.md` (updated) |
| 8 | Quality gates and CLI verification | Typecheck, build, test pass; CLI runs |

## Detailed Implementation Steps

### Step 1: Create CI Workflow for Prebuilt Release Artifacts

**Goal:** Every push to `main` builds the CLI, runs tests, and publishes a prebuilt tarball as a GitHub Release asset under a rolling `latest` tag.

**What to Build:**

Create `.github/workflows/build-release.yml` with:

- **Trigger:** `on: push: branches: [main]`
- **Permissions:** `contents: write` (sufficient for `gh release create` with standard `GITHUB_TOKEN`)
- **Concurrency:** `group: build-release, cancel-in-progress: true` to prevent race conditions on rapid pushes
- **Steps:**
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with `node-version: '22'`
  3. `npm ci` (prepare script runs build automatically)
  4. `npm test`
  5. Generate `build-metadata.json`: `{ "commit": "$GITHUB_SHA", "builtAt": "<ISO timestamp>" }`
  6. Create tarball: `tar -czf helix-cli.tgz dist/ skill-content/ package.json build-metadata.json` with `--exclude='*.test.js' --exclude='*.test.d.ts'`
  7. Delete existing `latest` release: `gh release delete latest --yes --cleanup-tag || true`
  8. Create new release: `gh release create latest helix-cli.tgz --title "Latest main build" --notes "Commit: $GITHUB_SHA" --target $GITHUB_SHA`

**Key details:**
- Tag `latest` does NOT match `v*` pattern in `publish.yml`, so it will NOT trigger npm publish.
- `GITHUB_TOKEN` is automatically available with `contents: write` — no custom secret needed.
- `build-metadata.json` embeds the commit SHA in the tarball for offline identification.

**Verification (AI Agent Runs):**
- Verify file exists at `.github/workflows/build-release.yml`.
- Verify YAML structure: trigger on `push: branches: [main]`, permissions `contents: write`, concurrency group, all required steps present.
- Verify the tag name `latest` is used (not `v*`).

**Success Criteria:**
- Workflow file is valid YAML with correct trigger, permissions, concurrency, and all build/test/release steps.

---

### Step 2: Remove Auto-Tag Workflow

**Goal:** Delete the `auto-tag.yml` workflow that auto-pushes git tags on every `main` merge.

**What to Build:**

Delete `.github/workflows/auto-tag.yml`. No replacement needed — the auto-tagging behavior is explicitly unwanted.

**Verification (AI Agent Runs):**
- Confirm `.github/workflows/auto-tag.yml` does not exist.
- Confirm `.github/workflows/publish.yml` is unchanged (byte-for-byte identical to the original).

**Success Criteria:**
- `auto-tag.yml` is removed. `publish.yml` is untouched.

---

### Step 3: Rewrite Remote SHA Check and Auth Discovery

**Goal:** Replace `git ls-remote` with GitHub REST API for release metadata and add GitHub auth token discovery.

**What to Build:**

Rewrite `src/update/check.ts`:

1. **Remove:** `GIT_INSTALL_SPEC` constant (no longer needed).
2. **Keep:** `CANONICAL_REPO_URL`, `CANONICAL_BRANCH`, `CANONICAL_REPO` constants.
3. **Add `getGitHubToken()` function:** Token discovery order:
   - `process.env.GITHUB_TOKEN`
   - `process.env.GH_TOKEN`
   - Try `execSync('gh auth token', { timeout: 5000 })` — catch if `gh` not installed
   - Return `null` if none found (works for public repos)
4. **Replace `fetchRemoteSha()` with `fetchLatestRelease()`:**
   - Call `GET https://api.github.com/repos/Project-X-Innovation/helix-cli/releases/tags/latest` using native `fetch()`.
   - Pass `Authorization: Bearer <token>` header if token is available, plus `Accept: application/vnd.github+json`.
   - Parse response JSON to extract `target_commitish` (commit SHA) and `assets[0].url` (API download URL) or `assets[0].browser_download_url`.
   - Return `{ commitSha: string, assetUrl: string } | null` on success, `null` on failure.
   - On HTTP 401/403: return a structured error indicating auth is required.
   - On HTTP 404: return null (no release published yet).
   - On network error: return null.
5. **Update `isUpdateAvailable()`:** Use `fetchLatestRelease()` instead of `fetchRemoteSha()`. Return the asset URL alongside the update-available flag.
6. **Export types:** Define and export `ReleaseInfo = { commitSha: string; assetUrl: string }` and `ReleaseCheckResult = { available: boolean; release: ReleaseInfo | null; authRequired?: boolean }`.

**Verification (AI Agent Runs):**
- Run `npx tsc --noEmit` — check.ts compiles with no errors.
- Verify no `git ls-remote` string remains in check.ts.
- Verify `GIT_INSTALL_SPEC` export is removed.
- Verify `fetchLatestRelease` function is exported.

**Success Criteria:**
- `check.ts` compiles. Uses `fetch()` for GitHub API. No `git` dependency. Auth token discovery chain implemented.

---

### Step 4: Rewrite Staged Validation

**Goal:** Replace npm-path-dependent validation with validation of a staged directory.

**What to Build:**

Rewrite `src/update/validate.ts`:

1. **Remove:** All npm-specific logic (`npm root -g`, `@projectxinnovation/helix-cli/dist/index.js` path construction).
2. **New `validateStaged(stagingDir: string)` function:**
   - Check `<stagingDir>/dist/index.js` exists using `existsSync`.
   - Check `<stagingDir>/package.json` exists.
   - Run `node <stagingDir>/dist/index.js --version` via `spawnSync` with `HLX_SKIP_UPDATE_CHECK=1` env var, `timeout: 10_000`.
   - Verify exit code 0 and non-empty stdout.
   - Return `{ valid: boolean; error?: string }`.
3. **Export:** `validateStaged` as the primary validation function.

**Verification (AI Agent Runs):**
- Run `npx tsc --noEmit` — validate.ts compiles.
- Verify no `npm root` string remains in validate.ts.
- Verify `validateStaged` function is exported.

**Success Criteria:**
- `validate.ts` validates a staging directory by checking entrypoint existence and running `--version`. No npm dependency.

---

### Step 5: Rewrite Update Execution with Staged Download+Swap

**Goal:** Replace `npm install -g` with a staged tarball download, extract, validate, and rename-based swap mechanism.

**What to Build:**

Rewrite `src/update/perform.ts`:

1. **Remove:** `spawnSync('npm install -g ...')` call and `GIT_INSTALL_SPEC` import.
2. **Add install root discovery:** `getInstallRoot()` function using `import.meta.url`:
   - `dirname(fileURLToPath(import.meta.url))` resolves to `dist/update/`.
   - `join(..., '..', '..')` resolves to the package root.
   - Already proven in `version.ts:18` and `paths.ts:18`.
3. **Add staging directory management:**
   - `STAGING_BASE = join(homedir(), '.hlx', 'staging')`.
   - Create staging dir: `<STAGING_BASE>/<commitSha>/`.
   - Clean up staging on completion (success or failure).
4. **New `performStagedUpdate(assetUrl, commitSha, token?)` function:**
   - **Download:** Use `fetch(assetUrl, { headers })` to download the tarball. For API asset URLs, include `Accept: application/octet-stream` header. Write response body to `<staging>/<sha>.tgz` using `Uint8Array` from `response.arrayBuffer()` and `writeFileSync`.
   - **Extract:** `execSync('tar -xzf <tarball> -C <staging-dir>')` — available on macOS, Linux, Windows 10+.
   - **Validate:** Call `validateStaged(stagingDir)`.
   - **Swap:** If validation passes:
     - Determine live install root via `getInstallRoot()`.
     - Rename live `dist/` to `dist.bak/`, staged `dist/` to live `dist/`.
     - Rename live `skill-content/` to `skill-content.bak/`, staged to live.
     - Copy staged `package.json` and `build-metadata.json` over live versions.
     - On any rename failure (e.g., EXDEV cross-filesystem): fall back to recursive copy+delete.
     - On Windows rename failure: retry once after 500ms, then abort with guidance.
   - **Rollback on swap failure:** If any swap step fails, restore `.bak` directories.
   - **Cleanup:** Remove staging dir and `.bak` dirs on success.
   - Return `{ success: boolean; error?: string }`.
5. **Handle edge cases:**
   - `EXDEV` error (cross-filesystem): detect and use copy instead of rename.
   - Windows file locking: retry once after 500ms delay.

**Verification (AI Agent Runs):**
- Run `npx tsc --noEmit` — perform.ts compiles.
- Verify no `npm install -g` string remains in perform.ts.
- Verify `performStagedUpdate` function is exported.
- Verify `GIT_INSTALL_SPEC` import is removed.

**Success Criteria:**
- `perform.ts` implements staged download → extract → validate → swap. No npm dependency. Backup/rollback on failure. Install root discovered via `import.meta.url`.

---

### Step 6: Update Orchestration and Error Messages

**Goal:** Wire up the new update functions in `index.ts` and replace all npm install references in error messages.

**What to Build:**

Update `src/update/index.ts`:

1. **Imports:** Replace `fetchRemoteSha` with `fetchLatestRelease` from check.ts. Replace `performUpdate` with `performStagedUpdate` from perform.ts. Replace `validateInstall` with removal (validation is now internal to `performStagedUpdate`). Remove `GIT_INSTALL_SPEC` import.
2. **`runUpdate()` changes:**
   - Call `fetchLatestRelease()` instead of `fetchRemoteSha()`.
   - Handle auth-required result: print explicit GitHub auth guidance (mention `GITHUB_TOKEN` env var, `GH_TOKEN` env var, or `gh auth login`).
   - When update available: call `performStagedUpdate(release.assetUrl, release.commitSha, token)` instead of `performUpdate()`.
   - Remove separate `validateInstall()` call (validation is now inside `performStagedUpdate`).
   - Update error messages: replace all `npm install -g ${GIT_INSTALL_SPEC}` recovery instructions with `hlx update` retry guidance or GitHub Release download instructions.
   - Update success message wording if needed.
   - Keep `saveConfig()` call with `installSource: { mode: 'github', repo: CANONICAL_REPO, branch: CANONICAL_BRANCH, commit: remoteSha }` — no type changes needed.
3. **`checkAutoUpdate()` changes:**
   - Same flow changes as `runUpdate()` but with fail-open behavior preserved.
   - Call `fetchLatestRelease()` instead of `fetchRemoteSha()`.
   - Call `performStagedUpdate()` instead of `performUpdate()`.
   - Remove separate `validateInstall()` call.
   - Preserve: loop prevention via `HLX_SKIP_UPDATE_CHECK`, autoUpdate config check, canonical source check, warn-and-return on failure.
4. **`isCanonicalSource()` function:** Keep as-is (already checks `mode === 'github'` with repo/branch).

**Verification (AI Agent Runs):**
- Run `npx tsc --noEmit` — index.ts compiles.
- Verify no `GIT_INSTALL_SPEC` import or usage remains.
- Verify no `npm install -g` string remains in error messages.
- Verify `fetchLatestRelease` is called instead of `fetchRemoteSha`.

**Success Criteria:**
- `index.ts` orchestrates the new staged update flow. Error messages provide GitHub-appropriate recovery guidance. Fail-open/fail-closed split preserved.

---

### Step 7: Update Documentation and Error Recovery Messages

**Goal:** Replace all hardcoded `npm install -g git+https://...` references with GitHub-based install/recovery instructions.

**What to Build:**

1. **`src/docs/cli-content.ts`:**
   - Line 18 (Installation section): Replace `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main` with instructions to download the latest release from GitHub (e.g., `Download the latest release from https://github.com/Project-X-Innovation/helix-cli/releases/latest, extract, and add to PATH`).
   - Line 301 (Troubleshooting, "Stale Symlink After Update" section): Replace the npm reinstall instruction with `hlx update` guidance. Update the section title and content to reflect the new update mechanism.

2. **`src/skill/show.ts`:**
   - Line 15: Replace `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main` with GitHub release download instruction.

3. **`src/skill/paths.ts`:**
   - Line 25: Replace `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main` with GitHub release download instruction.

4. **`skill-content/references/commands.md`:**
   - Review the `hlx update` section (lines 92-99). Update description if it references npm. Currently it says "Check for and apply CLI updates from GitHub" — this is already correct and may not need changes.

**Verification (AI Agent Runs):**
- Run grep across the entire repo for `npm install -g git+https` — zero matches.
- Run grep for `GIT_INSTALL_SPEC` — zero matches in any source file.
- Verify each updated file compiles: `npx tsc --noEmit`.

**Success Criteria:**
- Zero remaining `npm install -g git+https://...` references in the codebase. All recovery messages point to GitHub release or `hlx update`.

---

### Step 8: Quality Gates and CLI Verification

**Goal:** Verify the complete implementation compiles, builds, and the CLI entry point works.

**What to Build:**

No new code. Run verification commands:

1. `npx tsc --noEmit` (typecheck)
2. `npm run build` (full build to dist/)
3. `npm test` (build + run tests)
4. `node dist/index.js --version` (verify CLI starts and shows version)

**Verification (AI Agent Runs):**
- All four commands exit with code 0.
- `--version` output matches expected format (semver, optionally with SHA suffix).

**Success Criteria:**
- All quality gates pass. CLI entry point is functional.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 installed | available | `package.json:22` — `engines.node >= 18` | CHK-01, CHK-02, CHK-03, CHK-04 |
| npm installed (for `npm ci`, `npm test`) | available | Standard dev environment | CHK-01, CHK-02, CHK-03 |
| TypeScript compiler available via devDependencies | available | `package.json:42` — `typescript: ^6.0.2` | CHK-01, CHK-02, CHK-03 |
| Repository dependencies installed (`npm ci`) | available | Can be run before checks | CHK-01, CHK-02, CHK-03, CHK-04 |
| GitHub Release for `latest` tag (for end-to-end update test) | missing | No CI workflow has run yet; the workflow is new | CHK-08 |

### Required Checks

**[CHK-01] TypeScript typecheck passes**

- Action: Run `npm ci` (if not already done), then run `npx tsc --noEmit` from the repository root.
- Expected Outcome: Command exits with code 0 and no type errors are reported.
- Required Evidence: Full command output showing zero errors and exit code 0.

**[CHK-02] Full build succeeds**

- Action: Run `npm run build` from the repository root.
- Expected Outcome: Command exits with code 0. The `dist/` directory contains compiled JavaScript files including `dist/update/check.js`, `dist/update/perform.js`, `dist/update/validate.js`, `dist/update/index.js`, and `dist/index.js`.
- Required Evidence: Command output showing exit code 0, plus file listing of `dist/update/` confirming all expected files exist.

**[CHK-03] Tests pass**

- Action: Run `npm test` from the repository root.
- Expected Outcome: Command exits with code 0. All existing tests pass (flag parsing, ticket resolution, skill operations).
- Required Evidence: Full test runner output showing all tests passed and exit code 0.

**[CHK-04] CLI --version runs after build**

- Action: Run `node dist/index.js --version` from the repository root.
- Expected Outcome: Command exits with code 0 and outputs a version string matching the pattern `X.Y.Z` (optionally with `(SHA)` suffix).
- Required Evidence: Command output showing the version string and exit code 0.

**[CHK-05] auto-tag.yml is deleted**

- Action: Check for the file `.github/workflows/auto-tag.yml` in the repository.
- Expected Outcome: The file does not exist.
- Required Evidence: Output of `ls .github/workflows/auto-tag.yml` showing "No such file or directory" or equivalent, plus `ls .github/workflows/` showing the file is absent.

**[CHK-06] publish.yml is preserved unchanged**

- Action: Compare `.github/workflows/publish.yml` content against the original. Verify it triggers on `v*` tags, uses OIDC trusted publishing, and contains the same steps.
- Expected Outcome: The file is identical to its original content. It still triggers on `push: tags: ['v*']`, has `id-token: write` permission, and runs `npm publish *.tgz --provenance`.
- Required Evidence: `git diff` output for `.github/workflows/publish.yml` showing no changes, or `diff` command output confirming identical content.

**[CHK-07] build-release.yml exists with correct structure**

- Action: Read `.github/workflows/build-release.yml` and verify its YAML structure.
- Expected Outcome: The workflow triggers on `push: branches: [main]`, has `contents: write` permission, includes a concurrency group, runs `npm ci`, `npm test`, creates `build-metadata.json`, creates a tarball, and publishes a GitHub Release with tag `latest` (not matching `v*`).
- Required Evidence: Full file content showing all required YAML keys and values.

**[CHK-08] No hardcoded npm install -g git+https references remain**

- Action: Run a case-insensitive search across all source files for `npm install -g git+https` and for `GIT_INSTALL_SPEC`.
- Expected Outcome: Zero matches for both search patterns across all `.ts`, `.js`, `.yml`, and `.md` files in the repository (excluding `node_modules/` and `.git/`).
- Required Evidence: grep/search command output showing zero matches for both patterns.

**[CHK-09] Update module uses GitHub REST API, not git ls-remote**

- Action: Search `src/update/check.ts` for `git ls-remote` and verify `fetchLatestRelease` function exists using `fetch()`.
- Expected Outcome: No `git ls-remote` string in `src/update/check.ts`. A `fetchLatestRelease` function is exported that calls `api.github.com`. A `getGitHubToken` function is exported for auth token discovery.
- Required Evidence: Search output confirming absence of `git ls-remote` in check.ts, plus source excerpt showing `fetchLatestRelease` function signature and the `api.github.com` URL.

**[CHK-10] Staged update mechanism implemented in perform.ts**

- Action: Read `src/update/perform.ts` and verify it implements staged download-validate-swap with backup/rollback.
- Expected Outcome: The file exports a `performStagedUpdate` function (or equivalent) that: (a) downloads a tarball to a staging directory under `~/.hlx/staging/`, (b) extracts via `tar`, (c) calls validation on the staged directory, (d) does rename-based swap with `.bak` backup directories, (e) cleans up on success, (f) restores from backup on swap failure. No `npm install -g` string present.
- Required Evidence: Source code excerpt showing the staging path, download logic, tar extraction, validation call, rename-based swap with `.bak`, cleanup, and rollback logic. Grep output confirming no `npm install -g` in the file.

**[CHK-11] Validation operates on staged directory, not npm global path**

- Action: Read `src/update/validate.ts` and verify it validates a staging directory.
- Expected Outcome: The file exports a `validateStaged` (or equivalent) function that takes a directory path, checks for `dist/index.js` existence, and runs `node <dir>/dist/index.js --version` with `HLX_SKIP_UPDATE_CHECK=1`. No `npm root -g` string present.
- Required Evidence: Source code excerpt showing the function signature, entrypoint existence check, `--version` subprocess call, and `HLX_SKIP_UPDATE_CHECK` usage. Grep output confirming no `npm root` in the file.

**[CHK-12] Error messages provide explicit GitHub auth guidance**

- Action: Read `src/update/index.ts` and verify that authentication failure handling includes explicit guidance about `GITHUB_TOKEN`, `GH_TOKEN`, or `gh auth login`.
- Expected Outcome: When the GitHub API returns 401/403, the error message mentions at least one of: setting `GITHUB_TOKEN` environment variable, setting `GH_TOKEN` environment variable, or running `gh auth login`.
- Required Evidence: Source code excerpt from `index.ts` showing the auth failure error message with specific GitHub auth guidance.

---

## Success Metrics

1. All quality gates pass: typecheck, build, tests.
2. `auto-tag.yml` removed, `publish.yml` unchanged, `build-release.yml` created.
3. Zero `npm install -g git+https://...` references in the codebase.
4. Update module uses GitHub REST API with staged download-validate-swap.
5. CLI `--version` works after build.
6. Explicit GitHub auth error messaging implemented.
7. Fail-open (auto-update) / fail-closed (manual update) behavior preserved.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements and acceptance criteria | Staged update required; failed updates must never brick CLI; `latest` tag must not trigger npm publish; explicit auth messaging required |
| `scout/reference-map.json` | File inventory, evidence, and unknowns | 5 update files to rewrite, 2 workflows (1 delete, 1 preserve), 6 npm-install references, zero tests, zero production deps |
| `scout/scout-summary.md` | Architecture overview | Confirmed fail-open/fail-closed patterns, import.meta.url for path resolution, build scripts |
| `diagnosis/diagnosis-statement.md` | Root cause analysis | 4 root causes: source-based install requires build tools, destructive npm install -g, auto-tag chains to publish, no prebuilt artifact exists |
| `diagnosis/apl.json` | Structured evidence and answers | Confirmed rolling `latest` tag, GitHub Releases, GITHUB_TOKEN sufficiency, zero production deps |
| `product/product.md` | Product vision and use cases | MVP features, success criteria, key design principles (never brick, fail-open/closed split) |
| `tech-research/tech-research.md` | Architecture decisions and API design | Option A chosen (GitHub Releases + rolling `latest` tag); rename-based swap; system tar; build-metadata.json; auth chain; cross-platform considerations |
| `tech-research/apl.json` | Technical answers with evidence | GitHub REST API for SHA comparison, staged install mechanism details, Windows file-locking risk analysis |
| `repo-guidance.json` | Repo intent | Single repo `helix-cli` is sole change target |
| `src/update/perform.ts` | Current update executor | Confirmed `spawnSync('npm install -g ...')` — exact mechanism being replaced |
| `src/update/check.ts` | Remote SHA check | Confirmed `git ls-remote` and `GIT_INSTALL_SPEC` constant to remove |
| `src/update/index.ts` | Update orchestration | Confirmed fail-open/fail-closed patterns, recovery messages with npm references |
| `src/update/validate.ts` | Post-update validation | Entirely npm-path-dependent — resolves `npm root -g` |
| `src/update/version.ts` | Version display | Confirmed `import.meta.url` pattern; no changes needed |
| `src/lib/config.ts` | Config and InstallSource type | `InstallSource` already has `mode: 'github'` — no type changes needed |
| `src/docs/cli-content.ts` | CLI documentation | Two npm install references at lines 18 and 301 |
| `src/skill/show.ts` | Skill show command | npm install recovery message at line 15 |
| `src/skill/paths.ts` | Skill path resolution | npm install recovery message at line 25 |
| `.github/workflows/auto-tag.yml` | Auto-tag workflow | Confirmed to delete |
| `.github/workflows/publish.yml` | npm publish workflow | Confirmed to preserve unchanged |
| `package.json` | Project configuration | Zero production deps, prepare -> tsc, bin entry, files array, engines >= 18 |
| `skill-content/references/commands.md` | Command reference | hlx update description already mentions GitHub — may need minor update |

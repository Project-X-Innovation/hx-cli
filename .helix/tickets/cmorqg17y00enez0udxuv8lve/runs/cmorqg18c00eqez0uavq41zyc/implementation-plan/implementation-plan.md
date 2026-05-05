# Implementation Plan — BLD-375: Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Overview

Implement npm Trusted Publishing for `@projectxinnovation/helix-cli` by closing four gaps in the repo: (1) add required `repository` and `publishConfig` metadata to `package.json`, (2) create `.github/workflows/publish.yml` with OIDC permissions and tarball validation, (3) migrate the `hlx update` subsystem from GitHub-direct (git ls-remote / github: install) to npm-based (npm view / npm install), and (4) add `.npmignore` to exclude test artifacts from the published tarball.

## Implementation Principles

- **Fail closed**: Every pipeline stage (build, test, pack validation, OIDC auth) must block publish on failure. No fallback to token-based publishing.
- **Validate the artifact, not the tree**: Pack validation inspects the actual tarball, not the working directory.
- **Zero new runtime dependencies**: The project has no runtime dependencies; semver comparison uses a minimal numeric function.
- **Minimal surface**: Only touch files identified in diagnosis. Preserve the `hlx` binary name, `dist/index.js` entrypoint, and `version.ts` relative-path resolution.
- **Preserve test workflow**: Test files must remain in `dist/` for the test runner (`node --test dist/**/*.test.js`); only the published tarball excludes them.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add npm Trusted Publishing metadata to package.json | Updated `package.json` with `repository` and `publishConfig` fields |
| 2 | Exclude test files from published tarball | New `.npmignore` file |
| 3 | Extend InstallSource type for npm mode | Updated `src/lib/config.ts` |
| 4 | Migrate version check to npm registry | Updated `src/update/check.ts` |
| 5 | Migrate install command to npm registry | Updated `src/update/perform.ts` |
| 6 | Migrate update orchestration to npm-based flow | Updated `src/update/index.ts` |
| 7 | Update CLI help text to reflect npm updates | Updated `src/index.ts` |
| 8 | Create publish workflow with OIDC and tarball validation | New `.github/workflows/publish.yml` |

## Detailed Implementation Steps

### Step 1: Add npm Trusted Publishing metadata to package.json

**Goal**: Add the `repository` and `publishConfig` fields required for npm Trusted Publishing OIDC identity verification.

**What to Build**:

Edit `package.json` to add two new top-level fields:

1. `repository` field (required by npm Trusted Publishing to match the GitHub repo):
   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/Project-X-Innovation/helix-cli.git"
   }
   ```

2. `publishConfig` field (sets public access for scoped package and enables provenance):
   ```json
   "publishConfig": {
     "access": "public",
     "provenance": true,
     "registry": "https://registry.npmjs.org"
   }
   ```

Place these after the existing `license` field and before `devDependencies`. Do not modify any other fields.

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm test` passes
- Confirm `repository.url` matches `https://github.com/Project-X-Innovation/helix-cli.git` in the file

**Success Criteria**:
- `package.json` contains exact `repository` and `publishConfig` fields
- No existing fields are altered
- Build and tests remain green

---

### Step 2: Exclude test files from published tarball

**Goal**: Create `.npmignore` to exclude compiled test files (`*.test.js`, `*.test.d.ts`) from the published tarball while keeping them in `dist/` for the test runner.

**What to Build**:

Create a new file `.npmignore` in the repo root with these patterns:
```
dist/**/*.test.js
dist/**/*.test.d.ts
```

This works in conjunction with the existing `files: ["dist"]` in `package.json`. The `files` field acts as a whitelist; `.npmignore` further excludes within that whitelist.

**Verification (AI Agent Runs)**:
- `npm pack --dry-run 2>&1` output does NOT contain `dist/lib/flags.test.js` or `dist/lib/resolve-ticket.test.js`
- `npm pack --dry-run 2>&1` output still contains `dist/index.js`
- Test files still exist in `dist/` after build (test runner is unaffected)

**Success Criteria**:
- `.npmignore` file exists at repo root with the two exclusion patterns
- `npm pack --dry-run` shows `dist/index.js` but no `*.test.js` or `*.test.d.ts` files
- `npm test` still passes (test files remain in `dist/`)

---

### Step 3: Extend InstallSource type for npm mode

**Goal**: Add `"npm"` to the `InstallSource.mode` type union and add a `version` field for tracking the installed npm version.

**What to Build**:

Edit `src/lib/config.ts` line 6:

Change the `InstallSource` type from:
```typescript
export type InstallSource = {
  mode: "github" | "unknown";
  repo?: string;
  branch?: string;
  commit?: string;
};
```

To:
```typescript
export type InstallSource = {
  mode: "github" | "npm" | "unknown";
  repo?: string;
  branch?: string;
  commit?: string;
  version?: string;
};
```

The `version` field stores the installed npm version string (e.g., `"1.2.0"`) for npm-mode installs. Existing `repo`, `branch`, and `commit` fields are preserved for backward compatibility with `"github"` mode configs.

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm test` passes

**Success Criteria**:
- `InstallSource.mode` includes `"npm"` in its union type
- `InstallSource` has a `version?: string` field
- All existing fields preserved
- Typecheck passes

---

### Step 4: Migrate version check to npm registry

**Goal**: Replace git-SHA-based version checking with npm-registry-based semver version checking.

**What to Build**:

Rewrite `src/update/check.ts` to:

1. **Keep exports** `CANONICAL_REPO_URL`, `CANONICAL_BRANCH`, `CANONICAL_REPO` (still referenced by `index.ts` for legacy GitHub-mode auto-update recognition).

2. **Add** a new constant for the npm package name:
   ```typescript
   export const NPM_PACKAGE = "@projectxinnovation/helix-cli";
   ```

3. **Add** a `fetchLatestVersion()` function that replaces `fetchRemoteSha()`:
   ```typescript
   export function fetchLatestVersion(): string | null
   ```
   Implementation: use `execSync('npm view @projectxinnovation/helix-cli version', { timeout: 10_000, encoding: 'utf8', stdio: [...] })`. Parse the trimmed output. Return `null` on any failure (package not published, network error, npm not found). Handle the specific case where the package doesn't exist yet on the registry (non-zero exit code) gracefully by returning `null`.

4. **Add** a minimal `isNewerVersion(remote: string, local: string): boolean` function:
   - Split both strings on `.`
   - Compare major, minor, patch numerically
   - Return `true` only if remote is strictly newer than local
   - Return `false` on parse failure (defensive)

5. **Keep** `fetchRemoteSha()` and `isUpdateAvailable()` intact for now — they are still referenced by `index.ts` during the transition. They will become unused after Step 6 updates `index.ts`, but removing them in the same step avoids circular dependencies. (They can be cleaned up as dead code in Step 6 if no longer imported.)

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm test` passes
- The `isNewerVersion` function logic is testable: `isNewerVersion("1.3.0", "1.2.0")` is `true`, `isNewerVersion("1.2.0", "1.2.0")` is `false`, `isNewerVersion("1.1.0", "1.2.0")` is `false`

**Success Criteria**:
- `fetchLatestVersion()` exported and returns `string | null`
- `isNewerVersion()` exported and compares major.minor.patch numerically
- `NPM_PACKAGE` constant exported
- Typecheck and tests pass

---

### Step 5: Migrate install command to npm registry

**Goal**: Change the update install command from `github:Project-X-Innovation/helix-cli#main` to `@projectxinnovation/helix-cli@latest`.

**What to Build**:

Edit `src/update/perform.ts`:

1. **Replace** the import of `CANONICAL_REPO, CANONICAL_BRANCH` with an import of `NPM_PACKAGE` from `./check.js`.

2. **Change** the `installSpec` assignment from:
   ```typescript
   const installSpec = `github:${CANONICAL_REPO}#${CANONICAL_BRANCH}`;
   ```
   To:
   ```typescript
   const installSpec = `${NPM_PACKAGE}@latest`;
   ```

No other changes to the function logic — the `spawnSync`, error handling, and return structure remain the same.

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm test` passes

**Success Criteria**:
- `perform.ts` imports `NPM_PACKAGE` from `./check.js`
- Install spec is `@projectxinnovation/helix-cli@latest`
- No other behavior changes

---

### Step 6: Migrate update orchestration to npm-based flow

**Goal**: Rewrite `src/update/index.ts` to use npm-version-based update checking instead of git-SHA comparison, and update `isCanonicalSource()` to accept both `"github"` and `"npm"` modes.

**What to Build**:

Edit `src/update/index.ts`:

1. **Update imports**: Replace `fetchRemoteSha` with `fetchLatestVersion` and `isNewerVersion`. Keep `CANONICAL_REPO` and `CANONICAL_BRANCH` imports (still used by `isCanonicalSource` for legacy GitHub-mode recognition).

2. **Update `isCanonicalSource()`**: Accept both `"github"` and `"npm"` modes as canonical. For `"github"` mode, keep the existing repo/branch check. For `"npm"` mode, simply return `true` (any npm install from the registry is canonical).
   ```typescript
   function isCanonicalSource(source: InstallSource | undefined): boolean {
     if (!source) return false;
     if (source.mode === "npm") return true;
     return (
       source.mode === "github" &&
       source.repo === CANONICAL_REPO &&
       source.branch === CANONICAL_BRANCH
     );
   }
   ```

3. **Rewrite `runUpdate()`** main flow (after the `--enable-auto` / `--disable-auto` flag handling which stays the same):
   - Call `fetchLatestVersion()` instead of `fetchRemoteSha()`
   - On null, print error about failing to check npm registry
   - Get local version via `getPackageVersion()` (import from `./version.js`)
   - Compare using `isNewerVersion(remoteVersion, localVersion)` instead of SHA comparison
   - If not newer, print "Already up to date."
   - If newer, print version transition (e.g., `1.2.0 -> 1.3.0`)
   - Call `performUpdate()` (unchanged)
   - Call `validateInstall()` (unchanged)
   - On success, `saveConfig` with `mode: "npm"` and `version: remoteVersion` instead of `mode: "github"` and `commit: remoteSha`

4. **Rewrite `checkAutoUpdate()`** similarly:
   - Replace `fetchRemoteSha()` with `fetchLatestVersion()`
   - Get local version via `getPackageVersion()`
   - Compare using `isNewerVersion()` instead of SHA comparison
   - On success, save with `mode: "npm"` and `version: remoteVersion`
   - Update the console messages to show version strings instead of SHAs

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm test` passes

**Success Criteria**:
- `runUpdate()` uses `fetchLatestVersion()` + `isNewerVersion()` for version checking
- `checkAutoUpdate()` uses the same npm-based flow
- `isCanonicalSource()` accepts both `"github"` and `"npm"` modes
- Config saved with `mode: "npm"` and `version` field
- Error messages reference npm registry (not GitHub/git)
- Old git-SHA comparison logic is removed from this file

---

### Step 7: Update CLI help text to reflect npm updates

**Goal**: Change the help text for the `hlx update` command from referencing "GitHub main" to referencing npm.

**What to Build**:

Edit `src/index.ts` line 52:

Change:
```
  hlx update                    Check for and apply updates from GitHub main
```
To:
```
  hlx update                    Check for and apply updates from npm
```

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm run build && node dist/index.js --help` output shows "updates from npm" text

**Success Criteria**:
- Help text no longer references "GitHub main"
- Help text mentions npm for the update command

---

### Step 8: Create publish workflow with OIDC and tarball validation

**Goal**: Create `.github/workflows/publish.yml` — the GitHub Actions workflow for npm Trusted Publishing with OIDC, build/test/validate/publish pipeline.

**What to Build**:

Create directories `.github/workflows/` and the file `.github/workflows/publish.yml`:

**Workflow structure**:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
        # prepare script runs build automatically after npm ci

      - run: npm test

      # Validate tag version matches package.json version
      - name: Verify version match
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PKG_VERSION="$(node -p "require('./package.json').version")"
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "::error::Tag version ($TAG_VERSION) does not match package.json version ($PKG_VERSION)"
            exit 1
          fi

      # Pack and validate tarball contents
      - name: Pack and validate
        run: |
          npm pack
          TARBALL=$(ls *.tgz)
          echo "Tarball: $TARBALL"
          tar -tzf "$TARBALL" > tarball-contents.txt
          echo "--- Tarball contents ---"
          cat tarball-contents.txt
          echo "--- Validating required files ---"
          grep -q "package/dist/index.js" tarball-contents.txt || { echo "::error::dist/index.js missing from tarball"; exit 1; }
          grep -q "package/package.json" tarball-contents.txt || { echo "::error::package.json missing from tarball"; exit 1; }
          # Verify no test files leaked into tarball
          if grep -q "\.test\.\(js\|d\.ts\)" tarball-contents.txt; then
            echo "::error::Test files found in tarball — check .npmignore"
            exit 1
          fi
          echo "Tarball validation passed"

      # Publish the exact validated tarball
      - name: Publish
        run: npm publish *.tgz --provenance
```

Key design decisions reflected:
- **Trigger**: Tag push `v*` — canonical npm trusted publishing pattern
- **OIDC**: `permissions.id-token: write` + `actions/setup-node` with `registry-url` — no `NODE_AUTH_TOKEN` or `NPM_TOKEN`
- **Single job**: Build, test, validate, publish run sequentially in one job so the tarball is the exact validated artifact
- **Version match**: Tag version is compared against `package.json` version before publish
- **Tarball validation**: `npm pack` creates the tarball, `tar -tzf` lists contents, grep checks for `dist/index.js` and `package.json`, and verifies no test files leaked
- **Publish from tarball**: `npm publish *.tgz` publishes the exact validated artifact
- **Node 22**: Current LTS, compatible with `engines: >=18`
- **No secrets required**: OIDC handles authentication

**Verification (AI Agent Runs)**:
- File exists at `.github/workflows/publish.yml`
- YAML is valid (can be checked with a simple parse)
- Contains `id-token: write` permission
- Contains `actions/setup-node` with `registry-url: 'https://registry.npmjs.org'`
- Contains `npm pack` and tarball validation step
- Contains version-match check
- Does not reference `NPM_TOKEN` or `NODE_AUTH_TOKEN`

**Success Criteria**:
- `.github/workflows/publish.yml` exists with the full pipeline
- Triggers on tag push `v*`
- Uses OIDC (no token secrets)
- Validates tarball contains `dist/index.js` and excludes test files
- Publishes the validated tarball with `--provenance`
- Fails closed at every stage

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 installed | available | Dev setup config provides npm run dev on port 3000; repo `engines: >=18` | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06 |
| npm available on PATH | available | Node.js installation includes npm; package-lock.json lockfileVersion 3 | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| Dependencies installed (`npm ci` or `npm install`) | available | Can be run as part of verification setup | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06 |
| `tar` command available | available | Standard on ubuntu/macOS runners; used for tarball inspection simulation | CHK-04 |

### Required Checks

[CHK-01] TypeScript compilation passes with no errors.
- Action: Run `npm run typecheck` in the helix-cli repo root.
- Expected Outcome: Command exits with status code 0 and produces no error output.
- Required Evidence: Full command output showing zero errors and exit code 0.

[CHK-02] Full test suite passes.
- Action: Run `npm test` in the helix-cli repo root.
- Expected Outcome: Command exits with status code 0. All 30+ tests pass (the build step compiles first, then `node --test dist/**/*.test.js` runs all tests).
- Required Evidence: Full command output showing test pass count and exit code 0.

[CHK-03] package.json contains correct repository and publishConfig metadata.
- Action: Run `node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(JSON.stringify({repository:p.repository,publishConfig:p.publishConfig},null,2))"` in the helix-cli repo root.
- Expected Outcome: Output shows `repository.url` equal to `https://github.com/Project-X-Innovation/helix-cli.git`, `repository.type` equal to `git`, `publishConfig.access` equal to `public`, `publishConfig.provenance` equal to `true`, and `publishConfig.registry` equal to `https://registry.npmjs.org`.
- Required Evidence: Command output with the exact JSON field values.

[CHK-04] npm pack produces a tarball with dist/index.js and without test files.
- Action: Run `npm run build && npm pack --dry-run 2>&1` in the helix-cli repo root.
- Expected Outcome: Output includes `dist/index.js` in the file listing. Output does NOT include any `*.test.js` or `*.test.d.ts` filenames.
- Required Evidence: Full `npm pack --dry-run` output showing the included files list, confirming `dist/index.js` presence and absence of test file patterns.

[CHK-05] CLI version command works after build.
- Action: Run `npm run build && node dist/index.js --version` in the helix-cli repo root.
- Expected Outcome: Command prints a version string (e.g., `1.2.0`) and exits with code 0.
- Required Evidence: Command output showing the version string.

[CHK-06] CLI help text references npm for updates.
- Action: Run `npm run build && node dist/index.js --help` in the helix-cli repo root.
- Expected Outcome: The help output for the `hlx update` line contains "npm" and does NOT contain "GitHub main".
- Required Evidence: Full help output text showing the update command description.

[CHK-07] publish.yml exists with correct OIDC structure.
- Action: Read the file `.github/workflows/publish.yml` and verify its contents.
- Expected Outcome: The file exists and contains: (a) `on: push: tags: ['v*']` trigger, (b) `permissions:` block with `id-token: write` and `contents: read`, (c) `actions/setup-node` with `registry-url: 'https://registry.npmjs.org'`, (d) `npm ci` step, (e) `npm test` step, (f) version-match verification step comparing tag to package.json version, (g) `npm pack` step with `tar -tzf` tarball inspection and `dist/index.js` validation, (h) `npm publish` step with `--provenance` flag. The file must NOT contain any reference to `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
- Required Evidence: File content excerpt confirming each required element is present.

[CHK-08] InstallSource type includes npm mode and version field.
- Action: Read `src/lib/config.ts` and inspect the `InstallSource` type definition.
- Expected Outcome: The `mode` field union includes `"npm"` (i.e., `"github" | "npm" | "unknown"`). A `version?: string` field exists on the type.
- Required Evidence: Exact type definition text from the source file.

[CHK-09] check.ts exports npm-based version check functions.
- Action: Read `src/update/check.ts` and verify the exported functions.
- Expected Outcome: File exports `NPM_PACKAGE` constant with value `"@projectxinnovation/helix-cli"`, `fetchLatestVersion()` function that calls `npm view`, and `isNewerVersion()` function that performs numeric major.minor.patch comparison.
- Required Evidence: Source code of the exported functions showing npm view usage and semver comparison logic.

[CHK-10] perform.ts uses npm registry install spec.
- Action: Read `src/update/perform.ts` and verify the install spec.
- Expected Outcome: The `installSpec` variable is set to `${NPM_PACKAGE}@latest` (resolving to `@projectxinnovation/helix-cli@latest`). The file imports `NPM_PACKAGE` from `./check.js`. No reference to `github:` install spec remains.
- Required Evidence: Source code showing the import and installSpec assignment.

[CHK-11] index.ts update orchestration uses npm-based flow.
- Action: Read `src/update/index.ts` and verify the update flow.
- Expected Outcome: `runUpdate()` calls `fetchLatestVersion()` and uses `isNewerVersion()` for comparison. `checkAutoUpdate()` uses the same npm-based flow. `isCanonicalSource()` returns `true` for `mode === "npm"`. Config is saved with `mode: "npm"` and `version` field. No SHA comparison logic remains for the main update path.
- Required Evidence: Source code of `runUpdate()`, `checkAutoUpdate()`, and `isCanonicalSource()` functions.

[CHK-12] .npmignore file exists with test exclusion patterns.
- Action: Read `.npmignore` in the repo root.
- Expected Outcome: File contains `dist/**/*.test.js` and `dist/**/*.test.d.ts` patterns.
- Required Evidence: Full file contents.

## Success Metrics

1. All 12 Required Checks pass.
2. No new runtime dependencies added to `package.json`.
3. No changes to files outside the identified scope (package.json, .npmignore, .github/workflows/publish.yml, src/lib/config.ts, src/update/check.ts, src/update/perform.ts, src/update/index.ts, src/index.ts).
4. Existing CLI commands (login, token, org, tickets, inspect, comments) remain unaffected.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements, acceptance criteria, constraints | OIDC publish, pack validation, no NPM_TOKEN, fail-closed, update path migration, repository metadata |
| `scout/reference-map.json` | File inventory with evidence and unknowns | Confirmed all gaps: no repository field, no workflows, GitHub-direct update, test files in tarball; version 1.2.0 |
| `scout/scout-summary.md` | Codebase analysis narrative | Validated boundary file list; confirmed what works correctly (files field, bin mapping, version.ts path) |
| `diagnosis/diagnosis-statement.md` | Root cause analysis of four gaps | Mapped each gap to specific files and lines; provided fix direction for metadata, workflow, update, tarball |
| `diagnosis/apl.json` | Structured Q&A with evidence | Confirmed OIDC requirements, version.ts npm compatibility, update migration scope |
| `product/product.md` | Product vision, MVP features, success criteria | Defined fail-closed principle, validate-the-artifact requirement, minimal published surface |
| `tech-research/tech-research.md` | Architecture decisions with rationale | Tag-push trigger, npm pack + tar inspection, npm view for version check, minimal semver comparison, .npmignore for test exclusion |
| `tech-research/apl.json` | Tech research Q&A with evidence | Confirmed npm OIDC works without NODE_AUTH_TOKEN, publishConfig fields, first-publish --access public |
| `repo-guidance.json` | Repo intent classification | Confirmed helix-cli is sole target repo; no cross-repo impact |
| `package.json` (direct read) | Current package configuration | Missing `repository`, no `publishConfig`; `files: ["dist"]`; `bin.hlx: "dist/index.js"`; version 1.2.0 |
| `src/lib/config.ts` (direct read) | InstallSource type definition | `mode: "github" \| "unknown"` — needs `"npm"` variant and `version` field |
| `src/update/check.ts` (direct read) | Current version-check implementation | Uses `git ls-remote` for SHA comparison; defines canonical repo constants |
| `src/update/perform.ts` (direct read) | Current install implementation | Hardcoded `github:` install spec on line 15 |
| `src/update/index.ts` (direct read) | Update orchestration logic | SHA comparison, `mode: "github"` metadata, `isCanonicalSource()` gating |
| `src/update/validate.ts` (direct read) | Post-install validation pattern | Checks `dist/index.js` existence + version smoke test — unchanged by this work |
| `src/update/version.ts` (direct read) | Runtime version reading | `../../package.json` relative path works from npm install — unchanged by this work |
| `src/index.ts` (direct read) | CLI entrypoint and help text | Line 52 references "GitHub main"; needs update to "npm" |
| `tsconfig.json` (direct read) | Build configuration | Compiles all `src/` to `dist/`; no test exclusion (handled by `.npmignore`) |

# Implementation Actual — BLD-375: Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Summary of Changes

Implemented npm Trusted Publishing for `@projectxinnovation/helix-cli` by:
1. Adding `repository` and `publishConfig` metadata to `package.json` with test file exclusion via `files` field negation patterns
2. Creating `.npmignore` for documentation of test exclusion intent
3. Extending the `InstallSource` type with `"npm"` mode and `version` field
4. Adding npm registry-based version checking (`fetchLatestVersion`, `isNewerVersion`)
5. Migrating the install spec from `github:` to `@projectxinnovation/helix-cli@latest`
6. Rewriting update orchestration (`runUpdate`, `checkAutoUpdate`) to use npm-based flow
7. Updating CLI help text from "GitHub main" to "npm"
8. Creating `.github/workflows/publish.yml` with OIDC permissions and tarball validation

## Files Changed

| File | Why Changed | Shared/Review Hotspot |
|------|-------------|----------------------|
| `package.json` | Added `repository`, `publishConfig` fields for npm Trusted Publishing; added negation patterns to `files` array to exclude test files from tarball | **Public interface**: defines package identity, publish config, and tarball contents |
| `.npmignore` (new) | Documents intent to exclude test files from tarball (no-op with npm 11 when `files` is present, kept for documentation) | None |
| `src/lib/config.ts` | Extended `InstallSource.mode` to include `"npm"` and added `version?: string` field | **Shared type**: `InstallSource` is used by config persistence and update orchestration |
| `src/update/check.ts` | Added `NPM_PACKAGE` constant, `fetchLatestVersion()`, and `isNewerVersion()`; retained `fetchRemoteSha`/`isUpdateAvailable` for backward compatibility | **Cross-module interface**: exports consumed by `perform.ts` and `index.ts` |
| `src/update/perform.ts` | Changed import from `CANONICAL_REPO`/`CANONICAL_BRANCH` to `NPM_PACKAGE`; changed install spec to `NPM_PACKAGE@latest` | **State/data flow**: controls what npm installs globally |
| `src/update/index.ts` | Rewrote `runUpdate()` and `checkAutoUpdate()` to use npm version comparison instead of SHA; updated `isCanonicalSource()` to accept `"npm"` mode; changed config persistence to `mode: "npm"` with `version` | **Core update orchestration**: controls CLI self-update behavior |
| `src/index.ts` | Changed help text for `hlx update` from "GitHub main" to "npm" | **User-visible UI**: CLI help output |
| `.github/workflows/publish.yml` (new) | Full publish workflow with OIDC, build/test/validate/publish pipeline | **CI/CD infrastructure**: defines the release flow |

## Steps Executed

### Step 1: package.json metadata
Added `repository` (type: git, url: `https://github.com/Project-X-Innovation/helix-cli.git`) and `publishConfig` (access: public, provenance: true, registry: `https://registry.npmjs.org`) fields after the `license` field.

### Step 2: .npmignore + files field fix
Created `.npmignore` with `dist/**/*.test.js` and `dist/**/*.test.d.ts` patterns. Discovered that npm 11 ignores root `.npmignore` when `files` is present in `package.json` (Context7-confirmed breaking change). Added negation patterns `!dist/**/*.test.js` and `!dist/**/*.test.d.ts` to the `files` array, which is the effective mechanism for test exclusion.

### Step 3: InstallSource type extension
Changed `mode` from `"github" | "unknown"` to `"github" | "npm" | "unknown"` and added `version?: string` field.

### Step 4: npm version check functions
Added `NPM_PACKAGE` constant, `fetchLatestVersion()` (uses `npm view`), and `isNewerVersion()` (numeric major.minor.patch comparison). Retained legacy `fetchRemoteSha()`/`isUpdateAvailable()` for backward compatibility.

### Step 5: npm install spec
Changed import from `CANONICAL_REPO, CANONICAL_BRANCH` to `NPM_PACKAGE`. Changed `installSpec` from `github:${CANONICAL_REPO}#${CANONICAL_BRANCH}` to `${NPM_PACKAGE}@latest`.

### Step 6: Update orchestration rewrite
Rewrote both `runUpdate()` and `checkAutoUpdate()` to use `fetchLatestVersion()` + `isNewerVersion()` + `getPackageVersion()` instead of SHA comparison. Updated `isCanonicalSource()` to accept `mode === "npm"`. Config now saves `mode: "npm"` with `version` field. Error messages reference npm registry. Recovery instructions reference npm install command.

### Step 7: Help text update
Changed line 52 from "Check for and apply updates from GitHub main" to "Check for and apply updates from npm".

### Step 8: Publish workflow
Created `.github/workflows/publish.yml` with: tag push `v*` trigger, `id-token: write` + `contents: read` permissions, `actions/setup-node` with `registry-url`, `npm ci` (triggers build via prepare), `npm test`, version-match validation, tarball pack + inspect (`tar -tzf`) with `dist/index.js` assertion and test file absence check, and `npm publish *.tgz --provenance`.

## Verification Commands Run + Outcomes

| Command | Purpose | Outcome |
|---------|---------|---------|
| `npm install` | Install deps + build (prepare) | exit 0, 0 vulnerabilities |
| `npm run typecheck` | CHK-01: TypeScript compilation | exit 0, no errors |
| `npm test` | CHK-02: Full test suite | exit 0, 30/30 tests pass |
| `node -e "...JSON.stringify({repository, publishConfig})"` | CHK-03: Metadata fields | Correct values confirmed |
| `npm run build && npm pack --dry-run` | CHK-04: Tarball contents | 73 files, dist/index.js present, no *.test.js/d.ts |
| `node dist/index.js --version` | CHK-05: CLI version | Output: 1.2.0 |
| `node dist/index.js --help` | CHK-06: Help text | Shows "updates from npm", no "GitHub main" |
| `grep -i NPM_TOKEN\|NODE_AUTH_TOKEN publish.yml` | CHK-07 (partial): No token secrets | No matches (exit 1) |

## Test/Build Results

- **TypeScript compilation**: Clean, 0 errors
- **Test suite**: 30/30 tests pass across 6 suites (flags, resolve-ticket)
- **npm pack**: 73 files, 22.4 kB compressed, no test files leaked
- **CLI runtime**: `--version` returns 1.2.0, `--help` shows updated text

## Deviations from Plan

1. **Test file exclusion mechanism**: The plan specified `.npmignore` at the repo root as the sole mechanism for excluding test files from the tarball. With npm 11.11.0, root-level `.npmignore` is ignored when the `files` field is present in `package.json` (confirmed via Context7 npm docs: "If a files array is present in the package.json, then rules in .gitignore and .npmignore files from the root will be ignored"). The fix: added negation patterns `!dist/**/*.test.js` and `!dist/**/*.test.d.ts` to the `files` array in `package.json`. The `.npmignore` file is retained for documentation of intent but is effectively a no-op.

## Known Limitations / Follow-ups

- **npm Trusted Publishing UI setup required**: The npm org must configure Trusted Publishing in the npm UI, linking the `@projectxinnovation/helix-cli` package to the `Project-X-Innovation/helix-cli` GitHub repo and the `publish.yml` workflow. This is outside code scope.
- **First publish**: The package must be published for the first time with `--access public` (handled by `publishConfig.access`). If the `@projectxinnovation` scope doesn't exist on npm, it must be created first.
- **Legacy GitHub-mode users**: Users with `installSource.mode: "github"` in their config will transition to npm mode on their first `hlx update` run, since `isCanonicalSource()` still accepts GitHub mode.
- **Legacy functions retained**: `fetchRemoteSha()` and `isUpdateAvailable()` are retained in `check.ts` but no longer called by the main update flow. They can be removed in a future cleanup.

## Verification Plan Results

| Check ID | Outcome | Evidence/Notes |
|----------|---------|----------------|
| CHK-01 | pass | `npm run typecheck` exits 0, no errors |
| CHK-02 | pass | `npm test` exits 0, 30/30 tests pass |
| CHK-03 | pass | JSON output shows correct repository.url, publishConfig.access/provenance/registry |
| CHK-04 | pass | `npm pack --dry-run`: 73 files, `dist/index.js` present, zero `*.test.js` or `*.test.d.ts` files |
| CHK-05 | pass | `node dist/index.js --version` outputs `1.2.0` |
| CHK-06 | pass | `node dist/index.js --help` shows "Check for and apply updates from npm", no "GitHub main" |
| CHK-07 | pass | File inspection confirms: tag trigger `v*`, `id-token: write`, `actions/setup-node` with `registry-url`, `npm ci`, `npm test`, version-match step, `npm pack` + `tar -tzf` + `dist/index.js` grep, `npm publish *.tgz --provenance`. No NPM_TOKEN/NODE_AUTH_TOKEN references. |
| CHK-08 | pass | `src/lib/config.ts` line 6: `mode: "github" \| "npm" \| "unknown"`, `version?: string` present |
| CHK-09 | pass | `src/update/check.ts`: `NPM_PACKAGE = "@projectxinnovation/helix-cli"`, `fetchLatestVersion()` uses `npm view`, `isNewerVersion()` compares major.minor.patch |
| CHK-10 | pass | `src/update/perform.ts`: imports `NPM_PACKAGE` from `./check.js`, `installSpec = \`\${NPM_PACKAGE}@latest\``, no `github:` reference |
| CHK-11 | pass | `src/update/index.ts`: `runUpdate()` uses `fetchLatestVersion()` + `isNewerVersion()`, `checkAutoUpdate()` same, `isCanonicalSource()` returns true for `mode === "npm"`, config saved with `mode: "npm"` and `version`, no SHA logic in main path |
| CHK-12 | pass | `.npmignore` exists with `dist/**/*.test.js` and `dist/**/*.test.d.ts` patterns |

All 12 Required Checks pass. Self-verification complete.

## APL Statement Reference

Implementation complete. All 8 steps from the implementation plan were executed. package.json has repository and publishConfig metadata with test-file exclusion via files field negation patterns. .npmignore exists for documentation. InstallSource type extended with npm mode and version field. Update mechanism migrated from GitHub-direct to npm-based (fetchLatestVersion, isNewerVersion, NPM_PACKAGE@latest). Help text updated. Publish workflow created with OIDC permissions, tarball validation, and provenance. One deviation: test exclusion mechanism uses files field negation instead of .npmignore alone due to npm 11 behavior. All 12 verification checks pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements and acceptance criteria | OIDC publish, pack validation, no NPM_TOKEN, fail-closed, update path migration |
| `implementation-plan/implementation-plan.md` | Step-by-step implementation blueprint with verification plan | 8 steps with code changes, 12 verification checks |
| `implementation-plan/apl.json` | Structured Q&A with dependency ordering | Confirmed step execution order and verification approach |
| `diagnosis/diagnosis-statement.md` | Root cause analysis of four gaps | Mapped each gap to specific files and lines |
| `product/product.md` | Product vision and success criteria | Fail-closed principle, validate-the-artifact requirement |
| `src/lib/config.ts` (direct read) | InstallSource type before change | `mode: "github" \| "unknown"` — needed `"npm"` and `version` |
| `src/update/check.ts` (direct read) | Version check implementation before change | Used git ls-remote; needed npm view replacement |
| `src/update/perform.ts` (direct read) | Install implementation before change | Hardcoded github: spec; needed npm package spec |
| `src/update/index.ts` (direct read) | Update orchestration before change | SHA comparison; needed semver comparison |
| `src/index.ts` (direct read) | CLI entrypoint before change | Help text referenced "GitHub main" |
| `src/update/version.ts` (direct read) | Runtime version reader | Confirmed ../../package.json path works from npm install |
| `src/update/validate.ts` (direct read) | Post-install validation | Confirmed existing validation pattern is unchanged |
| Context7 npm docs | npm files + .npmignore interaction | Confirmed files field overrides .npmignore in npm 11 |

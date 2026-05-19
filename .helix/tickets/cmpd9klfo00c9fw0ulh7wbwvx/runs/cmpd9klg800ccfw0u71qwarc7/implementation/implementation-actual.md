# Implementation Actual — BLD-517: Install and update hlx from GitHub main instead of npm

## Summary of Changes

Rewired the `hlx` CLI update system from npm-registry-based semver comparison to GitHub-main SHA-based comparison. Removed all npm registry query code (`NPM_PACKAGE`, `fetchLatestVersion()`, `isNewerVersion()`), added `GIT_INSTALL_SPEC` constant, switched install/update flows to use `fetchRemoteSha()` with SHA comparison, added migration detection for npm-sourced installs, extended `--version` to include short SHA, and updated all user-facing documentation and error messages to reference the `git+https://` URL.

## Files Changed

| File | Why Changed | Shared/Review Hotspot |
|------|-------------|----------------------|
| `src/update/check.ts` | Removed `NPM_PACKAGE`, `fetchLatestVersion()`, `isNewerVersion()`. Added `GIT_INSTALL_SPEC` constant composed from existing `CANONICAL_REPO_URL` + `CANONICAL_BRANCH`. | **Public interface change** — exports removed; downstream consumers (index.ts, perform.ts) updated in same PR. |
| `src/update/perform.ts` | Changed import from `NPM_PACKAGE` to `GIT_INSTALL_SPEC`. Install spec now uses git+https URL instead of npm registry package. | Touches install execution path — critical for update behavior. |
| `src/update/version.ts` | Added `loadFullConfig()` import; `getPackageVersion()` now appends `(short-sha)` when config has `installSource.commit`. Falls back to semver-only on any failure. | **Public interface change** — return value format changes (semver-only to `semver (sha)`). |
| `src/update/index.ts` | Replaced `fetchLatestVersion`/`isNewerVersion` with `fetchRemoteSha`/SHA comparison in both `runUpdate()` and `checkAutoUpdate()`. Added migration detection for npm-sourced installs. Updated error messages and recovery commands to use `GIT_INSTALL_SPEC`. `saveConfig()` calls now record `{mode: "github", repo, branch, commit}`. | **Core flow change** — touches both update paths and config persistence. Key review hotspot. |
| `src/index.ts` | Updated usage text from "updates from npm" to "updates from GitHub". Added fallback note to `--version` handler when SHA is absent. | CLI entry point — user-facing text change. |
| `src/docs/cli-content.ts` | Updated 4 npm references: Package → Source label, install command to git+https URL, update description to "checks GitHub", troubleshooting reinstall to git+https URL. Changed keyword "npm" to "github". | Documentation surface — user-facing text. |
| `src/skill/show.ts` | Updated reinstall error message from `@projectxinnovation/helix-cli@latest` to `git+https://...#main`. | Error message — user-facing text. |
| `src/skill/paths.ts` | Updated reinstall error message from `@projectxinnovation/helix-cli@latest` to `git+https://...#main`. | Error message — user-facing text. |
| `skill-content/references/commands.md` | Changed "updates from npm" to "updates from GitHub" in `hlx update` description. | Documentation surface — user-facing text. |

## Steps Executed

### Step 1: Update src/update/check.ts
- Removed `NPM_PACKAGE` constant (was line 9).
- Removed `fetchLatestVersion()` function (was lines 15-29).
- Removed `isNewerVersion()` function (was lines 36-47).
- Added `GIT_INSTALL_SPEC` export: `` `git+${CANONICAL_REPO_URL}#${CANONICAL_BRANCH}` ``.
- Kept `fetchRemoteSha()` and `isUpdateAvailable()` unchanged.

### Step 2: Update src/update/perform.ts
- Changed import from `{ NPM_PACKAGE }` to `{ GIT_INSTALL_SPEC }`.
- Changed install spec from `${NPM_PACKAGE}@latest` to `GIT_INSTALL_SPEC`.
- Updated JSDoc comment from "npm registry" to "GitHub repository".

### Step 3: Update src/update/version.ts
- Added import of `loadFullConfig` from `../lib/config.js`.
- `getPackageVersion()` now reads `installSource.commit` from config after reading semver.
- Returns `<semver> (<commit.slice(0, 7)>)` when commit is a non-empty string >= 7 chars.
- Returns semver-only when commit is absent or config read fails.
- Wrapped config read in try-catch to ensure function never throws.

### Step 4: Rewire src/update/index.ts
- Replaced imports: `fetchLatestVersion`/`isNewerVersion` → `fetchRemoteSha`/`GIT_INSTALL_SPEC`.
- `runUpdate()`: uses `fetchRemoteSha()` with null check (exit 1 on failure); added migration detection for npm/unknown/missing install source; SHA comparison replaces semver comparison; error messages include `GIT_INSTALL_SPEC` recovery command; `saveConfig()` records `{mode: "github", repo, branch, commit}`.
- `checkAutoUpdate()`: uses `fetchRemoteSha()` with stderr warning on null; SHA comparison replaces semver; `saveConfig()` records github mode with SHA; warning on failure (non-blocking).

### Step 5: Update src/index.ts
- Changed usage text from "Check for and apply updates from npm" to "Check for and apply updates from GitHub".
- Added SHA-missing fallback note to `--version` handler: prints `"Run 'hlx update' to refresh install metadata."` to stderr when version string has no parenthesized SHA.

### Step 6: Update documentation and error messages
- `src/docs/cli-content.ts`: 4 changes (Package→Source label, install command, update description, troubleshooting reinstall) + keyword replacement.
- `src/skill/show.ts`: reinstall error message updated.
- `src/skill/paths.ts`: reinstall error message updated.
- `skill-content/references/commands.md`: update description changed.

### Step 7: Build verification
- `npm run typecheck` — exit 0, no errors.
- `npm run build` — exit 0, `dist/` directory populated with all expected files.
- `node dist/index.js --version` — outputs `1.3.4` + stderr note (correct for no config SHA).
- `npm test` — all 51 tests pass.

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npm run typecheck` | Exit 0, no type errors |
| `npm run build` | Exit 0, dist/update/ contains check.js, perform.js, version.js, index.js, validate.js |
| `HLX_SKIP_UPDATE_CHECK=1 node dist/index.js --version` | Output: `1.3.4` (stdout), `Run 'hlx update' to refresh install metadata.` (stderr) — correct |
| `npm test` | 51 tests pass, 0 fail |
| `grep fetchLatestVersion\|npm view\|npm registry src/update/` | Zero matches |
| `grep @projectxinnovation/helix-cli@latest src/ skill-content/` | Zero matches |
| `grep GIT_INSTALL_SPEC src/update/check.ts src/update/perform.ts` | Defined in check.ts:9, imported in perform.ts:2, used in perform.ts:15 |
| `grep 'mode.*"github"\|commit.*remoteSha\|CANONICAL_REPO\|CANONICAL_BRANCH' src/update/index.ts` | saveConfig calls at lines 109-112 and 175-178 record github mode with SHA |
| `grep 'git+https://github.com/Project-X-Innovation/helix-cli.git#main' src/docs/cli-content.ts src/skill/show.ts src/skill/paths.ts` | 4 matches: cli-content.ts:18, cli-content.ts:301, show.ts:15, paths.ts:25 |

## Test/Build Results

- **Typecheck**: Passes with zero errors.
- **Build**: Compiles successfully to `dist/`.
- **Tests**: All 51 existing tests pass (flags.test.ts, resolve-ticket.test.ts, skill.test.ts).
- **CLI execution**: `--version` runs correctly with expected output format.

## Deviations from Plan

None. All 7 steps executed as planned with no deviations.

## Known Limitations / Follow-ups

- No update-module tests exist in the codebase. The update flow changes are verified by typecheck, build, existing test suite, and static analysis — not by unit tests of the update functions themselves. This is a pre-existing gap noted in the plan and ticket.
- `isUpdateAvailable()` in check.ts is retained but unused by the current update flows. It remains a valid utility function that could be used by future callers.
- The `publishConfig` in package.json still references the npm registry. This is explicitly out of scope per the ticket.
- CI workflows (auto-tag, npm publish) are dead weight after this change but are explicitly out of scope per the ticket.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | **pass** | `npm run typecheck` exits 0 with no type errors. |
| CHK-02 | **pass** | `npm run build` exits 0. `dist/update/` contains check.js, perform.js, version.js, index.js, validate.js. |
| CHK-03 | **pass** | `HLX_SKIP_UPDATE_CHECK=1 node dist/index.js --version` outputs `1.3.4` (semver from package.json) + stderr note. Exit code 0. |
| CHK-04 | **pass** | `grep -rn "fetchLatestVersion\|npm view\|npm registry" src/update/` returns zero matches. |
| CHK-05 | **pass** | `grep -rn "@projectxinnovation/helix-cli@latest" src/ skill-content/` returns zero matches. |
| CHK-06 | **pass** | `grep -n "GIT_INSTALL_SPEC" src/update/check.ts src/update/perform.ts` shows: defined in check.ts:9 as export containing `git+${CANONICAL_REPO_URL}#${CANONICAL_BRANCH}`, imported and used in perform.ts:2,15. |
| CHK-07 | **pass** | `grep -n` in src/update/index.ts shows saveConfig calls at lines 109-112 and 175-178 recording `{mode: "github", repo: CANONICAL_REPO, branch: CANONICAL_BRANCH, commit: remoteSha}`. |
| CHK-08 | **pass** | `grep` for `git+https://github.com/Project-X-Innovation/helix-cli.git#main` returns 4 matches: cli-content.ts:18, cli-content.ts:301, show.ts:15, paths.ts:25. |
| CHK-09 | **pass** | `npm test` — 51 tests pass, 0 fail, 0 cancelled, 0 skipped. |

All 9 required checks pass.

## APL Statement Reference

Implementation complete. All 7 plan steps executed: check.ts cleaned of npm infrastructure with GIT_INSTALL_SPEC added; perform.ts switched to git URL; version.ts extended with SHA display; update index.ts rewired to SHA-based comparison with migration; CLI entry point updated; all documentation updated; build/typecheck/tests all pass. followups=[].

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification with acceptance criteria | SHA-based comparison, git+https install URL, transparent npm migration, fail-closed semantics, --version with SHA |
| implementation-plan/implementation-plan.md | Step-by-step implementation blueprint | 7-step plan with specific code changes per file, verification checks, and success criteria |
| implementation-plan/apl.json | Plan answers and dependency chain | Confirmed step ordering, file classifications (code vs doc changes), and runnable verification checks |
| diagnosis/diagnosis-statement.md | Root cause analysis and change map | 12 npm-referencing locations across 7 files; confirmed validateInstall() unchanged; catalogued all changes needed |
| product/product.md | Product vision and success criteria | Defined fail-closed vs fail-open behavior split; confirmed single repo scope; migration is inline |
| repo-guidance.json | Repo intent classification | Confirmed helix-cli is sole target repo |
| src/update/check.ts (direct read) | Verified current state before editing | NPM_PACKAGE at line 9, fetchLatestVersion at lines 15-29, isNewerVersion at lines 36-47 — all removed |
| src/update/index.ts (direct read) | Verified update flow structure before rewriting | runUpdate/checkAutoUpdate both used npm-based flow; saveConfig recorded mode:"npm" |
| src/update/perform.ts (direct read) | Verified install spec before changing | Used NPM_PACKAGE@latest; changed to GIT_INSTALL_SPEC |
| src/update/version.ts (direct read) | Verified version function before extending | Read semver from package.json only; extended with config SHA |
| src/lib/config.ts (direct read) | Verified config types and loadFullConfig API | InstallSource type has commit field; loadFullConfig returns Partial<HxConfig> |
| src/index.ts (direct read) | Verified CLI entry point before updating | Usage text at line 60; --version at line 124 |
| src/docs/cli-content.ts (direct read) | Verified documentation before updating | 4 npm references identified and updated |
| src/skill/show.ts (direct read) | Verified error message before updating | npm reinstall command at line 15 |
| src/skill/paths.ts (direct read) | Verified error message before updating | npm reinstall command at line 25 |
| skill-content/references/commands.md (direct read) | Verified command reference before updating | "updates from npm" description |
| package.json (direct read) | Verified build scripts and package name | prepare: npm run build; name: @projectxinnovation/helix-cli; version 1.3.4 |

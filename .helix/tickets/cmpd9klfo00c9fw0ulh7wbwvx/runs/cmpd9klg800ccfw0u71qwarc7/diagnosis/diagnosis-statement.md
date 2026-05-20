# Diagnosis Statement — BLD-517: Install and update hlx from GitHub main instead of npm

## Problem Summary

The `hlx` CLI update system is built around the npm registry: it queries `npm view` for the latest version, compares semver strings, installs via `npm install -g @projectxinnovation/helix-cli@latest`, and records `{mode: "npm", version}` as the install source. The ticket requires switching to install directly from the GitHub `main` branch via `npm install -g git+https://...#main`, using SHA-based comparison instead of semver, and migrating existing npm-sourced users transparently.

## Root Cause Analysis

This is not a bug fix but a planned architectural change to the update transport. The root cause of the current design's fragility is:

1. **npm registry dependency**: The update flow queries the npm registry via `npm view` (check.ts:17-19) and installs from it (perform.ts:15-17). This creates a dependency on CI publishing to npm, which has been unreliable (the auto-tag CI step has broken, leaving npm behind `main`).

2. **Unused git infrastructure**: The codebase already contains git-based primitives that were added in anticipation of this change but never wired in:
   - `fetchRemoteSha()` (check.ts:54-68) — fetches HEAD SHA via `git ls-remote`
   - `isUpdateAvailable()` (check.ts:73-85) — compares local vs remote SHA
   - `CANONICAL_REPO_URL`, `CANONICAL_BRANCH`, `CANONICAL_REPO` constants (check.ts:3-6)
   - `InstallSource.commit` field in the config type (config.ts:9) — exists but is never written to

3. **Semver-only version tracking**: The update flow compares semver versions (check.ts:36-47) and records only `{mode: "npm", version}` (index.ts:93-97). The SHA is not captured, so there is no way to tell exactly which commit is installed.

The fix is to complete the transition that was started when the git primitives were added: rewire the update flows to use them, change the install spec, add migration logic, and update documentation.

## Evidence Summary

### Core update flow (must change)

| File | Current Behavior | Required Change |
|------|-----------------|-----------------|
| `src/update/check.ts:15-29` | `fetchLatestVersion()` queries npm registry via `npm view` | Replace usage with existing `fetchRemoteSha()` (lines 54-68) |
| `src/update/check.ts:36-47` | `isNewerVersion()` does semver comparison | Replace usage with existing `isUpdateAvailable()` (lines 73-85) |
| `src/update/perform.ts:15-17` | Install spec `@projectxinnovation/helix-cli@latest` | Change to `git+https://github.com/Project-X-Innovation/helix-cli.git#main` |
| `src/update/index.ts:55-67` | `runUpdate()` calls `fetchLatestVersion()` + `isNewerVersion()` | Call `fetchRemoteSha()` + SHA comparison |
| `src/update/index.ts:93-98` | Records `{mode: "npm", version}` | Record `{mode: "github", repo, branch, commit}` |
| `src/update/index.ts:129-139` | `checkAutoUpdate()` uses same npm-based comparison | Switch to SHA-based comparison |
| `src/update/index.ts:155-159` | Auto-update records `{mode: "npm", version}` | Record `{mode: "github", repo, branch, commit}` |
| `src/update/version.ts:10-20` | `getPackageVersion()` returns semver only | Extend to append short SHA from config |

### New logic needed

| Concern | Implementation Scope |
|---------|---------------------|
| Migration from npm install source | Add detection of missing/npm install source in `runUpdate()`, print notice, run install, record as github |
| SHA in --version output | Extend `getPackageVersion()` to read `installSource.commit` from config via `loadFullConfig()` |
| Fail-closed on update | `runUpdate()` must exit non-zero if fetchRemoteSha returns null, install fails, or validation fails |
| Recovery commands in errors | Error messages should include `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main` |

### validateInstall() — likely unchanged

`validateInstall()` constructs the bin target path as `<npm root -g>/@projectxinnovation/helix-cli/dist/index.js` (validate.ts:41-47). npm places packages in `node_modules` using the `name` field from `package.json` regardless of source. Since the name is `@projectxinnovation/helix-cli`, the path should be identical for git-based installs. npm docs confirm `prepare` scripts run for git installs, so the build step (`tsc`) executes automatically. **No changes expected** to `validateInstall()`.

### Documentation and error messages (must update)

| File | Line(s) | Content to Update |
|------|---------|------------------|
| `src/docs/cli-content.ts` | 8 | `**Package:** @projectxinnovation/helix-cli` — remove or update |
| `src/docs/cli-content.ts` | 18 | `npm install -g @projectxinnovation/helix-cli@latest` — change to git+https URL |
| `src/docs/cli-content.ts` | 283 | `checks npm for the latest published version` — update description |
| `src/docs/cli-content.ts` | 301 | npm reinstall command in troubleshooting — change to git+https URL |
| `src/skill/show.ts` | 15 | npm reinstall error message — change to git+https URL |
| `src/skill/paths.ts` | 25 | npm reinstall error message — change to git+https URL |
| `skill-content/references/commands.md` | 95 | `updates from npm` — update to `updates from GitHub` |
| `src/index.ts` | 60 | Usage text `updates from npm` — update |
| `src/update/index.ts` | 59 | Error: `Could not reach the npm registry` — update message |
| `src/update/index.ts` | 87-88 | Recovery command: `npm install -g @projectxinnovation/helix-cli@latest` — update |

### Files not changing

| File | Reason |
|------|--------|
| `src/update/validate.ts` | Path construction uses package name, works for git installs |
| `src/lib/config.ts` | Type and persistence already support the target schema |
| `package.json` | `publishConfig` is out of scope; `prepare` script already correct |
| `.github/workflows/*.yml` | Explicitly out of scope per ticket |

## Success Criteria

1. `runUpdate()` and `checkAutoUpdate()` use `fetchRemoteSha()` for remote state and SHA comparison — no `npm view` calls remain.
2. `performUpdate()` install spec is `git+https://github.com/Project-X-Innovation/helix-cli.git#main`.
3. Install source saved as `{mode: "github", repo: "Project-X-Innovation/helix-cli", branch: "main", commit: <sha>}`.
4. `getPackageVersion()` returns `<semver> (<short-sha>)` when commit is available, semver-only when missing.
5. Migration path: npm-sourced installs are detected and switched transparently on first `hlx update`.
6. All 12 npm-referencing documentation/error locations updated to git+https URL.
7. `runUpdate()` exits non-zero on any fetch/install/validation failure with clear error and recovery command.
8. `checkAutoUpdate()` logs warnings to stderr on failure, never blocks command dispatch.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | SHA-based comparison, git+https install, migration for npm installs, fail-closed, --version with SHA |
| scout/reference-map.json | File map and facts from scout | Identified 12 npm-referencing locations across 7 files; confirmed git primitives already exist but are unused |
| scout/scout-summary.md | Synthesized scout analysis | Confirmed no README.md, no update tests, prepare script is critical for git installs |
| src/update/check.ts | Direct code inspection | fetchRemoteSha() and isUpdateAvailable() exist at lines 54-85 but are not called by update flows; fetchLatestVersion() at line 17 queries npm |
| src/update/index.ts | Direct code inspection | runUpdate() and checkAutoUpdate() use npm-based flow; save {mode:"npm"}; isCanonicalSource() accepts both modes |
| src/update/perform.ts | Direct code inspection | Install spec is NPM_PACKAGE@latest on line 15 |
| src/update/validate.ts | Direct code inspection | Constructs path using @projectxinnovation/helix-cli — works for git installs since npm uses package name |
| src/update/version.ts | Direct code inspection | Returns semver from package.json only, no SHA |
| src/lib/config.ts | Direct code inspection | InstallSource type has commit field (line 9) never written; saveConfig does read-merge-write |
| src/index.ts | Direct code inspection | --version handler at line 124 prints getPackageVersion() directly; usage text at line 60 says "npm" |
| src/docs/cli-content.ts | Direct code inspection | 4 npm install/update references to change |
| src/skill/show.ts | Direct code inspection | npm reinstall command in error at line 15 |
| src/skill/paths.ts | Direct code inspection | npm reinstall command in error at line 25 |
| skill-content/references/commands.md | Direct code inspection | "updates from npm" at line 95 |
| package.json | Direct code inspection | name: @projectxinnovation/helix-cli, prepare: npm run build |
| npm docs (Context7) | Verify npm behavior for git URL installs | npm uses package name for node_modules directory; prepare script runs for git installs |

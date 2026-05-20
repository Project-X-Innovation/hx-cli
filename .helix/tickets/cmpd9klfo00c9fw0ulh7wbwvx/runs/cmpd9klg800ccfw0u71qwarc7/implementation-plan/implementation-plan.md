# Implementation Plan — BLD-517: Install and update hlx from GitHub main instead of npm

## Overview

Rewire the `hlx` CLI update system from npm-registry-based semver comparison to GitHub-main SHA-based comparison. The change touches the `src/update/` module (4 files), the CLI entry point, and 4 documentation/error-message surfaces. The existing git primitives (`fetchRemoteSha`, `CANONICAL_*` constants, `InstallSource.commit` config field) already exist and need to be wired into the update flows that currently use npm-registry functions.

## Implementation Principles

- **Minimal rewiring**: Replace data sources and comparison logic, keep existing flow structure.
- **Single source of truth**: `GIT_INSTALL_SPEC` composed from existing `CANONICAL_REPO_URL` + `CANONICAL_BRANCH` constants — no URL duplication.
- **Fail-closed on explicit update, fail-open on auto-check**: `runUpdate()` exits non-zero on any failure; `checkAutoUpdate()` warns and continues.
- **Inline migration**: Detect npm-sourced installs within the existing update flow, not a separate command.
- **Dead code removal**: Remove `fetchLatestVersion()`, `isNewerVersion()`, and `NPM_PACKAGE` — zero callers after switch.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Replace npm infrastructure in check.ts | Cleaned check.ts with GIT_INSTALL_SPEC, without npm functions |
| 2 | Switch install command to git URL | Updated perform.ts using GIT_INSTALL_SPEC |
| 3 | Add SHA to version output | Updated version.ts reading commit from config |
| 4 | Rewire update flows with migration | Updated index.ts (update) using SHA comparison |
| 5 | Update CLI entry point | Updated src/index.ts usage text and --version handler |
| 6 | Update documentation and error messages | Updated cli-content.ts, commands.md, show.ts, paths.ts |
| 7 | Build verification | Clean typecheck and build |

## Detailed Implementation Steps

### Step 1: Update src/update/check.ts — Replace npm infrastructure with git install spec

**Goal**: Remove npm-specific functions and constant; add the git install spec constant that will be used by the install command.

**What to Build**:
- Remove the `NPM_PACKAGE` constant (line 9).
- Remove the `fetchLatestVersion()` function (lines 15-29) — it queries `npm view` which must no longer be called.
- Remove the `isNewerVersion()` function (lines 36-47) — semver comparison is replaced by SHA string comparison.
- Add a new exported constant `GIT_INSTALL_SPEC` composed from existing constants: `` `git+${CANONICAL_REPO_URL}#${CANONICAL_BRANCH}` `` (evaluates to `git+https://github.com/Project-X-Innovation/helix-cli.git#main`).
- Keep all existing exports: `CANONICAL_REPO_URL`, `CANONICAL_BRANCH`, `CANONICAL_REPO`, `fetchRemoteSha()`, `isUpdateAvailable()`.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` after this step will fail (expected) because `index.ts` and `perform.ts` still import removed symbols. This is resolved in steps 2 and 4.
- Confirm `GIT_INSTALL_SPEC` is exported alongside existing constants.

**Success Criteria**:
- `fetchLatestVersion`, `isNewerVersion`, and `NPM_PACKAGE` are removed from check.ts.
- `GIT_INSTALL_SPEC` is defined and exported.
- `fetchRemoteSha()` and `isUpdateAvailable()` are unchanged.

---

### Step 2: Update src/update/perform.ts — Switch install command to git URL

**Goal**: Change the install spec from the npm registry package to the git+https URL.

**What to Build**:
- Change import from `{ NPM_PACKAGE }` to `{ GIT_INSTALL_SPEC }` (from `./check.js`).
- Change line 15: `const installSpec = \`${NPM_PACKAGE}@latest\`` → `const installSpec = GIT_INSTALL_SPEC`.
- Update the JSDoc comment (line 5) from "npm install -g from the npm registry" to "npm install -g from the GitHub repository".

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` after this step will still fail because `index.ts` still imports removed symbols. This is resolved in step 4.
- Confirm the import statement references `GIT_INSTALL_SPEC`.

**Success Criteria**:
- `performUpdate()` uses `GIT_INSTALL_SPEC` as the install spec.
- No reference to `NPM_PACKAGE` remains in perform.ts.

---

### Step 3: Update src/update/version.ts — Add SHA to version output

**Goal**: Extend `getPackageVersion()` to include the installed commit SHA from config.

**What to Build**:
- Add import: `import { loadFullConfig } from "../lib/config.js";`
- After reading semver from package.json, call `loadFullConfig()` and read `installSource.commit`.
- If `commit` is a non-empty string, return `<semver> (<commit.slice(0, 7)>)` (e.g., `1.3.4 (c8620a5)`).
- If `commit` is missing or empty, return the semver only (existing behavior).
- Wrap the config read in a try-catch so config failures fall back to semver-only — `getPackageVersion()` must never throw.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — version.ts should compile independently (no dependency on removed check.ts symbols).

**Success Criteria**:
- `getPackageVersion()` returns `<semver> (<short-sha>)` when config has a commit SHA.
- `getPackageVersion()` returns semver-only when commit is absent (backward compatible).
- No new exceptions can escape `getPackageVersion()`.

---

### Step 4: Rewire src/update/index.ts — SHA-based comparison with migration

**Goal**: Replace the npm-based semver update flow with SHA-based comparison, add migration logic for npm-sourced installs, and update error/recovery messages.

**What to Build**:

**Imports**:
- Remove imports of `fetchLatestVersion` and `isNewerVersion` from `./check.js`.
- Add import of `fetchRemoteSha` from `./check.js`.
- Add import of `GIT_INSTALL_SPEC` from `./check.js` (for recovery command in error messages).
- Keep existing imports: `CANONICAL_REPO`, `CANONICAL_BRANCH`, `loadFullConfig`, `saveConfig`, `InstallSource`, `getPackageVersion`, `performUpdate`, `validateInstall`.

**`runUpdate()` changes** (lines 52-101):
- Replace `fetchLatestVersion()` call with `fetchRemoteSha()`.
- On null return: print error "Failed to check for updates. Could not reach GitHub." and `process.exit(1)`.
- Load config via `loadFullConfig()`, read `installSource`.
- **Migration detection**: if `installSource` is undefined, or `installSource.mode === "npm"`, or `installSource.mode === "unknown"`, print a one-line notice: `"Switching install source from npm to GitHub main..."`.
- Read local SHA from `installSource?.commit`.
- If local SHA equals remote SHA (case-insensitive): print "Already up to date." and return.
- If different or absent: print update message, call `performUpdate({ quiet: false })`.
- On install failure: print error with recovery command `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`.
- On success: call `validateInstall()`.
- On validation failure: print error with same recovery command. Do not record success.
- On all success: call `saveConfig()` with `installSource: { mode: "github", repo: CANONICAL_REPO, branch: CANONICAL_BRANCH, commit: remoteSha }`.
- Print "Update complete. Changes take effect on the next invocation."

**`checkAutoUpdate()` changes** (lines 108-165):
- Replace `fetchLatestVersion()` call with `fetchRemoteSha()`.
- On null return: emit a stderr warning ("Warning: could not check for updates.") and return silently.
- Read local SHA from `config.installSource?.commit`.
- If local SHA equals remote SHA (case-insensitive): return (already current).
- If different or absent: print update message to stderr, call `performUpdate({ quiet: true })`.
- On success + validation pass: `saveConfig()` with `{ mode: "github", repo: CANONICAL_REPO, branch: CANONICAL_BRANCH, commit: remoteSha }`.
- On failure: print warning to stderr and return (non-blocking).
- Remove all usage of `getPackageVersion()` and `isNewerVersion()` for comparison within this file. `getPackageVersion()` may still be used in display messages.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` should now pass (all removed imports resolved).
- Inspect that no `fetchLatestVersion` or `isNewerVersion` calls remain.

**Success Criteria**:
- `runUpdate()` uses `fetchRemoteSha()` with explicit null check for fail-closed.
- `checkAutoUpdate()` uses `fetchRemoteSha()` and returns silently on failure.
- Migration detection prints a notice for npm-sourced installs.
- Install source is recorded as `{mode: "github", repo, branch, commit}`.
- Recovery commands reference the git+https URL.
- No `fetchLatestVersion` or `isNewerVersion` calls remain in index.ts.

---

### Step 5: Update src/index.ts — CLI entry point

**Goal**: Update usage text and add SHA-missing note to --version output.

**What to Build**:
- Line 60: Change `"Check for and apply updates from npm"` to `"Check for and apply updates from GitHub"`.
- Lines 122-124: Update the `--version` handler:
  - Call `getPackageVersion()` (which now returns `<semver> (<sha>)` or `<semver>`).
  - Print the version.
  - If the version string does not contain a parenthesized SHA (no `(` character), print an additional line to stderr: `"Run 'hlx update' to refresh install metadata."`.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` should still pass.
- Grep for "npm" in src/index.ts — only references should be in non-update contexts (e.g., npm as an installer tool, not the npm registry).

**Success Criteria**:
- Usage text says "GitHub" instead of "npm" for the update command.
- `--version` handler prints fallback note when SHA is absent.

---

### Step 6: Update documentation and error messages

**Goal**: Replace all npm registry references in user-facing documentation and error messages with git+https URL.

**What to Build**:

**`src/docs/cli-content.ts`** (4 changes):
- Line 8: Change `**Package:** \`@projectxinnovation/helix-cli\`` to `**Source:** \`github.com/Project-X-Innovation/helix-cli\`` (or remove — it's informational).
- Line 15-18: Change install section from `npm install -g @projectxinnovation/helix-cli@latest` to `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`.
- Line 283: Change "checks npm for the latest published version" to "checks GitHub for the latest commit on main".
- Line 300-301: Change troubleshooting reinstall command from `npm install -g @projectxinnovation/helix-cli@latest` to `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`.
- Update the `keywords` array: replace `"npm"` with `"github"` (line 340).

**`src/skill/show.ts`** (1 change):
- Line 15: Change `npm install -g @projectxinnovation/helix-cli@latest` to `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`.

**`src/skill/paths.ts`** (1 change):
- Line 25: Change `npm install -g @projectxinnovation/helix-cli@latest` to `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`.

**`skill-content/references/commands.md`** (1 change):
- Line 93: Change `"Check for and apply CLI updates from npm"` to `"Check for and apply CLI updates from GitHub"`.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` should pass.
- Grep for `@projectxinnovation/helix-cli@latest` across the entire codebase — should return zero matches.
- Grep for `"updates from npm"` or `"from npm"` in doc/error contexts — should return zero matches.

**Success Criteria**:
- Zero remaining `@projectxinnovation/helix-cli@latest` install references in user-facing text.
- All install/reinstall/troubleshooting commands reference `git+https://github.com/Project-X-Innovation/helix-cli.git#main`.
- All "from npm" descriptions changed to "from GitHub".

---

### Step 7: Build verification

**Goal**: Ensure all changes compile and build cleanly.

**What to Build**: No code changes — verification only.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpd9klg800ccfw0u71qwarc7/helix-cli
npm run typecheck
npm run build
node dist/index.js --version
```

**Success Criteria**:
- `npm run typecheck` exits 0 with no errors.
- `npm run build` exits 0 with no errors.
- `node dist/index.js --version` prints a version string (semver-only is expected since no config SHA exists in the sandbox).

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 runtime | available | package.json engines field; sandbox has Node | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06, CHK-07 |
| npm installed | available | Required for build scripts; sandbox has npm | CHK-01, CHK-02, CHK-03 |
| TypeScript devDependency (^6.0.2) | available | Listed in package.json devDependencies; installed via npm install | CHK-01, CHK-02 |
| node_modules installed | available | `npm install` must be run before typecheck/build | CHK-01, CHK-02, CHK-03 |
| git binary on PATH | available | Required by fetchRemoteSha(); sandbox has git | CHK-04 |
| GitHub network access for git ls-remote | unknown | Sandbox may not have access to private GitHub repo | CHK-04 |
| ~/.hlx/config.json with installSource.commit | missing | Fresh sandbox has no config; --version will show semver-only | CHK-03 |

### Required Checks

[CHK-01] TypeScript typecheck passes with zero errors.
- Action: Run `npm run typecheck` in the helix-cli repository root.
- Expected Outcome: Command exits with status 0 and no type errors in stdout/stderr.
- Required Evidence: Full command output showing zero errors and exit code 0.

[CHK-02] Project builds successfully.
- Action: Run `npm run build` in the helix-cli repository root.
- Expected Outcome: Command exits with status 0. The `dist/` directory contains compiled JS files including `dist/update/check.js`, `dist/update/perform.js`, `dist/update/version.js`, `dist/update/index.js`.
- Required Evidence: Command exit code 0 and file listing of `dist/update/` showing the expected files.

[CHK-03] `hlx --version` runs successfully after build.
- Action: Run `node dist/index.js --version` from the helix-cli repository root (with `HLX_SKIP_UPDATE_CHECK=1` to prevent auto-update).
- Expected Outcome: Command prints a version string matching the semver from package.json (currently `1.3.4`). Since no config SHA exists in the sandbox, the output will be semver-only and a note about running `hlx update` should appear on stderr.
- Required Evidence: Command output showing the version string and exit code 0.

[CHK-04] `fetchRemoteSha()` is the only remote-check function in the update flow.
- Action: Run `grep -rn "fetchLatestVersion\|npm view\|npm registry" src/update/` from the helix-cli root.
- Expected Outcome: Zero matches. No npm registry query code remains in the update module.
- Required Evidence: grep command output showing zero matches.

[CHK-05] No `@projectxinnovation/helix-cli@latest` install references remain in user-facing text.
- Action: Run `grep -rn "@projectxinnovation/helix-cli@latest" src/ skill-content/` from the helix-cli root.
- Expected Outcome: Zero matches. All install/reinstall commands reference the git+https URL.
- Required Evidence: grep command output showing zero matches.

[CHK-06] GIT_INSTALL_SPEC constant is correctly defined and used.
- Action: Run `grep -n "GIT_INSTALL_SPEC" src/update/check.ts src/update/perform.ts` from the helix-cli root.
- Expected Outcome: The constant is defined in check.ts as an export containing `git+https://github.com/Project-X-Innovation/helix-cli.git#main`, and is imported and used in perform.ts as the install spec.
- Required Evidence: grep output showing the constant definition and usage lines.

[CHK-07] Install source recording uses GitHub mode with SHA.
- Action: Run `grep -n "mode.*github\|commit.*remoteSha\|CANONICAL_REPO\|CANONICAL_BRANCH" src/update/index.ts` from the helix-cli root.
- Expected Outcome: `saveConfig()` calls in both `runUpdate()` and `checkAutoUpdate()` record `mode: "github"` with `repo: CANONICAL_REPO`, `branch: CANONICAL_BRANCH`, and `commit: remoteSha`.
- Required Evidence: grep output showing the saveConfig calls with the expected fields.

[CHK-08] Documentation references the canonical git+https install command.
- Action: Run `grep -n "git+https://github.com/Project-X-Innovation/helix-cli.git#main" src/docs/cli-content.ts src/skill/show.ts src/skill/paths.ts` from the helix-cli root.
- Expected Outcome: At least 4 matches: install section in cli-content.ts, troubleshooting in cli-content.ts, error in show.ts, and error in paths.ts.
- Required Evidence: grep output showing the matching lines with line numbers.

[CHK-09] Existing tests still pass.
- Action: Run `npm test` in the helix-cli repository root.
- Expected Outcome: All existing tests (flags.test.ts, resolve-ticket.test.ts, skill.test.ts) pass with exit code 0.
- Required Evidence: Test runner output showing all tests pass and exit code 0.

## Success Metrics

1. Zero npm registry queries in any code path (install, update, auto-update, version check).
2. `GIT_INSTALL_SPEC` is the single source of truth for the install command.
3. Install source recorded as `{mode: "github", repo, branch, commit}` in both update flows.
4. `getPackageVersion()` returns `<semver> (<short-sha>)` when SHA is available.
5. Migration detection for npm-sourced installs is inline in the update flow.
6. All 12 npm-referencing locations updated to git+https URL or GitHub references.
7. `runUpdate()` is fail-closed (exits non-zero on any failure).
8. `checkAutoUpdate()` is non-blocking (warns on failure, never blocks command dispatch).
9. TypeScript compiles cleanly. Build succeeds. Existing tests pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification with decisions, invariants, acceptance criteria | SHA-based comparison, git+https install URL, transparent npm migration, fail-closed semantics, --version with SHA |
| scout/scout-summary.md | Synthesized codebase analysis | Git primitives already exist but unused; 12 npm-referencing locations across 7 files; no README.md; no update tests; prepare script handles build |
| scout/reference-map.json | Detailed file map, facts, unknowns | Confirmed all code paths and config schema; identified validateInstall() path question (resolved: works unchanged); InstallSource.commit exists but unpopulated |
| diagnosis/diagnosis-statement.md | Root cause analysis with evidence | Mapped all code paths needing change with line numbers; confirmed validateInstall() unchanged; catalogued all doc/error locations |
| diagnosis/apl.json | Diagnostic answers with code evidence | Confirmed fetchRemoteSha/isUpdateAvailable exist; npm uses package name for directory; detailed migration approach |
| product/product.md | Product vision, use cases, success criteria | Defined fail-closed vs fail-open behavior split; confirmed single repo scope; migration is inline not separate command |
| tech-research/tech-research.md | Technical architecture decisions | Chose Option A (minimal rewiring); runUpdate uses fetchRemoteSha directly not isUpdateAvailable; GIT_INSTALL_SPEC from existing constants; getPackageVersion reads SHA from config |
| tech-research/apl.json | Technical answers with evidence | Confirmed isCanonicalSource unchanged; NPM_PACKAGE/fetchLatestVersion/isNewerVersion removed; migration inline |
| repo-guidance.json | Repo intent classification | Confirmed helix-cli is sole target repo; no cross-repo impact |
| src/update/check.ts (direct) | Verified current code state | fetchRemoteSha at lines 54-68; fetchLatestVersion at lines 15-29; NPM_PACKAGE at line 9; isNewerVersion at lines 36-47 |
| src/update/index.ts (direct) | Verified update flow structure | runUpdate saves mode:"npm" at line 93-97; checkAutoUpdate saves mode:"npm" at line 155-159; recovery commands hardcode npm at line 87 |
| src/update/perform.ts (direct) | Verified install execution | imports NPM_PACKAGE line 2; installSpec at line 15; spawnSync with 120s timeout |
| src/update/version.ts (direct) | Verified version function | Reads semver from package.json only; no config access currently |
| src/update/validate.ts (direct) | Verified validation path | Uses @projectxinnovation/helix-cli path — works for git installs since npm uses package name |
| src/lib/config.ts (direct) | Verified config schema and persistence | InstallSource type has commit field (line 9); saveConfig does read-merge-write; loadFullConfig returns raw config |
| src/index.ts (direct) | Verified CLI entry point | --version at line 124 prints getPackageVersion(); usage text at line 60 references npm |
| src/docs/cli-content.ts (direct) | Verified documentation surfaces | 4 npm references at lines 8, 18, 283, 301 |
| src/skill/show.ts (direct) | Verified error message | npm reinstall command at line 15 |
| src/skill/paths.ts (direct) | Verified error message | npm reinstall command at line 25 |
| skill-content/references/commands.md (direct) | Verified command reference | "updates from npm" at line 93 |
| package.json (direct) | Verified build mechanics | prepare script runs tsc; name is @projectxinnovation/helix-cli; version 1.3.4 |

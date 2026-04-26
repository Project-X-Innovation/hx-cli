# Implementation Plan — HLX-316: Add GitHub main self-update and auto-update to helix-cli

## Overview

Add a GitHub-main-sourced self-update mechanism to helix-cli. This includes: (1) an explicit `hlx update` command, (2) a persisted `autoUpdate` setting with enable/disable commands, (3) a pre-command auto-update check when `autoUpdate` is enabled, and (4) fix the broken `hlx --version` output. All changes are scoped to helix-cli. helix-global-server requires no modifications.

The implementation builds on tech-research decisions: git ls-remote for SHA checks, npm install -g from GitHub shorthand for self-update, read-merge-write config pattern, and readFileSync + import.meta.url for ES-module-compatible version reading.

## Implementation Principles

1. **Minimal footprint**: No new runtime dependencies. Use Node.js built-ins and system git/npm.
2. **Fail closed**: When update eligibility is uncertain, do not update. Report what is missing.
3. **Config safety**: Read-merge-write pattern — never overwrite unrelated config fields.
4. **One-shot**: At most one update check and one update attempt per CLI invocation.
5. **No re-exec**: After update, continue with loaded code. Next invocation uses new code.
6. **Incremental verification**: Build and typecheck after each step to catch regressions early.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Fix config system to support new fields without data loss | Modified `src/lib/config.ts` |
| 2 | Add package version reader utility | New `src/update/version.ts` |
| 3 | Add GitHub SHA check module | New `src/update/check.ts` |
| 4 | Add self-update execution module | New `src/update/perform.ts` |
| 5 | Add update command handler and auto-update orchestration | New `src/update/index.ts` |
| 6 | Wire update command, auto-update hook, and version fix into CLI entry point | Modified `src/index.ts` |
| 7 | Add prepare script to package.json | Modified `package.json` |

## Detailed Implementation Steps

### Step 1: Fix config system (src/lib/config.ts)

**Goal**: Extend HxConfig type with update-related fields and fix saveConfig to use read-merge-write pattern so existing fields are never silently destroyed.

**What to Build**:

1. Extend the `HxConfig` type to add optional fields:
   - `autoUpdate?: boolean` — persisted auto-update toggle (default false when absent)
   - `installSource?: { mode: 'github' | 'unknown'; repo?: string; branch?: string; commit?: string }` — install-origin metadata

2. Change `saveConfig` to accept `Partial<HxConfig>` instead of `HxConfig`:
   - Read existing config file (if it exists) as `Record<string, unknown>`
   - Merge the update payload onto existing values using spread
   - Write merged result back to file
   - Continue to create `~/.hlx/` directory if missing

3. Keep `loadConfig` behavior unchanged for the `apiKey`/`url` return path (env vars override, file fallback). Add a new `loadFullConfig` or `loadRawConfig` helper that returns the full parsed config object (including optional fields) for use by the update module.

4. Existing callers (`src/login.ts:38,107`) pass `{ apiKey, url }` which satisfies `Partial<HxConfig>` — no changes needed in login.ts.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — must pass with zero errors
- `npm run build` — must succeed
- Quick smoke: The login.ts import of saveConfig must still compile without changes

**Success Criteria**:
- HxConfig type includes autoUpdate and installSource as optional fields
- saveConfig reads existing config before writing, preserving all existing fields
- saveConfig accepts Partial<HxConfig>
- Typecheck passes cleanly

### Step 2: Add package version reader (src/update/version.ts)

**Goal**: Create a utility to read the package.json version at runtime in an ES module context, replacing the hardcoded version string.

**What to Build**:

1. Create `src/update/version.ts` with a `getPackageVersion()` function:
   - Use `fileURLToPath(import.meta.url)` from `node:url` to get the current file path
   - Resolve `../../package.json` relative to `dist/update/version.js` (at runtime, this file is in `dist/update/`, package.json is at the repo root)
   - Read and parse `package.json` with `readFileSync` from `node:fs`
   - Return the `version` string
   - Fallback: return `'unknown'` if the read/parse fails

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — must pass
- `npm run build` — must produce `dist/update/version.js`

**Success Criteria**:
- `getPackageVersion()` resolves package.json relative to the compiled module location
- Uses only Node built-in modules (node:fs, node:url, node:path)
- Has a safe fallback on read failure

### Step 3: Add GitHub SHA check module (src/update/check.ts)

**Goal**: Create a module to fetch the latest commit SHA from GitHub main via git ls-remote and compare with the local installed SHA.

**What to Build**:

1. Create `src/update/check.ts` with:
   - `fetchRemoteSha(): string | null` — runs `git ls-remote https://github.com/Project-X-Innovation/helix-cli.git refs/heads/main` via `child_process.execSync` with a 10-second timeout. Parses the first whitespace-delimited token from stdout as the SHA. Returns null on any error (git not found, network failure, parse failure).
   - `isUpdateAvailable(localSha: string): { available: boolean; remoteSha: string | null }` — calls `fetchRemoteSha()`, compares with `localSha`. Returns `{ available: true, remoteSha }` when SHAs differ and remote is non-null, or `{ available: false, remoteSha }` when they match.

2. Constants at module level:
   - `CANONICAL_REPO_URL = 'https://github.com/Project-X-Innovation/helix-cli.git'`
   - `CANONICAL_BRANCH = 'main'`

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — must pass
- `npm run build` — must produce `dist/update/check.js`
- Manually run: `git ls-remote https://github.com/Project-X-Innovation/helix-cli.git refs/heads/main` — should return a SHA (verifies connectivity)

**Success Criteria**:
- fetchRemoteSha uses git ls-remote (not REST API) to avoid rate limits
- Returns null on failure (does not throw)
- 10-second timeout prevents hanging
- Uses child_process.execSync consistent with codebase patterns

### Step 4: Add self-update execution module (src/update/perform.ts)

**Goal**: Create a module that executes the actual self-update via npm install -g from GitHub.

**What to Build**:

1. Create `src/update/perform.ts` with:
   - `performUpdate(options?: { quiet?: boolean }): { success: boolean; error?: string }` — runs `npm install -g github:Project-X-Innovation/helix-cli#main` via `child_process.execSync`.
   - When `quiet` is false (default, for explicit `hlx update`): use `stdio: 'inherit'` so npm output is visible.
   - When `quiet` is true (for auto-update): use `stdio: 'pipe'` to suppress output.
   - On success: return `{ success: true }`.
   - On failure: catch the execSync error, extract stderr/message, return `{ success: false, error: <message> }`.

2. Use a reasonable timeout (120 seconds) for the npm install command.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — must pass
- `npm run build` — must produce `dist/update/perform.js`

**Success Criteria**:
- Uses `npm install -g github:Project-X-Innovation/helix-cli#main` (GitHub source, not npm registry)
- Catches errors gracefully, returns structured result
- Supports quiet mode for auto-update vs verbose for explicit update
- Does not throw on failure

### Step 5: Add update command handler and auto-update orchestration (src/update/index.ts)

**Goal**: Create the update command handler (`hlx update`) and the auto-update pre-command check logic, including autoUpdate toggle flags.

**What to Build**:

1. Create `src/update/index.ts` with:

   **runUpdate(args: string[]): Promise<void>** — the `hlx update` command handler:
   - Parse `--enable-auto` and `--disable-auto` flags:
     - `--enable-auto`: set `autoUpdate: true` in config via saveConfig, print confirmation, return.
     - `--disable-auto`: set `autoUpdate: false` in config via saveConfig, print confirmation, return.
   - If no flags: run the update check flow:
     a. Load full config to get `installSource`.
     b. Call `fetchRemoteSha()` to get remote SHA.
     c. If fetchRemoteSha returns null: print error about network/git failure, exit non-zero.
     d. Compare remote SHA with `installSource.commit` (local SHA).
     e. If SHAs match: print "Already up to date." and exit 0.
     f. If SHAs differ (or no local SHA): call `performUpdate({ quiet: false })`.
     g. On success: update `installSource` in config with new commit SHA, `mode: 'github'`, canonical repo/branch. Print success message.
     h. On failure: print error, exit non-zero.

   **checkAutoUpdate(): Promise<void>** — the pre-command auto-update hook:
   - If `HLX_SKIP_UPDATE_CHECK` env var is set: return immediately (loop prevention guard).
   - Load full config. If `autoUpdate` is not `true`: return immediately.
   - If `installSource` is missing or doesn't match canonical source: print a warning that auto-update is enabled but install source is unrecognized, skip update.
   - Call `fetchRemoteSha()`. If null: silently skip (don't block command execution on network failure).
   - Compare with `installSource.commit`. If SHAs match: return (already current).
   - If behind: call `performUpdate({ quiet: true })`.
   - On success: update `installSource.commit` in config, print brief "Updated to latest." message.
   - On failure: print brief warning, continue with command execution (don't block).

2. Export both functions.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — must pass
- `npm run build` — must produce `dist/update/index.js`

**Success Criteria**:
- `hlx update` checks SHA, updates if needed, persists metadata
- `--enable-auto` / `--disable-auto` toggle autoUpdate in config
- checkAutoUpdate skips when autoUpdate is false
- checkAutoUpdate skips when HLX_SKIP_UPDATE_CHECK is set
- checkAutoUpdate skips when installSource is missing or non-canonical
- Network failures during auto-update don't block command execution
- At most one update attempt per invocation

### Step 6: Wire into CLI entry point (src/index.ts)

**Goal**: Add the update command case, auto-update pre-command hook, and fix --version to use package metadata.

**What to Build**:

1. **Fix version output** (line 47):
   - Import `getPackageVersion` from `./update/version.js`
   - Replace `console.log("0.1.0")` with `console.log(getPackageVersion())`

2. **Add update command case** in the switch:
   - Import `runUpdate` from `./update/index.js`
   - Add case `"update"`: call `await runUpdate(args.slice(1))` and break

3. **Add auto-update pre-command hook**:
   - Import `checkAutoUpdate` from `./update/index.js`
   - Before the `switch` statement (but after arg parsing), insert: `await checkAutoUpdate()`
   - Guard: do NOT run auto-update for `--version`, `-v`, `update`, `--help` commands — these should execute without update overhead. Add a set of skip-commands and check before calling checkAutoUpdate.

4. **Update the usage text** to include:
   - `hlx update                   Check for and apply updates from GitHub main`
   - `hlx update --enable-auto     Enable automatic update checks`
   - `hlx update --disable-auto    Disable automatic update checks`

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — must pass
- `npm run build` — must succeed
- Run `node dist/index.js --version` — must output `1.2.0` (not `0.1.0`)
- Run `node dist/index.js update --help` or `node dist/index.js update` — must show update-related output (not "Unknown command")

**Success Criteria**:
- `hlx --version` reads from package.json and outputs `1.2.0`
- `hlx update` is a recognized command
- Auto-update hook runs before command dispatch (except for version/update/help)
- Usage text documents the update command

### Step 7: Add prepare script to package.json

**Goal**: Add a prepare script so that git-based npm install compiles TypeScript before packing.

**What to Build**:

1. Add `"prepare": "npm run build"` to the `scripts` section of `package.json`.

This is required because `dist/` is gitignored. When npm installs from a GitHub URL (`npm install -g github:Project-X-Innovation/helix-cli#main`), it fetches the repo (which has only TypeScript source). Without `prepare`, the bin entry (`dist/index.js`) would not exist.

**Verification (AI Agent Runs)**:
- Verify `package.json` contains `"prepare": "npm run build"` in scripts
- `npm run build` — must still succeed
- `npx tsc --noEmit` — must still pass

**Success Criteria**:
- prepare script is present in package.json scripts
- Build pipeline is not broken by the addition

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >=18 installed | available | `package.json:13-15` engines field; sandbox has Node installed | [CHK-01] through [CHK-09] |
| npm installed | available | Required for build and install commands; present in sandbox | [CHK-01], [CHK-02], [CHK-07] |
| git binary installed | available | Required for git ls-remote SHA check; standard dev tool | [CHK-05] |
| helix-cli dependencies installed (node_modules) | available | Verified: `node_modules/` exists in helix-cli root with typescript installed | [CHK-01], [CHK-02] |
| Network access to github.com | unknown | Required for git ls-remote to reach github.com; may be blocked in sandbox | [CHK-05], [CHK-08] |
| Write access to ~/.hlx/ directory | available | Config file operations require write access to home directory | [CHK-04], [CHK-06] |

### Required Checks

[CHK-01] TypeScript typecheck passes with zero errors.
- Action: Run `npx tsc --noEmit` in the helix-cli root directory.
- Expected Outcome: Command exits with code 0 and produces no error output.
- Required Evidence: Command output showing clean exit (no errors) and exit code 0.

[CHK-02] Build succeeds and produces expected output files.
- Action: Run `npm run build` in the helix-cli root directory, then verify dist/ contains the new update module files.
- Expected Outcome: Build exits with code 0. Files `dist/update/version.js`, `dist/update/check.js`, `dist/update/perform.js`, and `dist/update/index.js` all exist.
- Required Evidence: Build command output showing success, plus file listing of `dist/update/` directory showing all four files.

[CHK-03] `hlx --version` outputs the package.json version, not the hardcoded value.
- Action: Run `npm run build && node dist/index.js --version` in the helix-cli root directory.
- Expected Outcome: Output is `1.2.0` (the current package.json version), not `0.1.0` (the old hardcoded value).
- Required Evidence: Command stdout showing `1.2.0`.

[CHK-04] autoUpdate setting round-trips through config without losing existing fields.
- Action: Create a test config file at `~/.hlx/config.json` containing `{"apiKey":"test-key","url":"https://example.com"}`. Then invoke the config save logic to set `autoUpdate: true` (e.g., run `node dist/index.js update --enable-auto`). Read back `~/.hlx/config.json` and verify all fields are present. Then invoke to set `autoUpdate: false` (run `node dist/index.js update --disable-auto`). Read back again.
- Expected Outcome: After enable: config file contains `apiKey`, `url`, and `autoUpdate: true`. After disable: config file contains `apiKey`, `url`, and `autoUpdate: false`. Neither `apiKey` nor `url` is lost at any point.
- Required Evidence: Contents of `~/.hlx/config.json` after each toggle, showing all fields preserved.

[CHK-05] git ls-remote SHA check returns a valid commit SHA from the canonical repo.
- Action: Run `git ls-remote https://github.com/Project-X-Innovation/helix-cli.git refs/heads/main` from the command line.
- Expected Outcome: Output contains a 40-character hexadecimal SHA followed by `refs/heads/main`.
- Required Evidence: Command output showing the SHA and ref line.

[CHK-06] `hlx update` command is recognized and executes the update check flow.
- Action: Run `npm run build && node dist/index.js update` in the helix-cli root directory.
- Expected Outcome: The command does not output "Unknown command: update". It either reports the result of an update check (e.g., "already up to date", update success, or a clear error about network/install-source) or exits with a meaningful message.
- Required Evidence: Command stdout/stderr output showing update-related messaging (not "Unknown command").

[CHK-07] prepare script exists in package.json.
- Action: Parse `package.json` in the helix-cli root and inspect the `scripts` object.
- Expected Outcome: `scripts.prepare` equals `"npm run build"`.
- Required Evidence: Extracted `scripts` section from package.json showing the prepare field.

[CHK-08] Auto-update check is skipped when autoUpdate is false or absent.
- Action: Ensure `~/.hlx/config.json` has `autoUpdate` set to `false` (or the field is absent). Run `HLX_SKIP_UPDATE_CHECK= node dist/index.js --version` and observe that no git ls-remote network call occurs (command returns instantly with version output only, no update-related messages).
- Expected Outcome: The version is printed immediately with no update check messages or network delay.
- Required Evidence: Command output showing only the version string, with no update-related output and sub-second execution time.

[CHK-09] Auto-update check is skipped when HLX_SKIP_UPDATE_CHECK is set.
- Action: Set `autoUpdate: true` in `~/.hlx/config.json` (with valid installSource metadata). Run `HLX_SKIP_UPDATE_CHECK=1 node dist/index.js --version`.
- Expected Outcome: The version is printed with no update check messages, despite autoUpdate being enabled.
- Required Evidence: Command output showing only the version string, confirming the env-var guard prevents the update check.

## Success Metrics

1. `hlx --version` outputs `1.2.0` (package.json version), not `0.1.0`.
2. `hlx update` exists, checks GitHub main HEAD SHA, and reports status clearly.
3. `hlx update --enable-auto` / `--disable-auto` toggle autoUpdate in `~/.hlx/config.json` without losing other fields.
4. Auto-update check runs before command execution when `autoUpdate` is true.
5. No auto-update check when `autoUpdate` is false or absent.
6. `HLX_SKIP_UPDATE_CHECK=1` prevents auto-update check (loop prevention).
7. TypeScript typecheck passes with zero errors.
8. Build produces all new files in `dist/update/`.
9. `prepare` script is present in package.json for git-based npm install.
10. No runtime dependencies added. No changes to helix-global-server.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Primary specification with requirements, constraints, acceptance criteria | All changes scoped to helix-cli; update source is GitHub main commit SHA; autoUpdate in ~/.hlx/config.json; no npm/server checks |
| scout/reference-map.json (helix-cli) | File-level analysis with confirmed facts and unknowns | Version hardcoded at src/index.ts:47; saveConfig overwrites with only {apiKey,url}; no update infrastructure; ES module context |
| scout/scout-summary.md (helix-cli) | Current state analysis and key boundaries | 7 key boundaries identified; helix-global-server is context-only; lossy config system is the primary blocker |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis of 4 issues | Version drift bug; lossy config blocks features; update is greenfield; hxFetch not reusable for GitHub |
| diagnosis/apl.json (helix-cli) | Evidence-backed answers to diagnostic questions | Confirmed saveConfig field loss; no existing update code; viable update mechanism identified |
| product/product.md (helix-cli) | Product vision, use cases, success criteria | Fail-closed principle; one-shot update; transparency; 6 open technical questions identified |
| tech-research/tech-research.md (helix-cli) | Architecture decisions and technical direction | git ls-remote chosen over REST API; npm install -g from GitHub; read-merge-write config; no re-exec after update; prepare script required |
| tech-research/apl.json (helix-cli) | Technical Q&A with evidence-backed answers | All 8 technical questions resolved with evidence; prepare script confirmed required by npm docs |
| repo-guidance.json (helix-global-server) | Repo intent classification | helix-cli is target; helix-global-server is context-only |
| src/index.ts (helix-cli) | Direct code inspection | Confirmed hardcoded "0.1.0" at line 47; switch dispatcher at lines 28-53; auto-update hook insertion point before switch |
| src/lib/config.ts (helix-cli) | Direct code inspection | HxConfig = {apiKey, url}; saveConfig overwrites entire file; CONFIG_DIR = ~/.hlx; CONFIG_FILE = config.json |
| src/login.ts (helix-cli) | Direct code inspection | saveConfig({apiKey, url}) at lines 38 and 107; child_process.exec precedent at line 3 |
| package.json (helix-cli) | Package metadata | version=1.2.0; type=module; no runtime deps; bin hlx=dist/index.js; files=["dist"]; no prepare script |
| tsconfig.json (helix-cli) | Build configuration | module=Node16; strict=true; outDir=dist; rootDir=src; include=["src"] |

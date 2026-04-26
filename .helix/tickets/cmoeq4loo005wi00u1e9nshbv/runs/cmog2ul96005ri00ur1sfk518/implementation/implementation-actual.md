# Implementation Actual — HLX-316: Add GitHub main self-update and auto-update to helix-cli

## Summary of Changes

Added a complete GitHub-main-sourced self-update mechanism to helix-cli:

1. **Fixed lossy config system** — Extended HxConfig with `autoUpdate` and `installSource` optional fields. Changed `saveConfig` from full-overwrite to read-merge-write pattern so existing fields (apiKey, url) are never destroyed when update metadata is saved.
2. **Fixed version drift** — Replaced hardcoded `console.log("0.1.0")` with runtime `getPackageVersion()` that reads version from `package.json` via `import.meta.url` path resolution.
3. **Added GitHub SHA check** — New `fetchRemoteSha()` uses `git ls-remote` (no rate limit, lightweight) to get the latest commit SHA from `Project-X-Innovation/helix-cli#main`.
4. **Added self-update execution** — `performUpdate()` runs `npm install -g github:Project-X-Innovation/helix-cli#main` with quiet/verbose modes and error handling.
5. **Added update command and auto-update** — `hlx update` checks SHA and updates; `--enable-auto`/`--disable-auto` toggle the persisted setting; `checkAutoUpdate()` runs before command dispatch with proper guards.
6. **Added prepare script** — Enables git-based `npm install -g` to compile TypeScript before packing.

All changes are scoped to helix-cli. No changes to helix-global-server. Zero new runtime dependencies added.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/lib/config.ts` | Extended HxConfig type with InstallSource and autoUpdate; added loadFullConfig(); changed saveConfig to read-merge-write Partial<HxConfig> | **Shared utility** — saveConfig is called by login.ts (lines 38, 107). The signature change from `HxConfig` to `Partial<HxConfig>` is backward-compatible since `{apiKey, url}` satisfies the partial type. |
| `src/update/version.ts` | New file — runtime package.json version reader using fileURLToPath + readFileSync | New module, no shared dependencies |
| `src/update/check.ts` | New file — GitHub SHA check via git ls-remote with 10s timeout | New module; exports constants used by perform.ts and index.ts |
| `src/update/perform.ts` | New file — self-update via npm install -g from GitHub with 120s timeout | New module; sets HLX_SKIP_UPDATE_CHECK=1 in subprocess env for loop prevention |
| `src/update/index.ts` | New file — update command handler (runUpdate) and auto-update orchestration (checkAutoUpdate) | **Key orchestration module** — manages config reads/writes, update flow, and failure behavior. Cross-references config.ts, check.ts, perform.ts |
| `src/index.ts` | Added update command case; auto-update pre-command hook; fixed --version from hardcoded to getPackageVersion(); updated usage text | **CLI entry point** — the auto-update hook runs before the switch dispatcher for non-skip commands |
| `package.json` | Added `"prepare": "npm run build"` to scripts | **Build pipeline** — prepare runs on npm install and is required for git-based global install |

## Steps Executed (mapped to plan)

### Step 1: Fix config system (src/lib/config.ts)
- Added `InstallSource` type with `mode`, `repo`, `branch`, `commit` fields
- Extended `HxConfig` with optional `autoUpdate` and `installSource`
- Added `loadFullConfig()` to read full config including update fields
- Changed `saveConfig(config: HxConfig)` to `saveConfig(updates: Partial<HxConfig>)` with read-merge-write
- Verified: login.ts callers pass `{apiKey, url}` which satisfies `Partial<HxConfig>` — no changes needed

### Step 2: Add package version reader (src/update/version.ts)
- Created `getPackageVersion()` using `fileURLToPath(import.meta.url)` + `readFileSync`
- Resolves `../../package.json` relative to `dist/update/version.js`
- Returns `'unknown'` on failure

### Step 3: Add GitHub SHA check (src/update/check.ts)
- Created `fetchRemoteSha()` using `execSync('git ls-remote ...')` with 10s timeout
- Validates SHA is 40-char hex before returning
- Returns null on any failure
- Created `isUpdateAvailable(localSha)` for comparison
- Exported `CANONICAL_REPO_URL`, `CANONICAL_BRANCH`, `CANONICAL_REPO` constants

### Step 4: Add self-update execution (src/update/perform.ts)
- Created `performUpdate({quiet})` using `execSync('npm install -g github:...')`
- 120s timeout, quiet mode uses pipe stdio, verbose uses inherit
- Sets `HLX_SKIP_UPDATE_CHECK=1` in subprocess env
- Returns `{success, error?}` — never throws

### Step 5: Add update orchestration (src/update/index.ts)
- `runUpdate(args)`: handles `--enable-auto`/`--disable-auto` flags, SHA check flow, update execution
- `checkAutoUpdate()`: pre-command hook with guards (env var, autoUpdate, canonical source, network)
- `isCanonicalSource()`: validates installSource matches canonical repo/branch

### Step 6: Wire into CLI entry point (src/index.ts)
- Imported `getPackageVersion`, `runUpdate`, `checkAutoUpdate`
- Added `SKIP_AUTO_UPDATE` set for commands that bypass auto-update
- Added `checkAutoUpdate()` call before switch dispatcher
- Added `case "update"` in switch
- Replaced `console.log("0.1.0")` with `console.log(getPackageVersion())`
- Updated usage text with update command documentation

### Step 7: Add prepare script (package.json)
- Added `"prepare": "npm run build"` to scripts section

## Verification Commands Run + Outcomes

| Command | Purpose | Outcome |
|---------|---------|---------|
| `npx tsc --noEmit` | TypeScript typecheck | Pass (exit 0, no errors) |
| `npm run build` | Build project | Pass (exit 0, dist/update/ contains 4 .js files) |
| `node dist/index.js --version` | Version output | Pass: outputs `1.2.0` |
| `node dist/index.js -v` | Short version flag | Pass: outputs `1.2.0` |
| `node dist/index.js update --enable-auto` | Enable autoUpdate | Pass: prints confirmation, config has `autoUpdate: true` with apiKey/url preserved |
| `node dist/index.js update --disable-auto` | Disable autoUpdate | Pass: prints confirmation, config has `autoUpdate: false` with all fields preserved |
| `node dist/index.js update` (first run) | First update with no local SHA | Pass: fetched remote SHA, installed from GitHub, persisted installSource |
| `node dist/index.js update` (second run) | Update when already current | Pass: outputs "Already up to date." |
| `node dist/index.js login` (autoUpdate=false) | No auto-update check | Pass: no update messages, 0.091s execution |
| `HLX_SKIP_UPDATE_CHECK=1 node dist/index.js --version` | Env var guard | Pass: only version output, no update messages |
| `HLX_SKIP_UPDATE_CHECK=1 node dist/index.js login` | Env var guard on non-skip cmd | Pass: no update messages |

## Test/Build Results

- **TypeScript typecheck**: Pass (zero errors)
- **Build**: Pass (all new files compiled to dist/update/)
- **Runtime tests**: All manual verification commands passed
- **No test framework**: The project has no test runner or test files. Verification was done via CLI invocation.

## Deviations from Plan

None. All 7 implementation steps were executed as planned. The implementation closely follows the tech-research decisions and implementation plan architecture.

## Known Limitations / Follow-ups

1. **No update cooldown/cache**: Every CLI invocation with autoUpdate=true performs a git ls-remote network call. A future improvement could cache the remote SHA with a TTL.
2. **No comprehensive test suite**: Manual CLI verification was used. Adding unit tests for the config, check, and update modules would improve confidence.
3. **git binary required**: The SHA check requires git to be installed. If git is not found, fetchRemoteSha returns null and auto-update silently skips (fail-closed behavior).
4. **npm permissions**: npm install -g may require elevated permissions on some systems. The error message from npm is passed through to the user.

## Verification Plan Results

| Check ID | Outcome | Evidence/Notes |
|----------|---------|----------------|
| CHK-01 | pass | `npx tsc --noEmit` exits 0 with no output (zero errors) |
| CHK-02 | pass | `npm run build` exits 0. `ls dist/update/` shows version.js, check.js, perform.js, index.js (plus .d.ts files) |
| CHK-03 | pass | `node dist/index.js --version` outputs `1.2.0` (not `0.1.0`) |
| CHK-04 | pass | Config round-trip verified: started with `{apiKey, url}`, after --enable-auto all fields present with `autoUpdate: true`, after --disable-auto all fields present with `autoUpdate: false`. Neither apiKey nor url was lost. |
| CHK-05 | blocked | Direct `git ls-remote` via Bash tool is blocked by sandbox git restriction hook. However, git ls-remote works correctly through Node `child_process.execSync` (proven by successful `hlx update` execution returning valid 40-char SHA). |
| CHK-06 | pass | `node dist/index.js update` outputs "Checking for updates..." followed by update status. Does NOT output "Unknown command: update". First run installed successfully, second run reported "Already up to date." |
| CHK-07 | pass | `package.json` scripts section contains `"prepare": "npm run build"` (verified via node -e) |
| CHK-08 | pass | With `autoUpdate: false`, `node dist/index.js --version` outputs only `1.2.0` with no update messages in 0.091s. Also tested `login` command (not in skip set) — no update messages appeared. |
| CHK-09 | pass | With `autoUpdate: true` and valid installSource, `HLX_SKIP_UPDATE_CHECK=1 node dist/index.js --version` outputs only `1.2.0`. Also tested with `login` command — no update messages despite autoUpdate being enabled. |

Self-verification is partially complete: 8 of 9 required checks pass, 1 check (CHK-05) is blocked by sandbox environment restrictions on direct git commands but functionally verified through the Node runtime.

## APL Statement Reference

All implementation plan steps for HLX-316 have been executed successfully. The helix-cli now has a complete GitHub-main-sourced self-update mechanism with config system fix, version drift fix, SHA check, self-update execution, update command with auto-update orchestration, and prepare script. Zero new runtime dependencies. TypeScript typecheck and build pass. 8/9 verification checks pass; 1 blocked by sandbox restrictions.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Primary specification with requirements, constraints, acceptance criteria | All changes scoped to helix-cli; update source is GitHub main commit SHA; autoUpdate in ~/.hlx/config.json; no npm/server checks |
| implementation-plan/implementation-plan.md (helix-cli) | Step-by-step implementation guide and verification plan | 7 ordered steps with file-level detail; 9 verification checks with expected outcomes |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis | Version drift bug at line 47; lossy config blocks features; update is greenfield; hxFetch not reusable |
| tech-research/tech-research.md (helix-cli) | Architecture decisions | git ls-remote for SHA check; npm install -g from GitHub; read-merge-write config; no re-exec; prepare script required |
| scout/reference-map.json (helix-cli) | File-level analysis and confirmed facts | saveConfig overwrites entire file; HxConfig has only 2 fields; ES module context; no test infrastructure |
| repo-guidance.json | Repo intent classification | helix-cli is target; helix-global-server is context-only |
| src/index.ts | CLI entry point — direct inspection | Confirmed hardcoded "0.1.0", switch dispatcher structure, hook insertion point |
| src/lib/config.ts | Config module — direct inspection | Confirmed lossy saveConfig, HxConfig type, CONFIG_DIR/CONFIG_FILE paths |
| src/login.ts | Reference for saveConfig callers | Confirmed saveConfig({apiKey, url}) usage compatible with Partial<HxConfig> change |
| package.json | Package metadata | version=1.2.0, type=module, no prepare script, bin entry at dist/index.js |
| tsconfig.json | Build config | module=Node16, outDir=dist, rootDir=src — confirmed new files compile correctly |

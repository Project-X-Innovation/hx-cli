# Implementation Actual — FIX-347: Make hlx update Validate Installed Package And Recover From Broken Installs

## Summary of Changes

Added post-install validation to `hlx update` so that a successful update is only reported when the installed CLI package is actually runnable. Three files in `src/update/` were changed:

1. **`perform.ts`** — Refactored from `execSync` to `spawnSync` to capture npm stderr on the success path, enabling downstream diagnostic output when validation fails.
2. **`validate.ts`** (new) — Provides `validateInstall()` function that checks the installed package's bin target exists and the CLI can start (`node <path> --version`).
3. **`index.ts`** — Inserts validation calls between npm success and metadata save in both the manual (`runUpdate`) and auto-update (`checkAutoUpdate`) paths, with appropriate error messaging and recovery hints.

## Files Changed

| File | Why Changed | Shared-Code/Review Hotspot |
|------|-------------|---------------------------|
| `src/update/perform.ts` | Replaced `execSync` with `spawnSync`; added `stderr` to return type; uses `shell: true` and `encoding: 'utf8'` for cross-platform compatibility | **Public interface change**: return type extended with `stderr?: string`. Backward-compatible (additive). Both `index.ts` update paths consume this. |
| `src/update/validate.ts` | New file. Exports `validateInstall()` that resolves global npm root, checks bin target existence, and runs version check | **New public interface**: consumed by `index.ts`. Cross-platform path resolution via `npm root -g`. |
| `src/update/index.ts` | Imported `validateInstall`; inserted validation gate in `runUpdate()` (lines 80-93) and `checkAutoUpdate()` (lines 155-162); gated `saveConfig` on validation pass | **State/data flow change**: `saveConfig()` is now only reachable after validation passes in both paths. Manual path calls `process.exit(1)` on failure; auto-update warns and returns. |

## Steps Executed

### Step 1: Refactor `performUpdate()` to use `spawnSync` (perform.ts)

- Replaced `execSync` import with `spawnSync` from `node:child_process`.
- Changed return type to `{ success: boolean; error?: string; stderr?: string }`.
- Replaced the `execSync` call with `spawnSync` using `shell: true`, `encoding: 'utf8'`.
- Non-quiet mode uses `stdio: 'inherit'` (preserves live terminal output); quiet mode uses pipes and returns `stderr`.
- Checks `result.status === 0` instead of try/catch.
- Handles `result.error` (spawn failure) as hard failure.

### Step 2: Create `validateInstall()` (validate.ts)

- Created new `src/update/validate.ts`.
- Resolves global node_modules path via `npm root -g` with 15s timeout.
- Constructs bin target path: `{globalRoot}/@projectxinnovation/helix-cli/dist/index.js`.
- Checks file existence with `fs.existsSync`.
- Runs `node "{binTargetPath}" --version` with `HLX_SKIP_UPDATE_CHECK=1` (recursion guard) and 10s timeout.
- Returns structured result — never throws on any failure path.

### Step 3: Insert validation into manual update path (index.ts — runUpdate)

- Added `import { validateInstall } from "./validate.js"`.
- Inserted validation call after npm success check and before `saveConfig()`.
- On validation failure: prints error, surfaces npm stderr if available, prints recovery instructions (clone/build/link), and calls `process.exit(1)`.
- On validation pass: existing behavior (saveConfig + success message) unchanged.

### Step 4: Insert validation into auto-update path (index.ts — checkAutoUpdate)

- Inserted validation call inside the `if (result.success)` block, before `saveConfig()`.
- On validation failure: warns to stderr but does NOT block (returns without saving metadata).
- On validation pass: existing behavior (saveConfig + updated message) unchanged.
- Captured `result.stderr` is surfaced in the warning.

## Verification Commands Run + Outcomes

| Command | Exit Code | Outcome |
|---------|-----------|---------|
| `npm install` | 0 | Dependencies installed, prepare hook ran build successfully |
| `npm run typecheck` | 0 | TypeScript type check passes with no errors |
| `npm run build` | 0 | Build produces all expected output files |
| `ls dist/update/` | 0 | validate.js, perform.js, index.js all present |
| `node -e "import(...validateInstall...typeof)"` | 0 | Exports `function` |
| `validateInstall()` with missing global bin target | 0 | Returns `{valid: false, error: "Bin target missing: ..."}` |
| `npm install -g .` then `validateInstall()` | 0 | Returns `{valid: true, binTargetPath: "..."}` |
| Simulated broken install (renamed index.js) | 0 | Returns `{valid: false, error: "Bin target missing: ..."}` |

## Test/Build Results

- **Typecheck**: Clean pass — no type errors.
- **Build**: Clean pass — all 6 files in `dist/update/` produced (check.js, index.js, perform.js, validate.js, version.js + declarations).
- **No test framework**: The repository has no test framework (`package.json` has no test script or test dependencies). Verification uses typecheck, build, and direct function invocation.

## Deviations from Plan

1. **DEP0190 fix**: `spawnSync` calls use full command strings (e.g., `spawnSync("npm root -g", {...})`) instead of separate command+args arrays (e.g., `spawnSync("npm", ["root", "-g"], {...})`). Node.js 22+ emits deprecation warning DEP0190 when passing args array with `shell: true` because args are concatenated without escaping. Using a single command string is functionally equivalent, avoids the deprecation, and is more forward-compatible. The `binTargetPath` is quoted in the version check command for paths that might contain spaces.

## Known Limitations / Follow-ups

- **No automated tests**: The repository has no test framework. Validation behavior was verified via direct function invocation and simulated broken installs. Adding tests is explicitly out of scope per the product spec.
- **Global install permission**: `validateInstall()` depends on `npm root -g` which requires npm to be available. If npm is not in PATH, validation returns a clear error.
- **Hardcoded package name**: The bin target path uses the hardcoded package name `@projectxinnovation/helix-cli`. This matches the existing `package.json` name and is consistent with how the update command already uses `CANONICAL_REPO`.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npm run typecheck` exited 0 with no type errors. Full output: `tsc --noEmit` completed cleanly. |
| CHK-02 | pass | `npm run build` exited 0. `ls dist/update/` shows validate.js (2154 bytes), perform.js (1502 bytes), index.js (5195 bytes) all present. |
| CHK-03 | pass | `node -e "import('./dist/update/validate.js').then(m => { console.log(typeof m.validateInstall); })"` outputs `function`. |
| CHK-04 | pass | With global index.js temporarily renamed, `validateInstall()` returns `{valid: false, binTargetPath: "/home/vercel-sandbox/.global/npm/lib/node_modules/@projectxinnovation/helix-cli/dist/index.js", error: "Bin target missing: /home/vercel-sandbox/.global/npm/lib/node_modules/@projectxinnovation/helix-cli/dist/index.js"}`. Also confirmed when package was not globally installed at all. |
| CHK-05 | pass | After `npm install -g .`, `validateInstall()` returns `{valid: true, binTargetPath: "/home/vercel-sandbox/.global/npm/lib/node_modules/@projectxinnovation/helix-cli/dist/index.js"}` with no error field. |

All 5 required verification checks pass. Self-verification is complete.

## APL Statement Reference

Implementation complete. Three files changed in `src/update/`: `perform.ts` refactored from `execSync` to `spawnSync` with stderr capture, new `validate.ts` with `validateInstall()` for post-install integrity checks, and `index.ts` modified to gate metadata save and success messaging on validation in both manual and auto-update paths. All five verification checks pass. One minor deviation: `spawnSync` uses command strings instead of separate args to avoid DEP0190 deprecation.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary requirements and acceptance criteria | Two-step validation (file exists + version runs); fail-closed; recovery messaging; non-zero exit on failure |
| implementation-plan/implementation-plan.md | Step-by-step implementation guide and verification plan | Four sequential steps; verification checks CHK-01 through CHK-05; success metrics |
| implementation-plan/apl.json | Step dependency information | Step 1 before 3-4 (stderr dependency); Step 2 before 3-4 (import dependency) |
| diagnosis/diagnosis-statement.md | Root cause analysis | npm exit 0 equated with valid install; metadata poisoning blocks retry; stderr lost on success |
| repo-guidance.json | Repository intent classification | helix-cli is sole target; all changes in src/update/ |
| src/update/perform.ts | Current implementation to refactor | execSync-based; returns {success, error}; quiet mode pipes but doesn't read |
| src/update/index.ts | Current implementation with both update paths | saveConfig immediately after npm success in both runUpdate and checkAutoUpdate |
| src/update/check.ts | Constants for canonical repo/branch | CANONICAL_REPO used in install spec construction |
| package.json | Bin contract and build scripts | bin: dist/index.js; name: @projectxinnovation/helix-cli; no test framework |
| tsconfig.json | Build configuration | declaration: true explains .d.ts-only partial builds |

# Implementation Plan — FIX-347: Make hlx update Validate Installed Package And Recover From Broken Installs

## Overview

Add post-install validation to `hlx update` so that a successful update report is only emitted when the installed CLI package is actually runnable. Three files in `src/update/` are changed: `perform.ts` is refactored from `execSync` to `spawnSync` to capture stderr, a new `validate.ts` provides the post-install integrity checks, and `index.ts` inserts validation calls between npm success and metadata save in both the manual and auto-update paths.

## Implementation Principles

- **Fail closed**: Never report success for a broken install.
- **Validate the actual artifact**: Check the real installed package at the global npm prefix, not the running CLI.
- **Preserve retry path**: Do not persist metadata when validation fails.
- **Minimal change surface**: All changes confined to `src/update/`.
- **Cross-platform**: Use `npm root -g` and `path.join()` to avoid platform-specific path logic.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Refactor `performUpdate()` from `execSync` to `spawnSync` with stderr capture | Modified `src/update/perform.ts` |
| 2 | Create `validateInstall()` function | New `src/update/validate.ts` |
| 3 | Insert validation into manual update path and gate metadata save | Modified `src/update/index.ts` (runUpdate) |
| 4 | Insert validation into auto-update path and gate metadata save | Modified `src/update/index.ts` (checkAutoUpdate) |

## Detailed Implementation Steps

### Step 1: Refactor `performUpdate()` to use `spawnSync` with stderr capture

**Goal**: Replace `execSync` with `spawnSync` so that npm stderr is available on the success path, enabling the caller to surface npm warnings (e.g., tar warnings) when post-install validation fails.

**What to Build**:

Modify `src/update/perform.ts`:

1. Replace the `execSync` import with `spawnSync` from `node:child_process`.
2. Update the return type to include an optional `stderr` field: `{ success: boolean; error?: string; stderr?: string }`.
3. Replace the `execSync` call with `spawnSync('npm', ['install', '-g', installSpec], { ... })`:
   - Keep `timeout: 120_000`.
   - Keep `env: { ...process.env, HLX_SKIP_UPDATE_CHECK: '1' }`.
   - Add `shell: true` (required for Windows where `npm` resolves to `npm.cmd`).
   - Add `encoding: 'utf8'` so stdout/stderr are returned as strings.
   - Non-quiet mode (`quiet: false`): `stdio: 'inherit'` — preserves live streaming. `stderr` field in result is `undefined`.
   - Quiet mode (`quiet: true`): `stdio: ['pipe', 'pipe', 'pipe']` — captures output. `stderr` field in result contains `result.stderr`.
4. Check `result.status === 0` for success instead of relying on try/catch exception flow.
5. On failure (`result.status !== 0`): return `{ success: false, error: <captured stderr or status message>, stderr: <captured stderr> }`.
6. On success: return `{ success: true, stderr: <captured stderr for quiet mode, undefined for non-quiet> }`.
7. Handle `result.error` (spawn failure) as a hard failure with a descriptive error message.

**Verification (AI Agent Runs)**:
- Run `npm run typecheck` — must pass with no type errors.
- Review that the exported function signature is backward-compatible (callers only used `success` and `error` before; `stderr` is additive).

**Success Criteria**:
- `performUpdate()` uses `spawnSync` instead of `execSync`.
- The return type includes `stderr?: string`.
- Non-quiet mode preserves live terminal output (`stdio: 'inherit'`).
- Quiet mode captures stderr.
- `shell: true` and `encoding: 'utf8'` are set.
- `npm run typecheck` passes.

---

### Step 2: Create `validateInstall()` function

**Goal**: Provide a reusable function that checks the installed package's bin target exists and the CLI can start.

**What to Build**:

Create new file `src/update/validate.ts`:

1. Import `spawnSync` from `node:child_process`, `existsSync` from `node:fs`, `join` from `node:path`.
2. Export a function `validateInstall(): { valid: boolean; binTargetPath: string; error?: string }`.
3. **Resolve global node_modules path**:
   - Run `spawnSync('npm', ['root', '-g'], { shell: true, encoding: 'utf8', timeout: 15_000 })`.
   - If the command fails (non-zero status, error, or empty stdout), return `{ valid: false, binTargetPath: '', error: 'Failed to resolve global npm root: <detail>' }`.
   - Trim the stdout to get the global node_modules path.
4. **Construct the bin target path**:
   - `const binTargetPath = join(globalRoot, '@projectxinnovation', 'helix-cli', 'dist', 'index.js')`.
5. **Check file existence**:
   - `if (!existsSync(binTargetPath))` — return `{ valid: false, binTargetPath, error: 'Bin target missing: <binTargetPath>' }`.
6. **Run version check**:
   - `spawnSync('node', [binTargetPath, '--version'], { shell: true, encoding: 'utf8', timeout: 10_000, env: { ...process.env, HLX_SKIP_UPDATE_CHECK: '1' } })`.
   - If the command fails (non-zero status, error, or signal), return `{ valid: false, binTargetPath, error: 'Version check failed: <stderr or status>' }`.
7. If both checks pass, return `{ valid: true, binTargetPath }`.

**Verification (AI Agent Runs)**:
- Run `npm run typecheck` — must pass with no type errors.
- Verify the new file exports the correct function signature.

**Success Criteria**:
- `validate.ts` exists in `src/update/`.
- Exports `validateInstall()` with the documented return type.
- Uses `npm root -g` (not `npm prefix -g`) for cross-platform path resolution.
- File existence check via `fs.existsSync`.
- Version execution check via `node {path} --version` with `HLX_SKIP_UPDATE_CHECK=1`.
- Both checks have timeout guards.
- Graceful error returns (never throws) on all failure paths.
- `npm run typecheck` passes.

---

### Step 3: Insert validation into manual update path (`runUpdate`)

**Goal**: Gate the success message and metadata save on post-install validation in the manual `hlx update` flow.

**What to Build**:

Modify `src/update/index.ts` — `runUpdate()` function:

1. Add import: `import { validateInstall } from "./validate.js";`.
2. After the existing npm success check (line 74-77: `if (!result.success) { ... }`) and before the metadata save (line 80: `saveConfig(...)`), insert the validation call:
   ```
   const validation = validateInstall();
   if (!validation.valid) {
     // Print what failed
     console.error(`\nUpdate validation failed: ${validation.error}`);
     // Surface npm stderr if available (quiet mode only; non-quiet already streamed)
     if (result.stderr) {
       console.error(`\nnpm output:\n${result.stderr}`);
     }
     // Print recovery hint
     console.error(`\nThe update installed a broken package. To recover:`);
     console.error(`  1. git clone or pull the helix-cli repository`);
     console.error(`  2. Run: npm run build`);
     console.error(`  3. Run: npm link (may need elevated permissions on Windows)`);
     console.error(`\nYou can also re-run 'hlx update' to retry.`);
     process.exit(1);
   }
   ```
3. The existing `saveConfig()` and success message remain unchanged after the validation block — they only execute when validation passes.

**Verification (AI Agent Runs)**:
- Run `npm run typecheck` — must pass with no type errors.
- Verify that the metadata save (`saveConfig`) is only reachable when validation passes.
- Verify that `process.exit(1)` is called when validation fails.

**Success Criteria**:
- `validateInstall()` is called after npm success but before `saveConfig()`.
- Validation failure prints the error, any npm stderr, and recovery instructions.
- Validation failure exits with code 1.
- Metadata is only saved after validation passes.
- Happy path (valid install) behavior is unchanged.
- `npm run typecheck` passes.

---

### Step 4: Insert validation into auto-update path (`checkAutoUpdate`)

**Goal**: Gate the metadata save on post-install validation in the auto-update flow. Warn but do not block the user's current command.

**What to Build**:

Modify `src/update/index.ts` — `checkAutoUpdate()` function:

1. After the existing `performUpdate` call and inside the `if (result.success)` block (line 138), insert validation before `saveConfig`:
   ```
   const validation = validateInstall();
   if (!validation.valid) {
     console.error(`Warning: auto-update installed a broken package (${validation.error}). Run 'hlx update' to retry.`);
     if (result.stderr) {
       console.error(`npm output:\n${result.stderr}`);
     }
     return; // Do not save metadata, do not block
   }
   ```
2. The existing `saveConfig()` and "Updated to latest" message remain after the validation block — they only execute when validation passes.
3. Note: `result.stderr` is available here because auto-update uses `quiet: true` which now captures stderr per Step 1.

**Verification (AI Agent Runs)**:
- Run `npm run typecheck` — must pass with no type errors.
- Verify that `saveConfig` is only called when validation passes.
- Verify that validation failure does NOT call `process.exit()` — it returns normally.

**Success Criteria**:
- `validateInstall()` is called in the auto-update success path before metadata save.
- Validation failure warns to stderr but does not block.
- Metadata is not saved on validation failure (preserves retry).
- Captured npm stderr is surfaced in the warning.
- Happy path (valid auto-update) behavior is unchanged.
- `npm run typecheck` passes.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|-----------------|----------------|
| Node.js >= 18 available | available | `package.json` engines field; sandbox environment | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| npm available in PATH | available | Required by the existing CLI; install was from npm | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| Repository source code at `/vercel/sandbox/workspaces/cmolxl55i000lkq0uc9ks3x70/helix-cli` | available | Workspace setup | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| TypeScript compiler (`tsc`) available via npm scripts | available | `devDependencies` includes `typescript`; `npm run typecheck` is configured | CHK-01, CHK-02 |
| `npm install` dependencies installed | unknown | May need `npm install` before typecheck/build | CHK-01, CHK-02 |
| Global npm install capability | unknown | Agent sandbox may restrict `npm install -g`; required for end-to-end test of the actual update flow | CHK-04, CHK-05 |

### Required Checks

[CHK-01] TypeScript type check passes with all changes.
- Action: Run `npm install && npm run typecheck` from the helix-cli repository root.
- Expected Outcome: The command exits 0 with no type errors reported.
- Required Evidence: Full command stdout/stderr output showing a clean typecheck pass.

[CHK-02] Build succeeds and produces expected dist/ output.
- Action: Run `npm run build` from the helix-cli repository root.
- Expected Outcome: The command exits 0. The `dist/update/validate.js` file is produced alongside the existing `dist/update/perform.js` and `dist/update/index.js`.
- Required Evidence: Command exit code plus file listing of `dist/update/` showing `validate.js`, `perform.js`, and `index.js` all present.

[CHK-03] New `validate.ts` module exports the correct function signature.
- Action: Run `node -e "import('./dist/update/validate.js').then(m => { console.log(typeof m.validateInstall); })"` from the helix-cli repository root (after build).
- Expected Outcome: Output is `function`.
- Required Evidence: Command output showing `function`.

[CHK-04] Validation detects a missing bin target file.
- Action: After building, simulate a broken install by running the following from the helix-cli root: (1) Run `npm root -g` to get the global node_modules path. (2) If `@projectxinnovation/helix-cli` exists at that global path, temporarily rename `dist/index.js` within it. (3) Run `node dist/update/validate.js` or import and call `validateInstall()` directly via `node -e "import('./dist/update/validate.js').then(m => { const r = m.validateInstall(); console.log(JSON.stringify(r)); })"`. (4) Restore the renamed file if applicable.
- Expected Outcome: `validateInstall()` returns `{ valid: false, binTargetPath: <expected path>, error: <message mentioning missing file> }`.
- Required Evidence: JSON output from the function call showing `valid: false` and an error string that identifies the missing path.

[CHK-05] Validation succeeds when the installed package is intact.
- Action: Ensure the global `@projectxinnovation/helix-cli` package is properly installed (via `npm install -g .` from the repo root after build, or verify it already exists). Then run `node -e "import('./dist/update/validate.js').then(m => { const r = m.validateInstall(); console.log(JSON.stringify(r)); })"`.
- Expected Outcome: `validateInstall()` returns `{ valid: true, binTargetPath: <path to dist/index.js> }` with no error field.
- Required Evidence: JSON output from the function call showing `valid: true` and a populated `binTargetPath`.

## Success Metrics

1. `npm run typecheck` passes with zero errors across all changed files.
2. `npm run build` produces `dist/update/validate.js` alongside existing outputs.
3. `validateInstall()` returns `{ valid: false }` when the bin target is missing.
4. `validateInstall()` returns `{ valid: true }` when the package is properly installed.
5. `performUpdate()` return type includes `stderr?: string`.
6. `saveConfig()` in both `runUpdate()` and `checkAutoUpdate()` is only reachable after validation passes.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary requirements, acceptance criteria, scope boundaries | Two-step validation (file + version); fail-closed; recovery messaging; metadata must not save on failure |
| scout/reference-map.json | Code-level evidence with line numbers | Identified the zero-validation gap in both update paths; no test framework; stderr lost on success |
| scout/scout-summary.md | Architecture overview of update subsystem | Four files in src/update/; prepare hook as partial build vector; recursion guard pattern |
| diagnosis/diagnosis-statement.md | Root cause analysis | npm exit 0 equated with valid install; metadata poisoning blocks retry; stderr lost on success |
| diagnosis/apl.json | Validated answers to design questions | Validation insertion points; metadata gating; auto-update should warn not block |
| product/product.md | Product spec with use cases and success criteria | Four use cases (happy, broken manual, broken auto, retry); no test framework introduction |
| tech-research/tech-research.md | Technical decisions and API details | spawnSync over execSync; npm root -g over prefix -g; node {path} --version; shell:true for Windows |
| tech-research/apl.json | Validated technical answers | Cross-platform npm root -g approach; mode-dependent stderr capture; 10s timeout for version check |
| src/update/perform.ts | Current implementation (33 lines) | execSync-based; returns {success, error}; quiet mode pipes but doesn't read; HLX_SKIP_UPDATE_CHECK=1 |
| src/update/index.ts | Current implementation (151 lines) | Two paths: runUpdate (manual, exits on failure) and checkAutoUpdate (auto, never blocks); saveConfig immediately after npm success |
| src/update/check.ts | Constants and SHA fetching (44 lines) | CANONICAL_REPO, CANONICAL_BRANCH; install spec: github:Project-X-Innovation/helix-cli#main |
| src/update/version.ts | Runtime version reading (20 lines) | import.meta.url resolves to OLD install — confirms need for npm root -g approach |
| package.json | Bin contract and build scripts | bin: dist/index.js; name: @projectxinnovation/helix-cli; no test framework |
| tsconfig.json | Build config | declaration: true explains .d.ts-only partial builds |
| src/index.ts | CLI entrypoint (98 lines) | --version handler; auto-update skip set; command routing |
| repo-guidance.json | Repository intent | helix-cli is sole target; all changes in src/update/ |

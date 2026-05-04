# Diagnosis Statement — FIX-347: Make hlx update Validate Installed Package And Recover From Broken Installs

## Problem Summary

`hlx update` declares success based solely on the npm exit code from `npm install -g`. No post-install validation exists. When npm exits 0 but the installed package is missing its compiled JavaScript entrypoint (`dist/index.js`), the update reports success while leaving the global `hlx` command broken with `MODULE_NOT_FOUND`. The install metadata (commit SHA) is persisted immediately after npm success, which also prevents future retry via `hlx update` because it sees "Already up to date."

## Root Cause Analysis

**Primary root cause**: `performUpdate()` in `src/update/perform.ts` (lines 14-20) returns `{success: true}` whenever `execSync` does not throw — i.e., whenever npm exits 0. There is no validation that the installed package's bin target (`dist/index.js`) exists or is runnable.

**Contributing factors**:

1. **npm exits 0 despite broken installs**: npm can exit 0 while emitting tar warnings (`TAR_ENTRY_ERROR ENOENT`) that indicate missing package files. The `prepare` lifecycle hook (`npm run build` → `tsc`) can fail partially because `tsconfig.json` has `declaration: true`, which generates `.d.ts` files even when `.js` compilation is incomplete. This means `dist/` can appear populated (with `.d.ts` files) while the actual JavaScript entrypoint is missing.

2. **stderr is lost on the success path**: In quiet mode (auto-update), `performUpdate()` pipes all stdio but never reads the buffers on success (`src/update/perform.ts` line 17). In non-quiet mode (manual update), stdio is `'inherit'` — warnings scroll past on the terminal but are not captured programmatically for later display with a failure message.

3. **Metadata save is not gated on validation**: Both `runUpdate()` (lines 80-87) and `checkAutoUpdate()` (lines 139-145) in `src/update/index.ts` save the new commit SHA to config immediately after `performUpdate()` returns success. If the install is broken, this poisons the SHA comparison: future `hlx update` calls see matching SHAs and report "Already up to date" (line 61-63), blocking retry.

4. **No validation gap between npm and success message**: In `runUpdate()`, there are zero lines of code between the npm success check (line 74) and the metadata save + success message (lines 80-89). No file-existence check, no subprocess invocation, no package integrity verification.

**Scope of change**: Confined to `src/update/` — primarily `perform.ts` (capturing stderr, returning it) and `index.ts` (inserting validation calls, gating metadata save). A new validation function is needed, either in `perform.ts` or a new `validate.ts` file.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| Success based on npm exit code only | `src/update/perform.ts` lines 14-20 | `execSync` success → `{success: true}` with no further checks |
| No post-install validation in either update path | `src/update/index.ts` lines 72-89, 134-147 | Both `runUpdate()` and `checkAutoUpdate()` trust `performUpdate().success` without verification |
| Bin contract requires `dist/index.js` | `package.json` line 7 | `"bin": {"hlx": "dist/index.js"}` |
| `tsconfig` generates `.d.ts` alongside `.js` | `tsconfig.json` line 12 | `declaration: true` — enables partial builds with declarations but no JS |
| Prepare hook runs tsc during npm install | `package.json` line 12 | `"prepare": "npm run build"` — lifecycle hook that builds during install |
| Stderr not captured on success | `src/update/perform.ts` lines 15-17 | Quiet mode pipes but doesn't read; non-quiet mode inherits |
| Metadata poisoning prevents retry | `src/update/index.ts` lines 59-63, 80-87 | SHA saved immediately after npm success; future updates see "Already up to date" |
| `import.meta.url` resolves to OLD install | `src/update/version.ts` lines 11-13 | Runtime path resolution points to currently running CLI, not newly installed one |
| Global prefix locatable via `npm prefix -g` | Runtime probe | Returns global install path (e.g., `/home/user/.global/npm`) |
| No test framework exists | `package.json` | No test script, no test dependencies, no test files |
| Recursion guard already established | `src/update/perform.ts` line 18 | `HLX_SKIP_UPDATE_CHECK: '1'` env var prevents recursive update checks |

## Success Criteria

1. When the installed package contains `dist/index.js` and `hlx --version` succeeds, `hlx update` reports success as today.
2. When `dist/index.js` is missing after npm install, `hlx update` exits non-zero and reports the missing path.
3. When npm exits 0 but emits tar warnings and validation fails, the user sees relevant install output.
4. A declaration-only `dist/` install (`.d.ts` without `.js`) is not reported as successful.
5. A recovery message directs users to rebuild/relink from a local checkout.
6. installSource metadata is NOT saved when validation fails, preserving the user's ability to retry.
7. Auto-update validation failure warns but does not block the user's current command.
8. Existing update behavior is unchanged for valid installs (only validation check is added).

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary requirements and failure scenario | Bin target `dist/index.js` must exist; update must fail closed; recovery messaging required; two validation checks (file exists + version runs) |
| scout/reference-map.json | Identifies all relevant files and documents code-level evidence | Confirms the gap: performUpdate returns success on npm exit 0 alone; no validation anywhere; metadata save not gated |
| scout/scout-summary.md | Synthesized analysis of update flow architecture | Clarifies two update paths (manual/auto), stderr handling gaps, and scope boundary |
| src/update/perform.ts | Primary change target — current npm install execution | Returns {success: true} solely on npm exit code; stderr lost on success path; recursion guard pattern established |
| src/update/index.ts | Update command handler — two entry paths | Both paths trust performUpdate() without validation; metadata saved immediately on npm success |
| src/update/check.ts | Canonical repo/branch constants | Install spec: `github:Project-X-Innovation/helix-cli#main` |
| src/update/version.ts | Runtime version resolution pattern | Uses import.meta.url relative to dist/ — resolves to OLD install during update, not new one |
| src/index.ts | CLI entrypoint and --version handler | --version calls getPackageVersion(); auto-update runs pre-dispatch for non-skipped commands |
| package.json | Package metadata and build configuration | bin: dist/index.js; prepare: npm run build; no test framework; name: @projectxinnovation/helix-cli |
| tsconfig.json | TypeScript compilation settings | declaration: true explains how dist/ can contain .d.ts without .js in partial builds |
| src/lib/config.ts | Config persistence types and saveConfig behavior | InstallSource type shape; saveConfig does read-merge-write; relevant for metadata gating |

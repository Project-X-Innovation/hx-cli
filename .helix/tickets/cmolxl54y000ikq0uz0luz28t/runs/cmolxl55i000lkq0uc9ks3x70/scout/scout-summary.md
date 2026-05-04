# Scout Summary — FIX-347: Make hlx update Validate Installed Package And Recover From Broken Installs

## Problem

`hlx update` declares success based solely on the npm exit code from `npm install -g github:Project-X-Innovation/helix-cli#main`. No post-install validation checks whether the installed package's bin entrypoint (`dist/index.js`) exists or is runnable. A broken package (e.g., `dist/` containing only `.d.ts` declaration files without compiled JavaScript) results in a success message while leaving the global `hlx` command unusable with a `MODULE_NOT_FOUND` error.

## Analysis Summary

### Update Flow Architecture

The update subsystem lives in `src/update/` with four files:
- **`perform.ts`** — executes `npm install -g` via `execSync`, returns `{success: boolean, error?: string}`. Success is determined entirely by whether `execSync` throws (i.e., npm exit code). No inspection of the installed output.
- **`index.ts`** — two entry paths:
  - `runUpdate()` (manual, line 33): checks remote SHA → calls `performUpdate({quiet: false})` → saves install metadata → prints "Update complete". Exits process on failure.
  - `checkAutoUpdate()` (automatic, line 97): runs silently before most commands, never blocks execution even on failure. Saves metadata on success.
- **`check.ts`** — fetches remote HEAD SHA via `git ls-remote`. Defines canonical repo/branch constants.
- **`version.ts`** — reads `package.json` version at runtime from the compiled `dist/` location.

### The Gap

Between `performUpdate()` returning `{success: true}` (perform.ts line 19) and the success message being printed (index.ts line 89), there is zero validation. The flow:

1. `npm install -g github:...#main` exits 0 (**npm can exit 0 with tar warnings**)
2. `performUpdate` returns `{success: true}`
3. `runUpdate` saves `installSource` metadata with the new commit SHA
4. "Update complete" is printed
5. User's next `hlx` invocation fails with `MODULE_NOT_FOUND`

### Key Boundary Observations

- **Bin contract**: `package.json` declares `"bin": {"hlx": "dist/index.js"}`. This is the file that must exist after install.
- **Declaration files**: `tsconfig.json` has `"declaration": true`, so `tsc` always produces `.d.ts` files. A partial or broken build can leave `.d.ts` files present while `.js` files are missing.
- **Prepare hook**: `package.json` has `"prepare": "npm run build"`, which runs `tsc` during `npm install` from GitHub. If the build fails silently or partially, the `dist/` tree may be incomplete.
- **Stderr handling**: In non-quiet mode, npm output goes to `inherit` (visible to user but not captured). In quiet mode, stdio is piped but never read on the success path. npm tar warnings are lost on success.
- **Recursion guard**: `HLX_SKIP_UPDATE_CHECK=1` is set during install to prevent the new CLI from triggering its own auto-update during the prepare step.
- **No tests**: The repository has no test framework, test files, or test script. Quality gates are limited to `npm run build` (tsc) and `npm run typecheck` (tsc --noEmit).

### Scope Boundary

Changes are confined to `src/update/` (primarily `perform.ts` and `index.ts`). The entrypoint (`src/index.ts`), config module (`src/lib/config.ts`), and other command modules are not directly impacted. The `package.json` bin contract and build configuration are read-only context — not change targets.

## Relevant Files

| File | Role | Lines |
|------|------|-------|
| `src/update/perform.ts` | Primary change target — npm install execution, needs post-install validation | 1-33 |
| `src/update/index.ts` | Update command handler — needs to consume validation results and control metadata save | 1-151 |
| `src/update/check.ts` | Context — canonical repo/branch constants, SHA fetching | 1-44 |
| `src/update/version.ts` | Context — runtime version reading from dist/, potential validation probe | 1-20 |
| `src/index.ts` | Context — CLI entrypoint, command routing, auto-update hook | 1-98 |
| `package.json` | Context — bin contract (`hlx` → `dist/index.js`), build scripts, no test infra | 1-25 |
| `tsconfig.json` | Context — declaration:true explains .d.ts-only dist/ scenario | 1-15 |
| `src/lib/config.ts` | Context — InstallSource type, saveConfig, config persistence | 1-221 |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and requirements | Bin target `dist/index.js` must exist post-install; update must fail closed; recovery messaging required; two validation checks needed (file exists + version runs) |
| package.json | Bin contract and build configuration | `"bin": {"hlx": "dist/index.js"}`, `"prepare": "npm run build"`, no test framework |
| tsconfig.json | Build output configuration | `declaration: true` explains how dist/ can contain .d.ts without .js |
| src/update/perform.ts | Current update execution logic | Returns success based solely on npm exit code; no post-install checks |
| src/update/index.ts | Update command handler and auto-update hook | Two code paths (manual/auto) both trust performUpdate() without validation; metadata saved immediately on success |
| src/update/check.ts | Canonical source constants | CANONICAL_REPO and CANONICAL_BRANCH used in install spec |
| src/update/version.ts | Runtime version resolution | Reads from dist/ relative path — same path resolution that breaks on bad install |
| src/index.ts | CLI entrypoint and routing | --version handler and auto-update skip logic |
| src/lib/config.ts | Config persistence types and functions | InstallSource shape, saveConfig merge behavior |

# Scout Summary — BLD-527: Replace tar extraction with in-process JS library

## Problem

The `hlx update` staged-update flow shells out to system `tar` via `execSync` at `src/update/perform.ts:124`:

```typescript
execSync(`tar -xzf "${tarballPath}" -C "${stagingDir}"`, {
  stdio: "pipe",
  timeout: 30_000,
});
```

On Windows machines where Git for Windows is installed — the default for essentially every Windows developer — GNU tar appears first in PATH and interprets the drive letter in Windows paths (e.g., `C:\Users\...`) as a remote host prefix (tar remote-tape syntax: `host:path`). This causes extraction to fail:

```
tar (child): Cannot connect to C: resolve failed
gzip: stdin: unexpected end of file
```

The failure occurs before the swap step, so the existing live install remains intact (fail-closed is preserved), but `hlx update` is non-functional for these users. The fix must replace the shell-based tar invocation with an in-process JavaScript tar library that does not depend on any external binary.

## Analysis Summary

### Extraction Flow Location

The extraction step is isolated in `src/update/perform.ts` lines 122–131, within the `performStagedUpdate` function (line 77). The function follows a 5-stage pipeline: download → **extract** → validate → swap → cleanup. Only the extract stage needs to change.

### execSync / child_process Usage Inventory (update module)

| Location | Usage | In Scope? |
|---|---|---|
| `perform.ts:124` | `execSync('tar -xzf ...')` — tarball extraction | **Yes — the bug** |
| `perform.ts:33` | `execSync('xcopy/cp -R ...')` — EXDEV fallback copy | No (not a tar invocation) |
| `check.ts:30` | `execSync('gh auth token')` — GitHub token discovery | No (not a tar invocation) |
| `validate.ts:38` | `spawnSync('node', ...)` — version check after staging | No (not a tar invocation) |

### Tarball Shape (from CI)

Created in `.github/workflows/build-release.yml` lines 36–43 on `ubuntu-latest`:
- Format: gzip-compressed tar (`.tgz`)
- Top-level entries (no nested prefix): `dist/`, `skill-content/`, `package.json`, `build-metadata.json`
- Excludes: `*.test.js`, `*.test.d.ts`

### Validation Contract (post-extraction)

`validateStaged()` in `validate.ts` checks the staging directory for:
1. `dist/index.js` exists (line 22)
2. `package.json` exists (line 30)
3. `node dist/index.js --version` produces output and exits 0 (line 38)

### Error Handling Contract

Extraction errors must return `{ success: false, error: string }` — not throw. The caller in `index.ts`:
- **Manual update** (`runUpdate`): prints error, shows recovery guidance, calls `process.exit(1)` (line 113)
- **Auto-update** (`checkAutoUpdate`): logs warning and continues (line 203)

### Dependency Landscape

- **Current runtime deps**: None (zero dependencies)
- **Current dev deps**: `@types/node ^25.5.0`, `typescript ^6.0.2`
- **Module system**: ESM (`"type": "module"`, Node16 resolution)
- **Node engine**: `>=18`
- Adding a runtime dependency for a JS tar library is explicitly in scope per the ticket.

### Test Infrastructure

- Uses Node.js built-in test runner (`node --test`)
- Test API: `node:test` (describe/it) + `node:assert` (strict)
- Pattern from existing tests: `mkdtempSync` for temp dirs, `beforeEach`/`afterEach` for cleanup
- **No existing tests for the update flow** — new test file needed
- Existing test files: `src/lib/flags.test.ts`, `src/lib/resolve-ticket.test.ts`, `src/skill/skill.test.ts`

### Quality Gates

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsc` | TypeScript compilation |
| `typecheck` | `tsc --noEmit` | Type checking only |
| `test` | `tsc && node --test dist/**/*.test.js` | Build + run tests |
| `prepare` | `npm run build` | Auto-runs on npm install |

No linter or formatter configured.

### Key Code Boundaries

| Boundary | File:Line | Detail |
|---|---|---|
| Bug location | `perform.ts:124` | `execSync('tar -xzf ...')` |
| Error catch | `perform.ts:128-131` | Returns `{ success: false, error }` |
| Staging base | `perform.ts:16` | `~/.hlx/staging/` |
| Tarball path | `perform.ts:83` | `~/.hlx/staging/{commitSha}.tgz` |
| Staging dir | `perform.ts:82` | `~/.hlx/staging/{commitSha}/` |
| Post-extract validation | `perform.ts:134` → `validate.ts:14` | Checks dist/index.js, package.json, runs --version |
| execSync import | `perform.ts:1` | Also used by copyDirRecursive (line 33) |

## Relevant Files

| File | Role |
|---|---|
| `src/update/perform.ts` | **Primary change target.** Contains the tar extraction bug at line 124 and the full staged-update orchestration. |
| `src/update/validate.ts` | Post-extraction validation. Defines what the extraction output must look like. Read-only context. |
| `src/update/index.ts` | Update command orchestrator. Calls performStagedUpdate and handles results. Read-only context. |
| `src/update/check.ts` | Release discovery. Defines ReleaseInfo type. Read-only context. |
| `src/update/version.ts` | Version display. Read-only context. |
| `package.json` | Dependency manifest. Needs new runtime dependency for JS tar library. |
| `tsconfig.json` | TypeScript config. Build constraint for any new code. |
| `.github/workflows/build-release.yml` | Defines tarball shape. Read-only context — out of scope for changes. |
| `src/lib/config.ts` | Config types and persistence. Read-only context. |
| `src/index.ts` | CLI entry point. Read-only context. |
| `src/skill/skill.test.ts` | Test pattern reference (node:test, temp dirs, cleanup). |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `ticket.md` | Understand scope, decisions, acceptance criteria | Extraction-only change; must remove tar binary dependency; preserve error contract; add extraction test |
| `repo-guidance.json` | Confirm repository role | helix-cli is the sole target repository; no cross-repo impact |
| `src/update/perform.ts` (source) | Identify exact bug location and surrounding code | Line 124 execSync tar call; error caught at 128–131; staging dir at ~/.hlx/staging/{sha}; execSync import also used by copyDirRecursive |
| `src/update/validate.ts` (source) | Understand post-extraction contract | Checks dist/index.js, package.json, runs node --version |
| `src/update/index.ts` (source) | Understand caller error handling | Manual: exit(1) + recovery msg; Auto: log warning + continue |
| `src/update/check.ts` (source) | Understand release discovery and other execSync usage | Uses execSync for 'gh auth token' — not a tar invocation |
| `src/update/version.ts` (source) | Understand version display contract | semver + short SHA format preserved |
| `package.json` (source) | Dependency landscape, build/test commands, module system | Zero runtime deps; ESM; node:test runner; Node >=18 |
| `tsconfig.json` (source) | Build configuration constraints | ES2022, Node16 modules, strict, output to dist/ |
| `.github/workflows/build-release.yml` (source) | Tarball creation shape | Top-level dist/, skill-content/, package.json, build-metadata.json in .tgz |
| `src/skill/skill.test.ts` (source) | Test patterns used in this project | node:test describe/it; node:assert strict; mkdtempSync for temp dirs |
| `/tmp/helix-inspect/manifest.json` | Check runtime inspection availability | Not present — no runtime evidence available (expected for CLI tool repo) |

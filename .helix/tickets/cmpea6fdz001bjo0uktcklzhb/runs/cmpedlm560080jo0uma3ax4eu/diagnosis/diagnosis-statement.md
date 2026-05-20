# Diagnosis Statement — BLD-527 (Continuation): Replace tar extraction with in-process JS library

## Problem Summary

The `hlx update` staged-update flow shells out to system `tar` via `execSync` at `src/update/perform.ts:124` to extract the downloaded GitHub release tarball. On Windows machines where Git for Windows is installed — the default developer setup — GNU tar (from MSYS2/mingw) appears first in PATH and interprets Windows drive-letter colons (e.g., `C:\Users\...`) as remote-host syntax (traditional Unix `host:path` tape-archive semantics). This produces the error `tar (child): Cannot connect to C: resolve failed` and makes `hlx update` non-functional for this large segment of Windows users. The failure occurs before the swap step, so the existing live install is left intact (fail-closed behavior is preserved), but the update cannot complete.

## Root Cause Analysis

### Single Root Cause: Shell-based tar invocation with platform-dependent path interpretation

**Location**: `src/update/perform.ts`, line 124

```typescript
execSync(`tar -xzf "${tarballPath}" -C "${stagingDir}"`, {
  stdio: "pipe",
  timeout: 30_000,
});
```

**Mechanism**:
1. `STAGING_BASE` is `join(homedir(), '.hlx', 'staging')` (line 16), which resolves to `C:\Users\<user>\.hlx\staging` on Windows
2. `tarballPath` becomes e.g. `C:\Users\<user>\.hlx\staging\abc123.tgz`
3. `stagingDir` becomes e.g. `C:\Users\<user>\.hlx\staging\abc123`
4. When `tar` resolves to GNU tar (from Git for Windows), it parses the `C:` prefix as a remote hostname — not a drive letter
5. GNU tar attempts a network connection to host `C`, which fails: `Cannot connect to C: resolve failed`

**Why it is not a quoting or escaping issue**: The colon interpretation is intrinsic to GNU tar's argument parser. Double-quoting the paths (already done) does not prevent GNU tar from interpreting the colon. The `--force-local` flag disables this in GNU tar but is not recognized by macOS BSD tar, making it non-portable.

**Why workarounds were rejected**: The ticket explicitly prohibits runtime detection of GNU tar, hardcoding `C:\Windows\System32\tar.exe`, or any fix that still depends on an external binary. The ticket's core goal is "no user-side toolchain required."

### Alternative hypotheses considered and rejected

| Hypothesis | Why Rejected |
|---|---|
| Shell escaping issue — quoting would fix | Colon interpretation is in GNU tar's argument parser, not the shell. Paths are already quoted. |
| Use `--force-local` flag | GNU-specific; breaks macOS BSD tar. Still depends on external binary. |
| Hardcode `C:\Windows\System32\tar.exe` | Still an external binary dependency. Only available since Windows 10 1803. Violates ticket requirements. |
| Detect GNU tar and error with clear message | Does not actually fix the update for Windows users. Just a better error message. |
| Use `tar-stream` (lower-level library) | Would work but requires significantly more code (manual directory creation, file writing, permission handling). No benefit over higher-level `tar` package. |

## Evidence Summary

| Evidence | Location | Finding |
|---|---|---|
| Exact bug: execSync tar call | `src/update/perform.ts:124` | `execSync('tar -xzf "${tarballPath}" -C "${stagingDir}"')` — single external tar invocation |
| Error handling is correct | `src/update/perform.ts:128-131` | Catches exceptions, returns `{ success: false, error }` — no throw, contract preserved |
| Staging paths include drive letters | `src/update/perform.ts:16,82-83` | `STAGING_BASE = join(homedir(), '.hlx', 'staging')` resolves to `C:\Users\...` on Windows |
| No other tar invocations | `src/update/perform.ts:33`, `check.ts:30`, `validate.ts:38` | Other child_process calls are xcopy/cp-R, gh auth token, node --version — not tar |
| execSync import still needed | `src/update/perform.ts:1,33` | Import used by both tar (line 124) and copyDirRecursive (line 33); import must remain for the latter |
| Tarball format is standard .tgz | `.github/workflows/build-release.yml:36-43` | Top-level entries: dist/, skill-content/, package.json, build-metadata.json; excludes *.test.js |
| Post-extraction validation contract | `src/update/validate.ts:22,30,38` | Checks dist/index.js exists, package.json exists, node --version runs |
| Swap step expectations | `src/update/perform.ts:160-163` | Expects dist/, skill-content/, package.json, build-metadata.json at staging dir root |
| Zero runtime dependencies | `package.json` | Only devDependencies; adding runtime dep is explicitly in scope |
| ESM project | `package.json:7`, `tsconfig.json:4-5` | `"type": "module"`, ES2022 target, Node16 modules |
| Node engine requirement | `package.json:21` | `>=18` — all modern stream/fs APIs available |
| No existing update tests | `src/update/` directory | No .test.ts files; new test needed |
| Test infrastructure | `src/skill/skill.test.ts` | node:test (describe/it) + node:assert (strict) + mkdtempSync for temp dirs |
| No runtime inspection | `/tmp/helix-inspect/manifest.json` | Not present — expected for CLI tool repo |

## Success Criteria

1. **In-process extraction**: The extraction step at `src/update/perform.ts:122-131` uses a JavaScript tar library (recommended: `tar` npm package / isaacs/node-tar) instead of `execSync('tar ...')`. No external `tar` binary is invoked on any platform.

2. **Same output layout**: After extraction, the staging directory contains the same files the existing flow expects: `dist/`, `skill-content/`, `package.json`, `build-metadata.json`. `validateStaged()` continues to pass without modification.

3. **Error contract preserved**: Extraction errors return `{ success: false, error: string }` from the same code path. They do not throw out of the update flow. Manual `hlx update` exits non-zero; auto-update logs warning and continues.

4. **Runtime dependency added**: `tar` (or equivalent JS tar library) is added to `dependencies` in `package.json`. The library must be pure JavaScript with no native build dependency and must support ESM.

5. **New extraction test**: A test file (e.g., `src/update/perform.test.ts`) creates a representative .tgz payload, extracts it using the new code path, and asserts the resulting directory layout matches expectations (dist/index.js exists, package.json exists, etc.).

6. **Cross-platform correctness**: Extraction works on Windows (with GNU tar in PATH), macOS, and Linux without regression.

7. **Quality gates pass**: `npm test` passes, `npm run build` passes, `node dist/index.js --version` reports the installed commit SHA.

### Scope of Changes

| Area | File | Change Type |
|---|---|---|
| Extraction step | `src/update/perform.ts` | Modify: Replace execSync tar call (lines 122-131) with tar library call |
| Dependencies | `package.json` | Modify: Add `tar` to runtime dependencies |
| Extraction test | `src/update/perform.test.ts` (new) | Create: Test extraction of .tgz payload, verify layout |

### Files NOT Changed

| File | Reason |
|---|---|
| `src/update/validate.ts` | Post-extraction validation — no change needed |
| `src/update/index.ts` | Orchestrator/caller — no change needed |
| `src/update/check.ts` | Release discovery — not in scope |
| `src/update/version.ts` | Version display — not in scope |
| `.github/workflows/build-release.yml` | CI workflow — explicitly out of scope |
| `tsconfig.json` | Build config — no change needed (tar v7+ ships its own types) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `ticket.md` (continuation context) | Primary scope and requirements | Extraction-only fix; must remove tar binary dependency; preserve error contract; add test; explicit rejection of workarounds |
| `scout/reference-map.json` | File inventory, facts, and code boundaries | Confirmed bug at perform.ts:124, three other non-tar child_process calls, tarball shape, validation contract |
| `scout/scout-summary.md` | Structured analysis summary | Confirmed extraction flow isolation, error handling contract, dependency landscape, test infrastructure |
| `repo-guidance.json` | Repository role | helix-cli is sole target; no cross-repo impact |
| `src/update/perform.ts` (source) | Direct inspection of bug location | Confirmed execSync tar call at line 124, error catch at 128-131, staging path construction, execSync import also used by copyDirRecursive |
| `src/update/validate.ts` (source) | Post-extraction contract | Checks dist/index.js, package.json, runs node --version — defines what extraction output must look like |
| `src/update/index.ts` (source) | Caller error handling | Manual: exit(1) + recovery msg; Auto: log warning + continue — error contract must be preserved |
| `package.json` (source) | Dependency and build constraints | Zero runtime deps, ESM, Node >=18, test runner pattern |
| `tsconfig.json` (source) | Build config | ES2022, Node16 modules, strict — new code and imports must compile |
| `.github/workflows/build-release.yml` (source) | Tarball shape definition | Top-level dist/, skill-content/, package.json, build-metadata.json in .tgz — no prefix |
| Context7 tar-stream docs | JS tar library API verification | Confirmed tar-stream is lower-level (manual file writing per entry) vs node-tar's higher-level tar.x() API |
| Web search: node-tar | Library fitness confirmation | Confirmed node-tar v7+ is TypeScript-native, ESM/CJS hybrid, pure JS, used by npm itself |

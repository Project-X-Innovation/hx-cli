# Product Spec — BLD-527 (Continuation): Replace tar extraction with in-process JS library

## Problem Statement

The `hlx update` staged-update flow (implemented in the prior run of BLD-527) shells out to system `tar` via `execSync` at `src/update/perform.ts:124` to extract the downloaded GitHub release tarball. On Windows machines where Git for Windows is installed — the default developer setup — GNU tar from MSYS2/mingw appears first in PATH and interprets Windows drive-letter colons (`C:\...`) as remote-host syntax (traditional Unix `host:path` tape-archive semantics). This produces the error:

```
tar (child): Cannot connect to C: resolve failed
gzip: stdin: unexpected end of file
```

**User impact:** `hlx update` is completely non-functional for Windows developers who have Git for Windows installed — a near-universal population. The failure is deterministic and not user-recoverable without manual intervention. The existing live install is preserved (fail-closed behavior works), but these users cannot update at all.

**Why workarounds were rejected:** The colon interpretation is intrinsic to GNU tar's argument parser; double-quoting (already present) does not prevent it. `--force-local` is GNU-specific and breaks macOS BSD tar. Hardcoding `C:\Windows\System32\tar.exe` still depends on an external binary and is only available since Windows 10 1803. The ticket's core goal was "no user-side toolchain required," so the fix must eliminate the external binary dependency entirely.

## Product Vision

The `hlx update` extraction step runs entirely in-process using a JavaScript tar library, removing any dependency on a platform `tar` binary, PATH ordering, or path-quoting behavior. Update works identically on Windows, macOS, and Linux without requiring any external tool.

## Users

| User | Context |
|------|---------|
| **Windows developers** | Primary affected users. Have Git for Windows installed, which places GNU tar ahead of bsdtar in PATH. Currently cannot use `hlx update`. |
| **macOS / Linux developers** | Existing users whose updates work today. Must not regress. |
| **Auto-update hook** | Pre-command auto-update that runs silently. Must continue to fail-open (warn and continue) on extraction errors. |

## Use Cases

1. **Windows update (primary fix):** A Windows developer with Git for Windows installed runs `hlx update`. The tarball is extracted in-process without invoking system `tar`. The update completes successfully.
2. **macOS / Linux update (no regression):** An existing macOS or Linux user runs `hlx update`. Behavior is identical to before — the extraction now happens in-process instead of via shell, but the outcome is the same.
3. **Corrupt tarball:** A corrupted or truncated tarball is downloaded. Extraction fails, the error surfaces as a structured `{ success: false, error }` result, the live install is untouched, and the user sees a clear error message.
4. **Auto-update extraction failure:** The pre-command auto-update encounters an extraction error. It logs a warning and continues dispatching the user's command — the CLI is never bricked.

## Core Workflow

```
hlx update / auto-update
         |
  download tarball to staging  (unchanged)
         |
  extract tarball in-process   <-- THIS IS THE FIX
  (JS tar library, no shell)
         |
  validate staged candidate    (unchanged: dist/index.js, package.json, --version)
         |
  swap staged -> live          (unchanged)
```

Only the extraction step changes. Everything upstream (discovery, download, auth) and downstream (validation, swap, metadata recording) remains as-is.

## Essential Features (MVP)

1. **In-process tar extraction:** Replace the `execSync('tar -xzf ...')` call at `src/update/perform.ts:124` with a JavaScript tar library that decompresses and extracts .tgz files without invoking any external binary.

2. **Same output layout:** After extraction, the staging directory must contain the same top-level entries the CI workflow produces: `dist/`, `skill-content/`, `package.json`, `build-metadata.json`. The existing `validateStaged()` function must pass without modification.

3. **Error contract preserved:** Extraction errors must return `{ success: false, error: string }` from the same code path (not throw). Manual `hlx update` continues to exit non-zero with a clear error. Auto-update continues to log a warning and proceed.

4. **Runtime dependency added:** A JavaScript tar library is added to `dependencies` in `package.json`. The library must be pure JavaScript with no native build dependency and must support ESM (the project uses `"type": "module"` with ES2022 target and Node16 module resolution).

5. **Extraction test coverage:** A new test file exercises extraction of a representative .tgz payload and asserts the resulting directory layout matches the expected structure (`dist/index.js` exists, `package.json` exists, etc.). The test must be platform-independent and should reproduce the original failure mode conceptually (paths with colons or drive-letter patterns).

## Features Explicitly Out of Scope (MVP)

- CI workflow changes (`.github/workflows/build-release.yml` is unchanged).
- Update channel, auth, or discovery logic (`src/update/check.ts` is unchanged).
- The validate step (`src/update/validate.ts` is unchanged).
- The swap step in `src/update/perform.ts` (only the extraction block changes).
- Documentation rewrites beyond any user-facing message change at the extraction boundary.
- Replacing non-tar `execSync` calls (`copyDirRecursive` for EXDEV fallback, `gh auth token`, `node --version` validation).
- Runtime detection or rejection of GNU tar at runtime.

## Success Criteria

| # | Criterion | Verification Method |
|---|-----------|---------------------|
| 1 | On a Windows machine with Git for Windows installed and GNU tar first in PATH, `hlx update` successfully extracts the tarball and completes the staged swap | Run `hlx update` on Windows with Git for Windows in PATH |
| 2 | On macOS and Linux, `hlx update` continues to work without regression | Run `hlx update` on macOS/Linux |
| 3 | No remaining external `tar` invocation in the update module | Grep for `execSync`/`spawnSync`/`child_process` in `src/update/` and confirm no tar calls remain |
| 4 | A unit or integration test exercises extraction of a .tgz payload and asserts the resulting layout | `npm test` passes with the new test |
| 5 | `npm test` passes, `npm run build` passes, `node dist/index.js --version` reports the commit SHA | Run quality gate commands |

## Key Design Principles

- **No external binary dependency for extraction:** The fix must eliminate the system `tar` dependency, not work around it with detection, flags, or hardcoded paths.
- **Minimal change surface:** Only the extraction block (lines 122-131 of `perform.ts`) and `package.json` are modified. The rest of the update pipeline is untouched.
- **Preserve error contract:** The function signature and error-handling behavior of `performStagedUpdate` remain identical. Callers are unaffected.
- **Fail-closed is preserved:** A failed extraction leaves the live install intact. This behavior is already correct and must not regress.

## Scope & Constraints

- **Repository:** `helix-cli` only. No cross-repo impact.
- **Files changed:** `src/update/perform.ts` (extraction block), `package.json` (new runtime dependency), new test file (e.g., `src/update/perform.test.ts`).
- **Files NOT changed:** `src/update/validate.ts`, `src/update/index.ts`, `src/update/check.ts`, `src/update/version.ts`, `.github/workflows/build-release.yml`, `tsconfig.json`.
- **Constraint:** The project currently has zero runtime dependencies. Adding one is explicitly authorized by the ticket, but the dependency must be pure JS (no native build step), ESM-compatible, and suitable for Node >= 18.
- **Constraint:** The `execSync` import in `perform.ts` is also used by `copyDirRecursive` (line 33) for the EXDEV fallback. The import must remain; only the tar invocation is removed.
- **Constraint:** The tarball is standard `.tgz` with top-level entries (no nested prefix directory), created by GNU tar on ubuntu-latest in CI. No symlinks, long paths, or special attributes.

## Future Considerations

- **Replace remaining shell-outs:** The non-tar `execSync` calls (`copyDirRecursive`, `gh auth token`) could also be replaced with pure Node.js equivalents in a future pass, further reducing external binary dependencies.
- **Streaming extraction:** If tarball sizes grow significantly, streaming extraction (pipe download directly to extractor without writing to disk first) could reduce disk I/O and staging space.

## Open Questions / Risks

| # | Question / Risk | Impact | Status |
|---|----------------|--------|--------|
| 1 | **Which JS tar library to use?** Diagnosis recommends `tar` (isaacs/node-tar v7+) — TypeScript-native, ESM/CJS hybrid, pure JS, used by npm itself. Alternative `tar-stream` is lower-level and requires significantly more code. | Affects implementation complexity and dependency footprint. | Recommended: `tar` (node-tar); confirm in tech-research |
| 2 | **Does node-tar v7+ bundle correctly into the release tarball?** The CI build excludes `node_modules/` but the release tarball must include the `tar` dependency's compiled output or it must be bundled. | If the dependency is not available at runtime in the release artifact, extraction will fail. | Needs tech-research — how does the current build pipeline handle runtime deps? |
| 3 | **Tarball format compatibility:** The .tgz is created by GNU tar on Ubuntu. Are there any GNU tar-specific extensions (pax headers, long-name encoding) that might trip up a JS library? | Could cause extraction failures on edge-case file names. | Low risk — the payload contains simple, short paths with no symlinks. Confirm in tech-research. |
| 4 | **Test infrastructure for .tgz creation:** Tests need to create representative .tgz payloads. Can this be done with the same JS tar library, or does the test need a different approach? | Affects test file structure and any additional dev dependencies. | Likely the same library can create test payloads; confirm in tech-research |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (continuation context) | Primary scope, requirements, acceptance criteria, and explicit decision constraints | Extraction-only fix; must remove tar binary dependency; preserve error contract; add test; explicit rejection of workarounds |
| `scout/scout-summary.md` | Codebase analysis, extraction flow location, dependency landscape, test infrastructure | Bug at perform.ts:124; only one tar invocation; zero runtime deps; node:test runner; no existing update tests |
| `scout/reference-map.json` | File inventory, facts, code boundaries, unknowns | 16 facts confirming root cause, staging paths, validation contract, error handling contract; 5 unknowns including library choice and tarball format nuances |
| `diagnosis/diagnosis-statement.md` | Root cause analysis, alternative hypothesis rejection, success criteria, change scope | Single root cause confirmed; recommends node-tar; 3 files changed; error contract preserved; cross-platform correctness required |
| `diagnosis/apl.json` | Structured Q&A with evidence citations | Confirmed colon interpretation is in GNU tar's parser (not shell escaping), --force-local is non-portable, node-tar v7+ is best fit |
| `repo-guidance.json` | Repo intent classification | helix-cli is the sole target; no cross-repo impact |

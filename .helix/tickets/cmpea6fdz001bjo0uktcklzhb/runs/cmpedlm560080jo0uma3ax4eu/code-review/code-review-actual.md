# Code Review Actual — BLD-527 (Continuation): Replace tar extraction with in-process JS library

## Review Scope

Reviewed the implementation that replaces the `execSync('tar -xzf ...')` call at `src/update/perform.ts` with an in-process `extractTarGz()` function in `src/update/extract.ts`. The review covered:

- Correctness of the manual tar parser (header parsing, typeflag handling, checksum validation, PAX header skipping)
- Path traversal protection (leading `/` strip, `..` component rejection, resolved path containment)
- Error contract preservation (throw → catch → `{ success: false, error }`)
- Robustness against corrupt/truncated input
- Test coverage completeness and correctness
- No remaining external tar binary invocations
- JSDoc/comment accuracy after the change
- No regression to existing functionality

## Files Reviewed

| File | Review Focus | Findings |
|------|-------------|----------|
| `src/update/extract.ts` (new, 148 lines) | Tar parser correctness, path safety, error handling, bounds checking | **Issue found:** Missing bounds check on data read — `subarray()` silently truncates if header claims more data than buffer holds. Fixed by adding bounds check at lines 127-131. |
| `src/update/perform.ts` (modified, 246 lines) | Integration with extractTarGz, error contract, JSDoc accuracy | **Issue found:** Stale JSDoc at line 73 still said "Extract via system `tar`". Fixed to "Extract in-process via extractTarGz (no external binary)". |
| `src/update/extract.test.ts` (new, 277→313 lines) | Test coverage, test helper correctness, edge case coverage | Tests are well-structured. Added test 6 for truncated tar entry to cover the new bounds check. |
| `src/update/validate.ts` (unchanged, 66 lines) | Post-extraction contract compatibility | No issues. `validateStaged` checks `dist/index.js`, `package.json`, runs `node --version`. These checks are compatible with the in-process extraction output. |
| `src/update/index.ts` (unchanged, 207 lines) | Caller error handling, fail-open/fail-closed behavior | No issues. `runUpdate()` exits non-zero on failure (fail-closed). `checkAutoUpdate()` logs warning and continues (fail-open). Both unchanged. |
| `package.json` (unchanged) | No new dependencies | Correct. Zero runtime deps maintained. Only `node:*` imports used. |
| `tsconfig.json` (unchanged) | Build config compatibility | Correct. ES2022 target, Node16 modules, strict mode — all compatible with the new code. |

## Missed Requirements & Issues Found

### Correctness/Behavior Issues

1. **Missing data bounds check in extract.ts (FIXED)**
   - **Location:** `src/update/extract.ts`, between lines 124 and 126 (before typeflag handling)
   - **Issue:** When reading file data at line 139 (`tar.subarray(dataStart, dataStart + size)`), there was no verification that `dataStart + size <= tar.length`. If a tar header claimed a data size larger than the remaining buffer (possible with corruption in the tar layer after successful gzip decompression), `subarray()` would silently return a truncated view. This could produce silently truncated files without raising an error — violating the fail-closed invariant.
   - **Risk:** Low likelihood (gunzipSync catches most corruption), but the consequence (silent data truncation) is severe for an update tool. A truncated `dist/index.js` would likely be caught by `validateStaged()` (which runs `node --version`), but other files like `build-metadata.json` could be silently truncated.
   - **Fix:** Added bounds check at lines 127-131 that throws a descriptive error: `Truncated tar entry "${entryName}": expected ${size} bytes at offset ${dataStart}, but archive is only ${tar.length} bytes`. Added test case 6 to validate this behavior.

### Code Quality/Robustness

2. **Stale JSDoc comment in perform.ts (FIXED)**
   - **Location:** `src/update/perform.ts`, line 73
   - **Issue:** The JSDoc said "Extract via system `tar`" but the implementation now uses in-process extraction. Misleading for future maintainers.
   - **Fix:** Changed to "Extract in-process via extractTarGz (no external binary)."

### Requirements Gaps

None. All ticket acceptance criteria are met:

| AC | Status | Evidence |
|----|--------|----------|
| 1. Windows with GNU tar → extraction succeeds | Met | In-process extraction eliminates external tar dependency entirely |
| 2. macOS/Linux → no regression | Met | Same output via platform-independent Node.js APIs |
| 3. No remaining external tar invocation | Met | `grep -rn 'execSync.*tar\|spawnSync.*tar' src/update/` → only JSDoc comment match |
| 4. Test exercises representative tarball | Met | 6 test cases covering CI-shaped tarball, colon-in-path, corrupt input, empty archive, PAX headers, truncated entry |
| 5. npm test, npm run build, --version pass | Met | 57/57 tests pass, build exits 0, version outputs `1.3.4` |

### Regression Risks

None identified. The change is fully isolated to the extraction step. The `extractTarGz` function is a new module consumed only by `performStagedUpdate`. All 51 pre-existing tests continue to pass.

### Verification/Test Gaps

None. Test coverage is comprehensive:
- Test 1: CI-shaped tarball with full content verification
- Test 2: Colon-in-path (original failure mode)
- Test 3: Corrupt tarball (throws)
- Test 4: Empty archive (graceful)
- Test 5: PAX extended headers (skipped correctly)
- Test 6: Truncated tar entry (throws — added by code review)

## Changes Made by Code Review

| # | File | Lines | Description |
|---|------|-------|-------------|
| 1 | `src/update/extract.ts` | 127-131 | Added bounds check: `if (size > 0 && dataStart + size > tar.length) throw new Error(...)`. Prevents silent data truncation on corrupt tar entries. |
| 2 | `src/update/perform.ts` | 73 | Fixed stale JSDoc: "Extract via system `tar`" → "Extract in-process via extractTarGz (no external binary)". |
| 3 | `src/update/extract.test.ts` | 279-313 | Added test case 6: "throws on truncated tar entry (header claims more data than exists)". Builds a tar with a header claiming 10000 bytes but only 512 bytes of data present. Asserts extractTarGz throws with "Truncated tar entry" message. |

## Remaining Risks / Deferred Items

1. **`copyDirRecursive` still shells out (perform.ts:34):** Uses `execSync('xcopy'/'cp -R')` for the EXDEV cross-filesystem fallback. Not a tar invocation — explicitly out of scope per acceptance criteria #3. Could be replaced with `fs.cpSync()` in a future pass.

2. **Path traversal `startsWith` without trailing separator (extract.ts:115):** The check `!fullPath.startsWith(resolvedDest)` technically matches prefix `resolvedDest` + any suffix. However, this is safe in practice because: (a) `..` components are rejected first (line 108), (b) leading `/` is stripped first (line 105), and (c) `path.resolve(base, relative)` with a safe relative path always produces a path under `base/`. The defense is correct but could be strengthened with `resolvedDest + path.sep` in a future hardening pass.

3. **Tar format edge cases:** The parser handles USTAR format with PAX headers. Exotic features (GNU long name extensions, sparse files) are not supported. These are not produced by our CI and would fail closed with a checksum mismatch error. No action needed.

## Verification Impact Notes

The code-review changes are additive (bounds check + test + comment fix). They do not alter the behavior for valid tarballs, only add a fail-fast path for corrupt data.

| Check ID | Impact | Status |
|----------|--------|--------|
| CHK-01 (Build) | No impact — new bounds check compiles cleanly | Still valid |
| CHK-02 (Tests) | Test count increased from 56 to 57 (new truncation test) — all pass | Still valid |
| CHK-03 (No tar invocation) | No impact — no new shell invocations added | Still valid |
| CHK-04 (CLI version) | No impact | Still valid |
| CHK-05 (Extraction tests) | Test count increased from 5 to 6 — all pass | Still valid, expanded |

## APL Statement Reference

Code review complete with two fixes applied. (1) Added a bounds check in extract.ts (lines 127-131) that throws on truncated tar entries where the header claims more data than exists in the buffer — this converts a silent data truncation into a visible error, preserving the fail-closed contract. Added a corresponding test case (test 6). (2) Fixed a stale JSDoc comment in perform.ts line 73 that still referenced "system tar" after the implementation replaced it with in-process extraction. All 57 tests pass, build succeeds, CLI version output works. No other issues found — the tar parser, path traversal protection, error handling, and test coverage are correct.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (continuation context) | Requirements, acceptance criteria, non-negotiable invariants | Extraction-only fix; fail-closed on errors; no external binary; test with colon-in-path |
| `implementation/implementation-actual.md` | Scope map of changed files and verification claims | 3 files changed (extract.ts, perform.ts, extract.test.ts); 5 tests; claims verified by direct code inspection |
| `implementation/apl.json` | Implementation structured evidence | Error contract claims verified against actual code |
| `implementation-plan/implementation-plan.md` | Intended design and verification plan | 4 steps; 5 checks (CHK-01 through CHK-05); all still valid after review |
| `tech-research/tech-research.md` | Architecture decision: built-in modules over node-tar | Key constraint: no node_modules in release tarball; built-in approach is only viable option |
| `diagnosis/diagnosis-statement.md` | Root cause analysis | GNU tar colon interpretation at perform.ts:124; single call-site replacement |
| `product/product.md` | Product spec, use cases, scope | Extraction-only change; error contract; fail-open/fail-closed behavior |
| `scout/reference-map.json` | File inventory and facts | Bug location, tarball shape, validation contract, zero runtime deps |
| `repo-guidance.json` | Repo intent | helix-cli is sole target; no cross-repo impact |
| `src/update/extract.ts` | Direct code review | Tar parser correctness, bounds check gap identified |
| `src/update/extract.test.ts` | Test coverage review | 5 test cases comprehensive; added 6th for truncation |
| `src/update/perform.ts` | Integration review | extractTarGz correctly wired; error contract preserved; stale JSDoc found |
| `src/update/validate.ts` | Post-extraction contract | Checks dist/index.js, package.json, node --version — compatible with in-process extraction output |
| `src/update/index.ts` | Caller error handling | fail-closed (exit 1) and fail-open (warn+continue) preserved |
| `package.json` | Dependencies, build scripts | Zero runtime deps maintained; ESM; tsc-only build |
| `tsconfig.json` | Build configuration | ES2022, Node16 modules, strict — compatible with new code |

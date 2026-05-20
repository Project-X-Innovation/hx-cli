# Implementation Plan — BLD-527 (Continuation): Replace tar extraction with in-process JS library

## Overview

Replace the `execSync('tar -xzf ...')` call at `src/update/perform.ts:124` with an in-process tar extraction function using only Node.js built-in modules (`node:zlib`, `node:fs`, `node:path`). This eliminates the external `tar` binary dependency that causes `hlx update` to fail on Windows when GNU tar (from Git for Windows) is first in PATH. The approach preserves the project's zero-dependency design and requires no build system or CI workflow changes.

**Files changed:** `src/update/extract.ts` (new), `src/update/extract.test.ts` (new), `src/update/perform.ts` (modified).
**Files NOT changed:** `package.json`, `tsconfig.json`, `validate.ts`, `index.ts`, `check.ts`, `version.ts`, `.github/workflows/build-release.yml`.

## Implementation Principles

1. **Minimal change surface**: Only the extraction block in `perform.ts` (lines 122-131) is replaced. The download, validation, swap, and cleanup stages are untouched.
2. **Zero new dependencies**: Use `node:zlib` (gunzipSync) for decompression and manual tar header parsing for extraction. The release tarball has no `node_modules/`, so npm packages would fail to resolve at runtime — this is why the diagnosis recommendation of node-tar was revised by tech-research.
3. **Preserve error contract**: `extractTarGz()` throws on error; the existing try/catch in `performStagedUpdate` catches it and returns `{ success: false, error }`. No change to the function signature or callers.
4. **Separation of concerns**: Extraction logic goes in a new `src/update/extract.ts` file for testability, keeping `perform.ts` focused on orchestration.
5. **Synchronous approach**: Matches the existing synchronous `execSync` pattern. The payload is small (< 5MB compressed, < 15MB uncompressed) so buffer-based processing is appropriate.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Create the in-process tar extraction function | `src/update/extract.ts` |
| 2 | Replace the `execSync` tar call in `perform.ts` with the new function | Modified `src/update/perform.ts` |
| 3 | Create extraction tests with representative tarball payloads | `src/update/extract.test.ts` |
| 4 | Run quality gates to verify build, type-check, and tests pass | Passing `npm run build`, `npm test` |

## Detailed Implementation Steps

### Step 1: Create `src/update/extract.ts`

**Goal:** Implement a synchronous, in-process tar extraction function that handles `.tgz` files without invoking any external binary.

**What to Build:**

Create a new file `src/update/extract.ts` with a single exported function:

```
export function extractTarGz(tarballPath: string, destDir: string): void
```

The function must:

1. **Read** the `.tgz` file with `readFileSync(tarballPath)`.
2. **Decompress** with `gunzipSync(compressed)` from `node:zlib` to get a raw tar `Buffer`.
3. **Parse tar entries** in a loop over 512-byte blocks:
   - Read the 512-byte header block at the current offset.
   - If the block is all zeros, check the next block — two consecutive zero blocks mark end-of-archive; stop parsing.
   - Parse header fields from the block:
     - `name`: bytes 0-99 (null-terminated ASCII string).
     - `size`: bytes 124-135 (octal ASCII number).
     - `typeflag`: byte 156 (single character: `'0'` or `'\0'` = regular file, `'5'` = directory, `'x'` or `'g'` = PAX extended header).
     - `prefix`: bytes 345-499 (USTAR prefix; if non-empty, full path is `prefix + '/' + name`).
   - **Directory** (typeflag `'5'`): `mkdirSync(fullPath, { recursive: true })`.
   - **Regular file** (typeflag `'0'` or `'\0'`): Ensure parent directory exists via `mkdirSync(dirname(fullPath), { recursive: true })`, then `writeFileSync(fullPath, tarBuffer.subarray(dataStart, dataStart + size))`.
   - **PAX header** (typeflag `'x'` or `'g'`): Skip the data blocks (advance offset) and continue to next entry.
   - Advance offset past data blocks, padded to 512-byte boundary: `Math.ceil(size / 512) * 512`.
4. **Path traversal protection**: Resolve the target path with `path.resolve(destDir, entryName)` and verify it starts with `path.resolve(destDir)`. Also strip leading `/` from entry names and reject entries containing `..` path components.

**Imports**: Only `node:zlib`, `node:fs`, `node:path` — no third-party modules.

The function throws on any error (corrupt tarball, IO failure, path traversal). The existing try/catch in `performStagedUpdate` (perform.ts:128-131) handles conversion to `{ success: false, error }`.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- `src/update/extract.ts` exists with `extractTarGz` exported.
- Only `node:*` imports used.
- Compiles with `tsc --noEmit`.

---

### Step 2: Replace `execSync` tar call in `src/update/perform.ts`

**Goal:** Wire the new `extractTarGz` function into the staged-update flow, replacing the shell-based tar extraction at line 124.

**What to Build:**

Modify `src/update/perform.ts` with these changes only:

1. **Add import** near the top of the file (after existing imports):
   ```typescript
   import { extractTarGz } from "./extract.js";
   ```

2. **Replace the extraction block** (current lines 122-131) from:
   ```typescript
   // ---- Extract ----
   try {
     execSync(`tar -xzf "${tarballPath}" -C "${stagingDir}"`, {
       stdio: "pipe",
       timeout: 30_000,
     });
   } catch (err: unknown) {
     const msg = err instanceof Error ? err.message : String(err);
     return { success: false, error: `Extraction failed: ${msg}` };
   }
   ```
   To:
   ```typescript
   // ---- Extract ----
   try {
     extractTarGz(tarballPath, stagingDir);
   } catch (err: unknown) {
     const msg = err instanceof Error ? err.message : String(err);
     return { success: false, error: `Extraction failed: ${msg}` };
   }
   ```

3. **Keep the `execSync` import** on line 1 — it is still used by `copyDirRecursive` at line 33 for the EXDEV cross-filesystem fallback. This is not a tar invocation and is out of scope per acceptance criteria #3.

4. **No other changes** to `perform.ts`. The function signature, error contract, and all other stages (download, validate, swap, cleanup) remain identical.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
grep -n "execSync.*tar" src/update/perform.ts
# Should return no results — the only execSync usage remaining is for copyDirRecursive
```

**Success Criteria:**
- The `execSync('tar -xzf ...')` call is replaced with `extractTarGz(tarballPath, stagingDir)`.
- The try/catch error handling structure is preserved exactly.
- The `execSync` import remains (needed for `copyDirRecursive`).
- No tar invocation remains in the file.
- Compiles with `tsc --noEmit`.

---

### Step 3: Create `src/update/extract.test.ts`

**Goal:** Add test coverage for the extraction function, including a test that validates the original Windows GNU tar failure mode (paths with special characters) is eliminated.

**What to Build:**

Create `src/update/extract.test.ts` following the project's established test patterns (observed in `src/skill/skill.test.ts`):
- `node:test` (describe/it)
- `node:assert` (strict)
- `mkdtempSync(join(tmpdir(), 'prefix-'))` for isolated temp directories
- `afterEach(() => rmSync(tmpDir, { recursive: true, force: true }))` for cleanup

Include a **test helper function** that programmatically creates `.tgz` payloads:
- Build tar blocks manually: 512-byte header (name, size, typeflag, checksum) + data blocks padded to 512 bytes + two zero terminator blocks.
- Wrap in `gzipSync()` from `node:zlib`.
- Write to a temp file for `extractTarGz()` to consume.

**Test cases (5 total):**

1. **Successful extraction of representative tarball**: Create a `.tgz` with the CI payload structure (`dist/index.js` with content, `skill-content/SKILL.md`, `package.json`, `build-metadata.json`). Extract to a temp directory. Assert all expected files and directories exist with correct content. This validates the extraction produces the same layout that `validateStaged()` expects.

2. **Extraction to path with colon (original failure mode)**: Create a temp directory with a colon in the name (e.g., `staging:test`) on platforms where this is valid (macOS/Linux). On Windows, use another special character. Call `extractTarGz()` with this path as destDir. Assert extraction succeeds. This directly validates that the original GNU tar failure mode — `C:` interpreted as a remote host — is eliminated because the extraction no longer invokes an external binary.

3. **Corrupt tarball handling**: Write random/garbage bytes to a `.tgz` file. Call `extractTarGz()`. Assert it throws an error. This validates the error contract — `performStagedUpdate` catches the throw and returns `{ success: false, error }`.

4. **Empty archive**: Create a valid `.tgz` containing only two consecutive 512-byte zero blocks (end-of-archive marker). Extract. Assert no error and the destination directory is empty (no files created).

5. **PAX extended header handling**: Create a tarball with a PAX extended header entry (typeflag `'x'`) before a regular file entry. Extract. Assert the regular file is extracted correctly and the PAX header data is skipped without error.

**Verification (AI Agent Runs):**
```bash
npm test
```

**Success Criteria:**
- All 5 test cases pass.
- Tests use only `node:*` imports.
- Temp directories are cleaned up in `afterEach`.
- The colon-in-path test covers the original failure mode.

---

### Step 4: Run quality gates

**Goal:** Confirm the full build, type-check, and test suite pass end-to-end with no regressions.

**What to Build:** No new code. Run existing quality gates.

**Verification (AI Agent Runs):**
```bash
npm run build
npm test
node dist/index.js --version
```

**Success Criteria:**
- `npm run build` (tsc) exits 0.
- `npm test` (tsc + node --test) exits 0 with all tests passing (including existing `flags.test.ts`, `resolve-ticket.test.ts`, `skill.test.ts`).
- `node dist/index.js --version` produces output containing a version string.

---

## Verification Plan

### Pre-conditions

| # | Dependency | Status | Source/Evidence | Affects checks |
|---|-----------|--------|----------------|----------------|
| 1 | Node.js >= 18 installed | available | `package.json` engines field `>=18`; sandbox environment | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| 2 | npm installed | available | Required for `npm run build` / `npm test` | CHK-01, CHK-02, CHK-03 |
| 3 | TypeScript compiler available via devDependencies | available | `package.json` devDependencies: `typescript: ^6.0.2` | CHK-01, CHK-02, CHK-03 |
| 4 | Repository cloned with all source files | available | Workspace at `/vercel/sandbox/workspaces/cmpedlm560080jo0uma3ax4eu/helix-cli` | CHK-01 through CHK-05 |
| 5 | `npm ci` or `npm install` run before quality gates | unknown | May need to run before checks; `npm ci` installs devDependencies | CHK-01, CHK-02, CHK-03 |

### Required Checks

[CHK-01] **TypeScript build passes and new files are generated**
- Action: Run `npm run build` in the helix-cli repository root.
- Expected Outcome: The command exits with code 0. No type errors. `dist/update/extract.js` and `dist/update/extract.test.js` are generated alongside the updated `dist/update/perform.js`.
- Required Evidence: Full command output showing successful compilation with exit code 0. Output of `ls dist/update/extract.js dist/update/extract.test.js dist/update/perform.js` confirming all three files exist.

[CHK-02] **All tests pass including new extraction tests**
- Action: Run `npm test` in the helix-cli repository root.
- Expected Outcome: The command exits with code 0. All test files pass, including the new `extract.test.js` with all 5 test cases (successful extraction, colon-in-path, corrupt tarball, empty archive, PAX header handling). Existing tests (`flags.test.js`, `resolve-ticket.test.js`, `skill.test.js`) continue to pass.
- Required Evidence: Full `npm test` output showing all test files and individual test case pass/fail status. Zero failures or errors.

[CHK-03] **No external tar invocation remains in the update module**
- Action: Run targeted grep searches across `src/update/` for tar-related shell invocations and verify `src/update/extract.ts` uses only built-in imports.
- Expected Outcome: (a) No match for `execSync` combined with `tar` anywhere in `src/update/`. (b) The only `execSync` usage in `src/update/perform.ts` is in the `copyDirRecursive` function (around line 33) for the EXDEV xcopy/cp-R fallback. (c) `src/update/extract.ts` contains only `node:*` imports (no third-party bare specifier imports).
- Required Evidence: Output of `grep -rn "execSync.*tar\|spawnSync.*tar" src/update/` showing zero matches. Output of `grep -n "execSync" src/update/perform.ts` showing only the copyDirRecursive usage. Output of `grep -n "^import" src/update/extract.ts` showing only `node:zlib`, `node:fs`, and/or `node:path` imports.

[CHK-04] **CLI version command works after build**
- Action: Run `node dist/index.js --version` in the helix-cli repository root after a successful build.
- Expected Outcome: The command exits with code 0 and produces output containing a version string.
- Required Evidence: Command output showing the version string and exit code 0.

[CHK-05] **Extraction test suite validates the original failure mode**
- Action: Run `node --test dist/update/extract.test.js` in the helix-cli repository root after building.
- Expected Outcome: All 5 extraction test cases pass: (1) representative CI-shaped tarball extracts correctly with `dist/index.js`, `package.json`, `build-metadata.json`, and `skill-content/` present and content-correct, (2) extraction to a path containing a colon succeeds without error (validating the original GNU tar `C:` remote-host failure mode is eliminated), (3) corrupt tarball input causes the function to throw an error, (4) empty archive is handled gracefully with no files created, (5) PAX extended headers are skipped and the subsequent file entry is extracted correctly.
- Required Evidence: Full test output from `node --test dist/update/extract.test.js` showing each individual test case name and its pass/fail status. All 5 must show pass.

## Success Metrics

1. The extraction step in `src/update/perform.ts` uses `extractTarGz()` from `src/update/extract.ts` instead of `execSync('tar ...')`.
2. `src/update/extract.ts` uses only `node:*` built-in module imports — zero third-party dependencies.
3. All 5 extraction test cases in `src/update/extract.test.ts` pass.
4. `npm run build` and `npm test` exit 0 with zero failures.
5. `node dist/index.js --version` produces version output.
6. No external tar invocation remains in any `src/update/` file.
7. The `execSync` import in `perform.ts` is retained only for `copyDirRecursive` (EXDEV fallback) — not for any tar operation.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (continuation context) | Scope, acceptance criteria, explicit constraints | Extraction-only fix; remove tar binary dependency; preserve error contract; add test; no CI changes |
| `scout/reference-map.json` | File inventory, code boundaries, facts | Bug at perform.ts:124; 3 other non-tar child_process calls; tarball shape; validation contract; zero runtime deps |
| `scout/scout-summary.md` | Analysis summary | Extraction flow isolated to lines 122-131; error handling contract; test infrastructure patterns |
| `diagnosis/diagnosis-statement.md` | Root cause analysis, success criteria | GNU tar colon interpretation is root cause; single call-site replacement; error contract preserved |
| `diagnosis/apl.json` | Structured evidence for root cause | Colon interpretation is intrinsic to GNU tar parser; --force-local is non-portable; only one tar invocation |
| `product/product.md` | Product spec, use cases, open questions | Open Q#2 about runtime dep resolution answered by tech-research |
| `tech-research/tech-research.md` | Architecture decision, API design, test strategy | node-tar rejected (no node_modules in release tarball); built-in modules chosen; sync buffer approach; PAX/USTAR handling; path traversal protection; 5 test cases defined |
| `tech-research/apl.json` | Structured tech decisions with evidence | Confirmed bare specifier imports fail without node_modules; built-in approach is only viable option |
| `repo-guidance.json` | Repo intent | helix-cli is sole target; no cross-repo impact |
| `src/update/perform.ts` (lines 1-247) | Direct inspection of bug and orchestration flow | execSync tar at line 124; error catch at 128-131; copyDirRecursive at line 33 also uses execSync; import.meta.url at line 24 |
| `src/update/validate.ts` (lines 1-66) | Post-extraction contract | Checks dist/index.js, package.json, runs node --version — defines what extraction output must look like |
| `src/update/index.ts` (lines 1-207) | Caller error handling | Manual: exit(1) + recovery msg at line 113; Auto: log warning at line 203 |
| `package.json` (full) | Dependency and build constraints | Zero runtime deps; ESM; tsc-only build; node:test runner; Node >=18 |
| `tsconfig.json` (full) | Build config | ES2022 target, Node16 modules, strict, output to dist/ |
| `.github/workflows/build-release.yml` (lines 1-60) | Tarball shape confirmation | Lines 37-43: top-level dist/, skill-content/, package.json, build-metadata.json; no node_modules/ |
| `src/skill/skill.test.ts` (lines 1-289) | Test pattern reference | node:test describe/it; node:assert strict; mkdtempSync; beforeEach/afterEach cleanup |

# Implementation Actual — BLD-527 (Continuation): Replace tar extraction with in-process JS library

## Summary of Changes

Replaced the `execSync('tar -xzf ...')` call at `src/update/perform.ts:124` with a new in-process `extractTarGz()` function in `src/update/extract.ts` that uses only Node.js built-in modules (`node:zlib`, `node:fs`, `node:path`). This eliminates the dependency on an external `tar` binary that caused `hlx update` to fail on Windows when GNU tar (from Git for Windows) is first in PATH — GNU tar interprets drive-letter colons (`C:`) as remote-host syntax. Added 5 targeted tests covering representative extraction, the original failure mode (colon-in-path), corrupt input, empty archives, and PAX extended headers. Zero third-party dependencies added. Error contract preserved exactly.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/update/extract.ts` | **New.** In-process tar extraction function using `node:zlib` (gunzipSync) and manual tar header parsing. Handles USTAR format, PAX extended headers, checksum validation, and path traversal protection. | **New shared utility** — consumed by `perform.ts`. Core of the bug fix. Tar parsing logic (~140 lines) is security-relevant (path traversal checks at lines 107-119). |
| `src/update/perform.ts` | **Modified.** Replaced `execSync('tar -xzf ...')` at line 124 with `extractTarGz(tarballPath, stagingDir)`. Added import for `extractTarGz`. Error handling structure (try/catch returning `{ success: false, error }`) preserved exactly. | **Critical path** — this is the staged-update orchestration. Only the extraction block (lines 123-129) changed. The `execSync` import is retained for `copyDirRecursive` (line 34, EXDEV fallback). |
| `src/update/extract.test.ts` | **New.** 5 test cases using programmatic tarball creation (no fixture files). Covers: (1) CI-shaped tarball extraction with content verification, (2) colon-in-path destination (original GNU tar failure mode), (3) corrupt tarball throws, (4) empty archive handled gracefully, (5) PAX extended header skipping. | Tests use only `node:*` imports. `createTestTarGz()` helper builds valid USTAR tarballs with correct checksums. |

## Steps Executed

### Step 1: Create `src/update/extract.ts`

Created `src/update/extract.ts` with a single exported function `extractTarGz(tarballPath: string, destDir: string): void` that:
1. Reads the `.tgz` file with `readFileSync`
2. Decompresses with `gunzipSync` to get raw tar buffer
3. Parses tar entries in a loop over 512-byte blocks:
   - Reads header fields: name (bytes 0-99), size (bytes 124-135), typeflag (byte 156), prefix (bytes 345-499)
   - Validates checksums (bytes 148-155) against computed sum
   - Handles typeflags: `'5'` (directory), `'0'`/`'\0'` (regular file), `'x'`/`'g'` (PAX headers — skipped)
   - Detects end-of-archive via two consecutive 512-byte zero blocks
4. Includes path traversal protection: strips leading `/`, rejects `..` components, validates resolved path starts with destination

### Step 2: Replace `execSync` tar call in `src/update/perform.ts`

Modified `src/update/perform.ts` with two changes:
1. Added `import { extractTarGz } from "./extract.js";` at line 14
2. Replaced the extraction block (originally lines 122-131) from `execSync('tar -xzf ...')` to `extractTarGz(tarballPath, stagingDir)` inside the same try/catch structure

The `execSync` import at line 1 is retained because `copyDirRecursive` at line 34 still uses it for the EXDEV cross-filesystem fallback. This is not a tar invocation.

### Step 3: Create `src/update/extract.test.ts`

Created 5 test cases following the project's established patterns (`node:test` describe/it, `node:assert` strict, `mkdtempSync` for isolation, `afterEach` cleanup):

1. **Representative CI tarball**: Creates a `.tgz` with `dist/index.js`, `dist/update/perform.js`, `skill-content/SKILL.md`, `package.json`, `build-metadata.json`. Verifies all files exist with correct content.
2. **Colon-in-path (original failure mode)**: Extracts to a directory named `staging:test` (on non-Windows). This directly validates the original GNU tar failure is eliminated.
3. **Corrupt tarball**: Passes garbage bytes. Asserts `extractTarGz` throws (which `performStagedUpdate` catches and converts to `{ success: false, error }`).
4. **Empty archive**: Creates a valid `.tgz` with only end-of-archive markers. Verifies no error and no files created.
5. **PAX extended headers**: Creates a tarball with a PAX header entry (typeflag `'x'`) before a regular file. Verifies the file is extracted and the PAX header data is skipped.

### Step 4: Run quality gates

Ran `npm run build`, `npm test`, and `node dist/index.js --version` to confirm all pass.

## Verification Commands Run + Outcomes

| Command | Exit Code | Result |
|---------|-----------|--------|
| `npx tsc --noEmit` | 0 | No type errors |
| `npm run build` | 0 | Compiled to dist/; `dist/update/extract.js` and `dist/update/extract.test.js` generated |
| `npm test` | 0 | 56 tests passed (51 existing + 5 new), 0 failed |
| `node dist/index.js --version` | 0 | Output: `1.3.4` |
| `node --test dist/update/extract.test.js` | 0 | 5 tests passed, 0 failed |
| `grep -rn 'execSync.*tar\|spawnSync.*tar' src/update/` | 0 matches (code) | Only match is a JSDoc comment in extract.ts:55 describing the prior implementation |
| `grep -n 'execSync' src/update/perform.ts` | 2 matches | Line 1 (import) and line 34 (copyDirRecursive) — no tar usage |
| `grep -n '^import' src/update/extract.ts` | 3 lines | Only `node:zlib`, `node:fs`, `node:path` — zero third-party imports |
| `ls dist/update/extract.js dist/update/extract.test.js dist/update/perform.js` | 0 | All three files exist |

## Test/Build Results

- **TypeScript typecheck:** PASS — zero errors
- **Build:** PASS — `tsc` compiled to `dist/`
- **Tests:** PASS — 56/56 tests passed (flags: 14, resolve-ticket: 18, skill: 19, extract: 5)
- **CLI --version:** PASS — outputs `1.3.4`

## Deviations from Plan

None. Implementation follows the plan exactly in all four steps.

## Known Limitations / Follow-ups

1. **`copyDirRecursive` still shells out (perform.ts:33):** Uses `execSync('xcopy'/'cp -R')` for the EXDEV fallback. Not a tar invocation — explicitly out of scope per acceptance criteria #3. Could be replaced with `fs.cpSync()` (stable since Node 16.7) in a future pass.
2. **No end-to-end update test with real GitHub release:** The extraction tests validate the parsing and file-writing behavior. A full end-to-end test of `hlx update` against a live release requires CI infrastructure, which is outside this ticket's scope.
3. **Tar format edge cases:** The parser handles the exact features present in our CI-produced tarballs (USTAR format, short paths, PAX headers). Exotic tar features (GNU long name extensions, sparse files, extended attributes) are not handled — these are not produced by our CI and would fail closed with a checksum mismatch error.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | **pass** | `npm run build` exits 0. `ls dist/update/extract.js dist/update/extract.test.js dist/update/perform.js` confirms all three files exist. |
| CHK-02 | **pass** | `npm test` exits 0. Output shows 56 tests, 56 pass, 0 fail. All 5 new `extractTarGz` tests pass alongside all 51 existing tests. |
| CHK-03 | **pass** | `grep -rn 'execSync.*tar\|spawnSync.*tar' src/update/` — only a JSDoc comment match, no code invocations. `grep -n execSync src/update/perform.ts` shows only line 1 (import) and line 34 (copyDirRecursive). `grep -n '^import' src/update/extract.ts` shows only `node:zlib`, `node:fs`, `node:path`. |
| CHK-04 | **pass** | `node dist/index.js --version` exits 0, outputs `1.3.4`. |
| CHK-05 | **pass** | `node --test dist/update/extract.test.js` output shows all 5 tests pass: representative tarball, colon-in-path, corrupt input, empty archive, PAX header handling. |

All 5 required checks pass. Self-verification is complete.

## APL Statement Reference

Implementation complete. The `execSync` tar call at `perform.ts:124` has been replaced with an in-process `extractTarGz` function using only Node.js built-in modules (`node:zlib`, `node:fs`, `node:path`). This eliminates the dependency on any external tar binary, resolving the Windows GNU tar failure where drive-letter colons are interpreted as remote-host syntax. The error contract is preserved exactly. Five test cases cover representative extraction, colon-in-path (original failure mode), corrupt input, empty archive, and PAX header handling. All 56 tests pass, the build succeeds, and no third-party dependencies were added. `package.json` is unchanged — zero runtime dependencies maintained.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (continuation context) | Scope, requirements, acceptance criteria, explicit constraints | Extraction-only fix; remove tar binary dependency; preserve error contract; add test; no CI changes |
| `implementation-plan/implementation-plan.md` | Step-by-step implementation guide and verification plan | 4 steps: extract.ts, perform.ts modification, extract.test.ts, quality gates; 5 verification checks |
| `diagnosis/diagnosis-statement.md` | Root cause analysis | GNU tar colon interpretation is root cause at perform.ts:124; single call-site replacement |
| `tech-research/tech-research.md` | Architecture decision | node-tar rejected (no node_modules in release tarball); built-in modules chosen; sync buffer approach |
| `scout/reference-map.json` | File inventory and evidence | Bug at perform.ts:124; 3 other non-tar child_process calls; tarball shape; validation contract |
| `product/product.md` | Product spec | Open Q#2 about runtime dep answered by tech-research |
| `src/update/perform.ts` (lines 1-247) | Direct inspection of bug and orchestration | execSync tar at line 124; error catch at 128-131; copyDirRecursive at line 33 |
| `src/skill/skill.test.ts` (lines 1-50) | Test pattern reference | node:test describe/it; node:assert strict; mkdtempSync; afterEach cleanup |
| `package.json` | Dependency and build constraints | Zero runtime deps; ESM; tsc-only build; node:test runner |
| `tsconfig.json` | Build config | ES2022 target, Node16 modules, strict, output to dist/ |

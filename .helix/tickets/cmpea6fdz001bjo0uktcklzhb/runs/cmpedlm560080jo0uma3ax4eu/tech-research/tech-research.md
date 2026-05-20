# Tech Research — BLD-527 (Continuation): Replace tar extraction with in-process JS library

## Technology Foundation

- **Runtime**: Node.js >= 18 (declared in `package.json` engines)
- **Module system**: ESM (`"type": "module"`, ES2022 target, Node16 resolution)
- **Build**: TypeScript 6.x compiled via `tsc` to `dist/`
- **Test runner**: Node.js built-in `node:test` (describe/it) + `node:assert` (strict)
- **Current runtime dependencies**: Zero — entire codebase uses only `node:*` built-in modules and relative path imports
- **Release tarball contents**: `dist/`, `skill-content/`, `package.json`, `build-metadata.json` only (no `node_modules/`)

## Architecture Decision

### Problem

The extraction step at `src/update/perform.ts:124` uses `execSync('tar -xzf ...')` which fails on Windows when GNU tar (from Git for Windows) is first in PATH. GNU tar interprets drive-letter colons (`C:\...`) as remote-host syntax. The fix must replace this with in-process extraction.

### Critical Constraint Discovered: No `node_modules/` in Release Tarball

Evidence collected in this step reveals a constraint that was not addressed in the diagnosis:

1. **Every import in the entire codebase** is from `node:*` built-in modules or relative paths — zero third-party imports (confirmed via grep of all `src/` imports).
2. **The CI workflow** (`.github/workflows/build-release.yml:37-43`) creates the tarball with only `dist/`, `skill-content/`, `package.json`, `build-metadata.json` — no `node_modules/`.
3. **No bundler** is used — the build step is solely `tsc` (TypeScript compiler), which produces individual `.js` files that reference external packages via bare specifiers (e.g., `import { x } from 'tar'`).
4. **GitHub-release-installed copies** have no `node_modules/` directory, so bare specifier imports would fail at runtime with `ERR_MODULE_NOT_FOUND`.

This means adding an npm package like `tar` (node-tar) as a `dependencies` entry in `package.json` would **not resolve at runtime** for the primary install path (GitHub release) without either: (a) bundling the dependency into `dist/` using a tool like esbuild, or (b) including `node_modules/` in the release tarball (CI workflow change, explicitly out of scope).

### Options Considered

#### Option A: `tar` (node-tar) as runtime dependency — REJECTED

Add `tar` (isaacs/node-tar v7.5+) to `dependencies`. Replace `execSync` with `tar.x({ file: tarballPath, C: stagingDir })`.

**Pros:**
- Battle-tested — used by npm itself for all package extraction
- TypeScript-native (rewritten in TS for v7), ESM/CJS hybrid via tshy
- Security-hardened against filesystem-based attacks
- High-level API: `tar.x({ file, C })` is a near drop-in replacement for `execSync('tar -xzf ... -C ...')`
- Runtime deps are all pure JS: @isaacs/fs-minipass, chownr, minipass, minizlib, yallist

**Cons — CRITICAL:**
- **Runtime resolution failure**: The compiled output would contain `import { extract } from 'tar'`. Node.js resolves bare specifiers via `node_modules/`. The release tarball has no `node_modules/`. For GitHub-release-installed copies (the primary install path), the import would fail with `ERR_MODULE_NOT_FOUND`.
- To fix the resolution, we would need either:
  - **(a) Bundle with esbuild**: Add esbuild as devDep, change the build script to inline `tar` into dist output. Risks: esbuild may break `import.meta.url` (used at `perform.ts:24` for install root resolution); changes the build architecture beyond the extraction fix scope.
  - **(b) Include `node_modules/tar` in the tarball**: Requires CI workflow file change (`.github/workflows/build-release.yml`), which is explicitly out of scope.
- Adds 5 transitive runtime dependencies to a zero-dependency project
- Breaks the project's established zero-dependency pattern

#### Option B: `tar-stream` + manual file writing — REJECTED

Use tar-stream (mafintosh/tar-stream, Context7 benchmark 90.6) for streaming tar parsing, paired with `node:zlib` for gzip and manual `node:fs` calls for file writing.

**Pros:**
- Lower-level streaming API, well-maintained
- High Context7 reputation

**Cons:**
- Same runtime resolution blocker as Option A (no `node_modules/` in release tarball)
- Requires manual gzip pipe (`createGunzip()` → tar-stream extractor)
- Requires manual directory creation and file writing per entry
- Significantly more implementation code than node-tar's high-level API
- Two packages needed (tar-stream for parsing, manual code for fs operations)

#### Option C: Node.js built-in modules — `node:zlib` + manual tar parsing — CHOSEN

Implement extraction entirely with Node.js built-in modules: `node:zlib` for gzip decompression, manual tar header parsing for file/directory extraction, `node:fs` for writing.

**Pros:**
- **Zero new dependencies** — preserves the project's zero-dependency design
- **No build system changes** — `tsc` remains the only build step
- **No CI changes** — tarball shape and workflow are completely unmodified
- **No runtime resolution issues** — only `node:*` imports, always available in any Node.js environment
- **Smallest change surface** — new helper function + replacement of one execSync call
- **Platform-independent by design** — no external binary, no PATH dependency, no path-quoting issues
- **Consistent with codebase patterns** — all 50+ existing imports are `node:*` or relative paths

**Cons:**
- Implements tar parsing (~60-80 lines) rather than using a library
- Less battle-tested than node-tar for general tar edge cases
- No third-party security hardening for path traversal

**Mitigations for cons:**
- The tarball is created by our own CI from known, simple content: short paths (longest: ~30 chars), no symlinks, no special attributes, no long filenames. Exotic tar format edge cases are not a realistic concern.
- Path traversal protection is straightforward: resolve target path and verify it starts with the destination directory. This is a 3-line check.
- Comprehensive test coverage validates the parser against representative payloads including error cases.

### Chosen Option: C — Node.js built-in modules

**Rationale:** Option C is the only approach that works within all project constraints simultaneously:

| Constraint | Option A (node-tar) | Option B (tar-stream) | Option C (built-in) |
|-----------|---------------------|----------------------|---------------------|
| No external binary | Yes | Yes | Yes |
| Resolves at runtime (no node_modules) | **No** | **No** | Yes |
| No build system changes | **No** (needs bundler) | **No** (needs bundler) | Yes |
| No CI workflow changes | Yes | Yes | Yes |
| Zero new dependencies | No (6 transitive) | No (3+ transitive) | Yes |
| Consistent with codebase patterns | No (first 3rd-party import) | No (first 3rd-party import) | Yes |

Options A and B both fail the runtime resolution constraint because the release tarball does not include `node_modules/`. Resolving this requires either bundling (build system change) or CI changes — both exceed the stated scope. Option C leverages the same `node:*`-only import pattern used throughout the entire codebase.

## Core API/Methods

### New function: `extractTarGz(tarballPath: string, destDir: string): void`

**Location**: New file `src/update/extract.ts` (preferred for testability and separation of concerns)

**Approach — synchronous buffer-based parsing:**
1. Read the `.tgz` file: `readFileSync(tarballPath)`
2. Decompress: `gunzipSync(compressed)` to get raw tar data as a `Buffer`
3. Parse tar entries in a loop over 512-byte blocks:
   - Read 512-byte header block at current offset
   - If block is all zeros, check next block — two consecutive zero blocks mark end of archive
   - Parse header fields:
     - `name`: bytes 0-99 (null-terminated ASCII string)
     - `prefix`: bytes 345-499 (USTAR prefix, prepended to name with `/` separator)
     - `size`: bytes 124-135 (octal ASCII number)
     - `typeflag`: byte 156 (single character: `'0'`/`'\0'` = file, `'5'` = directory, `'x'` = PAX extended header, `'g'` = global PAX header)
   - **Typeflag `'5'` (directory)**: `mkdirSync(fullPath, { recursive: true })`
   - **Typeflag `'0'` or `'\0'` (regular file)**: Ensure parent directory exists, write `size` bytes of data from the next blocks
   - **Typeflag `'x'` or `'g'` (PAX headers)**: Skip `size` bytes of data, then continue to next entry
   - Advance offset past data blocks (padded to 512-byte boundary: `Math.ceil(size / 512) * 512`)
4. **Path safety**: Resolve the target path with `path.resolve(destDir, entryName)` and verify it starts with `path.resolve(destDir)` — reject path traversal attempts

### Modified call site in `performStagedUpdate`

Replace the extraction block at `src/update/perform.ts` lines 122-131:

```
// Current (lines 122-131):
try {
  execSync(`tar -xzf "${tarballPath}" -C "${stagingDir}"`, {
    stdio: "pipe", timeout: 30_000,
  });
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { success: false, error: `Extraction failed: ${msg}` };
}

// Replacement:
try {
  extractTarGz(tarballPath, stagingDir);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { success: false, error: `Extraction failed: ${msg}` };
}
```

The error-handling structure (catch -> return `{ success: false, error }`) is preserved exactly. The `extractTarGz` function throws on error, which is caught by the existing try/catch.

### Import changes in `perform.ts`

- Add: `import { extractTarGz } from "./extract.js";`
- The `execSync` import at line 1 **must remain** because `copyDirRecursive` (line 33) still uses it for the EXDEV fallback. This is not a tar invocation and is explicitly out of scope per acceptance criteria #3.

## Technical Decisions

### Decision 1: Synchronous vs streaming extraction

**Chosen: Synchronous** (`readFileSync` + `gunzipSync` + buffer parsing)

Rationale:
- The existing extraction code is synchronous (`execSync` with a 30s timeout)
- The tarball is small: CLI payload is < 5MB compressed, < 15MB uncompressed
- `gunzipSync` + buffer-based tar parsing is simpler than setting up a streaming pipeline with proper error handling
- No memory concern: a 15MB buffer is trivial for Node.js (V8 heap default is 1.5GB+)
- Maintains the same blocking behavior as the original code

Rejected alternative: Streaming pipeline (`createReadStream` -> `createGunzip` -> transform stream). Adds significant complexity (stream error propagation, backpressure handling) with no benefit for this payload size.

### Decision 2: Separate file vs inline function

**Chosen: New file `src/update/extract.ts`**

Rationale:
- Easier to unit test in isolation: import `extractTarGz` directly without mocking the full update flow
- Keeps `perform.ts` focused on orchestration (download -> extract -> validate -> swap -> cleanup)
- The tar parsing logic is self-contained (~60-80 lines) and logically distinct
- Test file becomes `src/update/extract.test.ts`, following the project pattern of co-located test files

### Decision 3: PAX extended header handling

**Chosen: Skip PAX headers gracefully**

Rationale:
- GNU tar on Ubuntu (used in CI, `build-release.yml:17` specifies `ubuntu-latest`) defaults to POSIX.1-2001 (pax) format
- For our simple payload (short paths, normal UIDs, no special attributes), PAX extended headers are unlikely but possible
- Correct handling: when typeflag is `'x'` or `'g'`, read and discard the data blocks, then proceed to the next entry which contains the actual file/directory
- This is a ~5-line addition that prevents silent extraction failure on unexpected header types

### Decision 4: Path traversal protection

**Chosen: Basic validation — reject entries that escape the destination directory**

Rationale:
- We control the tarball source (our own CI), so malicious content is not a realistic threat
- But defense-in-depth is good practice for any extraction code
- Implementation: `const resolved = path.resolve(destDir, name); if (!resolved.startsWith(path.resolve(destDir))) throw new Error(...)`
- Also strip leading `/` from entry names and reject entries containing `..` path components
- This matches the essential checks that node-tar performs

### Decision 5: USTAR prefix handling

**Chosen: Support USTAR prefix field (bytes 345-499)**

Rationale:
- The USTAR format (identified by magic `"ustar\0"` at bytes 257-262) splits long paths into a `prefix` (bytes 345-499) and `name` (bytes 0-99)
- Full path is `prefix + "/" + name` when prefix is non-empty
- Our paths are short (longest: `dist/update/perform.js` = 23 chars), so prefix is likely always empty
- But supporting it is a 3-line addition (`if (prefix) fullName = prefix + '/' + name`) and prevents a class of bugs if the tarball format changes

### Decision 6: `execSync` import retention in `perform.ts`

**Chosen: Keep the `execSync` import**

Rationale:
- `copyDirRecursive` at `perform.ts:33` uses `execSync` for the EXDEV cross-filesystem fallback (`xcopy` on Windows, `cp -R` on POSIX)
- This is NOT a tar invocation — acceptance criteria #3 says "no remaining external **tar** invocation"
- The import must remain for `copyDirRecursive` to function

### Decision 7: Test tarball creation approach

**Chosen: Programmatic tarball creation using `node:zlib` (gzipSync) + manual tar block construction**

Rationale:
- Tests need to create representative `.tgz` payloads to extract
- Using the same built-in modules (in reverse — creating instead of parsing) keeps tests self-contained with zero test-only dependencies
- A helper function `createTestTarGz(entries)` builds tar blocks manually:
  - 512-byte header per entry (name, size, typeflag, checksum)
  - Data blocks padded to 512 bytes
  - Two zero blocks to terminate
  - Wrapped in `gzipSync()`
- This mirrors the extraction approach and ensures end-to-end coverage
- Alternative (rejected): Check in a fixture `.tgz` file. Opaque binary fixtures are harder to maintain and review.

## Cross-Platform Considerations

| Platform | Current Behavior | After Fix |
|----------|-----------------|-----------|
| **Windows + Git for Windows** | **BROKEN** — GNU tar interprets `C:` as remote host: `Cannot connect to C: resolve failed` | Fixed — no external tar binary invoked; `gunzipSync` + buffer parsing is platform-independent |
| **Windows + only bsdtar** | Works (bsdtar handles Windows paths) | Fixed — extraction is now in-process regardless |
| **macOS** | Works (BSD tar) | No regression — same extraction result via different mechanism |
| **Linux** | Works (GNU tar, no drive letters) | No regression — same extraction result via different mechanism |

Key cross-platform notes:
- `gunzipSync` and `readFileSync` are platform-independent Node.js built-in APIs
- Tar archives always store paths with forward slashes (`/`) regardless of creation platform
- `path.join()` and `mkdirSync()` correctly handle platform-specific separators when writing to the filesystem
- The test for paths containing colons (mimicking Windows drive letters) validates the original failure mode is eliminated

## Performance Expectations

| Metric | Current (`execSync tar`) | After (in-process) |
|--------|-------------------------|---------------------|
| Extraction time (~5MB .tgz) | ~200-500ms (process spawn + extraction) | ~50-100ms (no process spawn overhead) |
| Memory peak | Low (external process) | Low (~15MB buffer for uncompressed tar, freed after extraction) |
| CPU profile | Spawns external process | Single-threaded, brief buffer operations |

The in-process approach should be **faster** than `execSync` because it eliminates process spawn overhead. Memory usage is trivially small for this payload size.

## Dependencies

### Runtime dependencies added: None

The implementation uses only Node.js built-in modules:
- `node:zlib` — `gunzipSync()` for gzip decompression
- `node:fs` — `readFileSync()`, `writeFileSync()`, `mkdirSync()` for file operations
- `node:path` — `join()`, `resolve()`, `dirname()` for path construction and safety checks

### Dev dependencies added: None

Tests use the same built-in modules to create test tarball fixtures programmatically (`gzipSync()` + manual tar block construction).

### Why no npm dependency (key finding)

The release tarball published by CI contains `dist/`, `skill-content/`, `package.json`, and `build-metadata.json` — **no `node_modules/`** (confirmed in `.github/workflows/build-release.yml:37-43`). Every import in the codebase resolves to either `node:*` built-in modules or relative paths (confirmed via grep of all `src/` files — zero third-party imports). An npm dependency like `tar` would produce a bare specifier import (`import ... from 'tar'`) that would fail to resolve at runtime in GitHub-release-installed copies because `node_modules/tar` would not exist.

Fixing this would require either:
1. **Bundling with esbuild**: Changes the build system. Adds risk of breaking `import.meta.url` resolution at `perform.ts:24` which is critical for install-root discovery. Exceeds the extraction-fix scope.
2. **Including node_modules in the tarball**: Requires modifying the CI workflow file (`.github/workflows/build-release.yml`), which is explicitly out of scope.

Neither option is justified when the built-in approach solves the problem with zero new dependencies and zero build changes. This revises the diagnosis recommendation of using node-tar.

## Test Strategy

### New file: `src/update/extract.test.ts`

**Test 1: Successful extraction of representative tarball**
- Programmatically create a `.tgz` with the expected structure: `dist/index.js` (with content), `dist/update/perform.js`, `skill-content/SKILL.md`, `package.json`, `build-metadata.json`
- Extract to a temp directory using `extractTarGz()`
- Assert all expected files and directories exist with correct content

**Test 2: Extraction to path with special characters (colon / drive letter)**
- On non-Windows: create a temp dir with a colon in the name (e.g., `staging:test`) to mimic the Windows drive-letter issue
- Verify extraction succeeds regardless of path characters in the destination
- This directly validates the original failure mode is eliminated (the prior `execSync('tar ...')` would fail on such paths)

**Test 3: Corrupt tarball handling**
- Pass a truncated or garbage buffer as the tarball content
- Assert that `extractTarGz()` throws an error (which `performStagedUpdate` will catch and convert to `{ success: false, error }`)

**Test 4: Empty archive handling**
- Create a valid `.tgz` containing only the end-of-archive marker (two consecutive 512-byte zero blocks)
- Verify extraction completes without error and the destination directory is empty

**Test 5: PAX extended header handling**
- Create a tarball with a PAX extended header entry (typeflag `'x'`) before a regular file entry
- Verify the regular file is extracted correctly and the PAX header data is skipped

**Test infrastructure patterns** (from existing tests in `src/skill/skill.test.ts`):
- `mkdtempSync(join(tmpdir(), 'extract-'))` for isolated temp directories
- `rmSync(tmpDir, { recursive: true, force: true })` in `afterEach` for cleanup
- `node:test` (describe/it) + `node:assert` (strict) for assertions

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Tar format edge case not handled by manual parser | Low | Medium — extraction silently produces wrong output or fails | The CI tarball has simple, known content (short paths, no symlinks, no special attributes). PAX headers are handled. Comprehensive tests cover the exact tarball shape. |
| 2 | GNU tar on Ubuntu CI produces format features our parser doesn't handle | Very Low | Medium — extraction fails with an error (fail-closed) | USTAR format is well-documented. Our payload has no features that would trigger exotic extensions (no long paths, no extended attributes). If this occurs, it surfaces as an extraction error, preserving fail-closed behavior. |
| 3 | Large tarball exceeds memory for synchronous approach | Very Low | Low — extraction OOMs on very large payloads | The CLI payload is < 5MB compressed. Even a 10x growth would be < 50MB, trivially within Node.js memory. Can switch to streaming in the future if needed. |
| 4 | Path separator handling on Windows during file writing | Low | Medium — files written to wrong locations | Tar archives use forward slashes. `path.join()` normalizes to platform separators. Tests verify cross-platform path handling explicitly. |

## Deferred to Round 2

- **Replace `copyDirRecursive` shell-out (perform.ts:33):** The EXDEV fallback uses `execSync('xcopy'/'cp -R')`. Not a tar invocation and out of scope. Could be replaced with `fs.cpSync()` (stable since Node 16.7) in a future pass.
- **Streaming extraction:** If the tarball payload grows significantly, a streaming pipeline approach could reduce peak memory. Not needed at current payload sizes.
- **Replace `gh auth token` shell-out (check.ts:30):** Not a tar invocation and out of scope. Could be replaced with direct credential file reading in a future pass.
- **Bundler adoption:** If the project adds more npm dependencies in the future, adopting esbuild as a build step would be worth revisiting to enable standard npm packages in the release tarball.

## Summary Table

| Aspect | Decision |
|--------|----------|
| **Extraction approach** | Node.js built-in modules (`node:zlib` gunzipSync + manual tar header parsing) |
| **New runtime dependencies** | None (preserves zero-dependency design) |
| **New dev dependencies** | None |
| **Build system changes** | None (`tsc` remains sole build step) |
| **CI workflow changes** | None |
| **Files created** | `src/update/extract.ts` (extraction function), `src/update/extract.test.ts` (tests) |
| **Files modified** | `src/update/perform.ts` (replace execSync tar call with `extractTarGz()` import + call) |
| **Files NOT changed** | `validate.ts`, `index.ts`, `check.ts`, `version.ts`, `package.json`, `tsconfig.json`, `.github/workflows/build-release.yml` |
| **Error handling** | Preserved exactly — `extractTarGz` throws on error; existing catch block returns `{ success: false, error }` |
| **Platform support** | Windows (including GNU tar in PATH), macOS, Linux — all via platform-independent Node.js APIs |
| **Performance** | Expected faster than execSync (no process spawn overhead) |

## APL Statement Reference

See `tech-research/apl.json`. Key revision from diagnosis: the diagnosis recommended using `tar` (node-tar) as an npm dependency. Tech research identified that the release tarball does not include `node_modules/`, making any npm dependency unresolvable at runtime for the primary install path. The built-in module approach (`node:zlib` + manual tar parsing) resolves the same root cause without introducing this dependency resolution gap, while staying consistent with the project's zero-dependency, `node:*`-only import pattern.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (continuation context) | Scope, requirements, acceptance criteria, explicit constraints | Extraction-only fix; must remove tar binary dependency; CI workflow changes out of scope; adding runtime dep in scope |
| `diagnosis/diagnosis-statement.md` | Root cause analysis, alternative rejection, success criteria | Single root cause at perform.ts:124; recommends node-tar (revised by this step); 3 files changed |
| `diagnosis/apl.json` | Structured Q&A with evidence | Confirmed colon interpretation is in GNU tar's parser; node-tar recommended but dependency resolution not analyzed |
| `product/product.md` | Product spec, open questions | Open question #2 asked whether node-tar bundles correctly into release tarball — answered here: it does not without bundler or CI change |
| `scout/reference-map.json` | File inventory, facts, code boundaries | Confirmed bug at perform.ts:124; zero runtime deps; ESM project; tarball shape; validation contract |
| `scout/scout-summary.md` | Analysis summary, dependency landscape | Confirmed zero runtime deps, ESM, node:test runner, no existing update tests |
| `repo-guidance.json` | Repo intent classification | helix-cli is the sole target; no cross-repo impact |
| `src/update/perform.ts` (lines 1-247) | Direct inspection of bug and full orchestration | execSync tar at line 124; error catch at 128-131; execSync import also used by copyDirRecursive (line 33); import.meta.url at line 24 |
| `src/update/validate.ts` (lines 1-66) | Post-extraction contract | Checks dist/index.js exists, package.json exists, runs node --version |
| `package.json` (full) | Dependencies, build scripts, module config | Zero runtime deps; ESM; `"build": "tsc"`; `"files"` field excludes node_modules |
| `tsconfig.json` (full) | Build constraints | ES2022 target, Node16 modules, strict mode, output to dist/ |
| `.github/workflows/build-release.yml` (full) | Tarball creation — confirms no node_modules | Lines 37-43: only dist/, skill-content/, package.json, build-metadata.json |
| `src/skill/skill.test.ts` (full) | Test patterns and infrastructure | node:test describe/it; node:assert strict; mkdtempSync; beforeEach/afterEach cleanup |
| Entire `src/` import scan (grep) | Verify dependency resolution model | All imports are `node:*` or relative paths — zero third-party modules in entire codebase |
| Context7: tar-stream docs | Evaluate alternative library | Lower-level API requiring manual file/dir creation; same resolution blocker as node-tar |
| Web search: node-tar npm | Library fitness and dependency tree | v7.5.13; 5 transitive JS deps; TypeScript-native; ESM hybrid via tshy; used by npm itself |
| Web search: tar-fs npm | Evaluate tar-fs alternative | Doesn't gunzip by default; same resolution blocker as node-tar |

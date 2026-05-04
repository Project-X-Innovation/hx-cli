# Tech Research — FIX-347: Make hlx update Validate Installed Package And Recover From Broken Installs

## Technology Foundation

- **Runtime**: Node.js >= 18 (ESM, `"type": "module"`)
- **Language**: TypeScript 6.x compiled via `tsc` to `dist/`
- **Package manager**: npm (global install from GitHub source, not npm registry)
- **Subprocess APIs**: `child_process.spawnSync` (proposed replacement for current `execSync`)
- **Filesystem APIs**: `fs.existsSync` for file validation
- **Platform targets**: Windows and Unix (Linux/macOS), across system Node, nvm, and volta

## Architecture Decision

### Problem

`performUpdate()` in `src/update/perform.ts` returns `{success: true}` whenever `execSync` completes without throwing — i.e., whenever npm exits 0. No post-install validation exists. npm can exit 0 while the installed package is broken (e.g., `dist/` containing only `.d.ts` declaration files from a partial `tsc` build). The install metadata is persisted immediately, blocking future retry.

### Options Considered

#### Option A: Inline validation in index.ts (rejected)

Add file-existence and version-execution checks directly in `runUpdate()` and `checkAutoUpdate()`.

- **Pro**: No new files.
- **Con**: Duplicates validation logic across two code paths. Mixes command orchestration with validation concerns.

#### Option B: Extend performUpdate in perform.ts (rejected)

Move validation into `performUpdate()` so it returns success only after both npm and validation pass.

- **Pro**: Single return value semantics.
- **Con**: Conflates npm execution with post-install validation. Callers lose the ability to distinguish "npm failed" from "npm succeeded but install is broken" — important for different error messages and stderr handling. Makes the function do too many things.

#### Option C: New validate.ts module + spawnSync refactor (chosen)

Create `src/update/validate.ts` with a `validateInstall()` function. Refactor `performUpdate()` to use `spawnSync` and return captured stderr. Both `runUpdate()` and `checkAutoUpdate()` call `validateInstall()` after npm succeeds but before saving metadata.

- **Pro**: Clean separation of concerns. Follows the existing single-responsibility pattern in `src/update/` (check.ts, version.ts, perform.ts). Both update paths share the same validation. Callers can distinguish npm failure from validation failure for targeted messaging. `spawnSync` enables stderr capture on the success path.
- **Con**: One new file. Slightly more code than inline approach.

### Chosen Option: C

**Rationale**: This approach introduces the smallest structural change while cleanly separating the npm execution concern from the post-install validation concern. It follows the established module pattern in `src/update/`, avoids duplication, and gives callers the information they need for targeted error messaging.

## Core API/Methods

### New: `src/update/validate.ts`

**`validateInstall(): { valid: boolean; binTargetPath: string; error?: string }`**

1. Resolve the global node_modules path via `npm root -g` (spawnSync).
2. Construct the expected bin target path: `{globalNodeModules}/@projectxinnovation/helix-cli/dist/index.js`.
3. Check file existence via `fs.existsSync()`.
4. If file exists, run `node {binTargetPath} --version` via `spawnSync` with `HLX_SKIP_UPDATE_CHECK=1` env var and a short timeout (10s).
5. Return structured result with the resolved path and any error description.

### Modified: `src/update/perform.ts`

**`performUpdate(options?): { success: boolean; error?: string; stderr?: string }`**

- Replace `execSync` with `spawnSync` from `node:child_process`.
- Non-quiet mode: `stdio: 'inherit'` (live streaming preserved). `stderr` field is `undefined` (not captured).
- Quiet mode: `stdio: ['pipe', 'pipe', 'pipe']`. `stderr` field contains captured npm stderr.
- Check `result.status === 0` instead of relying on exception flow.
- Return `stderr` in the result object for caller use.

### Modified: `src/update/index.ts`

**`runUpdate(args)`** — insert validation between npm success and metadata save (between current lines 77 and 80):
1. If `performUpdate()` succeeds, call `validateInstall()`.
2. If validation fails: print error with missing path, surface npm stderr note, print recovery hint, `process.exit(1)`.
3. If validation passes: proceed to `saveConfig()` and success message as today.

**`checkAutoUpdate()`** — insert validation between npm success and metadata save (between current lines 136 and 138):
1. If `performUpdate()` succeeds, call `validateInstall()`.
2. If validation fails: log warning to stderr, do NOT save metadata, continue (do not block).
3. If validation passes: proceed to `saveConfig()` and success message as today.

## Technical Decisions

### 1. Global path resolution: `npm root -g` (not `npm prefix -g`)

**Decision**: Use `npm root -g` to resolve the global node_modules directory.

**Rationale**: `npm prefix -g` returns the installation prefix, which requires platform-specific logic to derive the actual node_modules path:
- Unix: `{prefix}/lib/node_modules/`
- Windows: `{prefix}/node_modules/`

`npm root -g` returns the global node_modules directory directly on all platforms, eliminating platform-branching code. The installed package path is then: `{npmRootG}/@projectxinnovation/helix-cli/dist/index.js`.

**Rejected alternative**: `npm prefix -g` + platform detection — adds unnecessary complexity and a potential bug surface for edge-case Node version manager configurations.

**Rejected alternative**: `import.meta.url` relative resolution — resolves to the currently running (old) CLI installation, not the newly installed one (`src/update/version.ts` lines 11-13 demonstrates this pattern).

**Fallback**: If `npm root -g` fails (non-zero exit or empty output), validation returns an error describing the failure rather than crashing. This is a degraded state — the user gets a clear message that path resolution failed rather than a success report for a potentially broken install.

### 2. Subprocess API: `spawnSync` (not `execSync`)

**Decision**: Replace `execSync` with `spawnSync` in `performUpdate()`.

**Rationale**: `execSync` only returns stdout and only exposes stderr via the thrown error object on non-zero exit. Since npm can exit 0 with tar warnings that indicate a broken install, we need stderr on the success path. `spawnSync` returns `{stdout, stderr, status, signal, error}` as a structured result regardless of exit code.

**Rejected alternative**: Keep `execSync` and add a separate stderr capture mechanism (e.g., temp file redirect) — more complex, fragile, and non-standard.

**Behavioral note**: With `stdio: 'inherit'` (non-quiet mode), `spawnSync` still returns `{status}` reliably, but `stdout`/`stderr` are `null` since the streams are inherited. This preserves the current live-streaming UX for manual updates.

### 3. Version execution check: `node {path} --version` (not `hlx --version`)

**Decision**: Invoke the installed CLI directly via its full filesystem path using `node {path}`, not via the `hlx` shell command.

**Rationale**: After `npm install -g`, the `hlx` command in the user's PATH may still resolve to the old installation due to shell hash caching (bash `hash -r`), Windows `%PATH%` resolution order, or symlink propagation delays. Running `node {fullPathToDistIndexJs} --version` directly tests the exact installed artifact at the resolved global path.

**Recursion guard**: Set `HLX_SKIP_UPDATE_CHECK=1` in the subprocess environment, following the established pattern in `performUpdate()` (`src/update/perform.ts` line 18). This prevents the invoked CLI from triggering its own auto-update during the version check.

**Timeout**: 10 seconds. The `--version` handler (`src/index.ts` lines 86-89) calls `getPackageVersion()` which reads `package.json` from disk — a fast operation. A 10-second timeout provides generous headroom while preventing indefinite hangs.

**Rejected alternative**: `hlx --version` via PATH — subject to shell caching and doesn't validate the specific installed copy.

### 4. Stderr handling: mode-dependent capture

**Decision**: Capture stderr only in quiet mode (auto-update). In non-quiet mode (manual), npm output streams live.

**Rationale**: 
- **Non-quiet (manual update)**: The user sees npm output in real-time via `stdio: 'inherit'`. If validation fails, the error message notes that npm output was displayed above. This preserves the current UX where users can observe installation progress.
- **Quiet (auto-update)**: All stdio is piped. `performUpdate()` returns captured stderr. If validation fails, the warning includes relevant npm output so the user can diagnose the issue.

**Rejected alternative**: Pipe stderr in all modes to always capture it — loses the real-time output streaming that users expect during manual updates.

### 5. Metadata save gating

**Decision**: `saveConfig()` is called only after both npm success AND validation success.

**Rationale**: If installSource is saved with the new commit SHA while the install is broken, future `hlx update` calls see matching SHAs (line 61-63 of `src/update/index.ts`) and report "Already up to date" — permanently trapping the user on a broken install with no automated retry path. By not saving metadata on validation failure, the user can simply re-run `hlx update` to attempt recovery.

### 6. Recovery messaging

**Decision**: On validation failure, print a structured error with:
1. What failed — missing file path or failed `--version` output.
2. npm context — in quiet mode, include captured stderr; in non-quiet mode, reference the output displayed above.
3. Recovery steps — concrete instructions: `git clone` or `git pull` the repo, `npm run build`, `npm link`.
4. Retry hint — note that running `hlx update` again will re-attempt the installation.

### 7. No test framework introduction

**Decision**: Do not introduce a test framework. Rely on `npm run typecheck` (tsc --noEmit) and manual acceptance testing.

**Rationale**: The repository has no test runner, test files, or test dependencies. The product specification explicitly places test framework introduction out of scope for this MVP. The validation logic is deterministic (file existence + subprocess exit code) and can be verified through the existing build gate and manual acceptance criteria.

**Rejected alternative**: Add vitest or similar — out of scope per product spec, and the validation surface is small enough that typecheck + manual verification is sufficient for this change.

## Cross-Platform Considerations

| Concern | Unix (Linux/macOS) | Windows |
|---------|-------------------|---------|
| Global node_modules path | `npm root -g` returns e.g. `/usr/local/lib/node_modules` | `npm root -g` returns e.g. `C:\Users\user\AppData\Roaming\npm\node_modules` |
| Path separator | `/` | `\` (Node.js `path.join` handles this) |
| Node binary | `node` | `node` (or `node.exe`, but `spawnSync('node', ...)` works on both) |
| npm binary | `npm` | `npm` (or `npm.cmd`, but `spawnSync('npm', ..., {shell: true})` handles this) |
| File existence check | `fs.existsSync` works | `fs.existsSync` works |

**Key pattern**: Use `path.join()` for all path construction. Use `{shell: true}` for npm commands via `spawnSync` on Windows (npm is a `.cmd` script on Windows, not a binary).

**Note on `npm root -g`**: Must be invoked via `spawnSync('npm', ['root', '-g'], {shell: true, encoding: 'utf8'})`. The `shell: true` option is necessary for Windows where `npm` resolves to `npm.cmd`.

## Performance Expectations

| Operation | Expected time | Notes |
|-----------|--------------|-------|
| `npm root -g` | < 500ms | Local npm config lookup, no network |
| `fs.existsSync()` | < 5ms | Single filesystem stat |
| `node {path} --version` | < 2s | Starts Node, reads package.json, prints version |
| Total validation overhead | < 3s | Added to every successful update |

The validation overhead is negligible compared to the `npm install -g` operation itself (typically 30-120 seconds for a GitHub source install with build step).

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| `node:child_process` (spawnSync) | Built-in | Already used in the module (execSync). No new external dependency. |
| `node:fs` (existsSync) | Built-in | Standard filesystem check. |
| `node:path` (join) | Built-in | Already used in the codebase. |
| `npm` CLI | Runtime | Must be available in PATH. Already a requirement for the install step. |
| `node` CLI | Runtime | Must be available in PATH. Already a requirement for running the CLI. |

**No new external dependencies are introduced.** All APIs used are Node.js built-ins already present in the project's dependency chain.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `npm root -g` returns unexpected path on exotic Node version managers | Low | Validation fails incorrectly (false negative) — user gets an error for a valid install | Graceful error message explains what path was checked; user can verify manually; retry path preserved |
| `npm root -g` command itself fails | Low | Validation cannot determine install path | Return validation error with clear message; do not report success; user can still manually verify |
| `node {path} --version` hangs or takes too long | Low | Update appears to hang after npm completes | 10-second timeout on the spawnSync call; timeout produces a clear validation failure message |
| `spawnSync` behavioral difference from `execSync` | Very Low | Non-zero npm exit not detected | spawnSync returns `status` field; explicit check for `result.status !== 0` is more reliable than exception-based detection |
| Windows `npm.cmd` not found without `shell: true` | Medium on Windows | npm/node commands fail to spawn | Always use `{shell: true}` for npm commands; document this requirement |
| Recovery instructions reference `npm link` which may need elevated permissions on Windows | Medium on Windows | User cannot follow recovery steps without admin shell | Recovery message notes that elevated permissions may be required |

## Deferred to Round 2

- **Automated repair**: Automatically running `npm run build` + `npm link` from a local checkout on validation failure. MVP provides guidance only.
- **Test infrastructure**: Adding a test framework (vitest or similar) for regression testing of validation scenarios.
- **Package integrity checks**: Verifying file checksums or source maps beyond simple existence.
- **Telemetry**: Reporting validation failures to a central service for early detection of broken publishes.
- **Rollback**: Saving a backup of the previous working installation before updating, enabling automatic rollback on validation failure.

## Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Validation module location | New `src/update/validate.ts` | Single responsibility; shared by both update paths; follows existing modular pattern |
| Global path resolution | `npm root -g` | Cross-platform without branching; returns node_modules directly |
| Subprocess API | `spawnSync` replacing `execSync` | Structured result with stderr on success path |
| Version execution check | `node {fullPath} --version` | Tests exact installed artifact; avoids PATH/shell caching issues |
| Stderr capture | Mode-dependent (inherit for manual, pipe for auto) | Preserves live-streaming UX for manual; captures for auto |
| Metadata save | Gated on validation success | Prevents "Already up to date" trap on broken installs |
| Auto-update failure behavior | Warn to stderr, don't save metadata, continue | Consistent with existing non-blocking auto-update design |
| Recovery messaging | Structured error with path + steps + retry hint | User-actionable; preserves retry path |
| Test framework | Not introduced (out of scope) | Product spec excludes; typecheck + manual verification sufficient |
| Files changed | `perform.ts` (modified), `index.ts` (modified), `validate.ts` (new) | Minimal change surface confined to `src/update/` |

## APL Statement Reference

The root cause is that `performUpdate()` equates npm exit code 0 with a valid CLI installation. The fix adds a validation layer: a new `src/update/validate.ts` module checks file existence at the global install path (resolved via `npm root -g`) and runs `node {path} --version` with the existing recursion guard. `performUpdate()` is refactored from `execSync` to `spawnSync` to capture stderr. Both `runUpdate()` and `checkAutoUpdate()` call validation after npm succeeds but before saving metadata. Manual validation failure exits non-zero with a detailed error and recovery hint. Auto-update validation failure warns and continues without saving metadata. All questions from the diagnosis APL are resolved with no remaining followups.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary requirements, acceptance criteria, and constraints | Two-step validation (file exists + version runs); fail-closed; recovery messaging; metadata must not be saved on failure; non-blocking auto-update |
| scout/reference-map.json | Code-level evidence with line references for all relevant files | Confirmed the zero-validation gap; identified both update paths; documented stderr handling gaps; established that no test framework exists |
| scout/scout-summary.md | Synthesized update flow architecture analysis | Clarified the install spec (GitHub source, not registry); identified the prepare hook as the partial build vector; documented the recursion guard pattern |
| diagnosis/apl.json | Diagnostic answers to six key questions | Provided validated insertion points for validation calls; confirmed metadata gating requirement; established auto-update behavior expectation |
| diagnosis/diagnosis-statement.md | Root cause analysis with contributing factors | Root cause: npm exit code equated with valid install. Four contributing factors: partial tsc builds, stderr lost on success, metadata poisoning, zero validation gap |
| product/product.md | Product specification with scope, use cases, and success criteria | Confirmed no test framework introduction; defined four use cases (happy path, broken manual, broken auto, retry); explicit out-of-scope items |
| repo-guidance.json | Repository intent classification | Confirmed helix-cli is sole target; all changes confined to src/update/ |
| src/update/perform.ts | Current npm install execution code | execSync-based, returns {success, error}; quiet mode pipes but doesn't read; non-quiet inherits; recursion guard sets HLX_SKIP_UPDATE_CHECK=1 |
| src/update/index.ts | Update command handler with both code paths | Two entry paths: runUpdate (manual, exits on failure) and checkAutoUpdate (auto, never blocks); both trust performUpdate without validation; saveConfig called immediately after npm success |
| src/update/version.ts | Runtime version reading pattern | Uses import.meta.url relative to dist/ — resolves to OLD install during update, confirming need for npm root -g approach |
| src/update/check.ts | Canonical repo/branch constants | Install spec: github:Project-X-Innovation/helix-cli#main; fetchRemoteSha via git ls-remote |
| package.json | Package metadata and bin contract | name: @projectxinnovation/helix-cli; bin: dist/index.js; prepare: npm run build; no test framework; ESM module |
| tsconfig.json | TypeScript compilation config | declaration: true explains how dist/ can contain .d.ts without .js in partial builds |
| src/index.ts | CLI entrypoint and --version handler | --version calls getPackageVersion (lightweight); auto-update runs pre-dispatch; SKIP_AUTO_UPDATE includes 'update' and '--version' |
| src/lib/config.ts | Config persistence module | saveConfig does read-merge-write; InstallSource type: {mode, repo?, branch?, commit?}; loadFullConfig reads raw config |
| Node.js docs (Context7) | spawnSync API verification | Confirmed spawnSync returns {stdout, stderr, status, signal, error} as structured result; stderr accessible regardless of exit code |
| npm docs (web search) | npm root -g cross-platform behavior | Confirmed npm root -g returns global node_modules directly; eliminates platform-specific /lib/ branching needed with npm prefix -g |

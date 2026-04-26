# Tech Research — HLX-316: Add GitHub main self-update and auto-update to helix-cli

## Technology Foundation

- **Runtime**: Node.js >=18 (per `package.json:13-15`)
- **Language**: TypeScript with strict mode, ES2022 target, Node16 module resolution
- **Module system**: ES modules (`"type": "module"` in package.json)
- **Build**: `tsc` (TypeScript compiler) — output to `dist/`, source in `src/`
- **Runtime dependencies**: None (zero runtime deps today; this ticket adds none)
- **Key Node APIs used**: `child_process.execSync`, global `fetch()` (Node >=18), `fs.readFileSync`, `fs.writeFileSync`, `url.fileURLToPath`, `path.join/dirname`

No new runtime dependencies are introduced. All functionality uses Node.js built-in modules and the `git` and `npm` CLIs, both of which are safe assumptions for the target user base (developers installing from GitHub).

## Architecture Decision

### Decision: GitHub SHA check mechanism

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. GitHub REST API | `GET https://api.github.com/repos/.../commits/main` | No git binary needed; uses Node fetch | 60 req/hr unauthenticated rate limit; heavier response payload |
| B. git ls-remote | `git ls-remote <url> refs/heads/main` | No rate limit; very lightweight; minimal output | Requires git binary; uses child_process |
| C. GitHub GraphQL API | GraphQL query for branch ref | Flexible; single request | Requires authentication; more complex |

**Chosen: Option B — git ls-remote**

**Rationale**: With `autoUpdate` enabled, the CLI checks GitHub main on every invocation. The REST API's 60 requests/hour unauthenticated limit would be quickly exhausted by active developers. `git ls-remote` has no rate limit, fetches only ref metadata (not content), and returns a single line trivially parsed for the SHA. The target users install from GitHub, so git is reliably present. `child_process.exec` is already used in the codebase (`src/login.ts:3`), establishing precedent.

**Command**: `git ls-remote https://github.com/Project-X-Innovation/helix-cli.git refs/heads/main`
**Output format**: `<40-char-sha>\trefs/heads/main` — split on whitespace, take first token.

### Decision: Self-update mechanism

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. npm install -g from GitHub | `npm install -g github:Project-X-Innovation/helix-cli#main` | Standard npm feature; handles build + link | Requires prepare script; slower than tarball |
| B. git clone + npm link | Clone repo, npm install, npm run build, npm link | Full control; works without prepare | Complex multi-step; fragile; path management |
| C. Download tarball + manual install | Fetch GitHub tarball, extract, build, link | No npm global state dependency | Very complex; non-standard; error-prone |

**Chosen: Option A — npm install -g from GitHub**

**Rationale**: This is standard npm behavior for git-based installs. npm handles cloning, dependency installation, build (via prepare), packing, and global installation. The ticket requires using "the canonical GitHub source for reinstall/update, not npm [registry]" — this command fetches from GitHub, not the registry. The `child_process.execSync` call is straightforward and consistent with codebase patterns.

**Critical prerequisite**: A `"prepare": "npm run build"` script must be added to `package.json`. The `dist/` directory is gitignored and not in the GitHub repo. Without `prepare`, npm would install a package with no compiled JavaScript, and the `hlx` bin entry (`dist/index.js`) would point to a non-existent file. npm's documented pattern for packages that compile from source is exactly this: devDependencies for build tools + prepare script. The npm docs show the literal example of `"prepare": "npm run build"` with `"build": "tsc"`.

### Decision: Post-update process behavior

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Continue with loaded code | After execSync update, continue executing the original command | Simple; no re-exec; no loop risk | User runs old code for the current invocation |
| B. Re-exec with new code | After update, spawn new CLI process with same args | User gets new code immediately | Complex; path-resolution issues; loop risks; process replacement edge cases |

**Chosen: Option A — Continue with loaded code (no re-exec)**

**Rationale**: Node.js loads modules into memory at import time. Replacing files on disk during `npm install -g` does not affect the running process. The current invocation completes with old code; the next invocation uses new code. This eliminates re-exec complexity, process-replacement risks, and the primary vector for infinite loops. The ticket says "update itself once and then continue only after success" — this is satisfied by synchronous execSync followed by command execution.

## Core API/Methods

### GitHub SHA Check (`src/update/check.ts`)

```
fetchRemoteSha(): string | null
  - Runs: git ls-remote https://github.com/Project-X-Innovation/helix-cli.git refs/heads/main
  - Returns: 40-character SHA string, or null on failure
  - Uses: child_process.execSync with timeout (10 seconds)
  - Error handling: catch execSync errors, return null (fail safe)

isUpdateAvailable(localSha: string): { available: boolean; remoteSha: string | null }
  - Calls fetchRemoteSha(), compares with localSha
  - Returns whether update is available and the remote SHA
```

### Self-Update Execution (`src/update/perform.ts`)

```
performUpdate(): { success: boolean; newSha: string | null; error?: string }
  - Runs: npm install -g github:Project-X-Innovation/helix-cli#main
  - Uses: child_process.execSync
  - On success: fetches new SHA via fetchRemoteSha(), returns it
  - On failure: returns error message, does not throw
  - stdio: 'inherit' for hlx update (show progress); 'pipe' for auto-update (quiet)
```

### Config Extensions (`src/lib/config.ts`)

```
Extended HxConfig type:
  - apiKey: string
  - url: string
  - autoUpdate?: boolean (default: false when absent)
  - installSource?: { mode: 'github' | 'unknown'; repo?: string; branch?: string; commit?: string }

saveConfig(updates: Partial<HxConfig>): void
  - Read-merge-write: reads existing file, merges with updates, writes back
  - Preserves all existing fields not in the update payload
  - Creates ~/.hlx/ directory if needed

getUpdateConfig(): { autoUpdate: boolean; installSource: InstallSource | null }
  - Reads config file, extracts update-related fields
  - Returns defaults (autoUpdate: false, installSource: null) if fields missing
```

### Version Reading (`src/update/version.ts` or inline in `src/index.ts`)

```
getPackageVersion(): string
  - Uses: fileURLToPath(import.meta.url) to resolve dist/ directory
  - Reads: ../package.json relative to dist/
  - Returns: version string from package.json
  - Fallback: 'unknown' if read fails
```

## Technical Decisions

### 1. Config system: read-merge-write pattern

**Decision**: Modify `saveConfig` to read the existing config file, merge with new values, and write back — instead of overwriting with only the supplied fields.

**Why**: The current `saveConfig` at `src/lib/config.ts:35-38` serializes only `{apiKey, url}`, destroying any additional fields. `src/login.ts:38,107` calls `saveConfig({apiKey, url})` during login, which would silently delete `autoUpdate` and `installSource` if they were stored. The ticket explicitly requires "the setting must round-trip without losing other config fields."

**Rejected alternative**: Separate config files (e.g., `~/.hlx/update.json`). This adds complexity and contradicts the ticket's mandate that all settings live in `~/.hlx/config.json`.

**Rejected alternative**: Keep current saveConfig and add a separate updateConfig function. This creates two write paths to the same file, risking race conditions and inconsistent behavior.

### 2. Install-source metadata: write-on-success pattern

**Decision**: `installSource` metadata is written to `~/.hlx/config.json` when `hlx update` completes successfully. Auto-update only proceeds when `installSource` is present and matches the canonical source (`mode: 'github'`, `repo: 'Project-X-Innovation/helix-cli'`, `branch: 'main'`).

**Why**: The ticket requires the CLI to "persist enough local metadata to know whether it was installed from the canonical GitHub repo/branch." Runtime auto-detection of install mode is fragile and unreliable across different npm/system configurations. Writing metadata on first successful `hlx update` is deterministic: if the update command succeeds, the install is canonical.

**Behavior matrix**:
| Scenario | installSource present? | hlx update | auto-update |
|----------|----------------------|------------|-------------|
| Fresh install, never ran update | No | Runs, writes metadata on success | Skipped (fail closed) |
| After successful hlx update | Yes, canonical | Runs, updates commit SHA | Runs if autoUpdate enabled |
| git clone + npm link (dev install) | No (unless manually set) | Runs, writes metadata on success | Skipped (fail closed) |
| Non-canonical installSource | Yes, non-matching | Fails clearly | Skipped with clear message |

### 3. Version reading: fileURLToPath + readFileSync

**Decision**: Read `package.json` version at runtime using `readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')`.

**Why**: The project uses ES modules (`"type": "module"`), so `require()` is unavailable. The compiled entry point is `dist/index.js`; `package.json` is one directory up at the package root. `fileURLToPath` from `node:url` converts `import.meta.url` to a filesystem path. This approach uses only built-in Node modules and works with Node >=18.

**Rejected alternative**: `import ... assert { type: 'json' }` — import assertions are still evolving (now `with` syntax in newer Node versions) and have compatibility concerns across Node versions.

**Rejected alternative**: `createRequire(import.meta.url)` — works but unnecessarily bridges CJS/ESM contexts when a simple file read suffices.

### 4. Loop prevention: architectural + env-var guard

**Decision**: The primary loop prevention is architectural: no re-exec after update. The `HLX_SKIP_UPDATE_CHECK=1` environment variable serves as a defensive safety net.

**Why**: Without re-exec, the single invocation flow is: check SHA -> update if needed -> execute command. There is no point where the CLI re-invokes itself. The env-var guard is a zero-cost defensive check for edge cases (e.g., if npm install triggers a postinstall that somehow runs hlx).

### 5. prepare script addition to package.json

**Decision**: Add `"prepare": "npm run build"` to `package.json` scripts.

**Why**: The `dist/` directory is gitignored. When `npm install -g github:...` fetches from GitHub, the repo contains only TypeScript source, no compiled JavaScript. The `hlx` bin entry points to `dist/index.js` which would not exist. npm's documented lifecycle for git dependencies: install devDependencies -> run prepare -> pack using files field -> install. Adding `prepare` causes `tsc` to run before packing, producing the required `dist/` output. This is the standard npm pattern for packages that compile from source (confirmed in npm documentation).

**Side effect**: `prepare` also runs after `npm install` during local development, which automatically builds after dependency installation. This is beneficial, not harmful.

### 6. Command surface for autoUpdate toggle

**Decision**: Add `hlx update --enable-auto` and `hlx update --disable-auto` flags to the `hlx update` command (or equivalent subcommands like `hlx update auto-on` / `hlx update auto-off`). The exact flag syntax is an implementation detail.

**Why**: Keeps update-related functionality under the `update` command namespace. The existing CLI has a flat command structure (login, inspect, comments). Adding a full `hlx config` subsystem is over-engineering for a single boolean setting.

**Rejected alternative**: `hlx config set autoUpdate true/false` — introduces a generic config command system that's unnecessary for one setting and creates scope creep.

### 7. Auto-update check placement in CLI dispatcher

**Decision**: Insert the auto-update check in `src/index.ts` after parsing the command but before the `switch` dispatcher, guarded by `autoUpdate` being enabled and `HLX_SKIP_UPDATE_CHECK` not being set.

**Why**: The auto-update must run before any command executes (ticket requirement). The check should not run for `--version`, `-v`, `update`, or `--help` commands — these should execute immediately without update overhead. The check should not require authentication (it doesn't need `apiKey`/`url`), so it runs independently of `requireConfig()`.

### 8. No new runtime dependencies

**Decision**: All new functionality uses Node.js built-in modules and system CLI tools (git, npm). No npm packages are added to dependencies.

**Why**: The project currently has zero runtime dependencies (only devDependencies: typescript, @types/node). The ticket explicitly warns "do not add broad dependency churn." All needed functionality is available from Node builtins: `child_process.execSync` for shell commands, `fs` for config read/write, `url.fileURLToPath` for ESM path resolution.

## Cross-Platform Considerations

- **git binary**: Required for SHA checks. Assumed present because target users install from GitHub. If git is not found, the check should fail gracefully with a clear message ("git not found; cannot check for updates").
- **npm binary**: Required for self-update. Assumed present because the CLI is installed via npm. If npm is not found, the update should fail with a clear message.
- **Path separators**: Use `path.join()` / `path.dirname()` consistently (already done in codebase). No hardcoded `/` separators.
- **Shell execution**: `execSync` uses the system shell. The git and npm commands used are cross-platform compatible (Windows, macOS, Linux).
- **Config directory**: `~/.hlx/` uses `os.homedir()` (already established in `src/lib/config.ts:10`), which resolves correctly across platforms.

## Performance Expectations

| Operation | Expected Latency | Frequency |
|-----------|------------------|-----------|
| git ls-remote SHA check | 1-3 seconds (network round-trip) | Once per CLI invocation when autoUpdate enabled |
| npm install -g from GitHub | 10-30 seconds (clone, install, build) | Only when update needed |
| Config file read/write | <1ms (local filesystem) | Once per invocation for read; once per update for write |
| package.json version read | <1ms (local filesystem) | Once per --version invocation |

**Impact on UX**: The 1-3 second git ls-remote adds noticeable latency to every CLI invocation when autoUpdate is enabled. This is an accepted tradeoff per the ticket design. Users who want instant response can disable autoUpdate and run `hlx update` manually.

**Mitigation for future**: A cooldown/cache mechanism (e.g., only check once per hour) could reduce the per-invocation cost. This is explicitly out of scope for MVP (noted in product.md Future Considerations).

## Dependencies

### System dependencies (must be present at runtime)

| Dependency | Required for | Detection |
|------------|-------------|-----------|
| git | SHA check via git ls-remote | `execSync('git --version')` — fail gracefully if missing |
| npm | Self-update via npm install -g | `execSync('npm --version')` — fail gracefully if missing |
| Node.js >=18 | Runtime, global fetch, stable ESM | Already enforced by `engines` in package.json |

### Package.json changes

| Change | Reason |
|--------|--------|
| Add `"prepare": "npm run build"` to scripts | Required for git-based npm install to compile TypeScript before packing |

No new entries in `dependencies` or `devDependencies`.

### File dependencies (new files)

| New file | Purpose |
|----------|---------|
| `src/update/check.ts` | GitHub SHA check via git ls-remote |
| `src/update/perform.ts` | Self-update execution via npm install -g |
| `src/update/index.ts` | Update command handler and auto-update orchestration |

### Modified files

| File | Changes |
|------|---------|
| `src/index.ts` | Add update command case; add auto-update pre-command hook; fix version output to read from package.json |
| `src/lib/config.ts` | Extend HxConfig type with optional autoUpdate and installSource; change saveConfig to read-merge-write |
| `package.json` | Add prepare script |

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| git not installed on user machine | Medium | Graceful failure with clear message; git is very likely present for GitHub-install users |
| npm install -g fails mid-update (network, permissions) | High | execSync throws on non-zero exit; catch and report error; config/install not corrupted (npm is atomic for global installs) |
| saveConfig read-merge-write race condition | Low | CLI is single-process; no concurrent writes expected. Read-merge-write is safe for this use case |
| prepare script slows down npm install during development | Low | tsc is fast (<2 seconds for this small project); acceptable and actually beneficial |
| GitHub repo renamed or moved | Low | Hard-coded canonical URL would need update; acceptable for MVP |
| User lacks permissions for npm install -g | Medium | execSync fails with permission error; catch and report clearly ("permission denied; try running with sudo or fix npm prefix") |

## Deferred to Round 2

- **Update cooldown/cache**: Rate-limit auto-update checks to once per N minutes to reduce per-invocation latency. Not needed for MVP.
- **GitHub personal access token support**: Allow authenticated GitHub API access for higher rate limits. Not needed with git ls-remote approach.
- **npm registry migration**: When npm publishing is set up, the update mechanism may switch from GitHub-direct to registry-based. Out of scope per ticket.
- **Comprehensive test suite**: The ticket calls for "targeted tests for update/config/version behavior." A full test infrastructure (test runner, CI integration) is out of scope.
- **Offline/cached SHA**: Cache the last-known remote SHA to skip network calls when recently checked. Future optimization.

## Summary Table

| Decision | Choice | Key Reason |
|----------|--------|------------|
| SHA check mechanism | git ls-remote | No rate limit; lightweight; git assumed present |
| Self-update command | npm install -g github:owner/repo#main | Standard npm pattern; handles build + link |
| Post-update behavior | Continue with loaded code (no re-exec) | Simple; safe; eliminates loop risk |
| Config persistence | Read-merge-write saveConfig | Preserves existing fields; fixes lossy save bug |
| Version reading | readFileSync + fileURLToPath | ESM-compatible; Node >=18 built-in; no experimental features |
| Install-mode detection | Metadata in config, written on first successful update | Deterministic; fail-closed when missing |
| Loop prevention | Architectural (no re-exec) + HLX_SKIP_UPDATE_CHECK env var | Zero-cost safety net |
| New dependencies | None (zero runtime deps added) | Uses Node builtins + system git/npm |
| prepare script | Add "prepare": "npm run build" | Required for git-based npm install to compile TS |
| Command surface | hlx update with --enable-auto/--disable-auto flags | Keeps update settings under update namespace |
| Repo scope | helix-cli only; helix-global-server unchanged | Ticket constraint; confirmed by diagnosis |

## APL Statement Reference

The technical direction for HLX-316 is fully resolved. All changes are scoped to helix-cli. The implementation uses git ls-remote for rate-limit-free SHA checks, npm install -g from GitHub shorthand for self-update, a read-merge-write config pattern to fix the lossy saveConfig, and readFileSync with import.meta.url for ES-module-compatible version reading. A prepare script must be added to package.json to enable git-based npm install to compile TypeScript. Install-source metadata persisted in ~/.hlx/config.json gates auto-update eligibility. Loop prevention is handled architecturally (no re-exec) with an env-var safety guard. New code lives in src/update/ modules. No runtime dependencies are added.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Primary specification with requirements, constraints, acceptance criteria | All changes scoped to helix-cli; update source is GitHub main commit SHA; autoUpdate in ~/.hlx/config.json; no npm/server checks; commit SHA is update identity |
| diagnosis/apl.json (helix-cli) | Evidence-backed answers to diagnostic questions | saveConfig is lossy (confirmed); no existing update code; hxFetch not reusable for GitHub; viable update mechanism is npm install -g github:...; ES module version reading via readFileSync + fileURLToPath |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis of 4 blocking issues | Version drift bug (hardcoded 0.1.0 vs 1.2.0); lossy config system blocks new features; update is entirely greenfield; HTTP client not reusable for GitHub API |
| product/product.md (helix-cli) | Product vision, use cases, success criteria, open questions | 6 open technical questions deferred to tech-research; rate-limiting acknowledged as MVP risk; fail-closed principle for update eligibility |
| scout/reference-map.json (helix-cli) | File-level analysis with confirmed facts and unknowns | 12 confirmed facts including Node >=18, ES modules, zero runtime deps; 6 unknowns about install-mode detection, update mechanism, version reading |
| scout/scout-summary.md (helix-cli) | High-level codebase analysis and boundary identification | 7 key boundaries: version drift, lossy config, no update infra, HTTP not reusable, ES module context, dispatcher hook point, no tests |
| repo-guidance.json (helix-global-server) | Repo intent classification | helix-cli is target; helix-global-server is context-only with no changes needed |
| src/index.ts (helix-cli) | CLI entry point — direct code inspection | Confirmed hardcoded "0.1.0" at line 47; switch dispatcher at lines 28-53; auto-update hook insertion point identified |
| src/lib/config.ts (helix-cli) | Config module — direct code inspection | Confirmed HxConfig has only {apiKey, url}; saveConfig overwrites entire file; CONFIG_DIR = ~/.hlx |
| src/lib/http.ts (helix-cli) | HTTP client — direct code inspection | Confirmed Helix-specific auth headers; not reusable for GitHub; retry pattern is reference material |
| package.json (helix-cli) | Package metadata — direct inspection | version=1.2.0; type=module; no runtime deps; bin entry hlx=dist/index.js; files=["dist"]; no prepare script |
| tsconfig.json (helix-cli) | Build config — direct inspection | module=Node16; strict=true; outDir=dist; rootDir=src; include=["src"] |
| src/login.ts (helix-cli) | Reference for exec and saveConfig patterns | child_process.exec precedent (line 3); saveConfig with {apiKey, url} only (lines 38, 107) |
| npm CLI docs (Context7) | Verified npm behavior for GitHub installs and prepare lifecycle | Confirmed: git deps get devDeps installed + prepare run; documented pattern matches our approach exactly |
| /tmp/helix-inspect/manifest.json | Runtime inspection availability check | Only helix-global-server has inspection (DATABASE, LOGS) — not relevant to CLI-only ticket |

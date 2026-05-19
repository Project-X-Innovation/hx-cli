# Tech Research — BLD-517: Install and update hlx from GitHub main instead of npm

## Technology Foundation

- **Language/Runtime**: TypeScript (ES2022 target, Node16 module system), Node.js >= 18
- **Build**: `tsc` via `prepare` script in package.json — npm automatically runs `prepare` after cloning a git URL, so the build step is already handled
- **Module system**: ESM (`"type": "module"` in package.json)
- **Config persistence**: JSON file at `~/.hlx/config.json`, read-merge-write via `saveConfig()`
- **External tools**: `git` CLI (for `git ls-remote`), `npm` CLI (as installer only — registry is not used)
- **No database/ORM**: Pure CLI tool with filesystem-based config

## Architecture Decision

### Options Considered

**Option A: Minimal rewiring — Replace data sources, keep flow structure (Chosen)**
- Replace `fetchLatestVersion()` calls with `fetchRemoteSha()` in both `runUpdate()` and `checkAutoUpdate()`
- Replace `isNewerVersion()` (semver) with direct SHA string comparison
- Change the install spec in `performUpdate()` from `NPM_PACKAGE@latest` to `git+CANONICAL_REPO_URL#CANONICAL_BRANCH`
- Extend `getPackageVersion()` to append SHA from config
- Add migration detection inline in the existing update flow
- Remove unused npm-specific functions

**Option B: Abstract update source behind a provider interface**
- Create an `UpdateSource` interface with `fetchRemoteRef()`, `isUpdateAvailable()`, `getInstallSpec()` methods
- Implement `GitHubUpdateSource` and (deprecated) `NpmUpdateSource`
- Wire update flows to use the interface

**Option C: Separate migration command**
- Add a new `hlx migrate` command for npm-to-GitHub transition
- Keep `hlx update` simpler by not handling migration inline

### Chosen Option: A — Minimal rewiring

**Rationale**: The codebase already contains the git-based primitives (`fetchRemoteSha`, `isUpdateAvailable`, `CANONICAL_*` constants, `InstallSource.commit` type field). The change is to wire them into the existing update flows and remove the npm-specific counterparts. There is exactly one update source going forward (GitHub main), so an abstraction layer (Option B) adds complexity with no benefit. The migration path (Option C as separate command) adds user friction — the ticket requires transparent migration on `hlx update`, not a separate command.

## Core API/Methods

### Functions to modify

| Function | File | Current Behavior | New Behavior |
|----------|------|-----------------|-------------|
| `runUpdate()` | `src/update/index.ts` | Calls `fetchLatestVersion()` (npm view) + `isNewerVersion()` (semver) | Calls `fetchRemoteSha()` + SHA comparison; detects migration; records `{mode:"github"}` |
| `checkAutoUpdate()` | `src/update/index.ts` | Same npm-based comparison | Same SHA-based comparison; silent migration |
| `performUpdate()` | `src/update/perform.ts` | Install spec: `@projectxinnovation/helix-cli@latest` | Install spec: `git+https://github.com/Project-X-Innovation/helix-cli.git#main` |
| `getPackageVersion()` | `src/update/version.ts` | Returns semver from package.json | Returns `<semver> (<short-sha>)` when commit is in config; semver-only otherwise |

### Functions to remove

| Function | File | Reason |
|----------|------|--------|
| `fetchLatestVersion()` | `src/update/check.ts` | Queries npm registry — zero callers after switch |
| `isNewerVersion()` | `src/update/check.ts` | Semver comparison — replaced by SHA comparison |

### Constants to change

| Constant | File | Action |
|----------|------|--------|
| `NPM_PACKAGE` | `src/update/check.ts` | Remove — no longer needed for install spec or npm view |
| (new) `GIT_INSTALL_SPEC` | `src/update/check.ts` | Add: composed as `` `git+${CANONICAL_REPO_URL}#${CANONICAL_BRANCH}` `` |

### Functions unchanged

| Function | File | Why Unchanged |
|----------|------|--------------|
| `validateInstall()` | `src/update/validate.ts` | Path construction uses package name (`@projectxinnovation/helix-cli`); npm places git-installed packages using the `name` field from package.json, so the path is identical |
| `isCanonicalSource()` | `src/update/index.ts` | Already accepts both `mode:"npm"` and `mode:"github"` — needed for auto-update to handle npm-sourced users before they explicitly migrate |
| `fetchRemoteSha()` | `src/update/check.ts` | Already correct — no changes needed |
| `isUpdateAvailable()` | `src/update/check.ts` | Already correct; used internally for convenience but `runUpdate()` should call `fetchRemoteSha()` directly for fail-closed null handling |
| `saveConfig()` | `src/lib/config.ts` | Read-merge-write already correct; `InstallSource` type already has `commit` field |

## Technical Decisions

### 1. runUpdate() uses fetchRemoteSha() directly, not isUpdateAvailable()

**Decision**: `runUpdate()` calls `fetchRemoteSha()` and checks for `null` explicitly.

**Rationale**: `isUpdateAvailable()` (check.ts:73-85) returns `{available: false, remoteSha: null}` when the fetch fails. This conflates "up to date" with "fetch error." For `runUpdate()`, which must fail-closed on fetch failure (ticket invariant), the caller needs to distinguish these cases. Calling `fetchRemoteSha()` directly and checking `null` makes the fail-closed logic explicit.

**Rejected alternative**: Using `isUpdateAvailable()` with post-hoc null check on `remoteSha`. This works but is less clear — the `available: false` return for failures is misleading.

### 2. checkAutoUpdate() silently skips on fetch failure

**Decision**: `checkAutoUpdate()` calls `fetchRemoteSha()` and returns silently when `null`.

**Rationale**: The ticket requires non-blocking behavior: "warn and continue on any failure, never block command dispatch." When `fetchRemoteSha()` returns `null`, there's nothing actionable — the user continues with their command. A stderr warning may optionally be emitted per ticket's "auto-update pre-command check logs a warning to stderr."

### 3. Migration is inline, not a separate code path

**Decision**: Migration detection is a conditional check within `runUpdate()` and `checkAutoUpdate()`, not a separate function or command.

**Rationale**: The migration logic is minimal: detect `installSource` is missing or `mode:"npm"`, print a notice (in `runUpdate()` only — auto-update is quiet), and proceed with the normal install flow. The install itself is identical for migration and regular updates. Extracting a separate migration function would add indirection with no benefit.

**Flow for migration in `runUpdate()`**:
1. Fetch remote SHA — if null, exit non-zero
2. Load config, read `installSource`
3. If installSource is missing or `mode:"npm"`: print one-line migration notice
4. Read local SHA from `installSource.commit` (undefined for npm-sourced installs)
5. If local SHA equals remote SHA: "Already up to date" (only possible for already-migrated installs)
6. If different or absent: run `performUpdate()`, validate, record `{mode:"github", repo, branch, commit}`

### 4. GIT_INSTALL_SPEC composed from existing constants

**Decision**: Add a new constant `GIT_INSTALL_SPEC` in `check.ts` composed from `CANONICAL_REPO_URL` and `CANONICAL_BRANCH`.

**Rationale**: Single source of truth for the install spec. The value is `git+https://github.com/Project-X-Innovation/helix-cli.git#main`. Using the existing constants avoids duplication and ensures the install spec and the `git ls-remote` target always point to the same repo/branch.

**Rejected alternative**: Hardcoding the URL string in `performUpdate()`. This duplicates the repo URL already defined in `CANONICAL_REPO_URL`.

### 5. getPackageVersion() reads SHA from config, not from build-time injection

**Decision**: `getPackageVersion()` calls `loadFullConfig()` to read `installSource.commit` from `~/.hlx/config.json`.

**Rationale**: The ticket explicitly specifies the SHA is "drawn from the same config field." Build-time injection (e.g., writing a git-sha.json during build) would require changes to the build pipeline and would show the SHA of the package build, not the SHA of the installed commit. The config approach is consistent with how the update flow already tracks state.

**Fallback behavior**: If `installSource.commit` is missing (legacy npm installs, fresh installs before first `hlx update`), return the semver only. The ticket specifies a "one-line note to run `hlx update` to refresh install metadata" for this case.

### 6. NPM_PACKAGE constant and npm functions removed

**Decision**: Remove `NPM_PACKAGE`, `fetchLatestVersion()`, and `isNewerVersion()` from `check.ts`.

**Rationale**: After the switch, these have zero callers. Leaving dead code that references the npm registry creates confusion about whether the registry is still used. Clean removal makes the intent clear.

**Note**: `perform.ts` currently imports `NPM_PACKAGE`. This import must be updated to use the new `GIT_INSTALL_SPEC` constant.

### 7. Install-source recording format

**Decision**: After successful install, record:
```json
{
  "mode": "github",
  "repo": "Project-X-Innovation/helix-cli",
  "branch": "main",
  "commit": "<40-char-sha>"
}
```

**Rationale**: The `InstallSource` type (config.ts:5-11) already defines these fields. Using the full 40-character SHA (as returned by `fetchRemoteSha()`) for the `commit` field provides unambiguous identification. The `repo` and `branch` fields enable `isCanonicalSource()` to verify the install is from the expected source. The `version` field is omitted — semver is still readable from `package.json` at runtime and does not need to be duplicated in config.

## Cross-Platform Considerations

- **git binary**: `fetchRemoteSha()` shells out to `git ls-remote`. Git must be on PATH. This is already a codebase assumption (the function exists today) and is reasonable for a developer CLI tool.
- **npm global install path**: npm places packages under `<npm root -g>/node_modules/` using the `name` field from `package.json`. This is consistent across macOS, Linux, and Windows. `validateInstall()` uses `npm root -g` to resolve the path dynamically, so it works across platforms.
- **GitHub authentication**: The HTTPS git URL (`git+https://github.com/...`) requires GitHub credentials. npm picks up the user's configured credential helper (e.g., `gh auth login` for HTTPS). SSH URLs are also valid but not the documented canonical form.
- **Shell: true in spawnSync**: Both `performUpdate()` and `validateInstall()` use `shell: true` for spawning npm commands. This is necessary for `npm install -g` to work correctly across platforms.

## Performance Expectations

| Operation | Expected Duration | Notes |
|-----------|-------------------|-------|
| `fetchRemoteSha()` | < 2s typical | `git ls-remote` is lightweight — single network round-trip, no auth token needed for public-like access. 10s timeout configured. |
| `performUpdate()` | 30-90s | Clones full repo, installs devDependencies (typescript), runs `tsc` build. Longer than registry install. This is the main performance tradeoff. |
| `getPackageVersion()` with SHA | < 5ms | Reads `~/.hlx/config.json` (local filesystem I/O) |
| `validateInstall()` | < 5s | Runs `npm root -g` + file existence check + `node <bin> --version` |

**Key tradeoff**: Installing from a git URL is slower than from the npm registry because it clones the full repository and runs a build step. This is acceptable because: (a) updates happen infrequently, (b) the user gets a progress indicator (non-quiet mode inherits stdio), and (c) the alternative (registry) is being abandoned due to pipeline fragility.

**Mitigation**: The 120-second timeout on `performUpdate()` (perform.ts:18) is already configured and appropriate for git-based installs.

## Dependencies

### Runtime dependencies (unchanged)

| Dependency | Version | Purpose |
|------------|---------|---------|
| `node` | >= 18 | Runtime |
| `git` | Any recent | `git ls-remote` for SHA fetch |
| `npm` | Any recent | Installer (clone, build, link bin) |

### Build dependencies (unchanged)

| Dependency | Version | Purpose |
|------------|---------|---------|
| `typescript` | ^6.0.2 | Compile TS → JS via `prepare` script |
| `@types/node` | ^25.5.0 | Type definitions |

### No new dependencies

This change introduces no new npm packages. It rewires existing code to use existing git-based functions. The only "new" dependency is that npm must be able to reach GitHub (not the npm registry) — which is a transport change, not a package dependency.

## Deferred to Round 2

| Item | Reason |
|------|--------|
| Removing dead CI workflows (auto-tag.yml, publish.yml) | Explicitly out of scope per ticket |
| Removing `publishConfig` from package.json | Out of scope — cosmetic cleanup |
| Adding tests for the update module | No tests exist today; adding them is an implementation consideration but not gated by this ticket |
| Update frequency throttling | Future consideration if SHA checks become too chatty |
| Offline SHA caching | Future optimization to reduce network calls |
| README.md creation | No README.md exists; ticket scope covers in-repo documentation surfaces only |

## Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Update comparison mechanism | SHA string comparison via `fetchRemoteSha()` | Replaces semver; aligns with "every merge to main is shippable" |
| Install transport | `npm install -g git+https://...#main` | npm handles clone, devDeps, prepare/tsc, bin linking |
| Install spec constant | `GIT_INSTALL_SPEC` in check.ts from existing constants | Single source of truth, avoids URL duplication |
| Fail-closed behavior | `runUpdate()` checks `fetchRemoteSha()` null explicitly | Ticket invariant: update must never silently assume success |
| Auto-update failure behavior | Silent skip on null SHA | Ticket invariant: never block command dispatch |
| Migration approach | Inline detection in update flow | Minimal code; migration install is identical to regular update |
| Version display SHA source | Read from `~/.hlx/config.json` installSource.commit | Ticket specifies "drawn from the same config field" |
| npm functions cleanup | Remove fetchLatestVersion, isNewerVersion, NPM_PACKAGE | Zero callers after switch; dead code removal |
| validateInstall() | No changes | npm places git-installed packages by package name — same path |
| isCanonicalSource() | No changes | Must continue accepting mode:"npm" for auto-update migration |
| Documentation updates | 12 locations across 7 files | All npm-referencing text updated to git+https URL |

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | npm places git-installed packages at a different global path than registry installs | Low | High (validateInstall fails, update appears broken) | npm docs confirm package name determines directory; verified via Context7. Verify empirically during implementation. |
| 2 | npm does not install devDependencies for global git URL installs, causing `tsc` build to fail | Low | High (install fails, no working binary) | npm docs confirm devDeps are installed to run prepare scripts. npm test during implementation will confirm. |
| 3 | No update-module tests — regression risk during rewiring | Medium | Medium (subtle bugs in update/migration flow) | Manual testing against acceptance criteria is required. Test addition is an implementation consideration. |
| 4 | Slow installs from git URL (clone + build) frustrate users | Medium | Low (cosmetic UX concern, not functional) | 120s timeout is appropriate. Progress output shown in non-quiet mode. Updates are infrequent. |
| 5 | GitHub authentication not configured for HTTPS credential helper | Low | Medium (install/update fails for affected users) | Ticket states users are expected to have GitHub auth. Error message should include auth troubleshooting hint. |

## APL Statement Reference

The update system rewiring is a well-contained change within the `src/update/` module plus documentation surfaces. The existing git primitives (`fetchRemoteSha`, `isUpdateAvailable`, `CANONICAL_*` constants, `InstallSource.commit` config field) provide the foundation. The key technical decisions are: (1) `runUpdate()` calls `fetchRemoteSha()` directly with explicit null-check for fail-closed behavior; (2) `performUpdate()` uses a new `GIT_INSTALL_SPEC` constant; (3) install source recording switches to `{mode:"github", repo, branch, commit}`; (4) migration is inline within the normal update flow with a conditional notice; (5) `getPackageVersion()` reads SHA from config; (6) npm-specific functions and the `NPM_PACKAGE` constant are removed from `check.ts`. `validateInstall()` and `isCanonicalSource()` require no changes. 12 documentation and error-message locations across 7 files need text updates.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification with decisions, invariants, acceptance criteria | SHA-based comparison, git+https install, transparent npm migration, fail-closed semantics, --version with SHA |
| scout/reference-map.json | Detailed file map, facts, and unknowns from scout | Identified 12 npm-referencing locations across 7 files; confirmed git primitives already exist but are unused; flagged validateInstall() path question |
| scout/scout-summary.md | Synthesized scout analysis | Confirmed no README.md, no update tests, prepare script critical for git installs |
| diagnosis/apl.json | Answered diagnostic questions with evidence | Confirmed fetchRemoteSha/isUpdateAvailable exist; npm uses package name for directory placement; detailed migration approach |
| diagnosis/diagnosis-statement.md | Root cause analysis and evidence-backed change plan | Mapped all code paths needing change with line numbers; confirmed validateInstall() likely unchanged; catalogued all doc/error locations |
| product/product.md | Product vision, use cases, success criteria | Defined fail-closed vs fail-open behavior split; confirmed single repo scope; identified migration as inline, not separate command |
| repo-guidance.json | Repo intent classification | Confirmed helix-cli is sole target repo; no cross-repo impact |
| src/update/check.ts (direct) | Verified git primitives and npm functions | fetchRemoteSha() at lines 54-68 uses git ls-remote with 10s timeout; isUpdateAvailable() at lines 73-85 conflates fetch failure with "up to date" |
| src/update/index.ts (direct) | Verified update flow structure | runUpdate() and checkAutoUpdate() use npm-based flow; isCanonicalSource() accepts both modes; recovery commands hardcode npm |
| src/update/perform.ts (direct) | Verified install execution | spawnSync with shell:true, 120s timeout, HLX_SKIP_UPDATE_CHECK env var for loop prevention |
| src/update/validate.ts (direct) | Verified validation path construction | Uses npm root -g + @projectxinnovation/helix-cli/dist/index.js — works for git installs |
| src/update/version.ts (direct) | Verified version display function | Reads semver from package.json via relative path; no config access currently |
| src/lib/config.ts (direct) | Verified config schema and persistence | InstallSource type has commit field (line 9); saveConfig does read-merge-write; loadFullConfig returns raw config |
| src/index.ts (direct) | Verified CLI entry point and version display | --version at line 124 prints getPackageVersion(); usage text at line 60 references npm |
| package.json (direct) | Verified build/install mechanics | prepare script runs npm run build (tsc); name is @projectxinnovation/helix-cli; no runtime deps |
| npm docs (Context7) | Verified npm behavior for git URL installs | npm clones repo, installs devDeps for prepare script, builds, places under package name in node_modules |

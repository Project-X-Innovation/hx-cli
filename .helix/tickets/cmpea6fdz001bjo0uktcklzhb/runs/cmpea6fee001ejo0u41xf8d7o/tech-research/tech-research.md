# Tech Research — BLD-527: Replace hlx self-update with GitHub release assets

## Technology Foundation

- **Runtime:** Node.js >= 18 (package.json `engines.node`). Native `fetch()` is available for HTTP requests.
- **Language:** TypeScript 6.x compiled to ES2022, ESM (`"type": "module"`).
- **Module resolution:** Node16 (`tsconfig.json`).
- **Package structure:** Zero production dependencies. `devDependencies` only: `@types/node` and `typescript`.
- **Platform targets:** macOS, Linux, Windows 10+ (same as current `hlx` user base).
- **CI:** GitHub Actions. Existing workflows: `auto-tag.yml` (to be removed), `publish.yml` (to be preserved).
- **Config storage:** `~/.hlx/config.json` with read-merge-write pattern via `saveConfig()`.

## Architecture Decision

### Options Considered

#### Option A: GitHub Releases with Rolling `latest` Tag (CHOSEN)

Every push to `main` produces a tarball uploaded as a GitHub Release asset under the tag `latest`. The updater queries the GitHub REST API for this release, compares commit SHAs, and downloads the asset if an update is available.

**Pros:**
- Release assets are permanent — no expiration.
- Tag `latest` does NOT match `v*` in `publish.yml`, so no accidental npm publish.
- `GITHUB_TOKEN` with `contents: write` can create/manage releases — no custom secret needed.
- One API call (`GET /repos/{owner}/{repo}/releases/tags/latest`) returns both the commit SHA and asset download URL.
- Works for both public and private repos (with auth for private).
- Well-established pattern for rolling-latest releases (confirmed via GitHub Actions documentation).

**Cons:**
- Force-moves the `latest` tag on every build (minor git history noise, but the tag is non-semantic).
- Concurrent main pushes could race (mitigated by GitHub Actions' per-branch concurrency).

#### Option B: GitHub Actions Artifacts (REJECTED)

Upload the tarball as a workflow artifact via `actions/upload-artifact`.

**Rejected because:**
- Actions artifacts expire after 90 days by default (configurable max varies by plan).
- Downloading artifacts requires authenticated GitHub API access, even for public repos.
- No stable URL — artifacts are identified by workflow run ID, requiring multi-step API discovery.
- Not suitable as a permanent update channel.

#### Option C: Pre-release with Semantic Version Tag (REJECTED)

Create a pre-release with a tag like `v0.0.0-main.YYYYMMDD`.

**Rejected because:**
- The tag matches `v*`, which would trigger `publish.yml` and attempt npm publish.
- Would require modifying `publish.yml` to skip pre-releases, adding coupling.

#### Option D: GitHub Packages (npm) (REJECTED)

Publish a pre-release package to GitHub Packages on each main push.

**Rejected because:**
- GitHub Packages npm registry requires auth for all installs from private orgs.
- Adds complexity over a simple tarball download.
- Re-introduces npm as a dependency in the update path, contrary to ticket requirements.

### Chosen Option: A — GitHub Releases with Rolling `latest` Tag

**Rationale:** Simplest mechanism that satisfies all ticket requirements. Permanent assets, standard token, clean separation from the npm publish path, and a well-established pattern.

## Core API/Methods

### CI Workflow (build-release.yml)

New workflow triggered on `push to main`:

1. Checkout, setup Node.js, `npm ci`, `npm test` (reuses existing build/test scripts).
2. Generate `build-metadata.json` with `{ "commit": "$GITHUB_SHA", "builtAt": "<ISO timestamp>" }`.
3. Create tarball: `tar -czf helix-cli.tgz dist/ skill-content/ package.json build-metadata.json` (excluding test files).
4. Publish release:
   - Delete existing `latest` release and tag: `gh release delete latest --yes --cleanup-tag || true`
   - Create new release: `gh release create latest helix-cli.tgz --title "Latest main build" --notes "Commit: $GITHUB_SHA" --target $GITHUB_SHA`
5. Permissions: `contents: write` (sufficient for `gh release create`).
6. Concurrency: `group: build-release, cancel-in-progress: true` to prevent race conditions on rapid pushes.

### Updater Module Rewrite (src/update/)

**check.ts** — Replace `fetchRemoteSha()`:
- New function `fetchLatestRelease()` calls `GET https://api.github.com/repos/Project-X-Innovation/helix-cli/releases/tags/latest`.
- Uses Node.js native `fetch()` (available on Node >= 18).
- Returns `{ commitSha, assetUrl, assetId } | null`.
- Auth: passes `Authorization: Bearer <token>` header if token is available; omits header for public repos.
- Remove `GIT_INSTALL_SPEC` constant (no longer needed).
- Keep `CANONICAL_REPO_URL`, `CANONICAL_REPO`, `CANONICAL_BRANCH` constants for reference.

**perform.ts** — Replace `performUpdate()`:
- New function `performStagedUpdate(assetUrl, commitSha, token?)`:
  1. Create staging dir: `~/.hlx/staging/<commitSha>/`
  2. Download tarball via `fetch()` to staging dir.
  3. Extract via `tar -xzf <tarball> -C <staging-dir>` using `execSync`.
  4. Call `validateStaged(stagingDir)` (from validate.ts).
  5. If valid: execute rename-based swap at the install root.
  6. If invalid: clean up staging, return failure.
  7. Clean up staging and backup dirs on success.
- Returns `{ success: boolean; error?: string }`.

**validate.ts** — Replace `validateInstall()`:
- New function `validateStaged(stagingDir)`:
  1. Check `<stagingDir>/dist/index.js` exists.
  2. Run `node <stagingDir>/dist/index.js --version` with `HLX_SKIP_UPDATE_CHECK=1`.
  3. Verify non-zero output and exit code 0.
- Returns `{ valid: boolean; error?: string }`.

**index.ts** — Update orchestration:
- `runUpdate()`: Call `fetchLatestRelease()` instead of `fetchRemoteSha()`. Call `performStagedUpdate()` instead of `performUpdate()`. Update error messages to remove npm references.
- `checkAutoUpdate()`: Same flow changes, fail-open behavior preserved.
- Remove `GIT_INSTALL_SPEC` import.

**version.ts** — No changes needed. Already resolves package root via `import.meta.url` and reads commit SHA from config.

### Install Root Discovery

The updater determines its own install location using `import.meta.url`:

```
import.meta.url → file:///path/to/dist/update/perform.js
dirname(fileURLToPath(...)) → /path/to/dist/update/
join(..., '..', '..') → /path/to/  ← package install root
```

This pattern is already used in `version.ts:18` and `paths.ts:18`. It works regardless of whether the CLI was installed via npm global, direct download, or other means.

### GitHub Auth Token Discovery

Token discovery order (try each, use first non-empty):
1. `process.env.GITHUB_TOKEN`
2. `process.env.GH_TOKEN`
3. `execSync('gh auth token', { timeout: 5000 }).toString().trim()` — if `gh` CLI is installed.
4. `null` — proceed without auth (works for public repos).

Auth is optional for public repos. For private repos, the updater must have a token.

## Technical Decisions

### Decision 1: Replace git ls-remote with GitHub REST API

**Chosen:** Single GitHub REST API call for release metadata.

**Why:** The updater already needs the GitHub API for asset discovery/download. Consolidating SHA comparison into the same call removes the `git` binary dependency from user machines, reduces to a single network round-trip, and simplifies error handling.

**Rejected alternative:** Keep `git ls-remote` for SHA, add GitHub API only for download. This would maintain two separate network dependencies and require `git` on user machines.

### Decision 2: Rename-based Swap with Backup Directories

**Chosen:** Rename live `dist/` → `dist.bak/`, then rename staged `dist/` → `dist/`. Repeat for `skill-content/` and `package.json`. On any failure, restore from `.bak`.

**Why:** `fs.renameSync` is atomic on POSIX (within same filesystem). On Windows, renames succeed when no file handles are open. Node.js closes file handles after module import, so the running CLI does not hold locks on its own `.js` files. The `.bak` directories provide a clean rollback path if any swap step fails.

**Rejected alternative:** In-place overwrite file by file. No atomicity, no rollback, partial failure leaves a broken install.

**Rejected alternative:** Copy all files to a new directory and update a symlink. Adds symlink management complexity and requires admin/elevated permissions on some systems.

### Decision 3: System tar for Extraction

**Chosen:** Shell out to `tar -xzf` via `execSync`.

**Why:** The `tar` command is available on macOS (built-in), Linux (built-in), and Windows 10+ (built-in since build 17063, Dec 2017). Using the system `tar` avoids adding a production dependency to a zero-dependency project. The existing codebase already uses `child_process` for external commands (`spawnSync` for npm, `execSync` for git).

**Rejected alternative:** Add the `tar` npm package as a production dependency. This breaks the zero-dependency property and adds supply-chain surface area.

**Rejected alternative:** Implement tar parsing in pure JS. Over-engineering for this use case.

### Decision 4: build-metadata.json in Tarball

**Chosen:** Embed `{ "commit": "<sha>", "builtAt": "<ISO timestamp>" }` in the tarball.

**Why:** Allows offline commit SHA identification from the installed package, independent of the config file. The updater writes the commit SHA to config after successful install, but `build-metadata.json` provides a fallback and a source-of-truth for the build identity. Also useful for `hlx --version` to report the commit SHA even before config is written.

### Decision 5: No Changes to InstallSource Type

**Chosen:** Keep the existing `InstallSource` type unchanged.

**Why:** The type already has `mode: 'github' | 'npm' | 'unknown'`, `repo`, `branch`, and `commit` fields — all fields needed by the new updater. The `mode: 'github'` value correctly describes the new update source. No new fields are required.

Evidence: `src/lib/config.ts:5-11` — `InstallSource` type already includes `{ mode: 'github', repo?, branch?, commit?, version? }`.

### Decision 6: Concurrency Control in CI Workflow

**Chosen:** Add `concurrency: { group: build-release, cancel-in-progress: true }` to the workflow.

**Why:** If multiple pushes to `main` happen in rapid succession (e.g., merge queue), only the latest build should produce the release. Cancelling in-progress builds for the same group prevents race conditions where two builds try to delete/create the `latest` release simultaneously.

## Cross-Platform Considerations

| Concern | macOS / Linux | Windows 10+ |
|---------|---------------|-------------|
| `tar` availability | Built-in | Built-in since build 17063 |
| File rename atomicity | Atomic (same FS) | Succeeds when no open handles |
| File locking on `.js` files | No issue — Node closes handles after import | No issue — same behavior |
| `~/.hlx/staging/` path | `$HOME/.hlx/staging/` | `%USERPROFILE%\.hlx\staging\` (Node `homedir()`) |
| `gh` CLI for token fallback | Common but optional | Common but optional |
| Native `fetch()` | Node >= 18 | Node >= 18 |

**Mitigation for Windows rename edge cases:** If `fs.renameSync` fails on Windows (e.g., antivirus holds a handle), retry once after 500ms. If still failing, abort with guidance: "Close any programs accessing the hlx installation directory and retry."

## Performance Expectations

| Operation | Expected Duration | Notes |
|-----------|-------------------|-------|
| GitHub API release query | 200-500ms | Single HTTPS request |
| SHA comparison (local config read) | <5ms | File read from `~/.hlx/config.json` |
| Tarball download | 1-5s | Tarball ~500KB-1MB (dist/ + skill-content/), depends on network |
| Tarball extraction | <1s | Small archive, system tar |
| Staged validation (--version) | 200-500ms | Spawns node process |
| Rename-based swap | <50ms | Filesystem renames |
| **Total update time** | **~3-8s** | Down from 30-120s+ (current npm install -g) |

Auto-update adds ~0.5-1s to command startup when a check is needed (API call + SHA comparison). No download occurs if already up to date.

## Dependencies

### New Dependencies

None. The implementation uses only Node.js built-in APIs:
- `fetch()` — native in Node >= 18 (HTTP requests)
- `fs` — file operations (rename, exists, mkdir, read, write)
- `child_process` — `execSync` for tar extraction and validation subprocess
- `path`, `url`, `os` — path manipulation and platform detection

### Existing Dependencies Preserved

- Zero production dependencies (package.json `devDependencies` only).
- `GITHUB_TOKEN` (built-in to GitHub Actions, no custom secret).

### Dependencies Removed

- `git` binary dependency on user machines (replaced by GitHub REST API via `fetch`).
- `npm` dependency for update execution (replaced by tarball download + extract).
- `RELEASE_TOKEN` secret (auto-tag.yml is removed; new workflow uses `GITHUB_TOKEN`).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub API rate limits (60/hr unauth) | Low | Medium — users blocked from checking updates | Auth token increases to 5000/hr. Auto-update checks are infrequent. Manual retry works. |
| Antivirus holds file handle during swap on Windows | Low | Medium — swap fails, update aborts | Retry once after 500ms; report clear error with guidance; `.bak` dirs provide rollback. |
| Concurrent CI builds race on `latest` release | Low | Low — one build wins, both are from main | `concurrency: cancel-in-progress: true` ensures only the latest build completes. |
| Private repo without auth token | Medium | Medium — update fails | Explicit auth error message with specific guidance (ticket requirement). No silent fallback. |
| Tarball corruption during download | Very Low | Medium — validation catches it | Staged validation runs `--version` before swap. Corrupt tarball fails extraction or validation. |
| `tar` not available on user's system | Very Low | High — extraction fails | Available on all modern OS. Clear error message if missing. |
| Staging directory on different filesystem than install root | Low | Low — rename fails, falls back to copy | Detect cross-filesystem case (EXDEV error); use copy+delete instead of rename. |

## Deferred to Round 2

- **Platform-specific binary builds:** The MVP produces a universal Node.js tarball. Per-OS compiled binaries (via `pkg`, `bun compile`, or `node --sea`) could be explored if startup performance or standalone distribution becomes important.
- **Delta/incremental updates:** Full tarball download every time. Diff-based updates could reduce bandwidth if artifact size grows significantly.
- **Explicit rollback command:** `hlx rollback` is not part of MVP. The backup mechanism exists during swap but is cleaned up after success.
- **Update channels:** MVP supports only the `main` channel. Named channels (e.g., `beta`, `canary`) could be added by publishing additional release tags.
- **Update telemetry:** Success/failure rates are not tracked. Could be added to monitor update health.
- **Initial install from GitHub release:** The ticket focuses on `hlx update` (users already have hlx installed). A new user install script (curl-pipe-sh or similar) for GitHub release assets is out of scope.

## Summary Table

| Area | Decision | Key Detail |
|------|----------|------------|
| **Artifact host** | GitHub Releases, rolling `latest` tag | Permanent assets, tag avoids `v*` trigger, GITHUB_TOKEN sufficient |
| **CI workflow** | New `build-release.yml`, delete `auto-tag.yml` | Build → test → tarball → `gh release create latest` with concurrency control |
| **Preserve** | `publish.yml` unchanged | Manual `v*` tag push continues to trigger npm publish |
| **SHA comparison** | GitHub REST API replaces `git ls-remote` | `GET /repos/{owner}/{repo}/releases/tags/latest` — one call for SHA + download URL |
| **Download** | Node.js native `fetch()` | No new dependencies, available on Node >= 18 |
| **Extraction** | System `tar -xzf` via `execSync` | Available on macOS, Linux, Windows 10+; preserves zero-dep property |
| **Staging** | `~/.hlx/staging/<sha>/` | Isolated validation before touching live install |
| **Swap** | Rename-based with `.bak` backup dirs | Atomic on POSIX, reliable on Windows, rollback on failure |
| **Validation** | `dist/index.js` exists + `--version` runs | Minimum viable per ticket requirements |
| **Auth** | `GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token` | Explicit error messaging for private repos |
| **Install root** | `import.meta.url` resolution | Already proven in `version.ts` and `paths.ts` |
| **Config** | Existing `InstallSource` type, no changes | `mode: 'github'` + commit SHA already supported |
| **Error messages** | 6 files updated | Remove all `npm install -g git+https://...` references |
| **Tests** | No existing update tests | New tests needed for staged update mechanism |

### Files Changed

| File | Change |
|------|--------|
| `.github/workflows/build-release.yml` | **New** — CI build + GitHub Release publish on main push |
| `.github/workflows/auto-tag.yml` | **Delete** — remove auto-tag workflow |
| `.github/workflows/publish.yml` | **No change** — preserve for manual npm releases |
| `src/update/check.ts` | **Rewrite** — GitHub REST API replaces `git ls-remote`; add auth token discovery |
| `src/update/perform.ts` | **Rewrite** — staged tarball download + extract + swap replaces `npm install -g` |
| `src/update/validate.ts` | **Rewrite** — validate staged directory replaces npm-global-path validation |
| `src/update/index.ts` | **Update** — new orchestration flow, updated error messages |
| `src/update/version.ts` | **No change** — already works with import.meta.url and config SHA |
| `src/lib/config.ts` | **No change** — InstallSource type already sufficient |
| `src/docs/cli-content.ts` | **Update** — replace npm install references (lines 18, 301) |
| `src/skill/show.ts` | **Update** — replace npm install recovery message (line 15) |
| `src/skill/paths.ts` | **Update** — replace npm install recovery message (line 25) |
| `skill-content/references/commands.md` | **Update** — if install instructions present |
| `src/index.ts` | **No change** — dispatches to update module, no direct npm references |
| `package.json` | **No change** — bin entry, scripts, files array all remain valid |

## APL Statement Reference

The update mechanism should use GitHub Releases with a rolling `latest` tag (not matching `v*`), built by a new CI workflow (`build-release.yml`) using `GITHUB_TOKEN` with `contents: write`. The updater replaces `git ls-remote` with a single GitHub REST API call to `GET /repos/{owner}/{repo}/releases/tags/latest`, which provides both the commit SHA and asset download URL. The staged install mechanism downloads the tarball to `~/.hlx/staging/`, validates via entrypoint existence and `--version` check, then does a rename-based swap with backup directories for rollback. Install-root discovery uses the proven `import.meta.url` pattern already in the codebase. Auth follows the standard `GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token` chain with explicit error messaging. The tarball contains `dist/`, `skill-content/`, `package.json`, and `build-metadata.json` — zero production dependencies means no `node_modules` needed.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements, acceptance criteria, non-negotiable invariants | Staged update required; failed update must never brick CLI; `latest` tag must not trigger npm publish; explicit auth error messaging required |
| `scout/reference-map.json` | File inventory, factual claims, open unknowns | 5 update module files to rewrite, 2 workflows (1 delete, 1 preserve), 6 hardcoded npm references, zero production dependencies, zero update tests |
| `scout/scout-summary.md` | Architecture overview of update module and CI/CD | Confirmed fail-open (auto) vs fail-closed (manual) patterns; `import.meta.url` for path resolution; `saveConfig()` read-merge-write pattern |
| `diagnosis/apl.json` | Root cause evidence and recommended architecture | Confirmed `npm install -g` is destructive with no staging; rolling `latest` tag won't trigger `publish.yml`; `GITHUB_TOKEN` + `contents: write` sufficient |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and change scope | 4 root causes identified; GitHub Releases recommended; staged download-validate-swap required |
| `product/product.md` | Product vision, use cases, success criteria | MVP features defined; open questions on private repo auth, Windows atomicity, install location discovery |
| `repo-guidance.json` | Repo intent classification | Single repo (`helix-cli`) is the sole change target |
| `src/update/perform.ts` | Current update executor source | Confirmed `spawnSync('npm install -g ...')` — the exact mechanism being replaced |
| `src/update/check.ts` | Remote SHA check source | Confirmed `git ls-remote` dependency and `GIT_INSTALL_SPEC` constant to remove |
| `src/update/index.ts` | Update orchestration source | Confirmed fail-open/fail-closed patterns, recovery messages with npm references |
| `src/update/validate.ts` | Post-update validation source | Entirely npm-path-dependent: resolves `npm root -g`, checks npm package path |
| `src/update/version.ts` | Version display source | Confirmed `import.meta.url` pattern for install root resolution; already supports SHA suffix |
| `src/lib/config.ts` | Config and InstallSource type | `InstallSource` already has mode/repo/branch/commit fields; no type changes needed |
| `src/skill/paths.ts` | Skill path resolution | Confirmed `import.meta.url` pattern; contains npm install recovery message to update |
| `src/skill/show.ts` | Skill show command | Contains npm install recovery message to update |
| `src/docs/cli-content.ts` | CLI documentation content | Two npm install references at lines 18 and 301 to replace |
| `src/index.ts` | CLI entry point | Confirmed auto-update call, SKIP_AUTO_UPDATE set, --version handling — no direct changes needed |
| `.github/workflows/auto-tag.yml` | Auto-tag workflow | Confirmed: push-to-main trigger, RELEASE_TOKEN usage — to be deleted |
| `.github/workflows/publish.yml` | npm publish workflow | Confirmed: `v*` tag trigger, OIDC trusted publishing — to be preserved unchanged |
| `package.json` | Project configuration | Confirmed prepare → tsc pipeline (root cause), zero production deps, bin entry, files array, engines >= 18 |
| `.npmignore` | Package exclusion rules | Test file exclusions inform tarball creation |
| Context7 GitHub Actions docs | GitHub Actions permissions and release creation | Confirmed `contents: write` permission supports `gh release create`; confirmed force-push tag pattern for rolling releases |

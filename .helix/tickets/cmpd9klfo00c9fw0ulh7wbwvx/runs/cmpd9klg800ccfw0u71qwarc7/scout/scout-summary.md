# Scout Summary — BLD-517: Install and update hlx from GitHub main instead of npm

## Problem

The `hlx` CLI currently installs and self-updates via the npm registry. The ticket requires switching both flows to install from the GitHub `main` branch via `npm install -g git+https://...`, replacing semver-based version comparison with SHA-based comparison, migrating existing npm-sourced installs transparently, and enhancing `--version` output to include the installed commit SHA.

## Analysis Summary

### Already-present infrastructure

The codebase already contains the git-based primitives needed for this change:
- `fetchRemoteSha()` in `src/update/check.ts` (lines 54-68) performs `git ls-remote` against the canonical repo URL
- `isUpdateAvailable()` in `src/update/check.ts` (lines 73-85) compares local vs remote SHA
- `CANONICAL_REPO_URL` and `CANONICAL_BRANCH` constants are defined in `src/update/check.ts`
- The `InstallSource` type in `src/lib/config.ts` already has a `commit` field, but it is never populated by the current update flow

### Current npm-dependent flows requiring change

1. **`runUpdate()`** (`src/update/index.ts`): Calls `fetchLatestVersion()` (npm registry) and `isNewerVersion()` (semver). Saves `{mode: "npm", version}`. Error messages reference npm.
2. **`checkAutoUpdate()`** (`src/update/index.ts`): Same semver-based comparison path. Saves `{mode: "npm", version}`.
3. **`performUpdate()`** (`src/update/perform.ts`): Runs `npm install -g @projectxinnovation/helix-cli@latest`.
4. **`fetchLatestVersion()`** (`src/update/check.ts`): Uses `npm view` to query the npm registry.
5. **`validateInstall()`** (`src/update/validate.ts`): Resolves bin target under `@projectxinnovation/helix-cli/` in global node_modules.
6. **`getPackageVersion()`** (`src/update/version.ts`): Returns semver only, no SHA.

### Documentation surfaces requiring update

12 locations across 7 files reference the npm registry install command or `@projectxinnovation` package name in install/reinstall/error contexts:
- `src/docs/cli-content.ts` (3 locations: install command, update description, troubleshooting)
- `src/update/index.ts` (2 locations: error messages)
- `src/update/check.ts` (2 locations: npm view command, package constant)
- `src/update/perform.ts` (1 location: install spec)
- `src/skill/show.ts` (1 location: reinstall error message)
- `src/skill/paths.ts` (1 location: reinstall error message)
- `skill-content/references/commands.md` (1 location: update description)

### Execution signals

| Signal | Value |
|--------|-------|
| Package manager | npm |
| Build | `tsc` (via `prepare` script) |
| Typecheck | `tsc --noEmit` |
| Test | `tsc && node --test dist/**/*.test.js` |
| CI | auto-tag.yml + publish.yml (out of scope) |
| Node engine | >=18 |
| Module system | ESM (type: "module") |
| No ORM | No migration strategy needed |

### Key boundary: `prepare` script

The `package.json` `prepare` script runs `npm run build` → `tsc`. This is critical: npm automatically runs `prepare` after cloning a git URL, which means the build step is already handled by the git-based install transport. No additional build step is needed.

### Key boundary: validate path

`validateInstall()` constructs the bin target path as `<npm root -g>/@projectxinnovation/helix-cli/dist/index.js`. When npm installs from a git URL, whether the package lands at the same scoped path needs verification — this is flagged as an unknown.

### No existing update tests

There are no tests for the update module. Existing tests cover flag parsing (`flags.test.ts`), ticket resolution (`resolve-ticket.test.ts`), and skill installation (`skill.test.ts`).

### No README.md

The repo has no `README.md` file. Documentation lives in `src/docs/cli-content.ts` (embedded docs export) and `skill-content/` (agent skill files).

## Relevant Files

| File | Role |
|------|------|
| `src/update/index.ts` | Update command handler + auto-update check (primary change target) |
| `src/update/check.ts` | Version/SHA fetching and comparison functions (has both npm and git primitives) |
| `src/update/perform.ts` | Executes the actual `npm install -g` command |
| `src/update/validate.ts` | Post-install validation of bin target |
| `src/update/version.ts` | Reads package version (needs SHA enhancement) |
| `src/lib/config.ts` | InstallSource type, config read/write, config path |
| `src/index.ts` | CLI entry point, --version handler, usage text |
| `src/docs/cli-content.ts` | Embedded CLI documentation with install commands |
| `skill-content/references/commands.md` | Command reference documentation |
| `src/skill/show.ts` | Reinstall error message |
| `src/skill/paths.ts` | Reinstall error message |
| `package.json` | prepare script, publishConfig, bin mapping |
| `.github/workflows/auto-tag.yml` | CI auto-tag (out of scope, context only) |
| `.github/workflows/publish.yml` | CI npm publish (out of scope, context only) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification for the change | SHA-based comparison, git+https install URL, migration for npm installs, fail-closed semantics, --version with SHA |
| package.json | Build/install mechanics | `prepare` script runs tsc, `bin` maps hlx → dist/index.js, publishConfig has npm registry |
| src/update/check.ts | Map existing git-based primitives | fetchRemoteSha() and isUpdateAvailable() already exist and are unused by the current update flow |
| src/update/index.ts | Map current update command flow | Uses npm registry semver check, saves mode:"npm", hardcoded npm error messages |
| src/update/perform.ts | Map current install execution | Runs npm install -g with NPM_PACKAGE@latest spec |
| src/update/validate.ts | Map post-install validation | Constructs @projectxinnovation/helix-cli path in global npm root |
| src/update/version.ts | Map version display | Returns semver only from package.json, no SHA |
| src/lib/config.ts | Map config schema and persistence | InstallSource type has commit field already, ~/.hlx/config.json path |
| src/index.ts | Map CLI entry and version display | --version prints getPackageVersion() directly, usage text references npm |
| src/docs/cli-content.ts | Map documentation surfaces | 3 npm install references to update |
| skill-content/references/commands.md | Map documentation surfaces | 1 npm reference in update command description |
| src/skill/show.ts | Map error message surfaces | npm reinstall command in error message |
| src/skill/paths.ts | Map error message surfaces | npm reinstall command in error message |
| .github/workflows/auto-tag.yml | CI context | Auto-tags on main push — becomes dead weight |
| .github/workflows/publish.yml | CI context | Publishes to npm on tags — becomes dead weight |
| tsconfig.json | Build config | ES2022 target, Node16 modules, dist/ output |

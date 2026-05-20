# Scout Summary — BLD-527: Replace hlx self-update with GitHub release assets

## Problem

The current `hlx update` and auto-update mechanism relies on `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`, which triggers the `prepare` script (→ `tsc`), fails when TypeScript toolchain is unavailable in the transient npm global install environment (especially Windows), and can brick the working CLI installation on failure. A separate `auto-tag.yml` workflow auto-pushes git tags on every `main` merge using a `RELEASE_TOKEN`, adding unwanted release friction. The ticket requires: (1) replacing the update mechanism with prebuilt GitHub release assets, (2) removing auto-tag, (3) ensuring failed updates never leave the CLI unusable.

## Analysis Summary

### Update System Architecture (5 files in src/update/)

The update module is cleanly separated into 5 files:

- **`check.ts`** — Defines canonical repo constants (`CANONICAL_REPO_URL`, `CANONICAL_BRANCH`, `GIT_INSTALL_SPEC`) and `fetchRemoteSha()` which uses `git ls-remote` to get the latest main HEAD SHA. No GitHub API dependency.
- **`perform.ts`** — Single function `performUpdate()` that runs `spawnSync('npm install -g git+https://...#main')` with 120s timeout. This is the core mechanism being replaced.
- **`validate.ts`** — Post-install validation resolves `npm root -g`, constructs path to `@projectxinnovation/helix-cli/dist/index.js`, checks file existence, and runs `node <path> --version`. Entirely npm-path-dependent.
- **`version.ts`** — Reads semver from package.json and appends commit SHA from config: `"1.3.4 (c8620a5)"`.
- **`index.ts`** — Orchestrates `runUpdate()` (manual, fail-closed with `process.exit(1)`) and `checkAutoUpdate()` (pre-command, fail-open with warn-and-return). Both call `performUpdate()` then `validateInstall()`, then persist `installSource` metadata to `~/.hlx/config.json`.

### CI/CD Workflows (2 files)

- **`auto-tag.yml`** — Triggers on push to main, reads version from package.json, creates and pushes `v{version}` tag using `secrets.RELEASE_TOKEN`. To be **removed entirely**.
- **`publish.yml`** — Triggers on `v*` tag push, uses OIDC trusted publishing (no NPM_TOKEN), validates tag-to-version match, packs and validates tarball, publishes with `--provenance`. To be **preserved unchanged** for manual tag-driven npm releases.
- **No release artifact workflow exists** — a new workflow must be created for CI-built prebuilt assets on main merge.

### Configuration & Metadata

- `~/.hlx/config.json` stores `installSource: {mode, repo?, branch?, commit?, version?}` and `autoUpdate: boolean`.
- `saveConfig()` uses read-merge-write pattern — safe for adding new fields.
- The `InstallSource` type may need extension for the new artifact-based update channel.

### Documentation & Error Message Surfaces

Six source files contain hardcoded `npm install -g git+https://...#main` references that must be updated:
1. `src/update/check.ts` (line 9) — `GIT_INSTALL_SPEC` constant definition
2. `src/update/perform.ts` (line 17) — actual install command
3. `src/update/index.ts` (lines 89, 101) — recovery error messages
4. `src/docs/cli-content.ts` (lines 18, 301) — installation and troubleshooting docs
5. `src/skill/show.ts` (line 15) — error recovery message
6. `src/skill/paths.ts` (line 25) — error recovery message

### Test Coverage

- No tests exist for the update module (no `src/update/*.test.ts` files).
- Existing tests cover: flag parsing (`flags.test.ts`), ticket resolution (`resolve-ticket.test.ts`), skill operations (`skill.test.ts`).
- Test command: `tsc && node --test dist/**/*.test.js`.

### Build & Package

- ESM module targeting ES2022, Node16 module resolution.
- `prepare` script runs `npm run build` → `tsc`. This is what makes source installs fail without TypeScript.
- Published package includes `dist/` (excluding tests) and `skill-content/` — this defines the minimum artifact contents.
- Bin entry: `hlx` → `dist/index.js`.

### Execution Signals

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsc` | TypeScript compilation |
| `typecheck` | `tsc --noEmit` | Type checking only |
| `test` | `tsc && node --test dist/**/*.test.js` | Build + run tests |
| `prepare` | `npm run build` | Auto-runs on npm install |

## Relevant Files

| File | Role |
|------|------|
| `src/update/perform.ts` | Current npm-based update execution — primary replacement target |
| `src/update/check.ts` | Remote SHA fetch and canonical repo constants |
| `src/update/index.ts` | Update command handler and auto-update orchestration |
| `src/update/validate.ts` | Post-update validation — npm-path-dependent, needs redesign |
| `src/update/version.ts` | Version display with commit SHA |
| `src/index.ts` | CLI entry point, auto-update call site, --version handling |
| `src/lib/config.ts` | Config storage, InstallSource type definition |
| `.github/workflows/auto-tag.yml` | Auto-tag workflow to be removed |
| `.github/workflows/publish.yml` | npm publish workflow to be preserved |
| `src/docs/cli-content.ts` | CLI docs with install/troubleshooting instructions |
| `src/skill/show.ts` | Error message with install reference |
| `src/skill/paths.ts` | Error message with install reference |
| `package.json` | Build scripts, bin entry, files list, prepare script |
| `tsconfig.json` | TypeScript build configuration |
| `.npmignore` | Package exclusion rules |
| `skill-content/references/commands.md` | Command reference documentation |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement and requirements | Detailed acceptance criteria, failure behavior specs, and non-negotiable invariants for the update mechanism replacement |
| `src/update/perform.ts` | Source code of current update executor | Confirms npm-based update via `spawnSync('npm install -g ...')` — the exact code path being replaced |
| `src/update/check.ts` | Source code for remote version checking | Uses `git ls-remote` (not GitHub API); defines `GIT_INSTALL_SPEC` constant used across the update module |
| `src/update/index.ts` | Update orchestration logic | Shows fail-open (auto) vs fail-closed (manual) behavior patterns that must be preserved |
| `src/update/validate.ts` | Post-update validation logic | Entirely npm-path-dependent — must be redesigned for artifact-based installs |
| `src/update/version.ts` | Version display implementation | Already supports commit SHA suffix — format must be preserved |
| `src/index.ts` | CLI dispatcher and auto-update integration | Shows pre-command auto-update call and SKIP_AUTO_UPDATE command set |
| `src/lib/config.ts` | Config storage and InstallSource type | Defines the metadata schema; read-merge-write pattern is safe for extension |
| `.github/workflows/auto-tag.yml` | Auto-tag workflow | Confirmed: triggers on main push, uses RELEASE_TOKEN, creates/pushes tags — to be removed |
| `.github/workflows/publish.yml` | npm publish workflow | Confirmed: tag-triggered OIDC publish with provenance — to be preserved |
| `src/docs/cli-content.ts` | CLI documentation content | Contains two hardcoded npm install references that must be updated |
| `src/skill/show.ts` | Skill show error messages | Contains npm install reference in error recovery guidance |
| `src/skill/paths.ts` | Skill path resolution | Contains npm install reference in error recovery guidance |
| `package.json` | Project configuration | Confirms prepare → tsc pipeline causing source install failures; defines artifact contents via files array |

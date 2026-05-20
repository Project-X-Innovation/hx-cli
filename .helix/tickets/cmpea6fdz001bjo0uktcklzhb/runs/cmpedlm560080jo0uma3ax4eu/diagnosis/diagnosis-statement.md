# Diagnosis Statement — BLD-527: Replace hlx self-update with GitHub release assets

## Problem Summary

The `hlx update` command and auto-update mechanism fail because they depend on `npm install -g git+https://...#main`, which triggers a user-side TypeScript build (`prepare` -> `tsc`) that fails when the build toolchain is unavailable. Worse, `npm install -g` destructively removes the existing CLI before the new install completes, so a failed update bricks the CLI. Separately, the `auto-tag.yml` workflow auto-pushes version tags on every `main` merge, chaining to npm publish via `publish.yml` and requiring a custom `RELEASE_TOKEN` — adding unwanted coupling and friction.

## Root Cause Analysis

### Cause 1: Source-based install requires build toolchain on user machines

`performUpdate()` (`src/update/perform.ts:17`) executes `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main` via `spawnSync`. This triggers the `prepare` script (`package.json:19` -> `npm run build` -> `tsc`). TypeScript is a `devDependency` only (`package.json:41-43`), so it is not available in the transient npm global install sandbox. On Windows and other environments without a pre-existing TypeScript toolchain, the build step fails.

### Cause 2: Destructive update with no staging

`npm install -g` removes the existing package before installing the replacement. The current update flow calls `performUpdate()` first (destructive), then `validateInstall()` (post-hoc check). If the install fails mid-way, the old CLI files are already gone. The recovery message at `src/update/index.ts:100-103` acknowledges this: _"The update installed a broken package."_ There is no staging directory, no pre-switch validation, and no rollback mechanism.

### Cause 3: Auto-tag workflow chains every merge to npm publish

`auto-tag.yml` triggers on `push to main`, reads the version from `package.json`, and pushes a `v{version}` tag using `secrets.RELEASE_TOKEN`. Since `publish.yml` triggers on `v*` tags, every merge to main potentially triggers an npm publish. The workflow requires a custom `RELEASE_TOKEN` because its own permissions are only `contents: read`, insufficient for tag pushing with the standard `GITHUB_TOKEN`.

### Cause 4: No prebuilt artifact exists

No CI workflow produces a prebuilt artifact. The only two workflows are `auto-tag.yml` (tagging) and `publish.yml` (npm publish). Users and the updater are forced to build from source.

## Evidence Summary

| Evidence | Location | Finding |
|----------|----------|---------|
| npm install -g with git source | `src/update/perform.ts:17` | `spawnSync('npm install -g git+https://...#main')` — requires user-side build |
| prepare script triggers tsc | `package.json:19` | `"prepare": "npm run build"` where `"build": "tsc"` |
| TypeScript is devDependency only | `package.json:41-43` | Not available during npm global install |
| No staging mechanism | `src/update/perform.ts` | Single npm install -g call, no temp directory, no rollback |
| Post-hoc validation only | `src/update/index.ts:85-104` | `performUpdate()` then `validateInstall()` — too late |
| Validation is npm-path-dependent | `src/update/validate.ts:40-47` | Resolves `npm root -g`, checks `@projectxinnovation/helix-cli/dist/index.js` |
| Auto-tag pushes version tags | `auto-tag.yml:50-52` | `git tag $TAG && git push origin $TAG` using RELEASE_TOKEN |
| Auto-tag chains to npm publish | `publish.yml:5-6` | Triggered by `v*` tag push from auto-tag |
| Zero production dependencies | `package.json:40-43` | Only devDependencies — prebuilt artifact needs no node_modules |
| Existing version display supports SHA | `src/update/version.ts:30-31` | Already formats as `"1.3.4 (c8620a5)"` |
| Config already tracks install source | `src/lib/config.ts:5-11` | `InstallSource` type with mode/repo/branch/commit/version fields |
| git ls-remote for SHA check | `src/update/check.ts:18-19` | Requires `git` binary on user machine |
| Six hardcoded npm install references | Multiple files | `perform.ts`, `check.ts`, `index.ts`, `cli-content.ts`, `show.ts`, `paths.ts` |
| No update module tests | `src/update/` | No `.test.ts` files exist |
| No runtime inspection available | `/tmp/helix-inspect/manifest.json` | Not present — this is a CLI tool repo, no production runtime to inspect |

## Success Criteria

1. **New CI workflow**: A merge to `main` produces a prebuilt GitHub Release asset (tarball of `dist/` + `skill-content/` + `package.json`) under a rolling `latest` tag using `GITHUB_TOKEN` with `contents: write`. The tag `latest` must NOT match `v*` to avoid triggering `publish.yml`.

2. **Remove auto-tag.yml**: Deleted entirely. The `publish.yml` workflow remains unchanged for intentional tag-driven npm releases.

3. **Staged update mechanism**: The `src/update/` module is rewritten to: (a) query the GitHub Release API for the latest release metadata and commit SHA, (b) download the tarball to a staging directory, (c) validate the staged candidate (entrypoint exists, `--version` runs), (d) only after validation swap the staged files into the live install location, (e) record install-source metadata (source=github, commit SHA) to config.

4. **Safe failure behavior**: Manual `hlx update` exits non-zero on any failure and keeps the current install intact. Auto-update logs a warning and continues command dispatch on failure. Auth failures produce explicit GitHub auth guidance.

5. **Version display**: `hlx --version` continues to show the commit SHA suffix (already supported).

6. **Documentation**: All six hardcoded `npm install -g git+https://...` references are replaced with updated install/recovery instructions.

7. **No bricking**: Failed updates never leave the CLI unusable because the live install is only replaced after full staged validation passes.

### Scope of Changes

| Area | Files | Change Type |
|------|-------|-------------|
| New CI workflow | `.github/workflows/build-release.yml` (new) | Create: build, test, tarball, publish GitHub Release |
| Remove auto-tag | `.github/workflows/auto-tag.yml` | Delete |
| Update check | `src/update/check.ts` | Rewrite: replace `git ls-remote` with GitHub API release query |
| Update execution | `src/update/perform.ts` | Rewrite: replace `npm install -g` with staged tarball download |
| Update validation | `src/update/validate.ts` | Rewrite: validate staged directory instead of npm global path |
| Update orchestration | `src/update/index.ts` | Update: flow changes, error messages, recovery guidance |
| Version display | `src/update/version.ts` | Minor: may need adjustment for non-npm install paths |
| Config types | `src/lib/config.ts` | Minor: `InstallSource` type may need extension |
| CLI docs | `src/docs/cli-content.ts` | Update: replace npm install references (lines 18, 301) |
| Skill show error | `src/skill/show.ts` | Update: replace npm install reference (line 15) |
| Skill paths error | `src/skill/paths.ts` | Update: replace npm install reference (line 25) |
| Command reference | `skill-content/references/commands.md` | Update: if install instructions present |
| Preserve npm publish | `.github/workflows/publish.yml` | No change |

### Key Architectural Decisions for Implementation

1. **GitHub Releases with rolling `latest` tag**: Not `v*`, so it won't trigger `publish.yml`. `GITHUB_TOKEN` + `contents: write` can create releases (confirmed by GitHub Actions docs). Assets are permanent and have stable URLs.

2. **Tarball contents**: `dist/` (excluding tests) + `skill-content/` + `package.json` + a metadata file with the commit SHA. Zero production dependencies means no `node_modules/` needed.

3. **Install location determination**: The running CLI knows its own location via `import.meta.url` (already used in `version.ts` and `paths.ts`). The updater replaces files at the current install root, preserving existing PATH and npm symlinks.

4. **GitHub API replaces git ls-remote**: Since the updater already needs GitHub API for release discovery, `git ls-remote` can be replaced with GitHub API, removing the `git` binary dependency from the user's machine.

5. **Auth handling**: Private repo asset downloads require GitHub auth. The updater should check for `GITHUB_TOKEN` env var or `gh` CLI auth, and produce explicit guidance on auth failure.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements and acceptance criteria | Detailed non-negotiable invariants for staged update, failure behavior, and workflow changes |
| `scout/reference-map.json` | File inventory and factual claims from scout | Confirmed 5 update module files, 2 workflows, 6 hardcoded references, zero tests, zero production deps |
| `scout/scout-summary.md` | Structured summary of codebase analysis | Confirmed update architecture, CI/CD setup, and documentation surfaces |
| `src/update/perform.ts` | Current update executor source code | Direct evidence: `npm install -g git+https://...#main` via `spawnSync` — the root cause mechanism |
| `src/update/check.ts` | Remote SHA check source code | Uses `git ls-remote` (not GitHub API); defines `GIT_INSTALL_SPEC` constant used across module |
| `src/update/index.ts` | Update orchestration source code | Confirmed fail-open (auto) vs fail-closed (manual) patterns; recovery messages reference npm install |
| `src/update/validate.ts` | Post-update validation source code | Entirely npm-path-dependent — resolves `npm root -g`, checks hardcoded npm package path |
| `src/update/version.ts` | Version display source code | Already supports commit SHA suffix format; uses `import.meta.url` for package root resolution |
| `src/index.ts` | CLI entry point | Confirmed auto-update call at line 74, SKIP_AUTO_UPDATE set, --version handling |
| `src/lib/config.ts` | Config and InstallSource type | InstallSource type already has mode/repo/branch/commit fields; saveConfig uses read-merge-write |
| `.github/workflows/auto-tag.yml` | Auto-tag workflow | Confirmed: push-to-main trigger, RELEASE_TOKEN usage, v{version} tag creation/push |
| `.github/workflows/publish.yml` | npm publish workflow | Confirmed: v* tag trigger, OIDC trusted publishing, tarball validation — must be preserved |
| `src/docs/cli-content.ts` | CLI documentation content | Two hardcoded `npm install -g git+https://...` references at lines 18 and 301 |
| `src/skill/show.ts` | Skill show command | Hardcoded npm install recovery message at line 15 |
| `src/skill/paths.ts` | Skill path resolution | Hardcoded npm install recovery message at line 25 |
| `package.json` | Project configuration | Confirmed prepare -> tsc pipeline, zero production deps, bin entry, files array |
| Context7 GitHub Actions docs | GitHub Actions documentation | Confirmed GITHUB_TOKEN with contents: write can create releases via gh release create |

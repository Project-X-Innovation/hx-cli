# Diagnosis Statement — BLD-375: Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Problem Summary

The `@projectxinnovation/helix-cli` package cannot be published to npm via Trusted Publishing because the repository has no CI/CD infrastructure, is missing required `package.json` metadata, and the entire update mechanism is hardcoded to install from GitHub directly. A prior broken install (missing `dist/index.js`) motivates adding tarball validation before any publish.

## Root Cause Analysis

This is a greenfield infrastructure gap, not a bug. Four distinct gaps must be closed:

### Gap 1: Missing `repository` metadata in `package.json`

npm Trusted Publishing uses OIDC identity verification that matches the GitHub repo URL in the package's `repository` field against the repository requesting the publish token. `package.json` has no `repository` field at all (lines 1-26), so Trusted Publishing cannot establish trust.

**Fix**: Add `"repository": {"type": "git", "url": "https://github.com/Project-X-Innovation/helix-cli.git"}` and `"publishConfig": {"provenance": true}` to `package.json`.

### Gap 2: No publish workflow exists

The `.github/` directory does not exist. There is no CI/CD of any kind. A complete GitHub Actions workflow must be created at `.github/workflows/publish.yml` with:
- `permissions: { id-token: write, contents: read }` for OIDC
- `actions/setup-node` with `registry-url: https://registry.npmjs.org`
- Build → test → pack validation → publish pipeline
- Deterministic tarball inspection that verifies `dist/index.js` presence before publish
- Fail-closed behavior at every stage

### Gap 3: Update mechanism is GitHub-direct

The update subsystem uses `git ls-remote` to compare commit SHAs (`src/update/check.ts:13-27`) and `npm install -g github:Project-X-Innovation/helix-cli#main` to perform updates (`src/update/perform.ts:15`). The `InstallSource` type only supports `mode: "github" | "unknown"` (`src/lib/config.ts:6`). This must be migrated to:
- Query the npm registry for the latest published version (replacing `git ls-remote`)
- Install from `@projectxinnovation/helix-cli` (replacing the GitHub install spec)
- Use semver comparison instead of SHA comparison
- Add `"npm"` to the `InstallSource.mode` type union
- Update help text in `src/index.ts:52`

### Gap 4: Test files in published tarball (minor)

`dist/lib/flags.test.js`, `dist/lib/resolve-ticket.test.js`, and their `.d.ts` counterparts are compiled into `dist/` and would be included in the tarball via `files: ["dist"]`. These are unnecessary for runtime. Excluding them keeps the published package lean and intentional, consistent with the ticket's requirement to "keep published package contents intentionally limited."

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| `package.json` lines 1-26 | No `repository` field; `files: ["dist"]`; `bin.hlx: "dist/index.js"`; version 1.2.0 |
| `.github/` directory | Does not exist (glob returned no files) |
| `src/update/check.ts` lines 13-27 | `fetchRemoteSha()` uses `git ls-remote` for SHA comparison |
| `src/update/perform.ts` line 15 | Install spec is `github:Project-X-Innovation/helix-cli#main` |
| `src/update/index.ts` lines 96-103 | Saves `installSource` with `mode: "github"` |
| `src/lib/config.ts` line 6 | `InstallSource.mode` typed as `"github" \| "unknown"` only |
| `src/index.ts` line 52 | Help text: "Check for and apply updates from GitHub main" |
| `src/update/version.ts` lines 10-18 | `../../package.json` relative path — works correctly from npm install |
| `dist/lib/` directory listing | Contains `flags.test.js`, `flags.test.d.ts`, `resolve-ticket.test.js`, `resolve-ticket.test.d.ts` |
| npm Trusted Publishing docs | Requires `id-token: write`, `repository` field in package.json, `--provenance` flag |
| `.npmignore` | Does not exist — publish controlled by `files` field only |
| `tsconfig.json` | Compiles all `src/` to `dist/`; no test exclusion |

## Success Criteria

1. `.github/workflows/publish.yml` exists with OIDC permissions (`id-token: write`), build/test/validate/publish pipeline, and fail-closed behavior.
2. `package.json` contains `repository` field matching `https://github.com/Project-X-Innovation/helix-cli.git`.
3. Pack validation step inspects the actual tarball and fails if `dist/index.js` is missing.
4. No `NPM_TOKEN` secret is required for publish.
5. Update subsystem (`check.ts`, `perform.ts`, `index.ts`, `config.ts`) uses npm registry instead of GitHub direct.
6. `InstallSource.mode` includes `"npm"` variant.
7. Help text reflects npm-based updates.
8. Published tarball excludes unnecessary test files.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and acceptance criteria | Defines OIDC publish, pack validation, repository metadata, update path migration requirements |
| scout/reference-map.json | Structured inventory of all relevant files and their states | Confirmed all gaps: no repository field, no workflows, GitHub-direct update, test files in tarball |
| scout/scout-summary.md | Narrative summary of codebase analysis | Validated boundary file list and confirmed what already works correctly |
| package.json (direct read) | Verified current metadata state | No repository field, files: ["dist"], bin.hlx: "dist/index.js", version 1.2.0 |
| src/update/check.ts (direct read) | Verified version-check implementation | Uses git ls-remote for SHA comparison; defines CANONICAL_REPO constants |
| src/update/perform.ts (direct read) | Verified install implementation | Hardcoded github: install spec |
| src/update/index.ts (direct read) | Verified update orchestration | Saves mode:"github" metadata; both manual and auto-update paths affected |
| src/lib/config.ts (direct read) | Verified InstallSource type definition | mode: "github" \| "unknown" — needs "npm" |
| src/index.ts (direct read) | Verified CLI entrypoint and help text | Line 52 references "GitHub main" |
| src/update/version.ts (direct read) | Verified runtime version resolution | ../../package.json path works from npm install |
| src/update/validate.ts (direct read) | Verified existing validation pattern | Checks dist/index.js + version; pattern reusable for workflow validation |
| tsconfig.json (direct read) | Verified build configuration | Compiles all src/ to dist/ without test exclusion |
| npm Trusted Publishing docs (Context7) | Verified OIDC workflow requirements | id-token:write, repository field, setup-node registry-url, --provenance flag |

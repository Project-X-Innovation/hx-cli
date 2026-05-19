# Diagnosis Statement — BLD-501

## Problem Summary

The `@projectxinnovation/helix-cli` package at version `1.3.3` cannot auto-deploy to NPMJS because the `v1.3.3` git tag already exists on the remote. The `auto-tag.yml` workflow correctly detects the existing tag and skips creation, so the downstream `publish.yml` workflow never triggers. The version needs to be bumped so a new tag is created on the next merge to `main`.

## Root Cause Analysis

The deployment pipeline is a two-stage GitHub Actions flow:

1. **`auto-tag.yml`** — triggers on push to `main`, reads version from `package.json`, and creates a `v{version}` tag only if one doesn't already exist on the remote.
2. **`publish.yml`** — triggers on `v*` tag push, builds, tests, validates, and publishes to npm with provenance.

The previous ticket (cmp5p01tn) set up this pipeline at version `1.3.3`, which means the `v1.3.3` tag was already created. Any subsequent push to `main` with version `1.3.3` will be a no-op in `auto-tag.yml` (line 37-39: `git ls-remote --tags origin` finds the existing tag, sets `exists=true`, and the create step is skipped on line 46).

**Root cause**: The version in `package.json` matches an already-tagged release, so the pipeline correctly does nothing. This is not a bug — it's expected behavior. The fix is to increment the version.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| `package.json` line 3 | `"version": "1.3.3"` — current version |
| `package-lock.json` lines 3, 9 | `"version": "1.3.3"` — must stay in sync |
| `auto-tag.yml` lines 34-46 | Checks for existing tag via `git ls-remote`; skips when tag exists |
| `publish.yml` lines 32-38 | Validates tag version matches `package.json` version before publish |
| `src/update/version.ts` | Reads version dynamically from `package.json` — no hardcoded strings |
| `grep` for `1.3.3` in repo | Only `package.json` and `package-lock.json` contain the version string |
| `grep` for `"version"` in `src/` | No matches — confirms no hardcoded version in source code |
| Scout reference-map.json | Previous ticket (cmp5p01tn) set up pipeline at version 1.3.3 |

## Success Criteria

1. `package.json` version is incremented from `1.3.3` to `1.3.4` (patch bump).
2. `package-lock.json` version is updated in both locations (lines 3 and 9) to match.
3. Quality gates pass: `tsc --noEmit` (typecheck), `tsc && node --test dist/**/*.test.js` (tests).
4. On merge to `main`, `auto-tag.yml` creates a `v1.3.4` tag, which triggers `publish.yml` to publish `@projectxinnovation/helix-cli@1.3.4` to npm.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement | Bump version to trigger npm auto-deploy; check GH action pipeline |
| `scout/reference-map.json` | Scout analysis of files and facts | Version in 2 files only; pipeline is two-stage; prior ticket set up v1.3.3 |
| `scout/scout-summary.md` | Scout analysis summary | Confirmed version source of truth and deployment pipeline details |
| `package.json` | Direct file inspection | Current version 1.3.3; publishConfig, scripts, no runtime deps |
| `package-lock.json` | Direct file inspection | Version in two locations (lines 3, 9); must stay in sync |
| `.github/workflows/auto-tag.yml` | Pipeline stage 1 inspection | Creates v{version} tag if absent; uses RELEASE_TOKEN secret |
| `.github/workflows/publish.yml` | Pipeline stage 2 inspection | Validates version match; publishes with provenance; Node 24 for npm 11.x |
| `src/update/version.ts` | Version reference check | Reads version from package.json at runtime — no hardcoded strings |

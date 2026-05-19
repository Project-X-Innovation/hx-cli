# Scout Summary — BLD-501

## Problem

The CLI package `@projectxinnovation/helix-cli` needs its version bumped so that a merge to `main` triggers the existing two-stage GitHub Actions deployment pipeline to auto-publish a new version to NPMJS.

## Analysis Summary

- **Current version**: `1.3.3` (set in `package.json` line 3 and `package-lock.json` lines 3, 9).
- **Version source of truth**: `package.json` — the `src/update/version.ts` module reads it dynamically at runtime; no hardcoded version strings exist in source code.
- **Deployment pipeline** (already in place):
  1. **`auto-tag.yml`** — triggers on push to `main`. Reads version from `package.json`, checks if a `v{version}` tag already exists on the remote, and creates + pushes the tag if it does not. Uses the `RELEASE_TOKEN` secret for push permission.
  2. **`publish.yml`** — triggers on `v*` tag push. Runs `npm ci` (which triggers the `prepare` script → `tsc` build), runs tests, validates the tag version matches `package.json`, packs and validates the tarball, then publishes to npm with provenance via OIDC (requires Node 24 for npm 11.x Trusted Publishing).
- **Files requiring version change**: Only `package.json` and `package-lock.json`. No other files contain hardcoded version strings.
- **Quality gates**: `tsc --noEmit` (typecheck), `tsc && node --test dist/**/*.test.js` (test), `tsc` (build). The publish workflow runs the full test suite before publishing.
- **Tarball validation**: The publish workflow ensures `dist/index.js`, `package.json`, and `skill-content/SKILL.md` are included, and that no test files leak into the tarball.
- **No ORM, no migrations, no runtime dependencies** — the change scope is limited to version metadata.

## Relevant Files

| File | Role |
|------|------|
| `package.json` | Version source of truth (currently `1.3.3`); scripts; publishConfig |
| `package-lock.json` | Lockfile; contains version in two locations (lines 3, 9) |
| `.github/workflows/auto-tag.yml` | Stage 1: creates git tag from version on main push |
| `.github/workflows/publish.yml` | Stage 2: builds, tests, validates, publishes to npm on tag push |
| `src/update/version.ts` | Runtime version reader — confirms no hardcoded version |
| `tsconfig.json` | Build config; output → `dist/`, source → `src/` |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement | Bump version to trigger auto-deploy; check GH action for pipeline |
| `package.json` | Direct inspection | Version 1.3.3; package name, publishConfig, scripts, no runtime deps |
| `package-lock.json` | Direct inspection | Version appears on lines 3 and 9; must stay in sync |
| `.github/workflows/auto-tag.yml` | Pipeline stage 1 | Triggers on main push; creates v{version} tag if absent; requires RELEASE_TOKEN |
| `.github/workflows/publish.yml` | Pipeline stage 2 | Triggers on v* tag; validates version match; publishes with provenance |
| `src/update/version.ts` | Version reference check | Reads version from package.json at runtime — no hardcoded strings |
| `tsconfig.json` | Build configuration | Confirms build output goes to dist/, source in src/ |

# Scout Summary

## Problem

The `helix-cli` repository has a single GitHub Actions workflow (`.github/workflows/publish.yml`) that publishes to npm, but it only triggers on pushed tags matching `v*`. There is no automation to create these tags when a version bump merges to `main`. The gap between "merge version bump to main" and "npm publish" requires manual tag creation, which this ticket aims to close by adding an auto-tag workflow.

## Analysis Summary

### Current State

- **One workflow exists**: `.github/workflows/publish.yml` triggers on `push: tags: ['v*']`. It runs on ubuntu-latest with Node 24, installs dependencies, runs tests, validates the tag version matches `package.json`, packs/validates the tarball, and publishes to npm with provenance via OIDC.
- **No main-push workflow**: The `.github/workflows/` directory contains only `publish.yml`. No workflow triggers on pushes to `main`.
- **Version source of truth**: `package.json` version field (currently `1.3.3`). The publish workflow already validates tag-version consistency (lines 31-38).
- **Publish workflow permissions**: `id-token: write` (npm OIDC), `contents: read`. The new auto-tag workflow will need `contents: write` to push tags.

### What Needs to Be Added

A new workflow file in `.github/workflows/` that:
1. Triggers on `push` to `main`.
2. Reads the `version` field from the root `package.json`.
3. Checks whether `v<version>` tag already exists.
4. Creates and pushes the tag if it does not exist.
5. Exits cleanly if the tag already exists (idempotent).
6. Fails if version cannot be read or tag push fails.

### Critical Design Boundary: GITHUB_TOKEN and Workflow Chaining

By default, GitHub Actions events caused by `GITHUB_TOKEN` do **not** trigger other workflows (to prevent recursive loops). If the auto-tag workflow pushes a tag using the default `GITHUB_TOKEN`, the existing `publish.yml` may not be triggered by that tag push. This is a well-documented GitHub Actions limitation. Solutions include using a Personal Access Token (PAT) or a GitHub App installation token. This must be addressed in diagnosis/implementation.

### Repository Shape

- **Language**: TypeScript (ES2022 target, Node16 modules)
- **Package manager**: npm (lockfileVersion 3)
- **Quality gates**: `tsc` (build), `tsc --noEmit` (typecheck), `tsc && node --test dist/**/*.test.js` (test)
- **No ORM/database/migrations**: Pure CLI tool
- **No README or CLAUDE.md found**

## Relevant Files

| File | Relevance |
|------|-----------|
| `.github/workflows/publish.yml` | Existing tag-triggered publish workflow; must be preserved unchanged |
| `package.json` | Version source of truth (1.3.3); scripts define quality gates |
| `.github/workflows/` (directory) | Location for new auto-tag workflow |
| `src/update/check.ts` | Canonical repo constants and version utilities |
| `src/update/version.ts` | Runtime version reading pattern |
| `tsconfig.json` | Build configuration |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary ticket specification | Defines required behavior: auto-tag on main push, idempotent, fail-closed, preserve existing publish workflow |
| .github/workflows/publish.yml | Existing workflow to preserve | Triggers on `v*` tags; validates tag-version match; uses Node 24 + npm OIDC provenance; permissions are id-token:write + contents:read |
| package.json | Version and build configuration | Version 1.3.3; scripts: build/typecheck/test/prepare; publishConfig with public access and provenance |
| src/update/check.ts | Repo identity constants | Confirms canonical repo is Project-X-Innovation/helix-cli on main branch |
| src/update/version.ts | Version reading pattern | Confirms version is a simple string in package.json |
| tsconfig.json | Build settings | ES2022/Node16, outputs to dist/ |

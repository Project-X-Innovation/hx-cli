# Product Specification — BLD-501

## Problem Statement

The `@projectxinnovation/helix-cli` package (currently at version `1.3.3`) cannot auto-deploy to NPMJS. The existing two-stage GitHub Actions pipeline (`auto-tag.yml` then `publish.yml`) is correctly configured, but it no-ops because the `v1.3.3` git tag already exists on the remote from a previous pipeline setup ticket. Any push to `main` at this version causes `auto-tag.yml` to detect the existing tag and skip creation, so `publish.yml` never fires.

## Product Vision

Enable the CLI package to be published to the npm registry via the existing automated pipeline by advancing the version past the already-tagged `1.3.3` release.

## Users

| User | Impact |
|------|--------|
| **CLI consumers** (developers installing `@projectxinnovation/helix-cli` from npm) | Receive the latest CLI version automatically via `npm install`. |
| **Internal maintainers** | Validate that the end-to-end auto-deploy pipeline works as intended. |

## Use Cases

1. **Auto-publish on merge**: When a PR containing the version bump merges to `main`, the pipeline automatically tags and publishes the new version to npm — no manual intervention required.
2. **CLI update availability**: Developers running the CLI receive update notifications pointing to the newly published version.

## Core Workflow

1. Version is bumped in `package.json` (and `package-lock.json` kept in sync).
2. PR merges to `main`.
3. `auto-tag.yml` detects the new version has no matching tag and creates `v1.3.4`.
4. Tag push triggers `publish.yml`, which builds, tests, validates, and publishes `@projectxinnovation/helix-cli@1.3.4` to npm with provenance.

## Essential Features (MVP)

- **Version increment**: Bump from `1.3.3` to `1.3.4` (patch) in `package.json` and `package-lock.json`.
- **Lockfile consistency**: Both version locations in `package-lock.json` (lines 3 and 9) match `package.json`.
- **Quality gates pass**: Typecheck (`tsc --noEmit`) and tests (`node --test dist/**/*.test.js`) succeed.

## Features Explicitly Out of Scope (MVP)

- **Workflow modifications**: The `auto-tag.yml` and `publish.yml` workflows are working correctly and must not be changed.
- **New CLI features or bug fixes**: This ticket is purely a version bump to unblock the deploy pipeline — no functional changes to the CLI itself.
- **Major or minor version bumps**: No new features or breaking changes warrant a minor or major increment.
- **Changelog or release notes**: Not requested and not part of the existing pipeline.

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `package.json` version is `1.3.4` | File inspection |
| 2 | `package-lock.json` version is `1.3.4` in both locations | File inspection |
| 3 | Typecheck passes (`tsc --noEmit`) | CI / local run |
| 4 | Tests pass (`tsc && node --test dist/**/*.test.js`) | CI / local run |
| 5 | On merge to `main`, `auto-tag.yml` creates `v1.3.4` tag | GitHub Actions run |
| 6 | `publish.yml` publishes `@projectxinnovation/helix-cli@1.3.4` to npm | npm registry check |

## Key Design Principles

- **Minimal change**: Only version metadata files are touched. No source code, workflow, or config changes.
- **Pipeline trust**: The existing CI/CD pipeline is proven correct — this ticket relies on it, not modifies it.
- **Single source of truth**: `package.json` is the authoritative version; `package-lock.json` mirrors it.

## Scope & Constraints

- **Files in scope**: `package.json`, `package-lock.json` only.
- **Files out of scope**: All workflow files, source code, and configuration.
- **Semver choice**: Patch bump (`1.3.3` to `1.3.4`) is the appropriate increment since no features or breaking changes are introduced.
- **Pipeline dependency**: The `RELEASE_TOKEN` secret and npm OIDC trust must be pre-configured in the GitHub repository settings (these are infrastructure prerequisites, not part of this ticket).

## Future Considerations

- Automating version bumps via a dedicated release workflow or conventional-commits tooling could prevent this class of issue from recurring.
- A CHANGELOG or GitHub Releases integration could improve visibility for CLI consumers.

## Open Questions / Risks

| # | Item | Type |
|---|------|------|
| 1 | Whether `RELEASE_TOKEN` secret is currently configured and valid in the GitHub repo settings. If missing, `auto-tag.yml` will fail to push the tag. | Risk |
| 2 | Whether npm OIDC Trusted Publishing is correctly configured for this package. If not, `publish.yml` will fail at the publish step. | Risk |
| 3 | Whether version `1.3.3` was ever successfully published to npm. If not, the pipeline may have an untested path. | Unknown |
| 4 | No runtime inspection was available to verify current npm registry state or GitHub Actions secret configuration. | Limitation |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement and ticket context | Bump version to trigger auto-deploy to NPMJS |
| `scout/scout-summary.md` | Scout analysis of codebase and pipeline | Version 1.3.3 in 2 files; two-stage pipeline; no hardcoded version in source |
| `scout/reference-map.json` | Structured file-level evidence and facts | Exact lines for version locations; pipeline mechanics; unknowns about semver intent |
| `diagnosis/diagnosis-statement.md` | Root cause and success criteria | v1.3.3 tag already exists; patch bump to 1.3.4 is the fix |
| `diagnosis/apl.json` | Structured diagnosis answers with evidence | Confirmed pipeline is correct; version bump is the only needed change |
| `repo-guidance.json` | Repo intent classification | helix-cli is the sole target repo |

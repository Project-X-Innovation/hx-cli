# Product: Automate helix-cli Release Tagging from Version Bumps

## Problem Statement

Publishing `@projectxinnovation/helix-cli` to npm currently requires a developer to manually create and push a Git tag after merging a version bump to `main`. The only CI workflow (`publish.yml`) triggers exclusively on pushed tags matching `v*`, so merging a version bump alone does nothing. This manual step is error-prone, delays releases, and creates a gap between the version recorded in `package.json` and the actual published state on npm.

## Product Vision

Close the manual gap in the release pipeline so that merging a version bump to `main` is the only action a developer needs to take to trigger an npm publish. The existing tag-triggered publish workflow remains the publishing mechanism; the new automation simply bridges the version bump event to the tag that triggers it.

## Users

- **helix-cli maintainers**: Developers who merge PRs with version bumps and expect the release to happen automatically.
- **helix-cli consumers**: Downstream users and teams who depend on timely npm releases matching the latest version in the repository.

## Use Cases

1. **Normal release**: A maintainer merges a PR that bumps `package.json` from `1.3.2` to `1.3.3`. The automation detects the version, creates `v1.3.3`, and the existing publish workflow publishes to npm.
2. **Non-release merge**: A maintainer merges a PR that does not change the version. No tag is created; nothing is published.
3. **Re-run safety**: A workflow re-run for the same commit does not create a duplicate tag or trigger a duplicate publish.
4. **Failure transparency**: If the version cannot be read or the tag cannot be pushed, the workflow fails visibly rather than silently skipping the release.

## Core Workflow

1. Developer merges a PR to `main` that bumps `package.json` version.
2. New automation workflow triggers on the push to `main`.
3. Workflow reads the version from root `package.json`.
4. Workflow checks whether tag `v<version>` already exists.
5. If the tag does not exist, the workflow creates and pushes it.
6. The existing `publish.yml` triggers on the new tag and publishes to npm.
7. If the tag already exists, the workflow exits successfully (no-op).

## Essential Features (MVP)

- **Main-push trigger**: A new workflow that runs on every push to `main`.
- **Version extraction**: Reads the `version` field from the root `package.json` of the pushed commit.
- **Tag existence check**: Determines whether `v<version>` already exists as a Git tag.
- **Idempotent tag creation**: Creates and pushes the tag only when it does not exist; exits cleanly otherwise.
- **Fail-closed on errors**: Fails the workflow if `package.json` cannot be read or the tag push fails.
- **Workflow chaining**: The pushed tag must trigger the existing `publish.yml` (requires appropriate token handling).

## Features Explicitly Out of Scope (MVP)

- Modifying the existing `publish.yml` workflow.
- Publishing npm packages directly from `main` branch pushes.
- GitHub Release object creation or management.
- Multi-package or monorepo version management.
- General release-management refactoring beyond auto-tagging.
- Repository-wide release tooling outside `helix-cli`.
- Changelog generation or release notes.

## Success Criteria

1. A merge to `main` that bumps `package.json` to `1.3.3` automatically creates and pushes tag `v1.3.3`.
2. The existing tag-triggered `publish.yml` runs after the tag is pushed and publishes to npm.
3. A merge to `main` without a version bump does not create any tag.
4. Re-running the workflow for the same commit does not create duplicate tags or duplicate publish triggers.
5. If `package.json` is unreadable, the workflow fails.
6. If the tag already exists, the workflow exits successfully without duplicating the tag.
7. `publish.yml` remains unchanged.

## Key Design Principles

- **Additive only**: Introduce one new workflow file. Do not modify existing files.
- **Source-of-truth respect**: `package.json` version is the single source of truth for the tag name.
- **Idempotency**: Safe to re-run without side effects.
- **Fail-closed**: Any error in version reading or tag pushing must surface as a workflow failure, not a silent skip.
- **Simplicity**: Minimal automation that solves exactly the tagging gap; no broader release process redesign.

## Scope & Constraints

- **Single repository**: Only `helix-cli` is in scope.
- **Single file addition**: One new workflow file in `.github/workflows/`.
- **No existing file modifications**: `publish.yml` and `package.json` are read-only from this ticket's perspective.
- **Tag format**: Must be exactly `v<version>` (e.g., `v1.3.3`).
- **One version per push**: Operate on exactly one version from the root `package.json` per push event.

## Future Considerations

- If the team later wants GitHub Releases (with release notes) to accompany tags, that can be layered on top of this workflow without modifying it.
- If the repo evolves to a monorepo with multiple packages, the version detection logic would need to be revisited.

## Open Questions / Risks

| Question / Risk | Impact | Status |
|-----------------|--------|--------|
| **GITHUB_TOKEN limitation**: Tags pushed with the default `GITHUB_TOKEN` do not trigger downstream workflows (documented GitHub Actions behavior). A PAT or GitHub App token is required for the tag push to trigger `publish.yml`. | Critical -- if unaddressed, the automation chain breaks silently. | Identified in diagnosis; must be resolved in implementation. |
| **Repository secret availability**: A secret (e.g., `RELEASE_TOKEN`) containing a PAT or GitHub App token with `contents: write` permission must exist in the repo settings. | High -- prerequisite outside of code changes. | Unknown; must be verified or created before the workflow can function. |
| **Branch/tag protection rules**: If the repository has tag protection rules, the workflow may be blocked from pushing tags. | High -- tag push would fail. | Unknown; needs verification. |
| **Existing tag state**: Whether `v1.3.3` already exists as a tag affects first-run behavior and testing of idempotency. | Low -- the workflow must handle this gracefully regardless. | Unknown; workflow design accommodates either case. |
| No runtime inspection credentials available | Low -- no production runtime checks could be performed for this product analysis. | Noted; not expected to be needed for CI workflow changes. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary ticket specification | Defines required behavior, invariants, acceptance criteria, and explicit scope boundaries |
| `scout/scout-summary.md` | Scout analysis of current repo state | Confirmed single workflow (publish.yml), no main-push trigger, GITHUB_TOKEN limitation flagged |
| `scout/reference-map.json` | Structured file map and facts from scout | Verified publish.yml trigger, version 1.3.3, tag-version validation in publish workflow, GITHUB_TOKEN unknown |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and solution approach | Confirmed root cause (missing auto-tag workflow), critical GITHUB_TOKEN constraint, PAT/App token requirement |
| `diagnosis/apl.json` | Diagnosis questions and evidence | Detailed answers on workflow chaining limitation, purely additive change set, PAT requirement evidence |
| `repo-guidance.json` | Repo intent metadata | Confirmed helix-cli is the sole target repository with no cross-repo dependencies |

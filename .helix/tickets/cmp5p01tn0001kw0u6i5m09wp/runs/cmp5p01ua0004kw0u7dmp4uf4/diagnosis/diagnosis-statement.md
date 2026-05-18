# Diagnosis Statement

## Problem Summary

The `helix-cli` repository has no automation to create Git tags when a version bump merges to `main`. The single existing workflow (`.github/workflows/publish.yml`) triggers only on pushed tags matching `v*`, creating a manual gap between "merge version bump" and "npm publish." This ticket requires closing that gap with a new auto-tagging workflow.

## Root Cause Analysis

**Primary cause**: No workflow triggers on pushes to `main`. The `.github/workflows/` directory contains only `publish.yml`, which is tag-triggered. There is no mechanism to translate a version change in `package.json` into a Git tag.

**Critical design constraint — GITHUB_TOKEN limitation**: GitHub Actions documentation states that events triggered by the repository's `GITHUB_TOKEN` will not create new workflow runs (except `workflow_dispatch` and `repository_dispatch`). If the new auto-tag workflow pushes a tag using the default `GITHUB_TOKEN`, the tag push will **not** trigger `publish.yml`. This is the primary technical challenge.

**Solution approach**: Create a single new workflow file (`.github/workflows/auto-tag.yml`) that:

1. Triggers on `push` to `main`.
2. Reads the `version` field from root `package.json`.
3. Checks whether tag `v<version>` already exists (idempotency).
4. Creates and pushes the tag if it does not exist.
5. Uses a PAT or GitHub App token (not the default `GITHUB_TOKEN`) passed via the `actions/checkout` `token` parameter, so the tag push event triggers the existing `publish.yml`.

**Why a PAT/GitHub App token is required**: When `actions/checkout` is configured with a non-`GITHUB_TOKEN` credential, subsequent `git push` operations use that credential. Events from such pushes are treated as external events and DO trigger other workflows. This is the standard GitHub-recommended approach for workflow chaining.

**Implementation scope**:

| Action | File | Details |
|--------|------|---------|
| Create | `.github/workflows/auto-tag.yml` | New workflow: push-to-main trigger, version read, tag existence check, tag create+push |
| Preserve unchanged | `.github/workflows/publish.yml` | Existing tag-triggered npm publish; no modifications |
| Read only | `package.json` | Version source of truth (currently `1.3.3`) |

**Prerequisites** (outside code changes):
- A repository secret (e.g., `RELEASE_TOKEN`) containing a PAT or GitHub App token with `contents: write` permission on the repository.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| `.github/workflows/publish.yml` lines 3-6 | Triggers only on `push: tags: ['v*']` — no main-branch trigger |
| `.github/workflows/` directory listing | Contains only `publish.yml` — no auto-tag workflow exists |
| `package.json` line 3 | Version is `1.3.3`, matching ticket acceptance criteria example |
| `publish.yml` lines 31-38 | Already validates tag-version match — provides safety net for tag correctness |
| `publish.yml` lines 8-10 | Permissions: `id-token: write`, `contents: read` — unchanged by this ticket |
| GitHub Actions docs (Context7) | "Events triggered by GITHUB_TOKEN will not create a new workflow run, except for workflow_dispatch and repository_dispatch" |
| `actions/checkout` docs (Context7) | `token` parameter defaults to `github.token`; accepts PAT for authenticated git operations |
| `src/update/check.ts` lines 3-6 | Confirms canonical repo: `Project-X-Innovation/helix-cli`, branch: `main` |

## Success Criteria

1. A merge to `main` that bumps `package.json` version automatically creates and pushes `v<version>` tag.
2. The existing tag-triggered `publish.yml` runs after the tag is pushed and publishes to npm.
3. A merge to `main` without a version bump does not create a tag.
4. Re-running the workflow for the same commit does not create duplicate tags.
5. If `package.json` cannot be read, the workflow fails (fail-closed).
6. If the tag already exists, the workflow exits successfully without creating a duplicate.
7. `publish.yml` is unchanged.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary ticket specification | Defines required behavior: auto-tag on main push, idempotent, fail-closed, preserve existing publish workflow |
| scout/reference-map.json | Scout's file map and facts | Confirmed single workflow (publish.yml), version 1.3.3, identified GITHUB_TOKEN limitation as critical unknown |
| scout/scout-summary.md | Scout's analysis summary | Confirmed no main-push workflow exists, detailed publish.yml behavior, flagged GITHUB_TOKEN chaining issue |
| .github/workflows/publish.yml | Direct file read | Verified trigger (tag push v*), permissions (id-token:write, contents:read), version validation logic (lines 31-38) |
| package.json | Direct file read | Confirmed version 1.3.3, package name @projectxinnovation/helix-cli, build/test scripts |
| src/update/check.ts | Direct file read | Confirmed canonical repo identity and main branch convention |
| GitHub Actions docs (Context7) | GITHUB_TOKEN behavior verification | Confirmed GITHUB_TOKEN events do not trigger other workflows; PAT/App token required for chaining |
| actions/checkout docs (Context7) | Token parameter behavior | Confirmed token parameter accepts PAT, persists credentials for git push |

# Ticket Context

- ticket_id: cmp5p01tn0001kw0u6i5m09wp
- short_id: BLD-451
- run_id: cmp5p01ua0004kw0u7dmp4uf4
- run_branch: helix/build/BLD-451-automate-helix-cli-release-tagging-from-version
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Automate helix-cli release tagging from version bumps

## Description
# Ticket: Automate helix-cli release tagging from version bumps

## Summary
Refactor the `helix-cli` GitHub Actions release flow so a merge to `main` that bumps the root `package.json` version automatically creates and pushes the matching Git tag, which then triggers the existing tag-based npm publish workflow.

## Why
The current publish workflow only runs on pushed tags, so merging a version bump to `main` is not enough to publish to npm. We need the release automation to identify the version bump from the merged commit, create the correct tag exactly once, and let the existing publish workflow handle npm publication.

## Decisions Already Made
- `helix-cli/package.json` is the source of truth for the release version.
- The publish workflow must remain tag-triggered.
- GitHub Release objects are not the source of truth and must not be used as the trigger.
- The implementation must be simple and avoid redesigning the release process beyond what is necessary to create the tag.

## Do Not Re-Decide
- Do not switch npm publishing to run directly from `main`.
- Do not require manual tag creation as part of the normal release path.
- Do not add GitHub Release event handling unless it is strictly needed to support the tag creation flow.
- Do not broaden this into a general release-management refactor.

## Non-Negotiable Invariants
- The version in the root `package.json` must remain the source of truth for the release tag name.
- The generated tag must be exactly `v<package.json version>`.
- If the tag already exists, the workflow must not create a duplicate tag.
- If the version cannot be read or the tag cannot be created, the workflow must fail closed.
- The existing publish workflow must continue to publish only from tag pushes.

## In Scope
- Add or refactor GitHub Actions in `helix-cli` to detect a version bump on `main`.
- Read the current `package.json` version from the merge commit on `main`.
- Create and push the matching `v<version>` tag when it does not already exist.
- Leave the existing npm publish workflow tag-triggered.
- Add minimal validation so the tag creation path is safe and idempotent.

## Out of Scope
- Changing the release workflow to publish directly from branch pushes.
- Any repository-wide release tooling outside `helix-cli`.
- GitHub Release UI automation.
- Package version management outside the root `package.json`.

## Required Behavior
1. On a push to `main`, inspect the root `package.json` version in the pushed commit.
2. If the version differs from the prior release tag or the tag does not already exist, create and push `v<version>`.
3. If the push does not include a version bump, do nothing.
4. Preserve the existing publish workflow so the new tag push triggers npm publication.
5. Ensure the flow is safe to rerun without creating duplicate tags.

## Failure Behavior
- If `package.json` cannot be read, the workflow must fail.
- If the tag already exists, the workflow must exit successfully without creating a duplicate.
- If tag creation or push fails, the workflow must fail and not attempt to publish as a fallback.

## Batch / Cardinality Rules
- Operate on exactly one version per push.
- Do not infer a release from multiple files, multiple packages, or historical tags across unrelated commits.
- Do not treat unrelated changes on the same commit as release triggers.

## Persistence / Artifact Rules
- No new runtime artifact format is required.
- The only persistent release marker is the git tag `v<version>`.

## Acceptance Criteria
1. A merge to `main` that bumps `package.json` to `1.3.3` automatically creates and pushes `v1.3.3`.
2. The existing tag-triggered publish workflow runs after the tag is pushed and publishes to npm.
3. A merge to `main` without a version bump does not create a tag.
4. Re-running the workflow for the same commit does not create duplicate tags or duplicate publish triggers.

## Attachments
- (none)

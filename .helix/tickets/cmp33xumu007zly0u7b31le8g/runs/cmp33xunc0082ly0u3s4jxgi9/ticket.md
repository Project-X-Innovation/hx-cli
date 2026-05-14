# Ticket Context

- ticket_id: cmp33xumu007zly0u7b31le8g
- short_id: BLD-435
- run_id: cmp33xunc0082ly0u3s4jxgi9
- run_branch: helix/build/BLD-435-bump-helix-cli-package-version-to-1-3-3-for-the
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Bump helix-cli package version to 1.3.3 for the next npm release

## Description
# Ticket: Bump helix-cli package version to 1.3.3 for the next npm release

## Summary
Update the `helix-cli` package version from `1.3.2` to `1.3.3` in preparation for the next npm release.

## Why
`helix-cli` now publishes to npm from its GitHub Actions release workflow when a matching `v*` tag is pushed. That means the package version is now part of the release contract, and we need the repo prepared for the next publishable release.

## Decisions Already Made
- This is a patch release.
- The target version is exactly `1.3.3`.
- This ticket is only for the version bump and any minimal release-note or documentation touch that is strictly required by the existing repo conventions.
- Do not redesign the release workflow in this ticket.

## Do Not Re-Decide
- Do not choose a different semver level.
- Do not leave the version unspecified.
- Do not add unrelated CLI feature work.
- Do not change npm package name, publish workflow trigger, or distribution strategy.

## Non-Negotiable Invariants
- `package.json` must end at version `1.3.3`.
- Any other repo files changed must be strictly necessary to keep the release metadata coherent.
- The implementation must not include unrelated source-code changes.
- The repo must remain compatible with the existing publish workflow that verifies tag `v1.3.3` matches `package.json`.

## In Scope
- `helix-cli/package.json`
- Minimal supporting release metadata, only if the repo already requires it

## Out of Scope
- New CLI features or fixes
- Release workflow redesign
- Tag creation or npm publication itself
- Cross-repo changes outside `helix-cli`

## Required Behavior
1. Change `helix-cli/package.json` version from `1.3.2` to `1.3.3`.
2. If there is any existing release metadata that must stay in sync with the package version, update only that metadata.
3. Verify the repo still typechecks and builds after the version bump.
4. Keep the diff narrow and release-scoped.

## Failure Behavior
- If the version bump would require broader release-process changes, stop and report that explicitly instead of improvising.
- If any unrelated file appears to need changes, explain why before including it.

## Acceptance Criteria
1. `helix-cli/package.json` shows version `1.3.3`.
2. No unrelated product code changes are included.
3. The repo still passes the normal local validation used for a release prep change.
4. The result is ready for a later matching Git tag `v1.3.3` to trigger npm publish.

## Attachments
- (none)

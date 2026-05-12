# Ticket Context

- ticket_id: cmp2u3z59001jly0uag6d52yf
- short_id: FIX-432
- run_id: cmp2wfs5n002sly0uxnt74i6z
- run_branch: helix/fix/FIX-432-harden-ignored-path-staging-and-clean-helix-cli
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Harden ignored-path staging and clean helix-cli tracked dependencies

## Description
# Ticket: Harden ignored-path staging and clean helix-cli tracked dependencies

## Summary
Helix ticket runs are failing during the implementation commit phase with `git add changes for implementation failed` because the workflow stages an explicit path list and `helix-cli` currently has `node_modules` tracked on active branches even though that path is supposed to be ignored. Fix this in two places: harden the server-side staging logic in `helix-global-server` so ignored tracked paths cannot abort the commit phase, and clean `helix-cli` so `node_modules` is no longer tracked and remains ignored going forward.

## Why
This is causing repeated ticket failures against `helix-cli` while other repos continue to work. The root issue is not just local developer state. `helix-cli` remote branches currently contain tracked `node_modules`, so `.gitignore` is not enough by itself. The server-side workflow is also brittle because one ignored path leaking into the staging set aborts the entire implementation commit step instead of staging the valid work and continuing.

## Decisions Already Made
- The fix must include both `helix-global-server` and `helix-cli`.
- `helix-global-server` must be hardened so an ignored tracked path in a repo cannot fail the implementation commit step.
- `helix-cli` must be cleaned so `node_modules` is not tracked on the active Helix branches.
- The canonical server commit path is `helix-global-server/src/helix-workflow/git-ops.ts`.
- The canonical CLI ignore file is `helix-cli/.gitignore`.
- The observed failing path is `node_modules`, but the server fix must be generic for any tracked path that still matches Git ignore rules.

## Do Not Re-Decide
- Do not treat this as a user-environment-only problem.
- Do not implement a workaround that force-adds ignored paths.
- Do not scope the fix to `node_modules` string matching only.
- Do not stop after adding `.gitignore` entries if tracked files remain in the Git index.
- Do not require manual cleanup as the primary fix for future ticket runs.

## Non-Negotiable Invariants
- The implementation commit phase must fail closed on real Git errors, but it must not fail solely because a tracked path also matches ignore rules.
- `helix-global-server` must stage only valid committable paths during implementation and related commit phases.
- `helix-cli` must not keep `node_modules` tracked after this fix.
- `helix-cli/.gitignore` must explicitly ignore `node_modules/`.
- The fix must preserve existing `.helix` artifact handling behavior.

## In Scope
- Update `helix-global-server` workflow staging logic to exclude tracked files that currently match Git ignore rules before calling `git add`.
- Add or update tests for the staging-path selection logic in `helix-global-server`.
- Clean `helix-cli` so `node_modules` is removed from the Git index on the branches Helix uses for tickets.
- Ensure `helix-cli/.gitignore` contains the correct `node_modules/` ignore rule.
- Verify that a failed `helix-cli` ticket can be continued or rerun successfully after the fix is deployed and the repo cleanup is in place.

## Out of Scope
- Broad Git history rewriting across unrelated branches unless strictly required.
- General dependency-management refactors in `helix-cli`.
- Unrelated workflow or ticket-orchestration changes outside the staging failure.

## Required Behavior
1. In `helix-global-server/src/helix-workflow/git-ops.ts`, update the path selection for commit staging so tracked files that match Git ignore rules are excluded from the normal `git add` pathspec list before `git add` runs.
2. Keep the fix generic. It must work for any tracked ignored path, not just `node_modules`.
3. Preserve the existing special handling for `.helix` artifacts. Do not regress the current behavior around `commitArtifactsToGithub`.
4. Add regression coverage that proves ignored tracked paths are excluded from the staged path list while normal tracked and untracked source files still stage correctly.
5. In `helix-cli`, remove `node_modules` from the Git index on the branches Helix actually uses, and commit the cleanup as a normal Git change.
6. In `helix-cli/.gitignore`, ensure `node_modules/` is present as an ignore rule after the cleanup.
7. After deploying the server fix and applying the repo cleanup, verify that a previously failing `helix-cli` ticket no longer dies at `git add changes for implementation failed` due to ignored-path staging.

## Failure Behavior
- If the server-side logic cannot determine ignored tracked paths safely, fail the run with an explicit error rather than falling back to `git add` on an unsafe broad pathspec.
- If `helix-cli` cleanup would leave `node_modules` still tracked on the ticket base branches, do not mark the work complete.
- Do not silently skip verification of the resumed or rerun ticket path.

## Batch / Cardinality Rules
- Treat server hardening and CLI repo cleanup as two required deliverables under one ticket. Do not complete only one half.
- For `helix-cli` branch cleanup, verify each Helix-relevant base branch explicitly. Do not assume one cleaned branch is a proxy for all branches Helix may use.
- For verification, use at least one concrete failed `helix-cli` ticket continuation or rerun as evidence. Do not substitute a theoretical code-only review.

## Persistence / Artifact Rules
- The ticket implementation notes and verification artifacts must clearly state which `helix-cli` branches were cleaned.
- Verification artifacts must include evidence that the server-side staging logic excluded tracked ignored paths and that the `helix-cli` retry no longer fails at the `git add` implementation step.

## Acceptance Criteria
1. `helix-global-server` excludes tracked ignored paths from the implementation commit stage list without regressing normal source-file staging or `.helix` artifact handling.
2. `helix-global-server` has regression coverage for the ignored-tracked-path case.
3. `helix-cli` no longer has `node_modules` tracked on the active Helix ticket base branches.
4. `helix-cli/.gitignore` explicitly ignores `node_modules/`.
5. A previously failing `helix-cli` ticket continuation or rerun completes the implementation commit phase without the ignored-path `git add` failure.
6. The implementation does not solve this by force-adding ignored files or by special-casing only `node_modules`.

## Attachments
- (none)

## Discussion
- **Helix** (2026-05-12T16:55:24.382Z) [Agent]: I'm working on this, I'll get back to you when ready.

# Ticket Context

- ticket_id: cmpd9klfo00c9fw0ulh7wbwvx
- short_id: BLD-517
- run_id: cmpd9klg800ccfw0u71qwarc7
- run_branch: helix/build/BLD-517-install-and-update-hlx-from-github-main-instead
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Install and update hlx from GitHub main instead of npm

## Description
# Install and update hlx from GitHub main instead of npm

## Summary
Refactor `hlx` so it installs and self-updates directly from the `main` branch on GitHub on every install and update. Remove the npm registry from the loop entirely. Update the README and other in-repo install/update documentation to match.

## Why
The current release model bumps `package.json`, tags via CI, and publishes to npm before users can update. The chain is fragile (the auto-tag CI step has broken, leaving npm pinned behind `main`). Every merge to `main` is already considered shippable, so the version bump and the npm round-trip are friction with no benefit. Installing directly from `main` makes every merged change immediately available.

## Decisions Already Made
- Install transport is `npm install -g <git-url>` against the repo's `main` branch. npm is retained as the installer because it correctly runs the `prepare` script (which already builds via `tsc`) and links the `bin`. The npm registry itself is not used at any step.
- The canonical install command documented for users is `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`. HTTPS, not SSH — npm picks up the user's existing GitHub credential helper (e.g. `gh auth login`). SSH remains valid for users whose machines prefer it; only one canonical form needs documenting.
- The repo is private. Users are expected to already have GitHub authentication configured (HTTPS credential helper or SSH key).
- Update checks compare commit SHAs, not semver versions. Remote SHA is read via `git ls-remote`; the installed SHA is recorded by `hlx` itself in its existing per-user config file under the install-source schema. `hlx` must not depend on inspecting the installed package's `package.json` for resolved-SHA metadata — recent npm versions do not write it.
- Migration: users who originally installed from npm must be switched over transparently the first time they run `hlx update` after this lands.

## Do Not Re-Decide
- Whether to keep publishing to npm. We are not.
- Whether to use a different transport (homebrew, GitHub Releases tarball, curl-pipe-bash, prebuilt tarball). We are not.
- Whether to keep semver-based update comparisons in the update flow. We are not — SHA-only.

## Non-Negotiable Invariants
- `hlx update` must result in the user running the exact code on `origin/main` HEAD at the moment of update. No version is "too new" or skipped.
- After update, `hlx` must remain available on the user's `PATH` with the same invocation surface as before.
- After a successful install or update, `hlx --version` must include enough information to identify the installed commit (semver from `package.json` plus the short SHA, e.g. `1.3.4 (c8620a5)`).
- The npm registry must not be queried at any point in the install, update, or update-check flow.
- `hlx update` must fail closed: if the remote SHA cannot be fetched, the install fails, or post-install validation fails, the command reports failure and exits non-zero. No silent fallback to "keep using whatever's installed."
- The pre-command auto-update check must remain non-blocking: warn and continue on any failure, never block command dispatch.

## In Scope
- The `hlx update` command.
- The pre-command auto-update check.
- The install-source migration path for users who originally installed via npm.
- The README install and update sections.
- Any other in-repo documentation referencing the npm install command, npm release pipeline, or version-bump-to-ship process.

## Out of Scope
- Any other CLI command behavior.
- The CI workflows that auto-tag and publish to npm. They become dead weight after this change; decisions about removing them are out of this ticket unless they create contradictions with the updated user-facing documentation.
- Storage of per-user config in any new location. Continue using the existing per-user config file and existing install-source schema.

## Required Behavior
1. The documented install command for new users is `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`.
2. `hlx update` (no flags) must:
   a. Fetch the remote `main` HEAD SHA.
   b. Read the locally-recorded installed SHA from config.
   c. If equal, print an "Already up to date" message and exit 0.
   d. If different (or the local SHA is absent), run the documented install command, then run the existing post-install validation, then record the new SHA in config.
   e. On any step failure, exit non-zero with a clear error message and a recovery command the user can copy-paste.
3. `hlx update --enable-auto` and `--disable-auto` behave the same as today; only the underlying signal changes from version to SHA.
4. The pre-command auto-update check performs the same SHA comparison and triggers the same install path on mismatch, in quiet mode.
5. First-run migration: when `hlx update` runs and the recorded install source is missing or marked as npm, the command must (a) print a one-line notice that it is switching the install source to GitHub `main`, (b) run the install path, (c) record the install source as GitHub with the new SHA.
6. `hlx --version` must include the short SHA of the installed commit, drawn from the same config field. If the field is missing (legacy installs), fall back to the existing semver-only output and a one-line note to run `hlx update` to refresh install metadata.

## Failure Behavior
- Remote SHA fetch fails: `hlx update` exits non-zero with the underlying error. The auto-update pre-command check logs a warning to stderr and continues.
- Install (npm clone + build) fails: surface the npm stderr, do not update the recorded SHA, exit non-zero, and print a clean reinstall command.
- Post-install validation fails: treated the same as install failure. Do not record success.
- Config file is unreadable or corrupt: treat as "no recorded install source", trigger the migration path; do not attempt silent repair.

## Acceptance Criteria
1. A fresh machine with GitHub HTTPS credentials configured (e.g. `gh auth login`) can run the documented install command and end up with a working `hlx` whose `--version` output includes both a semver and a short SHA.
2. Immediately after install, `hlx update` reports "Already up to date" until a new commit lands on `main`.
3. After a new commit lands on `main`, `hlx update` installs the new SHA and the recorded config SHA matches the output of `git ls-remote` against the canonical repo.
4. A user whose existing install came from npm runs `hlx update` and is migrated transparently: the recorded install source becomes GitHub `main` with a SHA, and the binary continues to work without manual reinstall.
5. With network unavailable, `hlx update` fails non-zero with a clear error; existing `hlx` invocations are unaffected.
6. With network unavailable, the pre-command auto-update check emits a warning to stderr but does not block command dispatch.
7. The README contains exactly one canonical install command (the HTTPS git URL form) and one canonical update command (`hlx update`). No remaining recommendation of `npm install -g @projectxinnovation/helix-cli` for install or update purposes.
8. Neither the install path nor the update path queries the npm registry.

## Attachments
- (none)

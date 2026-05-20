# Ticket Context

- ticket_id: cmpea6fdz001bjo0uktcklzhb
- short_id: BLD-527
- run_id: cmpea6fee001ejo0u41xf8d7o
- run_branch: helix/build/BLD-527-replace-hlx-self-update-with-github-release
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Replace hlx self-update with GitHub release assets and remove auto-tag-on-main

## Description
# Ticket: Replace `hlx` self-update with GitHub release assets and remove auto-tag-on-main

## Summary
Refactor `helix-cli` so normal install and update no longer depend on npm publish or source installs from `git+https`. Instead, every merge to `main` must produce a prebuilt GitHub release asset that `hlx update` and auto-update can download and install safely. At the same time, remove the workflow that auto-pushes tags on every `main` merge. npm publishing remains available only as a manual, tag-driven path when we intentionally want to publish a version to npm.

## Why
The current GitHub-main update path is not reliable enough for users or auto-update. On Windows, `hlx update` currently shells out to `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`, which runs `prepare`, which runs `tsc`, and the install can fail because the build toolchain is not available in the transient global install environment. Worse, a failed update can remove the working global install and leave `hlx` unusable. Separately, the current auto-tag-on-main workflow adds release friction we no longer want: every merge to `main` does not need an npm publish, and pushing tags via workflow token is operationally heavier than desired.

## Decisions Already Made
- Normal install/update must come from GitHub, not from the npm registry.
- Do not install from raw Git source via `npm install -g git+https://...#main`.
- GitHub must serve a prebuilt artifact produced by CI from `main`.
- `hlx update` and auto-update must use the same underlying install mechanism.
- Failed update attempts must not brick an already working CLI.
- Remove the workflow that automatically pushes tags on `main`.
- Keep the npm publish workflow available for intentional, traditional tagged releases only.
- Manual tagging for npm releases is acceptable and preferred over automatic tagging.

## Do Not Re-Decide
- Do not go back to npm as the normal update channel.
- Do not keep the current direct `npm install -g git+https://...#main` updater path.
- Do not auto-push release tags from `main`.
- Do not require a new custom release token just to keep normal GitHub-based updates working.
- Do not redesign unrelated CLI command behavior.

## Non-Negotiable Invariants
- If `hlx` is currently installed and runnable, a failed `hlx update` must leave the existing CLI runnable.
- Auto-update must fail open: warn and continue command dispatch; never brick the CLI.
- Manual `hlx update` must fail closed: non-zero exit and clear recovery guidance on failure.
- The installed live CLI must not be replaced until the candidate update artifact has been fully downloaded, unpacked, and validated.
- The update path must consume a prebuilt artifact; it must not require `tsc` or other build tools on the user machine.
- The regular `main` merge path must not depend on pushing tags.
- The workflow change must not remove the ability to publish to npm manually from an explicit tag.

## In Scope
- `helix-cli` install/update implementation.
- `hlx update`.
- Pre-command auto-update behavior.
- GitHub Actions workflow changes in `helix-cli`.
- Removing the auto-tag workflow on `main`.
- Creating or updating GitHub release artifacts from `main`.
- CLI documentation and in-repo docs that describe install/update behavior.
- Clear authentication and failure messaging for downloading private GitHub artifacts.

## Out of Scope
- Reworking unrelated CLI commands.
- Removing the manual npm publish workflow.
- Building a separate package manager integration such as Homebrew, winget, or MSI.
- General repo cleanup beyond the workflows/docs directly touched by this change.

## Required Behavior
1. On every push to `main`, GitHub Actions must build `helix-cli`, run the existing validation/test steps needed for confidence, and publish a prebuilt release artifact from that exact `main` commit.
2. The GitHub workflow must use the repo's standard built-in GitHub Actions capabilities where possible. Do not require a custom token merely to auto-push tags, because auto-pushing tags is being removed.
3. The workflow that auto-tags `main` must be removed.
4. The existing tag-triggered npm publish workflow must remain available for intentional manual releases. If a maintainer pushes a tag traditionally, npm publish can still run.
5. `hlx update` must stop invoking `npm install -g git+https://...#main`.
6. `hlx update` must:
   a. discover the latest update artifact corresponding to the newest published `main` build,
   b. compare the remote commit SHA to the locally recorded installed commit SHA,
   c. exit 0 with "Already up to date" when equal,
   d. otherwise download the prebuilt artifact to a staging area,
   e. unpack and validate the staged candidate,
   f. only after successful validation switch the live install to the new candidate,
   g. record the installed commit SHA and install-source metadata after success.
7. The auto-update pre-command check must use the same artifact channel and the same staged install mechanism as `hlx update`.
8. If the GitHub repo/artifact is private and the user is not authenticated to GitHub, the updater must fail with a clear message telling the user exactly what kind of GitHub auth is expected. Do not silently fall back to npm or a source install.
9. `hlx --version` must continue to report enough information to identify the installed build, including the installed commit SHA.
10. Documentation must clearly describe the normal install/update path from GitHub and the separate manual-tag npm-release path.

## Failure Behavior
- If the remote artifact metadata cannot be fetched, `hlx update` must exit non-zero and keep the current install unchanged.
- If artifact download fails, `hlx update` must exit non-zero and keep the current install unchanged.
- If unpacking fails, `hlx update` must exit non-zero and keep the current install unchanged.
- If validation fails, `hlx update` must exit non-zero and keep the current install unchanged.
- Auto-update must log a warning and continue execution on any of the above failures.
- Authentication failure against private GitHub assets must produce explicit guidance; do not emit a vague generic download error if the real problem is missing auth.
- If install metadata is missing or corrupt, treat that as "needs reinstall/update metadata refresh," but do not destroy the current runnable install before the staged candidate passes validation.

## Batch / Cardinality Rules
- There is exactly one canonical update channel for normal users: the latest successful prebuilt artifact from `main`.
- There is exactly one live installed CLI payload at a time.
- Staged update payloads must be treated as temporary candidates and must not become live until validation passes.
- Do not use a partially downloaded or partially unpacked candidate as the live install.

## Persistence / Artifact Rules
- Record install-source metadata in the existing per-user config, including at minimum source=`github`, channel=`main` or equivalent, and the installed commit SHA.
- The GitHub CI artifact must contain the runnable built CLI payload. It must not depend on a user-side build step.
- The updater must validate the staged payload before switching. At minimum, validate that the entrypoint exists and the CLI can report `--version`.
- The implementation must leave a clear recovery path for a broken install, but recovery messaging must not be the primary update mechanism.

## Acceptance Criteria
1. A merge to `main` produces a prebuilt GitHub-served artifact for `helix-cli` without creating or pushing a release tag.
2. The `.github/workflows/auto-tag.yml` workflow is removed.
3. The manual tag-driven npm publish workflow still works when a maintainer intentionally pushes a tag.
4. On a machine with a working installed `hlx`, `hlx update` updates to the newest `main` artifact without requiring local `tsc` or a source build.
5. On a machine with a working installed `hlx`, if the artifact download/build validation path fails, the previously installed `hlx` still runs afterward.
6. Auto-update uses the same staged mechanism and never leaves the CLI unusable after a failed attempt.
7. If the user lacks required GitHub authentication for a private artifact, `hlx update` fails with explicit auth guidance and leaves the current install intact.
8. No normal install/update documentation tells users to use `npm install -g @projectxinnovation/helix-cli@latest` or `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main` as the primary path.
9. `hlx --version` on a successful GitHub-installed build includes the installed commit SHA.
10. The implementation includes a verification step that reproduces the current failure mode and demonstrates that after the fix a failed update no longer bricks the installed CLI.

## Attachments
- (none)

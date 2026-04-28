# Ticket Context

- ticket_id: cmoeq4loo005wi00u1e9nshbv
- short_id: HLX-316
- run_id: cmog2ul96005ri00ur1sfk518
- run_branch: helix/auto/HLX-316-add-github-main-self-update-and-auto-update-to
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Add GitHub main self-update and auto-update to helix-cli

## Description
Add a user-invokable `hlx update` command and a persisted `autoUpdate` setting to `helix-cli`. The update source of truth is the canonical GitHub repository `Project-X-Innovation/helix-cli` on branch `main`. When `autoUpdate` is enabled, each CLI invocation must check whether the installed CLI is behind the latest `main` commit and, if so, update itself before continuing.

## Why

We do not yet have npm publishing set up, but we want users to always run the latest CLI from `main`. The update flow must therefore use GitHub directly instead of npm or server-reported version metadata. This ticket must make that behavior explicit and deterministic enough to avoid ambiguous or partial update logic.

## Decisions Already Made

- The source of truth for updates is GitHub repository `Project-X-Innovation/helix-cli` branch `main`.

- Do not use npm registry version checks in this ticket.

- Do not use server-driven version metadata in this ticket.

- `hlx update` must exist as an explicit command.

- `autoUpdate` must be a persisted local setting.

- If `autoUpdate` is enabled, every CLI invocation must check GitHub `main` before running the requested command.

- Update identity is the canonical GitHub `main` HEAD commit SHA, not semver.

- The CLI must persist enough local metadata to know whether it was installed from the canonical GitHub repo/branch and what commit it currently corresponds to.

- The local CLI config file `~/.hlx/config.json` remains the source of truth for persisted CLI settings.

- The CLI version string should still come from package metadata for display, but update eligibility is determined by GitHub commit SHA.

## Do Not Re-Decide

- Do not switch this ticket back to npm-driven updates.

- Do not add server participation in version checks.

- Do not use GitHub releases or tags as the update source of truth.

- Do not treat semver as the update target.

- Do not redesign the whole auth/config system.

- Do not broaden this into a packaging or publish-pipeline ticket.

## Non-Negotiable Invariants

- The only authoritative update target is `Project-X-Innovation/helix-cli` branch `main`.

- The CLI must not auto-update unless `autoUpdate` is explicitly enabled.

- `hlx update` must work even when `autoUpdate` is disabled.

- The CLI must not guess update eligibility for unsupported install modes.

- If the CLI was not installed from the canonical GitHub repo/branch, the update flow must fail clearly instead of attempting a risky self-update.

- The CLI must not enter an infinite self-update loop.

- The CLI must not rewrite unrelated config fields when storing settings or update metadata.

- The implementation must use the real installed package version for `--version`, not a stale hardcoded string.

- One invocation must perform at most one update attempt.

## In Scope

- Add `hlx update`.

- Add persisted `autoUpdate` setting and command surface to manage it.

- Add GitHub `main` update-check flow.

- Add local persisted metadata needed to identify canonical GitHub install/update state.

- Add targeted docs/help text for update behavior.

- Fix version-reporting drift in `helix-cli` if needed.

## Out of Scope

- npm publish automation.

- npm-based self-update logic.

- Server-driven version checks.

- GitHub releases/tags as update source.

- Broader CLI redesign.

- Unrelated command cleanup.

- Support for arbitrary forks, branches, or custom install sources.

## Allowed Files To Change

- `src/index.ts`

- `src/lib/config.ts`

- `src/lib/http.ts` only if minimal shared request helpers are needed

- new `src/update/*` files if needed

- `package.json`

- `README.md` if needed for minimal usage documentation

- targeted tests for update/config/version behavior

## Forbidden Changes

- Do not add npm-registry polling.

- Do not add server version endpoints or server-side CLI update logic.

- Do not modify unrelated CLI commands except for minimal wiring needed to run the update check before command execution.

- Do not add broad dependency churn without a clear implementation need.

- Do not commit secrets or environment-specific credentials.

- Do not add support for updating from arbitrary GitHub repos, branches, or local paths.

## Required Behavior

1. Add `hlx update` as an explicit command that checks the latest commit SHA on `Project-X-Innovation/helix-cli` branch `main`.

2. Add a persisted `autoUpdate` setting in `~/.hlx/config.json`.

3. Add a command surface to enable/disable `autoUpdate` explicitly. The setting must round-trip without losing other config fields.

4. When `autoUpdate` is enabled, every CLI invocation must perform a lightweight GitHub `main` HEAD check before executing the requested command.

5. The CLI must persist local update-source metadata sufficient to determine:

   - install mode

   - canonical repo URL

   - tracked branch

   - installed commit SHA if known

6. The client must only auto-update when the install is recognized as a canonical GitHub-based install of `Project-X-Innovation/helix-cli#main`.

7. If the local install is eligible and the installed commit SHA is behind `main`, the CLI must update itself once and then continue only after success.

8. The update implementation must use the canonical GitHub source for reinstall/update, not npm.

9. `hlx --version` must use package metadata rather than a hardcoded string.

10. The CLI must clearly report when it is already current, when it updated successfully, and when it cannot self-update because the install mode is unsupported.

## Failure Behavior

- If the GitHub check fails due to network/API issues, the CLI must not corrupt the install or config.

- If `hlx update` fails, exit non-zero and print a clear reason.

- If `autoUpdate` is enabled and the install mode is unsupported, fail clearly rather than attempting a risky update.

- If update metadata is missing or inconsistent, fail closed and report what is missing.

- If the CLI cannot determine whether it is a canonical GitHub install, do not update.

- If the CLI cannot determine its installed version or tracked commit, fail clearly rather than guessing.

- If the update attempt fails, do not recursively retry within the same invocation.

## Batch / Cardinality Rules

- One CLI invocation performs at most one update check.

- One CLI invocation performs at most one automatic update attempt.

- Do not check multiple repos or branches.

- Do not compare against tags, releases, or multiple candidate versions.

- Only compare the local install against GitHub `main` HEAD for the canonical repo.

## Persistence / Artifact Rules

- Persist `autoUpdate` and update-source metadata only in `~/.hlx/config.json`.

- Preserve existing config fields such as `apiKey` and `url`.

- Do not write update state into the repo.

- Do not store temporary update artifacts in committed files.

## Acceptance Criteria

1. `hlx update` exists and checks against `Project-X-Innovation/helix-cli#main`.

2. `autoUpdate` can be enabled and disabled explicitly and persists in `~/.hlx/config.json`.

3. With `autoUpdate` enabled, normal CLI invocations perform one GitHub `main` HEAD check before command execution.

4. The update decision is based on commit SHA comparison, not npm version comparison.

5. `hlx --version` matches package metadata and no longer uses a stale hardcoded value.

6. The CLI only auto-updates when the local install is recognized as a canonical GitHub `main` install.

7. Unsupported install modes fail clearly and do not attempt self-update.

8. The implementation prevents recursive update loops.

9. Network/API failure during update check produces a clear failure mode instead of fake success or silent mutation.

## Verification

- Verify `hlx --version` matches package metadata.

- Verify `hlx update` reports “already current” when local SHA matches GitHub `main`.

- Verify `hlx update` performs an update when local SHA is behind.

- Verify enabling/disabling `autoUpdate` persists correctly in `~/.hlx/config.json`.

- Verify a normal CLI command performs one update check when `autoUpdate=true`.

- Verify no automatic update check runs when `autoUpdate=false`.

- Verify unsupported install modes fail clearly and do not mutate the install.

- Verify the CLI performs at most one update attempt per invocation.

- Verify the CLI does not loop when re-executing after update or when update fails.

## Attachments
- (none)

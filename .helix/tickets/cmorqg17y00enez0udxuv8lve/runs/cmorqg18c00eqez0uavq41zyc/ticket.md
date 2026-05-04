# Ticket Context

- ticket_id: cmorqg17y00enez0udxuv8lve
- short_id: BLD-375
- run_id: cmorqg18c00eqez0uavq41zyc
- run_branch: helix/build/BLD-375-publish-helix-cli-to-npm-with-trusted-publishing
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Description
# Ticket: Publish helix-cli to npm using Trusted Publishing with GitHub OIDC

## Summary
Implement npm publishing for `@projectxinnovation/helix-cli` using npm Trusted Publishing with GitHub Actions OIDC. The implementation must publish installable packages from the `helix-cli` GitHub repository without using a long-lived npm publish token, and it must add packaging validation that fails closed if the published tarball would be missing required runtime files such as `dist/index.js`.

## Why
`hlx update` is currently trying to install from GitHub main and the install path is brittle on Windows. We want a stable npm release flow so the CLI can update from published npm versions instead of pulling directly from GitHub. We also already observed a broken install where the global package was missing `dist/index.js` and `dist/lib/resolve-ticket.js`, so packaging validation must be part of this work.

## Decisions Already Made
- Use npm Trusted Publishing with GitHub OIDC.
- Do not use a long-lived `NPM_TOKEN` for npm publish.
- Publish from the `helix-cli` repository.
- The package name remains `@projectxinnovation/helix-cli`.
- The publish flow must build and verify the package before publish.
- The implementation must preserve the existing CLI entrypoint contract: `hlx` -> `dist/index.js`.
- The repository metadata in `package.json` must match the exact GitHub repository used for publish.

## Do Not Re-Decide
- Do not switch this to token-based publishing unless implementation is blocked and that blocker is reported explicitly.
- Do not redesign this into GitHub Packages instead of npm.
- Do not change the package name.
- Do not change the CLI binary name from `hlx`.
- Do not broaden scope into unrelated CLI feature work.

## Non-Negotiable Invariants
- Publishing must use GitHub Actions OIDC permissions required for npm Trusted Publishing.
- The publish workflow must run on GitHub-hosted runners, not self-hosted runners.
- The workflow must fail closed if build, tests, pack validation, or publish preconditions fail.
- The publish path must verify that the packed artifact includes `dist/index.js` and the runtime files needed by the installed CLI.
- The workflow must not publish if the tarball contents are incomplete.
- `package.json` must include exact repository metadata for `https://github.com/Project-X-Innovation/helix-cli.git`.
- The implementation must keep published package contents intentionally limited; do not publish repo-local artifacts beyond what the CLI package needs at runtime.

## In Scope
- `helix-cli/package.json`
- `.github/workflows/publish.yml` in the `helix-cli` repo
- Supporting publish/validation scripts if needed
- Minimal documentation updates for the release flow if needed
- Updating the CLI update path to consume npm releases instead of GitHub main, only if required to complete the npm-based update flow

## Out of Scope
- Unrelated CLI command changes
- Repo-wide cleanup or refactors
- GitHub Packages support
- Token-based npm publishing as the primary design
- New CI systems beyond GitHub Actions

## Required Behavior
1. Add a GitHub Actions publish workflow for `helix-cli` that uses OIDC-compatible permissions for npm Trusted Publishing.
2. Ensure the workflow installs dependencies, builds the project, runs tests, and only then attempts to publish.
3. Add a deterministic pack validation step before publish. This step must inspect the artifact that would actually be published, not just the working tree.
4. Verify the packed artifact contains at minimum the installed CLI entrypoint and required runtime JS files under `dist/**`.
5. Ensure `package.json` contains the exact repository metadata needed for npm trusted publish from GitHub.
6. If the current `hlx update` flow is still GitHub-main based, migrate it to update from npm releases in a way that is consistent with the published package name and versioning model.
7. Document the expected release trigger clearly enough that the UI-side npm trusted publisher configuration can point at a stable workflow filename.

## Failure Behavior
- If build fails, do not publish.
- If tests fail, do not publish.
- If the tarball content check fails, do not publish.
- If OIDC publish authentication is unavailable or misconfigured, fail the workflow explicitly; do not fall back to token publish.
- If required repository metadata is missing or inconsistent with the GitHub repo, fail before publish.

## Batch / Cardinality Rules
- One publish run produces one npm package release for one package name.
- Do not multiplex multiple package publishes in this workflow.
- Validation must run against the exact single tarball being published.

## Persistence / Artifact Rules
- GitHub Actions artifacts are allowed only if they directly support publish diagnostics.
- Do not commit new `.helix` artifacts for this work unless the existing repo policy explicitly requires them.
- If a tarball or pack manifest is generated for validation, keep it as a workflow artifact or ephemeral runner file unless a committed file is strictly required.

## Acceptance Criteria
1. The repo contains a publish workflow file at `.github/workflows/publish.yml` that is suitable for npm Trusted Publishing from GitHub Actions.
2. `package.json` includes exact repository metadata for the `Project-X-Innovation/helix-cli` GitHub repo.
3. The publish workflow fails before publish if the built package would omit `dist/index.js` or other required installed runtime files.
4. The publish workflow does not require `NPM_TOKEN` for publish.
5. The release flow is documented clearly enough that npm Trusted Publisher UI setup can be completed with workflow filename `publish.yml`.
6. If `hlx update` is in scope for completion, the update path no longer depends on installing directly from GitHub main and instead targets npm releases.
7. No unrelated CLI functionality changes are included beyond what is necessary for the npm release/update path.

## Attachments
- (none)

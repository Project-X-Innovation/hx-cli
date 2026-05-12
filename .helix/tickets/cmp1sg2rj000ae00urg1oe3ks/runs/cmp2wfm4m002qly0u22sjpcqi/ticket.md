# Ticket Context

- ticket_id: cmp1sg2rj000ae00urg1oe3ks
- short_id: BLD-428
- run_id: cmp2wfm4m002qly0u22sjpcqi
- run_branch: helix/build/BLD-428-helix-cli-publish-first-party-install-setup-use
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Helix CLI: publish first-party install/setup/use documentation on the front-end

## Description
# Helix CLI: publish first-party install/setup/use documentation on the front-end

## Summary
The Helix CLI (`@projectxinnovation/helix-cli`, command `hlx`) has no first-party documentation. End users today rely on source files, internal notes (`HELIX_CLI_NOTES.md`), or word-of-mouth for command syntax and recovery steps. This ticket creates a dedicated documentation page in `helix-global-client` covering install, setup, and use. The canonical content is owned by the `helix-cli` repo so the docs cannot drift from CLI behavior.

## Why
The current references for `hlx` are engineer-only:
- `helix-cli/src/**` source files
- `HELIX_CLI_NOTES.md` (operational history, not user-facing docs)
- ad-hoc messaging threads

New users and agents have no canonical landing place that says "install this, log in this way, here are the common commands." This ticket closes that gap.

## Decisions Already Made
- The published documentation page lives in `helix-global-client`.
- The canonical source of truth for the documentation content lives in the `helix-cli` repository. The front-end consumes that content; it does not maintain a parallel hand-edited copy.
- Distribution channel is npm. The install section uses `npm install -g @projectxinnovation/helix-cli@latest`. No GitHub-tarball install path is documented as primary.
- The page is reachable from existing navigation in `helix-global-client`. Add the link inside the closest existing docs/help/onboarding section. Do not introduce a new top-level route unless none exists.

## Do Not Re-Decide
- Do not document a GitHub-tarball install or the legacy `npm link` recovery path as a primary instruction.
- Do not duplicate documentation content in both repos. The front-end must consume the canonical content, not maintain a copy.
- Do not change CLI behavior in this ticket.

## Non-Negotiable Invariants
- Documented commands and flags must match the latest published `@projectxinnovation/helix-cli` version on npm. No documentation of unreleased flags.
- The install section's primary instruction must be `npm install -g @projectxinnovation/helix-cli@latest`.
- The update section's primary instruction must be `hlx update`.
- The page must reference the npm package name `@projectxinnovation/helix-cli` and the binary name `hlx` exactly.

## In Scope
- A new documentation page in `helix-global-client` covering:
  - Install (npm-based)
  - Initial setup and authentication
  - Common commands grouped by area: `tickets`, `inspect`, `comments`, `update`
  - Worked examples for high-value patterns: list with filters, get with `--json`, create with `--description-file`, artifacts with `--run`, `update-description`, `continue --dry-run`
  - Troubleshooting: stale-link symptoms, clean-reinstall recovery via npm
- A canonical content source inside the `helix-cli` repo (single file or directory clearly named for this purpose) that the front-end consumes at build time or render time.
- A navigation entry point in `helix-global-client` that links to the new page.

## Out of Scope
- A complete man-page-style reference for every flag of every subcommand.
- Auto-generated reference documentation from CLI source.
- Internationalization of the docs page.
- Changes to the CLI source itself.

## Required Behavior
1. End-users can reach the Helix CLI documentation from the `helix-global-client` UI without prior knowledge of a URL.
2. The page lists, at minimum: the install command, the login/setup commands, and at least one worked example from each of `tickets`, `inspect`, and `comments`.
3. The page content is sourced from a canonical location in `helix-cli` (build-time import, runtime fetch, or content-as-data) rather than from a hand-maintained copy inside `helix-global-client`.

## Failure Behavior
- If the canonical content source in `helix-cli` is missing or fails to load at build or render time, the build must fail with a clear error referencing the missing content. The front-end must not ship a blank or stub documentation page.

## Acceptance Criteria
1. A new documentation page is reachable from a navigation entry point in `helix-global-client` without manual URL entry.
2. The page renders content sourced from a single canonical location in `helix-cli`, and that location is a clearly named file or directory.
3. The install section directs the user to `npm install -g @projectxinnovation/helix-cli@latest`.
4. The update section directs the user to `hlx update`.
5. The page includes at least one worked example for each of: `hlx tickets list`, `hlx tickets get`, `hlx tickets create`, `hlx tickets artifacts`, `hlx inspect repos`, `hlx comments post`.
6. Negative: removing the canonical content file or directory from `helix-cli` causes the `helix-global-client` build to fail with a clear error that names the missing source. The front-end must not ship a blank page in that scenario.

## Attachments
- (none)

## Discussion
- **Helix** (2026-05-11T23:19:27.067Z) [Agent]: I'm working on this, I'll get back to you when ready.

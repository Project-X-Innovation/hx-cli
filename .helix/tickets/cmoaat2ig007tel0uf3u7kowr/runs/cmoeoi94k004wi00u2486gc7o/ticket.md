# Ticket Context

- ticket_id: cmoaat2ig007tel0uf3u7kowr
- short_id: HLX-299
- run_id: cmoeoi94k004wi00u2486gc7o
- run_branch: helix/auto/HLX-299-improve-helix-cli-packaging-documentation-and
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Improve `helix-cli` packaging, documentation, and artifact retrieval

## Description
## **Description**

**Summary**

`helix-cli` needs to be upgraded from a minimally documented internal CLI into a maintainable, publishable tool with a clear install path and support for retrieving run/ticket artifacts from GitHub and Vercel storage.

**Problem**

The current `helix-cli` has several gaps:

- No `README.md` with installation, authentication, and usage guidance
- No automated npm publish workflow when `main` is updated
- No CLI support for retrieving artifacts by ticket ID or run ID from GitHub Actions or Vercel storage
- Packaging/release drift appears to exist between repo source and the published npm package

**Requested Improvements**

1. Add a proper `README.md`
2. Add a GitHub Action to publish to npm whenever `main` is updated
3. Add CLI support to retrieve artifacts by ticket ID and/or run ID from GitHub and Vercel storage

**Requirements**

1. Documentation

- Add a top-level `README.md`
- Include:
  - what the CLI does
  - install instructions via npm
  - required Node version
  - authentication flow
  - configuration via env vars and config file
  - command reference with examples
  - examples for artifact retrieval
  - release/publish notes for maintainers

2. Automated npm publishing

- Add a GitHub Actions workflow that publishes the package to npm on updates to `main`
- Ensure the workflow:
  - installs dependencies
  - builds the package
  - optionally runs typecheck/tests if present
  - publishes only when appropriate
  - uses npm auth via GitHub secrets
  - avoids broken publishes when `dist` is missing or the package is not buildable
- Decide and document whether publish should happen:
  - on every push to `main`, or
  - only when version changes in `package.json`
- The published package must match the current source behavior

3. Artifact retrieval

- Add commands to fetch artifacts by ticket ID and/or run ID
- Support GitHub Actions artifacts
- Support Vercel deployment/build artifacts or linked storage used by Helix
- Example command shape can be refined, but target UX should be similar to:
  - `hlx artifacts ticket <ticket-id>`
  - `hlx artifacts run <run-id>`
  - `hlx artifacts ticket <ticket-id> --source github`
  - `hlx artifacts ticket <ticket-id> --source vercel`
- Output should make it easy to:
  - list matching artifacts
  - inspect metadata
  - download artifacts locally
  - filter by source, repo, date, or artifact name when needed

**Acceptance Criteria**

- A `README.md` exists and is sufficient for a new engineer to install and use the CLI without tribal knowledge
- A merge or push to `main` can publish a valid npm package through GitHub Actions
- The published package includes the correct built CLI entrypoint and matches the repo’s current command set
- The CLI can retrieve or list artifacts by ticket ID and run ID from GitHub
- The CLI can retrieve or list artifacts by ticket ID and run ID from Vercel storage
- Artifact commands return clear errors when no artifacts are found or when credentials are missing
- Authentication and required configuration for GitHub/Vercel artifact access are documented

**Implementation Notes**

- Investigate current version drift between repo source and published npm package
- Confirm whether artifact retrieval should be done:
  - directly from GitHub/Vercel APIs in the CLI, or
  - through the Helix backend API, with the CLI acting as a thin client
- If Helix backend support is required, define the backend endpoints alongside the CLI contract
- Consider adding structured JSON output mode for artifact commands

**Nice To Have**

- `hlx artifacts list`
- `hlx artifacts download`
- `--json` output for scripting
- support lookup by PR number in addition to ticket/run ID

## Attachments
- (none)

## Discussion
- **Helix** (2026-04-22T17:41:11.058Z) [Agent]: Changes applied to 1 repository. Verification could not be fully completed — please review the changes manually.
- **Luis** (2026-04-22T18:53:39.177Z) [Helix]: @Helix how come this ticket did not changed the `helix-cli` repo?
- **Helix** (2026-04-22T18:53:53.070Z) [Agent]: Good question! Based on the run history, the code changes were applied to the **`helix-global-server`** repository instead of a dedicated `helix-cli` repo. This likely happened because Helix identified `helix-cli` as living within (or being served from) `helix-global-server`, rather than as a separate standalone repository.

A few possible reasons for this:

1. **The `helix-cli` source lives inside `helix-global-server`** — if the CLI code is part of that monorepo or workspace, that's where the changes would land.
2. **The `helix-cli` repo wasn't accessible** — if there's a separate `helix-cli` repo but Helix didn't have access to it during the run, it may have fallen back to what was available.
3. **Scope during code analysis** — the initial code analysis step may have only scanned `helix-global-server` and found the CLI-related code there.

Would you like me to pull up the **code analysis** or **planning** output to see exactly what Helix found and why it targeted that repo? That should clarify where the CLI code was detected.
- **Helix** (2026-04-22T19:32:52.397Z) [Agent]: I'm working on this, I'll get back to you when ready.

## Continuation Context
Using `helix-prompting`, here’s a continuation prompt you can paste into HLX-299.

```md

# Ticket: Continue HLX-299 in the external `helix-cli` repo

## Summary

Complete HLX-299 in the external `helix-cli` repository. The `helix-global-server` branch already contains the server-side auth fix needed for artifact access, but the actual CLI work is still missing. Implement the CLI packaging, documentation, npm publish workflow, and artifact retrieval commands in `helix-cli` only.

## Why

HLX-299 was interpreted too narrowly in `helix-global-server`. That branch currently contains only a server auth-boundary fix for artifact endpoints. The real user-facing deliverables are still missing from the external `helix-cli` repo: README, publish automation, artifact commands, and maintainer setup documentation.

## Decisions Already Made

- The continuation target is the external `helix-cli` repo, not `helix-global-server`.

- The existing server-side artifact auth fix in `helix-global-server` is the backend contract to use.

- The CLI must act as a thin client to the Helix backend for artifact retrieval.

- Do not implement direct GitHub Actions API or direct Vercel API access inside the CLI unless blocked by missing backend capability.

- npm publishing must be automated from the `helix-cli` repo when `main` is updated.

- Publish gating must be based on version change in `package.json`, not “every push to main”.

- The current CLI config contract is the source of truth unless blocked:

  - env vars: `HELIX_API_KEY`, `HELIX_INSPECT_TOKEN`, `HELIX_INSPECT_API_KEY`, `HELIX_URL`, `HELIX_INSPECT_BASE_URL`, `HELIX_INSPECT_URL`

  - config file: `~/.hlx/config.json`

- The package name is `@projectxinnovation/helix-cli`.

- The package entrypoint is `dist/index.js`.

- The current package manifest says Node `>=18`; do not change Node requirements unless implementation is blocked.

## Do Not Re-Decide

- Do not re-open architecture for direct GitHub/Vercel artifact access if the backend endpoints are sufficient.

- Do not move this work back into `helix-global-server`.

- Do not redesign the CLI config format unless blocked.

- Do not introduce a new auth model.

- Do not treat `.helix` run artifacts as the primary deliverable.

## Non-Negotiable Invariants

- The branch diff in `helix-cli` must stay focused on packaging, docs, publish workflow, and artifact commands.

- The implementation must use the existing backend artifact endpoints instead of inventing a parallel retrieval path.

- The README must document the real current config/env contract, not an invented one.

- The published package must match repo behavior and expose the real command set.

- The CLI version output must not drift from `package.json`.

- The publish workflow must fail closed if build output is missing or publish prerequisites are absent.

- Do not silently skip publish on broken build state and report success.

- Do not commit secrets, tokens, or filled-in credentials to the repo.

## In Scope

- Add a top-level `README.md`.

- Add artifact retrieval CLI commands for ticket/run artifact listing and download/inspection.

- Add maintainer docs for publish/setup requirements.

- Add a GitHub Actions workflow for npm publish on `main`, gated by version change.

- Fix obvious packaging/version drift in the CLI if discovered during implementation.

- Add tests for new command parsing / request-building behavior where the repo already supports practical test coverage.

## Out of Scope

- Additional `helix-global-server` changes unless implementation is blocked by a missing backend contract.

- Direct GitHub Actions artifact API integration in the CLI.

- Direct Vercel Blob/API integration in the CLI.

- Unrelated CLI cleanup, refactors, or command redesign.

- UI changes, backend route redesign, or controller/service refactors in other repos.

## Allowed Files To Change

- `package.json`

- `package-lock.json`

- `README.md`

- `.github/workflows/*`

- `src/index.ts`

- `src/lib/config.ts`

- `src/lib/http.ts`

- new `src/artifacts/*` files if needed

- tests for the new CLI behavior if added in a minimal, targeted way

- optional maintainer doc in `docs/` if needed, but prefer keeping maintainer setup in `README.md`

## Forbidden Changes

- Do not modify `helix-global-server` in this continuation unless blocked and explicitly reported.

- Do not add unrelated commands.

- Do not change existing inspect/comments behavior except where shared CLI plumbing requires a minimal safe change.

- Do not add direct GitHub/Vercel secrets to CLI runtime requirements if the backend path works.

- Do not add broad dependency churn without a specific need.

- Do not bump package version unless the user explicitly wants a release bump as part of this continuation.

## Required Behavior

1. Add a `README.md` that explains:

   - what `hlx` does

   - install instructions via npm

   - required Node version

   - auth flow

   - env vars and `~/.hlx/config.json`

   - command reference with examples

   - artifact retrieval examples

   - maintainer release/publish notes

2. Add artifact commands with a command shape aligned to the ticket intent, for example:

   - `hlx artifacts ticket <ticket-id>`

   - `hlx artifacts run <run-id>`

   - support source filtering only if the backend contract supports it

   - allow listing metadata and downloading/printing artifact content in a way that is scriptable

3. Wire artifact commands to the existing Helix backend endpoints rather than direct provider APIs.

4. Ensure CLI auth for artifact commands reuses the existing config/env loading behavior.

5. Add a GitHub Actions workflow in `helix-cli` that:

   - runs on pushes to `main`

   - installs dependencies

   - runs build

   - runs typecheck if available

   - checks whether `package.json` version changed in the pushed revision

   - only publishes to npm when the version changed

   - fails if build artifacts are missing

   - uses npm auth from GitHub repository secrets

6. Fix packaging/version drift where needed so:

   - `npm pack` would contain the built CLI entrypoint

   - `hlx --version` reflects `package.json` rather than a stale hardcoded version

## Failure Behavior

- Fail closed if required npm publish credentials are missing in CI.

- Fail closed if the package cannot build.

- Fail closed if `dist/index.js` is missing at publish time.

- Fail closed if artifact commands are invoked without valid config.

- Return clear user-facing errors when no artifacts are found.

- Do not silently downgrade artifact retrieval from backend to direct provider APIs.

## Batch / Cardinality Rules

- `ticket <ticket-id>` targets exactly one ticket ID.

- `run <run-id>` targets exactly one run ID.

- Do not use “latest run” or another inferred run as a proxy unless the command explicitly requests that behavior.

- If multiple artifacts are returned, list all matches explicitly; do not collapse to the first match unless the user provided a narrowing selector.

## Persistence / Artifact Rules

- Repo deliverables are code, docs, and workflow files in `helix-cli`.

- Do not rely on `.helix` artifacts as proof of completion.

- Do not store secrets in repo files.

- Any sample config in docs must use placeholders only.

## Acceptance Criteria

1. `helix-cli` has a top-level `README.md` sufficient for a new engineer to install, authenticate, and use the CLI.

2. `helix-cli` has artifact retrieval commands for ticket/run flows using the Helix backend.

3. Artifact commands produce clear errors for missing credentials and no-result cases.

4. `hlx --version` matches `package.json`.

5. The repo contains a GitHub Actions workflow that publishes to npm from `main` only when the package version changes.

6. The publish workflow fails when build output is missing or npm credentials are not configured.

7. No direct GitHub/Vercel API dependency is introduced for artifact retrieval unless explicitly justified as blocked by backend limitations.

8. The final diff remains scoped to `helix-cli` packaging/docs/artifact-command work.

## Verification

- Run `npm run build`

- Run `npm run typecheck`

- Verify `node dist/index.js --version` matches `package.json`

- Verify artifact command help/usage

- Verify unauthenticated artifact command fails with a clear error

- Verify the publish workflow logic checks version change before attempting npm publish

- Verify `npm pack --dry-run` or equivalent package contents show the built CLI entrypoint

## Open Questions

- What exact backend response shape should the CLI expose for ticket/run artifact listing and download?

- Should artifact command output support `--json` in this ticket, or is human-readable output sufficient for now?

- What repository secret name should be canonical for npm publish: `NPM_TOKEN` is preferred unless the repo already uses a different standard.



- **Backend response shape:** Use the existing backend contract as-is. For discovery/listing, use `GET /api/tickets/:ticketId/artifacts`, which returns `items[]` (repo/run artifact roots) and `stepArtifactSummary[]` (available step artifacts). For content retrieval, use `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId?repoKey=<repoKey>`, which returns `stepId`, `repoKey`, and `files[]` with `name`, `content`, and `contentType`. Do not invent a new backend shape unless implementation is concretely blocked.

- **Artifact command output format:** Human-readable output is sufficient for this ticket. For list commands, print a concise readable summary. For artifact reads, print the actual artifact content directly: raw Markdown for `.md` artifacts and raw JSON for `.json` artifacts. Do not add `--json` output in this ticket unless it is trivial after the core flow is complete.

- **Canonical npm publish secret name:** Use `NPM_TOKEN` as the canonical GitHub Actions repository secret for npm publishing.

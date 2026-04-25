# Ticket Context

- ticket_id: cmoaat2ig007tel0uf3u7kowr
- short_id: HLX-299
- run_id: cmoaat2j0007xel0ushpr9sg5
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

# Product — HLX-207: Improve helix-cli packaging, documentation, and artifact retrieval

## Problem Statement

The `helix-cli` (`@projectxinnovation/helix-cli`) is a functional internal CLI for Helix production inspection, but it is not ready for broader adoption or self-service use:

1. **No documentation**: A new engineer cannot install, configure, or use the CLI without reading source code or asking another team member.
2. **No automated publishing**: No CI/CD exists at all. Publishes to npm are manual, error-prone, and have led to version drift (`package.json` says 1.2.0 while `--version` outputs 0.1.0).
3. **No artifact retrieval**: Engineers investigating tickets cannot retrieve run or ticket artifacts through the CLI, forcing them to manually navigate GitHub Actions and Vercel dashboards.

## Product Vision

Make `helix-cli` a self-documenting, reliably published tool that engineers can install from npm, authenticate once, and use to investigate tickets end-to-end — including retrieving artifacts from GitHub and Vercel without leaving the terminal.

## Users

- **Helix engineers**: Use the CLI daily for ticket investigation, production inspection, and debugging.
- **New team members**: Need to onboard onto the CLI without tribal knowledge.
- **CLI maintainers**: Need reliable, automated publishing so the npm package stays in sync with source.

## Use Cases

1. **New engineer onboarding**: Read the README, run `npm install`, authenticate, and start using the CLI within minutes.
2. **Ticket investigation**: An engineer working a ticket retrieves related artifacts (logs, build outputs, deployment data) by ticket ID without switching to browser-based dashboards.
3. **Run debugging**: An engineer fetches artifacts from a specific Helix run to understand what happened during automated processing.
4. **Release publishing**: A maintainer bumps the version in `package.json`, merges to `main`, and the npm package is published automatically.

## Core Workflow

### Artifact Retrieval (new capability)
1. Engineer runs `hlx artifacts ticket <ticket-id>` or `hlx artifacts run <run-id>`.
2. CLI authenticates via existing Helix credentials (no additional GitHub/Vercel tokens needed).
3. CLI queries the Helix backend, which proxies to GitHub/Vercel APIs.
4. CLI displays a list of matching artifacts with metadata (name, source, date, size).
5. Engineer can filter by `--source github|vercel` or download specific artifacts.

### Publishing (new capability)
1. Maintainer bumps version in `package.json` and merges to `main`.
2. GitHub Actions detects the version change, builds, typechecks, and publishes to npm.
3. Published package contains the correct built CLI entrypoint and matches current source behavior.

## Essential Features (MVP)

### 1. README documentation
- What the CLI does and who it's for
- Install instructions via npm (`npm install -g @projectxinnovation/helix-cli`)
- Required Node version (>=18)
- Authentication flow (`hlx login`)
- Configuration via env vars and `~/.hlx/config.json`
- Full command reference with examples (login, inspect, comments, artifacts)
- Artifact retrieval examples
- Release/publish notes for maintainers

### 2. Automated npm publish workflow
- GitHub Actions workflow triggered on pushes to `main`
- Publishes only when `package.json` version changes (not on every push)
- Pipeline: install dependencies, build (`tsc`), typecheck (`tsc --noEmit`), publish
- Uses `NPM_TOKEN` GitHub secret for npm authentication
- Fails gracefully if build or typecheck fails (no broken publishes)

### 3. Version drift fix
- `--version` output derived from `package.json` instead of a hardcoded string
- Ensures published CLI version always matches the package metadata

### 4. Artifact retrieval commands
- `hlx artifacts ticket <ticket-id>` — list artifacts for a ticket
- `hlx artifacts run <run-id>` — list artifacts for a run
- `--source github|vercel` flag to filter by artifact source
- Clear error messages when no artifacts are found or credentials are missing
- Follows the existing thin-client pattern: CLI calls Helix backend via `hxFetch`; backend handles GitHub/Vercel API integration

## Features Explicitly Out of Scope (MVP)

- **`hlx artifacts download`** — bulk download command (nice-to-have; list/inspect is MVP)
- **`--json` output mode** — structured JSON output for scripting (future enhancement)
- **PR number lookup** — looking up artifacts by PR number instead of ticket/run ID
- **Direct GitHub/Vercel API calls from CLI** — the CLI stays a thin client to the Helix backend
- **Test suite** — no tests exist today; adding a test framework is a separate effort
- **Backend API endpoint creation** — if artifact endpoints don't exist on the Helix backend, defining the contract is in scope, but building backend endpoints is not
- **Package access model changes** — whether the npm package is public vs. restricted is an existing configuration; no changes assumed

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| README is sufficient for self-service onboarding | A new engineer can install, authenticate, and run commands without asking for help |
| Publish workflow works | Merging a version bump to `main` results in a matching npm package published via CI |
| No version drift | `hlx --version` output matches `package.json` version |
| Artifact listing by ticket ID works | `hlx artifacts ticket <id>` returns artifacts or a clear "none found" message |
| Artifact listing by run ID works | `hlx artifacts run <id>` returns artifacts or a clear "none found" message |
| Source filtering works | `--source github` and `--source vercel` filter results correctly |
| Error handling is clear | Missing credentials or invalid IDs produce actionable error messages |
| Existing commands unaffected | `login`, `inspect`, and `comments` commands continue to work identically |

## Key Design Principles

- **Thin client**: The CLI delegates to the Helix backend for all data fetching. It does not call GitHub or Vercel APIs directly. This keeps credentials centralized and the CLI dependency-free.
- **Consistency**: New commands follow the exact same `requireConfig() -> hxFetch() -> display` pattern as existing commands.
- **Zero new runtime dependencies**: The CLI currently has zero runtime deps (Node builtins + native fetch only). This should be preserved.
- **Version-gated publishing**: Publishing triggers only on version changes, not every commit, to prevent broken or redundant releases.

## Scope & Constraints

- **Single repo**: All changes are within the `helix-cli` repository. No cross-repo changes.
- **Node >= 18**: Required for native `fetch`. This is already the engine constraint.
- **No backend changes in scope**: Artifact commands define the API contract the CLI expects. If the Helix backend doesn't have these endpoints yet, the CLI code should be designed against a clear contract, and backend work is tracked separately.
- **Hand-rolled arg parsing**: The CLI uses a custom `getFlag`/`switch` pattern instead of commander/yargs. New commands must follow this pattern to avoid introducing dependencies.

## Future Considerations

- Add `--json` output flag across all commands for scripting and automation.
- Add `hlx artifacts download <artifact-id>` for downloading specific artifacts locally.
- Support artifact lookup by PR number.
- Add `hlx artifacts list` for browsing all recent artifacts.
- Introduce a test framework and unit tests as a separate effort.
- Add a `prepublishOnly` script to `package.json` so manual publishes also build correctly.

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|----------------|--------|
| 1 | **Do Helix backend artifact endpoints exist?** No evidence found that `/api/artifacts/...` routes exist on the backend. If they don't, the CLI commands will build against an assumed contract and require backend work before they function end-to-end. | High — blocks artifact retrieval from working in production |
| 2 | **What is the npm publish access model?** Unknown whether `@projectxinnovation/helix-cli` is published as public or restricted. The GitHub Actions workflow needs an `NPM_TOKEN` secret with appropriate publish access. | Medium — blocks publish workflow |
| 3 | **What artifact data does the backend aggregate?** The specific shape of artifact metadata (GitHub Actions artifact names, Vercel deployment IDs, blob storage keys) is unknown. The CLI display and filtering depends on what the backend returns. | Medium — affects UX of artifact commands |
| 4 | **Is there version drift on npm right now?** Unknown what version is currently live on the npm registry vs. the 1.2.0 in `package.json`. | Low — the publish workflow and version fix will resolve this going forward |
| 5 | **No runtime inspection available** — could not verify production API behavior or existing backend endpoints via runtime checks. | Low — artifact contract can be defined from ticket requirements |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand full scope, acceptance criteria, and open decisions | Three workstreams (README, CI publish, artifact retrieval) plus version drift fix; publish trigger strategy left open |
| scout/scout-summary.md | Understand current repo state and architecture | 13 source files, 3 command groups, zero deps/tests/CI, hxFetch thin-client pattern |
| scout/reference-map.json | Structured file inventory, confirmed facts, and unknowns | Version drift confirmed (1.2.0 vs 0.1.0), dist/ gitignored, ESM package, Node>=18 |
| diagnosis/diagnosis-statement.md | Root cause analysis and architectural recommendations | Artifact commands should follow hxFetch pattern; publish on version change only; version should be derived from package.json |
| diagnosis/apl.json | Diagnosis questions, evidence, and follow-ups | All three gaps confirmed with file-level evidence; no backend artifact endpoints observed |
| repo-guidance.json | Repo intent classification | helix-cli is the sole target repo; no cross-repo dependencies |

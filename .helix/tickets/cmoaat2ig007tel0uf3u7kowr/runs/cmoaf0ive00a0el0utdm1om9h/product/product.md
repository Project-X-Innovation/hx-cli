# Product Specification — HLX-299: Improve helix-cli packaging, documentation, and artifact retrieval

## Problem Statement

`helix-cli` (`@projectxinnovation/helix-cli`) is a functional internal CLI used by engineers working with the Helix platform, but it lacks the infrastructure to be maintainable and self-service:

1. **No automated publishing**: Both published npm versions (1.1.0 and 1.2.0) were released manually. There is no CI/CD pipeline — the `.github/` directory does not exist. Any engineer who needs the latest CLI must wait for a manual publish or build from source.
2. **No documentation**: No `README.md` exists. New engineers cannot install, authenticate, or use the CLI without tribal knowledge from existing team members.
3. **No artifact retrieval**: Engineers cannot retrieve Helix run/ticket artifacts from the CLI, despite the server API already supporting this with the CLI's auth tokens. Artifact inspection currently requires navigating the web UI.
4. **Version drift**: `package.json` declares `1.2.0` but `--version` prints `0.1.0`, confusing users about which version they're running.

## Product Vision

Make `helix-cli` a self-documenting, automatically published CLI tool that engineers can install from npm, authenticate, and use to inspect Helix artifacts — all without needing hand-holding from another team member.

## Users

| User | Context |
|------|---------|
| **Helix platform engineers** | Day-to-day users who run `hlx` commands locally to interact with Helix — login, inspect, comment, and (soon) retrieve artifacts |
| **New team members** | Engineers onboarding to Helix who need to install and configure the CLI from scratch |
| **CI/CD maintainers** | Engineers responsible for keeping the CLI's npm package up-to-date, including configuring GitHub/npm secrets |
| **Script/automation authors** | Engineers who embed `hlx` commands in scripts or automation workflows |

## Use Cases

1. **Install and authenticate in under 5 minutes**: A new engineer reads the README, runs `npm install -g @projectxinnovation/helix-cli`, authenticates via `hlx login`, and runs their first command — no Slack threads required.
2. **Retrieve artifacts by ticket**: An engineer debugging a failed Helix run retrieves the artifacts for a specific ticket (e.g., `hlx artifacts ticket <id>`) to inspect step outputs without opening the web UI.
3. **Retrieve artifacts by run**: An engineer investigating a specific run fetches its artifacts (e.g., `hlx artifacts run <run-id> --ticket <ticket-id>`) to see file contents and metadata.
4. **Publish on merge**: A maintainer merges a PR to `main` and the npm package is automatically published with the correct built output — no manual `npm publish` step needed.
5. **Set up publishing infrastructure**: A new maintainer follows the README's setup instructions to configure the NPM_TOKEN secret on GitHub and npm, enabling the automated publish workflow.

## Core Workflow

### Automated Publishing
```
Push/merge to main -> GitHub Actions triggers -> install deps -> build (tsc) -> typecheck -> publish to npm
```

### Artifact Retrieval
```
Engineer authenticates (hlx login or env vars) -> runs artifact command -> CLI calls existing Helix server API -> returns artifact list/content
```

## Essential Features (MVP)

### 1. GitHub Actions Publish Workflow
- A `.github/workflows/publish.yml` that triggers on push to `main`
- Installs dependencies, builds TypeScript to `dist/`, runs typecheck
- Publishes to npm using an `NPM_TOKEN` repository secret
- Handles the case where the version hasn't changed (skip or detect, avoiding failed re-publishes)
- Includes a `prepublishOnly` script in `package.json` to prevent accidental broken manual publishes

### 2. README Documentation
- What the CLI does and who it's for
- Install instructions (`npm install -g @projectxinnovation/helix-cli`)
- Node.js version requirement (>=18)
- Authentication: `hlx login`, env vars (`HELIX_API_KEY`, `HELIX_URL`), config file (`~/.hlx/config.json`)
- Command reference with examples for all commands (login, inspect, comments, artifacts)
- Artifact retrieval examples
- **Maintainer/setup section** with step-by-step instructions for configuring the automated publish workflow:
  - **npm side**: How to generate an npm access token (Automation type recommended to bypass org 2FA), or alternatively a Granular Access Token scoped to `@projectxinnovation/helix-cli`
  - **GitHub side**: How to add the `NPM_TOKEN` repository secret (Settings > Secrets and variables > Actions)
  - Note that `GITHUB_TOKEN` is automatically available in GitHub Actions (no manual setup needed)

### 3. Artifact Retrieval Commands
- `hlx artifacts ticket <ticket-id>` — list artifacts for a ticket
- `hlx artifacts run <run-id> --ticket <ticket-id>` — list/fetch step-level artifacts for a specific run
- Ticket ID resolution via `--ticket` flag or `HELIX_TICKET_ID` env var (matching existing comments command pattern)
- Clear error messages for missing credentials, missing artifacts, or unreachable server
- Human-readable output by default

### 4. Version Fix
- Fix the hardcoded `"0.1.0"` in `src/index.ts` line 47 to reflect the actual package version from `package.json`

## Features Explicitly Out of Scope (MVP)

| Feature | Rationale |
|---------|-----------|
| Server-side changes to helix-global-server | Corrected scout analysis confirms artifact endpoints are already accessible with hxi_ inspection tokens (`api.ts` lines 237-238, before `requireAuth` at line 240). No server changes needed. |
| `--json` structured output mode | Ticket lists this as nice-to-have; can be added later without breaking changes |
| Artifact lookup by PR number | Nice-to-have per ticket; not part of core use cases |
| `hlx artifacts download` (save to disk) | Can layer on top of list/read once the basic commands ship |
| `--source github` / `--source vercel` filtering | The CLI consumes a single Helix server API that abstracts storage backends (Vercel Blob + optional GitHub commit). Source filtering is unnecessary at the CLI layer. |
| Direct calls to GitHub Actions Artifact API or Vercel Blob API | The CLI should use the Helix server as its API surface, not call storage APIs directly |
| Test or lint infrastructure | No tests exist today; adding a test framework is a separate concern |
| Artifact filtering by date, repo name, or artifact name | Future enhancement once basic list/retrieve commands are in use |

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Push/merge to `main` publishes a valid npm package | `.github/workflows/publish.yml` exists with correct trigger, build steps (`npm ci`, `npm run build`), typecheck, and `npm publish` using `NPM_TOKEN` secret |
| 2 | Published package includes correct built CLI entrypoint | `prepublishOnly` script runs build; `package.json` `files: ["dist"]` ensures only compiled output is included |
| 3 | README enables self-service install and usage | A new engineer can follow README to install, authenticate, and run commands without additional guidance |
| 4 | README documents GitHub/npm secret setup | Maintainer section includes step-by-step for npm token creation (Automation type) and GitHub repository secret configuration |
| 5 | `hlx artifacts ticket <id>` lists artifacts | Command calls `GET /api/tickets/:ticketId/artifacts` and displays repo labels, run IDs, step summaries |
| 6 | `hlx artifacts run <id> --ticket <id>` retrieves artifacts | Command calls step-artifact endpoints and displays file metadata/content |
| 7 | Artifact errors are clear and actionable | Missing credentials produce auth error message; no artifacts found produces informative empty-state message; unreachable server produces connection error |
| 8 | `hlx --version` prints accurate version | Output matches version in `package.json`, not the hardcoded `0.1.0` |

## Key Design Principles

- **CLI as thin client**: The CLI calls the Helix server's existing endpoints (`/api/tickets/:ticketId/artifacts` and `/api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId`) rather than accessing GitHub or Vercel APIs directly.
- **Follow existing patterns**: New artifact commands follow the same module structure (`src/artifacts/index.ts` router + subcommand files), HTTP transport (`hxFetch` with `basePath: "/api"`), and ticket ID resolution as the existing `comments` module.
- **No new dependencies**: The CLI has zero runtime dependencies (Node.js builtins + global fetch only). New code should maintain this.
- **Build-before-publish safety**: The workflow builds `dist/` (which is gitignored) before publishing. A `prepublishOnly` script provides a safety net for manual publishes too.
- **Self-service documentation**: The README is the single source of truth for installation, auth, usage, and publish setup — no tribal knowledge dependencies.

## Scope & Constraints

- **Single repo changed**: All changes are in the `helix-cli` repository only. The `helix-global-server` artifact endpoints are already accessible with CLI auth tokens and require no modifications.
- **npm org access**: The package is published under `@projectxinnovation` scope. The publish workflow requires an `NPM_TOKEN` secret with publish rights to this scope.
- **ESM-only**: Package uses `"type": "module"` with Node.js >=18. All new code must be ESM-compatible.
- **Zero runtime deps**: Maintain the current zero-dependency footprint by using Node built-ins and the existing `hxFetch` client.
- **No test infrastructure**: No tests exist today. The publish workflow should handle this gracefully (skip test step if no test script exists).

## Future Considerations

- `--json` output mode for artifact commands to support scripting and automation
- `hlx artifacts download` for saving artifact files to disk
- Artifact lookup by PR number
- `hlx artifacts list` as a broader artifact browser
- Version-bump detection in publish workflow (compare `package.json` version to npm registry; skip when unchanged)
- Filtering by date, repo, source, or artifact name
- Test and lint infrastructure for the CLI
- Versioning automation (e.g., semantic-release or changesets)

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|----------------|--------|
| 1 | Does the `@projectxinnovation` npm org require 2FA for publishing? If yes, only Automation-type tokens bypass it for CI. | Could block CI publish if wrong token type is used |
| 2 | Which npm account should own the Automation token? Is `usherpx` (the prior manual publisher) the designated publisher? | Affects who generates the NPM_TOKEN secret |
| 3 | Should the workflow publish on every push to `main`, or only when `package.json` version changes? | Every-push is simpler but may create redundant publishes; version-check avoids re-publish failures but adds complexity |
| 4 | Should `hlx --version` read from `package.json` at runtime or be replaced at build time? | Minor implementation choice; both work. Runtime read is simpler; build-time is slightly faster. |
| 5 | Should `HELIX_RUN_ID` env var be supported alongside the `--run` flag? | Matches existing `HELIX_TICKET_ID` pattern; useful in CI environments |
| 6 | Conflicting scout evidence on server auth boundary: the helix-global-server scout claims endpoints are after `requireAuth`; the helix-cli scout (ran later, with direct source reading of `api.ts:236-240`) reports they are before `requireAuth`. | If the server scout was correct, server-side changes would be needed. Implementation should verify endpoint accessibility at development time. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `helix-cli/.../ticket.md` | Primary requirements and user continuation context | Three deliverables: README, npm publish workflow, artifact commands. User emphasizes auto-publish on push to main + secrets setup instructions. |
| `helix-cli/.../scout/scout-summary.md` | Corrected server auth analysis, package state, workflow requirements | Artifact endpoints accessible with inspection tokens (corrected from prior scout); two manual npm publishes; version drift confirmed; detailed secrets setup steps |
| `helix-cli/.../scout/reference-map.json` | File inventory, npm registry state, module patterns | Zero prod deps, ESM-only, no .github/ dir, established command patterns, 8 unknowns catalogued |
| `helix-cli/.../diagnosis/diagnosis-statement.md` | Root cause analysis and success criteria | Three additive changes needed in helix-cli only; no server changes; version fix + prepublishOnly needed |
| `helix-cli/.../diagnosis/apl.json` | Structured diagnosis evidence | Confirmed CLI should call server API (not GitHub/Vercel directly); detailed GitHub/npm secret setup steps |
| `helix-global-server/.../scout/scout-summary.md` | Server artifact architecture | Vercel Blob storage, no schema changes, two existing endpoints, established auth pattern. Claims endpoints behind requireAuth (contradicted by later helix-cli scout). |
| `helix-global-server/.../diagnosis/diagnosis-statement.md` | Server auth boundary analysis | Claims route-move fix needed — contradicted by later helix-cli scout's direct source reading of api.ts:236-240 |
| `helix-cli/.../repo-guidance.json` | Repo intent classification | helix-cli = target, helix-global-server = context only. Confirmed by corrected diagnosis. |
| `/tmp/helix-inspect/manifest.json` | Runtime inspection availability | Only helix-global-server has inspection (DATABASE, LOGS); no runtime probes needed for helix-cli product decisions |

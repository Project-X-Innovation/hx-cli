# Product: Improve helix-cli packaging, documentation, and artifact retrieval

## Problem Statement

`helix-cli` (`@projectxinnovation/helix-cli`) is an internal CLI that works but is difficult to adopt because it has no documentation, no automated release process, and no way to retrieve ticket/run artifacts. Engineers who need to install it, configure it, or look up artifacts produced by Helix runs must rely on tribal knowledge or manually navigating the web UI.

Additionally, the published npm package may be stale or inconsistent with the source — the version displayed by `--version` (0.1.0) does not match `package.json` (1.2.0), and there is no CI/CD pipeline to keep releases in sync.

On the server side, existing artifact endpoints are unreachable from the CLI because they sit behind an auth gate that rejects the `hxi_` API keys the CLI sends. This blocks any CLI-based artifact retrieval even though the server already stores and serves artifact data.

## Product Vision

Turn helix-cli from an undocumented internal tool into a self-service, maintainable CLI that any engineer can install, authenticate, and use to interact with Helix — including retrieving artifacts from completed runs — without needing help from a teammate.

## Users

- **Engineers using Helix**: Install and use the CLI day-to-day for login, inspection, commenting, and now artifact retrieval.
- **CI/CD pipelines and scripts**: Programmatic consumers that need structured artifact data from Helix runs.
- **Helix CLI maintainers**: Engineers who contribute to and publish the CLI package.

## Use Cases

1. **New engineer onboarding**: A new team member reads the README and can install, authenticate, and run their first command without any additional guidance.
2. **Artifact lookup by ticket**: An engineer investigating a Helix ticket retrieves the list of artifacts for that ticket to review what each run produced.
3. **Artifact retrieval by run**: An engineer drills into a specific run to view or download step-level artifact files (e.g., diagnosis, implementation plan).
4. **Automated artifact access**: A script fetches artifact metadata or content in JSON format for downstream processing or dashboards.
5. **Consistent releases**: When changes merge to `main`, a valid npm package is automatically published so users always have access to the latest CLI.

## Core Workflow

1. Engineer installs: `npm install -g @projectxinnovation/helix-cli`
2. Engineer authenticates: `hlx login` (OAuth or manual API key)
3. Engineer retrieves artifacts:
   - `hlx artifacts ticket <ticket-id>` → lists artifacts for a ticket
   - `hlx artifacts run <run-id> --ticket <ticket-id>` → lists step artifacts for a specific run
   - Optionally adds `--json` for machine-readable output
4. Engineer reviews artifact content in terminal or downloads for local inspection.

## Essential Features (MVP)

### 1. README documentation
- What the CLI does, install instructions, required Node version
- Authentication flow (OAuth + manual API key)
- Configuration via env vars (`HELIX_API_KEY`, `HELIX_URL`, etc.) and `~/.hlx/config.json`
- Command reference with examples covering existing commands and new artifact commands
- Release/publish guidance for maintainers

### 2. Automated npm publish workflow
- GitHub Actions workflow that triggers on push to `main`
- Builds the package (`tsc`), runs typecheck, publishes to npm via secrets
- Includes a `prepublishOnly` script so manual publishes also build first
- Publishes only when appropriate (e.g., version change detection or idempotent publish)

### 3. Version string fix
- The CLI's `--version` output must match `package.json` (currently hardcoded as 0.1.0 vs package.json 1.2.0)

### 4. Artifact retrieval commands
- `hlx artifacts ticket <ticket-id>` — list artifact metadata for a ticket (repos, runs, GitHub URLs, step summaries)
- `hlx artifacts run <run-id> --ticket <ticket-id>` — retrieve step-level artifact files for a specific run
- Human-readable default output with `--json` flag for structured output
- Clear error messages when no artifacts exist, credentials are missing, or endpoints are unreachable

### 5. Server auth boundary fix (helix-global-server)
- Move artifact route registrations before the `requireAuth` gate so `hxi_` API keys are accepted
- Follow the established pattern used by comment/inspection endpoints
- No changes to handler logic, service layer, or database schema

## Features Explicitly Out of Scope (MVP)

- Direct calls to GitHub Actions Artifacts API or Vercel Blob API from the CLI (the CLI should use the Helix server as its API surface)
- `hlx artifacts download` as a dedicated download-to-disk command (content retrieval through existing commands is sufficient)
- Lookup by PR number
- Artifact filtering by date, source, or artifact name
- New server endpoints or schema changes
- Lint, formatting, or test infrastructure for the CLI repo
- Changes to the OAuth login flow or auth token types

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| README enables self-service install and usage | A new engineer can follow README to install, auth, and run commands without additional guidance |
| npm publish workflow works | Push to `main` triggers a GitHub Actions run that publishes a valid package with the correct CLI entrypoint |
| Version output is accurate | `hlx --version` matches the version in `package.json` |
| Artifact list by ticket works | `hlx artifacts ticket <id>` returns artifact metadata including repo labels, run IDs, and step summaries |
| Artifact retrieval by run works | `hlx artifacts run <id> --ticket <ticket-id>` returns step-level artifact file content |
| CLI auth accepted by artifact endpoints | Requests using `hxi_` API keys receive 200 responses from artifact endpoints (requires server-side auth fix) |
| Errors are clear | Missing credentials → auth error message; no artifacts found → informative empty-state message |
| JSON output available | `--json` flag produces parseable JSON for artifact commands |

## Key Design Principles

- **CLI as thin client**: The CLI calls the Helix server's existing endpoints rather than accessing GitHub or Vercel APIs directly. The server is the single source of truth for artifacts.
- **Follow existing patterns**: New artifact commands should follow the same module structure, HTTP transport (`hxFetch`), and flag parsing used by `comments` and `inspect` commands.
- **No new dependencies**: The CLI currently has zero production dependencies (Node.js builtins only). Prefer keeping it that way.
- **Idempotent, safe CI**: The publish workflow should not fail destructively if the version already exists on npm.

## Scope & Constraints

- **Two repos changed**: `helix-cli` (primary — README, workflow, commands, version fix) and `helix-global-server` (auth boundary fix only).
- **Server change is minimal**: Route registration order change + middleware swap in one file (`src/routes/api.ts`). No handler, service, or schema changes.
- **No test infrastructure exists** in helix-cli today. The publish workflow should handle this gracefully (skip tests if none exist).
- **npm registry access** requires secrets not currently configured; the workflow must document required secret names.
- **Node >= 18** is the minimum supported version (already enforced in `engines`).

## Future Considerations

- `hlx artifacts list` as a broader artifact browser
- `hlx artifacts download` for downloading artifacts to disk
- Lookup by PR number
- Filtering by date, repo, source, or artifact name
- Test and lint infrastructure for the CLI
- Versioning automation (e.g., semantic-release or changesets)

## Open Questions / Risks

| Question / Risk | Notes |
|----------------|-------|
| What npm registry is targeted? | No `publishConfig` in `package.json`. Likely the default npm registry, but must be confirmed before configuring the workflow. |
| What GitHub secret name for npm auth? | No existing workflow or documentation specifies this. Workflow must document the required secret. |
| Does OAuth login return a session JWT or an `hxi_` key? | If OAuth returns a session JWT, artifact endpoints would already work for OAuth users. If it returns an `hxi_` key, the server auth fix is required for all CLI users. |
| "GitHub Actions artifacts" vs actual GitHub branch artifacts | The ticket mentions "GitHub Actions artifacts," but the server actually stores artifacts in Vercel Blob and optionally commits them to GitHub branches. The CLI should call the server API, not the GitHub Actions API. |
| Version bump strategy for the publish workflow | Should CI publish on every push to `main` or only when `package.json` version changes? Version-change-only is safer to avoid accidental re-publishes. |
| `HELIX_RUN_ID` env var support | Not currently used by any command. Should artifact commands support it alongside the `--run` flag? |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `helix-cli/.../ticket.md` | Primary requirements source | Three deliverables: README, npm publish workflow, artifact retrieval commands |
| `helix-cli/.../scout/scout-summary.md` | CLI structure and auth analysis | Auth boundary mismatch is the critical cross-repo blocker; version drift confirmed |
| `helix-cli/.../scout/reference-map.json` | Detailed file inventory and facts | Zero prod deps, ESM-only, no CI/CD, established command patterns, 8 unknowns catalogued |
| `helix-cli/.../diagnosis/diagnosis-statement.md` | Root cause analysis | Five root causes identified; auth boundary fix follows established server pattern |
| `helix-cli/.../diagnosis/apl.json` | Diagnosis Q&A and evidence | Confirmed CLI should call server API (not GitHub/Vercel directly); confirmed route-move fix |
| `helix-global-server/.../scout/scout-summary.md` | Server artifact architecture | Vercel Blob storage, no schema changes, two existing endpoints, established auth pattern |
| `helix-global-server/.../diagnosis/diagnosis-statement.md` | Server root cause | Route registration order is the only server change; handlers already compatible |
| `repo-guidance.json` | Repo intent | Both repos are change targets; helix-cli primary, server for auth fix only |
| `/tmp/helix-inspect/manifest.json` | Runtime inspection availability | Server has DATABASE and LOGS inspection; no CLI runtime inspection available |

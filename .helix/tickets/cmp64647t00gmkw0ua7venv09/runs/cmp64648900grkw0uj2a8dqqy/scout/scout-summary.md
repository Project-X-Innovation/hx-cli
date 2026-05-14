# Scout Summary — Helix Core Infrastructure (helix-cli)

## Problem

Map the helix-cli's role in the Helix Core Infrastructure — as both a user-facing management tool and an in-sandbox agent tool for runtime inspection.

## Analysis Summary

The helix-cli (`hlx`) serves a **dual role** in the Helix architecture:

### User-Facing Tool
For developers and operators, the CLI provides:
- **Ticket lifecycle**: create, list, get, rerun, continue, update-description, artifacts, bundle
- **Organization management**: multi-org login (OAuth + API key), context switching
- **Skill management**: show and install bundled skills for Claude/Codex agents
- **Auto-update**: version tracking and npm-based updates

### In-Sandbox Agent Tool
The CLI is installed inside every Vercel Sandbox as a dependency of the step runtime:
- Listed in `sandbox-runtime-assets/workflow-steps/package.json` as `@projectxinnovation/helix-cli: ^1.2.0`
- Symlinked to PATH by the orchestrator (`/home/vercel-sandbox/.local/bin/hlx`)
- Authenticated via `HELIX_INSPECT_TOKEN` and `HELIX_INSPECT_BASE_URL` env vars injected by `configureInspectionForStep()`
- Agents use `hlx inspect db` for read-only database queries against production
- Agents use `hlx inspect logs` for application log searches
- Agents use `hlx inspect api` for read-only API endpoint calls
- Agents use `hlx comments post` to respond to @Helix-tagged user comments

### API Communication
All CLI commands communicate with helix-global-server via REST API:
- Base path: `/api` (standard) or `/api/inspect` (inspection proxy)
- Auth: `X-API-Key` header (hxi_* tokens) or `Authorization: Bearer` (legacy)
- Retry: 3 attempts with exponential backoff (2s/4s/8s + jitter)
- Timeout: 30 seconds per request

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/index.ts` | CLI entry point and command dispatch |
| `src/inspect/db.ts` | Database inspection (used by agents) |
| `src/inspect/logs.ts` | Log inspection (used by agents) |
| `src/comments/post.ts` | Comment posting (used by agents) |
| `src/tickets/create.ts` | Ticket creation API contract |
| `src/lib/http.ts` | HTTP client with retry logic |
| `src/lib/config.ts` | Multi-org configuration |
| `package.json` | Published as @projectxinnovation/helix-cli |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary ticket context | Understanding the CLI's role in the overall Helix architecture |
| src/index.ts | CLI structure | Modular command dispatch — login, tickets, inspect, comments, org, skill, update |
| src/lib/http.ts | API communication | RESTful with retry logic; dual auth modes for user vs. agent usage |
| package.json | Package identity | Zero runtime deps, published to npm, binary is 'hlx' |
| helix-global-server sandbox-runtime-assets/package.json | In-sandbox installation | CLI installed inside sandboxes as @projectxinnovation/helix-cli dependency |
| helix-global-server orchestrator.ts configureInspectionForStep | Agent setup | Orchestrator injects inspection token and symlinks hlx to PATH for agent use |

# Scout Summary: helix-cli

## Problem

The Helix CLI (`hlx`) currently supports only authentication (`login`) and production inspection (`inspect`) commands. The ticket requires the CLI to become the communication channel through which sandbox agents and external CLI users can read ticket comments (especially @Helix-tagged ones) and post responses. This is a net-new capability — no comment-related code exists in the CLI today.

## Analysis Summary

### Current State

The CLI is a minimal TypeScript tool (zero runtime dependencies) with a simple `process.argv` switch router. It authenticates via environment variables (`HELIX_INSPECT_TOKEN`, `HELIX_API_KEY`) or file config (`~/.hlx/config.json`), with env vars taking priority. The HTTP client (`hxFetch`) sends all requests to `{server}/api/inspect{path}`, which is a hardcoded base path that does not cover the comment endpoints at `/api/tickets/:ticketId/comments`.

### Key Boundaries

1. **HTTP path prefix**: `hxFetch` hardcodes `/api/inspect` as the base path. Comment endpoints live at `/api/tickets/:id/comments`. Either the HTTP client needs generalization or a new HTTP function is needed.

2. **Authentication identity**: In sandboxes, agents receive a scoped JWT (`HELIX_INSPECT_TOKEN`) issued under the first org user's ID. The server currently uses `auth.user.id` as the comment author. There is no mechanism to mark a comment as authored by "Helix" rather than the org user.

3. **Ticket ID availability**: Agents need to know the ticket ID to read/write comments. The ticket ID is in the `ticket.md` file in the run artifacts but is not currently exposed as an environment variable.

4. **CLI is already in the sandbox**: The `@projectxinnovation/helix-cli` package is installed in the sandbox runtime and symlinked to PATH at `/home/vercel-sandbox/.local/bin/hlx`. The env vars `HELIX_INSPECT_TOKEN` and `HELIX_INSPECT_BASE_URL` are sourced from `/tmp/helix-inspect/env.sh`.

### What Needs to Change

- New CLI commands for reading and writing comments (e.g., `hlx comments list`, `hlx comments post`)
- HTTP client support for non-inspect API paths
- The server must accept inspection auth (tokens/API keys) on comment endpoints (currently session-only) — this is a server-side dependency

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/index.ts` | CLI entry point; command router where new comment commands must be registered |
| `src/lib/http.ts` | HTTP client with hardcoded `/api/inspect` prefix; must support comment API paths |
| `src/lib/config.ts` | Config loading from env vars and file; determines auth identity |
| `src/login.ts` | Login flow for external CLI users |
| `src/inspect/index.ts` | Reference for how subcommands are dispatched |
| `package.json` | Build scripts, version, zero-dependency constraint |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| src/index.ts | Map command structure | Simple argv switch with login, inspect, --version commands; no comment commands exist |
| src/lib/http.ts | Understand server communication | hxFetch hardcodes /api/inspect base path; auth detects hxi_ prefix for header choice |
| src/lib/config.ts | Understand auth config | Env vars (HELIX_API_KEY, HELIX_INSPECT_TOKEN) take priority over file config |
| src/login.ts | Understand user auth flow | OAuth browser flow or manual API key entry; saves to ~/.hlx/config.json |
| package.json | Build and quality gates | build: tsc, typecheck: tsc --noEmit; no test or lint scripts |
| Server orchestrator.ts | Understand sandbox setup | CLI installed in sandbox, symlinked to PATH, env vars injected via env.sh |
| Server runtime-assets.ts | Confirm CLI availability | @projectxinnovation/helix-cli is a sandbox runtime dependency (line 130) |

# Scout Summary — Side Quests (helix-cli)

## Problem

The Helix CLI currently provides comments, inspect, and login commands — no ticket lifecycle management. For Side Quests, agents executing inside Vercel Sandbox may need a way to programmatically create child tickets. Whether this happens via a CLI command (agents call `hlx tickets create`) or server-side via step output parsing is a design decision that affects CLI scope.

## Analysis Summary

### Current State

The CLI is a lightweight tool (zero runtime dependencies, pure TypeScript) with three command groups. It authenticates using `HELIX_INSPECT_TOKEN` env var injected by the orchestrator into the sandbox at runtime. The HTTP client supports the same REST API endpoints as the web client.

### Two Architectural Paths

1. **CLI-based side quest creation**: Add `hlx tickets create` command. Agents call it from sandbox. Requires extending inspection token permissions or using a new auth scope. The CLI already has patterns for this (comments/post.ts uses the same hxFetch + auth model).

2. **Server-side orchestrator processing**: Agents include side quest requests in their step output JSON (`HelixWorkflowStepResult`). The orchestrator parses these after step completion and creates child tickets server-side. CLI changes minimal or none.

Path 2 is simpler and keeps ticket lifecycle management centralized in the server, but Path 1 gives agents more autonomy and flexibility. The two paths are not mutually exclusive.

### Extension Points

- `src/index.ts` — Switch-case for new `tickets` top-level command
- `src/comments/` — Pattern template for a new `tickets/` subcommand directory
- `src/lib/http.ts` — Shared HTTP client for API calls
- `src/lib/config.ts` — Auth config supporting sandbox env vars

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/index.ts` | Command dispatcher — extension point for 'tickets' subcommand |
| `src/comments/post.ts` | API call pattern — template for ticket creation call |
| `src/comments/index.ts` | Subcommand dispatch pattern |
| `src/lib/http.ts` | HTTP client with retry/auth |
| `src/lib/config.ts` | Auth config (env vars + config file) |
| `package.json` | Build: tsc. No test/lint. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Understand side quest spawning mechanism requirements | Agents need to create sub-tickets; CLI is one possible mechanism |
| `src/index.ts` | Map command surface and dispatch pattern | Switch-case dispatcher; 3 commands; extensible by adding cases |
| `src/comments/post.ts` | Understand existing API call pattern | POST to server via hxFetch with auth token — reusable for ticket creation |
| `src/lib/http.ts` | Map HTTP client capabilities | Retry logic, auth injection, JSON parsing — ready for new endpoints |
| `src/lib/config.ts` | Map auth mechanism | HELIX_INSPECT_TOKEN env var works in sandbox context |
| `package.json` | Map build/quality gates | Build-only (tsc), no test or lint |

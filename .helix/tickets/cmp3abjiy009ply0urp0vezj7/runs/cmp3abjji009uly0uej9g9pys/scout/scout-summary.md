# Scout Summary: helix-cli

## Problem

The CLI has comment commands for tickets (`hlx comments list/post`) but no library commands at all. The ticket requires CLI and MCP access for library feedback — reading and posting section-level ratings and comments on library items, viewing other people's comments, and potentially triggering iteration rounds. No `src/library/` module exists.

## Analysis Summary

### Current CLI Architecture
- **Entry point** (`src/index.ts`): Custom switch-based router with commands: login, token, org, tickets, comments, inspect, skill, update. No library command.
- **Comment module** (`src/comments/`): `index.ts` (router), `list.ts` (list comments with filters), `post.ts` (post comment). Scoped to tickets via `--ticket <ref>`.
- **HTTP client** (`src/lib/http.ts`): API key (hxi_ prefix) or Bearer token auth, X-Helix-Org-ID header, 3-retry exponential backoff, 30s timeout.
- **Ticket resolution** (`src/lib/resolve-ticket.ts`): Accepts internal ID, short ID (e.g. BLD-339), or ticket number. Library items would need similar resolution.
- **Flag parsing** (`src/lib/flags.ts`): getFlag(), hasFlag(), isHelpRequested() utilities.
- **Agent skill** (`skill-content/SKILL.md`): Documents all CLI operations for agent integration via `hlx skill install`.

### Command Module Pattern
Each command follows a consistent structure:
1. `index.ts` — router with usage text and subcommand dispatch
2. Individual subcommand files (e.g., `list.ts`, `post.ts`, `get.ts`)
3. Flag parsing via `lib/flags.ts`
4. Ticket reference resolution via `lib/resolve-ticket.ts`

### Key Boundaries
- CLI is a pure TypeScript project with no runtime dependencies beyond Node.
- All API calls go through the shared HTTP client; no direct database or Git access.
- SKILL.md is the agent-facing documentation; any new library commands must be documented here.
- No library-specific API endpoints exist on the server yet; CLI library commands depend on server API implementation.

### Execution Signals
- `npm run build` — `tsc` (TypeScript compile)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run dev` — `tsx watch`

## Relevant Files

| File | Role |
|------|------|
| `src/index.ts` | Main CLI entry point — add library command routing |
| `src/comments/index.ts` | Comment command router — reference pattern |
| `src/comments/list.ts` | List ticket comments — reference for library comment listing |
| `src/comments/post.ts` | Post ticket comment — reference for library comment posting |
| `src/tickets/index.ts` | Ticket commands (list, get, create, continue, rerun) — reference for library commands |
| `src/lib/http.ts` | HTTP client for API calls |
| `src/lib/config.ts` | Multi-org config management |
| `src/lib/flags.ts` | Flag parsing utilities |
| `src/lib/resolve-ticket.ts` | Ticket reference resolution |
| `skill-content/SKILL.md` | Agent skill documentation — must include library commands |
| `package.json` | TypeScript-only deps, build/lint/typecheck scripts |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand requirements | CLI/MCP must support reading and posting library comments, viewing discussion analysis, section targeting |
| src/index.ts | Map CLI structure | Switch-based routing, no library command exists |
| src/comments/index.ts | Map comment command pattern | Subcommand router with ticket resolution — reusable pattern |
| src/comments/list.ts | Map comment listing | GET /api/tickets/{ticketId}/comments with filtering |
| src/comments/post.ts | Map comment posting | POST /api/tickets/{ticketId}/comments with content body |
| src/lib/http.ts | Map API client | API key/bearer auth, retry logic, org header |
| skill-content/SKILL.md | Map agent integration | Documents all CLI ops for MCP/agent use |
| package.json | Dependencies and scripts | TypeScript-only, tsc build |

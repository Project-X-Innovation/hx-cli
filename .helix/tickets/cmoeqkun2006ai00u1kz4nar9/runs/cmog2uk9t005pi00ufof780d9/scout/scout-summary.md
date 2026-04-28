# Scout Summary: helix-cli

## Problem

Expand `helix-cli` from a narrow inspection tool (inspect + comments) into an org-aware Helix workbench. The CLI must support org switching, ticket discovery with filters, ticket detail inspection (branch/repos/runs/artifacts), local Codex bundling, ticket creation, comment reply, rerun, and continue (via rerun with `continuationContext`).

## Analysis Summary

### Current CLI State

The CLI is a lightweight, zero-production-dependency TypeScript tool at version 1.2.0. It provides three command groups today:

- **login**: OAuth browser flow or manual API key entry; saves `{apiKey, url}` to `~/.hlx/config.json`
- **inspect**: Read-only production inspection (repos, db queries, logs, API probes) via `/api/inspect/*` endpoints
- **comments**: List and post ticket comments via `/api/tickets/:ticketId/comments`

### Architecture Patterns

- **Command routing**: Manual switch-based dispatch in `src/index.ts`. Each command group has an `index.ts` router and individual handler files.
- **Flag parsing**: Manual `indexOf`-based `getFlag()` helper. No CLI framework.
- **HTTP**: Single `hxFetch()` function in `src/lib/http.ts` with retry, timeout, and auth header logic. Default `basePath` is `/api/inspect`; comments already use `basePath: "/api"`.
- **Auth tokens**: `hxi_` prefix tokens use `X-API-Key` header; other tokens use `Authorization: Bearer`. Config is `{apiKey, url}` only.

### Key Observations for the Expansion

1. **Auth gap for org switching**: `POST /api/auth/switch-org` returns a new `accessToken` (session JWT). The current config schema `{apiKey, url}` has no notion of org. The CLI must persist the new token after switching and ensure subsequent requests use it.

2. **BasePath convention**: All new ticket/org commands target `/api/*` routes (not `/api/inspect/*`), so they must use `basePath: "/api"`.

3. **Ticket routes require session auth**: Server ticket routes (list, create, rerun) sit behind `requireAuth` middleware which needs session JWTs. The CLI login OAuth flow returns a `key` parameter. Whether this key is a session JWT or inspection API key depends on the server's `/auth/cli` redirect flow.

4. **Backend API coverage**: Most CLI commands map directly to existing backend endpoints. The one gap is the `--user` filter: the server's `GET /api/tickets` does not currently accept a `userId` or `reporterUserId` query parameter for filtering (the existing `userId` param is only for comment unread tracking).

5. **No existing org/ticket commands**: The entire org and tickets command surface must be built from scratch.

6. **Pattern consistency**: The existing comments commands show a clean, repeatable pattern: subcommand router + individual handler files + shared `hxFetch`.

7. **Version mismatch**: `src/index.ts` reports version "0.1.0" while `package.json` says "1.2.0".

### API Endpoints the CLI Will Consume

| CLI Command | Backend Endpoint | Method | Notes |
|---|---|---|---|
| `hlx org current` | `/api/auth/me` | GET | Returns user + org + availableOrganizations |
| `hlx org list` | `/api/auth/me` | GET | Uses `availableOrganizations` array |
| `hlx org switch <org>` | `/api/auth/switch-org` | POST | Returns new accessToken; must persist |
| `hlx tickets list` | `/api/tickets` | GET | Supports `archived`, `statusNotIn`, `sprintId` params |
| `hlx tickets latest` | `/api/tickets` | GET | Client-side: take first from sorted list |
| `hlx tickets get <id>` | `/api/tickets/:ticketId` | GET | Full detail with runs, repos, branch |
| `hlx tickets create` | `/api/tickets` | POST | Body: `{title, description, repositoryIds}` |
| `hlx tickets rerun <id>` | `/api/tickets/:ticketId/rerun` | POST | Optional body fields |
| `hlx tickets continue <id>` | `/api/tickets/:ticketId/rerun` | POST | Body: `{continuationContext}` |
| `hlx tickets artifacts <id>` | `/api/tickets/:ticketId/artifacts` | GET | Returns items + stepArtifactSummary |
| `hlx tickets artifact <id>` | `/api/tickets/:id/runs/:runId/step-artifacts/:stepId` | GET | Needs `?repoKey=` param |
| `hlx tickets bundle <id>` | Multiple endpoints | GET | Compose detail + artifacts into local files |
| `hlx comments list` | `/api/tickets/:ticketId/comments` | GET | Already implemented |
| `hlx comments post` | `/api/tickets/:ticketId/comments` | POST | Already implemented |

### New Source Files Needed

Based on the existing pattern, the expansion would likely introduce:
- `src/org/index.ts` - Org command router
- `src/org/current.ts`, `src/org/list.ts`, `src/org/switch.ts` - Org handlers
- `src/tickets/index.ts` - Tickets command router
- `src/tickets/list.ts`, `src/tickets/latest.ts`, `src/tickets/get.ts` - Discovery handlers
- `src/tickets/create.ts`, `src/tickets/rerun.ts`, `src/tickets/continue.ts` - Action handlers
- `src/tickets/artifacts.ts`, `src/tickets/bundle.ts` - Artifact/bundle handlers

## Relevant Files

| File | Role |
|---|---|
| `src/index.ts` | CLI entry point, command router (must add org, tickets) |
| `src/lib/config.ts` | Auth config storage (may need org awareness for switch) |
| `src/lib/http.ts` | HTTP client with retry, auth, basePath |
| `src/lib/resolve-repo.ts` | Repo resolution utility (pattern reference) |
| `src/login.ts` | OAuth/manual login (auth flow context) |
| `src/comments/index.ts` | Comment router (pattern reference for new groups) |
| `src/comments/list.ts` | Comment list handler (pattern reference) |
| `src/comments/post.ts` | Comment post handler (pattern reference) |
| `src/inspect/index.ts` | Inspect router (pattern reference) |
| `package.json` | Project manifest, scripts, bin config |
| `tsconfig.json` | TypeScript config (ES2022, Node16) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md | Primary ticket specification | Defined full command surface, filters, constraints, and acceptance criteria |
| src/index.ts | CLI entry point inspection | Current switch-based router supports login/inspect/comments; new groups must follow same pattern |
| src/lib/config.ts | Auth config understanding | Stores {apiKey, url} only; org switching needs token persistence strategy |
| src/lib/http.ts | HTTP client capabilities | Supports retry, auth headers, basePath, queryParams; basePath '/api' needed for new commands |
| src/comments/index.ts | Existing command pattern | Shows subcommand routing, flag parsing, ticket ID resolution via --ticket/env var |
| src/comments/list.ts | Data fetch pattern | Shows hxFetch with basePath '/api', response typing, console output formatting |
| src/comments/post.ts | Write operation pattern | Shows POST with body via hxFetch, positional arg collection |
| package.json | Build/dep context | Zero prod deps, tsc build, ESM module, bin entry 'hlx' |

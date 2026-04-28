# Scout Summary: helix-cli

## Problem

Expand `helix-cli` from a narrow inspection tool (inspect + comments) into an org-aware Helix workbench. The CLI must support org switching, ticket discovery with filters, ticket detail inspection (branch/repos/runs/artifacts), local Codex bundling, ticket creation, comment reply, rerun, and continue (via rerun with `continuationContext`).

## Analysis Summary

### Current CLI State

The implementation is complete. The CLI has been expanded from 3 command groups (login, inspect, comments) to 5 (adding org and tickets), with 13 new source files across `src/org/` (4 files) and `src/tickets/` (10 files including router). Typecheck passes cleanly with zero errors.

### Implementation Structure

**Org commands** (`src/org/`):
- `current` - GET /api/auth/me, displays org name, ID, user name, email
- `list` - GET /api/auth/me, displays availableOrganizations with current marker
- `switch` - Resolves org by name or CUID, POST /api/auth/switch-org, saves new accessToken + orgId/orgName to `~/.hlx/config.json`

**Ticket discovery** (`src/tickets/`):
- `list` - GET /api/tickets with filters: `--archived`, `--status-not-in`, `--sprint`, `--user` (resolved via /organization/members), `--status` (client-side)
- `latest` - Fetches list, takes first item, prints full detail via `printTicketDetail`
- `get` - GET /api/tickets/:ticketId, prints title/shortId/status/branch/reporter/repos/runs/merge-status

**Ticket actions**:
- `create` - POST /api/tickets with `--title`, `--description`, `--repos`
- `rerun` - POST /api/tickets/:id/rerun with empty body
- `continue` - POST /api/tickets/:id/rerun with `{continuationContext}` from positional args

**Artifact inspection**:
- `artifacts` - GET /api/tickets/:id/artifacts, displays items and stepArtifactSummary
- `artifact` - GET /api/tickets/:id/runs/:runId/step-artifacts/:stepId?repoKey=, prints raw file content
- `bundle` - Creates deterministic local directory: `ticket.json`, `manifest.json`, `artifacts/<stepId>/<repoKey>/<filename>`

### Architecture Patterns

- **Command routing**: Manual switch-based dispatch in `src/index.ts` (unchanged pattern)
- **Flag parsing**: Manual `indexOf`-based `getFlag()` helper (unchanged, `src/lib/flags.ts`)
- **HTTP**: Single `hxFetch()` with retry, timeout, auth headers. New commands use `basePath: "/api"`
- **Auth**: `hxi_` prefix -> `X-API-Key`, other tokens -> `Authorization: Bearer`. Org switch saves new JWT as `apiKey`.
- **Config**: `HxConfig` now includes `orgId?` and `orgName?` persisted across commands
- **Zero dependencies**: All new code uses Node built-ins only (fs, path, os)

### Quality Gates

| Gate | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | Passes (0 errors) |
| Build | `tsc` | Available |
| Tests | N/A | No tests exist |
| Lint | N/A | No lint configured |

### Key Observations

1. **Config model updated**: `HxConfig` type now includes `orgId?` and `orgName?`. The `saveConfig` function persists these. Org switch replaces `apiKey` with the new `accessToken` from the server.

2. **User resolution for --user filter**: CLI resolves user input (email or name) to a `reporterUserId` via GET /api/organization/members. Server-side filter added (see helix-global-server scout).

3. **Status filter split**: `--status-not-in` maps to server query param; `--status` is client-side filtered. The backend supports `statusNotIn` but not a positive `status` filter.

4. **Bundle structure**: Deterministic layout with `ticket.json` (full detail), `manifest.json` (ticketId, bundledAt, cliVersion), and `artifacts/<stepId>/<repoKey>/<filename>`.

5. **Error handling**: Artifact fetch failures in bundle are caught and warned (not fatal). Command validation uses `process.exit(1)` with clear error messages.

6. **Ticket ID resolution**: Shared pattern across tickets commands - supports `--ticket` flag, `HELIX_TICKET_ID` env var, or positional argument.

## Relevant Files

| File | Role |
|---|---|
| `src/index.ts` | CLI entry point, command router (login, inspect, comments, org, tickets) |
| `src/lib/config.ts` | Auth config storage with orgId/orgName support |
| `src/lib/http.ts` | HTTP client with retry, auth, basePath |
| `src/lib/flags.ts` | Shared flag parsing utilities |
| `src/lib/resolve-repo.ts` | Repo resolution utility (inspect commands) |
| `src/login.ts` | OAuth/manual login flow |
| `src/org/index.ts` | Org command router (current, list, switch) |
| `src/org/current.ts` | Display current org and user |
| `src/org/list.ts` | List available organizations |
| `src/org/switch.ts` | Switch org, persist new JWT and org metadata |
| `src/tickets/index.ts` | Tickets command router (9 subcommands) |
| `src/tickets/list.ts` | List tickets with filters |
| `src/tickets/latest.ts` | Get latest ticket detail |
| `src/tickets/get.ts` | Get ticket detail (branch/repos/runs/merge) |
| `src/tickets/create.ts` | Create ticket |
| `src/tickets/rerun.ts` | Rerun ticket |
| `src/tickets/continue.ts` | Continue ticket with continuationContext |
| `src/tickets/artifacts.ts` | List artifacts for ticket |
| `src/tickets/artifact.ts` | Read step artifact content |
| `src/tickets/bundle.ts` | Bundle ticket context for Codex |
| `src/comments/index.ts` | Comment command router (pre-existing) |
| `src/comments/list.ts` | List comments (pre-existing) |
| `src/comments/post.ts` | Post comment (pre-existing) |
| `package.json` | Project manifest, scripts, bin config |
| `tsconfig.json` | TypeScript config (ES2022, Node16, strict) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md | Primary ticket specification | Defined full command surface, filters, constraints, and acceptance criteria |
| src/index.ts | CLI entry point inspection | Updated with org+tickets routing, new usage text, version 1.2.0 |
| src/lib/config.ts | Auth config understanding | HxConfig now includes orgId/orgName; saveConfig persists after org switch |
| src/lib/http.ts | HTTP client capabilities | basePath '/api' used by all new commands; retry/auth logic unchanged |
| src/lib/flags.ts | Flag parsing utilities | getFlag, hasFlag, getPositionalArgs, requireFlag used throughout |
| src/org/*.ts | Org command implementation | 3 commands, all using GET /api/auth/me or POST /api/auth/switch-org |
| src/tickets/*.ts | Ticket command implementation | 9 commands covering discovery, actions, artifacts, and bundling |
| package.json | Build/dep context | Zero prod deps, tsc build, ESM module, typecheck passes |
| typecheck output | Quality gate verification | tsc --noEmit produces 0 errors |

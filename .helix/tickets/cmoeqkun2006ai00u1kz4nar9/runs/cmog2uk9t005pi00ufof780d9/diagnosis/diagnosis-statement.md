# Diagnosis Statement: helix-cli

## Problem Summary

`helix-cli` is currently a narrow inspection tool with three command groups (login, inspect, comments). The ticket requires expanding it into an org-aware Helix workbench supporting org switching, ticket discovery with filters, ticket detail inspection, artifact reads, local Codex bundling, ticket creation, comment reply, rerun, and continue.

## Root Cause Analysis

This is a feature-addition gap, not a bug. The CLI was intentionally scoped as a lightweight inspection tool and has not yet been expanded to cover the full Helix workflow surface.

**Key findings that shape the implementation:**

1. **Auth is already compatible.** OAuth login (`hlx login <url>`) returns a session JWT that passes the server's `requireAuth` middleware on ticket CRUD routes. The `hxFetch` function already routes non-`hxi_` tokens to `Authorization: Bearer` headers. No auth redesign needed. Manual login (`--manual`) uses `hxi_` inspection keys with limited access (inspect + comments only); this remains valid for its original purpose.

2. **Backend API surface is nearly complete.** 13 of 14 required CLI commands map to existing backend endpoints. The only gap is the `--user` ticket filter, which requires a ~3-line backend addition (see helix-global-server diagnosis).

3. **Clean existing patterns.** The `src/comments/` command group provides a repeatable template: subcommand router (`index.ts`) + individual handler files + shared `hxFetch` with `basePath: "/api"`. New command groups follow the same structure.

4. **Config schema is sufficient for org switching.** POST `/api/auth/switch-org` returns a new `accessToken` (JWT encoding the target orgId). The CLI can overwrite its stored `apiKey` with this new token. Optionally, storing the current org name/id improves UX for `hlx org current` without a network call.

5. **Zero runtime dependencies.** The CLI has no production dependencies (only `@types/node` and `typescript` as dev deps). The expansion should maintain this constraint using Node.js built-in APIs.

6. **Version mismatch.** `src/index.ts` hardcodes version "0.1.0" while `package.json` says "1.2.0". Should be aligned during implementation.

## Evidence Summary

| Evidence | Finding |
|---|---|
| `src/login.ts:107` | OAuth callback key stored as apiKey; session JWT based on server investigation |
| `src/lib/http.ts:52-57` | hxi_ prefix check determines auth header; Bearer for session JWTs |
| `src/lib/config.ts` | Config is `{apiKey, url}` at `~/.hlx/config.json`; env vars take priority |
| `src/index.ts:28-47` | Switch-based routing for 3 commands; new cases needed for `org` and `tickets` |
| `src/comments/index.ts` | Subcommand pattern: getFlag() helper, HELIX_TICKET_ID env var, switch routing |
| `package.json` | v1.2.0, zero prod deps, ESM, tsc build, bin entry `hlx` |
| Server `src/routes/api.ts` | All ticket/org/artifact routes exist; ticket routes behind global requireAuth |
| Server ticket-controller.ts:190-208 | getTickets accepts archived, statusNotIn, sprintId but NOT reporterUserId |
| Server ticket-service.ts:1479 | userId option accepted but unused in where-clause |
| Server prisma/schema.prisma:306 | Ticket model has reporterUserId field (no migration needed) |

## Success Criteria

1. `hlx org current|list|switch` works and org switch persists the new JWT token.
2. `hlx tickets list|latest|get` works at org scope with correct backend API calls.
3. Ticket filters (`--user`, `--status`, `--status-not-in`, `--archived`, `--sprint`) work correctly.
4. Ticket detail output includes branch name, repos, run history, and merge status.
5. `hlx tickets artifacts <id>` lists available artifacts; `hlx tickets artifact <id> --step <step> --repo <repo>` prints artifact content.
6. `hlx tickets bundle <id> --out <dir>` creates a deterministic local context folder.
7. `hlx tickets create`, `hlx comments post`, `hlx tickets rerun`, and `hlx tickets continue` work.
8. `continue` uses the existing rerun endpoint with `continuationContext`.
9. All new commands use `hxFetch` with `basePath: "/api"` (thin client pattern).
10. Invalid inputs produce clear error messages.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md | Primary specification | Defined full command surface, filters, constraints, acceptance criteria, and non-negotiable constraints |
| scout/reference-map.json (helix-cli) | File inventory and facts | Identified 11 relevant files, current command surface, auth patterns, zero-dep constraint, version mismatch |
| scout/scout-summary.md (helix-cli) | Analyzed expansion scope | Mapped all CLI commands to backend endpoints, identified auth gap investigation needs, proposed file layout |
| scout/reference-map.json (helix-global-server) | Backend API mapping | Confirmed 10 relevant server files, all endpoint shapes, auth middleware chains, --user filter gap |
| scout/scout-summary.md (helix-global-server) | Backend coverage analysis | Confirmed near-complete API coverage, identified reporterUserId as the only missing query parameter |
| src/login.ts (helix-cli) | Direct code inspection | Confirmed OAuth flow returns a `key` stored as apiKey; manual mode uses hxi_ keys |
| src/lib/http.ts (helix-cli) | Direct code inspection | Confirmed hxi_ prefix routing for auth headers; Bearer header for session JWTs |
| src/auth/middleware.ts (server) | Direct code inspection | Confirmed requireAuth accepts session JWTs; ticket routes require session auth |
| src/routes/api.ts (server) | Direct code inspection | Confirmed global requireAuth gate at line 238; all ticket routes present |
| prisma/schema.prisma (server) | Direct code inspection | Confirmed Ticket.reporterUserId exists; no migration needed for --user filter |

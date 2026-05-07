# Scout Summary — helix-cli

## Problem

Four targeted CLI ergonomics improvements for the `hlx` CLI:

1. **No server-side ticket search** — `hlx tickets list` has no `--search` flag. Consumers must fetch all tickets and filter locally.
2. **Broken run display in `tickets get`** — Run timestamps and status display incorrectly due to a field name mismatch between the CLI's expected type (`createdAt`/`completedAt`) and the server's actual response (`startedAt`/`finishedAt`).
3. **No dry-run for `tickets continue`** — The command immediately starts a run with no way to preview the resolved continuation payload.
4. **`inspect db` PowerShell fragility** — Quoted Postgres identifiers in SQL cause quoting issues under PowerShell. The `--query` flag exists but documentation may be insufficient and `--query-file` is absent.

## Analysis Summary

### 1. tickets list --search

**CLI side** (`src/tickets/list.ts`): The command builds `queryParams` from flags (--archived, --status-not-in, --sprint, --user) and sends GET /api/tickets. No `--search` flag exists. Adding one requires: parse flag, add to queryParams, pass to server.

**Server side** (`ticket-controller.ts:190-213`, `ticket-service.ts:1477-1556`): The `getTickets` controller parses query params and calls `listTicketsForOrganization`. No search/title parameter is accepted. The Prisma `findMany` where clause needs a `title: { contains, mode: 'insensitive' }` filter. The ticket's `title` field is a plain `String` in the Prisma schema (line 330); no full-text index exists.

### 2. tickets get run display

**Root observation** (`src/tickets/get.ts:14-19` vs `ticket-service.ts:457-473`): The CLI `TicketDetail.runs` type declares `createdAt: string` and `completedAt: string | null`. The server's `mapRunHistoryItem` returns `startedAt` and `finishedAt`. At runtime, `run.createdAt` and `run.completedAt` are both `undefined`.

**Impact on formatDate**: `formatDate(undefined)` (no runStatus) returns `"in progress"`. `formatDate(undefined, "SUCCEEDED")` returns `"N/A"`. Neither renders an actual timestamp. The CLI type must be updated to match the server's field names.

### 3. tickets continue --dry-run

**Current flow** (`src/tickets/continue.ts:9-37`): Resolves ticket ref → extracts continuation context from positional args → POSTs to `/api/tickets/{ticketId}/rerun`. No flag check for `--dry-run`.

**Required change**: Before the API call (line 30), check for `--dry-run`. If present, print the resolved payload (`{ ticketId, continuationContext }`) and exit without calling the API.

### 4. inspect db PowerShell

**Current state** (`src/inspect/index.ts:43-63`): The `--query` flag already exists (line 57) as an alternative to positional SQL. Help text (lines 45-53) includes a PowerShell example using single quotes. The `--query-file` option does not exist.

**PowerShell concern**: Single quotes in `--query 'SELECT * FROM "Tickets"...'` work differently in PS 5.1 vs 7.x. A `--query-file` option would provide an unambiguous escape hatch. Help text needs a clearer PS 5.1 example.

## Relevant Files

### helix-cli (primary changes)
| File | Role |
|------|------|
| `src/tickets/list.ts` | tickets list command — add --search flag |
| `src/tickets/get.ts` | tickets get command — fix run field names and formatDate |
| `src/tickets/continue.ts` | tickets continue command — add --dry-run |
| `src/tickets/index.ts` | ticket subcommand router and help text |
| `src/inspect/index.ts` | inspect subcommand router — update db help, add --query-file |
| `src/inspect/db.ts` | inspect db implementation |
| `src/lib/flags.ts` | shared flag parsing utilities |
| `src/lib/http.ts` | HTTP client with queryParams support |
| `src/lib/resolve-ticket.ts` | ticket reference resolution |
| `src/lib/flags.test.ts` | flag parsing tests |
| `src/lib/resolve-ticket.test.ts` | ticket resolution tests |

### helix-global-server (search endpoint)
| File | Role |
|------|------|
| `src/controllers/ticket-controller.ts` | getTickets handler — parse search query param |
| `src/services/ticket-service.ts` | listTicketsForOrganization — add title filter to Prisma query |
| `prisma/schema.prisma` | Ticket model definition (title field, existing indexes) |
| `src/routes/api.ts` | Route mounting (GET /tickets already exists) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand all four requirements, acceptance criteria, and non-negotiables | Server-side search required; dry-run must not start a run; existing --query must continue working |
| src/tickets/list.ts | Map current list command flags and API call | No --search flag; API call at line 69-72 uses queryParams; --status is client-side filter |
| src/tickets/get.ts | Find run display formatting bug | TicketDetail type expects createdAt/completedAt but server returns startedAt/finishedAt — field name mismatch |
| src/tickets/continue.ts | Map continuation flow | Simple POST to /api/tickets/{id}/rerun; no --dry-run; payload is { continuationContext } |
| src/inspect/index.ts | Map inspect db argument handling | --query flag exists (line 57); help text has PS example; no --query-file |
| src/inspect/db.ts | Understand SQL execution path | Simple passthrough to API; no changes needed to core execution |
| ticket-controller.ts (server) | Map server-side ticket list endpoint | getTickets at line 190 parses archived/statusNotIn/sprintId/reporterUserId; no search param |
| ticket-service.ts (server) | Map Prisma query for ticket listing | findMany at line 1522 with where clause; no title filter. mapRunHistoryItem returns startedAt/finishedAt (not createdAt/completedAt) |
| prisma/schema.prisma (server) | Confirm data model | SandboxRun has startedAt/finishedAt/createdAt. Ticket.title is String. No full-text index on title |
| package.json (CLI) | Understand build/test/CI | tsc build, node --test, npm publish CI. Zero runtime deps |
| package.json (server) | Confirm ORM and migration strategy | Prisma ORM, file-based migrations (prisma migrate deploy in build script) |
| scripts/prisma-migrate-all.mjs | Confirm migration deployment | Runs `prisma migrate deploy` at build time — file-based migration strategy confirmed |

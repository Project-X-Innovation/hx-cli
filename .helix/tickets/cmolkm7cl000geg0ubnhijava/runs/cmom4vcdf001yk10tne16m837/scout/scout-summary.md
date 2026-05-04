# Scout Summary

## Problem

The Helix CLI ticket commands pass raw user input directly to API endpoints that require internal ticket IDs. When users provide short IDs like `BLD-339` or numeric ticket numbers like `339`, the API returns HTTP 404 because it expects the full internal CUID. Additionally, no subcommand supports `--help`/`-h` flags (they either error or execute normal behavior), no `--json` output mode exists for agent consumption, run timestamps render as "Invalid Date" in certain cases, and `inspect db` has no workaround for PowerShell shell quoting with Postgres quoted identifiers.

## Analysis Summary

### Ticket ID Resolution (core problem)
- `resolveTicketId()` in `src/tickets/index.ts` (lines 13-26) extracts the raw ticket reference string from `--ticket` flag, `HELIX_TICKET_ID` env var, or first positional arg and returns it unchanged.
- This raw string is interpolated directly into API URL paths like `/api/tickets/{ticketId}` across all 7 ticket subcommands that accept a ticket reference: `get`, `artifacts`, `artifact`, `rerun`, `continue`, `bundle`, and `latest` (indirectly via `printTicketDetail`).
- The API expects internal IDs (CUID format), so short IDs and numeric references return 404.
- A duplicate `resolveTicketId()` exists in `src/comments/index.ts` (lines 6-14).
- An analogous resolution pattern already exists in `src/lib/resolve-repo.ts`: fetch a list, then match client-side by exact ID, name, or partial match. The `tickets latest` command (line 44-45) demonstrates that the `/api/tickets` list endpoint returns objects with internal `id` fields.

### Help Flag Handling (missing)
- The main dispatcher (`src/index.ts` line 43) includes `--help`/`-h` in the auto-update skip set but has **no switch case** to actually handle them. They fall through to "Unknown command" + usage.
- No subcommand router (`tickets`, `inspect`, `org`, `token`, `comments`) checks for `--help`/`-h` before dispatching. When passed as subcommand args (e.g., `hlx tickets get --help`), `resolveTicketId()` fails with "No ticket ID provided" because `--help` starts with `--` and is not a positional arg.

### JSON Output (missing)
- No `--json` flag is checked in any ticket command.
- `tickets list` (line 88) outputs formatted text only and omits the internal `id` field.
- `tickets get` / `printTicketDetail()` outputs formatted text only and truncates descriptions at 500 characters (line 57).

### Invalid Date (timestamp rendering)
- `src/tickets/get.ts` lines 50-51 render run timestamps with `new Date(run.createdAt).toLocaleString()`.
- `new Date()` returns "Invalid Date" for empty strings, undefined coerced to string, or malformatted input.
- The null check on `completedAt` (line 51) correctly shows "in progress" for null but does not cross-reference the run's `status` field.

### Inspect DB Ergonomics
- `src/inspect/db.ts` receives the SQL query as joined positional args (`src/inspect/index.ts` line 29).
- No `--query` flag alternative exists. PowerShell users cannot easily pass Postgres double-quoted identifiers through positional args due to shell quoting conflicts.

### Test Infrastructure (absent)
- No test files, no test runner in `package.json`, no CI configuration.
- The only quality gates are `npm run build` (tsc) and `npm run typecheck` (tsc --noEmit), both of which pass cleanly.
- Node.js built-in `node:test` is available (Node>=18 target) and would add zero dependencies.

## Relevant Files

| File | Role |
|------|------|
| `src/tickets/index.ts` | Ticket router + `resolveTicketId()` — central to resolution changes |
| `src/tickets/get.ts` | `printTicketDetail()` — timestamp bug, JSON output, description truncation |
| `src/tickets/list.ts` | `cmdTicketsList()` — JSON output, missing internal ID in text output |
| `src/tickets/latest.ts` | Uses `printTicketDetail` + list endpoint pattern |
| `src/tickets/artifacts.ts` | Needs resolver adoption |
| `src/tickets/artifact.ts` | Needs resolver adoption |
| `src/tickets/rerun.ts` | Needs resolver adoption |
| `src/tickets/continue.ts` | Needs resolver adoption |
| `src/tickets/bundle.ts` | Needs resolver adoption |
| `src/tickets/create.ts` | Needs help handling only |
| `src/index.ts` | Main dispatcher — missing --help case |
| `src/lib/flags.ts` | Flag parsing utilities — no help-specific helpers |
| `src/lib/http.ts` | `hxFetch()` — API client, error messages |
| `src/lib/config.ts` | `HxConfig` type, `requireConfig()`, org context for error messages |
| `src/lib/resolve-repo.ts` | Repo resolution pattern — analogous template for ticket resolution |
| `src/inspect/index.ts` | Inspect router — no help handling |
| `src/inspect/db.ts` | DB command — PowerShell quoting concern |
| `src/comments/index.ts` | Duplicate `resolveTicketId()` |
| `package.json` | No test runner, scripts: build/typecheck only |
| `tsconfig.json` | strict mode, ES2022, Node16 modules |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | Defined all 11 acceptance criteria, required behaviors, failure modes, and scope boundaries for the CLI improvements |
| package.json | Dependency and script inventory | No test runner, no ORM, only build/typecheck quality gates |
| tsconfig.json | Build configuration | Strict TypeScript, ES2022 target, Node16 modules — constrains how new code must be written |
| src/tickets/index.ts | Ticket command router source | `resolveTicketId()` passes raw input to API — root of the 404 problem |
| src/tickets/get.ts | Ticket get command source | Timestamp rendering bug at line 50-51, description truncation at line 57, no JSON mode |
| src/tickets/list.ts | Ticket list command source | No JSON mode, internal ID omitted from text output, TicketItem type shows API response shape |
| src/tickets/latest.ts | Ticket latest command source | Demonstrates list endpoint returns internal IDs usable for client-side resolution |
| src/tickets/artifacts.ts | Ticket artifacts command source | Passes raw ticketId to API endpoint |
| src/tickets/artifact.ts | Ticket artifact command source | Passes raw ticketId to multiple API endpoints |
| src/tickets/rerun.ts | Ticket rerun command source | Passes raw ticketId to POST endpoint |
| src/tickets/continue.ts | Ticket continue command source | Passes raw ticketId to POST endpoint |
| src/tickets/bundle.ts | Ticket bundle command source | Passes raw ticketId to API endpoint |
| src/tickets/create.ts | Ticket create command source | Verified it creates tickets (no resolution needed) but needs help handling |
| src/index.ts | Main entry point source | --help/-h in skip set but no switch case to handle them |
| src/lib/flags.ts | Flag utility source | Available helpers for checking flags; no help-specific logic |
| src/lib/http.ts | HTTP client source | API call mechanics, error message format for 404s |
| src/lib/config.ts | Config source | HxConfig type with orgId/orgName available for error context |
| src/lib/resolve-repo.ts | Repo resolution source | Existing fetch-list-then-match pattern that can serve as template for ticket resolution |
| src/inspect/index.ts | Inspect router source | No help handling, query from positional args only |
| src/inspect/db.ts | DB command source | No --query flag, positional args only |
| src/comments/index.ts | Comments router source | Duplicate resolveTicketId() confirming cross-module duplication |

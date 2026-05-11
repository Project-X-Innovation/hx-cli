# Scout Summary — BLD-401

## Problem

`hlx tickets create` has three usability defects:

1. **`--repos` misleading semantics**: The `--repos` flag accepts comma-separated values that are sent directly as `repositoryIds` to `POST /api/tickets` (create.ts:20-21). There is no client-side resolution — passing a repo name/key causes the server to return `HTTP 400 — Unknown repositoryId: <key>`. Meanwhile, `src/lib/resolve-repo.ts` already implements `resolveRepo()` which converts names/keys to IDs via the inspect API, but `tickets create` does not use it.

2. **No file-based description input**: `--description` is a required literal string (create.ts:19). There is no `--description-file` flag, no file-reading logic, and no detection if the value is a readable file path. A path string is silently used as the ticket body.

3. **No post-create description editing**: The tickets subcommand router (tickets/index.ts) has no `update-description` command. However, the server already supports `PATCH /api/tickets/:ticketId` with an optional `description` field (server ticket-controller.ts:47-52, 235-254). The CLI just lacks the surface to invoke it.

## Analysis Summary

**All required API endpoints already exist on the server. This is a CLI-only change set.**

### Change 1: --repos resolution
- `resolveRepo()` in `src/lib/resolve-repo.ts` already resolves name/key/partial → ID via `GET /api/inspect/repositories`. It handles exact ID match, exact name (case-insensitive), and partial name match, with a clean error listing available repos.
- `cmdTicketsCreate` needs to call `resolveRepo()` for each entry in `--repos` before sending to the API. This provides client-side validation and user-friendly errors referencing `hlx inspect repos`.
- Help text in create.ts:14 and index.ts:20, 69 needs updating to reflect that names/keys are accepted.

### Change 2: --description-file and file-path detection
- New `--description-file <path>` flag that reads UTF-8 text from disk.
- `--description` and `--description-file` must be mutually exclusive (fail before API call).
- If `--description` value is a readable file path, the CLI must fail with a clear error rather than silently using the path string.
- Neither flag currently exists for file-based input; `requireFlag` enforces `--description` as required.

### Change 3: update-description subcommand
- New subcommand registered in `tickets/index.ts` switch block.
- Follows existing pattern: `extractTicketRef` + `resolveTicket` + handler.
- Handler calls `PATCH /api/tickets/:ticketId` with `{ description }` using `hxFetch` with `method: "PATCH"` and `basePath: "/api"`.
- Accepts `--file <path>` or `--text <string>` (mutually exclusive).
- Server already validates status constraints (DRAFT/QUEUED only) and returns 409 otherwise.

### Execution signals
- **Build**: `npm run build` → `tsc`
- **Typecheck**: `npm run typecheck` → `tsc --noEmit`
- **Test**: `npm run test` → `tsc && node --test dist/**/*.test.js` (Node.js built-in test runner)
- **No lint configured** in helix-cli
- **Strict TypeScript**: ES2022 target, Node16 modules, strict mode enabled

## Relevant Files

| File | Role |
|------|------|
| `src/tickets/create.ts` | Primary: --repos resolution, --description-file, file-path detection |
| `src/tickets/index.ts` | Primary: register update-description subcommand, update usage text |
| `src/lib/resolve-repo.ts` | Reuse: resolveRepo() for name/key → ID resolution |
| `src/lib/flags.ts` | Reuse/extend: flag parsing, may need mutual-exclusion helper |
| `src/lib/resolve-ticket.ts` | Reuse: extractTicketRef + resolveTicket for update-description |
| `src/lib/http.ts` | Reuse: hxFetch with PATCH method for update-description |
| `src/tickets/get.ts` | Context: TicketDetail type, description display (verifies AC4) |
| `src/inspect/repos.ts` | Context: hlx inspect repos output format |
| `src/lib/config.ts` | Context: HxConfig type definition |
| `src/index.ts` | Context: main entry point, no changes expected |
| `package.json` | Context: build/test scripts, no external dependencies |
| `tsconfig.json` | Context: strict TS config |
| `src/lib/flags.test.ts` | Context: test patterns for flag utilities |
| `src/lib/resolve-ticket.test.ts` | Context: test patterns for resolution utilities |

### Server-side (helix-global-server) — context only, no changes needed

| File | Role |
|------|------|
| `src/controllers/ticket-controller.ts:235-254` | PATCH /tickets/:ticketId already supports description updates |
| `src/controllers/ticket-controller.ts:47-52` | updateTicketSchema: description z.string().max(10_000).optional() |
| `src/services/ticket-service.ts:1042-1109` | updateQueuedTicketForOrganization: DRAFT/QUEUED status gate |
| `src/services/ticket-service.ts:159-166` | Server-side repositoryId validation (HTTP 400 for unknown IDs) |
| `src/routes/api.ts:283` | Route: PATCH /api/tickets/:ticketId → patchTicket |
| `src/routes/api.ts:207` | Route: GET /api/inspect/repositories (inspect auth) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli run root) | Ticket requirements and acceptance criteria | Three defects: --repos semantics, --description-file missing, no post-create edit |
| src/tickets/create.ts | Current create command implementation | --repos sent as raw IDs; --description is literal-only; no file handling |
| src/tickets/index.ts | Subcommand router | No update-description command exists; switch-based dispatch pattern |
| src/lib/resolve-repo.ts | Existing repo resolution logic | resolveRepo() already converts name/key → ID; unused by tickets create |
| src/lib/flags.ts | Flag parsing utilities | getFlag, hasFlag, requireFlag available; no mutual-exclusion helper |
| src/lib/resolve-ticket.ts | Ticket resolution | extractTicketRef + resolveTicket pattern used by get/rerun/continue |
| src/lib/http.ts | API client | Supports PATCH method; basePath configurable |
| src/tickets/get.ts | Ticket detail display | description field present in TicketDetail type and printed by get |
| src/inspect/repos.ts | Repos listing command | Calls listRepos; prints displayName + id + types |
| helix-global-server ticket-controller.ts | Server PATCH endpoint | Already supports optional description update |
| helix-global-server ticket-service.ts | Server update logic | DRAFT/QUEUED status restriction; 409 on other statuses |
| helix-global-server api.ts routes | Server route registration | PATCH /tickets/:ticketId registered; inspect/repositories available |
| package.json | Build/test config | tsc build; Node.js built-in test runner; no lint; strict TS |

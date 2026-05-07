# Diagnosis Statement — BLD-401

## Problem Summary

`hlx tickets create` has three usability defects:

1. **`--repos` passes raw values as repositoryIds** without client-side resolution, causing HTTP 400 when users provide repo names/keys instead of internal IDs.
2. **`--description` is literal-only** — no `--description-file` flag exists, and file paths passed to `--description` are silently used as the ticket body string.
3. **No CLI surface for post-create description editing** — the server already supports `PATCH /api/tickets/:ticketId` with an optional description field, but no CLI command invokes it.

## Root Cause Analysis

### Defect 1: `--repos` semantics mismatch

**Root cause**: `src/tickets/create.ts:21` splits `--repos` values and sends them directly as `repositoryIds` to `POST /api/tickets`. No resolution step exists between user input and API call. The `resolveRepo()` function in `src/lib/resolve-repo.ts` already converts name/key/partial to ID via `GET /api/inspect/repositories`, but `tickets create` does not use it. Three other commands (`inspect logs`, `inspect db`, `inspect api`) already use `resolveRepo` successfully.

The server validates repositoryIds by database lookup (`ticket-service.ts:159-166`) and throws `HttpError(400, 'Unknown repositoryId: <value>')` for any unrecognized value.

**Fix**: Call `resolveRepo()` for each entry in `--repos` before building the API request. This provides client-side validation with user-friendly error messages that list available repos. The error message should also reference `hlx inspect repos`. Update help text to reflect that names/keys are accepted.

### Defect 2: No file-based description input

**Root cause**: `src/tickets/create.ts:19` uses `requireFlag(args, '--description', ...)` which calls `getFlag()` (flags.ts:5-8), returning the literal next argument. There is no `--description-file` flag, no `fs.readFileSync` logic, and no detection of whether the `--description` value is a readable file path.

**Fix**:
- Add `--description-file <path>` flag that reads UTF-8 text from disk.
- Make `--description` and `--description-file` mutually exclusive (fail before API call).
- When `--description` value is a readable file path, fail with a clear error directing users to use `--description-file`.
- Neither flag needs to be individually required — but at least one must be provided.

### Defect 3: Missing update-description subcommand

**Root cause**: `src/tickets/index.ts` switch block contains nine subcommands (list, latest, get, create, rerun, continue, artifacts, artifact, bundle) but no `update-description`. The server endpoint `PATCH /api/tickets/:ticketId` (api.ts:283) is fully functional and accepts optional description updates. The CLI simply lacks the surface to invoke it.

**Fix**: Add a new `update-description` case in the switch block following the existing `extractTicketRef + resolveTicket + handler` pattern. Create `src/tickets/update-description.ts` with `--file <path>` and `--text <string>` (mutually exclusive) options. Use `hxFetch` with `method: "PATCH"` and `basePath: "/api"`.

## Evidence Summary

| Evidence | Location | Confirms |
|----------|----------|----------|
| Raw repositoryIds pass-through | `src/tickets/create.ts:21` | Defect 1: no resolution before API call |
| resolveRepo already exists | `src/lib/resolve-repo.ts:11-37` | Resolution infrastructure is available and tested |
| resolveRepo used by 3 other commands | `src/inspect/{logs,db,api}.ts` | Proven pattern, not novel code |
| Server rejects non-ID repo values | `ticket-service.ts:164-165` | HTTP 400 is expected server behavior |
| Literal description pass-through | `src/tickets/create.ts:19` + `flags.ts:28-35` | Defect 2: no file handling |
| No update-description in switch | `src/tickets/index.ts:39-133` | Defect 3: subcommand missing |
| Server PATCH endpoint exists | `api.ts:283`, `ticket-controller.ts:235-254` | Server already supports description updates |
| updateTicketSchema accepts description | `ticket-controller.ts:48-50` | `z.string().trim().min(1).max(10_000).optional()` |
| DRAFT/QUEUED status restriction | `ticket-service.ts:1084-1092` | Server enforces edit constraints; CLI can rely on 409 |
| hxFetch supports PATCH | `src/lib/http.ts:42` | `method = options.method ?? 'GET'` — PATCH works |
| extractTicketRef + resolveTicket pattern | `src/tickets/index.ts:61-63` (get), etc. | Consistent pattern for ticket-ref subcommands |

## Success Criteria

1. `hlx tickets create --repos <name-or-key>` resolves to internal ID via `resolveRepo()` before calling the API. Unknown names fail with exit code 1, listing available repos and referencing `hlx inspect repos`.
2. `hlx tickets create --description-file <path>` reads the file and uses its contents as the description.
3. `--description` and `--description-file` are mutually exclusive — providing both fails before any API call.
4. `hlx tickets create --description <file-path>` detects the readable file path and fails with a clear error directing users to `--description-file`.
5. `hlx tickets update-description <ticket-ref> --file <path>` or `--text <string>` updates the description via PATCH, and `hlx tickets get` reflects the change.
6. Help text for `tickets create` accurately describes `--repos` as accepting repo names, keys, or IDs.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Ticket requirements and acceptance criteria | Three defects: --repos semantics, --description-file missing, no post-create edit |
| scout/reference-map.json (helix-cli) | File mapping and factual claims from scout | Identified all relevant files; confirmed server PATCH endpoint exists |
| scout/scout-summary.md (helix-cli) | Analysis summary and change scope | Confirmed CLI-only change set; server needs no modifications |
| src/tickets/create.ts | Direct inspection of create command | Lines 19-21 confirm raw pass-through for both --repos and --description |
| src/tickets/index.ts | Direct inspection of subcommand router | No update-description case; switch pattern clear |
| src/lib/resolve-repo.ts | Direct inspection of resolution logic | resolveRepo already handles name/key/partial → ID with error listing |
| src/lib/flags.ts | Direct inspection of flag utilities | getFlag/requireFlag return literal values; no mutual-exclusion helper |
| src/lib/resolve-ticket.ts | Direct inspection of ticket resolution | extractTicketRef + resolveTicket pattern for reuse |
| src/lib/http.ts | Direct inspection of API client | PATCH method supported; basePath configurable |
| src/tickets/get.ts | Direct inspection of get command | TicketDetail type includes description; confirms AC4 verifiability |
| helix-global-server ticket-controller.ts | Server PATCH endpoint verification | updateTicketSchema has optional description; patchTicket handler confirmed |
| helix-global-server ticket-service.ts | Server update logic and constraints | DRAFT/QUEUED gate (409 otherwise); repositoryId validation (400) |
| helix-global-server routes/api.ts | Server route registration | PATCH /tickets/:ticketId registered at line 283 |
| /tmp/helix-inspect/manifest.json | Runtime inspection availability | DB/logs available for server but not needed — CLI-only changes |

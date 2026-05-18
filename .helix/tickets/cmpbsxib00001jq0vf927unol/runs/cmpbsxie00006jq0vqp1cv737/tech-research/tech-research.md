# Tech Research — RSH-493: Ticket Relationship Support in hlx CLI

## Technology Foundation

- **Language/Runtime**: TypeScript (strict mode, ES2022, Node16 module resolution)
- **Build**: `tsc` (no bundler)
- **Test**: `tsc && node --test dist/**/*.test.js`
- **HTTP**: Custom `hxFetch()` wrapper over Node `fetch` with retry logic (3 attempts, exponential backoff)
- **CLI architecture**: Manual arg parsing with `getFlag()`/`requireFlag()`/`hasFlag()` utilities — no CLI framework (e.g., Commander, yargs)
- **Dependencies**: Only `@types/node` and `typescript` (devDependencies). No runtime dependencies.

## Architecture Decision

### Options Considered

**Option A: Add flags inline to existing create.ts (chosen)**
- Add `--after`, `--reference`, `--implement-from` flags directly in `cmdTicketsCreate()` using existing `getFlag()` pattern.
- Resolve references via `resolveTicket()` before building the POST body.
- Extend the body object with resolved IDs.
- Rationale: Follows the exact established pattern used for `--repos` (resolve-then-use), `--mode`, `--description-file`. Minimal diff, no new abstractions.

**Option B: Extract a relationship-resolution module**
- Create a `src/lib/resolve-relationships.ts` that encapsulates all three flag-parsing + resolution steps.
- Rejected: Over-engineering. The three flags are simple, independent optional fields. The resolution logic is a straightforward `getFlag()` + `resolveTicket()` per flag. A separate module would add indirection without reducing complexity.

**Option C: Batch-resolve references to reduce API calls**
- Fetch the ticket list once, then call `matchTicket()` against it for each reference (avoiding N separate `resolveTicket()` calls for `--reference`).
- Deferred (Round 2): Acceptable for now because (a) create is not a hot path, (b) max 5 references, (c) the optimization adds complexity to a straightforward flow. Can be revisited if users report slowness.

### Chosen: Option A — Inline flag addition

## Core API/Methods

### Server Contract (fixed — no changes needed)

**POST /api/tickets** — Zod schema `createTicketSchemaGeneral`:
```
{
  title: string (1-160 chars, required),
  description: string (1-10000 chars, required),
  repositoryIds: string[] (1-20, required),
  mode: "AUTO"|"BUILD"|"FIX"|"RESEARCH"|"EXECUTE" (optional),
  afterTicketId: string (optional),
  implementFromTicketId: string (optional),
  referencedTicketIds: string[] (max 5, optional)
}
```

**Server Validation Rules:**
- `afterTicketId`: Must exist in same org; must not be DEPLOYED/STAGING_MERGED; circular dependency check (walks up to 20 ancestors); sets new ticket to WAITING or QUEUED based on predecessor state.
- `implementFromTicketId`: Must reference a RESEARCH mode ticket with REPORT_READY status.
- `referencedTicketIds`: All must exist in same org.

**Error response shape** (from `app.ts` error handler):
- HttpError: `{ error: "Human-readable message" }` with HTTP 400
- ZodError: `{ error: "Invalid request payload.", details: [...] }` with HTTP 400

**GET /api/tickets/:id** response (detail) includes:
- `afterTicketId: string | null`
- `afterTicket: { id, title, status, shortId, mode, approvalStatus } | null`
- `implementFromTicketId: string | null`
- `implementFromTicket: { id, title, status, shortId, mode, approvalStatus } | null`
- `referencedTicketIds: string[]`
- `referencedTickets: Array<{ id, title, status, shortId, mode, approvalStatus }>`

**GET /api/tickets** response (list) per item includes:
- `afterTicketId: string | null`
- `afterTicket: { id, title, status, shortId, approvalStatus } | null`
- `implementFromTicketId: string | null`
- `referencedTicketIds: string[]`

> **Note**: The list endpoint returns richer relationship data than the diagnosis documented. `afterTicket` is a nested object (not just an ID), and both `implementFromTicketId` and `referencedTicketIds` are returned per item. This means the list view can show meaningful relationship info without additional API calls.

### CLI Methods (to modify)

- `cmdTicketsCreate()` in `src/tickets/create.ts` — Add three optional flags, resolve references, include in POST body.
- `printTicketDetail()` in `src/tickets/get.ts` — Extend `TicketDetail` type, add relationship display sections.
- `cmdTicketsList()` in `src/tickets/list.ts` — Extend `TicketItem` type, add dependency indicator in output line.

### CLI Methods (to use, not modify)

- `resolveTicket()` in `src/lib/resolve-ticket.ts` — Resolves ticket reference (ID, shortId, or number) to `{ id, shortId }`. Already handles active + archived fallback and numeric ambiguity.
- `getFlag()` / `hasFlag()` in `src/lib/flags.ts` — Standard flag parsing.
- `hxFetch()` in `src/lib/http.ts` — HTTP client with retry. Already supports arbitrary body fields.

## Technical Decisions

### 1. Flag naming: `--after`, `--reference`, `--implement-from`

- **Chosen**: Match the product spec names. `--after` is concise and clear for dependency chaining. `--reference` matches the UI's concept of informational cross-references. `--implement-from` mirrors the field name.
- **Rejected**: `--depends-on` (more descriptive but doesn't match the server field name or UI terminology). `--ref` (too abbreviated and could conflict with git terminology).

### 2. Reference format for `--reference`: comma-separated

- **Chosen**: `--reference RSH-490,RSH-491` — comma-separated, matching the `--repos` flag pattern.
- **Rejected**: Space-separated (`--reference RSH-490 RSH-491`) — ambiguous with positional args and requires shell quoting awareness. Multiple flag instances (`--reference RSH-490 --reference RSH-491`) — more verbose and doesn't match existing CLI patterns.
- **Rationale**: Comma-separated is already established in the CLI (see `--repos` in `create.ts` line 62: `reposRaw.split(",").map(s => s.trim()).filter(s => s.length > 0)`).

### 3. Reference resolution strategy: sequential resolveTicket() calls

- **Chosen**: Call `resolveTicket()` for each reference value independently.
- **Tradeoff**: For `--reference` with 5 values, this means up to 10 API calls (2 per reference: active list + archived). However, ticket creation is not a hot path, and the simplicity of reusing the existing utility outweighs the performance cost.
- **Rejected**: Batch resolution (fetch list once, matchTicket() N times) — adds complexity; deferred to Round 2 if performance becomes an issue.

### 4. Error handling: surface server messages directly

- **Chosen**: When `hxFetch` throws an error from a non-OK response, the error message includes the HTTP status and response body text. The server's validation messages are already human-readable (e.g., "Circular dependency detected.", "implementFromTicketId must reference a RESEARCH mode ticket."). The create command should catch errors from `hxFetch`, parse the JSON error message if possible, and display the server's `error` field directly.
- **Current behavior**: `hxFetch` throws `Error("HTTP 400 Bad Request — {"error":"Circular dependency detected."}")`. The create command currently lets these propagate as unhandled rejections.
- **Improvement**: Wrap the `hxFetch` call in try/catch, attempt to extract the `error` field from the response JSON, and print `Error: <server message>` with `process.exit(1)`. This matches the pattern used for repo resolution errors (create.ts lines 72-76).

### 5. Display layout for relationships in `tickets get`

- **Chosen**: Add relationship sections after the status/branch header area, before Repositories. Format:
  ```
  Depends on:   RSH-490 (Build API) — IN_PROGRESS
  Implements:   RSH-485 (Cache research) — REPORT_READY
  References:   RSH-491 (Update docs) — COMPLETED, RSH-492 (Fix tests) — IN_PROGRESS
  ```
- **Rationale**: Compact, scannable, consistent with the existing label-value format (e.g., `Status:`, `Branch:`).

### 6. List view dependency indicator

- **Chosen**: Prepend a compact indicator when `afterTicketId` is present. Since the list endpoint now returns `afterTicket` as a nested object, the indicator can include the predecessor's shortId: `[after RSH-490]` appended to the line.
- **Rationale**: The list endpoint already returns `afterTicket.shortId`, so no extra API call is needed. Appending rather than prepending avoids breaking the existing column alignment pattern.

### 7. TicketDetail and TicketItem type extensions

- **TicketDetail** (get.ts): Add `afterTicketId`, `afterTicket`, `implementFromTicketId`, `implementFromTicket`, `referencedTicketIds`, `referencedTickets` fields matching the server response shape. All fields should be typed as nullable/optional to handle tickets without relationships.
- **TicketItem** (list.ts): Add `afterTicketId`, `afterTicket`, `implementFromTicketId`, `referencedTicketIds` fields.

## Cross-Platform Considerations

Not applicable. The CLI is a pure Node.js application with no platform-specific code. Flag parsing and HTTP calls work identically across macOS, Linux, and Windows.

## Performance Expectations

- **Create command with --after or --implement-from**: Adds 1 `resolveTicket()` call (2 API requests worst-case) before the POST. Total: 3-4 requests instead of 1. Acceptable for a non-hot-path operation.
- **Create command with --reference (5 refs)**: Adds up to 5 `resolveTicket()` calls (10 API requests worst-case). Total: ~11 requests. Acceptable but could be optimized later with batch resolution.
- **Get command**: No additional API calls. Relationship data is already in the detail response.
- **List command**: No additional API calls. Relationship data is already in the list response per item.

## Dependencies

- **No new runtime dependencies**. The implementation uses only existing modules: `resolveTicket`, `getFlag`, `hxFetch`.
- **No new devDependencies**. TypeScript and `@types/node` remain the only build-time dependencies.
- **Server dependency**: Relies on the existing server API contract (Zod schema in `ticket-controller.ts`). No server changes needed.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `resolveTicket()` API calls for 5 references feels slow | Low | Sequential calls are simple and correct. Batch optimization deferred to Round 2. |
| Server error message format changes | Very Low | Error extraction is best-effort (try JSON parse, fall back to raw text). |
| List endpoint shape changes | Very Low | Type fields are optional/nullable; missing fields won't crash. |
| Shell quoting issues with comma-separated references | Low | Comma-separated avoids spaces in values. Matches established `--repos` pattern. |

## Deferred to Round 2

- **Batch reference resolution**: Fetch ticket list once and call `matchTicket()` for each reference, reducing API calls for `--reference` with multiple values.
- **Editing relationships on existing tickets**: `hlx tickets update --after <ref>` is out of scope per product spec.
- **Interactive ticket picker**: Not in MVP; flags are passed as arguments.
- **Dependency tree visualization**: Not in MVP; flat relationship display only.

## Summary Table

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repos changed | helix-cli only | Server and client already fully support relationships |
| New create flags | `--after`, `--reference`, `--implement-from` | Match product spec and server field names |
| Reference format | Comma-separated for `--reference` | Matches `--repos` pattern; avoids shell quoting |
| Resolution method | `resolveTicket()` per reference | Reuses existing utility; simple and correct |
| Error handling | Extract server `error` field from JSON response | Server messages are already human-readable |
| Get display | Label-value sections (Depends on, Implements, References) | Matches existing format; compact and scannable |
| List indicator | `[after RSH-XXX]` appended to line | Uses nested afterTicket data from list response |
| New dependencies | None | Stays within existing dependency footprint |
| Performance | Acceptable sequential resolution | Create is not a hot path; defer batch optimization |

## Files to Change

| File | Change |
|------|--------|
| `src/tickets/create.ts` | Add --after, --reference, --implement-from flags; resolve references; include in POST body; error handling |
| `src/tickets/get.ts` | Extend TicketDetail type; add relationship display in printTicketDetail() |
| `src/tickets/list.ts` | Extend TicketItem type; add dependency indicator in output |
| `src/tickets/index.ts` | Update usage text and help strings for create command |
| `src/docs/cli-content.ts` | Add new flags to tickets create documentation table and worked examples |
| `skill-content/SKILL.md` | Document ticket relationship commands |
| `skill-content/references/commands.md` | Add relationship flags to tickets create section |

## APL Statement Reference

The technical direction is a single-repo change in helix-cli: add --after, --reference, and --implement-from flags to the create command using existing resolveTicket() for reference resolution and getFlag() for parsing; extend TicketDetail and TicketItem types to include relationship fields; add display sections to get and list outputs; and update all documentation surfaces. The server API is fully ready and returns rich relationship data on both detail and list endpoints. Error responses are well-structured JSON with human-readable messages. No new dependencies or abstractions are needed.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli) | Ticket description and scope | CLI lacks ticket relationship capabilities that exist in the UI |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause analysis and evidence | Feature gap in CLI; server API fully ready; resolveTicket() reusable |
| `diagnosis/apl.json` (helix-cli) | Diagnosis questions, answers, and evidence | Confirmed single-repo change; no server/client modifications needed |
| `product/product.md` (helix-cli) | Product requirements and success criteria | Defined --after, --reference, --implement-from flags; display requirements; out-of-scope items |
| `scout/scout-summary.md` (helix-cli) | Scout analysis of affected files and patterns | Mapped all files needing changes; confirmed quality gates |
| `scout/reference-map.json` (helix-cli) | Structured file map and facts | Listed all affected files with roles; documented server validation rules |
| `repo-guidance.json` | Shared repo intent metadata | Confirmed helix-cli is sole target repo; others are context-only |
| `helix-cli/src/tickets/create.ts` | Direct code inspection | Verified POST body shape (lines 89-93) and flag patterns |
| `helix-cli/src/tickets/get.ts` | Direct code inspection | Verified TicketDetail type omits relationships; identified display insertion point |
| `helix-cli/src/tickets/list.ts` | Direct code inspection | Verified TicketItem type omits relationships; identified output format |
| `helix-cli/src/lib/resolve-ticket.ts` | Direct code inspection | Confirmed resolveTicket() handles ID/shortId/number; reusable for flags |
| `helix-cli/src/lib/flags.ts` | Direct code inspection | Confirmed getFlag/hasFlag/requireFlag pattern |
| `helix-cli/src/lib/http.ts` | Direct code inspection | Verified hxFetch error handling and buildErrorMessage format |
| `helix-cli/src/tickets/index.ts` | Direct code inspection | Identified usage strings and help text needing update |
| `helix-cli/src/docs/cli-content.ts` | Direct code inspection | Identified documentation tables needing new flag entries |
| `helix-cli/skill-content/references/commands.md` | Direct code inspection | Identified command reference needing update |
| `helix-cli/skill-content/SKILL.md` | Direct code inspection | Identified skill docs needing relationship documentation |
| `helix-global-server/src/controllers/ticket-controller.ts` (lines 29-40) | Server API schema verification | Confirmed exact Zod schema for all relationship fields |
| `helix-global-server/src/services/ticket-service.ts` (lines 668-777) | Server validation logic | Confirmed validation rules and error messages for each relationship type |
| `helix-global-server/src/services/ticket-service.ts` (lines 1789-1828) | Server detail response shape | Confirmed nested relationship objects in detail response |
| `helix-global-server/src/services/ticket-service.ts` (lines 1500-1700) | Server list response shape | Discovered list endpoint returns richer data than diagnosis indicated (afterTicket nested, implementFromTicketId, referencedTicketIds) |
| `helix-global-server/src/http/errors.ts` | Error class definition | Confirmed HttpError shape (statusCode + message) |
| `helix-global-server/src/app.ts` (lines 84-98) | Error handler middleware | Confirmed JSON error response format: { error: message } for HttpError |

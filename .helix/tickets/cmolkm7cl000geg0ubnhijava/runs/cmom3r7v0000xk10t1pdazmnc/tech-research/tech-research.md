# Tech Research: Improve Helix CLI Ticket Lookup, Help, JSON Output, and Inspection Ergonomics

## Technology Foundation

- **Language:** TypeScript 6.0.2 with `strict: true` (tsconfig.json:9)
- **Runtime:** Node.js >= 18 (package.json:14, `engines.node`)
- **Module system:** ES modules (Node16 module/moduleResolution), `.js` extension imports
- **Build:** `tsc` compiles `src/` to `dist/` (tsconfig.json:4-6)
- **Dependencies:** Zero runtime deps. DevDeps: `@types/node`, `typescript` only
- **HTTP client:** Native `fetch` via `hxFetch()` wrapper (src/lib/http.ts) with retry/backoff
- **CLI pattern:** `process.argv` parsing with custom flag utilities in `src/lib/flags.ts`
- **Existing resolution pattern:** `src/lib/resolve-repo.ts` — fetch list, match client-side by ID/name/partial

## Architecture Decision: Ticket Reference Resolution

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Backend lookup endpoint** | Add server-side `/api/tickets/lookup?ref=339` accepting any ID format | Single source of truth; handles pagination server-side | Requires backend changes; ticket explicitly scopes to CLI-only |
| **B. Client-side list matching** | Fetch `/api/tickets`, match locally by ID/shortId/number | Proven pattern (resolve-repo.ts); no backend changes; single API call | Pagination risk for large orgs; full list fetch overhead |
| **C. Sequential API retries** | Try `/tickets/{input}` as internal ID, then try parsing as shortId, etc. | No list fetch; works per-ticket | 2-3 API calls on failure path; fragile; no pattern precedent |

### Chosen: Option B — Client-side list matching

**Rationale:** This follows the proven `resolve-repo.ts` pattern (lines 11-37) already used in the codebase. The `latest.ts` command (line 44-45) already fetches the list endpoint and extracts `latest.id` to call `printTicketDetail()`, confirming the list endpoint returns internal IDs. No backend changes are needed, which is consistent with the ticket scope constraint ("This ticket is scoped to the CLI and any minimal API support required for the CLI to work correctly"). Option A would be cleaner long-term but is out of scope. Option C is fragile and has no codebase precedent.

### Resolution Module Design

New file: `src/lib/resolve-ticket.ts`

**Two-layer design for testability:**
1. **Pure matcher** — `matchTicket(items: TicketItem[], ref: string): TicketItem | null` — takes pre-fetched items and a reference string, returns the matched item or null. This is the primary test target.
2. **Fetch wrapper** — `resolveTicket(config: HxConfig, ref: string): Promise<{ id: string; shortId: string }>` — calls `/api/tickets` list endpoint, then delegates to the pure matcher. Handles error messages with org context.

**Match priority (strict, no fallback):**
1. **Exact internal ID match** — `items.find(t => t.id === ref)` (CUID format check optional)
2. **Exact short ID match** — `items.find(t => t.shortId.toLowerCase() === ref.toLowerCase())` (e.g., "BLD-339")
3. **Numeric ticket number match** — parse `ref` as integer, extract number from each `shortId` suffix (split on `-`, parse last segment), match exactly

**Rejected alternatives:**
- Partial/fuzzy matching: ticket explicitly forbids "do not fall back to a title search" and "do not fall back to partial matches" (ticket.md lines 78-79)
- Latest-ticket fallback: ticket says "do not use the latest ticket as a fallback" (ticket.md line 85)
- First-match fallback: ticket says "do not use the first ticket returned by list as a proxy" (ticket.md line 84)

**Ambiguity handling:** If multiple items match the same numeric suffix (theoretically possible across different prefixes), fail with a clear error listing the matches. Per ticket.md line 79: "If resolution is ambiguous, fail with a clear message."

**Error messages:** Include the input reference, current org name (from `config.orgName`), and suggested valid formats.

### Reference Extraction

A shared `extractTicketRef(args: string[]): string` function (in `resolve-ticket.ts` or `flags.ts`) replaces both duplicate `resolveTicketId()` functions:
- `src/tickets/index.ts:13-26` — supports `--ticket` flag, `HELIX_TICKET_ID` env, and positional arg
- `src/comments/index.ts:6-14` — supports `--ticket` flag and `HELIX_TICKET_ID` env only (no positional)

The new function combines both: `--ticket` flag > `HELIX_TICKET_ID` env > first positional arg. This eliminates the duplication and gives comments positional arg support as a bonus.

### Adoption Plan

The resolved internal ID replaces raw input in these call sites:
- `src/tickets/index.ts` — `get`, `rerun`, `continue`, `artifacts`, `artifact`, `bundle` cases (6 sites)
- `src/comments/index.ts` — `list`, `post` cases (2 sites)

Each call site changes from `resolveTicketId(rest)` to `await resolveTicket(config, extractTicketRef(rest))` — the resolver is async because it fetches the list endpoint.

## Architecture Decision: Help Flag Interception

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Single global interceptor** | Check `--help` in `src/index.ts` before switch | Simple, one location | Can't show subcommand-specific help |
| **B. Per-router + per-command** | Each router and command checks for help | Context-aware help at every level | Repetitive, risk of missing a command |
| **C. Three-level with shared utility** | Global + router + command checks using shared `isHelpRequested()` | Context-aware and DRY | Slightly more code than A, but correct |

### Chosen: Option C — Three-level with shared utility

**Rationale:** Help must work at three levels with different outputs:
1. `hlx --help` → global usage (existing `usage()` function in `src/index.ts`)
2. `hlx tickets --help` → tickets subcommand list (existing `ticketsUsage()` in `src/tickets/index.ts`)
3. `hlx tickets get --help` → command-specific help (new per-command usage text)

**Implementation:**
- Add `isHelpRequested(args: string[]): boolean` to `src/lib/flags.ts` — checks for `--help` or `-h` in args
- Add `case "--help": case "-h":` in `src/index.ts` main switch (calls `usage()` but exits 0 instead of 1)
- Add help check at top of `runTickets()`, `runInspect()`, `runComments()` before the subcommand switch
- Add help check in each command that takes a ticket reference, before validation/API calls

**Key constraint:** Help must exit before `resolveTicketId`/`resolveTicket` is called, before `requireConfig()` where possible, and before any API calls. This means the check happens early in the function body.

## Core API/Methods

### New Module: `src/lib/resolve-ticket.ts`

```
type TicketRef = { id: string; shortId: string }

matchTicket(items: TicketItem[], ref: string): TicketItem | null
  - Pure function, no side effects, primary test target

resolveTicket(config: HxConfig, ref: string): Promise<TicketRef>
  - Fetches /api/tickets list, calls matchTicket, returns resolved ref
  - Throws with descriptive error on failure (includes org context)

extractTicketRef(args: string[]): string
  - Extracts raw reference from --ticket flag, HELIX_TICKET_ID env, or positional arg
  - Replaces both duplicate resolveTicketId() functions
```

### Modified: `src/lib/flags.ts`

```
isHelpRequested(args: string[]): boolean
  - Returns true if args includes '--help' or '-h'
```

### Modified: `src/tickets/get.ts`

```
printTicketDetail(config, ticketId, options?: { json?: boolean }): Promise<void>
  - When json=true: JSON.stringify full ticket data to stdout (untruncated description)
  - When json=false: existing text format with fixed timestamp rendering

formatDate(value: string | null | undefined): string
  - Safe Date construction with validation
  - Returns formatted date for valid input, 'unknown' for invalid, 'in progress' for null on incomplete runs
```

### Modified: `src/tickets/list.ts`

```
cmdTicketsList(config, args): Promise<void>
  - Checks hasFlag(args, '--json')
  - When --json: JSON.stringify items array to stdout (includes internal id field)
  - When text: existing format, optionally add internal id column
```

### Modified: `src/inspect/index.ts`

```
inspect db: accepts --query <sql> as alternative to positional args
  - getFlag(rest, '--query') ?? positional.join(' ')
  - Help text includes PowerShell-safe example using --query
```

## Technical Decisions

### TD-1: Resolver is async, changes call site signatures

The ticket router's `resolveTicketId()` is currently synchronous (extracts raw string from args). The new `resolveTicket()` is async (fetches list endpoint). This means the call sites in `runTickets()` switch cases must await the resolution. Since `runTickets()` is already async, this is a mechanical change.

**Rejected alternative:** Making the resolver synchronous by pre-fetching the list and caching — adds complexity and state management. The single API call per command invocation is acceptable overhead.

### TD-2: JSON output goes to stdout; errors to stderr

When `--json` is active, the JSON data goes to `console.log()` (stdout) and errors go to `console.error()` (stderr). This is the standard CLI pattern for machine-readable output. The process exits non-zero on error. No partial JSON is emitted on error — the command either succeeds with clean JSON or fails with stderr-only error output.

**Rejected alternative:** JSON error envelope (e.g., `{ "error": "..." }`) — adds complexity and ticket says "errors should still be clear and should not emit partial success JSON" (ticket.md line 80).

### TD-3: Timestamp fix uses Date validity check, not format detection

Rather than trying to detect and parse specific timestamp formats, the fix validates the constructed Date object: `const d = new Date(value); if (isNaN(d.getTime())) return 'unknown'`. This handles all invalid input generically. For `completedAt === null`, the display checks `run.status` when available to distinguish "in progress" from "failed" or other terminal states.

**Rejected alternative:** Parsing ISO 8601 manually — unnecessary; `new Date()` handles ISO 8601 correctly. The problem is unparseable or missing values, not format mismatches.

### TD-4: `--query` flag for inspect db, not `--file`

Adding `--query <sql>` as a flag alternative to positional args solves the PowerShell quoting problem because flag values are single tokens. The `--file` option (read SQL from a file) is a nice-to-have but adds file I/O complexity for a minor ergonomic win.

**Rejected alternative:** `--file <path>` — more complex, less common use case, can be added later if needed.

### TD-5: Tests use node:test with compile-first, zero new dependencies

Tests are `.test.ts` files in `src/` compiled by `tsc` to `dist/*.test.js`, run with `node --test`. The pure matcher function `matchTicket()` is the primary test target — it takes an array of fixture items and a reference string, requiring no HTTP mocking. Help detection (`isHelpRequested`) and date formatting are also unit-testable pure functions.

**Rejected alternatives:**
- `vitest` — excellent DX but adds a dependency tree to a zero-dep project
- `jest` — heavy, complex TS setup, not aligned with ESM-first project
- `tsx` loader — adds a dependency; compile-first is sufficient for the focused test scope

### TD-6: No resolver caching

Ticket explicitly says "Do not persist ticket resolution caches unless explicitly needed" (ticket.md line 88). Each command invocation fetches the list fresh. For CLI single-command usage, this is appropriate.

### TD-7: Comments module gets resolver adoption

The duplicate `resolveTicketId()` in `src/comments/index.ts:6-14` is replaced with the shared `extractTicketRef()` + `resolveTicket()` from `resolve-ticket.ts`. This eliminates code duplication and gives comments the same resolution capabilities (short IDs, numeric numbers) as ticket commands. The ticket's "shared ticket id resolution" principle applies here even though comments aren't explicitly listed in the acceptance criteria.

## Cross-Platform Considerations

### PowerShell Compatibility (inspect db)

The primary cross-platform concern is PowerShell's double-quote handling conflicting with Postgres quoted identifiers. The `--query` flag resolves this:
```
# PowerShell-safe:
hlx inspect db --repo myrepo --query 'SELECT * FROM "Tickets" WHERE "status" = ''open'''

# vs. current broken positional approach:
hlx inspect db --repo myrepo SELECT * FROM "Tickets"  # PowerShell strips quotes
```

The help text for `inspect db` should include a PowerShell-specific example.

### Date Formatting Locale

`toLocaleString()` output varies by OS locale settings. For JSON output this is not an issue (ISO 8601 strings from the API are passed through). For text output, the existing `toLocaleString()` is acceptable — the fix is only about preventing `Invalid Date`, not standardizing locale formatting.

## Performance Expectations

- **Resolution overhead:** One additional API call (`/api/tickets` list) per command invocation. This is already the pattern in `latest.ts`. For typical org sizes (< 1000 tickets), the list response is small and fast.
- **No caching:** Each CLI invocation is independent. CLI commands are interactive, so sub-second resolution overhead is acceptable.
- **Pagination risk:** If orgs grow large enough that the list endpoint paginates and the target ticket is beyond the first page, resolution will fail with a clear error. This is documented as a known risk to address if/when it occurs, potentially via a backend lookup endpoint.

## Dependencies

### Runtime Dependencies (unchanged)
- None. The project has zero runtime dependencies and this change adds none.

### Dev Dependencies (unchanged)
- `@types/node ^25.5.0`
- `typescript ^6.0.2`
- No new dev dependencies needed. `node:test` is built into Node.js >= 18.

### API Dependencies
- `GET /api/tickets` — list endpoint returning `{ items: TicketItem[] }` with `id`, `shortId`, `title`, `status`, `updatedAt`, `reporter` fields. Already used by `list.ts` and `latest.ts`.
- `GET /api/tickets/{id}` — detail endpoint returning `{ ticket: TicketDetail }`. Already used by `get.ts`, `artifact.ts`, `bundle.ts`.
- No new API endpoints required.

## Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | List endpoint paginates and target ticket is beyond first page | Medium | Clear error message mentioning org context; document as known limitation; backend lookup endpoint is future mitigation |
| R2 | API timestamp format is not ISO 8601, causing Date constructor to produce different `Invalid Date` scenarios | Low | The Date-validity check (`isNaN(d.getTime())`) handles all invalid inputs regardless of format; safe fallback to "unknown" |
| R3 | Run object may lack a `status` field for cross-referencing with `completedAt` | Low | TicketDetail type already includes `runs[].status` (get.ts:15); use it when present, fall back to null-check only |
| R4 | node:test glob pattern `dist/**/*.test.js` may not work in all Node 18 minor versions | Low | Alternative: explicit file paths in test script, or `node --test dist/lib/` which auto-discovers .test.js files |
| R5 | ShortId format may vary across orgs (not always PREFIX-NUMBER) | Low | Numeric extraction uses split-on-last-hyphen; if format differs, exact shortId match still works as primary resolution path |

## Deferred to Round 2

These items are out of scope for this ticket but are noted for future consideration:

- **Backend ticket lookup endpoint** — If pagination becomes a real issue, a server-side `/api/tickets/lookup?ref=339` endpoint would eliminate client-side resolution limitations.
- **Multi-reference batch resolution** — The resolver handles one reference per invocation. Future commands accepting multiple references should resolve each independently.
- **JSON output for other commands** — The `--json` pattern established here could extend to `inspect`, `org`, and `comments` commands.
- **Resolver caching** — If resolution latency becomes a concern, a short-lived in-process cache could be added.
- **`--file` flag for inspect db** — Reading SQL from a file would further help PowerShell users with complex queries.
- **Tab completion** — The resolver's ticket list could power shell completion for ticket references.

## Summary Table

| Area | Decision | Key File(s) |
|------|----------|-------------|
| Ticket resolution | Client-side list matching, pure matcher + async wrapper | New: `src/lib/resolve-ticket.ts` |
| Match semantics | Exact ID > exact shortId > exact numeric number; no partial/fuzzy | `src/lib/resolve-ticket.ts` |
| Help interception | Three-level (global + router + command) with shared utility | `src/lib/flags.ts`, `src/index.ts`, all routers |
| JSON output | `--json` flag, full data to stdout, errors to stderr | `src/tickets/get.ts`, `src/tickets/list.ts` |
| Timestamp fix | Date validity check with safe fallback + run.status cross-reference | `src/tickets/get.ts` |
| Inspect db ergonomics | `--query` flag alternative to positional args | `src/inspect/index.ts` |
| Test infrastructure | `node:test` compile-first, zero new deps | New: `src/lib/resolve-ticket.test.ts` |
| Comments dedup | Replace duplicate resolveTicketId with shared resolver | `src/comments/index.ts` |

### Files to Create
| File | Purpose |
|------|---------|
| `src/lib/resolve-ticket.ts` | Shared ticket resolver module (matchTicket, resolveTicket, extractTicketRef) |
| `src/lib/resolve-ticket.test.ts` | Tests for pure matcher function and ref extraction |

### Files to Modify
| File | Change |
|------|--------|
| `src/tickets/index.ts` | Replace resolveTicketId with shared resolver; add help checks; pass args to get for --json |
| `src/tickets/get.ts` | Add --json output; fix timestamp rendering; accept options parameter |
| `src/tickets/list.ts` | Add --json output; include internal id |
| `src/tickets/latest.ts` | Add help check |
| `src/tickets/artifacts.ts` | (no direct change; resolver applied in router) |
| `src/tickets/artifact.ts` | (no direct change; resolver applied in router) |
| `src/tickets/rerun.ts` | (no direct change; resolver applied in router) |
| `src/tickets/continue.ts` | (no direct change; resolver applied in router) |
| `src/tickets/bundle.ts` | (no direct change; resolver applied in router) |
| `src/tickets/create.ts` | Add help check |
| `src/comments/index.ts` | Replace duplicate resolveTicketId; add help checks |
| `src/index.ts` | Add --help/-h case in main switch |
| `src/lib/flags.ts` | Add isHelpRequested() utility |
| `src/inspect/index.ts` | Add --query flag for db; add help checks |
| `package.json` | Add test script |

## APL Statement Reference

The technical direction is client-side ticket resolution via a new `src/lib/resolve-ticket.ts` module following the proven `resolve-repo.ts` fetch-list-then-match pattern. The resolver separates a pure matcher function (testable without HTTP) from a fetch wrapper. Help is intercepted at three levels (global, router, command) using a shared utility in `flags.ts`. JSON output is added to tickets list and get via a `--json` flag that emits full structured data to stdout. Timestamps use validated Date construction with safe fallback. Inspect db gains a `--query` flag for PowerShell safety. Tests use `node:test` with compile-first approach (zero added deps). All changes are within helix-cli; no backend modifications required.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification with acceptance criteria and constraints | Defined 11 acceptance criteria, non-negotiable invariants (same-ticket resolution across formats), failure behavior rules (no fallback, no ambiguity), scope boundaries (CLI only, no backend) |
| `scout/reference-map.json` | Detailed file map with line-level evidence | Identified all 20 relevant source files, confirmed resolveTicketId raw passthrough as root cause, catalogued TicketItem type fields available from list endpoint |
| `scout/scout-summary.md` | Synthesized codebase analysis | Confirmed 5 problem categories, identified resolve-repo.ts as template, validated list endpoint returns internal IDs |
| `diagnosis/apl.json` | Structured diagnostic Q&A with evidence | Provided evidence-backed answers confirming client-side resolution viability, help interception gap, and timestamp bug mechanics |
| `diagnosis/diagnosis-statement.md` | Root cause analysis with 5 root causes | RC-1 (raw passthrough) through RC-5 (SQL quoting) with line-level evidence; confirmed no backend changes needed |
| `product/product.md` | Product vision, features, success criteria, risks | Defined 8 essential features (F1-F8), 11 success criteria, identified pagination risk (Q1), confirmed zero-dependency test preference |
| `repo-guidance.json` | Repo intent metadata | Confirmed helix-cli as sole target repository |
| `src/lib/resolve-repo.ts` | Direct source inspection | Confirmed fetch-list-then-match pattern at lines 11-37; template for ticket resolver architecture |
| `src/tickets/index.ts` | Direct source inspection | Confirmed resolveTicketId lines 13-26 raw passthrough; mapped 6 subcommand call sites needing resolver adoption |
| `src/tickets/get.ts` | Direct source inspection | Confirmed TicketDetail type with all required fields (lines 4-21); timestamp bug at lines 50-51; description truncation at line 57 |
| `src/tickets/list.ts` | Direct source inspection | Confirmed TicketItem type with id/shortId (lines 5-12); TicketsResponse shape; --json insertion point |
| `src/tickets/latest.ts` | Direct source inspection | Confirmed line 44-45 fetches list and uses internal id, validating client-side resolution approach |
| `src/lib/flags.ts` | Direct source inspection | Confirmed available utilities (hasFlag, getFlag, getPositionalArgs, requireFlag); identified insertion point for isHelpRequested |
| `src/lib/http.ts` | Direct source inspection | Confirmed hxFetch signature and error handling; retry/backoff behavior for resolution API call |
| `src/lib/config.ts` | Direct source inspection | Confirmed HxConfig type with orgId/orgName fields available for resolver error messages |
| `src/index.ts` | Direct source inspection | Confirmed missing --help case in switch (lines 51-94); mapped SKIP_AUTO_UPDATE set |
| `src/inspect/index.ts` | Direct source inspection | Confirmed SQL from positional.join(' ') at line 29; no --query flag; mapped --query insertion point |
| `src/comments/index.ts` | Direct source inspection | Confirmed duplicate resolveTicketId at lines 6-14 with identical logic minus positional arg |
| `src/tickets/artifact.ts` | Direct source inspection | Confirmed raw ticketId in two API calls; no direct modification needed (resolver applied in router) |
| `src/tickets/bundle.ts` | Direct source inspection | Confirmed raw ticketId in API calls; no direct modification needed (resolver applied in router) |
| `src/tickets/continue.ts` | Direct source inspection | Confirmed raw ticketId and positional arg extraction for continuation context |
| `src/tickets/rerun.ts` | Direct source inspection | Confirmed raw ticketId in POST call |
| `package.json` | Project configuration | Confirmed zero deps, Node >= 18, no test script; mapped test script insertion point |
| `tsconfig.json` | TypeScript configuration | Confirmed strict mode, ES2022 target, Node16 modules, src/ -> dist/ compilation |

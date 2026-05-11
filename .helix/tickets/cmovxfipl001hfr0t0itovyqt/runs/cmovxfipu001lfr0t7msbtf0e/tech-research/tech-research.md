# Tech Research: hlx CLI Ergonomics Polish

## Technology Foundation

- **helix-cli**: Zero-dependency TypeScript CLI compiled via `tsc` to `dist/`. Entry: `dist/index.js`. Build: `npm run build`. Test: `node --test dist/**/*.test.js`. Flag parsing via custom `src/lib/flags.ts` utilities (`getFlag`, `hasFlag`, `getPositionalArgs`). HTTP via `src/lib/http.ts` (`hxFetch`) with `queryParams` support using `URL.searchParams.set()`.
- **helix-global-server**: Express + Prisma ORM (v6.19.2) with PostgreSQL. File-based migrations (`prisma migrate deploy` at build time). Controllers parse `req.query` params and pass to service functions. Prisma `findMany` with where-clause composition.
- **Cross-repo contract**: CLI sends GET/POST requests to server API endpoints. Query parameters are the integration contract for search. Run response fields (`startedAt`/`finishedAt`) are the contract for run display.

## Architecture Decisions

### AD-1: Server-Side Search via Prisma `contains` + `insensitive`

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Client-side filtering | Fetch all tickets, filter in CLI | No server change | **Rejected**: violates non-negotiable requirement; does not scale |
| B. PostgreSQL full-text search | Add `tsvector` column + GIN index | Powerful for large datasets | Over-engineered; requires migration; 468 tickets don't warrant it |
| C. Prisma `contains` with `mode: 'insensitive'` | Add `title: { contains: search, mode: 'insensitive' }` to where clause | No migration; translates to PostgreSQL `ILIKE '%search%'`; composes with existing filters | Linear scan on title column |

**Chosen: Option C** -- Prisma `contains` with `mode: 'insensitive'`.

**Rationale**: Production has 468 tickets. `ILIKE` on a plain `String` column is performant at this scale without any index. No schema migration or Prisma migration file is needed. The `contains` operator is a query-time filter only. This is the smallest correct change. If ticket volume grows beyond ~10K, a trigram GIN index on `Ticket.title` can be added as a follow-up.

**Integration path**:
1. Server controller (`ticket-controller.ts:190`): Parse `search` from `req.query` as string.
2. Server service (`ticket-service.ts:1477`): Add `search?: string` to options type. Add `title: { contains: search, mode: 'insensitive' }` to Prisma where clause when search is present.
3. CLI (`list.ts:38`): Parse `--search` flag via `getFlag(args, "--search")`. Add `search` to `queryParams` if present. No other changes needed -- `hxFetch` already handles `queryParams` via `url.searchParams.set()`.

### AD-2: Fix Run Display via CLI Field Name Update

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Change server response to use `createdAt`/`completedAt` | Rename fields in `mapRunHistoryItem` | Matches CLI's current type | **Rejected**: ticket explicitly excludes "Changing the API response format for runs" |
| B. Update CLI type to use `startedAt`/`finishedAt` | Fix CLI `TicketDetail.runs` type | Aligns with actual server response; no server change | Must update all references |

**Chosen: Option B** -- Update CLI type to match server field names.

**Rationale**: The server's `mapRunHistoryItem` deliberately returns `startedAt` (when run began executing) and `finishedAt` (when run completed). These are semantically correct: `SandboxRun.createdAt` is the DB record creation time (at QUEUED), `startedAt` is when execution began. The CLI should use the server's field names as-is. Production data confirms valid ISO dates in these fields.

**Changes**:
1. `get.ts:14-19`: Update `TicketDetail.runs` type -- `createdAt` becomes `startedAt`, `completedAt` becomes `finishedAt`.
2. `get.ts:71-72`: Update `printTicketDetail` -- `run.createdAt` becomes `run.startedAt`, `run.completedAt` becomes `run.finishedAt`.
3. `formatDate` function (lines 32-44): No changes needed -- it already handles `null`/`undefined` correctly.

### AD-3: Dry-Run via Pre-API-Call Flag Check

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Separate `--preview` command | New subcommand `tickets preview` | Clean separation | Over-engineering; adds routing complexity |
| B. `--dry-run` flag in `continue.ts` | Check flag before API call; print payload and exit | Minimal change; follows established CLI patterns | None significant |
| C. Interactive confirmation prompt | Ask user to confirm before sending | Prevents mistakes | Breaks agent/automation contexts; not requested |

**Chosen: Option B** -- `--dry-run` flag gate in `continue.ts`.

**Rationale**: The continuation context assembly (`continue.ts:17-22`) and ticket resolution (`index.ts:91-92`) already run before the API call. A single `hasFlag(args, "--dry-run")` check before line 30 is the smallest correct change. The dry-run path must not call the API, must not start a run, and must not create any side effects.

**Output format**: Print a structured human-readable display showing the resolved ticket ID, the endpoint that would be called, and the body that would be sent. This gives full visibility into what the command would do. The payload itself is `{ continuationContext: "..." }`, which is the exact body sent to `POST /api/tickets/{ticketId}/rerun`.

**Changes**:
1. `continue.ts`: Import `hasFlag` from flags. After context assembly (line 22), before API call (line 30), add dry-run check.
2. `tickets/index.ts:22-23,88`: Update help text to include `--dry-run` flag.
3. `tickets/index.ts:16`: Update usage string for `continue` to show `[--dry-run]`.

### AD-4: PowerShell Ergonomics via `--query-file` + Improved Help

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Documentation-only fix | Improve help text with PS examples | No code change | Insufficient -- PS 5.1 nested double-quote escaping is genuinely fragile for complex SQL |
| B. `--query-file <path>` + improved docs | Read SQL from file; update help with PS 5.1/7 examples | Eliminates quoting entirely for complex SQL; established `readFileSync` pattern in codebase | Adds a code path |
| C. Stdin pipe support | Read SQL from `process.stdin` | Flexible | Over-engineering; not requested; complicates implementation |

**Chosen: Option B** -- Add `--query-file` + improve help text.

**Rationale**: The CLI already uses `readFileSync` from `node:fs` in multiple modules (`config.ts`, `version.ts`). Adding `--query-file` follows this established pattern. It provides an unambiguous escape hatch for any SQL, regardless of shell or quoting complexity. The help text update documents `--query` as the canonical form and provides explicit PowerShell examples showing quoted Postgres identifiers.

**Priority order for SQL source**: `--query-file` > `--query` > positional. If `--query-file` is provided, read the file and use its contents as the query, ignoring `--query` and positional args.

**Changes**:
1. `inspect/index.ts:43-63`: Add `--query-file` flag parsing with `getFlag(rest, "--query-file")`. If present, read file via `readFileSync(path, "utf8").trim()`. Error if file doesn't exist or result is empty.
2. `inspect/index.ts:8-23`: Update `inspectUsage()` to include `--query-file` in usage and add explicit PS 5.1/7 examples with quoted identifiers (e.g., `"Ticket"."ticketNumber"`).
3. `inspect/index.ts:44-53`: Update help text for `db --help` with the same enhanced examples.

## Core API/Methods

### Server: `GET /api/tickets?search=<text>`

- **New query param**: `search` (string, optional). Case-insensitive substring match on `Ticket.title`.
- **Composes with**: `archived`, `statusNotIn`, `sprintId`, `reporterUserId`.
- **Empty result**: Returns `{ items: [] }` -- no error.
- **SQL generated**: `WHERE ... AND title ILIKE '%search%'` (via Prisma `contains` + `mode: 'insensitive'`).

### CLI: Flag parsing patterns

All new flags follow the established `flags.ts` patterns:
- `--search <text>`: Parsed via `getFlag(args, "--search")` -- returns value string.
- `--dry-run`: Parsed via `hasFlag(args, "--dry-run")` -- returns boolean.
- `--query-file <path>`: Parsed via `getFlag(rest, "--query-file")` -- returns file path string.

## Technical Decisions

### TD-1: No database migration needed

Prisma's `contains` with `mode: 'insensitive'` is a query-time operator that translates to PostgreSQL `ILIKE`. It does not require a schema change, new column, or index. No Prisma migration file is needed.

### TD-2: No new runtime dependencies

The helix-cli is zero-dependency (only devDependencies). All changes use Node.js built-ins (`node:fs` for `readFileSync`) and existing utility functions (`flags.ts`, `http.ts`). This constraint is preserved.

### TD-3: `startedAt` used as run "start" timestamp, not `createdAt`

The `SandboxRun` model has three time fields: `createdAt` (DB record creation at QUEUED time), `startedAt` (when execution began), `finishedAt` (when execution completed). The server's `mapRunHistoryItem` returns `startedAt`/`finishedAt` deliberately. The CLI should use `startedAt` as the start-time display column. `createdAt` from the run record is not exposed in the API response and is out of scope per ticket constraints.

### TD-4: Dry-run output is human-readable text

The `--dry-run` flag prints a structured human-readable display showing: ticket ID, target endpoint, and request body. This gives full "what would happen" visibility. JSON output is available via the existing `--json` flag pattern if needed in the future, but the initial implementation uses readable text to match the interactive use case described in the ticket.

**Rejected alternative**: Always-JSON output. While agents benefit from JSON, the ticket's "prints the resolved continuation payload" phrasing implies human-readable output. JSON is the payload format, not the display format.

### TD-5: `--query-file` reads file synchronously

Using `readFileSync` (not async) matches the established pattern in `config.ts` and `version.ts`. The SQL file is expected to be small (a single query), so synchronous I/O is appropriate. The file path is resolved relative to `process.cwd()`.

## Cross-Platform Considerations

### PowerShell quoting for `inspect db`

- **PS 7.x**: Single quotes pass literal strings to external commands correctly. `--query 'SELECT "Ticket"."ticketNumber" FROM "Ticket" LIMIT 5'` works as expected.
- **PS 5.1**: Single quotes also work for external commands, but behavior can be inconsistent with complex nested quoting or when piping. The `--query-file` option is the recommended path for PS 5.1 with complex SQL.
- **Bash/Zsh**: Both single and double quotes work with appropriate escaping. No changes needed.
- **Help text strategy**: Document `--query` as the canonical form with PS-safe single-quote examples. Document `--query-file` as the recommended escape hatch for complex SQL or when shell quoting is problematic.

## Performance Expectations

| Operation | Expected Performance | Basis |
|-----------|---------------------|-------|
| `tickets list --search` | <100ms query time | 468 rows; ILIKE on unindexed `String` column; PostgreSQL full-table scan on small table |
| `tickets get` (run display fix) | No performance change | Same API call; different field name access in JS |
| `tickets continue --dry-run` | Faster than regular continue | No API call to rerun endpoint; exits after ticket resolution |
| `inspect db --query-file` | <10ms file read overhead | Single small file read; then same API call path |

## Dependencies

| Dependency | Type | Required By | Notes |
|------------|------|-------------|-------|
| Prisma `contains` + `mode: 'insensitive'` | Existing Prisma feature | Server search | No new dependency; Prisma 6.19.2 already supports this |
| `node:fs` `readFileSync` | Node.js built-in | CLI `--query-file` | Already imported in `config.ts`, `version.ts`; zero new dependencies |
| `hasFlag`, `getFlag` from `flags.ts` | Existing CLI utility | All CLI changes | Already used by all commands |

## Deferred to Round 2

- **Database index on `Ticket.title`**: If ticket volume grows beyond ~10K, add a trigram GIN index. Not needed at 468 tickets.
- **Expose `SandboxRun.createdAt` in API**: Server could return the run creation timestamp in addition to `startedAt`/`finishedAt`. Not in scope per ticket constraints.
- **Multi-field search**: Searching description, comments, or other fields. Out of scope per ticket.
- **Fuzzy/full-text search**: More sophisticated matching. Case-insensitive substring is sufficient per product requirements.
- **`--dry-run` JSON output mode**: Could add `--json` support to `--dry-run` output for agent contexts. Not needed for MVP.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ILIKE performance degrades at scale | Low (468 tickets) | Medium | Monitor ticket count; add GIN index if >10K |
| PS 5.1 edge cases with `--query` single quotes | Low | Low | `--query-file` is the fallback; documented as recommended for complex SQL |
| Dry-run flag accidentally bypassed in agent contexts | Low | High (wasted run) | Flag check is a simple boolean gate before the API call; hard to accidentally skip |
| `--query-file` path resolution edge cases | Low | Low | Use `process.cwd()` relative resolution; error on missing file |

## Summary Table

| Feature | Repos Changed | Files Changed (est.) | Migration | Risk |
|---------|--------------|---------------------|-----------|------|
| F1: `--search` | helix-cli, helix-global-server | 4 (list.ts, index.ts, controller, service) | None | Low |
| F2: Run display fix | helix-cli only | 1 (get.ts) | None | Low |
| F3: `--dry-run` | helix-cli only | 2 (continue.ts, index.ts) | None | Low |
| F4: PowerShell ergonomics | helix-cli only | 1 (inspect/index.ts) | None | Low |

All four features are independent and can be implemented in any order. F2 is the simplest (type + reference rename). F3 is a single flag gate. F4 adds one flag and help text. F1 is the only cross-repo change.

## APL Statement Reference

Diagnosis APL (helix-cli) confirmed: four independent issues with clear root causes. Field name mismatch (`createdAt`/`completedAt` vs `startedAt`/`finishedAt`) confirmed with production data. 468 tickets confirms ILIKE safety. All diagnosis followups resolved (followups=[]).

Diagnosis APL (helix-global-server) confirmed: single server change needed for search. No migration required. Run display is CLI-only. All followups resolved (followups=[]).

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Requirements, acceptance criteria, non-negotiables | Server-side search required; dry-run must not mutate; API response format out of scope |
| scout/scout-summary.md (helix-cli) | CLI-side analysis of all four issues | All four issues independent; field name mismatch confirmed; readFileSync pattern established |
| scout/scout-summary.md (helix-global-server) | Server-side analysis for search | Prisma contains + insensitive sufficient; no migration needed |
| scout/reference-map.json (helix-cli) | File map, facts, unknowns | 12 affected files identified; CLI is zero-dependency; queryParams pattern in hxFetch |
| scout/reference-map.json (helix-global-server) | Server file map and facts | Controller parses 4 params; service builds Prisma where clause; 468 tickets |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause confirmation with production evidence | createdAt/completedAt vs startedAt/finishedAt mismatch confirmed; formatDate handles undefined |
| diagnosis/diagnosis-statement.md (helix-global-server) | Server scope confirmation | Only search needs server change; run display is CLI-only |
| diagnosis/apl.json (helix-cli) | Detailed evidence for all four issues | Production run data confirms valid ISO dates; 468 tickets confirms ILIKE safety |
| diagnosis/apl.json (helix-global-server) | Server evidence | No search param exists; Prisma where clause needs title filter |
| product/product.md (helix-cli) | Product vision, features, success criteria | Four MVP features defined; design principles; open questions on dry-run output format |
| product/product.md (helix-global-server) | Server scope from product perspective | Only F1 (search) needs server change |
| repo-guidance.json | Repo intent | helix-cli primary target (all 4 issues); helix-global-server target (search only) |
| src/tickets/list.ts (code) | Current flag parsing and API call | queryParams built from flags; no --search; hxFetch handles params |
| src/tickets/get.ts (code) | Run display bug source | TicketDetail type has wrong field names; formatDate handles null/undefined |
| src/tickets/continue.ts (code) | Continuation flow | Unconditional POST at line 30; context assembled before API call |
| src/inspect/index.ts (code) | Inspect db flag handling and help text | --query flag exists; help has basic PS example; no --query-file |
| src/inspect/db.ts (code) | DB command implementation | Simple passthrough; query passed directly to API |
| src/lib/flags.ts (code) | Flag utility patterns | getFlag, hasFlag, getPositionalArgs -- all new flags use these |
| src/lib/http.ts (code) | HTTP client queryParams handling | URL.searchParams.set() for query params; standard pattern |
| ticket-controller.ts:190-213 (code) | Server handler | Parses 4 query params; no search |
| ticket-service.ts:1477-1556 (code) | Prisma query construction | findMany where clause; no title filter |
| ticket-service.ts:457-473 (code) | Server run field names | Returns startedAt/finishedAt correctly |
| prisma/schema.prisma (code) | Data model | Ticket.title is String; SandboxRun has startedAt/finishedAt/createdAt as separate fields |

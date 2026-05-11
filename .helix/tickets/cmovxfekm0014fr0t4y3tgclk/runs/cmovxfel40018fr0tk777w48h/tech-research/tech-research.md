# Tech Research — BLD-401

## Technology Foundation

- **Language**: TypeScript (strict mode, ES2022 target, Node16 modules)
- **Runtime**: Node.js >= 18 (built-in `node:fs`, `node:test`)
- **Build**: `tsc` (no bundler)
- **Test**: Node.js built-in test runner (`node --test`)
- **Dependencies**: Zero runtime dependencies; only `@types/node` and `typescript` as devDependencies
- **CLI pattern**: Manual switch-based dispatch in `src/tickets/index.ts`, shared utilities in `src/lib/`

No new dependencies are required. All needed Node.js APIs (`fs.readFileSync`, `fs.accessSync`, `fs.statSync`, `fs.constants`) are available in the existing Node.js >= 18 target.

## Architecture Decision

### Decision 1: Batch Repo Resolution

**Problem**: `--repos` accepts comma-separated values. The existing `resolveRepo()` calls `listRepos()` (HTTP GET) on every invocation. Calling it in a loop for N repos makes N identical API calls.

**Options considered**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Loop `resolveRepo()` | Call existing function for each repo entry | Zero new code; reuses proven function | N identical HTTP calls; first failure exits (user doesn't see all bad entries) |
| B. New `resolveAllRepos()` | Call `listRepos()` once, resolve all locally | 1 HTTP call; reports all unknown repos at once; better UX | New function in resolve-repo.ts |
| C. Add caching to `listRepos()` | Module-level cache so repeated calls are free | Transparent to callers | Global mutable state; cache invalidation concerns; over-engineering |

**Chosen**: **Option B** — Add `resolveAllRepos(config, namesOrIds[])` to `src/lib/resolve-repo.ts`.

**Rationale**: One API call regardless of repo count. All unknown entries are reported in a single error message, which is better UX than failing on the first unknown. The existing `resolveRepo()` function is unchanged (no impact on `inspect logs/db/api` callers). The new function throws an `Error` (not `process.exit`) so `create.ts` can catch it, format the message with the required `hlx inspect repos` reference, and exit cleanly.

### Decision 2: Description File Handling

**Problem**: Need `--description-file` flag, mutual exclusivity with `--description`, and file-path detection on `--description`.

**Options considered**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. `fs.readFileSync` (sync) | Read file synchronously | Simple; consistent with existing sync flag parsing | Blocks event loop (irrelevant for CLI) |
| B. `fs.promises.readFile` (async) | Read file asynchronously | Non-blocking | Adds unnecessary async complexity; flag parsing is already sync |
| C. Stream-based reading | Use `fs.createReadStream` | Handles large files | Over-engineered for 10KB max description |

**Chosen**: **Option A** — `fs.readFileSync(path, 'utf-8')`.

**Rationale**: The CLI is sequential. The server enforces a 10,000-character max on descriptions. Synchronous I/O is the simplest correct choice and consistent with the existing codebase (e.g., `config.ts` uses `readFileSync`).

### Decision 3: File-Path Detection on --description

**Problem**: If `--description` receives a value that is a readable file path, the CLI must not silently use the path string as the body.

**Options considered**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Fail with error | Detect readable file, exit with message directing to `--description-file` | Explicit; prevents silent data corruption | Rare false positive if description text matches an existing filename |
| B. Silently load file | Auto-read the file contents | Convenient | Implicit behavior; violates principle of least surprise |
| C. No detection | Keep current behavior | Zero effort | Fails AC2; tickets get file paths as body text |

**Chosen**: **Option A** — Detect and fail with error.

**Rationale**: Matches product direction (product.md OQ2: "fail-with-error directing to `--description-file`"). Implementation: `fs.accessSync(value, fs.constants.R_OK)` + `fs.statSync(value).isFile()` in a try-catch. If both pass, exit with: `Error: --description value appears to be a file path. Use --description-file <path> to load from a file.`

### Decision 4: Mutual Exclusivity Enforcement

**Problem**: `--description` / `--description-file` and `--file` / `--text` pairs must be mutually exclusive.

**Options considered**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Inline checks | Direct getFlag + if-else in each command | Simple; localized; clear | Minor repetition between create.ts and update-description.ts |
| B. Generic `requireExclusive()` helper | New utility in flags.ts | Reusable | Only two call sites; abstraction adds indirection for minimal gain |

**Chosen**: **Option A** — Inline checks in each command.

**Rationale**: Only two call sites exist (`create.ts` and `update-description.ts`), and their validation logic differs slightly (create has file-path detection; update-description does not need it since it uses `--file`/`--text` naming). A generic helper would be premature abstraction.

### Decision 5: update-description Subcommand Structure

**Problem**: No CLI surface exists for updating a ticket's description after creation.

**Options considered**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. New `update-description.ts` file | Follows one-file-per-subcommand convention | Consistent with existing pattern; easy to find | One more file |
| B. Add to existing file | Put logic in get.ts or create.ts | Fewer files | Breaks convention; harder to navigate |

**Chosen**: **Option A** — New `src/tickets/update-description.ts`.

**Rationale**: Every existing subcommand has its own file (`create.ts`, `get.ts`, `list.ts`, `rerun.ts`, etc.). Following this convention keeps the codebase navigable. The new case in `index.ts` follows the `extractTicketRef + resolveTicket + handler` pattern used by `get`, `rerun`, `continue`, `artifacts`, `artifact`, and `bundle`.

## Core API/Methods

### New: `resolveAllRepos(config: HxConfig, namesOrIds: string[]): Promise<string[]>`
- Location: `src/lib/resolve-repo.ts`
- Calls `listRepos(config)` once
- Resolves each entry using the same matching logic as `resolveRepo` (exact ID > exact displayName case-insensitive > partial displayName)
- Collects all unresolved entries
- On failure: throws `Error` with list of unknown entries + available repos (does NOT call `process.exit`)
- On success: returns `string[]` of resolved repository IDs in the same order as input

### New: `cmdTicketsUpdateDescription(config: HxConfig, ticketId: string, args: string[]): Promise<void>`
- Location: `src/tickets/update-description.ts`
- Accepts `--file <path>` or `--text <string>` (mutually exclusive, exactly one required)
- Reads file with `fs.readFileSync(path, 'utf-8')` if `--file`
- Calls `hxFetch(config, /tickets/${ticketId}, { method: "PATCH", body: { description }, basePath: "/api" })`
- Prints success confirmation with ticket ID

### Modified: `cmdTicketsCreate(config: HxConfig, args: string[]): Promise<void>`
- Location: `src/tickets/create.ts`
- Replace `requireFlag('--description')` with `getFlag('--description')` + `getFlag('--description-file')` + mutual exclusivity check
- Add file-path detection on `--description` value
- Replace raw `repositoryIds` pass-through with `resolveAllRepos(config, rawEntries)` call
- Update help text to reflect new flags and `--repos` semantics

### Modified: `runTickets(config: HxConfig, args: string[]): Promise<void>`
- Location: `src/tickets/index.ts`
- Add `case "update-description":` in switch block following existing pattern
- Update usage text to include `update-description` and new flags

## Technical Decisions

| # | Decision | Chosen | Rejected Alternatives | Rationale |
|---|----------|--------|----------------------|-----------|
| TD1 | Batch repo resolution | `resolveAllRepos()` — 1 API call, reports all errors | Loop `resolveRepo()` (N calls, fails on first); Cache `listRepos()` (global state) | Better UX + efficiency; no breaking changes to existing callers |
| TD2 | File I/O | `fs.readFileSync` (sync) | `fs.promises.readFile` (async); streams | CLI is sequential; 10KB max; consistent with codebase |
| TD3 | File-path detection | `accessSync` + `statSync().isFile()` then fail | Silent load; no detection | Matches product direction; explicit is better than implicit |
| TD4 | Mutual exclusivity | Inline checks per command | Generic `requireExclusive()` helper | Only 2 call sites; logic differs between them |
| TD5 | Subcommand file structure | Separate `update-description.ts` | Merge into existing file | Follows one-file-per-subcommand convention |
| TD6 | Batch resolve error contract | Throw Error (not process.exit) | process.exit like single resolveRepo | Lets create.ts format error with `hlx inspect repos` reference |
| TD7 | description requirement | Either --description or --description-file must be present | Keep requireFlag for --description | Must support both input methods; at-least-one check replaces single-flag require |

## Cross-Platform Considerations

- **File paths**: `fs.readFileSync` handles both POSIX and Windows paths natively. No path manipulation needed.
- **UTF-8 encoding**: Explicitly specified in `readFileSync(path, 'utf-8')`. No other encoding support required per ticket.
- **File permissions**: `fs.accessSync(path, fs.constants.R_OK)` works cross-platform for readability checks.

## Performance Expectations

- **Repo resolution**: Reduced from N API calls to 1 API call for N repos. Typical ticket creation uses 1-3 repos, so improvement is modest but eliminates the pathological case.
- **File reading**: Synchronous, bounded by 10,000-char server limit. Negligible latency.
- **Overall latency**: Dominated by the HTTP calls to the server (ticket creation, repo listing). No new API calls beyond the one `listRepos` call.

## Dependencies

| Dependency | Type | Status | Notes |
|------------|------|--------|-------|
| `node:fs` (readFileSync, accessSync, statSync, constants) | Node.js built-in | Available in Node >= 18 | Already used by config.ts in the project |
| `resolveRepo` / `listRepos` | Internal (`src/lib/resolve-repo.ts`) | Existing | Extended with new `resolveAllRepos` |
| `extractTicketRef` / `resolveTicket` | Internal (`src/lib/resolve-ticket.ts`) | Existing | Reused unchanged for update-description |
| `hxFetch` | Internal (`src/lib/http.ts`) | Existing | Already supports PATCH method |
| `getFlag` / `hasFlag` / `isHelpRequested` | Internal (`src/lib/flags.ts`) | Existing | Used unchanged |
| Server `PATCH /api/tickets/:ticketId` | External API | Existing | Already accepts optional `description` field |
| Server `GET /api/inspect/repositories` | External API | Existing | Used by `listRepos` for repo resolution |

**No new external dependencies required.**

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Inspect auth not available for some tokens | Low | `resolveAllRepos` fails for users who have standard auth but not inspect auth | Surface the `listRepos` error clearly. If this becomes a real issue in the future, add fallback to `GET /api/settings/repositories` (out of scope for this ticket). |
| R2 | File-path detection false positive | Very Low | A description string that matches an existing filename would be rejected | Error message directs user to `--description-file`, which is a valid workaround. Edge case is inherent to the ticket requirement. |
| R3 | Description exceeds 10,000 chars from file | Low | Server rejects with 400 | CLI passes through the server's validation error. No client-side size check needed (server is authoritative). |
| R4 | Server returns 409 for non-DRAFT/QUEUED tickets on update-description | Expected | User sees HTTP 409 error | CLI surfaces the server error message clearly. No client-side status pre-check needed (server is authoritative per product.md). |
| R5 | Partial displayName match resolves to wrong repo | Low | User's intended repo is not selected | The matching priority (exact ID > exact name > partial) already minimizes this. The `resolveAllRepos` error output lists all available repos for disambiguation. |

## Deferred to Round 2

- Editing other ticket fields (title, status, mode) via CLI
- Interactive `$EDITOR`-based description editing
- Batch ticket operations
- Repo resolution caching across multiple CLI invocations
- Fallback to `GET /api/settings/repositories` if inspect auth is unavailable
- Client-side description length validation (currently server-enforced only)

## Summary Table

| Area | Change | File(s) | Complexity |
|------|--------|---------|------------|
| Batch repo resolution | New `resolveAllRepos()` function | `src/lib/resolve-repo.ts` | Low |
| --repos integration | Replace raw pass-through with `resolveAllRepos` call | `src/tickets/create.ts` | Low |
| --description-file flag | Add flag, file reading, mutual exclusivity | `src/tickets/create.ts` | Medium |
| File-path detection | Detect readable file on --description, fail with error | `src/tickets/create.ts` | Low |
| update-description subcommand | New handler + switch case | `src/tickets/update-description.ts`, `src/tickets/index.ts` | Medium |
| Help text updates | Accurate --repos, --description-file, update-description | `src/tickets/create.ts`, `src/tickets/index.ts` | Low |
| Tests | Unit tests for resolveAllRepos and description validation | `src/lib/resolve-repo.test.ts`, `src/tickets/create.test.ts` | Medium |

**Total scope**: ~5 files modified, ~1-2 files created. CLI-only; no server changes.

## APL Statement Reference

All changes are CLI-only in helix-cli. The technical direction adds a batch `resolveAllRepos()` function (one API call for multi-repo resolution), inline mutual-exclusivity checks for `--description`/`--description-file`, synchronous file I/O via `fs.readFileSync`/`accessSync`/`statSync` for description file handling, and a new `update-description.ts` subcommand following the existing `extractTicketRef` + `resolveTicket` + handler pattern. No new dependencies are needed. No server changes are needed. APL completed with followups=[].

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Ticket requirements and acceptance criteria | Three defects with clear AC; --repos must reference hlx inspect repos in errors |
| diagnosis/apl.json (helix-cli) | Root cause findings and answered questions | All three defects are CLI-only; server has all needed endpoints; resolveRepo exists and is reusable |
| diagnosis/diagnosis-statement.md (helix-cli) | Detailed root cause analysis per defect | Fix directions: use resolveRepo for --repos, add --description-file with mutual exclusivity, add update-description subcommand |
| product/product.md (helix-cli) | Product vision, features, success criteria, open questions | Six MVP features; fail-with-error for file-path detection (OQ2); mutual exclusivity for --file/--text (OQ3); inspect auth risk noted (OQ1) |
| scout/scout-summary.md (helix-cli) | Code analysis and file mapping | Identified all relevant files; confirmed CLI-only scope; documented build/test signals |
| scout/reference-map.json (helix-cli) | Detailed file evidence and facts | Confirmed raw pass-through in create.ts:19-21; resolveRepo pattern at resolve-repo.ts:11-37; hxFetch PATCH support at http.ts:42 |
| repo-guidance.json (shared) | Repo intent classification | helix-cli = target; helix-global-server = context only (confirmed, no change needed) |
| src/tickets/create.ts | Direct code inspection | Lines 19-21: requireFlag for --description, raw repositoryIds split; no file handling |
| src/tickets/index.ts | Direct code inspection | Switch-based dispatch with 9 subcommands; no update-description; usage text at lines 14-29 |
| src/lib/resolve-repo.ts | Direct code inspection | resolveRepo calls listRepos per invocation; matching: exact ID > exact name > partial; process.exit on failure |
| src/lib/flags.ts | Direct code inspection | getFlag/requireFlag/hasFlag available; no mutual-exclusion helper |
| src/lib/resolve-ticket.ts | Direct code inspection | extractTicketRef + resolveTicket pattern for reuse by update-description |
| src/lib/http.ts | Direct code inspection | hxFetch supports arbitrary methods via options.method; basePath configurable |
| src/tickets/get.ts | Direct code inspection | TicketDetail type includes description; confirms AC4 verifiability |
| src/lib/config.ts | Direct code inspection | Uses readFileSync from node:fs; confirms fs module is already in use |
| src/lib/flags.test.ts | Direct code inspection | Node.js built-in test runner pattern (describe/it from node:test, strict assert) |
| package.json | Direct code inspection | Zero runtime deps; build=tsc; test=node --test; Node >= 18 |
| tsconfig.json | Direct code inspection | Strict mode; ES2022; Node16 modules; outDir=dist; rootDir=src |
| /tmp/helix-inspect/manifest.json | Runtime inspection availability check | DB/logs available for server; not needed for CLI-only technical direction |

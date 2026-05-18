# Tech Research: Ticket Relationship Support in hlx CLI

## Technology Foundation

- **Runtime**: Node.js with TypeScript (ES2022 target, Node16 module resolution, strict mode)
- **Build**: `tsc` compilation to `dist/`; no bundler
- **Test**: Node.js built-in test runner (`node --test`)
- **Dependencies**: Zero runtime dependencies; devDeps are `@types/node` and `typescript` only
- **Architecture**: Simple arg-router CLI with subcommand functions in `src/tickets/*.ts`, shared utilities in `src/lib/*.ts`, docs in `src/docs/` and `skill-content/`

No frameworks, no ORM, no database. The CLI is a thin client that resolves user inputs and calls the Helix server API via `hxFetch()`.

## Architecture Decision

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Inline resolve-then-use (chosen)** | Add flag parsing, resolution, and body inclusion directly in `create.ts`, following the existing `--repos` pattern | Minimal diff; follows established pattern; no new abstractions | Slightly longer function body |
| B. Extract `resolve-relationships.ts` module | Create a new module for relationship resolution logic | Encapsulation; testable in isolation | Adds indirection for 3 simple flag-resolve calls; no pattern precedent in codebase |
| C. Shared type definitions file | Create a `types.ts` for relationship types used across get/list | DRY types | Codebase uses local types per file; no shared types file exists; adds import complexity |

### Chosen: Option A — Inline resolve-then-use

**Rationale**: The existing `--repos` resolution in `create.ts` (lines 60-76) uses exactly this pattern: parse flag with `getFlag()`/`requireFlag()`, split on commas, resolve via utility function, catch errors, include in POST body. The three new relationship flags follow the identical flow, substituting `resolveTicket()` for `resolveAllRepos()`. Extracting a module would add indirection without reducing complexity for three independent `getFlag()` + `resolveTicket()` calls.

Each target file (`get.ts`, `list.ts`) already defines its own local types (`TicketDetail`, `TicketItem`). Extending these locally is consistent with the codebase style.

## Core API/Methods

| Utility | Location | Signature | Role |
|---------|----------|-----------|------|
| `getFlag()` | `src/lib/flags.ts:5` | `(args: string[], flag: string) => string \| undefined` | Parse optional flags |
| `resolveTicket()` | `src/lib/resolve-ticket.ts:86` | `(config, ref, options?) => Promise<{ id, shortId }>` | Resolve ticket references (ID, shortId, numeric) with active+archived fallback |
| `hxFetch()` | `src/lib/http.ts:37` | `(config, path, options?) => Promise<unknown>` | HTTP client with retry, error formatting |
| `buildErrorMessage()` | `src/lib/http.ts:28` | `(response: Response) => Promise<string>` | Formats error as `HTTP {status} {statusText} — {body text (500 chars)}` |

**Key detail**: `buildErrorMessage` uses an **em-dash** (` — `) separator, not a regular dash. Error extraction code must account for this: `HTTP 400 Bad Request — {"error":"Circular dependency detected."}`.

## Technical Decisions

### 1. Error Extraction from hxFetch

**Decision**: Parse JSON from the thrown Error.message after the em-dash separator; fall back to raw message.

**Approach**:
1. Catch the Error thrown by `hxFetch` for the POST call
2. Split `error.message` on ` — ` to extract the body portion
3. Attempt `JSON.parse()` on the body portion
4. If successful and `.error` field exists, display it: `Error: <server message>`
5. Fall back to `error.message` if parsing fails

**Rejected alternative**: Regex extraction (`/\{.*"error"\s*:\s*"([^"]+)"/`). While functional, JSON.parse is more robust for messages containing quotes or special characters in error text.

**Evidence**: `http.ts` line 34 confirmed em-dash separator. Server returns `{ "error": "message" }` for validation failures (research report Section 2, verified by scout).

### 2. Comma-Separated `--reference` Flag

**Decision**: Use comma-separated values, matching the existing `--repos` convention.

**Rejected alternatives**:
- Space-separated values: Ambiguous with positional args, requires shell quoting awareness
- Repeated `--reference` flags: `getFlag()` returns only the first occurrence; would require a new `getAllFlags()` utility

**Evidence**: `create.ts` line 62 uses `reposRaw.split(",").map(s => s.trim()).filter(s => s.length > 0)` for `--repos`.

### 3. Client-Side Max 5 Validation for `--reference`

**Decision**: Validate `--reference` count client-side before making any resolution API calls, failing fast with a clear error.

**Rationale**: The server enforces `referencedTicketIds.max(5)` in the Zod schema, but resolving 6+ references would waste API calls before the server rejects the request. Client-side validation provides faster feedback and avoids unnecessary network round-trips.

### 4. Sequential resolveTicket() Calls

**Decision**: Resolve each reference sequentially (not in parallel).

**Rationale**: `resolveTicket()` fetches the full active ticket list internally. The first call populates the list; subsequent calls re-fetch it. While `Promise.all()` parallelization is possible, the simplicity gain from sequential execution outweighs the marginal time savings. Ticket creation is not a hot path. Worst case: ~11 API calls for `--reference` with 5 values, completing in seconds.

**Deferred**: Batch resolution (fetch list once, call `matchTicket()` N times) can be added in Round 2 if performance feedback warrants it.

### 5. Direct Server Error Surfacing

**Decision**: Display server validation error messages as-is, without CLI-side rewording.

**Rationale**: Server messages are already human-readable and actionable:
- `"Circular dependency detected."`
- `"implementFromTicketId must reference a RESEARCH mode ticket."`
- `"referencedTicketIds contains a ticket that does not exist or belongs to a different organization: <id>"`

Maintaining a parallel set of CLI-side messages would create drift risk. The research report and diagnosis both confirm this approach.

### 6. Conditional Relationship Display (No Display When Absent)

**Decision**: Relationship lines in `printTicketDetail()` and `[after ...]` tag in list output appear only when data is present. Tickets without relationships display identically to current output.

**Rationale**: Preserves backward compatibility. Most tickets have no relationships, so displaying empty labels would add noise.

### 7. No New Tests in MVP

**Decision**: Rely on existing quality gates (`tsc --noEmit` + existing test suite) for MVP. New tests deferred to Round 2.

**Rationale**: The command functions (`create.ts`, `get.ts`, `list.ts`) have no existing tests. The utility layer (`resolveTicket`, `getFlag`) is well-tested (15+ tests). Adding mock-based command tests is valuable but increases scope. The primary risk (incorrect API payloads) is caught by server-side validation.

## Cross-Platform Considerations

Not applicable. The CLI is a Node.js application with no platform-specific code. All file I/O is for description reading (`--description-file`), which is unrelated to this change.

## Performance Expectations

| Operation | API Calls (Current) | API Calls (With Relationships) | Impact |
|-----------|--------------------|---------------------------------|--------|
| `tickets create` (no flags) | 1 POST | 1 POST (unchanged) | None |
| `tickets create --after <ref>` | N/A | 2-3 resolve + 1 POST | ~3-4 calls; acceptable |
| `tickets create --implement-from <ref>` | N/A | 2-3 resolve + 1 POST | ~3-4 calls; acceptable |
| `tickets create --reference <5 refs>` | N/A | 10 resolve + 1 POST | ~11 calls; acceptable (not hot path) |
| `tickets get <ref>` | 1 GET | 1 GET (unchanged) | None — relationship data already in response |
| `tickets list` | 1 GET | 1 GET (unchanged) | None — relationship data already in response |

**Key insight**: Display commands (`get`, `list`) require **zero additional API calls**. The server already includes relationship data in both detail and list endpoint responses.

## Dependencies

**No new dependencies.** The implementation uses only existing modules:
- `resolveTicket()` from `src/lib/resolve-ticket.ts`
- `getFlag()` from `src/lib/flags.ts`
- `hxFetch()` from `src/lib/http.ts`

The CLI maintains its minimal footprint: `@types/node` and `typescript` devDeps only.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Error message format assumption: `buildErrorMessage` em-dash separator may change | Low | Fall-back logic handles unparseable messages by displaying raw error. Extract approach is best-effort. |
| Server response field shape drift since research report | Low | Types use optional/nullable patterns; display sections conditionally check presence before rendering. |
| resolveTicket() API calls scale linearly with reference count | Low | Client-side cap of 5 references; worst case ~11 calls. Batch optimization deferred but straightforward (matchTicket is already a pure function). |
| No new tests for command functions | Medium | Existing utility tests + TypeScript compilation catch type errors. Server-side validation catches API payload errors. Integration testing during implementation review is recommended. |

## Deferred to Round 2

| Item | Rationale |
|------|-----------|
| Batch reference resolution for `--reference` | Sequential is acceptable; optimize only if users report slowness |
| Unit tests for create/get/list commands | No existing command tests; utility layer is well-tested |
| `tickets update` with relationship flags | Requires new server PATCH endpoint (separate feature) |
| Interactive ticket picker | UX enhancement; short IDs work for now |
| Dependency tree visualization (`tickets deps`) | New command; separate scope |

## Summary Table

| Aspect | Decision |
|--------|----------|
| Repo scope | `helix-cli` only (single-repo change) |
| Files changed | 7: `create.ts`, `get.ts`, `list.ts`, `index.ts`, `cli-content.ts`, `SKILL.md`, `commands.md` |
| New flags | `--after <ref>`, `--reference <ref1,ref2>`, `--implement-from <ref>` (all optional) |
| Architecture | Inline resolve-then-use pattern (matches existing `--repos`) |
| Resolution utility | `resolveTicket()` — existing, 15 tests, handles ID/shortId/numeric |
| Error handling | Parse JSON from em-dash-separated hxFetch Error.message; display server error directly |
| Display approach | Extend local types; conditional rendering; zero extra API calls |
| New dependencies | None |
| Quality gates | `tsc --noEmit` (typecheck) + `tsc && node --test dist/**/*.test.js` (existing tests) |
| New tests | Deferred to Round 2 |

## APL Statement

The technical approach follows helix-cli's established inline resolve-then-use pattern. Three optional flags (`--after`, `--reference`, `--implement-from`) are added to `tickets create` using `getFlag()` + `resolveTicket()`. `TicketDetail` and `TicketItem` types are extended with relationship fields from the server response. Conditional display rendering is added in `printTicketDetail()` and list output. Server validation errors are extracted from `hxFetch` Error.message by parsing JSON after the em-dash separator. No new modules, dependencies, or abstractions needed. Single-repo change in helix-cli touching 7 files. Server API and display endpoints are fully ready.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli run root) | Primary specification via Research Report section | Single-repo change: 3 new flags, display updates, 7 files. Server API fully ready. Detailed per-file specification provided. |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause and success criteria | Feature gap: relationship fields never implemented. 11 success criteria defined including typecheck and test pass. |
| `diagnosis/apl.json` (helix-cli) | Structured investigation answers | Confirmed: server API ready, resolveTicket() available, hxFetch error format supports extraction, single-repo scope. |
| `product/product.md` (helix-cli) | Product requirements and scope boundaries | MVP features defined. Out-of-scope items explicit (update command, batch creation, interactive picker). Key design principles: follow existing patterns, minimal surface area, server-authoritative validation. |
| `scout/scout-summary.md` (helix-cli) | Verified file inventory and reuse points | 7 target files confirmed against HEAD. Key reuse: resolveTicket (15 tests), getFlag, existing resolve-then-use pattern. |
| `scout/reference-map.json` (helix-cli) | Detailed facts, unknowns, and evidence | Verified: zero existing relationship support, server Zod schema, hxFetch error format (em-dash), no existing command tests. |
| `repo-guidance.json` | Repo intent classification | helix-cli=target, helix-global-server=context, helix-global-client=context. Confirmed single-repo change. |
| `src/tickets/create.ts` | Verified current POST body and pattern | Lines 89-93: body sends 4 fields only. Lines 60-76: resolve-then-use pattern is the template. Import of getFlag and resolveAllRepos already present. |
| `src/tickets/get.ts` | Verified TicketDetail type and display flow | Lines 5-23: type lacks relationship fields. Lines 47-87: printTicketDetail displays title through description, no relationship sections. Insertion point: after line 63 (approval), before line 65 (repositories). |
| `src/tickets/list.ts` | Verified TicketItem type and output format | Lines 5-13: type lacks relationship fields. Line 107: output line ends with `${approvalTag}`. Append `${afterTag}` after. |
| `src/tickets/index.ts` | Verified help text strings | Line 16 and line 73: create usage strings lack relationship flags. |
| `src/lib/resolve-ticket.ts` | Verified resolution utility API | Lines 86-167: resolveTicket(config, ref) returns { id, shortId }, throws Error. Already used in index.ts for get/rerun/continue. |
| `src/lib/flags.ts` | Verified flag parsing utility | Lines 5-9: getFlag returns string or undefined. Already imported in create.ts. |
| `src/lib/http.ts` | **Critical**: Verified error message separator | Line 34: uses em-dash ` — ` (not regular dash). Error extraction must account for this character. buildErrorMessage appends body text (500 chars max). |
| `src/docs/cli-content.ts` | Verified docs table structure | Lines 99-107: tickets create flags table has 5 rows. Need to add 3 new rows after --mode. Worked Examples section at line 168. |
| `skill-content/SKILL.md` | Verified agent skill structure | Lines 74-93: Ticket Management section has basic examples. Needs relationship examples. |
| `skill-content/references/commands.md` | Verified command reference | Line 56: Action Commands create entry is minimal. Needs expanded flags. |
| `/tmp/helix-inspect/manifest.json` | Checked runtime inspection availability | Available for helix-global-server (DATABASE, LOGS). Not needed for this CLI-only feature gap. |

# Tech Research — HLX-343: Add Explicit Mode Selection To `hlx tickets create`

## Technology Foundation

- **Language/Runtime**: TypeScript 6.x on Node.js >= 18 (ES2022 target, Node16 module resolution, strict mode)
- **Build system**: `tsc` via `npm run build`; quality gate is `npm run typecheck` (tsc --noEmit)
- **Package type**: ESM (`"type": "module"` in package.json, `.js` extension imports)
- **No test framework**: No jest/vitest/mocha; no test scripts; no lint. The sole quality gate is typecheck.
- **No external dependencies**: The CLI has zero production dependencies — only `@types/node` and `typescript` as devDependencies.

## Architecture Decision

### Options Considered

#### Option A: Inline validation in create.ts (chosen)
Add mode parsing, validation, and conditional body construction directly in `cmdTicketsCreate`. Define the allowed-modes array as a module-level constant in `create.ts`.

**Pros**: Follows existing codebase patterns exactly (repositoryIds validation is inline at L16-19). Minimal change surface — one file gets all the logic. No new abstractions.

**Cons**: If a second command later needs mode validation, the constant would need extracting. Acceptable tradeoff for a single-use feature.

#### Option B: New `validateEnum` utility in flags.ts
Create a reusable `validateEnum(value, allowedValues, flagName)` function in `src/lib/flags.ts`.

**Pros**: Reusable if future flags need enum validation.

**Cons**: Over-engineering for a single use case. No other command currently needs enum validation. Adds complexity to a utility file that currently has four simple functions. Violates the simplicity-first principle.

#### Option C: Separate modes.ts constants module
Extract allowed modes into a dedicated `src/tickets/modes.ts` module with type-safe enum or const array.

**Pros**: Clean separation of concerns.

**Cons**: One extra file for a 5-element constant array is unnecessary. No TypeScript enum needed — runtime validation against a plain array is sufficient since the mode is received as a CLI string and sent as a string to the API.

### Chosen: Option A — Inline validation in create.ts

**Rationale**: The diagnosis confirmed the change is isolated to `src/tickets/create.ts` (primary) and `src/tickets/index.ts` (usage text). Existing CLI patterns use inline validation — repositoryIds length check in create.ts L16-19, status comparison in list.ts L77. Adding a `VALID_MODES` const array at module scope in create.ts and validating inline is the most consistent and minimal approach. No new files, no new abstractions, no new exports.

## Core API/Methods

### Flag parsing (existing, no changes needed)
- `getFlag(args, "--mode")` → `string | undefined` — returns the value after the `--mode` flag, or `undefined` if absent (flags.ts L5-8)
- Already imported but unused in create.ts (L3) — just needs to be called

### HTTP layer (existing, no changes needed)
- `hxFetch(config, path, { method, body, basePath })` — body is `Record<string, unknown>` (http.ts L40), accepts any additional fields without modification
- `buildErrorMessage(response)` (http.ts L28-35) — already surfaces HTTP status + response text for backend errors, covering EXECUTE rejection on non-NetSuite orgs

### Mode validation (new, inline in create.ts)
- Const array `VALID_MODES = ["AUTO", "BUILD", "FIX", "RESEARCH", "EXECUTE"] as const`
- User input normalized via `.toUpperCase()` before validation
- Validation check: `VALID_MODES.includes(normalizedMode)`
- Error on invalid: `console.error()` + `process.exit(1)` with allowed values listed

### POST body construction (modified)
- Current: `{ title, description, repositoryIds }` (L21-24)
- New: conditionally add `mode` only when provided — spread pattern `...(mode && { mode })` or explicit conditional

### Response type (modified)
- Current `CreateTicketResponse.ticket` type: `{ id: string; shortId: string; status: string }`
- New: Add `mode?: string` (optional, since the backend response shape is unknown) and change `shortId` to `shortId?: string` (to fix the undefined guard)

## Technical Decisions

### Decision 1: Case normalization strategy
**Chosen**: `.toUpperCase()` on user input, validate against uppercase array.
**Rationale**: The ticket specifies case-insensitive input normalized to uppercase. The existing CLI uses `.toLowerCase()` for comparison (list.ts L77), but since mode values are sent as uppercase strings to the API, normalizing to uppercase is more natural and avoids a lowered-then-uppercased round-trip.
**Rejected alternative**: `.toLowerCase()` comparison then manual uppercase for sending — unnecessary conversion step.

### Decision 2: Conditional body inclusion pattern
**Chosen**: Build the body object and conditionally add `mode` using spread syntax: `...(mode && { mode })` or an equivalent `if (mode) body.mode = mode` approach.
**Rationale**: Both patterns are clean. The spread pattern is idiomatic TypeScript and keeps body construction in a single expression. The `if` approach is more explicit and matches the inline style of the codebase. Either is acceptable; implementation should choose whichever reads clearest in context.
**Rejected alternative**: Always sending `mode: undefined` — violates the ticket requirement to not include `mode` when the flag is omitted.

### Decision 3: shortId guard strategy
**Chosen**: Make `shortId` optional in the type (`shortId?: string`) and use nullish coalescing (`?? "(pending)"`) in the output.
**Rationale**: The type assertion `as CreateTicketResponse` at L25 bypasses runtime validation. Making `shortId` optional in the type and guarding in output is the minimal defensive fix the ticket requires. The fallback text `"(pending)"` or `"(not yet assigned)"` communicates the situation without confusion.
**Rejected alternative**: Adding runtime type validation (e.g., Zod schema) — over-engineering for this CLI. No other response types use runtime validation, and the ticket doesn't ask for it.

### Decision 4: Mode display in success output
**Chosen**: Add `mode` to success output only when present in the API response, using conditional print (same pattern as `data.run` check at L31-33).
**Rationale**: The ticket says "Print the ticket mode in the success output if the API response includes it." Since we don't know for certain the backend returns `mode`, making it conditional avoids printing `undefined`.

### Decision 5: No test framework bootstrapping
**Chosen**: Do not add a test framework. Quality gate remains `npm run typecheck`.
**Rationale**: The product definition explicitly places "Bootstrapping a test framework" out of scope. The ticket's "focused CLI tests or equivalent coverage" requirement is satisfied by typecheck as the equivalent coverage for a zero-dependency pure-TypeScript CLI. The code changes are small enough (one file primary, one file secondary) that static type checking provides adequate coverage of body construction and type correctness.

### Decision 6: No changes to top-level usage text (src/index.ts)
**Chosen**: Do not modify `src/index.ts` L25 usage text.
**Rationale**: The top-level usage is intentionally terse — it says `hlx tickets create|rerun|continue` without listing flags for any subcommand. Flag details are in `ticketsUsage()` in `src/tickets/index.ts`. Adding `--mode` only to the top-level usage would be inconsistent with how other commands' flags are documented.

## Cross-Platform Considerations

Not applicable. The CLI is a Node.js tool with no platform-specific code, no native modules, and no filesystem-dependent features in the scope of this change.

## Performance Expectations

No performance impact. The change adds:
- One `getFlag()` call (O(n) scan of args array, n < 20 in practice)
- One array `.includes()` check against 5 elements
- One additional string in the POST body (when mode is provided)

All operations are negligible relative to the HTTP round-trip.

## Dependencies

### Runtime dependencies
None. No new packages needed.

### Build dependencies
None. Existing TypeScript and @types/node are sufficient.

### Backend API dependency
- The backend `POST /api/tickets` already accepts an optional `mode` field (confirmed in ticket description)
- Unknown: exact response shape when `mode` is included — implementation must handle `mode` as optional in the response type
- Unknown: exact backend error format for EXECUTE rejection — `buildErrorMessage()` will surface whatever the backend returns (HTTP status + response text)

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Backend response may not include `mode` field | Medium | Low | Type `mode` as optional, display only when present |
| 2 | Backend may add new modes in the future | Low | Low | CLI allowed-values list must be updated manually; this is a known maintenance cost |
| 3 | `shortId` type change may have downstream effects | Very Low | Low | Only used in create.ts output; no other code references `CreateTicketResponse` |
| 4 | No runtime testing available | N/A | Low | Typecheck covers type-level correctness; manual testing covers runtime behavior |
| 5 | No runtime inspection to verify backend API contract | N/A | Low | Implementation should be defensive about all optional response fields |

## Deferred to Round 2

Nothing deferred. All technical decisions are resolved for this feature's scope.

## Summary Table

| Aspect | Decision |
|--------|----------|
| Files changed | `src/tickets/create.ts` (primary), `src/tickets/index.ts` (usage text) |
| Files unchanged | `src/lib/flags.ts`, `src/lib/http.ts`, `src/index.ts`, all other handlers |
| Validation approach | Inline in create.ts with `VALID_MODES` const array |
| Case handling | `.toUpperCase()` normalization before validation and sending |
| Body construction | Conditional spread or `if` to include `mode` only when provided |
| Response type | Add `mode?: string`, change `shortId` to optional |
| shortId guard | Nullish coalescing with descriptive fallback text |
| Mode display | Conditional print, same pattern as existing `data.run` check |
| Error pattern | `console.error()` + `process.exit(1)`, listing allowed values |
| Test framework | Not added (out of scope per product definition) |
| Quality gate | `npm run typecheck` (tsc --noEmit) |
| New dependencies | None |
| New files | None |

## APL Statement Reference

See `tech-research/apl.json` for the structured question-answer investigation and final statement.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification for required behavior, constraints, and acceptance criteria | Defines 5 allowed modes, case-insensitive input, conditional body inclusion, shortId fix, and explicit out-of-scope items (no test framework, no backend changes) |
| diagnosis/diagnosis-statement.md | Root cause analysis identifying the feature gap and shortId bug | Confirmed two distinct issues: missing `--mode` flag and unconditional shortId print; scoped change to 2 files |
| diagnosis/apl.json | Structured investigation with line-level evidence | Validated all diagnostic questions; confirmed `getFlag` import exists but is unused, body sends 3 fields, no enum validator, no test infra |
| product/product.md | Product definition with success criteria and scope boundaries | Confirmed backward compatibility requirement, fail-fast validation, no test framework bootstrapping, single-repo scope |
| scout/scout-summary.md | Code analysis with pattern references | Identified inline validation, case-insensitive comparison, error handling, and POST body patterns across list.ts, continue.ts |
| scout/reference-map.json | File map with line-level references and unknowns | Confirmed exact line numbers for body construction (L21-24), shortId output (L29), response type (L5-8), usage text (L33) |
| repo-guidance.json | Repo intent metadata | Confirmed helix-cli is sole target; no cross-repo impact |
| src/tickets/create.ts | Direct source of command handler | Verified 34-line function with body at L21-24, type at L5-8, shortId at L29, getFlag import at L3 |
| src/tickets/index.ts | Direct source of usage text and routing | Verified ticketsUsage() at L28-39 with create usage at L33 |
| src/lib/flags.ts | Direct source of flag utilities | Verified getFlag returns `string \| undefined` (L5-8), no enum validation utility |
| src/lib/http.ts | Direct source of HTTP client | Verified body type `Record<string, unknown>` (L40), error surfacing via buildErrorMessage (L28-35) |
| src/tickets/list.ts | Pattern reference for optional flags and case handling | Verified getFlag usage (L47,52,60) and toLowerCase comparison (L77) |
| src/tickets/continue.ts | Pattern reference for POST body with optional fields | Verified inline body construction (L24-27) |
| src/tickets/get.ts | Pattern reference for ticket display | Verified conditional field display pattern (L36-38 for mergeQueueStatus) |
| src/index.ts | Top-level usage text | Verified terse style — subcommands listed without flags (L24-26); no change needed |
| package.json | Build configuration and dependency list | Confirmed ESM, no test framework, only typecheck quality gate |
| tsconfig.json | TypeScript configuration | Confirmed strict mode, ES2022 target, Node16 module resolution |

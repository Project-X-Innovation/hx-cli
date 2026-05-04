# Tech Research: Add --run Selection to `hlx tickets artifacts` and Harden Missing Artifact Errors

## Technology Foundation

- **Language**: TypeScript (strict mode, ES2022 target, Node16 module resolution)
- **Module system**: ESM (`type: "module"` in package.json)
- **Runtime**: Node.js (built-in `fetch` API used via `hxFetch` wrapper)
- **Build**: `tsc` (no bundler)
- **Dependencies**: Zero runtime dependencies. Only `@types/node` and `typescript` as devDependencies.
- **Testing**: No test infrastructure exists (no test files, no CI, no lint config)

No new technology is introduced by this change. All modifications use existing utilities and patterns.

## Architecture Decision

### Options Considered

#### Option A: Pattern replication from sibling commands (Chosen)

Replicate the `--run` flag pattern from `artifact.ts` into `artifacts.ts`, and replicate the try-catch error handling pattern from `bundle.ts` into `artifact.ts`. Three files changed, zero new abstractions.

**Pros**: Minimal change surface, follows codebase conventions, easy to review, no risk to other commands.
**Cons**: Slight duplication of the getFlag/queryParams wiring across commands.

#### Option B: Shared `--run` resolution helper

Extract a shared helper function (e.g., `resolveRunId(args, config, ticketId)`) that both `artifact.ts` and `artifacts.ts` call.

**Pros**: Reduces duplication of the fallback logic.
**Cons**: Over-engineered for this scope. The `artifacts` command explicitly does NOT need fallback logic (product spec: "behavior stays as-is" when `--run` is omitted). The `artifact` command already has its own fallback. Extracting a shared helper for two different behaviors creates unnecessary indirection.

**Rejected**: The two commands have different `--run` semantics (required-with-fallback vs. optional-passthrough), so a shared helper would add complexity without real deduplication.

#### Option C: Structured error types in `hxFetch`

Introduce typed error classes (e.g., `HttpNotFoundError`) so callers can catch specific HTTP status codes cleanly.

**Pros**: Clean error handling architecture for the long term.
**Cons**: Architectural change affecting all callers of `hxFetch`. Far exceeds ticket scope. Product spec explicitly scopes error hardening to the `artifact` command call site, not a global behavior change.

**Rejected**: Out of scope. Noted as a future consideration in the product spec.

#### Option D: Global handler 404 detection

Modify the global catch at `src/index.ts:95-97` to detect 404-like errors and reformat them.

**Pros**: Catches all 404 errors from all commands.
**Cons**: String-matching on error messages is fragile. Different commands need different "not found" messages. Product spec explicitly scopes this out: "Changes to the global error handler: Error hardening is scoped to the artifact command call site."

**Rejected**: Fragile, overly broad, explicitly out of scope.

### Chosen: Option A — Pattern Replication

**Rationale**: Both defects have established fix patterns in adjacent sibling commands within the same file directory. The changes are small, isolated, and follow the principle of minimal impact. No new abstractions are warranted because the two commands have different `--run` semantics.

## Core API/Methods

All APIs are already in the codebase. No new APIs introduced.

| API | Location | Usage |
|-----|----------|-------|
| `getFlag(args, "--run")` | `src/lib/flags.ts:5-8` | Read `--run` flag value from CLI args. Returns `string \| undefined`. |
| `hxFetch(config, path, { queryParams })` | `src/lib/http.ts:37-134` | HTTP client. `queryParams` option passes key-value pairs as URL search params. |
| `resolveTicketId(rest)` | `src/tickets/index.ts:13-26` | Resolves ticket ID from `--ticket` flag, env var, or positional arg. Already used by the artifacts case. |

### Server endpoint contract (assumed)

- **Endpoint**: `GET /api/tickets/${ticketId}/artifacts`
- **Optional query param**: `runId` — When provided, scopes the artifact summary to a specific run.
- **Response shape**: `ArtifactsResponse` type defined in `artifacts.ts:4-15`.

Note: The query parameter name `runId` comes from the ticket description. This is not independently verified from CLI source. See Risks section.

## Technical Decisions

### 1. `--run` on `artifacts`: optional passthrough, no fallback

When `--run` is provided, pass `runId` as a query parameter to `hxFetch`. When omitted, make no change to the current behavior (no query param sent, server returns default response).

**Why no auto-resolve fallback**: The `artifact` command needs `runId` to construct its API path (`/tickets/${ticketId}/runs/${runId}/step-artifacts/${stepId}`). The `artifacts` command calls a different endpoint (`/tickets/${ticketId}/artifacts`) that works without `runId`. The product spec explicitly excludes auto-resolve: "If --run is omitted from artifacts, behavior stays as-is."

**Conditional queryParams construction**: Only include `runId` in the `queryParams` object when the value is present, to avoid sending `runId=undefined` as a query string. Pattern: build the params object conditionally, or spread only when defined.

### 2. 404 error handling: command-level try-catch

Wrap the `hxFetch` call in `artifact.ts` (lines 42-45) in a try-catch. On catch:
- Print a clean message: e.g., `No artifact found for step "${stepId}" in repo "${repoKey}".`
- Call `process.exit(1)`.

**Why command-level, not hxFetch-level**: `hxFetch` is a shared utility. Changing its error behavior would affect all callers. Expected 404s are contextual — the `artifact` command knows what was being looked for (step, repo) and can produce an informative message. The `bundle.ts` command already demonstrates this pattern (lines 68-71).

**Error message content**: Include the step and repo in the message so the user knows exactly what to adjust. This is more helpful than the raw `HTTP 404 Not Found — {"error":"No artifacts found..."}` that currently surfaces.

### 3. Usage text update

Add `[--run <runId>]` to the `artifacts` subcommand usage line at `src/tickets/index.ts:36`, changing it from:
```
hlx tickets artifacts <ticket-id>
```
to:
```
hlx tickets artifacts <ticket-id> [--run <runId>]
```

This matches the existing pattern for the `artifact` line at line 37.

## Cross-Platform Considerations

Not applicable. The CLI is a Node.js application using standard APIs (`fetch`, `URL`, `process`). No platform-specific behavior is involved.

## Performance Expectations

No performance impact. The changes add:
- One `getFlag` call (synchronous string array scan) to the `artifacts` command.
- One conditional property on the `queryParams` object.
- One try-catch wrapper around an existing async call in the `artifact` command.

All are negligible. No additional HTTP requests are introduced (unlike `artifact.ts`'s auto-resolve which fetches ticket detail — `artifacts.ts` does NOT add this).

## Dependencies

**No new dependencies.** All changes use existing utilities:

| Utility | Already imported by | Needs import in |
|---------|--------------------|-----------------| 
| `getFlag` from `src/lib/flags.ts` | `artifact.ts`, `index.ts` | `artifacts.ts` (new import) |
| `hxFetch` `queryParams` option | `artifact.ts`, `bundle.ts` | Already available in `artifacts.ts` |

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Server query param name is `run` not `runId` | Low | Wrong name would silently return unfiltered results (no error, just no filtering) | Ticket states "runId"; verify during manual testing. If wrong, the fix is a one-character rename. |
| 2 | Node assertion failure has a separate root cause beyond error propagation | Low | The try-catch fix prevents the error from reaching the global handler, which should eliminate the assertion trigger regardless of exact mechanism | The try-catch approach addresses the symptom path comprehensively; root cause investigation is not needed for this fix to work. |
| 3 | No automated tests to catch regressions | Medium | Future changes could break flag forwarding or error handling | Typecheck (`tsc --noEmit`) catches type-level issues. Test infrastructure is a separate future effort (out of scope per product spec). |

## Deferred to Round 2

These items are explicitly out of scope per the product spec and can be addressed in future tickets:

1. **`bundle.ts` run-scoped support**: `bundle.ts` also calls `/tickets/${ticketId}/artifacts` without `runId` (line 43). Adding `--run` there is a separate workflow concern.
2. **Structured error types in `hxFetch`**: Introducing typed error classes (e.g., `HttpNotFoundError`) would improve the error handling architecture but is an architectural change beyond ticket scope.
3. **Automatic run fallback on `artifacts`**: Auto-resolving to the latest run when `--run` is absent could be useful but is explicitly excluded.
4. **Test infrastructure**: No tests exist. Adding test coverage is a separate effort.

## Summary Table

| Aspect | Decision |
|--------|----------|
| **Approach** | Pattern replication from sibling commands |
| **Files changed** | `src/tickets/artifacts.ts`, `src/tickets/index.ts`, `src/tickets/artifact.ts` |
| **New dependencies** | None |
| **New abstractions** | None |
| **--run on artifacts** | Optional passthrough to server via queryParams; no auto-resolve fallback |
| **404 hardening** | Command-level try-catch in artifact.ts; clean message with step/repo context |
| **Usage text** | Add `[--run <runId>]` to artifacts subcommand line |
| **Build verification** | `tsc --noEmit` must pass |
| **Performance impact** | Negligible |
| **Risk level** | Low — all changes follow established patterns |

## APL Statement Reference

The technical approach for both defects follows established codebase patterns with no new abstractions or dependencies. Defect 1 (missing --run on artifacts) is solved by replicating the args-forwarding and flag-reading pattern from artifact.ts into artifacts.ts and its router call in index.ts. Defect 2 (noisy 404 on artifact) is solved by wrapping the hxFetch call site in a try-catch that prints a clean message, following the bundle.ts graceful error pattern. Both changes touch three files (artifacts.ts, artifact.ts, index.ts) using only existing utilities (getFlag, hxFetch queryParams). No new dependencies, no architectural changes, no changes to the shared HTTP layer or global error handler.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and requirements | Two defects: missing --run on artifacts, noisy 404 on artifact; server already supports runId query param |
| scout/reference-map.json | Detailed file-level evidence with line citations | Confirmed all seven relevant files, function signatures, missing args forwarding, error propagation path, and three unknowns |
| scout/scout-summary.md | High-level analysis and pattern catalog | Identified established patterns for --run flag (artifact.ts), error handling (bundle.ts), and args forwarding (index.ts) |
| diagnosis/apl.json | Structured root cause analysis with evidence chains | Confirmed two independent defects with line-level evidence; validated that both fixes follow existing patterns |
| diagnosis/diagnosis-statement.md | Root cause narrative and success criteria | Confirmed three-file change scope, five success criteria, and the contrast between working and broken sibling commands |
| product/product.md | Product spec with scope, features, and explicit exclusions | Defined: no auto-resolve on artifacts, no bundle.ts changes, no global handler changes, no test infrastructure |
| repo-guidance.json | Repository role classification | Confirmed helix-cli is the sole change target |
| src/tickets/artifacts.ts | Direct source inspection of primary change target | Verified: no args param (line 17), no queryParams (line 18), 42 lines total — small file |
| src/tickets/artifact.ts | Direct source inspection of reference pattern and error surface | Verified: --run pattern (lines 29-40), unguarded hxFetch call (lines 42-45), 59 lines total |
| src/tickets/index.ts | Direct source inspection of router and usage text | Verified: line 79 doesn't pass rest, line 36 missing --run, line 85 shows correct pattern |
| src/lib/http.ts | Direct source inspection of HTTP utility | Verified: queryParams support (lines 46-49), 404 → buildErrorMessage → throw (lines 101-103) |
| src/lib/flags.ts | Direct source inspection of flag parsing API | Verified: getFlag returns string \| undefined (line 5-8) |
| src/tickets/bundle.ts | Direct source inspection of graceful error pattern | Verified: try-catch at lines 68-71 with console.error warning |
| src/index.ts | Direct source inspection of global error handler | Verified: catch → console.error(error.message) → process.exit(1) at lines 95-97 |

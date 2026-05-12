# Tech Research — BLD-427

## Technology Foundation

- **Language**: TypeScript 6.x with strict mode (`tsconfig.json`)
- **Runtime**: Node.js >= 18 (ESM modules, `"type": "module"`)
- **Build**: `tsc` targeting ES2022 with Node16 module resolution
- **Test runner**: Node.js built-in test runner (`node --test`) with `describe`/`it`/`assert`
- **HTTP client**: Internal `hxFetch` wrapper (retries 3x with exponential backoff, throws on failure)
- **Dependencies**: Zero runtime dependencies; only `typescript` and `@types/node` as devDependencies
- **Quality gates**: `tsc --noEmit` (typecheck), `tsc && node --test dist/**/*.test.js` (test). No lint or format configured.

## Architecture Decision

### Options Considered

| # | Option | Description |
|---|--------|-------------|
| A | **Append combined empty block** (chosen) | Keep existing output blocks unchanged. Append a new block at the end of `cmdTicketsArtifacts` that checks `items.length === 0 && stepArtifactSummary.length === 0`, resolves the run ID, and prints the run ID + follow-up suggestion. |
| B | Restructure into unified control flow | Reorganize the function to detect the combined-empty case first, then branch into run-ID resolution before any output. |
| C | Add run-ID resolution as middleware/wrapper | Create a wrapper function or early guard that always resolves the run ID, passing it downstream. |

### Chosen Option: A — Append combined empty block

**Rationale**:
1. **Preserves byte-identical success-path output** (AC 3). By appending after the existing blocks, the success path (items or stepArtifactSummary non-empty) is structurally untouched.
2. **Smallest correct change**. Option B restructures working code unnecessarily. Option C introduces abstraction not warranted by a single use site.
3. **Run-ID resolution is only needed when both are empty**. Placing it in the combined empty block avoids an unnecessary API request when the response has artifacts (the common success case).
4. **Matches diagnosis recommendation**. The diagnosis statement explicitly identified this approach.

### Rejected Alternatives

- **Option B rejected**: Restructuring the function would touch every code path, increasing risk of regressions in the success path. The ticket explicitly states "Do not restructure the success-path output."
- **Option C rejected**: A wrapper/middleware pattern would add indirection for a one-time check and would unnecessarily fetch ticket detail even when the artifacts response is non-empty.

## Core API/Methods

### Existing APIs Used

| API | Purpose | Source |
|-----|---------|--------|
| `hxFetch(config, '/tickets/${ticketId}/artifacts', { basePath: '/api', queryParams })` | Fetch artifacts list (existing call, unchanged) | `src/tickets/artifacts.ts:20-23` |
| `hxFetch(config, '/tickets/${ticketId}', { basePath: '/api' })` | Fetch ticket detail to resolve run ID (new call, only in empty-result path) | Pattern from `src/tickets/artifact.ts:33` |
| `getFlag(args, '--run')` | Extract user-supplied `--run` flag value (existing call, reused) | `src/tickets/artifacts.ts:19` |

### Run-ID Resolution Pattern

The codebase has an established pattern used in two sibling commands:

```
const resp = await hxFetch(config, `/tickets/${ticketId}`, { basePath: "/api" }) as TicketResponse;
const ticket = resp.ticket;
const resolvedRunId = ticket.currentRun?.id ?? ticket.runs[0]?.id;
```

- **`artifact.ts` lines 32-35**: Uses this exact pattern.
- **`bundle.ts` lines 33-36**: Duplicates the same pattern.
- **`artifacts.ts`**: Will adopt the same pattern in the combined empty block.

### Local Types (Following Codebase Convention)

Both `artifact.ts` and `bundle.ts` define these types locally rather than in a shared module. The new code follows this convention:

```
type TicketDetail = {
  currentRun?: { id: string };
  runs: Array<{ id: string }>;
};

type TicketResponse = { ticket: TicketDetail };
```

## Technical Decisions

### 1. Variable reuse for `runId`

**Decision**: Reuse the existing `const runId = getFlag(args, '--run')` from line 19.

**Rationale**: This variable already holds the user-supplied `--run` value (or `undefined`). In the combined empty block:
- If `runId` has a value: use it directly (AC 2 — user-supplied value echoed exactly).
- If `runId` is `undefined`: fetch ticket detail to resolve.

**Constraint**: The existing `runId` is declared with `const` on line 19. The combined empty block needs a mutable binding for the resolution path. The implementation should use a new `let` variable (e.g., `let resolvedRunId = runId`) within the combined empty block, or restructure the existing declaration to `let`.

**Preferred approach**: Declare a new `let resolvedRunId` in the combined empty block initialized from the existing `runId`. This avoids changing the existing `const` declaration and keeps the scope of the mutable variable narrow.

### 2. Error handling for ticket-detail fetch

**Decision**: Wrap the ticket-detail `hxFetch` call in a try/catch. On catch, print a note about the unresolvable run ID and return normally.

**Rationale**: The ticket's Failure Behavior section is explicit:
- Must exit 0 (no `process.exit(1)`, no throw)
- Must print "No artifacts found." (already printed by existing block)
- Must print a single line noting the run ID could not be resolved
- Must not retry (hxFetch already retries internally; the catch handles final failure)

**Key difference from sibling patterns**: `artifact.ts` uses `process.exit(1)` on failure because the run ID is required for the primary operation. Here, the run ID is informational — failure to resolve is acceptable.

### 3. Follow-up suggestion format

**Decision**: Use the template specified in the ticket's Required Behavior #4:
```
Use: hlx tickets artifact <ticket-ref> --run <ACTUAL_RUN_ID> --step <stepId> --repo <repoKey>
```

**Rationale**: The ticket specification explicitly defines this format. Only `<runId>` is replaced with the actual resolved value. All other tokens (`<ticket-ref>`, `<stepId>`, `<repoKey>`) remain as placeholders for the user to fill in.

**Note**: The existing suggestion on line 43 uses `<ticket-id>` rather than `<ticket-ref>`. The new suggestion follows the ticket specification which says `<ticket-ref>`. This difference is intentional per specification.

### 4. No-runs handling

**Decision**: When `runId` is not user-supplied and the ticket has no runs (`ticket.currentRun` is absent and `ticket.runs` is empty), print a "no runs available" message with no follow-up suggestion.

**Rationale**: AC 4 explicitly requires this. Without a run ID, the follow-up command is not actionable.

### 5. Type duplication (not extracted)

**Decision**: Duplicate `TicketDetail`/`TicketResponse` types locally in `artifacts.ts`.

**Rationale**: This matches the existing codebase convention. The ticket scope excludes refactoring, and the product spec identifies shared utility extraction as a future consideration.

**Rejected alternative**: Extracting types to `src/tickets/types.ts` or `src/lib/types.ts`. This would be cleaner but exceeds ticket scope and touches other files unnecessarily.

### 6. Output structure for the combined empty case

**Decision**: The existing "No artifacts found." and "No step artifacts found." messages continue to print from their respective blocks. The new combined empty block appends additional lines after them.

**Expected output (run ID resolved)**:
```
No artifacts found.

No step artifacts found.

Run ID: <runId>
Use: hlx tickets artifact <ticket-ref> --run <runId> --step <stepId> --repo <repoKey>
```

**Expected output (no runs)**:
```
No artifacts found.

No step artifacts found.

No runs available for this ticket.
```

**Expected output (resolution failure)**:
```
No artifacts found.

No step artifacts found.

Could not resolve the run ID for this ticket.
```

**Rationale**: This additive approach preserves the existing output structure and only appends the new information. The "No artifacts found." message is already printed by the existing line 35 before the combined check runs.

## Cross-Platform Considerations

Not applicable. This is a Node.js CLI tool with no platform-specific code. The change involves only `console.log` output and an HTTP fetch.

## Performance Expectations

- **No performance regression for the success path**: The ticket-detail fetch only occurs in the combined-empty case when `--run` is not supplied. When artifacts are returned (the common case), no additional request is made.
- **One additional HTTP request in the worst case**: When both items and stepArtifactSummary are empty and `--run` is not supplied, one extra `GET /api/tickets/${ticketId}` request is made. This is the same request used by `artifact.ts` and `bundle.ts` in their normal flow.
- **Graceful timeout**: hxFetch has a 30-second timeout per attempt with 3 retries. In the worst case (resolution failure), the command may take up to ~90 seconds before printing the fallback message. This is acceptable since it only occurs in the error path.

## Dependencies

### No new dependencies

The change uses only existing imports and patterns:
- `hxFetch` from `../lib/http.js` (already imported)
- `getFlag` from `../lib/flags.js` (already imported)
- `HxConfig` type from `../lib/config.js` (already imported)
- New local types (`TicketDetail`, `TicketResponse`) follow existing convention

### Existing dependency inventory (unchanged)

| Dependency | Version | Role |
|------------|---------|------|
| `typescript` | ^6.0.2 | Build-time compiler |
| `@types/node` | ^25.5.0 | Node.js type definitions |

## Deferred to Round 2

| Item | Rationale |
|------|-----------|
| Extract shared `TicketDetail`/`TicketResponse` types | Types are duplicated across `artifact.ts`, `bundle.ts`, and now `artifacts.ts`. A shared module would reduce duplication. Deferred because it exceeds this ticket's scope and the codebase convention is local types. |
| Extract shared run-ID resolution utility | The `currentRun?.id ?? runs[0]?.id` pattern is duplicated in three files. A `resolveRunId(config, ticketId)` helper would centralize this. Deferred for same scope reasons. |
| Add unit tests for `cmdTicketsArtifacts` | No tests exist under `src/tickets/`. The existing test infrastructure (Node.js built-in test runner) supports it, but the function relies on `hxFetch` which would need mocking. Test coverage is a separate concern. |
| `--json` output mode | Product spec lists this as out of scope for MVP. |

## Summary Table

| Aspect | Decision |
|--------|----------|
| **Files changed** | `src/tickets/artifacts.ts` (single file) |
| **Approach** | Append combined empty-result block after existing output |
| **Run-ID source** | Reuse `getFlag(args, '--run')`; fallback to ticket-detail fetch |
| **Resolution pattern** | `ticket.currentRun?.id ?? ticket.runs[0]?.id` (established convention) |
| **Error handling** | try/catch around ticket-detail fetch; graceful note on failure |
| **Type approach** | Local `TicketDetail`/`TicketResponse` types (matches convention) |
| **Suggestion format** | `Use: hlx tickets artifact <ticket-ref> --run <runId> --step <stepId> --repo <repoKey>` |
| **New dependencies** | None |
| **Signature changes** | None (no changes to `cmdTicketsArtifacts` params or `index.ts` dispatch) |
| **Success-path impact** | Zero — byte-identical per AC 3 |

## APL Statement Reference

The technical direction is a single-file change to `src/tickets/artifacts.ts`. Append a combined empty-result block after the existing output blocks that: (1) reuses the existing `runId` variable from `getFlag`, (2) when `runId` is absent, fetches ticket detail via `GET /api/tickets/${ticketId}` wrapped in try/catch for graceful error handling, (3) resolves via `ticket.currentRun?.id ?? ticket.runs[0]?.id` matching the established codebase pattern, and (4) prints the run ID and a follow-up command suggestion. Local `TicketDetail`/`TicketResponse` types follow the duplication convention. No new dependencies, no signature changes, no shared utility extraction.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification — acceptance criteria, invariants, failure behavior, scope boundaries | 5 ACs define exact behavior. AC 2 (user-supplied --run echoed exactly) and AC 3 (success path byte-identical) are the key constraints. Failure behavior requires exit 0 with graceful note. |
| scout/reference-map.json | File inventory with line-level anchors for all relevant source files | Identified `artifacts.ts` as sole change target, confirmed run-ID resolution pattern in `artifact.ts:29-40` and `bundle.ts:33-39`, and noted `ArtifactsResponse` has no `runId` field. |
| scout/scout-summary.md | Synthesized code analysis | Confirmed single-file scope, routing boundary (rawRef not passed to artifacts), error handling constraint (hxFetch throws), and test coverage gap. |
| diagnosis/apl.json | Investigation questions and evidence-backed answers | Validated no signature change needed, follow-up should use placeholder tokens with only runId resolved, and try/catch is required around ticket-detail fetch. |
| diagnosis/diagnosis-statement.md | Root cause analysis and change scope | Confirmed root cause is missing code path in artifacts.ts. Change scope: combined empty check, run-ID resolution with try/catch, local types following convention. |
| product/product.md | Product requirements and design principles | Defined 6 essential features, confirmed single-file target, identified future considerations (shared utility extraction, --json mode). |
| repo-guidance.json | Repo intent context | Confirmed helix-cli is the sole target repo for this CLI-only change. |
| src/tickets/artifacts.ts (direct read) | Verified current implementation, empty-result output, and variable declarations | Line 19: `const runId = getFlag(args, '--run')` — reusable. Lines 34-35 and 44-45: existing empty messages. Line 43: existing suggestion format reference. |
| src/tickets/artifact.ts (direct read) | Verified run-ID resolution pattern and type definitions | Lines 5-10: local TicketDetail/TicketResponse types. Lines 29-40: getFlag + ticket-detail fallback pattern. |
| src/tickets/bundle.ts (direct read) | Confirmed pattern consistency across codebase | Lines 7-13: duplicate types. Lines 33-39: duplicate resolution logic. Establishes convention. |
| src/tickets/index.ts (direct read) | Verified router dispatch — only resolved.id passed, not rawRef | Line 119: `cmdTicketsArtifacts(config, resolved.id, rest)`. No signature change needed. |
| src/lib/http.ts (direct read) | Verified hxFetch throw behavior and retry semantics | Retries 3x with exponential backoff. Throws Error on final failure. 30s timeout per attempt. |
| src/tickets/get.ts (direct read) | Referenced for fuller TicketDetail type (runs array structure) | Lines 14-19: runs array has id, status, startedAt, finishedAt. Only id is needed for resolution. |
| package.json (direct read) | Build/test scripts and dependency inventory | Zero runtime deps. Quality gates: tsc --noEmit, tsc && node --test. |

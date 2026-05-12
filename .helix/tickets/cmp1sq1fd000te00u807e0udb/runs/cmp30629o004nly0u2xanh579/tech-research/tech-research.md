# Tech Research — BLD-430

## Technology Foundation

- **Language/Runtime:** TypeScript (strict mode, ES2022 target, Node16 module resolution)
- **Build:** `tsc` (TypeScript compiler)
- **Test runner:** `node --test` on compiled `.test.js` files
- **HTTP transport:** Custom `hxFetch` wrapper (`src/lib/http.ts`) with retry, timeout, and queryParams support
- **Flag parsing:** Custom `getFlag`/`requireFlag`/`hasFlag` utilities (`src/lib/flags.ts`)
- **No runtime dependencies:** Pure CLI tool, zero `dependencies` in package.json

## Architecture Decision

### Options Considered

**Option A: Always pass runId to artifact summary call (chosen)**

Pass the already-resolved `runId` as `queryParams: { runId }` to the artifact summary `hxFetch` call at `bundle.ts` line 43. The `runId` is resolved unconditionally at line 36 and validated at line 38, so it is guaranteed non-null. Additionally, add a `--run` flag so explicit override takes precedence over auto-resolution.

- Pros: Simplest change; mirrors how `runId` is already used for step-artifact fetches at line 55; always-pass is safe because `runId` is always resolved before the call.
- Cons: None identified. The server already handles `runId` on this endpoint (proven by `artifacts` command).

**Option B: Conditionally pass runId (like artifacts.ts)**

Use the conditional spread pattern from `artifacts.ts:20-22`: `...(runId ? { queryParams: { runId } } : {})`.

- Pros: Mirrors the exact pattern used by the sibling command.
- Cons: Unnecessary conditional — bundle already guarantees `runId` is non-null before the call (line 38 exits if null). The conditional adds complexity without value.
- **Rejected:** The guard at line 38 makes the conditional redundant. Always passing is cleaner.

**Option C: Add --run flag only, no auto-pass**

Add a `--run` flag to bundle but only pass `runId` when explicitly provided, leaving auto-resolved `runId` unused for the summary call.

- Pros: Gives users explicit control.
- Cons: Does not fix the default behavior. Users would have to always provide `--run` for non-active tickets, which defeats the purpose of auto-resolution.
- **Rejected:** Fails the core success criterion that bundle should work without extra flags when artifacts are reachable.

### Chosen Approach

**Option A** — always pass the auto-resolved (or flag-overridden) `runId` to the artifact summary endpoint. This is the smallest correct change and maintains consistency with how `runId` is already used within the same command.

### Rationale

- The `runId` is already resolved and validated before the artifacts summary call (`bundle.ts:36-40`).
- The same `runId` is already used for individual step-artifact fetches at line 55.
- The `hxFetch` transport already supports `queryParams` (`http.ts:46-49`).
- The server API already accepts `runId` on the artifacts summary endpoint (proven by `artifacts` command success).
- No new abstractions, dependencies, or architectural changes are needed.

## Core API/Methods

| API/Method | Location | Role in Fix |
|------------|----------|-------------|
| `hxFetch(config, path, options)` | `http.ts:37` | HTTP transport; `options.queryParams` appends query string parameters to URL |
| `getFlag(args, flag)` | `flags.ts:5` | Parses optional CLI flags; returns `string \| undefined` |
| `requireFlag(args, flag, errorMsg)` | `flags.ts:28` | Parses required CLI flags; exits on missing |
| `GET /api/tickets/:id` | Server API | Returns `TicketDetail` with `currentRun`, `runs` |
| `GET /api/tickets/:id/artifacts?runId=...` | Server API | Returns `stepArtifactSummary` array; requires `runId` for non-active statuses |
| `GET /api/tickets/:id/runs/:runId/step-artifacts/:stepId?repoKey=...` | Server API | Returns individual step artifact files |

## Technical Decisions

### 1. Pass runId unconditionally (not conditionally)

Unlike `artifacts.ts` which uses `...(runId ? { queryParams: { runId } } : {})`, the bundle command should always pass `runId` because:
- Bundle validates `runId` at line 38 and exits if null — it is guaranteed non-null.
- The conditional spread pattern adds syntactic noise without value.
- `runId` is already used unconditionally for step-artifact fetches at line 55.

### 2. Add --run flag with precedence over auto-resolution

The `--run` flag should follow the pattern from `artifact.ts`:
- Use `getFlag(args, "--run")` to read the optional flag.
- If provided, use the flag value as `runId`; otherwise, fall back to `ticket.currentRun?.id ?? ticket.runs[0]?.id`.
- This is different from `artifact.ts` which skips the ticket detail fetch entirely when `--run` is provided. In bundle, the ticket detail is still needed for `ticket.json` output, so only the `runId` value changes.

### 3. Import getFlag alongside requireFlag

`bundle.ts` line 5 already imports `requireFlag` from `flags.ts`. The `getFlag` function must be added to the same import statement. No new modules or dependencies.

### 4. Update usage string and help text in index.ts

- Line 27: Change `hlx tickets bundle <ticket-ref> --out <dir>` to `hlx tickets bundle <ticket-ref> --out <dir> [--run <runId>]`
- Line 136: Update the help text in the `case "bundle"` block to match.

### 5. No TicketDetail type expansion needed

The diagnosis noted that `bundle.ts`'s `TicketDetail` type lacks a `status` field. This is irrelevant to the fix because:
- The fix does not need to inspect ticket status.
- `runId` is passed unconditionally, regardless of status.
- Status-aware messaging is a future consideration, not MVP.

### 6. No new test file for bundle

The codebase has test files only for utility functions (`flags.test.ts`, `resolve-ticket.test.ts`). No command-level test patterns exist. Adding a bundle test would require mocking `hxFetch` and `fs` operations without an established mocking pattern. The product spec scopes testing to: "Build (tsc) and existing tests pass." Adding a test file is left as a future consideration.

## Cross-Platform Considerations

Not applicable. The CLI uses Node.js built-in modules (`fs`, `path`) with platform-agnostic APIs. The fix involves only query parameter changes to HTTP requests — no platform-specific behavior.

## Performance Expectations

- **No performance impact.** The fix adds a query parameter to an existing HTTP request. No additional API calls, no changed data volumes.
- The `--run` flag, when provided, does not skip the ticket detail fetch (it is still needed for `ticket.json`), so the request count remains the same.

## Dependencies

- **No new dependencies.** The fix uses only existing modules:
  - `getFlag` from `src/lib/flags.ts` (already exported, just not imported in bundle.ts)
  - `hxFetch` queryParams support in `src/lib/http.ts` (already used for step-artifact fetches)
- **Server API dependency:** The fix relies on `GET /api/tickets/:id/artifacts` accepting `runId` as a query parameter. This is confirmed by the working `artifacts` command (`artifacts.ts:20-22`).

## Deferred to Round 2

| Item | Rationale |
|------|-----------|
| Status-aware messaging | Low priority; `--run` flag provides explicit override for edge cases |
| TicketDetail type expansion with `status` field | Not needed for the fix; only relevant if status-conditional logic is added later |
| Bundle-specific unit/integration tests | No established command-level test patterns exist; adding a testing framework for commands is a separate initiative |
| Auto-detection of latest run with user notification | Product spec lists as future consideration; current fallback chain (`currentRun ?? runs[0]`) is adequate |

## Summary Table

| Aspect | Decision |
|--------|----------|
| **Root cause** | `bundle.ts:43` omits `runId` queryParam on artifact summary fetch |
| **Fix scope** | Client-side only; 2 files changed (`bundle.ts`, `index.ts`) |
| **Approach** | Always pass runId + add `--run` flag for explicit override |
| **runId passing** | Unconditional (not conditional spread) — runId is guaranteed non-null |
| **Flag pattern** | `getFlag(args, "--run")` with precedence over auto-resolved value |
| **Type changes** | None — TicketDetail type expansion not needed |
| **New tests** | None — no established command-level test pattern; existing tests must pass |
| **Dependencies** | Zero new; uses existing `getFlag` and `hxFetch` queryParams |
| **Regression risk** | Minimal — same pattern used by working `artifacts` command |
| **Files touched** | `src/tickets/bundle.ts`, `src/tickets/index.ts` |

## APL Statement Reference

The bundle command omits the runId query parameter when fetching the artifact summary from the server API. For non-active ticket statuses (PREVIEW_READY and others), the server requires this parameter to return populated stepArtifactSummary data. The fix is to always pass the auto-resolved (or flag-overridden) runId as queryParams to the artifacts summary call, and to add a --run flag for explicit run override matching sibling command patterns. Two files are changed: `src/tickets/bundle.ts` and `src/tickets/index.ts`. No server-side, cross-repo, or architectural changes are needed.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Problem statement, repro steps, expected behavior | PREVIEW_READY tickets return empty artifact summary without runId; sibling commands work with `--run`; bundle lacks equivalent |
| `scout/reference-map.json` | File inventory and per-file analysis | Confirmed bundle.ts:43 omits runId; artifacts.ts:20-22 includes it; identified all relevant files and types |
| `scout/scout-summary.md` | Consolidated code comparison | Confirmed the exact comparison between bundle, artifacts, and artifact commands showing the missing queryParams pattern |
| `diagnosis/diagnosis-statement.md` | Root cause analysis with code path trace | Root cause is missing queryParams on artifact summary call at bundle.ts:43; runId is resolved but unused for that call |
| `diagnosis/apl.json` | Structured diagnosis with evidence chains | Confirmed minimal fix is single-expression change; alternative causes disconfirmed; server API works correctly with runId |
| `product/product.md` | Product requirements and success criteria | MVP requires: always pass runId, add --run flag, preserve active-ticket behavior; server-side changes out of scope |
| `repo-guidance.json` | Repo intent classification | Confirmed helix-cli is sole target repo; no cross-repo changes needed |
| `src/tickets/bundle.ts` (direct read) | Primary bug file inspection | Confirmed line 43 has no queryParams; line 36 resolves runId; line 38 validates it; line 55 uses it for step artifacts |
| `src/tickets/artifacts.ts` (direct read) | Working comparison command | Confirmed line 20-22 pattern: conditional queryParams spread with runId |
| `src/tickets/artifact.ts` (direct read) | --run flag reference pattern | Confirmed getFlag pattern at line 29; fallback resolution at lines 32-39 |
| `src/tickets/index.ts` (direct read) | Usage strings and help text | Confirmed bundle usage at line 27 lacks --run; help text at line 136 needs update |
| `src/lib/flags.ts` (direct read) | Flag parsing utilities | Confirmed getFlag returns string \| undefined; suitable for optional --run flag |
| `src/lib/http.ts` (direct read) | HTTP transport | Confirmed queryParams support at lines 46-49; appends to URL via searchParams.set |

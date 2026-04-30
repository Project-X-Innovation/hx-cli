# Implementation Actual — HLX-343: Add Explicit Mode Selection To `hlx tickets create`

## Summary of Changes

Added an optional `--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>` flag to `hlx tickets create`. The CLI now parses, validates (case-insensitively), and conditionally includes the mode in the `POST /api/tickets` body. Also fixed the `shortId` output guard to prevent printing "Short ID: undefined" when the backend omits the field, and displays the ticket mode in success output when the API response includes it. Usage text updated to document the new flag.

## Files Changed

| File | Why Changed | Shared-Code / Review Hotspot |
|------|-------------|------------------------------|
| `src/tickets/create.ts` | Primary change target: added `VALID_MODES` constant, `--mode` parsing via `getFlag`, case-insensitive validation with fail-fast error, conditional body inclusion via spread, `shortId` guard with `?? "(pending)"`, conditional mode display in output, and updated `CreateTicketResponse` type to make `shortId` optional and add `mode` | Public interface: `cmdTicketsCreate` signature unchanged. POST body shape changes (adds optional `mode` field). Response type broadened — downstream consumers unaffected since type is module-local. |
| `src/tickets/index.ts` | Updated `ticketsUsage()` function to document the new `--mode` flag with all 5 allowed values in the create usage line | Usage text only — no logic changes. |

## Steps Executed

### Step 1: Update `CreateTicketResponse` type
- Made `shortId` optional (`shortId?: string`)
- Added `mode?: string` to the `ticket` object

### Step 2: Add `VALID_MODES` constant and parse `--mode` flag
- Added `const VALID_MODES = ["AUTO", "BUILD", "FIX", "RESEARCH", "EXECUTE"] as const;` at module level (line 10)
- Added `const modeRaw = getFlag(args, "--mode");` inside `cmdTicketsCreate` (line 23)

### Step 3: Add mode validation with error handling
- Declared `let mode: string | undefined` (line 24)
- When `modeRaw` provided: normalize with `.toUpperCase()`, validate against `VALID_MODES` using `.includes()` (lines 25-32)
- Invalid values trigger `console.error` with allowed values list followed by `process.exit(1)` before API call

### Step 4: Update POST body to conditionally include `mode`
- Changed body from `{ title, description, repositoryIds }` to `{ title, description, repositoryIds, ...(mode && { mode }) }` (line 36)
- When `mode` is undefined, spread produces nothing — body is identical to original

### Step 5: Fix `shortId` output guard
- Changed `data.ticket.shortId` to `data.ticket.shortId ?? "(pending)"` (line 42)
- Prevents "Short ID: undefined" when backend omits field

### Step 6: Add `mode` to success output
- Added conditional mode display: `if (data.ticket.mode) { console.log(...) }` (lines 44-46)
- Follows existing conditional pattern used for `data.run` display

### Step 7: Update usage text
- Updated `ticketsUsage()` create line in `src/tickets/index.ts` (line 33) to include `[--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>]`

### Step 8: Run quality gate
- `npm run typecheck` — passed with exit code 0
- `npm run build` — passed with exit code 0

## Verification Commands Run + Outcomes

| Command | Exit Code | Result |
|---------|-----------|--------|
| `npm install` | 0 | Dependencies installed, `prepare` script ran `tsc` successfully |
| `npm run typecheck` | 0 | `tsc --noEmit` passed — no type errors |
| `npm run build` | 0 | `tsc` compiled successfully, output in `dist/` |

## Test/Build Results

- **Typecheck**: PASS — `tsc --noEmit` exit code 0, no errors
- **Build**: PASS — `tsc` exit code 0, compiled JavaScript produced in `dist/`
- **Unit tests**: N/A — no test framework exists in this repo (confirmed by package.json: no test script, no test dependencies)

## Deviations from Plan

None. All 8 steps executed exactly as planned.

## Known Limitations / Follow-ups

1. **No automated test coverage**: The repo has no test framework. Mode validation, body construction, and output formatting are verified by typecheck and code inspection only. The ticket acknowledges this ("focused CLI tests or equivalent coverage").
2. **Runtime API behavior not tested**: Cannot verify actual API calls without a running backend. The implementation follows the existing `hxFetch` pattern exactly.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | **pass** | `npm run typecheck` exited with code 0, output: `tsc --noEmit` with no errors |
| CHK-02 | **pass** | `npm run build` exited with code 0, output: `tsc` completed successfully |
| CHK-03(a) | **pass** | `src/tickets/create.ts` line 10: `const VALID_MODES = ["AUTO", "BUILD", "FIX", "RESEARCH", "EXECUTE"] as const;` — exactly 5 modes |
| CHK-03(b) | **pass** | `src/tickets/create.ts` line 23: `const modeRaw = getFlag(args, "--mode");` — uses existing `getFlag` utility |
| CHK-03(c) | **pass** | `src/tickets/create.ts` lines 26-27: `const normalized = modeRaw.toUpperCase();` then `(VALID_MODES as readonly string[]).includes(normalized)` |
| CHK-03(d) | **pass** | `src/tickets/create.ts` lines 28-29: `console.error(...)` with allowed values message followed by `process.exit(1)`, both before the `hxFetch` call at line 34 |
| CHK-03(e) | **pass** | `src/tickets/create.ts` line 36: `...(mode && { mode })` — spread only adds `mode` when defined; when `mode` is undefined, no `mode` key in body |
| CHK-03(f) | **pass** | `src/tickets/create.ts` line 6: `shortId?: string; mode?: string;` — both optional in `CreateTicketResponse` |
| CHK-03(g) | **pass** | `src/tickets/create.ts` line 42: `data.ticket.shortId ?? "(pending)"` — nullish coalescing prevents "undefined" |
| CHK-03(h) | **pass** | `src/tickets/create.ts` lines 44-46: `if (data.ticket.mode) { console.log(...) }` — conditional, only prints when truthy |
| CHK-04 | **pass** | `src/tickets/index.ts` line 33: `hlx tickets create --title <title> --description <desc> --repos <repo1,repo2> [--mode <AUTO\|BUILD\|FIX\|RESEARCH\|EXECUTE>]` — all 5 modes shown as optional |
| CHK-05 | **pass** | Verified by re-reading `src/lib/flags.ts`, `src/lib/http.ts`, `src/index.ts` — all unchanged. Only `src/tickets/create.ts` and `src/tickets/index.ts` were edited via the Edit tool. |

All required checks pass. Self-verification is complete.

## APL Statement Reference

The implementation plan for adding `--mode` to `hlx tickets create` was executed in 8 steps modifying exactly two files. All behavioral requirements (5-mode validation, case-insensitive input, conditional body inclusion, shortId guard, mode output, usage text) are implemented and verified by typecheck, build, and code inspection.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | Defines 5 allowed modes, case-insensitive input, conditional body inclusion, shortId fix, 10 acceptance criteria |
| implementation-plan/implementation-plan.md | Step-by-step execution guide | 8 atomic steps, 2 target files, verification plan with 5 required checks |
| implementation-plan/apl.json | Structured planning Q&A | Confirmed sequencing (Steps 1+5 together), 2-file scope, validation pattern, body construction, shortId guard |
| diagnosis/diagnosis-statement.md | Root cause analysis | Feature gap (not bug), two issues (missing --mode + shortId guard), scoped to 2 files |
| src/tickets/create.ts | Direct source — primary target | 34-line handler: body at L21-24, type at L5-8, shortId at L29, getFlag imported at L3 |
| src/tickets/index.ts | Direct source — usage text | ticketsUsage() at L28-39 with create usage at L33 |
| src/lib/flags.ts | Utility verification | getFlag returns `string \| undefined` — sufficient, no changes needed |
| src/lib/http.ts | HTTP layer verification | body typed as `Record<string, unknown>` — accepts mode field without changes |
| package.json | Build config and quality gates | Scripts: build (tsc), typecheck (tsc --noEmit); no test framework |

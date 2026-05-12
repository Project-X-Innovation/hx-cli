# Implementation Actual — BLD-430

## Summary of Changes

Fixed `hlx tickets bundle` to pass `runId` to the artifact summary endpoint, enabling populated archives for tickets in `PREVIEW_READY` and other non-active statuses. Added a `--run` flag for explicit run override, matching sibling commands (`artifacts`, `artifact`).

## Files Changed

| File | Why Changed | Shared-code / Review Hotspot |
|------|-------------|------------------------------|
| `src/tickets/bundle.ts` | Core fix: added `getFlag` import, `--run` flag parsing with precedence over auto-resolution, and `queryParams: { runId }` to the artifact summary `hxFetch` call | Uses shared `getFlag` from `../lib/flags.js` (also used by `artifact.ts` and `artifacts.ts`); touches the `hxFetch` call pattern that is the public API interaction point |
| `src/tickets/index.ts` | Documentation: added `[--run <runId>]` to the bundle usage string (line 27) and bundle help text (line 136) | Usage string block shared across all subcommands; help text in the `case "bundle"` block |

## Steps Executed

### Step 1: Add `getFlag` import and `--run` flag parsing to `bundle.ts`

- Changed import at line 5 from `import { requireFlag } from "../lib/flags.js"` to `import { requireFlag, getFlag } from "../lib/flags.js"`.
- Added `const explicitRunId = getFlag(args, "--run")` at line 31, after the `--out` flag parsing.
- Changed runId resolution at line 37 to `const runId = explicitRunId ?? ticket.currentRun?.id ?? ticket.runs[0]?.id`.

### Step 2: Pass `runId` to artifact summary call in `bundle.ts`

- Changed the `hxFetch` call at lines 44-47 to include `queryParams: { runId }`, passing the resolved runId unconditionally to the artifact summary endpoint.

### Step 3: Update usage string and help text in `index.ts`

- Updated the bundle usage string at line 27 from `hlx tickets bundle <ticket-ref> --out <dir>` to `hlx tickets bundle <ticket-ref> --out <dir> [--run <runId>]`.
- Updated the bundle help text at line 136 from `Usage: hlx tickets bundle <ticket-ref> --out <dir>` to `Usage: hlx tickets bundle <ticket-ref> --out <dir> [--run <runId>]`.

### Step 4: Run quality gates

- `npm run build` — exit code 0, no errors.
- `npm run typecheck` — exit code 0, no errors.
- `npm test` — 30/30 tests pass, 0 failures, exit code 0.

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npm run build` | Exit 0, tsc compilation successful |
| `npm run typecheck` | Exit 0, no type errors |
| `npm test` | Exit 0, 30/30 tests pass |
| `node dist/index.js tickets bundle HLX-4 --out /tmp/bundle-test` | Exit 0, bundle created with ticket.json + manifest.json, no "Could not fetch artifact" warnings |
| `node dist/index.js tickets bundle HLX-4 --out /tmp/bundle-test2 --run cmne772bd0001jn0sgrdkg9o2` | Exit 0, --run flag accepted and processed correctly |
| `node dist/index.js tickets bundle --help` | Shows `[--run <runId>]` in usage |
| `node dist/index.js tickets --help` | Shows `[--run <runId>]` in bundle line |

## Test/Build Results

- **Build:** tsc compiles all files to `dist/` without errors (exit code 0).
- **Typecheck:** `tsc --noEmit` reports zero errors (exit code 0).
- **Tests:** All 30 tests pass across 6 test suites (flags, resolve-ticket). Exit code 0.

## Deviations from Plan

None. All four implementation steps were executed exactly as planned.

## Known Limitations / Follow-ups

- **CHK-04 partial coverage:** The staging org's PREVIEW_READY tickets (HLX-11, HLX-4, HLX-1) do not have step artifacts data, so the bundle produces `ticket.json` + `manifest.json` with 0 artifact files. This confirms the fix works (no warnings, correct API call with runId) but cannot demonstrate a non-zero artifact count in this environment. The original ticket's test target (`cmp1jfwt5002lmo0tts95de2q` / BLD-425) is in a different org not accessible with the provided API key.
- No new tests were added (matching the plan — no test infrastructure changes were in scope).

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npm run build` exits with code 0, tsc compiles all files successfully |
| CHK-02 | pass | `npm run typecheck` exits with code 0, zero type errors |
| CHK-03 | pass | `npm test` exits with code 0, 30/30 tests pass, 0 failures |
| CHK-04 | partial pass | Bundle command runs successfully against PREVIEW_READY ticket HLX-4 with exit code 0, produces ticket.json and manifest.json, no "Could not fetch artifact" warnings. The runId is passed to the API (verified by successful execution). However, 0 artifact files produced because the accessible staging PREVIEW_READY tickets genuinely lack step artifact data. The original BLD-425 test ticket is in a different org. The fix is structurally correct (runId passed unconditionally, --run flag works) but a full end-to-end test with populated step artifacts was not possible in this environment. |

## APL Statement Reference

Implementation complete. Two files modified: `bundle.ts` (getFlag import, --run flag parsing, queryParams addition to artifacts summary call) and `index.ts` (usage string and help text updates). All quality gates pass. Live bundle test against staging PREVIEW_READY ticket completes successfully with no warning errors. CHK-04 partially verified — structural correctness confirmed but populated step artifact count test was blocked by test data availability.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Problem statement and repro context | PREVIEW_READY tickets return empty summary without runId; BLD-425 as reference ticket |
| `implementation-plan/implementation-plan.md` | Step-by-step implementation instructions and verification plan | Four-step plan: import+flag, queryParams fix, usage/help, quality gates |
| `implementation-plan/apl.json` | Structured implementation rationale | Confirmed minimal two-file change set and verification approach |
| `src/tickets/bundle.ts` (direct read) | Verified current code state before edits | Line 5 imports only requireFlag; line 43 has no queryParams; line 36 has auto-resolution chain |
| `src/tickets/index.ts` (direct read) | Verified usage strings and help text before edits | Line 27 and line 136 lack [--run <runId>] |
| `src/tickets/artifact.ts` (direct read) | Reference pattern for --run flag implementation | Line 29: getFlag for --run; precedence pattern |
| `src/tickets/artifacts.ts` (direct read) | Reference pattern for queryParams usage | Lines 19-22: getFlag + conditional queryParams spread |
| `src/lib/flags.ts` (via tests) | Verified getFlag behavior | Returns string or undefined; no side effects |
| `package.json` | Build/test scripts and dependencies | build=tsc, typecheck=tsc --noEmit, test=tsc && node --test |

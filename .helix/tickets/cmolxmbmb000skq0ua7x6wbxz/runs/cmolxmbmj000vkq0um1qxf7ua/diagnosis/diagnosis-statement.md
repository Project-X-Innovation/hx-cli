# Diagnosis Statement

## Problem Summary

Two independent defects prevent clean artifact inspection in the helix-cli:

1. **`hlx tickets artifacts` ignores `--run <runId>`**: The `cmdTicketsArtifacts` function accepts only `(config, ticketId)` with no args parameter. The subcommand router does not pass CLI args to it. The `hxFetch` call uses no query parameters. As a result, the `runId` query parameter that the server already supports is never forwarded, and users cannot request artifact summaries for a specific run.

2. **`hlx tickets artifact` 404 triggers noisy error**: When a step artifact does not exist, the server returns 404. The `hxFetch` utility builds an error message from the response body and throws. With no try-catch at the call site in `artifact.ts`, this error propagates to the global catch handler at `src/index.ts:95-97`, which logs the raw HTTP error message and calls `process.exit(1)`. This produces confusing output and may trigger Node assertion failures during exit cleanup.

## Root Cause Analysis

### Defect 1: Missing --run support in `artifacts` command

**Root cause**: The function signature of `cmdTicketsArtifacts` (`src/tickets/artifacts.ts:17`) does not accept an `args` parameter. The subcommand router (`src/tickets/index.ts:79`) calls it as `cmdTicketsArtifacts(config, ticketId)` without forwarding the `rest` args array. The `hxFetch` call at line 18 passes no `queryParams` option.

**Contrast with working sibling**: The `artifact` command (`src/tickets/artifact.ts:19`) correctly accepts `args: string[]`, the router at line 85 passes `rest`, and the command uses `getFlag(args, "--run")` to read the flag.

**Three changes needed**:
- `src/tickets/artifacts.ts`: Add `args: string[]` parameter, import and call `getFlag(args, "--run")`, pass `runId` as `queryParams` to `hxFetch` when present.
- `src/tickets/index.ts:79`: Pass `rest` to `cmdTicketsArtifacts`.
- `src/tickets/index.ts:36`: Add `[--run <runId>]` to the usage text for the `artifacts` subcommand.

### Defect 2: Missing 404 error handling in `artifact` command

**Root cause**: `cmdTicketsArtifact` calls `hxFetch` at lines 42-45 with no try-catch. When the server returns 404 for a missing step artifact, `hxFetch` reads the response body via `buildErrorMessage` (`src/lib/http.ts:28-34`) and throws `new Error(message)`. This propagates to the global catch at `src/index.ts:95-97`, producing a raw error like `HTTP 404 Not Found — {"error":"No artifacts found..."}`.

**Contrast with working sibling**: The `bundle` command (`src/tickets/bundle.ts:68-71`) wraps individual artifact fetch calls in try-catch and prints a clean warning message on failure.

**One change needed**:
- `src/tickets/artifact.ts`: Wrap the `hxFetch` call at lines 42-45 in a try-catch. On 404/error, print a clean user-facing message (e.g., "No artifact found for step X in repo Y") and exit gracefully rather than letting the raw HTTP error propagate.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| `src/tickets/artifacts.ts:17` | Function signature lacks `args` parameter |
| `src/tickets/artifacts.ts:18` | `hxFetch` call has no `queryParams` |
| `src/tickets/index.ts:79` | Router does not pass `rest` to `cmdTicketsArtifacts` |
| `src/tickets/index.ts:36` | Usage text for `artifacts` does not show `--run` |
| `src/tickets/artifact.ts:42-45` | `hxFetch` call with no error handling |
| `src/tickets/artifact.ts:29-40` | Reference pattern for `--run` flag support |
| `src/lib/http.ts:6` | 404 not in `RETRYABLE_STATUS_CODES` |
| `src/lib/http.ts:101-103` | Non-retryable errors → `buildErrorMessage` → throw |
| `src/tickets/bundle.ts:68-71` | Reference pattern for graceful 404 handling |
| `src/index.ts:95-97` | Global catch logs raw error message, calls `process.exit(1)` |
| `/tmp/helix-inspect/manifest.json` | Not present — no runtime inspection available |

## Success Criteria

1. `hlx tickets artifacts <ticket-id> --run <runId>` forwards the `runId` as a query parameter to the server and returns run-specific artifact summaries.
2. `hlx tickets artifacts <ticket-id>` (without `--run`) continues to work as before, returning the default summary.
3. `hlx tickets artifact <ticket-id> --step <step> --repo <repo>` for a missing artifact returns a clean, human-readable error message and exits with code 1 — no raw HTTP error text, no Node assertion failure.
4. Usage text for `hlx tickets artifacts` shows the `[--run <runId>]` option.
5. `tsc --noEmit` passes with no type errors.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and requirements | Two defects: missing --run on artifacts, noisy 404 on artifact |
| scout/reference-map.json | Detailed file-level analysis from scout | Confirmed all relevant files and line-level root causes |
| scout/scout-summary.md | High-level analysis summary with patterns | Identified established patterns for both --run and error handling |
| src/tickets/artifacts.ts | Direct inspection of primary change target | Confirmed: no args param, no queryParams — root of defect 1 |
| src/tickets/artifact.ts | Direct inspection of error surface and reference | Confirmed: no try-catch at lines 42-45, --run pattern at 29-40 |
| src/tickets/index.ts | Direct inspection of router and usage text | Confirmed: line 79 doesn't pass rest, line 36 missing --run |
| src/lib/http.ts | Direct inspection of HTTP error handling | Confirmed: 404 → buildErrorMessage → throw Error path |
| src/lib/flags.ts | Direct inspection of flag parsing API | Confirmed: getFlag returns string or undefined |
| src/tickets/bundle.ts | Direct inspection of graceful error pattern | Confirmed: try-catch pattern at lines 68-71 |
| src/index.ts | Direct inspection of global error handler | Confirmed: catch → console.error → process.exit(1) |

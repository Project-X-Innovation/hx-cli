# Implementation Plan: helix-cli — Four CLI Ergonomics Improvements

## Overview

Four independent CLI changes: (1) add `--search` flag to `tickets list` passing a server-side query param, (2) fix run display in `tickets get` by correcting field name mismatch, (3) add `--dry-run` flag to `tickets continue`, (4) add `--query-file` to `inspect db` and improve PowerShell help text. All changes are isolated, low-risk, and use existing utility patterns. No new runtime dependencies.

## Implementation Principles

- Follow established flag-parsing patterns: use `getFlag()` for value flags, `hasFlag()` for boolean flags from `src/lib/flags.ts`.
- Zero new runtime dependencies: helix-cli must remain dependency-free. Use only `node:fs` built-in (already used in other modules).
- No behavior regressions: all existing command invocations must work identically.
- Each feature is independent: implement and verify in isolation.
- Smallest correct change per feature.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| S1 | Fix run display field names in `tickets get` | Updated `TicketDetail` type and field references in `src/tickets/get.ts` |
| S2 | Add `--dry-run` flag to `tickets continue` | Updated `src/tickets/continue.ts` with dry-run gate; updated help text in `src/tickets/index.ts` |
| S3 | Add `--search` flag to `tickets list` | Updated `src/tickets/list.ts` with search query param; updated help text in `src/tickets/index.ts` |
| S4 | Add `--query-file` and improved help to `inspect db` | Updated `src/inspect/index.ts` with `--query-file` support and PS-safe help examples |
| S5 | Quality gates | Pass typecheck, build, and tests |

## Detailed Implementation Steps

### Step S1: Fix run display field names in `tickets get`

**Goal**: Correct the `TicketDetail` type to use the server's actual field names (`startedAt`/`finishedAt`) instead of the wrong names (`createdAt`/`completedAt`), so run timestamps and status display correctly.

**What to Build**:
- File: `src/tickets/get.ts`
- Update the `TicketDetail.runs` array type (lines 14-19):
  - Change `createdAt: string` to `startedAt: string`
  - Change `completedAt: string | null` to `finishedAt: string | null`
- Update `printTicketDetail` (lines 70-73):
  - Change `run.createdAt` to `run.startedAt` in the `formatDate()` call
  - Change `run.completedAt` to `run.finishedAt` in the `formatDate()` call
- No changes to the `formatDate` function itself — it already handles `null`/`undefined` correctly.

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes.
- `npm run build` succeeds.
- Build the CLI and run `node dist/index.js tickets get <ticket-with-succeeded-run> --json` against the staging API to confirm JSON output includes `startedAt`/`finishedAt` with ISO date values.
- Run `node dist/index.js tickets get <ticket-ref>` (formatted output) and confirm timestamps render as locale date strings, not `in progress` or `Invalid Date`.

**Success Criteria**:
- `TicketDetail.runs` type uses `startedAt` and `finishedAt`.
- Formatted output shows real date strings for runs with valid `startedAt`/`finishedAt`.
- Runs with null `startedAt` show `in progress` (existing behavior for non-terminal).
- SUCCEEDED runs show their actual `finishedAt` date, not `N/A`.

### Step S2: Add `--dry-run` flag to `tickets continue`

**Goal**: Allow previewing the continuation payload without starting a run.

**What to Build**:
- File: `src/tickets/continue.ts`
  - Add `hasFlag` to the import from `../lib/flags.js` (currently imports `getPositionalArgs`, `isHelpRequested`).
  - After the continuation context validation (line ~28) and before the API call (line ~30), add a dry-run check:
    ```
    if (hasFlag(args, "--dry-run")) {
      console.log("Dry run — no run will be started.\n");
      console.log(`Ticket ID:  ${ticketId}`);
      console.log(`Endpoint:   POST /api/tickets/${ticketId}/rerun`);
      console.log(`Body:       ${JSON.stringify({ continuationContext }, null, 2)}`);
      process.exit(0);
    }
    ```
  - The `--dry-run` flag must prevent the API call entirely — no POST, no side effects.
- File: `src/tickets/index.ts`
  - Update the usage string for `continue` (line ~22): add `[--dry-run]` to the usage line.
  - Update the `continue` case help text (line ~88): add `[--dry-run]` and explain it previews without running.
- File: `src/tickets/continue.ts`
  - Update the inline help text (line ~11): add `[--dry-run]` to the usage line.

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes.
- `npm run build` succeeds.
- Run `node dist/index.js tickets continue <ref> "test context" --dry-run` — should print payload and exit 0 without making an API call.
- Run `node dist/index.js tickets get <same-ref>` — confirm no new run was created.

**Success Criteria**:
- `--dry-run` prints ticket ID, endpoint, and body then exits 0.
- No API call is made in dry-run mode.
- Without `--dry-run`, behavior is identical to current (regression-safe).
- Help text for `continue` includes `--dry-run`.

### Step S3: Add `--search` flag to `tickets list`

**Goal**: Pass a `search` query parameter to the server for server-side title filtering.

**What to Build**:
- File: `src/tickets/list.ts`
  - The `getFlag` import already exists (line 3).
  - After existing flag parsing (after line ~64, before the API call), add:
    ```
    const search = getFlag(args, "--search");
    if (search) {
      queryParams.search = search;
    }
    ```
  - This passes `search` as a query parameter to `GET /api/tickets`. The server applies the filter. No client-side filtering needed.
- File: `src/tickets/index.ts`
  - Update the usage string for `list` (line ~17): add `[--search <text>]` to the usage line.
  - Update the `list` case help text (line ~42): add `[--search <text>]`.

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes.
- `npm run build` succeeds.
- Run `node dist/index.js tickets list --search "<known-title-fragment>"` — should return matching tickets.
- Run `node dist/index.js tickets list --search "zzz-no-match-xyz"` — should print "No tickets found." without error.
- Run `node dist/index.js tickets list --search "<text>" --json` — should return valid JSON array.

**Success Criteria**:
- `--search` is passed as a server query param (not client-side filtered).
- Composes with `--json`, `--archived`, `--status-not-in`, `--sprint`, `--user`.
- Empty results return cleanly (no error).
- Help text for `list` includes `--search`.

**Cross-repo note**: This step depends on helix-global-server having the `search` query parameter implemented (S1-S2 in the server plan). The server change must be deployed or running locally for end-to-end testing.

### Step S4: Add `--query-file` and improved help to `inspect db`

**Goal**: Add `--query-file <path>` to read SQL from a file (bypassing shell quoting), and improve help text with PowerShell-safe examples using quoted Postgres identifiers.

**What to Build**:
- File: `src/inspect/index.ts`
  - Add `import { readFileSync } from "node:fs";` at the top.
  - In the `inspectUsage()` function (lines 8-23), update the usage and examples:
    - Add `hlx inspect db --repo <name> --query-file <path>` usage line.
    - Expand the PowerShell example to show quoted identifiers (`"Ticket"."ticketNumber"`).
    - Add `--query-file` as recommended for PS 5.1 or complex SQL.
  - In the `db` case (lines 43-62):
    - Update the `--help` output (lines 45-53) to include `--query-file` and enhanced PS examples.
    - After existing flag parsing (line ~57-58), add `--query-file` handling:
      ```
      const queryFileFlag = getFlag(rest, "--query-file");
      ```
    - Priority order: `--query-file` > `--query` > positional.
    - If `queryFileFlag` is present, read the file via `readFileSync(queryFileFlag, "utf8").trim()`. If the file doesn't exist or result is empty, print an error and exit 1.
    - Update `getPositionalArgs` exclude list to include `"--query-file"`.
  - The query resolution becomes:
    ```
    let query: string;
    if (queryFileFlag) {
      query = readFileSync(queryFileFlag, "utf8").trim();
      if (!query) { console.error("Error: query file is empty."); process.exit(1); }
    } else {
      query = queryFlag ?? positional.join(" ");
    }
    ```

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes.
- `npm run build` succeeds.
- Create a test SQL file: `echo 'SELECT "Ticket"."ticketNumber" FROM "Ticket" LIMIT 5' > /tmp/test-query.sql`
- Run `node dist/index.js inspect db --repo <name> --query-file /tmp/test-query.sql` — should execute the query.
- Run `node dist/index.js inspect db --help` — should show `--query-file` and PowerShell examples.
- Run `node dist/index.js inspect db --repo <name> --query 'SELECT 1'` — should still work (regression).

**Success Criteria**:
- `--query-file` reads SQL from file and passes to API.
- Priority: `--query-file` > `--query` > positional.
- Missing/empty file produces a clear error.
- Help text includes `--query-file` and PowerShell examples with quoted Postgres identifiers.
- Existing `--query` and positional invocations unchanged.

### Step S5: Quality gates

**Goal**: Confirm all changes pass quality checks.

**What to Build**: No new code — run quality checks.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — must pass with zero errors.
- `npm run build` — must succeed (tsc compiles to dist/).
- `npm run test` — all existing tests must pass (`node --test dist/**/*.test.js`).

**Success Criteria**:
- All quality gates pass.
- No new runtime dependencies added.
- Existing tests remain green.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js runtime | available | Dev setup config; `npm run dev` on port 3000 | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06, CHK-07, CHK-08, CHK-09, CHK-10 |
| `.env` file with HELIX_API_KEY and HELIX_URL | available | Dev setup config provides both values pointing to staging server | CHK-04, CHK-05, CHK-06, CHK-07, CHK-08, CHK-09, CHK-10 |
| npm dependencies installed | available | `npm install` in helix-cli | CHK-01, CHK-02, CHK-03 |
| helix-global-server search endpoint deployed or running locally | available | Server plan adds `search` query param; staging or local dev server on port 4000 | CHK-07, CHK-08 |
| A ticket with a SUCCEEDED run in the target environment | available | Diagnosis confirmed SUCCEEDED runs exist with valid timestamps via production DB | CHK-04, CHK-05, CHK-06 |
| A ticket reference for dry-run testing | available | Any existing ticket can be used for dry-run testing | CHK-09, CHK-10 |

### Required Checks

[CHK-01] TypeScript typecheck passes.
- Action: Run `npm run typecheck` in helix-cli.
- Expected Outcome: Exit code 0 with no type errors.
- Required Evidence: Command output showing `tsc --noEmit` completes without errors.

[CHK-02] Build succeeds.
- Action: Run `npm run build` in helix-cli.
- Expected Outcome: Exit code 0; `dist/` directory populated with compiled JS files.
- Required Evidence: Command output showing `tsc` completes without errors.

[CHK-03] Existing tests pass.
- Action: Run `npm run test` in helix-cli.
- Expected Outcome: All existing tests pass (flags.test.js, resolve-ticket.test.js, etc.).
- Required Evidence: Test runner output showing pass count and zero failures.

[CHK-04] Run display shows correct status for SUCCEEDED runs.
- Action: Build the CLI (`npm run build`). Run `node dist/index.js tickets get <ticket-ref-with-succeeded-run>` against the configured staging API (HELIX_URL from dev setup `.env`).
- Expected Outcome: The formatted output shows the run status matching the actual API status (e.g., `SUCCEEDED`), not `in progress`. The start timestamp column shows a locale date string, not `in progress` or `Invalid Date`.
- Required Evidence: Command output showing the run line with a real date in the start column and correct status.

[CHK-05] Run display shows correct timestamps for completed runs.
- Action: Run `node dist/index.js tickets get <ticket-ref-with-succeeded-run> --json` against the staging API.
- Expected Outcome: JSON output contains `startedAt` and `finishedAt` fields with ISO date string values (not `undefined` or `null` for a completed run).
- Required Evidence: Command output excerpt showing the runs array with `startedAt` and `finishedAt` values present as date strings.

[CHK-06] Run display handles absent timestamps gracefully.
- Action: Run `node dist/index.js tickets get <ticket-ref-with-queued-or-running-run>` against the staging API. If no such ticket is available, verify via `--json` output that a run with null `startedAt` would be handled.
- Expected Outcome: Runs with null `startedAt` display `in progress` (non-terminal) or a placeholder, never `Invalid Date`.
- Required Evidence: Command output showing the run line with a placeholder for absent timestamps.

[CHK-07] Search flag returns matching tickets.
- Action: Build the CLI. Run `node dist/index.js tickets list --search "<known-title-fragment>"` against the staging API (where the server search endpoint is deployed).
- Expected Outcome: Output lists tickets whose titles contain the search fragment. At least one ticket matches.
- Required Evidence: Command output showing one or more ticket rows with titles containing the search text.

[CHK-08] Search flag returns empty result without error.
- Action: Run `node dist/index.js tickets list --search "zzz-no-match-xyz-999"` against the staging API.
- Expected Outcome: Output is `No tickets found.` with exit code 0, no error message.
- Required Evidence: Command output showing `No tickets found.` and exit code 0.

[CHK-09] Dry-run prints payload and exits without starting a run.
- Action: Build the CLI. Run `node dist/index.js tickets continue <ticket-ref> "test dry run context" --dry-run` against the staging API.
- Expected Outcome: Output shows the ticket ID, endpoint (`POST /api/tickets/{id}/rerun`), and body (`{ continuationContext: "test dry run context" }`). Exit code 0. No run is started.
- Required Evidence: Command output showing the dry-run preview with ticket ID, endpoint, and body. Then run `node dist/index.js tickets get <same-ref> --json` and show that no new run was created after the dry-run.

[CHK-10] `--query-file` reads SQL from file and `--help` shows PowerShell examples.
- Action: Create a test SQL file with content `SELECT 1 AS test`. Run `node dist/index.js inspect db --help` to verify help text includes `--query-file` and PowerShell examples with quoted identifiers. Then run `node dist/index.js inspect db --repo <valid-repo> --query-file <path-to-test-file>` against the staging API.
- Expected Outcome: Help output includes `--query-file` option and at least one PowerShell example with `"Ticket"` or similar quoted Postgres identifiers. The `--query-file` command reads the file and executes the query (or returns an API error if the repo/table is not accessible, which is acceptable — the point is that the file was read and passed to the API).
- Required Evidence: Help text output showing `--query-file` and PowerShell example. Command output from the `--query-file` invocation showing the query was submitted (success response or API-level error, not a CLI-level "file not found" or "no query" error).

## Success Metrics

- Run display in `tickets get` shows real timestamps and correct status for all run states.
- `tickets list --search` filters server-side and composes with `--json` and other flags.
- `tickets continue --dry-run` previews payload and exits with zero side effects.
- `inspect db --query-file` reads SQL from file; help shows PowerShell-safe examples.
- All existing invocations continue to work identically.
- Zero new runtime dependencies.
- All quality gates pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Requirements, acceptance criteria, non-negotiables | Server-side search; dry-run must not mutate; existing --query unchanged |
| scout/scout-summary.md (helix-cli) | CLI analysis of all four issues | Field name mismatch confirmed; all four issues independent; readFileSync pattern established |
| scout/reference-map.json (helix-cli) | File map with line numbers | 12 files mapped; exact insertion points for each change identified |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause confirmation with production evidence | createdAt/completedAt vs startedAt/finishedAt mismatch; formatDate handles undefined |
| diagnosis/apl.json (helix-cli) | Detailed evidence for all four issues | Production data confirms valid ISO dates; 468 tickets; flag patterns |
| product/product.md (helix-cli) | Feature specs F1-F4, success criteria | Four MVP features; cross-shell compatibility; dry-run safety |
| tech-research/tech-research.md (helix-cli) | Architecture decisions AD1-AD4 | Prisma contains for search; CLI type update for runs; hasFlag for dry-run; readFileSync for query-file |
| tech-research/apl.json (helix-cli) | Technical decisions and rationale | Human-readable dry-run output; query-file > query > positional priority; no new deps |
| repo-guidance.json | Repo intent | helix-cli is primary target for all 4 issues |
| src/tickets/get.ts (code) | Run display bug source | TicketDetail type declares wrong field names; formatDate logic verified |
| src/tickets/list.ts (code) | Current flag parsing and API call | queryParams pattern; getFlag already imported; insertion point after line 64 |
| src/tickets/continue.ts (code) | Continuation flow | Unconditional POST at line 30; context assembled before API call; insertion point clear |
| src/tickets/index.ts (code) | Help text and routing | All usage strings and help text need updating for --search, --dry-run |
| src/inspect/index.ts (code) | Inspect db flag handling | --query flag exists at line 57; help text at lines 45-53; no --query-file |
| src/lib/flags.ts (code) | Flag utility API | getFlag returns string; hasFlag returns boolean; getPositionalArgs excludes flags |

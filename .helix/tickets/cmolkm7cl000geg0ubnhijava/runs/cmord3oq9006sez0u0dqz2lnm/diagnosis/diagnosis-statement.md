# Diagnosis Statement

## Problem Summary

The Helix CLI ticket commands (`get`, `artifacts`, `artifact`, `rerun`, `continue`, `bundle`) return HTTP 404 when given short IDs (e.g., `BLD-339`) or numeric ticket numbers (e.g., `339`), despite these tickets being visible in `hlx tickets list`. Five additional defects compound the usability problem: subcommand `--help` flags fail or execute normal behavior, no `--json` output mode exists for agent consumption, run timestamps render as "Invalid Date", the ticket list text output omits internal IDs, and `inspect db` has no safe input path for PowerShell users with Postgres double-quoted identifiers.

## Root Cause Analysis

### RC-1: Raw ticket ID passthrough (primary cause of 404s)

`resolveTicketId()` in `src/tickets/index.ts` (lines 13-26) extracts the raw user input from `--ticket` flag, `HELIX_TICKET_ID` env, or first positional arg and returns it unchanged. This raw string is interpolated directly into API URL paths like `/tickets/${ticketId}`. The API expects internal CUID-format IDs, so any other format returns 404.

All 7 ticket subcommands that accept a ticket reference use this raw-passthrough pattern. A duplicate `resolveTicketId()` in `src/comments/index.ts` (lines 6-14) has the same defect.

The fix is a new shared resolver module (pattern: `src/lib/resolve-repo.ts`) that fetches `/api/tickets` and matches client-side by:
1. Internal ID (exact match against `item.id`)
2. Short ID (case-insensitive match against `item.shortId`, e.g., "BLD-339")
3. Numeric ticket number (extract number from `item.shortId` suffix and match, e.g., "339" matches "BLD-339")

This approach is proven by `src/tickets/latest.ts:44-45` which already fetches the list endpoint and uses `data.items[0].id` to call `printTicketDetail()`, confirming the list endpoint returns internal IDs.

### RC-2: Missing --help interception (two levels)

**Top-level:** `src/index.ts` main switch (lines 51-94) has no `case "--help"` or `case "-h"`. These strings fall through to `default` which prints "Unknown command: --help" and generic usage. The `SKIP_AUTO_UPDATE` set (line 43) recognizes `--help`/`-h` but only skips the auto-update check.

**Subcommand-level:** No subcommand router (`tickets`, `inspect`, `comments`) checks for `--help`/`-h` before dispatching to individual commands. When `--help` is passed as a subcommand arg (e.g., `hlx tickets get --help`), `resolveTicketId(["--help"])` filters it out as a flag prefix (line 21: `args.find(a => !a.startsWith("--"))`), finds no positional arg, and exits with "No ticket ID provided".

Fix: Add a help-check utility in `src/lib/flags.ts` and call it at the top of each router and individual command before any validation or API calls.

### RC-3: Unsafe Date construction for run timestamps

`src/tickets/get.ts` line 50 calls `new Date(run.createdAt).toLocaleString()`. When `createdAt` is empty, undefined-coerced, or an unparseable format, JavaScript's Date constructor returns an Invalid Date object whose `toLocaleString()` returns "Invalid Date". Line 51 applies the same pattern to `completedAt` (guarded only by null check, not by Date validity). The `completedAt === null` path shows "in progress" without cross-referencing `run.status`.

Fix: Add safe date formatting that validates the Date object before rendering, with a fallback like "unknown" for invalid values. Cross-reference `completedAt === null` with `run.status` to show "in progress" only for actually-incomplete runs.

### RC-4: Missing --json output mode

Neither `cmdTicketsList()` (list.ts) nor `printTicketDetail()` (get.ts) check for a `--json` flag. All output is hardcoded text. Additional issues:
- `list.ts:88` omits the internal `id` field from text output
- `get.ts:57` truncates descriptions to 500 characters with no override

Fix: Accept `--json` flag in both commands. When set, output the full data structure as JSON (including internal ID and untruncated description). In text mode, optionally add internal ID to list output.

### RC-5: Positional-only SQL input in inspect db

`src/inspect/index.ts` line 29 constructs the SQL query by joining positional args. No `--query` flag exists. PowerShell treats double quotes as string delimiters, making Postgres quoted identifiers (e.g., `"Tickets"`) impossible without arcane escaping.

Fix: Add `--query` flag as alternative input path in the inspect db router, or add a `--file` flag to read SQL from a file. Include PowerShell-safe examples in help text.

## Evidence Summary

| Evidence | Location | Finding |
|----------|----------|---------|
| resolveTicketId raw passthrough | `src/tickets/index.ts:13-26` | Returns raw input without any ID-type detection or resolution |
| Duplicate resolveTicketId | `src/comments/index.ts:6-14` | Same raw-passthrough logic, missing positional arg support |
| Raw ticketId in API URLs | `get.ts:26`, `artifacts.ts:18`, `artifact.ts:33,42`, `rerun.ts:9`, `continue.ts:24`, `bundle.ts:33` | All endpoints receive unresolved input |
| List endpoint returns internal IDs | `src/tickets/latest.ts:44-45`, `src/tickets/list.ts:5-12` | TicketItem has `id` and `shortId`; latest.ts uses `latest.id` successfully |
| Existing resolution pattern | `src/lib/resolve-repo.ts:11-37` | Fetch list, match by exact ID, exact name, partial name |
| Missing --help in main switch | `src/index.ts:51-94` | No case for --help/-h; falls to default "Unknown command" |
| SKIP_AUTO_UPDATE includes --help | `src/index.ts:43` | Only skips auto-update, not dispatch |
| No --help check in routers | `src/tickets/index.ts:42-99`, `src/inspect/index.ts:17-58`, `src/comments/index.ts:24-45` | No help interception before command dispatch |
| Unsafe Date construction | `src/tickets/get.ts:50-51` | `new Date(run.createdAt).toLocaleString()` without validation |
| No --json flag | `src/tickets/list.ts:38-90`, `src/tickets/get.ts:25-64` | No flag check, hardcoded text output |
| Description truncation | `src/tickets/get.ts:57` | `.slice(0, 500) + "..."` with no bypass |
| Internal ID omitted from list | `src/tickets/list.ts:88` | Text output shows shortId but not id |
| SQL positional args only | `src/inspect/index.ts:28-29` | `positional.join(" ")` with no --query alternative |
| No test infrastructure | `package.json`, glob search | No test files, no test runner, no test script |
| Node >= 18 required | `package.json:15` | `node:test` built-in is available (zero dependency) |
| TypeScript strict mode | `tsconfig.json:9` | All new code must be type-safe |

## Success Criteria

1. `hlx tickets get 339` resolves and prints the same ticket as `hlx tickets get BLD-339` and `hlx tickets get <internal-id>`.
2. `hlx tickets artifacts 339` resolves the same ticket and lists its artifacts.
3. `hlx tickets artifact 339 --step implementation --repo helix-global-server` resolves correctly.
4. `hlx tickets rerun 339` and `hlx tickets continue 339` resolve correctly before executing their behavior.
5. `hlx tickets list --json` emits valid JSON with all fields including internal id.
6. `hlx tickets get 339 --json` emits valid JSON with full (untruncated) description and structured data.
7. `hlx tickets get --help`, `hlx tickets list --help`, and `hlx tickets latest --help` print usage without API calls.
8. `hlx tickets get` no longer prints "Invalid Date" for runs when valid timestamps exist.
9. Unresolved references fail clearly without falling back to latest, first, or partial matches.
10. Tests cover internal ID lookup, short ID lookup, numeric ticket number lookup, unresolved lookup, JSON output, and help behavior.
11. `hlx inspect db` help text includes PowerShell-safe examples, or a `--query` flag avoids positional-arg quoting issues.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification and acceptance criteria | Defined all 11 acceptance criteria, required behaviors, failure modes, scope boundaries, and decisions already made |
| scout/reference-map.json | File map and factual findings from scout | Identified all 20 relevant files, confirmed resolveTicketId raw passthrough as root cause, catalogued all defects, noted absence of test infrastructure |
| scout/scout-summary.md | Synthesized analysis from scout | Confirmed 5 problem categories (resolution, help, JSON, timestamps, inspect db), identified resolve-repo.ts as pattern template, validated list endpoint returns internal IDs |
| src/tickets/index.ts | Direct source inspection | Confirmed resolveTicketId() lines 13-26 returns raw input; no --help check in runTickets() dispatcher |
| src/tickets/get.ts | Direct source inspection | Confirmed unsafe Date construction at line 50-51; description truncation at line 57; no --json support |
| src/tickets/list.ts | Direct source inspection | Confirmed TicketItem type has id/shortId; text output omits id; no --json support |
| src/tickets/latest.ts | Direct source inspection | Confirmed line 44-45 uses internal id from list endpoint, proving client-side resolution is viable |
| src/tickets/artifacts.ts | Direct source inspection | Confirmed raw ticketId in API call at line 18 |
| src/tickets/artifact.ts | Direct source inspection | Confirmed raw ticketId in two API calls at lines 33, 42 |
| src/tickets/rerun.ts | Direct source inspection | Confirmed raw ticketId in POST at line 9 |
| src/tickets/continue.ts | Direct source inspection | Confirmed raw ticketId in POST at line 24 |
| src/tickets/bundle.ts | Direct source inspection | Confirmed raw ticketId in API call at line 33 |
| src/index.ts | Direct source inspection | Confirmed no --help/-h case in main switch; SKIP_AUTO_UPDATE only affects auto-update |
| src/lib/flags.ts | Direct source inspection | Confirmed available utilities (hasFlag, getFlag) but no help-specific helpers |
| src/lib/http.ts | Direct source inspection | Confirmed hxFetch builds URLs from config + basePath + path; error messages include HTTP status |
| src/lib/config.ts | Direct source inspection | Confirmed HxConfig has orgId/orgName available for error messages |
| src/lib/resolve-repo.ts | Direct source inspection | Confirmed fetch-list-then-match pattern at lines 11-37: exact ID, exact name, partial name |
| src/inspect/index.ts | Direct source inspection | Confirmed SQL query from positional.join(" ") at line 29; no --query flag; no --help check |
| src/inspect/db.ts | Direct source inspection | Confirmed cmdDb receives pre-joined query string |
| src/comments/index.ts | Direct source inspection | Confirmed duplicate resolveTicketId() at lines 6-14 |
| package.json | Project configuration | No test runner, Node>=18 required, only build/typecheck scripts |
| tsconfig.json | TypeScript configuration | Strict mode, ES2022, Node16 modules — constrains new code |

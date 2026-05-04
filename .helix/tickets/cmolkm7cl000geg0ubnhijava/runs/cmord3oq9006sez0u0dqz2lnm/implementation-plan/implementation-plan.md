# Implementation Plan: Improve Helix CLI Ticket Lookup, Help, JSON Output, and Inspection Ergonomics

## Overview

This plan addresses 5 defect categories in the Helix CLI:

1. **Ticket ID resolution** — `resolveTicketId()` passes raw user input directly to API endpoints requiring internal CUIDs, causing 404s for short IDs (`BLD-339`) and numeric references (`339`).
2. **Missing `--help` handling** — No subcommand checks for `--help`/`-h` before dispatching; flags either error or execute command behavior.
3. **Missing `--json` output** — No machine-readable output mode for `tickets list` or `tickets get`.
4. **Invalid Date rendering** — Unsafe `new Date()` construction in run timestamp display.
5. **PowerShell quoting** — `inspect db` accepts SQL only as positional args, breaking Postgres double-quoted identifiers on PowerShell.

All changes are within `helix-cli`. No backend changes required. The fix follows the proven `resolve-repo.ts` fetch-list-then-match pattern already in the codebase.

## Implementation Principles

- **One resolver, many commands:** Shared ticket reference resolution replaces per-command raw passthrough.
- **Additive, not destructive:** `--json` is a new flag; existing text output remains default and backward-compatible.
- **Fail clearly, never silently:** Ambiguous or unresolved references produce explicit errors with org context. No fallback to latest, first, or partial matches.
- **Help before work:** `--help`/`-h` intercepted before any validation, config loading, or API calls.
- **Minimal surface:** Fix identified defects without redesigning unrelated CLI subsystems.
- **Zero new dependencies:** Use `node:test` (built-in Node >= 18) for tests.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add shared help-check utility and test script | Modified `src/lib/flags.ts`, modified `package.json` |
| 2 | Create shared ticket resolver module | New `src/lib/resolve-ticket.ts` |
| 3 | Add global `--help`/`-h` to main CLI dispatcher | Modified `src/index.ts` |
| 4 | Refactor ticket router to use shared resolver and help | Modified `src/tickets/index.ts` |
| 5 | Fix `tickets get`: timestamps, `--json`, description | Modified `src/tickets/get.ts` |
| 6 | Fix `tickets list`: `--json` output, include internal ID | Modified `src/tickets/list.ts` |
| 7 | Add help handling to `latest` and `create` commands | Modified `src/tickets/latest.ts`, `src/tickets/create.ts` |
| 8 | Fix `continue.ts` positional arg filtering for resolved IDs | Modified `src/tickets/continue.ts` |
| 9 | Replace duplicate resolver in comments, add help | Modified `src/comments/index.ts` |
| 10 | Add `--query` flag and help to inspect commands | Modified `src/inspect/index.ts` |
| 11 | Create unit tests for resolver, help, and date formatting | New `src/lib/resolve-ticket.test.ts`, new `src/lib/flags.test.ts` |
| 12 | Build verification and final quality gates | Run typecheck, build, test |

## Detailed Implementation Steps

### Step 1: Add shared help-check utility and test script

**Goal:** Provide the `isHelpRequested()` utility that all subsequent help-handling steps depend on, and configure the test runner.

**What to Build:**

1. **`src/lib/flags.ts`** — Add a new exported function:
   ```
   isHelpRequested(args: string[]): boolean
   ```
   Returns `true` if `args` includes `"--help"` or `"-h"`.

2. **`package.json`** — Add a `test` script:
   ```
   "test": "tsc && node --test dist/**/*.test.js"
   ```
   This compiles TypeScript first, then runs all `.test.js` files with Node's built-in test runner.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- `isHelpRequested` is exported from `src/lib/flags.ts`.
- `package.json` has a `test` script.
- Typecheck passes.

---

### Step 2: Create shared ticket resolver module

**Goal:** Build the core ticket reference resolution module that all ticket commands will use, replacing the raw-passthrough `resolveTicketId()`.

**What to Build:**

Create **`src/lib/resolve-ticket.ts`** with three exports:

1. **`extractTicketRef(args: string[]): string`** — Extracts the raw ticket reference from `--ticket` flag, `HELIX_TICKET_ID` env var, or first positional arg (non-flag). Replaces both duplicate `resolveTicketId()` functions. Exits with error if no reference found.

2. **`matchTicket(items: Array<{ id: string; shortId: string }>, ref: string): { id: string; shortId: string } | null`** — Pure function (primary test target). Match priority:
   - Exact internal ID match: `items.find(t => t.id === ref)`
   - Exact short ID match (case-insensitive): `items.find(t => t.shortId.toLowerCase() === ref.toLowerCase())`
   - Numeric ticket number match: parse `ref` as integer, extract number from each item's `shortId` by splitting on last `-` and parsing as integer, match exactly.
   - If multiple items match the same numeric suffix, return `null` (ambiguity — caller handles error).
   - No partial matching, no fuzzy matching, no fallback.

3. **`resolveTicket(config: HxConfig, ref: string): Promise<{ id: string; shortId: string }>`** — Async wrapper that:
   - Fetches `GET /api/tickets` (same as `latest.ts:33-36` and `list.ts:68-71`).
   - Calls `matchTicket()` with the response items.
   - On match: returns `{ id, shortId }`.
   - On no match: throws an error with message including the input reference, current org name (`config.orgName`), and suggested valid formats.
   - On ambiguity (multiple numeric matches): throws an error listing the ambiguous matches.

Import `HxConfig` from `../lib/config.js` and `hxFetch` from `../lib/http.js`. Import or re-declare the `TicketItem` type (at minimum `{ id: string; shortId: string; [key: string]: unknown }`).

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- `matchTicket`, `resolveTicket`, and `extractTicketRef` are exported.
- `matchTicket` is a pure function with no side effects.
- Error messages include the input reference and org context.
- Typecheck passes.

---

### Step 3: Add global `--help`/`-h` to main CLI dispatcher

**Goal:** Make `hlx --help` and `hlx -h` print usage and exit cleanly (exit 0) instead of printing "Unknown command" and exiting with error (exit 1).

**What to Build:**

Modify **`src/index.ts`**:

1. Add `case "--help": case "-h":` in the main `switch` statement (lines 51-94), before the `default` case.
2. The case should call `usage()` but the exit code should be `0` (success), not `1`. Either:
   - Modify `usage()` to accept an optional exit code parameter, defaulting to `1` for backward compatibility. Call `usage(0)` from the `--help` case.
   - Or create a separate path: print the same usage text and call `process.exit(0)`.

The `usage()` function is already defined at line 16 as `function usage(): never`. Modify its signature to `function usage(exitCode: number = 1): never` and use `process.exit(exitCode)`.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- `--help` and `-h` are handled in the main switch.
- `usage()` accepts an optional exit code.
- Typecheck passes.

---

### Step 4: Refactor ticket router to use shared resolver and help

**Goal:** Replace the local `resolveTicketId()` in `src/tickets/index.ts` with the shared resolver and add help interception at the router and per-command level.

**What to Build:**

Modify **`src/tickets/index.ts`**:

1. **Remove** the local `resolveTicketId()` function (lines 13-26).

2. **Import** `extractTicketRef`, `resolveTicket` from `../lib/resolve-ticket.js` and `isHelpRequested` from `../lib/flags.js`.

3. **Add router-level help check** at the top of `runTickets()`, before the switch:
   ```
   if (!subcommand || isHelpRequested(args)) {
     ticketsUsage(0);  // exit 0 for help
   }
   ```
   Modify `ticketsUsage()` to accept an optional exit code parameter (default `1`).

4. **Add per-command help checks** in each switch case, before calling the resolver or command. When `isHelpRequested(rest)` is true, print command-specific usage text and exit 0.

5. **Replace `resolveTicketId(rest)` calls** with:
   ```
   const rawRef = extractTicketRef(rest);
   const resolved = await resolveTicket(config, rawRef);
   const ticketId = resolved.id;
   ```
   Apply to cases: `get`, `rerun`, `continue`, `artifacts`, `artifact`, `bundle`.

6. **For `get` case:** Pass `rest` as a third argument to `cmdTicketsGet` so it can check `--json`:
   ```
   await cmdTicketsGet(config, ticketId, rest);
   ```

7. **For `continue` case:** Pass `rawRef` as a fourth argument so `cmdTicketsContinue` can correctly filter the raw reference from positional args:
   ```
   await cmdTicketsContinue(config, ticketId, rest, rawRef);
   ```

8. **Update `ticketsUsage()` text** to mention `--json` and show that ticket references accept internal IDs, short IDs, and ticket numbers.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- Local `resolveTicketId` is deleted.
- All 6 ticket-ref commands use shared resolver.
- Help check present at router level and in each case.
- `cmdTicketsGet` receives `rest` for `--json` flag.
- `cmdTicketsContinue` receives `rawRef` for positional filtering.
- Typecheck passes.

---

### Step 5: Fix `tickets get` — timestamps, `--json`, description

**Goal:** Fix Invalid Date rendering, add `--json` structured output, and stop truncating description in JSON mode.

**What to Build:**

Modify **`src/tickets/get.ts`**:

1. **Add `formatDate()` utility** (module-private or exported for testing):
   ```
   function formatDate(value: string | null | undefined, runStatus?: string): string
   ```
   - If `value` is `null` or `undefined`: check `runStatus`; if the run status indicates a terminal state (e.g., `"failed"`, `"error"`, `"cancelled"`), return `"N/A"`; otherwise return `"in progress"`.
   - Construct `new Date(value)`. If `isNaN(d.getTime())`, return `"unknown"`.
   - Otherwise return `d.toLocaleString()`.

2. **Update run timestamp rendering** (currently lines 50-51):
   - Replace `new Date(run.createdAt).toLocaleString()` with `formatDate(run.createdAt)`.
   - Replace the `completedAt` ternary with `formatDate(run.completedAt, run.status)`.

3. **Modify `cmdTicketsGet` signature** to accept args:
   ```
   export async function cmdTicketsGet(config: HxConfig, ticketId: string, args?: string[]): Promise<void>
   ```

4. **Add `--json` branch** in `cmdTicketsGet`:
   - Check `args && hasFlag(args, '--json')`.
   - If JSON: call `printTicketDetail` to get the data, then output `JSON.stringify(ticket, null, 2)` to stdout. Alternatively, refactor `printTicketDetail` to accept an options object `{ json?: boolean }` and either print JSON or text.
   - JSON output must include all fields: `id`, `shortId`, `title`, `description` (untruncated), `status`, `branchName`, `reporter`, `repositories`, `runs`, `mergeQueueStatus`, `isArchived`.
   - JSON output must NOT truncate `description`.

5. **Text mode** keeps existing behavior but with the fixed timestamp formatting. Description truncation at 500 chars remains for text only.

6. **Import `hasFlag`** from `../lib/flags.js` if not already imported.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- `formatDate` validates Date objects before rendering.
- `--json` flag outputs full JSON to stdout with untruncated description.
- Text output retains existing format with fixed timestamps.
- `run.status` is cross-referenced with `completedAt` for display.
- Typecheck passes.

---

### Step 6: Fix `tickets list` — `--json` output, include internal ID

**Goal:** Add `--json` structured output and include internal ticket ID in both JSON and text output.

**What to Build:**

Modify **`src/tickets/list.ts`**:

1. **Add `--json` check** early in `cmdTicketsList`:
   ```
   const jsonOutput = hasFlag(args, '--json');
   ```

2. **JSON branch** (after filtering and empty check):
   - Output `JSON.stringify(items, null, 2)` to stdout.
   - This includes all TicketItem fields: `id`, `shortId`, `title`, `status`, `updatedAt`, `reporter`.
   - No truncation, no formatting.

3. **Text branch** (existing logic, enhanced):
   - Include internal `id` in the text output. Add it as a column or prefix. For example:
     ```
     console.log(`${ticket.shortId}  ${ticket.id.slice(0, 8)}...  ${ticket.status.padEnd(12)}  ...`);
     ```
   - Or add a separate line/column. Keep it concise — abbreviated ID is sufficient for text since `--json` provides the full value.

4. Ensure `hasFlag` is imported from `../lib/flags.js` (already imported on line 3).

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- `--json` outputs valid JSON array with all TicketItem fields including `id`.
- Text output includes internal ID (abbreviated is acceptable).
- Typecheck passes.

---

### Step 7: Add help handling to `latest` and `create` commands

**Goal:** Ensure `hlx tickets latest --help` and `hlx tickets create --help` print usage and exit without executing command behavior.

**What to Build:**

1. **`src/tickets/latest.ts`** — Add help check at the top of `cmdTicketsLatest`:
   ```
   if (isHelpRequested(args)) {
     console.log("Usage: hlx tickets latest [--status-not-in <s1,s2>] [--archived] [--sprint <id>]");
     process.exit(0);
   }
   ```
   Import `isHelpRequested` from `../lib/flags.js`.

2. **`src/tickets/create.ts`** — Add help check at the top of `cmdTicketsCreate`:
   ```
   if (isHelpRequested(args)) {
     console.log("Usage: hlx tickets create --title <title> --description <desc> --repos <repo1,repo2>");
     process.exit(0);
   }
   ```
   Import `isHelpRequested` from `../lib/flags.js`.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- Both commands check for help before any validation or API calls.
- Help text is informative and exits with code 0.
- Typecheck passes.

---

### Step 8: Fix `continue.ts` positional arg filtering for resolved IDs

**Goal:** Update `cmdTicketsContinue` to correctly filter the raw ticket reference from positional args when the resolved internal ID differs from the raw input.

**What to Build:**

Modify **`src/tickets/continue.ts`**:

1. **Update function signature** to accept the raw reference:
   ```
   export async function cmdTicketsContinue(
     config: HxConfig, ticketId: string, args: string[], rawRef?: string
   ): Promise<void>
   ```

2. **Update the positional arg filtering** (currently lines 12-15):
   - Replace `positional[0] === ticketId` with `positional[0] === (rawRef ?? ticketId)`.
   - This ensures the comparison works whether the user passed `339`, `BLD-339`, or the internal ID.

3. **Add help check** at the top of the function.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- Continuation context is correctly extracted when ticket was specified as numeric or short ID.
- The raw ticket reference is not included in the continuation context string.
- Help check present before validation.
- Typecheck passes.

---

### Step 9: Replace duplicate resolver in comments, add help

**Goal:** Eliminate the duplicate `resolveTicketId()` in `src/comments/index.ts` and add help handling.

**What to Build:**

Modify **`src/comments/index.ts`**:

1. **Remove** the local `resolveTicketId()` function (lines 6-15).

2. **Import** `extractTicketRef`, `resolveTicket` from `../lib/resolve-ticket.js` and `isHelpRequested` from `../lib/flags.js`.

3. **Add router-level help check** before the switch:
   ```
   if (!subcommand || isHelpRequested(args)) {
     commentsUsage(0);
   }
   ```
   Modify `commentsUsage()` to accept an optional exit code.

4. **Replace `resolveTicketId(rest)` calls** in `list` and `post` cases:
   ```
   const rawRef = extractTicketRef(rest);
   const resolved = await resolveTicket(config, rawRef);
   const ticketId = resolved.id;
   ```

5. **Add per-command help checks** in each case before the resolver call.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- Duplicate `resolveTicketId` is deleted.
- Comments use the shared resolver (enabling short ID and numeric lookup).
- Help checks present at router and command level.
- Typecheck passes.

---

### Step 10: Add `--query` flag and help to inspect commands

**Goal:** Add a `--query` flag for `inspect db` as a PowerShell-safe alternative to positional SQL args, and add help interception.

**What to Build:**

Modify **`src/inspect/index.ts`**:

1. **Add help check** at the top of `runInspect()`:
   ```
   if (!subcommand || isHelpRequested(args)) {
     inspectUsage(0);
   }
   ```
   Modify `inspectUsage()` to accept an optional exit code.

2. **Add `--query` flag** in the `db` case (line 26-31):
   ```
   const queryFlag = getFlag(rest, "--query");
   const positional = getPositionalArgs(rest, ["--repo", "--query"]);
   const query = queryFlag ?? positional.join(" ");
   ```
   Note: `--query` must be added to the `excludeFlags` list for `getPositionalArgs` so the flag value isn't treated as positional.

3. **Update `inspectUsage()` text** to include:
   - The `--query` flag as an alternative: `hlx inspect db --repo <name> --query 'SELECT * FROM "Tickets"'`
   - A PowerShell-specific example showing how `--query` avoids double-quote issues.

4. **Add per-command help checks** in each case before validation.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- `inspect db` accepts `--query <sql>` as alternative to positional args.
- Positional args still work for backward compatibility.
- Help text includes PowerShell-safe example.
- Help checks present at router and command level.
- Typecheck passes.

---

### Step 11: Create unit tests

**Goal:** Add focused tests covering ticket resolution, help detection, and date formatting using `node:test`.

**What to Build:**

1. Create **`src/lib/resolve-ticket.test.ts`** with tests for:

   **`matchTicket()` tests:**
   - Internal ID match: exact CUID input matches item by `id`.
   - Short ID match: case-insensitive `BLD-339` matches item with `shortId: "BLD-339"`.
   - Numeric match: `"339"` matches item with `shortId: "BLD-339"`.
   - No match: `"999"` returns `null` when no item has that number.
   - Ambiguity: two items with same numeric suffix (e.g., `"ABC-1"` and `"DEF-1"`) returns `null` for input `"1"`.
   - Empty items array returns `null`.
   - Exact ID takes priority over numeric match (if a CUID happens to start with digits).

   **`extractTicketRef()` tests:**
   - Extracts `--ticket` flag value.
   - Falls back to `HELIX_TICKET_ID` env var.
   - Falls back to first positional arg.
   - Skips flag-prefixed args (e.g., `--help`).

2. Create **`src/lib/flags.test.ts`** with tests for:

   **`isHelpRequested()` tests:**
   - Returns `true` for `["--help"]`.
   - Returns `true` for `["-h"]`.
   - Returns `true` for `["get", "--help"]`.
   - Returns `false` for `["get", "339"]`.
   - Returns `false` for empty array.

3. Use `import { describe, it } from "node:test"` and `import { strict as assert } from "node:assert"` — zero external dependencies.

4. Test files use `.test.ts` extension and are compiled alongside source by `tsc` (tsconfig `include: ["src"]` already covers them).

**Verification (AI Agent Runs):**
```bash
npm run build && node --test dist/**/*.test.js
```

**Success Criteria:**
- All test files compile without errors.
- All tests pass.
- Tests cover: internal ID lookup, short ID lookup, numeric lookup, no match, ambiguity, help detection, and ticket ref extraction.

---

### Step 12: Build verification and final quality gates

**Goal:** Confirm the full codebase compiles, builds, and all tests pass.

**What to Build:**

No new code. Run quality gates:

1. `npm run typecheck` — must pass with zero errors.
2. `npm run build` — must produce `dist/` output.
3. `npm test` — must compile and run all tests successfully.

**Verification (AI Agent Runs):**
```bash
npm run typecheck && npm run build && npm test
```

**Success Criteria:**
- Zero typecheck errors.
- Build completes successfully.
- All tests pass.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|----------------|----------------|
| Node.js >= 18 installed | available | `package.json:14` requires `>=18`; sandbox has Node | [CHK-01], [CHK-02], [CHK-03], [CHK-04], [CHK-05] |
| npm and project dependencies | available | `package.json` has only `@types/node` and `typescript` as devDeps | [CHK-01], [CHK-02], [CHK-03] |
| TypeScript compiler (tsc) | available | Listed in `devDependencies` as `^6.0.2` | [CHK-01], [CHK-02] |
| Helix API server and credentials | missing | No dev setup config provided; CLI requires `requireConfig()` with API key and server URL | [CHK-06], [CHK-07], [CHK-08] |
| Existing tickets in org for live testing | missing | No test org or API access available | [CHK-06], [CHK-07], [CHK-08] |

### Required Checks

**[CHK-01] TypeScript typecheck passes with zero errors**
- Action: Run `npm run typecheck` (which executes `tsc --noEmit`) from the `helix-cli` repository root.
- Expected Outcome: The command exits with code 0 and produces no error output.
- Required Evidence: Command output showing successful completion with no type errors.

**[CHK-02] Project builds successfully**
- Action: Run `npm run build` (which executes `tsc`) from the `helix-cli` repository root.
- Expected Outcome: The command exits with code 0 and populates the `dist/` directory with compiled `.js` files including `dist/lib/resolve-ticket.js`, `dist/lib/resolve-ticket.test.js`, and `dist/lib/flags.test.js`.
- Required Evidence: Command output showing successful build, plus file listing of `dist/lib/` showing the new resolver and test files exist.

**[CHK-03] All unit tests pass**
- Action: Run `npm test` (which executes `tsc && node --test dist/**/*.test.js`) from the `helix-cli` repository root.
- Expected Outcome: All test files are discovered and all tests pass. The output reports test counts with zero failures. Tests must include: internal ID match, short ID match, numeric ticket number match, no-match case, ambiguity case, help flag detection, and ticket ref extraction.
- Required Evidence: Full test runner output showing each test name/description and pass/fail status, with a summary line confirming zero failures.

**[CHK-04] Shared resolver module exports correct functions**
- Action: Run `node -e "const m = await import('./dist/lib/resolve-ticket.js'); console.log(Object.keys(m).sort().join(', '))"` from the `helix-cli` repository root.
- Expected Outcome: Output includes `extractTicketRef`, `matchTicket`, and `resolveTicket`.
- Required Evidence: Command output listing the three exported function names.

**[CHK-05] Help flag handling works at global level without API calls**
- Action: Run `node dist/index.js --help` from the `helix-cli` repository root.
- Expected Outcome: The command prints usage text (containing "hlx" and command descriptions) and exits with code 0. No API calls are made (no authentication required, no network errors).
- Required Evidence: Command output showing usage text and exit code 0 (verified via `echo $?`).

**[CHK-06] Ticket resolution resolves numeric ticket number to internal ID**
- Action: Configure the CLI with valid credentials (`hlx login` or equivalent), ensure at least one ticket exists in the org, then run `hlx tickets get <numeric-number>` where `<numeric-number>` is the numeric suffix of a known ticket's short ID.
- Expected Outcome: The CLI resolves the numeric reference and displays the ticket detail (same output as using the internal ID directly). No 404 error.
- Required Evidence: Command output showing ticket details (Title, Short ID, Status, etc.) for the resolved ticket.

**[CHK-07] JSON output from `tickets list` is valid and includes internal IDs**
- Action: With valid credentials configured, run `hlx tickets list --json` and pipe through a JSON validator (`node -e "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))"` or equivalent).
- Expected Outcome: The output is valid JSON. It is an array of objects, each containing at minimum: `id`, `shortId`, `title`, `status`, `updatedAt`, `reporter`.
- Required Evidence: JSON validator output confirming valid JSON, plus a snippet of the parsed output showing the `id` and `shortId` fields are present on at least one item.

**[CHK-08] JSON output from `tickets get` includes untruncated description**
- Action: With valid credentials configured, run `hlx tickets get <ticket-ref> --json` for a ticket known to have a description longer than 500 characters.
- Expected Outcome: The output is valid JSON. The `description` field contains the full description text (length > 500 characters, not ending with `...` truncation). The JSON also includes `id`, `shortId`, `status`, `branchName`, `reporter`, `repositories`, `runs`, `isArchived`.
- Required Evidence: JSON output showing the `description` field's character count exceeds 500, plus confirmation that all required fields are present.

**[CHK-09] Verify `--query` flag exists for inspect db**
- Action: Run `node dist/index.js inspect --help` from the `helix-cli` repository root.
- Expected Outcome: The usage text includes `--query` as an option for the `db` subcommand, and includes a PowerShell-safe example.
- Required Evidence: Command output showing the `--query` flag documented in help text with a PowerShell example.

**[CHK-10] Verify duplicate resolveTicketId is removed from comments**
- Action: Search the compiled output and source for duplicate `resolveTicketId` definitions. Run: `grep -rn "function resolveTicketId" src/`.
- Expected Outcome: No matches found. The function has been removed from both `src/tickets/index.ts` and `src/comments/index.ts` and replaced by shared resolver imports.
- Required Evidence: grep output showing zero matches.

## Success Metrics

1. All 12 implementation steps complete without errors.
2. `npm run typecheck` — zero errors.
3. `npm run build` — successful compilation to `dist/`.
4. `npm test` — all tests pass (resolver matching, help detection, ref extraction).
5. No new runtime dependencies added (package.json `dependencies` remains empty).
6. Shared resolver used by all ticket and comment commands (no remaining raw-passthrough calls).
7. `--help`/`-h` handled at global, router, and command levels.
8. `--json` flag available on `tickets list` and `tickets get`.
9. Timestamp rendering uses validated Date construction.
10. `inspect db` accepts `--query` flag with PowerShell-safe documentation.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification with 11 acceptance criteria | Defined required behaviors, failure modes, non-negotiable invariants, and scope boundaries. All plan steps trace to ticket requirements. |
| `scout/reference-map.json` | File map with line-level facts | Identified all 20 relevant files, confirmed `resolveTicketId` raw passthrough as root cause, catalogued all defects and their locations. |
| `scout/scout-summary.md` | Synthesized codebase analysis | Confirmed 5 problem categories, identified `resolve-repo.ts` as pattern template, validated list endpoint returns internal IDs. |
| `diagnosis/diagnosis-statement.md` | Root cause analysis (RC-1 through RC-5) | Established 5 root causes with line-level evidence; confirmed client-side resolution is viable; no backend changes needed. |
| `diagnosis/apl.json` | Structured diagnostic Q&A | Evidence-backed answers confirming each defect's cause and fix viability. |
| `product/product.md` | Product vision, features F1-F8, success criteria SC1-SC11 | Defined essential features, user stories, design principles, open questions (pagination risk Q1), and scope constraints. |
| `tech-research/tech-research.md` | Architecture decisions and technical design | Chose client-side list matching (Option B), three-level help (Option C), `node:test` (TD-5), `--query` flag (TD-4). Provided module design, match semantics, and file change map. |
| `tech-research/apl.json` | Technical research Q&A | Confirmed resolution architecture, match semantics for numeric refs, help interception levels, test framework choice, JSON output structure, and pagination risk mitigation. |
| `repo-guidance.json` | Repo intent metadata | Confirmed helix-cli as sole target repository; no cross-repo changes needed. |
| `src/tickets/index.ts` | Ticket router source (lines 13-26, 42-99) | Confirmed `resolveTicketId()` raw passthrough; mapped all 6 call sites needing resolver adoption; verified `runTickets` is already async. |
| `src/tickets/get.ts` | Ticket get source (lines 4-64) | Confirmed TicketDetail type fields, unsafe Date at lines 50-51, description truncation at line 57, no --json support. |
| `src/tickets/list.ts` | Ticket list source (lines 5-90) | Confirmed TicketItem type with id/shortId, TicketsResponse shape, text output omits id field, no --json support. |
| `src/tickets/latest.ts` | Ticket latest source (lines 33-45) | Confirmed list endpoint returns internal IDs (line 44-45), proving client-side resolution viability. |
| `src/tickets/continue.ts` | Continue command source (lines 9-31) | Identified the `positional[0] === ticketId` comparison issue when ticketId changes from raw to resolved; planned rawRef parameter fix. |
| `src/lib/flags.ts` | Flag utility source (lines 1-31) | Confirmed available utilities (hasFlag, getFlag, getPositionalArgs, requireFlag); identified insertion point for isHelpRequested. |
| `src/lib/resolve-repo.ts` | Repo resolution source (lines 11-37) | Confirmed fetch-list-then-match pattern to follow for ticket resolver. |
| `src/index.ts` | Main dispatcher source (lines 43-94) | Confirmed missing --help/-h case in switch; SKIP_AUTO_UPDATE includes help but only for auto-update skip. |
| `src/inspect/index.ts` | Inspect router source (lines 28-29) | Confirmed SQL from `positional.join(" ")` with no --query flag; mapped insertion point for --query. |
| `src/comments/index.ts` | Comments router source (lines 6-14, 24-45) | Confirmed duplicate `resolveTicketId()` with identical raw-passthrough logic minus positional arg support. |
| `src/tickets/artifacts.ts` | Artifacts command source | Confirmed raw ticketId in API call; no direct modification needed (resolver applied in router). |
| `src/tickets/artifact.ts` | Artifact command source | Confirmed raw ticketId in two API calls; no direct modification needed (resolver applied in router). |
| `src/tickets/rerun.ts` | Rerun command source | Confirmed raw ticketId in POST call; no direct modification needed (resolver applied in router). |
| `src/tickets/bundle.ts` | Bundle command source | Confirmed raw ticketId in API calls; no direct modification needed (resolver applied in router). |
| `src/tickets/create.ts` | Create command source | Verified it creates tickets (no resolver needed) but needs help handling. |
| `package.json` | Project configuration | Confirmed zero deps, Node >= 18, no test script; mapped test script insertion point. |
| `tsconfig.json` | TypeScript configuration | Confirmed strict mode, ES2022 target, Node16 modules, src/ -> dist/ compilation. |

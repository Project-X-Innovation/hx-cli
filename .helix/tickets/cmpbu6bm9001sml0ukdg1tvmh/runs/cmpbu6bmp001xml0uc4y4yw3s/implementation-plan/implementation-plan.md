# Implementation Plan: Ticket Relationship Support in hlx CLI

## Overview

Add ticket relationship support to the `hlx` CLI by implementing three new optional flags on `tickets create` (`--after`, `--reference`, `--implement-from`), extending `tickets get` and `tickets list` to display relationship data, and updating all documentation surfaces. This is a single-repo change in `helix-cli` touching 7 files with no new dependencies. The server API already fully supports all relationship fields.

## Implementation Principles

- **Follow existing patterns**: Use the same resolve-then-use pattern as `--repos` in `create.ts` (lines 60-76).
- **Minimal surface area**: Three optional flags on one command; conditional display on two commands. No new commands or modules.
- **Server-authoritative validation**: CLI resolves references and passes IDs to the server; server handles all constraint validation (circular deps, status guards, org checks).
- **Zero additional API calls for display**: Server already includes relationship data in detail and list responses.
- **No new dependencies**: Uses existing `resolveTicket()`, `getFlag()`, `hxFetch()`.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add relationship flags to ticket creation | Modified `src/tickets/create.ts` with `--after`, `--reference`, `--implement-from` flag parsing, resolution, POST body inclusion, and error handling |
| 2 | Display relationships in ticket detail | Modified `src/tickets/get.ts` with extended `TicketDetail` type and conditional relationship display in `printTicketDetail()` |
| 3 | Show dependency indicator in ticket list | Modified `src/tickets/list.ts` with extended `TicketItem` type and `[after RSH-XXX]` tag in output |
| 4 | Update help/usage text | Modified `src/tickets/index.ts` with new flags in usage strings |
| 5 | Update CLI documentation | Modified `src/docs/cli-content.ts` with new flag rows and worked examples |
| 6 | Update agent skill documentation | Modified `skill-content/SKILL.md` with relationship command examples |
| 7 | Update command reference | Modified `skill-content/references/commands.md` with relationship flags |

## Detailed Implementation Steps

### Step 1: Add relationship flags to `src/tickets/create.ts`

**Goal**: Enable `tickets create` to accept `--after`, `--reference`, and `--implement-from` flags, resolve ticket references to internal IDs, include them in the POST body, and surface server validation errors.

**What to Build**:

1. Add import for `resolveTicket` from `../lib/resolve-ticket.js` (line 1 area).
2. After the `mode` handling block (after line 87), add flag parsing:
   - `const afterRef = getFlag(args, "--after")` — single ticket reference
   - `const referenceRaw = getFlag(args, "--reference")` — comma-separated ticket references
   - `const implementFromRef = getFlag(args, "--implement-from")` — single ticket reference
3. Add resolution logic for each flag (following the resolve-then-use pattern from lines 60-76):
   - For `--after`: resolve via `resolveTicket(config, afterRef)`, store `resolved.id` as `afterTicketId`.
   - For `--implement-from`: resolve via `resolveTicket(config, implementFromRef)`, store as `implementFromTicketId`.
   - For `--reference`: split on commas, trim, filter empty, validate max 5 client-side, resolve each sequentially via `resolveTicket()`, collect into `referencedTicketIds` array.
   - Log each resolution: `Resolved --after "RSH-490" to RSH-490 (clxyz...)`.
   - Wrap resolution in try/catch with `console.error` + `process.exit(1)` (matching existing error pattern at lines 72-76).
4. Update the POST body (line 91) to spread resolved relationship fields:
   - `...(afterTicketId && { afterTicketId })`
   - `...(implementFromTicketId && { implementFromTicketId })`
   - `...(referencedTicketIds && referencedTicketIds.length > 0 && { referencedTicketIds })`
5. Wrap the `hxFetch` POST call (lines 89-93) in try/catch for server validation errors:
   - Extract error from the thrown `Error.message` by splitting on em-dash separator (` — `) and parsing the JSON body portion.
   - Display extracted `error` field with `console.error(`Error: ${serverError}`)`.
   - Fall back to raw `error.message` if JSON parsing fails.
   - Call `process.exit(1)` on error.
6. Update the inline usage string (line 16) to include the new flags.

**Dependencies**: None (first step).

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli && npx tsc --noEmit
```

**Success Criteria**:
- TypeScript compiles without errors.
- `resolveTicket` import is correctly added.
- `getFlag()` calls for all three new flags are present.
- POST body conditionally includes relationship fields.
- Error handling wraps the `hxFetch` call with em-dash-aware JSON extraction.
- Usage string includes `[--after <ticket-ref>] [--reference <ref1,ref2>] [--implement-from <ticket-ref>]`.

---

### Step 2: Extend ticket detail display in `src/tickets/get.ts`

**Goal**: Display relationship data (Depends on, Implements, References) in `tickets get` output when present.

**What to Build**:

1. Extend the `TicketDetail` type (lines 5-23) with six new fields:
   - `afterTicketId: string | null`
   - `afterTicket: { id: string; title: string; status: string; shortId: string; mode: string; approvalStatus: string | null } | null`
   - `implementFromTicketId: string | null`
   - `implementFromTicket: { id: string; title: string; status: string; shortId: string; mode: string; approvalStatus: string | null } | null`
   - `referencedTicketIds: string[]`
   - `referencedTickets: Array<{ id: string; title: string; status: string; shortId: string; mode: string; approvalStatus: string | null }>`
2. Add conditional display sections in `printTicketDetail()` after the approval status block (after line 63) and before the repositories section (line 65):
   - If `ticket.afterTicket` is present: `Depends on:   ${shortId} (${title}) - ${status}`
   - If `ticket.implementFromTicket` is present: `Implements:   ${shortId} (${title}) - ${status}`
   - If `ticket.referencedTickets` is non-empty: `References:   ${shortId1} (${title1}) - ${status1}, ...`
3. Tickets without relationships display identically to current behavior (no blank lines or labels).

**Dependencies**: None (independent from Step 1).

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli && npx tsc --noEmit
```

**Success Criteria**:
- TypeScript compiles without errors.
- `TicketDetail` type includes all six relationship fields.
- `printTicketDetail()` conditionally renders relationship lines only when data is present.
- Existing output format is unchanged for tickets without relationships.

---

### Step 3: Add dependency indicator to ticket list in `src/tickets/list.ts`

**Goal**: Append `[after RSH-XXX]` to the list output line when a ticket has a dependency.

**What to Build**:

1. Extend the `TicketItem` type (lines 5-13) with four new fields:
   - `afterTicketId: string | null`
   - `afterTicket: { id: string; title: string; status: string; shortId: string; approvalStatus: string | null } | null`
   - `implementFromTicketId: string | null`
   - `referencedTicketIds: string[]`
2. In the list output loop (line 102-108), compute an `afterTag`:
   - `const afterTag = ticket.afterTicket ? \` [after ${ticket.afterTicket.shortId}]\` : ""`
3. Append `${afterTag}` to the output line (line 107) after `${approvalTag}`.

**Dependencies**: None (independent from Steps 1-2).

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli && npx tsc --noEmit
```

**Success Criteria**:
- TypeScript compiles without errors.
- `TicketItem` type includes relationship fields matching list endpoint response.
- Output line appends `[after <shortId>]` only when `afterTicket` is present.
- Existing output is unchanged for tickets without dependencies.

---

### Step 4: Update help/usage text in `src/tickets/index.ts`

**Goal**: Include the three new flags in all `tickets create` usage/help strings.

**What to Build**:

1. Update the `ticketsUsage()` function (line 21) to append the new flags to the `tickets create` line:
   - Change to: `hlx tickets create --title <title> --description <desc> | --description-file <path> --repos <name1,name2> [--mode <mode>] [--after <ticket-ref>] [--reference <ref1,ref2>] [--implement-from <ticket-ref>]`
2. Update the `case "create"` help string (line 73) with the same expanded usage.

**Dependencies**: None (independent from Steps 1-3).

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli && npx tsc --noEmit
```

**Success Criteria**:
- TypeScript compiles without errors.
- Both usage strings include `--after`, `--reference`, and `--implement-from` flags.

---

### Step 5: Update CLI documentation in `src/docs/cli-content.ts`

**Goal**: Add the three new flags to the documentation table and add worked examples for ticket relationships.

**What to Build**:

1. Add three new rows to the `hlx tickets create` flags table (after the `--mode` row, around line 107):
   - `--after <ticket-ref>` — Create after another ticket (dependency chain)
   - `--reference <ref1,ref2>` — Reference related tickets, comma-separated (max 5)
   - `--implement-from <ticket-ref>` — Link to a completed research ticket
2. Add worked examples in the Worked Examples section (after the existing create example, around line 200) showing:
   - Creating a dependent ticket with `--after`
   - Creating a ticket with cross-references
   - Creating an implementation from research
   - Viewing relationships with `tickets get`

**Dependencies**: None (independent documentation change).

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli && npx tsc --noEmit
```

**Success Criteria**:
- TypeScript compiles without errors.
- Three new flag rows are present in the `tickets create` table.
- Worked examples demonstrate all three relationship flags.

---

### Step 6: Update agent skill documentation in `skill-content/SKILL.md`

**Goal**: Add ticket relationship command examples to the agent skill documentation.

**What to Build**:

1. Add relationship examples to the Ticket Management workflow section (after line 93), showing:
   - Creating a ticket that depends on another: `hlx tickets create --title "..." --after RSH-490 --repos my-app --description "..."`
   - Creating a ticket with cross-references: `hlx tickets create --title "..." --reference RSH-490,RSH-491 --repos my-app --description "..."`
   - Creating an implementation from research: `hlx tickets create --title "..." --implement-from RSH-485 --repos my-app --description "..."`

**Dependencies**: None (independent documentation change).

**Verification (AI Agent Runs)**:
```bash
test -f /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli/skill-content/SKILL.md && echo "exists"
```

**Success Criteria**:
- File exists and contains relationship command examples in the Ticket Management section.
- Examples use the correct flag syntax and realistic ticket reference formats.

---

### Step 7: Update command reference in `skill-content/references/commands.md`

**Goal**: Add the new relationship flags to the `hlx tickets create` command reference.

**What to Build**:

1. Update the Action Commands section (line 56) to expand the `hlx tickets create` command with new flags:
   - `hlx tickets create --title <title> --repos <repo> [--description <desc>] [--after <ticket-ref>] [--reference <ref1,ref2>] [--implement-from <ticket-ref>]`

**Dependencies**: None (independent documentation change).

**Verification (AI Agent Runs)**:
```bash
test -f /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli/skill-content/references/commands.md && echo "exists"
```

**Success Criteria**:
- Command reference includes the three new flags for `tickets create`.

---

## Verification Plan

### Pre-conditions

| # | Dependency | Status | Source/Evidence | Affects checks |
|---|-----------|--------|-----------------|----------------|
| 1 | Node.js >= 18 installed | available | package.json `engines.node >= 18`; workspace has Node.js | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| 2 | `npm install` completed in helix-cli | available | helix-cli has node_modules or `npm install` must be run | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| 3 | TypeScript compiler (`tsc`) available | available | `typescript` is a devDependency in package.json | CHK-01, CHK-02 |
| 4 | helix-cli .env file with HELIX_API_KEY and HELIX_URL | available | Dev setup config provides `.env` contents for helix-cli | CHK-03, CHK-04, CHK-05 |
| 5 | Staging server accessible at HELIX_URL | unknown | HELIX_URL points to `https://helix-global-server-staging-3tl6o.ondigitalocean.app` | CHK-03, CHK-04, CHK-05 |
| 6 | At least one existing ticket in the staging org for `--after` testing | unknown | Requires the staging server to have ticket data | CHK-04 |

### Required Checks

[CHK-01] TypeScript compilation passes with no errors.
- Action: Run `cd /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli && npm install && npx tsc --noEmit` to verify all 7 changed files compile without TypeScript errors.
- Expected Outcome: Exit code 0, no errors in output.
- Required Evidence: Full command output showing successful compilation with zero errors.

[CHK-02] Existing test suite passes without regressions.
- Action: Run `cd /vercel/sandbox/workspaces/cmpbu6bmp001xml0uc4y4yw3s/helix-cli && npx tsc && node --test dist/**/*.test.js` to compile and run all existing tests.
- Expected Outcome: All existing tests (flags.test.js, resolve-ticket.test.js, skill.test.js) pass. Exit code 0.
- Required Evidence: Full test runner output showing all tests passed with pass/fail counts.

[CHK-03] CLI `tickets create --help` displays all three new relationship flags.
- Action: Write the helix-cli `.env` file, build the CLI, and run `node dist/index.js tickets create --help` to display the create command usage.
- Expected Outcome: The help output includes `--after <ticket-ref>`, `--reference <ref1,ref2>`, and `--implement-from <ticket-ref>` in the usage string.
- Required Evidence: Command output containing all three new flag names and their argument patterns.

[CHK-04] CLI `tickets create` with `--after` flag sends the relationship field to the server and creates a ticket.
- Action: Write the helix-cli `.env` file, build the CLI. Run `node dist/index.js tickets list` to find an existing ticket short ID. Then run `node dist/index.js tickets create --title "Test relationship" --description "Verification test" --repos <available-repo> --after <existing-ticket-shortId>` against the staging server.
- Expected Outcome: The CLI resolves the `--after` reference (prints resolution log), creates a ticket successfully (prints ticket ID, short ID, status), and the ticket status is WAITING or QUEUED depending on predecessor state.
- Required Evidence: Full CLI output showing the resolution log line and the created ticket details (ID, Short ID, Status).

[CHK-05] CLI `tickets get` displays relationship data for a ticket with dependencies.
- Action: Using the ticket created in CHK-04 (or any ticket with relationship data), run `node dist/index.js tickets get <ticket-shortId>` to display the ticket detail.
- Expected Outcome: The output includes a `Depends on:` line showing the predecessor ticket's shortId, title, and status. Other standard fields (Title, Short ID, Status, Branch, etc.) remain present and correctly formatted.
- Required Evidence: Full CLI output showing the `Depends on:` line with the predecessor ticket reference, alongside the standard ticket detail fields.

[CHK-06] Documentation files contain the new relationship flags.
- Action: Read the content of `src/docs/cli-content.ts`, `skill-content/SKILL.md`, and `skill-content/references/commands.md` to verify documentation updates.
- Expected Outcome: `cli-content.ts` has three new rows in the `tickets create` flags table and worked examples for relationship flags. `SKILL.md` has relationship command examples in the Ticket Management section. `commands.md` includes the new flags in the Action Commands section.
- Required Evidence: File content excerpts showing the new flag documentation in each of the three files.

## Success Metrics

1. All 7 files modified with no TypeScript compilation errors.
2. All existing tests pass (zero regressions).
3. `--after`, `--reference`, `--implement-from` flags are parsed, resolved, and included in the POST body.
4. Server validation errors are surfaced cleanly through em-dash JSON extraction.
5. `tickets get` conditionally displays "Depends on", "Implements", "References" sections.
6. `tickets list` appends `[after <shortId>]` to tickets with dependencies.
7. All three documentation surfaces updated with flags and examples.
8. No new runtime dependencies introduced.
9. Tickets without relationships display identically to current behavior.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli run root) | Primary specification via Research Report section | Single-repo change in helix-cli: 7 files, 3 new flags, display updates, docs. Server API ready with no changes needed. |
| `scout/reference-map.json` (helix-cli) | Verified file inventory, facts, unknowns, and utility APIs | All 7 target files confirmed at HEAD. resolveTicket() and getFlag() available for reuse. hxFetch error uses em-dash separator. |
| `scout/scout-summary.md` (helix-cli) | Cross-checked scope, file roles, quality gates | Confirmed file change list, utility reuse points, quality gates (tsc --noEmit, tsc + node --test). |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause and success criteria | Feature gap: relationship fields never implemented. 11 success criteria defined. |
| `diagnosis/apl.json` (helix-cli) | Structured investigation confirming feasibility | Server API ready, resolveTicket() available, hxFetch error format supports extraction, single-repo scope. |
| `product/product.md` (helix-cli) | Product requirements and scope boundaries | MVP features, out-of-scope items, key design principles. |
| `tech-research/tech-research.md` (helix-cli) | Architecture decisions and technical approach | Inline resolve-then-use pattern chosen. Em-dash error extraction. Sequential resolution. No new tests in MVP. |
| `tech-research/apl.json` (helix-cli) | Technical Q&A confirming approach | Confirmed inline pattern, em-dash handling, comma-separated references, deferred tests. |
| `repo-guidance.json` (helix-global-client run root) | Repo intent classification | helix-cli=target, helix-global-server=context, helix-global-client=context. |
| `src/tickets/create.ts` | Verified current code at HEAD | Lines 89-93 POST body, lines 60-76 resolve-then-use pattern template, line 16 usage string. |
| `src/tickets/get.ts` | Verified current code at HEAD | Lines 5-23 TicketDetail type, lines 47-87 printTicketDetail, line 63 insertion point for relationships. |
| `src/tickets/list.ts` | Verified current code at HEAD | Lines 5-13 TicketItem type, line 107 output line with approvalTag, lines 102-108 loop. |
| `src/tickets/index.ts` | Verified current code at HEAD | Line 21 and line 73 usage strings for create command. |
| `src/docs/cli-content.ts` | Verified current code at HEAD | Lines 99-107 tickets create flags table, line 168 Worked Examples section. |
| `skill-content/SKILL.md` | Verified current code at HEAD | Lines 74-93 Ticket Management section with basic examples. |
| `skill-content/references/commands.md` | Verified current code at HEAD | Line 56 Action Commands create entry. |
| `src/lib/http.ts` | Verified error message format | Line 34 uses em-dash ` — ` separator in buildErrorMessage. Critical for error extraction strategy. |
| `src/lib/resolve-ticket.ts` | Verified resolution utility API | Lines 86-167: resolveTicket(config, ref) returns { id, shortId } or throws Error. 3 format support. |
| `package.json` | Verified quality gates and dependencies | Scripts: build=tsc, typecheck=tsc --noEmit, test=tsc && node --test. Only devDeps: @types/node, typescript. |

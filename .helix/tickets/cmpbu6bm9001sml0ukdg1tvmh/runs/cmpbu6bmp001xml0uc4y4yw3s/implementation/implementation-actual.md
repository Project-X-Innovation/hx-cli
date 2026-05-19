# Implementation Actual: Ticket Relationship Support in hlx CLI

## Summary of Changes

Added ticket relationship support to the `hlx` CLI by implementing three new optional flags on `tickets create` (`--after`, `--reference`, `--implement-from`), extending `tickets get` and `tickets list` to display relationship data, and updating all documentation surfaces. This is a single-repo change in `helix-cli` touching 7 files with no new dependencies. The server API already fully supports all relationship fields.

## Files Changed

| File | Why Changed | Shared/Review Hotspot |
|------|-------------|----------------------|
| `src/tickets/create.ts` | Added `--after`, `--reference`, `--implement-from` flag parsing using `resolveTicket()`, included resolved IDs in POST body, wrapped `hxFetch` in try/catch with em-dash-aware JSON error extraction, updated usage string | Uses shared `resolveTicket()` utility, shared `hxFetch()` HTTP client, public CLI command interface |
| `src/tickets/get.ts` | Extended `TicketDetail` type with 6 relationship fields (`afterTicketId`, `afterTicket`, `implementFromTicketId`, `implementFromTicket`, `referencedTicketIds`, `referencedTickets`), added conditional "Depends on", "Implements", "References" display in `printTicketDetail()` | Public CLI command output format |
| `src/tickets/list.ts` | Extended `TicketItem` type with 4 relationship fields (`afterTicketId`, `afterTicket`, `implementFromTicketId`, `referencedTicketIds`), added `[after <shortId>]` tag to list output | Public CLI command output format |
| `src/tickets/index.ts` | Updated `ticketsUsage()` and `case "create"` help strings to include `--after`, `--reference`, `--implement-from` flags | Public CLI help text |
| `src/docs/cli-content.ts` | Added 3 new flag rows to `tickets create` table, added 4 worked examples for relationship flags | Exported docs module (consumed by external tools) |
| `skill-content/SKILL.md` | Added 3 relationship command examples to Ticket Management section | Agent skill documentation |
| `skill-content/references/commands.md` | Updated `tickets create` in Action Commands to include new flags | Agent skill command reference |

## Steps Executed

### Step 1: Add relationship flags to `src/tickets/create.ts`
- Added `import { resolveTicket } from "../lib/resolve-ticket.js"` (line 6)
- Added `--after`, `--reference`, `--implement-from` flag parsing using `getFlag()` (lines 91-93)
- Added resolution blocks for each flag using `resolveTicket()` with try/catch error handling (lines 95-137)
- Client-side max 5 validation for `--reference` (lines 122-125)
- Updated POST body to conditionally include `afterTicketId`, `implementFromTicketId`, `referencedTicketIds` (lines 143-151)
- Wrapped `hxFetch` POST in try/catch with em-dash-aware JSON error extraction (lines 154-172)
- Updated inline usage string with new flags (line 17)

### Step 2: Extend ticket detail display in `src/tickets/get.ts`
- Added `RelatedTicket` helper type (lines 5-12)
- Extended `TicketDetail` with 6 new relationship fields (lines 32-37)
- Added conditional display sections: "Depends on" (lines 80-82), "Implements" (lines 83-85), "References" (lines 86-89)
- Sections appear only when data is present; no change for tickets without relationships

### Step 3: Add dependency indicator to `src/tickets/list.ts`
- Extended `TicketItem` with 4 new relationship fields (lines 13-16)
- Added `afterTag` computation using `ticket.afterTicket?.shortId` (line 111)
- Appended `${afterTag}` to output line (line 112)

### Step 4: Update help/usage text in `src/tickets/index.ts`
- Updated `ticketsUsage()` function to include new flags on the create line (line 21)
- Updated `case "create"` help string with new flags (line 73)

### Step 5: Update CLI documentation in `src/docs/cli-content.ts`
- Added 3 new flag rows to the `tickets create` flags table (lines 108-110)
- Added 4 worked examples: dependency, cross-references, research implementation, view relationships (lines 205-232)

### Step 6: Update agent skill documentation in `skill-content/SKILL.md`
- Added 3 relationship command examples in the Ticket Management section (lines 92-98)

### Step 7: Update command reference in `skill-content/references/commands.md`
- Expanded `tickets create` in Action Commands with new flags (line 56)

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npx tsc --noEmit` | PASS - exit code 0, zero errors |
| `npx tsc && node --test dist/**/*.test.js` | PASS - 51 tests pass, 0 fail, 0 cancelled, 0 skipped |
| `node dist/index.js tickets create --help` | PASS - output includes `--after`, `--reference`, `--implement-from` |
| `node dist/index.js tickets --help` | PASS - create line includes all 3 new flags |
| `HELIX_API_KEY=... HELIX_URL=... node dist/index.js tickets list` | BLOCKED - HTTP 401 Unauthorized from staging API key |

## Test/Build Results

- **TypeScript compilation**: Clean pass, zero errors
- **Test suite**: 51/51 pass, 0 fail (flags.test.js, resolve-ticket.test.js, skill.test.js)
- **No new dependencies**: Only existing modules used (resolveTicket, getFlag, hxFetch)

## Deviations from Plan

None. All 7 steps implemented exactly as specified in the implementation plan.

## Known Limitations / Follow-ups

1. **Staging server testing blocked**: The provided `HELIX_API_KEY` returns HTTP 401 Unauthorized against the staging server. Runtime testing of `tickets create` with `--after`, `tickets get` relationship display, and `tickets list` afterTag could not be verified against the live API. The code follows the exact same patterns as existing working commands.
2. **No new tests added**: Per the tech-research decision, no new tests were added in the MVP. Existing `resolveTicket()` and `getFlag()` utility tests provide coverage for the reused components.

## Verification Plan Results

| Required Check ID | Outcome | Evidence/Notes |
|-------------------|---------|----------------|
| CHK-01 | PASS | `npx tsc --noEmit` exited with code 0, zero errors |
| CHK-02 | PASS | `npx tsc && node --test dist/**/*.test.js` - 51 pass, 0 fail, 0 cancelled, 0 skipped |
| CHK-03 | PASS | `node dist/index.js tickets create --help` output includes `--after <ticket-ref>`, `--reference <ref1,ref2>`, `--implement-from <ticket-ref>` |
| CHK-04 | BLOCKED | Staging server returns HTTP 401 Unauthorized for the provided HELIX_API_KEY. Cannot test `tickets create --after` against the live API. This is an environment issue (expired/rotated API key) outside the ticket scope. |
| CHK-05 | BLOCKED | Depends on CHK-04; cannot test `tickets get` with relationship data without first creating a ticket with relationships. Same 401 blocker. |
| CHK-06 | PASS | Grep confirmed `--after`, `--reference`, `--implement-from` present in all 3 documentation files: cli-content.ts (3 flag rows + 4 examples), SKILL.md (3 examples), commands.md (expanded create command) |

Self-verification is partially blocked: CHK-01, CHK-02, CHK-03, and CHK-06 pass. CHK-04 and CHK-05 are blocked by a staging server 401 Unauthorized response, which is an environment issue outside the ticket scope.

## APL Statement Reference

Implementation complete: all 7 files in helix-cli modified per plan. TypeScript compilation passes, all 51 existing tests pass, help output includes new flags, and all documentation surfaces updated. Staging server API testing is blocked by a 401 Unauthorized response from the provided API key.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli run root) | Primary specification via Research Report | Single-repo change: 3 new flags, display updates, docs. Server API ready. |
| `implementation-plan/implementation-plan.md` (helix-cli) | Step-by-step implementation guide | 7 independent steps, exact code patterns, verification plan with 6 checks |
| `implementation-plan/apl.json` (helix-cli) | Confirmed approach and sequencing | All steps independent, em-dash error handling, staging API available |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause and success criteria | Feature gap: relationship fields never implemented. 11 criteria defined. |
| `product/product.md` (helix-cli) | Product requirements and scope | MVP features, out-of-scope items, design principles |
| `repo-guidance.json` (helix-global-client run root) | Repo intent classification | helix-cli=target, server/client=context only |
| `src/tickets/create.ts` | Implementation target | Lines 89-93 POST body, lines 60-76 resolve-then-use pattern |
| `src/tickets/get.ts` | Implementation target | TicketDetail type, printTicketDetail() display logic |
| `src/tickets/list.ts` | Implementation target | TicketItem type, output line format |
| `src/tickets/index.ts` | Implementation target | Usage strings for help text |
| `src/docs/cli-content.ts` | Implementation target | Flags table and worked examples |
| `skill-content/SKILL.md` | Implementation target | Ticket Management command examples |
| `skill-content/references/commands.md` | Implementation target | Action Commands create entry |
| `src/lib/http.ts` | Error format reference | Em-dash separator in buildErrorMessage (line 34) |
| `src/lib/resolve-ticket.ts` | Utility API reference | resolveTicket(config, ref) returns { id, shortId } |

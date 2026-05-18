# Scout Summary

## Problem

The `hlx` CLI has zero support for ticket relationships. The server API and web UI fully support dependency chains (`afterTicketId`), informational cross-references (`referencedTicketIds`), and research-to-implementation links (`implementFromTicketId`), but the CLI cannot create tickets with these fields and cannot display relationship data when viewing tickets.

## Analysis Summary

This is a **single-repo change** in `helix-cli` touching 7 files. The server API (helix-global-server) and web client (helix-global-client) already fully support all three relationship types and require no changes.

**Verified against HEAD:**

1. **create.ts** (lines 89-93): POST body sends only `{ title, description, repositoryIds, mode }`. Must add `--after`, `--reference`, `--implement-from` flags with `resolveTicket()` resolution and include resolved IDs in the body. Error handling needed around `hxFetch` to surface server validation messages.

2. **get.ts** (lines 5-23): `TicketDetail` type omits all relationship fields. `printTicketDetail()` must add conditional "Depends on" / "Implements" / "References" display lines.

3. **list.ts** (lines 5-13): `TicketItem` type omits all relationship fields. Output line must append `[after RSH-XXX]` tag when `afterTicket` is present.

4. **index.ts** (lines 15-33, 71-77): Usage text for `tickets create` must include new flags.

5. **cli-content.ts** (lines 99-107): Docs table for `tickets create` must add three new flag rows. Worked examples section needs relationship examples.

6. **SKILL.md** (lines 74-93): Agent skill Ticket Management section needs relationship command examples.

7. **commands.md** (line 56): Command reference Action Commands section must include new flags.

**Key reuse points:**
- `resolveTicket()` from `src/lib/resolve-ticket.ts` (lines 86-167) - handles all three reference formats, well-tested (15 tests)
- `getFlag()` from `src/lib/flags.ts` (lines 5-9) - simple optional flag parser
- Existing `--repos` resolve-then-use pattern in create.ts (lines 60-76) serves as template

**Server API contract verified:** `createTicketSchemaGeneral` in `ticket-controller.ts` (lines 29-40) includes `afterTicketId` (optional string), `implementFromTicketId` (optional string), `referencedTicketIds` (optional array, max 5).

**Quality gates:** `tsc` (build), `tsc --noEmit` (typecheck), `tsc && node --test dist/**/*.test.js` (tests). No ORM, no migrations, no database.

## Relevant Files

| File | Role | Change Needed |
|------|------|---------------|
| `src/tickets/create.ts` | Ticket creation command | Add 3 new flags, resolveTicket() calls, update POST body, add error handling |
| `src/tickets/get.ts` | Ticket detail display | Extend TicketDetail type, add relationship display sections |
| `src/tickets/list.ts` | Ticket list display | Extend TicketItem type, append dependency indicator |
| `src/tickets/index.ts` | Help/usage text | Update usage strings for create command |
| `src/docs/cli-content.ts` | Exported documentation | Add flag rows and worked examples |
| `skill-content/SKILL.md` | Agent skill docs | Add relationship command examples |
| `skill-content/references/commands.md` | Command reference | Add relationship flags to create command |
| `src/lib/resolve-ticket.ts` | Ticket resolution utility | Reuse only (no changes) |
| `src/lib/flags.ts` | Flag parsing utility | Reuse only (no changes) |
| `src/lib/http.ts` | HTTP client | Reuse only (no changes); error format relevant for error handling design |
| `src/lib/resolve-ticket.test.ts` | Test file | Reference only (15 existing tests confirm resolveTicket() behavior) |
| `package.json` | Build config | Quality gates reference |
| `tsconfig.json` | TS config | Compilation settings reference |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli run root) | Primary specification via Research Report section | Single-repo change in helix-cli: 7 files, 3 new flags on create, display updates on get/list, docs updates. Server API ready. |
| src/tickets/create.ts | Verify current POST body and flag parsing patterns | Confirmed lines 89-93 send only 4 fields. Resolve-then-use pattern at lines 60-76 is the template for new flags. |
| src/tickets/get.ts | Verify TicketDetail type and display logic | Confirmed type (lines 5-23) and printTicketDetail() (lines 47-87) have no relationship fields or display sections. |
| src/tickets/list.ts | Verify TicketItem type and output format | Confirmed type (lines 5-13) and output line (line 107) have no relationship data. |
| src/tickets/index.ts | Verify help/usage text | Confirmed usage strings at lines 15-33 and 71-77 lack relationship flags. |
| src/docs/cli-content.ts | Verify documentation table | Confirmed tickets create flags table (lines 99-107) has no relationship flags. |
| skill-content/SKILL.md | Verify agent skill docs | Confirmed Ticket Management section (lines 74-93) has no relationship examples. |
| skill-content/references/commands.md | Verify command reference | Confirmed Action Commands (line 56) lacks relationship flags. |
| src/lib/resolve-ticket.ts | Verify resolution utility API | Confirmed resolveTicket(config, ref) returns { id, shortId } or throws Error. Handles 3 formats. |
| src/lib/flags.ts | Verify flag parsing utility | Confirmed getFlag(args, flag) returns string or undefined. |
| src/lib/http.ts | Verify error message format | Confirmed buildErrorMessage appends response body text to 'HTTP {status} {statusText}' format. |
| src/lib/resolve-ticket.test.ts | Assess test coverage | 15 tests covering matchTicket, extractTicketRef, resolveTicket. Tests use node:test with mock support. |
| package.json | Verify build/quality gates and dependencies | Scripts confirmed. Only devDeps: @types/node, typescript. No ORM. |
| helix-global-server ticket-controller.ts (lines 29-40) | Verify server API Zod schema | Confirmed createTicketSchemaGeneral includes all 3 relationship fields. |
| /tmp/helix-inspect/manifest.json | Check runtime inspection availability | Available for helix-global-server (DATABASE, LOGS). Not needed for this CLI-only change. |

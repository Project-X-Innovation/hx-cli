# Diagnosis Statement

## Problem Summary

The `hlx` CLI has zero support for ticket relationships. The server API (helix-global-server) and web UI (helix-global-client) fully support dependency chains (`afterTicketId`), informational cross-references (`referencedTicketIds`), and research-to-implementation links (`implementFromTicketId`). However, the CLI cannot create tickets with these relationships and cannot display relationship data when viewing or listing tickets.

This blocks CLI-primary users and automation workflows from decomposing projects into ordered ticket chains, linking related work, or connecting implementations to completed research — capabilities that are fully available in the web UI.

## Root Cause Analysis

**Root cause: Feature gap in helix-cli — relationship fields were never implemented.**

The `tickets create` command (`src/tickets/create.ts` lines 89-93) builds a POST body with only four fields: `{ title, description, repositoryIds, mode }`. The three server-supported relationship fields are never parsed from CLI arguments and never included in the request.

The display commands have a parallel gap:
- **`tickets get`**: The `TicketDetail` type (`src/tickets/get.ts` lines 5-23) omits all six relationship fields (`afterTicketId`, `afterTicket`, `implementFromTicketId`, `implementFromTicket`, `referencedTicketIds`, `referencedTickets`). The `printTicketDetail()` function (lines 47-87) has no relationship rendering sections.
- **`tickets list`**: The `TicketItem` type (`src/tickets/list.ts` lines 5-13) omits all relationship fields. The output line (line 107) has no dependency indicator.

The server API requires **no changes** — the Zod schema `createTicketSchemaGeneral` already accepts all three relationship fields as optional, the detail endpoint returns nested relationship objects, and the list endpoint includes relationship data per item.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| POST body lacks relationship fields | `src/tickets/create.ts` lines 89-93 | Body sends only `title, description, repositoryIds, mode` |
| TicketDetail type missing relationships | `src/tickets/get.ts` lines 5-23 | No afterTicket*, implementFromTicket*, or referencedTicket* fields |
| TicketItem type missing relationships | `src/tickets/list.ts` lines 5-13 | No relationship fields of any kind |
| Zero codebase matches | Grep for afterTicketId/referencedTicketIds/implementFromTicketId | Zero source file matches in helix-cli |
| Server schema ready | Research report Section 2 (verified by scout) | `createTicketSchemaGeneral` includes all 3 optional relationship fields |
| resolveTicket() utility available | `src/lib/resolve-ticket.ts` lines 86-167 | Handles ID, shortId, numeric ref with active+archived fallback; 15 tests |
| getFlag() utility available | `src/lib/flags.ts` lines 5-9 | Simple optional flag parser, already imported in create.ts |
| Existing resolve-then-use pattern | `src/tickets/create.ts` lines 60-76 | `--repos` resolution provides exact template for new relationship flags |
| hxFetch error format supports extraction | `src/lib/http.ts` lines 28-35 | `buildErrorMessage` appends response body text (up to 500 chars) to error message |
| Display endpoints return relationship data | Research report Sections 2.4-2.5 | GET detail and list responses include nested relationship objects; zero additional API calls needed |

## Success Criteria

1. **`tickets create` accepts three new flags**: `--after <ticket-ref>`, `--reference <ref1,ref2>`, `--implement-from <ticket-ref>` — all optional, combinable with each other and existing flags.
2. **Reference resolution works**: Each flag value is resolved to an internal ticket ID using `resolveTicket()` before the POST request, supporting internal IDs, short IDs (e.g., `RSH-490`), and numeric references.
3. **POST body includes resolved IDs**: The relationship fields are included in the request body only when the corresponding flags are provided.
4. **Server validation errors surface cleanly**: Error messages from the server (e.g., "Circular dependency detected.", "implementFromTicketId must reference a RESEARCH mode ticket.") are extracted and displayed to the user.
5. **`tickets get` displays relationships**: When relationship data is present, `printTicketDetail()` renders "Depends on", "Implements", and "References" sections with shortId, title, and status.
6. **`tickets list` shows dependency indicator**: When `afterTicket` is present, `[after RSH-XXX]` is appended to the list output line.
7. **Help text updated**: Usage strings in `index.ts` and `create.ts` include the new flags.
8. **Documentation updated**: `cli-content.ts`, `SKILL.md`, and `commands.md` document the new flags with examples.
9. **TypeScript compiles**: `tsc --noEmit` passes without errors.
10. **Existing tests pass**: `tsc && node --test dist/**/*.test.js` passes (no existing tests break).
11. **No new dependencies**: Implementation uses only existing modules (`resolveTicket`, `getFlag`, `hxFetch`).

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli run root) | Primary specification via Research Report section | Single-repo change in helix-cli: 7 files, 3 new flags, display updates, docs updates. Server API fully ready. |
| scout/reference-map.json (helix-cli) | Verified file inventory, facts, and unknowns from codebase scan | All 7 target files confirmed against HEAD. resolveTicket() and getFlag() available for reuse. Zero existing relationship support. |
| scout/scout-summary.md (helix-cli) | Cross-checked analysis summary and file roles | Confirmed scope, key reuse points, and quality gates (tsc, tsc --noEmit, node --test). |
| src/tickets/create.ts | Verified POST body and existing patterns | Lines 89-93 confirm 4-field body. Lines 60-76 provide resolve-then-use template for new flags. |
| src/tickets/get.ts | Verified TicketDetail type and display logic | Lines 5-23 confirm missing relationship fields. Lines 47-87 confirm no relationship rendering. |
| src/tickets/list.ts | Verified TicketItem type and output format | Lines 5-13 confirm missing fields. Line 107 confirms no dependency indicator. |
| src/tickets/index.ts | Verified help/usage text | Lines 15-33 and 71-77 confirm create usage lacks relationship flags. |
| src/lib/resolve-ticket.ts | Verified resolution utility API and behavior | Lines 86-167: resolveTicket(config, ref) → { id, shortId } with 3-format support and archived fallback. |
| src/lib/flags.ts | Verified flag parsing utility | Lines 5-9: getFlag returns string or undefined. Already imported in create.ts. |
| src/lib/http.ts | Verified error message format for extraction strategy | Lines 28-35: buildErrorMessage appends body text with `—` separator, enabling JSON error extraction. |
| src/docs/cli-content.ts | Verified documentation structure | Lines 99-107: tickets create flags table needs 3 new rows. Worked Examples section needs relationship examples. |
| skill-content/SKILL.md | Verified agent skill documentation | Lines 74-93: Ticket Management needs relationship command examples. |
| skill-content/references/commands.md | Verified command reference | Line 56: Action Commands create entry needs relationship flags. |
| /tmp/helix-inspect/manifest.json | Checked runtime inspection availability | Available for helix-global-server (DATABASE, LOGS). Not needed for this CLI-only feature gap. |

# Scout Summary — RSH-493: hlx CLI doesn't include after or other ticket reference

## Problem

The `hlx tickets create` command does not expose any ticket relationship capabilities. The server API already accepts three types of ticket references (`afterTicketId`, `referencedTicketIds`, `implementFromTicketId`) and the web UI provides interactive ways to set these (slash commands `/after`, `/implement`, and `#` hashtag references). The CLI has zero support for any of these, meaning CLI-driven workflows cannot chain tickets, add informational cross-references, or link research tickets for implementation.

Additionally, the CLI's ticket display commands (`get`, `list`) do not render relationship data even if it exists on a ticket, making dependency relationships invisible to CLI users.

## Analysis Summary

### Server API: Fully ready

The server `POST /api/tickets` endpoint (validated via Zod schema in `ticket-controller.ts`) already accepts:
- `afterTicketId` (optional string) — Creates a dependency chain. Server validates same-org existence, prevents targeting DEPLOYED/STAGING_MERGED tickets, walks up to 20 ancestors for circular dependency detection, and sets new ticket status to WAITING or QUEUED based on predecessor state.
- `referencedTicketIds` (optional array, max 5) — Informational cross-references. Server validates all exist in same org.
- `implementFromTicketId` (optional string) — Links to a RESEARCH-mode ticket with REPORT_READY status.

The Prisma schema has corresponding columns and self-relations.

### Web Client: Full UI support

The client provides three mechanisms:
- `/after` slash command in description editor → `DependencyChip` component, sets `afterTicketId`
- `/implement` slash command → `ImplementChip` component, sets `implementFromTicketId`
- `#` hashtag reference → `ReferenceChip` component, adds to `referencedTicketIds[]`

The ticket detail view displays Related Tickets showing both `afterTicket` and `referencedTickets`.

### CLI: Complete gap

- `create.ts` POST body sends only `{ title, description, repositoryIds, mode }` — no relationship fields
- No `--after`, `--reference`, or `--implement-from` flags exist anywhere in the CLI codebase (confirmed by grep)
- `get.ts` `TicketDetail` type excludes relationship fields; `printTicketDetail` does not render them
- `list.ts` `TicketItem` type excludes relationship fields
- The existing `resolveTicket()` utility in `resolve-ticket.ts` can already resolve ticket references (ID, shortId, number) against the API, providing a ready-made pattern for resolving `--after` and `--reference` flag values

### Quality gates

- Build: `tsc`
- Typecheck: `tsc --noEmit`
- Test: `tsc && node --test dist/**/*.test.js`
- No ORM, no migrations needed in helix-cli

### Documentation surfaces needing update

- `src/docs/cli-content.ts` — Exported docs for `tickets create` flags table
- `skill-content/SKILL.md` — Agent skill documentation
- `skill-content/references/commands.md` — Command reference
- `src/index.ts` — Top-level usage text
- `src/tickets/index.ts` — Tickets subcommand usage and help strings

## Relevant Files

| File | Role |
|------|------|
| `src/tickets/create.ts` | Ticket creation — needs relationship flags and body fields |
| `src/tickets/index.ts` | Subcommand router — usage text and help for create |
| `src/tickets/get.ts` | Ticket detail display — needs relationship fields in type and output |
| `src/tickets/list.ts` | Ticket list display — may need relationship indicator |
| `src/lib/resolve-ticket.ts` | Ticket resolution — reusable for resolving --after/--reference values |
| `src/lib/flags.ts` | Flag parsing utilities |
| `src/lib/http.ts` | HTTP client — already supports arbitrary POST body |
| `src/index.ts` | CLI entry point and top-level usage |
| `src/docs/cli-content.ts` | Documentation export |
| `skill-content/SKILL.md` | Agent skill docs |
| `skill-content/references/commands.md` | Command reference docs |
| `src/lib/resolve-ticket.test.ts` | Existing test patterns |
| `src/lib/flags.test.ts` | Existing test patterns |
| `package.json` | Build/test scripts, version 1.3.3 |
| `tsconfig.json` | TypeScript config (strict, ES2022, Node16) |

## Cross-repo context (no changes needed)

| Repo | Evidence |
|------|----------|
| `helix-global-server` | API already accepts all three relationship fields. Schema and validation in place. Context-only. |
| `helix-global-client` | UI already supports /after, /implement, # references. Confirms server API contract. Context-only. |
| `library` | No ticket-relevant code. Context-only. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Ticket description and scope | CLI lacks ticket relationship/reference capabilities that exist in the UI |
| `helix-cli/src/tickets/create.ts` | Primary file for ticket creation | POST body only sends title, description, repositoryIds, mode — no relationship fields |
| `helix-cli/src/tickets/index.ts` | Subcommand routing and usage | Usage text and help strings document only current flags |
| `helix-cli/src/tickets/get.ts` | Ticket detail view | TicketDetail type and printTicketDetail() omit all relationship fields |
| `helix-cli/src/tickets/list.ts` | Ticket list view | TicketItem type omits relationship fields |
| `helix-cli/src/lib/resolve-ticket.ts` | Ticket reference resolution | Already resolves ID/shortId/number — reusable for --after flag value resolution |
| `helix-cli/src/lib/flags.ts` | Flag parsing | getFlag/hasFlag/requireFlag pattern for new flags |
| `helix-cli/src/lib/http.ts` | HTTP client | hxFetch supports arbitrary POST body — no structural changes needed |
| `helix-cli/src/lib/config.ts` | Config and HxConfig type | Used by resolveTicket and all commands |
| `helix-cli/src/docs/cli-content.ts` | CLI documentation export | tickets create docs omit relationship flags |
| `helix-cli/skill-content/SKILL.md` | Agent skill docs | No mention of ticket relationships |
| `helix-cli/skill-content/references/commands.md` | Command reference | tickets create section omits relationship flags |
| `helix-cli/package.json` | Build/test commands | tsc build, tsc --noEmit typecheck, node --test for tests |
| `helix-cli/tsconfig.json` | TS build config | Strict mode, ES2022, Node16 module |
| `helix-global-server/src/controllers/ticket-controller.ts` | Server API schema | Confirms afterTicketId, referencedTicketIds, implementFromTicketId accepted |
| `helix-global-server/src/services/ticket-service.ts` | Server validation logic | Confirms dependency chain validation (circular detection, status checks) |
| `helix-global-server/prisma/schema.prisma` | Data model | Ticket model has self-relations for dependencies and references |
| `helix-global-client/src/routes/create-ticket.tsx` | Client ticket creation | Confirms /after, /implement, # reference UI patterns and API call shape |
| `helix-global-client/src/types/api.ts` | Client API types | Confirms CreateTicketRequest includes all three relationship fields |

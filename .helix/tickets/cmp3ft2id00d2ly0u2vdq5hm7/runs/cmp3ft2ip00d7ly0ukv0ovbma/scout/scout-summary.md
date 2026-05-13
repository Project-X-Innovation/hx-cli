# Scout Summary: helix-cli

## Problem

The CLI has no library module. Users and agents cannot list library items, view reports with section-level feedback summaries, or post section-level ratings and comments via the command line. SKILL.md lacks a Library section, making library commands undiscoverable to agents.

## Analysis Summary

### Current State
- **No library module** exists in src/. No library-related code in any existing module.
- **Module pattern** is consistent: each domain (comments, tickets, inspect, org, skill, token, update) has a `src/{domain}/index.ts` router that dispatches to cmd* functions.
- **Comments module** (src/comments/) demonstrates the comment command pattern: list (fetch + format), post (collect args + POST), with --ticket flag resolution.
- **Ticket resolution** (src/lib/resolve-ticket.ts) supports ID, short ID (XXX-NNN), and numeric ticket number. Library item resolution needs a parallel utility.
- **HTTP client** (src/lib/http.ts) handles auth (hxi_ API keys, Bearer tokens), retry with backoff, and base path configuration.
- **SKILL.md** (skill-content/SKILL.md, 148 lines) has sections for commands, workflows, guardrails, but no Library section.
- **Continue command** (src/tickets/continue.ts) sends continuationContext string to POST /api/tickets/{ticketId}/rerun. Currently requires non-empty text.

### New Components Needed
1. **src/library/index.ts**: Router dispatching to list, show, comments subcommands.
2. **src/library/list.ts**: `hlx library list` — fetches /api/library/items, displays title/status/date table.
3. **src/library/show.ts**: `hlx library show <ref>` — fetches item with content, annotates headings with slugs and comment summaries.
4. **src/library/comments.ts**: Nested router for `comments list` and `comments post`.
5. **src/library/comments-list.ts**: `hlx library comments list <ref> [--section <slug>]` — fetches comments grouped by section.
6. **src/library/comments-post.ts**: `hlx library comments post <ref> --section <slug> --rating <value> [message]` — posts rating with optional text.
7. **src/lib/resolve-library-item.ts**: Resolves item by cuid, ticket short ID, or title match.
8. **SKILL.md update**: New Library section with all command documentation.
9. **src/index.ts update**: Add 'library' case to switch dispatcher.

### Key Patterns to Follow
- **Routing**: Switch-case on subcommand in module index.ts
- **Flag parsing**: getFlag(), hasFlag(), getPositionalArgs() from src/lib/flags.ts
- **HTTP**: hxFetch(config, path, { basePath: '/api' }) for non-inspect endpoints
- **Resolution**: Multi-format ref resolution (cuid, short ID, title) following resolve-ticket.ts
- **Help**: isHelpRequested() check at top of each command, usage() function per module
- **Config**: configOrHelp(args) in index.ts before dispatch to ensure auth is available

### Quality Gates
- `npm run build` — tsc (TypeScript compilation)
- `npm run typecheck` — tsc --noEmit
- `npm run test` — tsc && node --test dist/**/*.test.js

## Relevant Files

| File | Role |
|------|------|
| `src/index.ts` | Main CLI dispatcher — add 'library' case (line 72-124) |
| `src/comments/index.ts` | Pattern: module router with subcommand dispatch |
| `src/comments/list.ts` | Pattern: list command with fetch + format |
| `src/comments/post.ts` | Pattern: post command with arg collection |
| `src/tickets/continue.ts` | Continuation command — library comment context integration |
| `src/lib/resolve-ticket.ts` | Pattern: multi-format reference resolution |
| `src/lib/flags.ts` | Flag parsing utilities |
| `src/lib/http.ts` | HTTP client with auth and retry |
| `src/lib/config.ts` | HxConfig type and loading |
| `skill-content/SKILL.md` | Agent skill documentation — needs Library section |
| `package.json` | Build/typecheck/test scripts |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (Research Report) | Primary specification | CLI module structure, 4 commands (list, show, comments list, comments post), rating flag values (thumbs-up/love/thumbs-down), section targeting via heading slugs, SKILL.md update, item resolution strategies |
| src/index.ts | Dispatcher architecture | Switch-case routing; configOrHelp() for auth; auto-update check before dispatch |
| src/comments/ | Module pattern reference | index.ts router, list.ts fetch+format, post.ts arg collection+POST; --ticket flag via extractTicketRef() |
| src/lib/resolve-ticket.ts | Resolution pattern | extractTicketRef(args), matchTicket(items, ref) with priority (exact ID > short ID > numeric), resolveTicket(config, ref) with API call |
| src/lib/flags.ts | Flag parsing pattern | getFlag, hasFlag, getPositionalArgs, requireFlag — custom lightweight parser |
| src/lib/http.ts | HTTP client pattern | hxFetch with basePath config, auth headers, retry with backoff |
| src/tickets/continue.ts | Continuation mechanism | Sends continuationContext to POST /api/tickets/{ticketId}/rerun; currently requires non-empty text |
| skill-content/SKILL.md | Agent documentation | 148 lines; sections for commands, workflows, guardrails; no Library section exists |

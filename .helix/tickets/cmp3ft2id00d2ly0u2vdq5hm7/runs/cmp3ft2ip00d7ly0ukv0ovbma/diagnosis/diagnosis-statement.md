# Diagnosis Statement: helix-cli

## Problem Summary

The CLI has no library module. Users and agents cannot list library items, view reports with section-level feedback summaries, or post section-level ratings and comments via the command line. SKILL.md lacks a Library section, making library commands undiscoverable to agents.

## Root Cause Analysis

This is a **complete feature gap**. No library module or library-related code exists anywhere in the CLI codebase:

1. **No module**: No `src/library/` directory. `src/index.ts` switch-case dispatcher (lines 72-124) has no 'library' case.
2. **No commands**: No `hlx library list`, `hlx library show`, `hlx library comments list`, or `hlx library comments post` commands.
3. **No resolution utility**: No `resolve-library-item.ts` parallel to `resolve-ticket.ts` for resolving library items by cuid, short ID, or title.
4. **No SKILL.md section**: `skill-content/SKILL.md` (148 lines) documents all existing commands but has no Library section, making library commands invisible to agents.

The CLI has a well-established module pattern that the new library module can follow exactly:
- Module router: `src/{domain}/index.ts` exports `runX(config, args)` dispatching to `cmd*` functions
- Flag parsing: `src/lib/flags.ts` with `getFlag()`, `hasFlag()`, `getPositionalArgs()`
- HTTP client: `src/lib/http.ts` with `hxFetch(config, path, { basePath: '/api' })`
- Reference resolution: `src/lib/resolve-ticket.ts` for multi-format ref resolution

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| `src/index.ts` lines 72-124 | Switch-case dispatcher: login, token, inspect, comments, org, tickets, skill, update — no library |
| `src/comments/index.ts` | Pattern reference: runComments dispatches to cmdCommentsList and cmdCommentsPost |
| `src/comments/list.ts` | Pattern reference: fetch from API, format output for terminal |
| `src/comments/post.ts` | Pattern reference: collect args, POST to API with auth |
| `src/lib/resolve-ticket.ts` | Pattern reference: extractTicketRef, matchTicket — library needs parallel |
| `src/lib/flags.ts` | Flag parsing: getFlag, hasFlag, getPositionalArgs, requireFlag |
| `src/lib/http.ts` | HTTP client: hxFetch with basePath, auth headers, retry |
| `src/tickets/continue.ts` | Continue command: posts continuationContext — no change needed for MVP |
| `skill-content/SKILL.md` | 148 lines, no Library section |
| `package.json` | Build: tsc; test: tsc && node --test; pure TypeScript |

## Success Criteria

1. **src/library/index.ts** router dispatching to list, show, comments subcommands.
2. **`hlx library list`** fetches and displays library items (title, status, date).
3. **`hlx library show <ref>`** displays report with heading slugs and comment summaries annotated on each section.
4. **`hlx library comments list <ref>`** displays comments grouped by section with ratings, authors, text.
5. **`hlx library comments post <ref> --section <slug> --rating <value> [message]`** posts section feedback.
6. **src/lib/resolve-library-item.ts** resolves by cuid, ticket short ID, or title match.
7. **SKILL.md** updated with Library section documenting all commands.
8. **src/index.ts** updated with 'library' case in switch dispatcher.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (Research Report) | Primary specification | CLI module structure, 4 commands, rating flag values, section targeting, SKILL.md update, item resolution strategies |
| scout/reference-map.json (CLI) | File mapping and code facts | No library module exists; established module pattern identified |
| scout/scout-summary.md (CLI) | Architecture overview | Switch-case routing, flag parsing, HTTP client, SKILL.md for agent discoverability |
| src/index.ts | Direct dispatcher inspection | No library case in switch; configOrHelp pattern for auth |
| src/comments/ | Module pattern reference | Router -> list/post dispatch; flag parsing; HTTP fetch |
| src/lib/resolve-ticket.ts | Resolution pattern reference | Multi-format ref: extractTicketRef, matchTicket |
| skill-content/SKILL.md | Agent documentation inspection | 148 lines, no Library section |

# Scout Summary: helix-cli

## Problem

The CLI has no library commands. Users and agents cannot list library items, view reports with section feedback annotations, or post/list section-level comments from the command line. The RSH-443 research report specifies a new `src/library/` module with four commands: `hlx library list`, `hlx library show <ref>`, `hlx library comments list <ref>`, and `hlx library comments post <ref>`. The SKILL.md agent documentation must also be updated.

## Analysis Summary

**Current state**: The CLI has 8 command modules (login, token, org, tickets, comments, inspect, skill, update). No library module exists. The existing `comments` module handles ticket-level comments with list and post subcommands. The `lib/` directory provides shared utilities: HTTP client (`hxFetch`), flag parsing, config management, and ticket resolution (`resolve-ticket.ts`).

**Module structure**: The new `src/library/` module follows the established pattern: an `index.ts` router with subcommand dispatch, individual command files (list.ts, show.ts, comments.ts, comments-list.ts, comments-post.ts), and a shared `resolve-library-item.ts` utility in `src/lib/`.

**Item resolution**: Library items need a resolution strategy analogous to `resolveTicket`. The `<ref>` argument should accept: cuid (direct library item ID), short ID (e.g., RSH-439, resolves via ticket then finds latest library item), or title substring match. This mirrors the three-strategy pattern in `resolve-ticket.ts`.

**CLI-specific features**: Section targeting via `--section <slug>` flag with auto-slugification of heading text. Rating flag with human-readable values (thumbs-up, love, thumbs-down) mapping to server enum values. Output formatting shows section anchors inline with headings for discoverability.

**SKILL.md update**: The `skill-content/SKILL.md` file documents all CLI commands for agent discoverability. A new "Library" section must be added with the four new commands and their flags.

## Relevant Files

| File | Role |
|------|------|
| `src/index.ts` | Main CLI router; add 'library' case |
| `src/comments/index.ts` | Pattern reference for module router |
| `src/comments/list.ts` | Pattern reference for list command |
| `src/comments/post.ts` | Pattern reference for post command |
| `src/lib/resolve-ticket.ts` | Pattern reference for resolve-library-item.ts |
| `src/lib/http.ts` | Shared HTTP client (hxFetch) |
| `src/lib/flags.ts` | Flag parsing utilities |
| `src/lib/config.ts` | Config types and loading |
| `skill-content/SKILL.md` | Agent skill docs; add Library section |
| `package.json` | Build/test scripts; no new dependencies |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Ticket description and RSH-443 reference | Implementation ticket for research findings |
| RSH-443 research report | Primary specification | New src/library/ module with 4 commands, resolve-library-item utility, rating flag values, section targeting, SKILL.md update content, agent workflow example |
| src/index.ts | Current CLI router | Switch-based dispatch at lines 72-124; 'library' case must be added; configOrHelp pattern at lines 82-85 |
| src/comments/index.ts | Comments module router | 53-line module with subcommand switch, help handling, resolveTicket call; exact structural pattern for library module |
| src/lib/resolve-ticket.ts | Ticket resolution utility | 128 lines; extractTicketRef + matchTicket + resolveTicket pattern to replicate for library items |
| src/lib/http.ts | HTTP client | hxFetch with retry, timeout, backoff; all new commands use this |
| src/lib/flags.ts | Flag parsing | getFlag for --section, --rating; isHelpRequested for --help |
| skill-content/SKILL.md | Agent documentation | Lines 31-50 command table; must add library commands for agent discoverability |
| package.json | Build config | TypeScript build: 'tsc', test: 'tsc && node --test'; no new deps needed |

# Diagnosis Statement: helix-cli

## Problem Summary

The CLI has comment commands for tickets (`hlx comments list/post`) but no library commands at all. The ticket requires CLI and MCP access for library feedback — reading and posting section-level ratings and comments on library items, viewing other people's comments, and accessing discussion analysis. No `src/library/` module exists.

## Root Cause Analysis

This is a **feature gap**. The CLI has no library functionality:

- **Entry point** (src/index.ts): Switch-based router with commands for login, token, org, tickets, comments, inspect, skill, update. No "library" case.
- **No library module**: `src/library/` directory does not exist.
- **Comment commands** (src/comments/): Hard-coupled to `--ticket` flag and ticket API endpoints.
- **SKILL.md**: Documents all CLI operations for agent integration. No library commands documented.

### Command Module Pattern

The CLI uses a consistent module pattern that should be followed:
1. `src/library/index.ts` — router with usage text and subcommand dispatch
2. Individual subcommand files (list.ts, show.ts, comments.ts)
3. Flag parsing via `lib/flags.ts` (getFlag, hasFlag, isHelpRequested)
4. Item reference resolution (similar to `lib/resolve-ticket.ts` for tickets)

### CLI as Agent Interface

The ticket emphasizes agent accessibility: "A lot of the work is done in coding agents and of course we want to be able to do it in coding agents, with the Helix CLI, MCP or Helix skills." The CLI is the primary programmatic interface for agents via `hlx skill install`. New library commands must be documented in `skill-content/SKILL.md`.

### Section Targeting in CLI

CLI section targeting should use heading slugs consistent with rehype-slug: `--section "key-findings"`. The `hlx library show` command should display section headings with their slugs for discoverability. Agents can also target sections by quoted text for fuzzy matching.

### Implementation Scope (CLI)

1. **New module**: `src/library/index.ts` — router for library subcommands
2. **List command**: `src/library/list.ts` — list library items (GET /api/library/items)
3. **Show command**: `src/library/show.ts` — show report content with section headings and comment summaries
4. **Comments subcommands**:
   - `src/library/comments.ts` — router for comment subcommands
   - `src/library/comments-list.ts` — list comments with optional section filter
   - `src/library/comments-post.ts` — post rating + optional text targeting a section
5. **Item resolution**: `src/lib/resolve-library-item.ts` — resolve library item by ID, title, or ticket short ID
6. **Entry point update**: Add "library" case to src/index.ts switch router
7. **SKILL.md update**: Document all new library commands for agent discoverability

### Dependency

All CLI library commands depend on server API endpoints being implemented first. The CLI is a pure API consumer with no direct DB or Git access.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| src/index.ts | Switch router with 8 commands — no "library" case |
| src/comments/index.ts | Comment router: list and post subcommands, --ticket flag |
| src/comments/list.ts | GET /api/tickets/{ticketId}/comments with --helix-only, --since filters |
| src/comments/post.ts | POST /api/tickets/{ticketId}/comments with { content } body |
| src/tickets/index.ts | Ticket commands: list, get, create, continue, rerun — reference for library module structure |
| src/lib/flags.ts | getFlag(), hasFlag(), isHelpRequested() — used by all commands |
| src/lib/resolve-ticket.ts | Accepts ID, short ID, ticket number — pattern for library item resolution |
| src/lib/http.ts | API key/bearer auth, retry logic, org header — all library commands use this |
| skill-content/SKILL.md | Documents all CLI ops for agent integration — must include library commands |
| package.json | TypeScript-only deps, tsc build — no external CLI framework |

## Success Criteria

1. `hlx library list` displays library items with status, title, date
2. `hlx library show <ref>` displays report content with section headings/slugs and comment summaries
3. `hlx library comments list <ref> [--section <slug>]` lists comments with optional section filter
4. `hlx library comments post <ref> --section <slug> --rating <value> [message]` posts section feedback
5. Rating values are human-readable: thumbs-up, love, thumbs-down
6. SKILL.md documents all new commands for agent/MCP access
7. All commands use consistent flag parsing and error handling patterns
8. Library item resolution supports ID, title, or ticket short ID references

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Requirements and agent accessibility emphasis | CLI/MCP must support reading and posting library comments with section targeting |
| scout/reference-map.json (CLI) | Map CLI structure, command patterns | No library module; comment commands are ticket-scoped; consistent module pattern |
| scout/scout-summary.md (CLI) | Architecture overview | Switch-based routing, flag parsing, HTTP client, SKILL.md for agents |
| src/index.ts | CLI entry point | 8 commands in switch router — extension point for library |
| src/comments/ | Comment command pattern | Subcommand router with ticket resolution — reference for library commands |
| src/tickets/index.ts | Ticket command structure | list/get/create/continue/rerun — reference for library commands |
| src/lib/http.ts | API client | API key/bearer auth, retry logic — all library commands use this |
| skill-content/SKILL.md | Agent integration docs | Must include library commands for MCP/skill discoverability |

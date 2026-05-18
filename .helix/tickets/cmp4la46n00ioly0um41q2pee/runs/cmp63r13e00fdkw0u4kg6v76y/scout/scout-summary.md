# Scout Summary: helix-cli (Phase 2b)

## Problem

The CLI has no library-related commands. Agents and CLI users cannot discover, view, or interact with library reports and their feedback. Need to add `hlx library list|show|comments list|comments post` commands with item resolution, section targeting, and SKILL.md documentation for agent discoverability.

## Analysis Summary

### Command Dispatch
- **Main dispatcher** (`src/index.ts:72-124`): Switch statement pattern. Auth-required commands use `configOrHelp(args.slice(1))` then call a module router. No `library` case exists. Add it following the `comments` pattern (lines 87-91) or `tickets` pattern (lines 97-101).
- **Module router pattern** (`src/comments/index.ts`, 52 lines): Imports subcommands, dispatches via `switch` on `args[0]`. Usage function exits with help text. Subcommands receive `(config, resolvedId, args)`.

### Resolution Utility
- **Existing ticket resolution** (`src/lib/resolve-ticket.ts`, 128 lines): 3-strategy resolution (exact ID, exact shortId case-insensitive, numeric suffix match). Fetches ticket list via `hxFetch(config, "/tickets", { basePath: "/api" })`.
- **Library item resolution** needs adaptation: cuid detection (starts with 'c', 25 chars), ticket shortId match (`/^[A-Z]+-\d+$/`), and title substring fallback. Will fetch via `/library/items` endpoint.

### HTTP Client and Auth
- **hxFetch** (`src/lib/http.ts`): Auth via `X-API-Key` header (for `hxi_` prefix tokens) or `Bearer` token. Retry with exponential backoff (3 attempts). `basePath` option for path prefix. Library commands use `basePath: "/api"`.

### Flag Parsing
- **Flags** (`src/lib/flags.ts`): `getFlag(args, "--flag")` returns value after flag, `hasFlag` for boolean flags, `getPositionalArgs(args, excludeFlags)` for non-flag arguments, `requireFlag(args, flag, errorMsg)` for mandatory flags.
- Library commands need: `--section` (slug or heading text), `--rating` (thumbs-up/thumbs-down/love), `--reply-to` (parent comment ID).

### Output Formatting
- **Table output** (`src/tickets/list.ts`): `padEnd`-based column alignment with header row. JSON output via `--json` flag.
- **Comment output** (`src/comments/list.ts`): Line-by-line with bracket formatting (`[type]`), timestamps, author names.

### SKILL.md
- **Current format** (`skill-content/SKILL.md`): Frontmatter, Guardrails section, Environment Setup, Available Commands table (lines 32-50), Common Workflows with bash examples, Flag Conventions.
- **Library section** must be added to the Available Commands table with `hlx library list|show`, `hlx library comments list|post` entries.

### Module Structure
- No `src/library/` directory exists. All files are new:
  - `src/library/index.ts` — Router dispatching to list/show/comments
  - `src/library/list.ts` — List library items
  - `src/library/show.ts` — Show report with section annotations
  - `src/library/comments.ts` — Nested router for comment subcommands
  - `src/library/comments-list.ts` — List comments grouped by section
  - `src/library/comments-post.ts` — Post rating with optional text
  - `src/lib/resolve-library-item.ts` — Multi-format item resolution

## Relevant Files

| File | Role |
|------|------|
| `src/index.ts` | Add 'library' case to switch dispatcher (line ~121) |
| `src/comments/index.ts` | Pattern template for library module router |
| `src/comments/list.ts` | Pattern for comment list command |
| `src/comments/post.ts` | Pattern for comment post command |
| `src/lib/http.ts` | hxFetch HTTP client for API calls |
| `src/lib/flags.ts` | Flag parsing utilities |
| `src/lib/resolve-ticket.ts` | Pattern template for resolve-library-item.ts |
| `skill-content/SKILL.md` | Add library commands to Available Commands table |
| `src/tickets/list.ts` | Table output formatting pattern |
| `package.json` | Build: 'tsc'. No new deps. |
| `tsconfig.json` | Strict mode, ES2022, outDir dist |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|-------------|
| ticket.md Research Report | Primary specification for Phase 2b | 7 new files, 2 modified files. Commands: list, show, comments list, comments post. Resolution utility with 3 strategies. |
| src/index.ts | Verify command dispatcher pattern | Switch statement at lines 72-124. configOrHelp pattern for auth. No library case exists. |
| src/comments/index.ts | Verify module router pattern | Router dispatches to subcommands via switch. Usage function for help. 52 lines. |
| src/lib/resolve-ticket.ts | Verify resolution utility pattern | 3-strategy resolution (ID, shortId, number). Fetches list then matches. Adapt for library items. |
| src/lib/http.ts | Verify HTTP client pattern | hxFetch with auth headers, retry, basePath. Library uses basePath: '/api'. |
| src/lib/flags.ts | Verify flag parsing utilities | getFlag, hasFlag, getPositionalArgs, requireFlag available. Library needs --section, --rating. |
| skill-content/SKILL.md | Verify documentation format | Available Commands table at lines 32-50. Add library entries. |
| src/tickets/list.ts | Verify output formatting | padEnd column alignment, --json support. Reference for library list. |

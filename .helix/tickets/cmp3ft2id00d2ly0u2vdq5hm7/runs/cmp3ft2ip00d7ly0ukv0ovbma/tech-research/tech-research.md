# Tech Research: helix-cli — Library Comments and Iteration

## Technology Foundation

- **Runtime**: Node (TypeScript compiled via tsc, no bundler)
- **Architecture**: Switch-case CLI dispatcher (`src/index.ts` lines 72-124)
- **Module pattern**: `src/{domain}/index.ts` exports `runX(config, args)` dispatching to `cmd*` functions
- **HTTP client**: `hxFetch(config, path, { basePath: '/api' })` with auth headers and retry
- **Flag parsing**: Custom `src/lib/flags.ts` — `getFlag()`, `hasFlag()`, `getPositionalArgs()`
- **Agent discovery**: `skill-content/SKILL.md` documents all commands for agent integration
- **Build**: `tsc` (no bundler); Test: `tsc && node --test`

## Architecture Decision

### Option A: New `src/library/` Module with Nested Comments Router (chosen)

New module following the established domain module pattern. `src/library/index.ts` dispatches to list, show, and comments subcommands. `comments.ts` is a nested router dispatching to `comments-list.ts` and `comments-post.ts`.

### Option B: Extend Existing `src/comments/` Module with --library Flag (rejected)

Add `--library` flag to existing `hlx comments list` and `hlx comments post` commands. This conflates two domains (ticket comments vs. library comments), creates awkward UX (`hlx comments post --library --item X --section Y`), and the existing comments module is tightly coupled to `--ticket` flag resolution.

### Rationale for Option A

Library items and ticket comments are distinct domains with different API endpoints, reference resolution, interaction patterns (section anchoring, ratings), and output formatting. A separate module provides intuitive command hierarchy (`hlx library list`, `hlx library show`, `hlx library comments post`) consistent with how tickets and comments are already separate modules.

## Core API/Methods

### Module Structure

```
src/library/
  index.ts              # Router: dispatches to list, show, comments
  list.ts               # hlx library list
  show.ts               # hlx library show <ref>
  comments.ts           # Nested router: dispatches to comments-list, comments-post
  comments-list.ts      # hlx library comments list <ref>
  comments-post.ts      # hlx library comments post <ref>

src/lib/
  resolve-library-item.ts  # Resolve by cuid, ticket short ID, or title
```

### Top-Level Dispatch (src/index.ts)

Add `'library'` case to the switch-case dispatcher (between existing cases around line 72-124):

```typescript
case 'library':
  return runLibrary(config, args.slice(1));
```

### Module Router (src/library/index.ts)

Pattern: identical to `src/comments/index.ts`.

```
runLibrary(config, args):
  subcommand = args[0]
  switch(subcommand):
    'list' -> cmdLibraryList(config, args.slice(1))
    'show' -> cmdLibraryShow(config, args.slice(1))
    'comments' -> runLibraryComments(config, args.slice(1))
    default -> usage()
```

### Commands

**`hlx library list`** (`list.ts`)
- Endpoint: `GET /api/library/items`
- Output: Tabular format with ID (truncated), title, status, date
- No required flags

**`hlx library show <ref>`** (`show.ts`)
- Resolution: `resolveLibraryItem(config, ref)` — cuid, ticket short ID, or title
- Endpoint: `GET /api/library/items/{itemId}` (returns content)
- Endpoint: `GET /api/library/items/{itemId}/comments/summary` (returns per-section counts)
- Output: Heading-level view with section slugs annotated in brackets and comment summary counts
- Optional `--full` flag for complete markdown content

**`hlx library comments list <ref> [--section <slug>]`** (`comments-list.ts`)
- Resolution: same as show
- Endpoint: `GET /api/library/items/{itemId}/comments` (optional `?anchor=` query param)
- Output: Comments grouped by section, with rating badges, author names, text, timestamps
- Threaded display: replies indented under parent with `->` prefix

**`hlx library comments post <ref> --section <slug> --rating <value> [message]`** (`comments-post.ts`)
- Resolution: same as show
- Required flags: `--section` (heading slug), `--rating` (thumbs-up|love|thumbs-down)
- Optional: positional message text after all flags
- Endpoint: `POST /api/library/items/{itemId}/comments`
- Body: `{ anchor, rating, content? }`
- Rating mapping: CLI value -> API value (`thumbs-up` -> `THUMBS_UP`, `love` -> `LOVE`, `thumbs-down` -> `THUMBS_DOWN`; shorthands: `up`, `down`)

### Item Resolution (src/lib/resolve-library-item.ts)

Three strategies with priority ordering:

1. **cuid**: Input starts with `'c'` and is 25 characters -> use as `itemId` directly
2. **Ticket short ID**: Input matches `/^[A-Z]+-\d+$/` (e.g., `RSH-439`) -> call `GET /api/library/items?ticketShortId={shortId}`, return latest item
3. **Title match**: Fallback -> call `GET /api/library/items`, find case-insensitive title substring match

Functions:
- `extractLibraryRef(args: string[]): string | undefined` — extracts ref from `--item` flag or first positional arg
- `resolveLibraryItem(config, ref): Promise<{ id: string; title: string }>` — API-backed resolution

### SKILL.md Update

Add a Library section after the existing Available Commands sections:

```markdown
## Library

### List library items
`hlx library list`

### Show library item with section headings and feedback summary
`hlx library show <ref>`
- `<ref>` can be item ID, ticket short ID (e.g., RSH-439), or title

### List comments on a library item
`hlx library comments list <ref> [--section <slug>]`
- `--section`: Filter by heading slug (e.g., "key-findings")

### Post feedback on a library report section
`hlx library comments post <ref> --section <slug> --rating <value> [message]`
- `--rating`: thumbs-up, love, or thumbs-down (shorthands: up, love, down)
- `--section`: Heading slug (shown in `hlx library show` output)
- `[message]`: Optional text context
```

This is critical for agent discoverability. Agents read SKILL.md to understand available CLI capabilities.

## Technical Decisions

### 1. New Library Module vs. Extended Comments Module

| Aspect | Detail |
|--------|--------|
| **Chosen** | New `src/library/` module with own router |
| **Rejected** | `--library` flag on existing comments commands — conflates domains, awkward UX |
| **Rationale** | Distinct API endpoints, reference resolution, and interaction patterns (section anchoring, ratings). Intuitive hierarchy: `hlx library comments post`. |

### 2. Item Resolution: Three Strategies

| Aspect | Detail |
|--------|--------|
| **Chosen** | cuid > ticket short ID > title match, with API-backed resolution |
| **Rejected** | cuid-only — poor ergonomics; title-only — ambiguous |
| **Rationale** | Parallels `resolve-ticket.ts` which supports ID, shortId, and number. The ticket short ID strategy is the most common use case: agents and users reference reports by ticket (e.g., `RSH-439`), not by library item cuid. |

### 3. Show Command: Heading-Level Summary vs. Full Content

| Aspect | Detail |
|--------|--------|
| **Chosen** | Heading-level view by default, `--full` for complete content |
| **Rejected** | Always full content — reports can be 1000+ lines, unwieldy in terminal |
| **Rationale** | The primary purpose of `show` is to discover section slugs for the `--section` flag. Heading-level view with annotated slugs and comment counts serves this use case. Full content is available via `--full` for inspection needs. |

### 4. Rating Flag Mapping

| Aspect | Detail |
|--------|--------|
| **Chosen** | Human-readable CLI values (`thumbs-up`) mapped to API values (`THUMBS_UP`) |
| **Rejected** | Using API values directly (`THUMBS_UP`) — unfriendly for terminal use |
| **Rationale** | CLI flags should be human-readable. The mapping is simple and happens in `comments-post.ts` before the API call. Shorthands (`up`, `down`, `love`) provide quick input for power users. |

### 5. Section Slug Convenience: Text-to-Slug Fallback

| Aspect | Detail |
|--------|--------|
| **Chosen** | Accept both raw slugs (`key-findings`) and heading text (`"Key Findings"`) with automatic slugification |
| **Rejected** | Raw slugs only — requires the user to know the exact slug format |
| **Rationale** | If the value contains spaces or uppercase letters, slugify it (lowercase, replace spaces with hyphens, remove special chars). This matches rehype-slug's GitHub-flavored algorithm. The `report-helpers.ts` in the client has a `slugify()` function — the CLI implements the same logic. |

## Cross-Platform Considerations

- **Agent workflow**: The primary consumer is the coding agent iterating on a report. The workflow is: `hlx library show RSH-439` (discover sections) -> `hlx library comments list RSH-439` (read feedback) -> `hlx library comments post RSH-439-v2 --section key-findings --rating love "Rewrote based on feedback"`.
- **Non-interactive**: All commands are non-interactive. No TTY prompts, no interactive selection. Arguments and flags provide all input.
- **Auth**: Uses `hxFetch` with config.apiKey (hxi_ token) or Bearer token. Same auth mechanism as all other CLI commands.
- **Exit codes**: 0 on success, 1 on error (invalid args, API error, resolution failure). Error messages go to stderr.

## Performance Expectations

| Operation | Expected Behavior | Notes |
|-----------|------------------|-------|
| `hlx library list` | <500ms | Single API call |
| `hlx library show <ref>` | <1s | Resolution + item fetch + summary fetch (2-3 API calls) |
| `hlx library comments list` | <500ms | Resolution + comments fetch |
| `hlx library comments post` | <500ms | Resolution + POST |

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| TypeScript | (existing) | Type-safe CLI code |
| src/lib/http.ts | — | hxFetch HTTP client with auth |
| src/lib/flags.ts | — | Flag parsing (getFlag, hasFlag, getPositionalArgs) |
| src/lib/config.ts | — | HxConfig loading |

No new npm dependencies required. All functionality uses existing utilities.

## Deferred to Round 2

- `--json` flag for machine-readable output (structured JSON instead of formatted text)
- `hlx library diff <ref> --v1 <version> --v2 <version>` (section-level version comparison)
- `hlx library comments summarize <ref>` (AI-generated feedback summary)
- Interactive section selection (fzf-style fuzzy finder for `--section`)
- `--reply-to <commentId>` flag for threaded replies via CLI

## Summary Table

| Decision | Choice | Key Reason |
|----------|--------|------------|
| Module structure | New `src/library/` with nested comments router | Distinct domain from ticket comments |
| Item resolution | cuid > short ID > title | Parallels resolve-ticket.ts; ticket short ID is common case |
| Show format | Heading-level summary (default) | Primary use: discover slugs + see feedback counts |
| Rating flags | Human-readable with mapping | Terminal-friendly; shorthands for power users |
| Section input | Slug + text-to-slug fallback | Convenience: `"Key Findings"` auto-slugifies |
| SKILL.md | New Library section | Agent discoverability is critical |

## APL Statement Reference

The CLI needs a new `src/library/` module following the established switch-case routing pattern with a nested comments subcommand router. `resolve-library-item.ts` supports cuid, ticket short ID, and title match resolution. `hlx library show` renders heading-level summaries with slugs and comment counts. All commands use basePath `/api` with the existing hxFetch client. SKILL.md update is critical for agent discoverability.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (Research Report) | Primary specification | CLI module structure, 4 commands, rating flag values, section targeting, SKILL.md content, item resolution strategies, agent workflow example |
| product/product.md | MVP scope | CLI commands are essential feature #9; success criterion #4: agents can read feedback via CLI |
| diagnosis/diagnosis-statement.md (CLI) | Gap analysis | No library module exists; established module pattern identified; SKILL.md needs Library section |
| diagnosis/apl.json (CLI) | Technical investigation | Confirmed module routing pattern, flag parsing, basePath usage, resolution utility pattern |
| scout/reference-map.json (CLI) | File mapping | Specific files for src/index.ts dispatch, comments module pattern, SKILL.md |
| scout/scout-summary.md (CLI) | Architecture context | Switch-case routing, flag parsing (getFlag/hasFlag), hxFetch with basePath, configOrHelp pattern |
| src/comments/index.ts | Module pattern verification | Router dispatches to cmdCommentsList and cmdCommentsPost |
| src/lib/resolve-ticket.ts | Resolution pattern verification | extractTicketRef + matchTicket with priority ordering |
| src/lib/flags.ts | Flag parsing verification | getFlag, hasFlag, getPositionalArgs utilities |
| skill-content/SKILL.md | Agent documentation verification | 148 lines; no Library section exists |

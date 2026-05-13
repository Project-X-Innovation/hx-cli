# Tech Research: Library Comments and Iteration (helix-cli)

## Technology Foundation

- **Runtime**: Node.js + TypeScript (strict mode)
- **HTTP**: hxFetch (src/lib/http.ts) with retry (3 attempts), timeout (30s), exponential backoff
- **CLI Framework**: Hand-rolled switch-based routing (no commander/yargs dependency)
- **Flag Parsing**: getFlag, requireFlag, hasFlag, isHelpRequested (src/lib/flags.ts)
- **Config**: HxConfig with API base URL and auth token (src/lib/config.ts)
- **Build**: `tsc`
- **No new dependencies required**

## Architecture Decision 1: Separate Module vs. Extension of Comments Module

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Separate src/library/ module** | New directory with own router and command files | Clean separation; different API endpoints, resolution, flags | More files |
| B: Extend src/comments/ with library subcommand | Add 'library' case to comments router | Shared infrastructure | Conflates ticket comments with library comments; different resolution logic |

### Chosen: Option A — Separate src/library/ Module

**Rationale**: Library commands use different API endpoints (`/library/items` vs `/tickets`), different resolution logic (library item vs ticket), and different flags (`--section`, `--rating`). Merging them into the comments module would create confusing command structure. The product spec explicitly states: "Separate module, not extension."

### Module Structure

```
src/library/
├── index.ts          # runLibrary(): subcommand router (list, show, comments)
├── list.ts           # cmdLibraryList(): hlx library list
├── show.ts           # cmdLibraryShow(): hlx library show <ref>
└── comments.ts       # cmdLibraryCommentsList() + cmdLibraryCommentsPost()

src/lib/
└── resolve-library-item.ts  # extractLibraryRef + resolveLibraryItem
```

### Router Pattern

Following src/comments/index.ts (53 lines):

```typescript
export async function runLibrary(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "list": ...
    case "show": { const ref = extractLibraryRef(rest); ... }
    case "comments": {
      const nestedSub = rest[0]; // "list" or "post"
      switch (nestedSub) {
        case "list": ...
        case "post": ...
      }
    }
    default: libraryUsage();
  }
}
```

## Architecture Decision 2: Library Item Resolution Strategy

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: List-based matching (resolve-ticket pattern)** | Fetch all items, match locally | Single API call; supports fuzzy matching | Full list fetch; needs ticketShortId in response |
| B: Direct ID lookup only | Require exact cuid | Simplest | Poor UX; agents rarely have cuids |
| C: Server-side search endpoint | New search API | Offloads matching | Requires new server endpoint |

### Chosen: Option A — List-Based Matching

**Rationale**: Mirrors resolve-ticket.ts (128 lines) which fetches the ticket list and matches locally. The matching priority is:
1. **Exact cuid** — direct match on item.id
2. **Ticket short ID** — match on item.ticketShortId (e.g., "RSH-439")
3. **Title substring** — case-insensitive match on item.title

**Dependency**: The server must include `ticketShortId` in the GET `/library/items` response. The server tech research recommends this enhancement (a minor join on the Ticket relation). Without this, short-ID resolution requires fetching detail for each item.

### Resolution Utility: `src/lib/resolve-library-item.ts`

Following src/lib/resolve-ticket.ts pattern:

| Function | Purpose |
|----------|---------|
| `extractLibraryRef(args)` | Extract ref from `--item` flag or positional arg |
| `resolveLibraryItem(config, rawRef)` | Fetch items list, match by cuid/shortId/title, return resolved item |

## Architecture Decision 3: `hlx library show` Output Format

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Header + section index + full markdown** | Three-part output | Complete information; agents can grep for section slugs | Verbose for long reports |
| B: Metadata only with headings list | No content | Compact | Insufficient for agent context |
| C: Inline annotations in markdown | Insert comment counts next to headings in the content | Self-contained | Modifies original content; harder to parse |

### Chosen: Option A — Header + Section Index + Full Markdown

**Rationale**: Agents need both the section structure (for `--section` flags) and the full content (for understanding what to modify). The output format is:

```
Title: Market Analysis Report
Status: PUBLISHED
Version: 2026-05-10
Ticket: RSH-439

Sections:
  executive-summary        3 comments (2 thumbs-up, 1 love)
  key-findings             1 comment  (1 thumbs-down)
  methodology              0 comments
  recommendations          5 comments (2 thumbs-up, 2 love, 1 thumbs-down)

---

# Executive Summary
...full markdown content...
```

This requires two API calls:
1. `GET /library/items/:itemId` — metadata + content
2. `GET /library/items/:itemId/comments/summary` — per-anchor counts

These can be fetched in parallel with `Promise.all()`.

## Core API/Methods

### New Commands

| Command | API Calls | Flags | Output |
|---------|-----------|-------|--------|
| `hlx library list` | GET `/library/items` | none | Table: title, status, shortId, date |
| `hlx library show <ref>` | GET `/library/items/:id` + GET `.../comments/summary` | none | Header + section index + markdown |
| `hlx library comments list <ref>` | GET `/library/items/:id/comments` | `--section <slug>` (optional) | Comments grouped by section |
| `hlx library comments post <ref>` | POST `/library/items/:id/comments` | `--section <slug>` (required), `--rating <value>` (required) | Success message |

### Flag Mapping

| CLI Flag | Server Field | Values | Validation |
|----------|-------------|--------|------------|
| `--section <slug>` | `anchor` | Any string (heading slug or text, auto-slugified) | Required for post; optional for list |
| `--rating <value>` | `rating` | `thumbs-up`/`up`, `love`, `thumbs-down`/`down` | Required for post; maps to THUMBS_UP/LOVE/THUMBS_DOWN |

Rating mapping:
```typescript
const RATING_MAP: Record<string, string> = {
  "thumbs-up": "THUMBS_UP",
  "up": "THUMBS_UP",
  "love": "LOVE",
  "thumbs-down": "THUMBS_DOWN",
  "down": "THUMBS_DOWN",
};
```

### Section Auto-Slugification

When `--section "Key Findings"` is passed (with spaces), the CLI slugifies it to `key-findings` before sending to the server. This matches the rehype-slug algorithm (lowercase, hyphenated). When a raw slug is passed (e.g., `--section key-findings`), it's sent as-is.

### Main Router Integration

`src/index.ts` — add 'library' case to the switch statement (following lines 87-90 pattern):

```typescript
case "library": {
  const config = configOrHelp(args.slice(1));
  await runLibrary(config, args.slice(1));
  break;
}
```

### SKILL.md Update

`skill-content/SKILL.md` — add Library section to the command table (after Tickets section):

| Command | Description |
|---------|------------|
| `hlx library list` | List library items |
| `hlx library show <ref>` | Show report with section annotations |
| `hlx library comments list <ref> [--section <slug>]` | List comments for a library item |
| `hlx library comments post <ref> --section <slug> --rating <value> [message]` | Post feedback on a section |

Plus agent workflow example for the library feedback loop.

## Technical Decisions

### Message as Positional Arg (Not Flag)
For `hlx library comments post`, the optional message text comes from remaining positional arguments after flags are consumed (same pattern as src/comments/post.ts). Example: `hlx library comments post RSH-439 --section key-findings --rating love "Great analysis"`.

### Parallel API Calls for Show
`hlx library show` fetches item detail and comment summary in parallel via `Promise.all()`. This follows the Vercel best practice `async-parallel` (use Promise.all for independent operations).

### No Test Infrastructure Change
The existing CLI has minimal test infrastructure (resolve-ticket.test.ts). New library module tests follow the same pattern. No test framework changes needed.

### Rejected: --json Output Flag
Structured JSON output is deferred to future enhancement. MVP output is plain text, optimized for human readability and agent parsing.

### Rejected: Interactive Section Selection
fzf-style interactive selection would require a terminal UI dependency. Not needed for MVP.

### Rejected: Comment Edit/Delete Commands
PATCH/DELETE operations from CLI are deferred. MVP supports post-only (write) and list (read).

## Cross-Platform Considerations

### Server API Contract Dependency

The CLI depends on the server (Phase 1) for:
- GET `/library/items` — list with ticketShortId (enhancement)
- GET `/library/items/:id` — item detail with content
- GET `/library/items/:id/comments` — comment list with optional anchor filter
- GET `/library/items/:id/comments/summary` — per-anchor counts
- POST `/library/items/:id/comments` — create comment

The CLI can be developed against the type definitions while the server is being built.

### Shared Anchor Contract

The CLI must use the same anchor format as the client and server. When a user passes `--section "Key Findings"`, the CLI slugifies it using the same algorithm as rehype-slug (lowercase, hyphens for spaces, strip non-alphanumeric). This ensures the anchor matches what the client generates.

## Performance Expectations

| Operation | Target | Approach |
|-----------|--------|----------|
| Library list | <500ms | Single API call; hxFetch with retry |
| Library show | <1s | Two parallel API calls (Promise.all) |
| Comments list | <500ms | Single API call with optional anchor filter |
| Comments post | <500ms | Single POST request |
| Item resolution | <500ms | List fetch + local matching |

## Dependencies

| Dependency | Status | Role |
|------------|--------|------|
| hxFetch (src/lib/http.ts) | Already present | HTTP client with retry |
| getFlag/requireFlag (src/lib/flags.ts) | Already present | Flag parsing |
| loadConfig/requireConfig (src/lib/config.ts) | Already present | Config loading |

**No new npm dependencies needed.**

## Deferred to Round 2

| Item | Reason | Priority |
|------|--------|----------|
| `--json` output flag | Pipeline integration enhancement | Medium |
| Comment edit/delete commands | PATCH/DELETE from CLI | Medium |
| Interactive section picker | Requires terminal UI library | Low |
| Reply threading from CLI | Post replies to existing comments | Low |
| Rich terminal formatting (colors, tables) | Enhancement beyond MVP | Low |

## Summary Table

| Decision | Choice | Confidence |
|----------|--------|------------|
| Module structure | Separate src/library/ directory | High — different API, resolution, flags justify separation |
| Item resolution | List-based matching (cuid > shortId > title) | High — mirrors resolve-ticket.ts pattern |
| Show output | Header + section index + full markdown | High — agents need both structure and content |
| Rating mapping | CLI aliases (up/down) to server values | High — user-friendly flags |
| Section handling | Auto-slugify text input; pass slugs as-is | High — matches rehype-slug contract |
| SKILL.md update | Library section with 4 commands + workflow example | High — critical for agent discoverability |

## APL Statement Reference

The CLI needs a new src/library/ module (separate from src/comments/) with four commands following the established switch-based routing and module patterns. Library item resolution mirrors resolve-ticket.ts with cuid/shortId/title matching, requiring the server to include ticketShortId in the list response. 'hlx library show' outputs a metadata header + section index (slugs with comment counts) + full markdown content. Flag parsing uses existing getFlag/requireFlag utilities for --section and --rating.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (cli) | Problem statement | Implementation ticket for RSH-443 research |
| diagnosis/diagnosis-statement.md (cli) | Root cause and success criteria | 4 gaps; established patterns for all components |
| diagnosis/apl.json (cli) | Diagnostic findings | Module structure; item resolution; SKILL.md scope |
| product/product.md (cli) | Feature scope and constraints | 8 essential features; agent workflow; resolution strategies |
| scout/reference-map.json (cli) | File inventory and facts | 10 files; switch-based routing; --section/--rating flags |
| repo-guidance.json | Repo intent and phasing | CLI is Phase 2b; parallel with client; depends on server |
| src/index.ts (lines 72-124) | Command router | Switch-based dispatch; 'comments' case as template |
| src/comments/index.ts | Module router pattern | 53-line subcommand dispatch; configOrHelp; resolveTicket |
| src/lib/resolve-ticket.ts | Resolution pattern | extractTicketRef + matchTicket; priority: cuid > shortId > number |
| src/lib/flags.ts | Flag utilities | getFlag, requireFlag, isHelpRequested |
| Server tech research | API contract | ticketShortId in list response; comment summary endpoint shape |

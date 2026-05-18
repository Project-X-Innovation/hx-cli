# Tech Research: helix-cli (Phase 2b) — Library Commands

## Technology Foundation

| Technology | Version | Purpose |
|-----------|---------|---------|
| TypeScript | tsc (no bundler) | Compilation; .js extension required in imports |
| Node.js | ES2022 target | Runtime |
| hxFetch | src/lib/http.ts | HTTP client with auth, retry, basePath |
| Flag parsing | src/lib/flags.ts | getFlag, hasFlag, getPositionalArgs, requireFlag |
| SKILL.md | skill-content/ | Agent discoverability documentation |

No new npm dependencies required. Build is TypeScript-only (`tsc`).

## Architecture Decision

### Module Structure: New src/library/ Module (not Extending Comments)

**Options Considered:**

| Option | Description | Verdict |
|--------|-------------|---------|
| **A: New src/library/ module (chosen)** | Separate module with own router, resolution, and commands | Clean separation; distinct domain |
| B: Extend comments module | Add `--library` flag to existing `hlx comments` | Conflates domains; awkward UX; different API endpoints and resolution |

**Chosen: A** — Library comments have distinct API endpoints (`/library/items/:itemId/comments` vs `/tickets/:ticketId/comments`), distinct resolution (library item vs ticket), and unique features (section anchoring, ratings). The `src/comments/index.ts` module router pattern (52 lines) is directly replicable for the new module.

### Item Resolution: 3-Strategy Adaptation

**Options Considered:**

| Option | Description | Verdict |
|--------|-------------|---------|
| **A: Client-side 3-strategy matching (chosen)** | Fetch library items list, match by cuid/shortId/title | Follows resolve-ticket.ts pattern; flexible |
| B: Server-side resolution | Pass ref to server, let server resolve | Would require new server endpoints or query parameters |

**Chosen: A** — Adapt the `resolve-ticket.ts` pattern (128 lines): fetch items list via `GET /library/items`, then match client-side using three strategies:
1. **cuid**: Starts with 'c', 25 chars — exact `id` match
2. **ticket shortId**: Matches `/^[A-Z]+-\d+$/` — find item where ticket shortId matches
3. **title match**: Fallback — case-insensitive substring match on title

### Nested Router: Library > Comments

**Chosen:** `src/library/index.ts` dispatches to `list`, `show`, and `comments` subcommands. `src/library/comments.ts` is a nested router dispatching to `list` and `post`.

```
hlx library list              -> src/library/list.ts
hlx library show <ref>        -> src/library/show.ts
hlx library comments list <ref> -> src/library/comments-list.ts
hlx library comments post <ref> -> src/library/comments-post.ts
```

This two-level routing follows the established pattern where `comments` is itself a dispatcher, mirroring how `src/comments/index.ts` dispatches to its own `list.ts` and `post.ts`.

## Core API/Methods

### Commands

| Command | API Call | Output |
|---------|---------|--------|
| `hlx library list` | `GET /library/items` | Table: ID, title, status, date |
| `hlx library show <ref>` | `GET /library/items/:id` + `GET /library/items/:id/comments/summary` | Report headings with [slug] annotations and comment summaries |
| `hlx library comments list <ref> [--section <slug>]` | `GET /library/items/:id/comments[?anchor=slug]` | Comments grouped by section with ratings, authors, text |
| `hlx library comments post <ref> --section <slug> --rating <value> [message]` | `POST /library/items/:id/comments` | Confirmation with rating, section, and text |

### Item Resolution Utility (src/lib/resolve-library-item.ts)

Adapts the `resolve-ticket.ts` pattern:

```
extractLibraryItemRef(args) -> rawRef string
resolveLibraryItem(config, rawRef) -> { id, title, ticketShortId }
```

Resolution strategies:
1. **cuid detection**: `/^c[a-z0-9]{24}$/` — direct ID lookup
2. **ticket shortId**: `/^[A-Z]+-\d+$/` — match against item's ticket shortId
3. **title fallback**: Case-insensitive substring match

### Section Targeting

The `--section` flag supports two formats:
- Raw slug: `--section key-findings` (used directly as anchor)
- Heading text: `--section "Key Findings"` (auto-slugified: lowercase, spaces to hyphens, strip non-alphanumeric)

Detection: if the value contains uppercase letters or spaces, slugify. Otherwise use as-is.

### Rating Flag

`--rating` accepts: `thumbs-up`, `up`, `thumbs-down`, `down`, `love`. Normalized to server values: `THUMBS_UP`, `THUMBS_DOWN`, `LOVE`.

### Threading

`--reply-to <commentId>` flag for posting replies to existing comments.

## Technical Decisions

### 1. Resolution: Client-Side Matching

**Chosen:** Fetch full library items list, then match client-side.
**Rejected:** Server-side resolution endpoint (would require new API surface).
**Rationale:** Consistent with resolve-ticket.ts pattern. Library item lists are small (typically <50 items per org). Network overhead of fetching the list is negligible vs. adding server-side resolution logic.

### 2. Section Slug Discovery via `show` Command

**Chosen:** `hlx library show` annotates headings with `[slug]` (e.g., `## Key Findings [key-findings] (2 comments: 1 thumbs-up, 1 love)`).
**Rationale:** Agents need to discover valid `--section` values. Showing the slug inline with the heading makes it immediately usable in subsequent `comments post` commands.

### 3. Output Formatting: Simple Console (not JSON by default)

**Chosen:** Human-readable console output with `padEnd`-based column alignment for tables and bracketed formatting for comments.
**Rejected (deferred):** `--json` output flag — deferred to a future pass.
**Rationale:** Agent discoverability (SKILL.md) is the primary concern. Text output is parseable by agents. JSON output is a nice-to-have but not MVP.

### 4. SKILL.md Update: Critical for Agent Discoverability

**Chosen:** Add a `## Library` section to SKILL.md's Available Commands table with all 4 command variants and flag descriptions.
**Rationale:** Agents read SKILL.md to discover CLI capabilities. Without this update, the library feature is invisible to automated workflows. This is as important as the commands themselves.

### 5. Import Paths: .js Extension Required

**Chosen:** All imports use `.js` extensions (e.g., `import { cmdList } from "./list.js"`).
**Rationale:** tsconfig targets ES2022 with module resolution that requires explicit extensions. This is the established pattern across all CLI source files.

## Cross-Platform Considerations

- **Server API dependency**: CLI consumes the Phase 1 server API contract. All commands make HTTP calls via `hxFetch` with `basePath: '/api'`.
- **Anchor contract**: Section slugs are generated by rehype-slug (server/client) and displayed via `hlx library show`. The CLI auto-slugifies heading text to match.
- **Auth**: Uses existing `hxFetch` auth (X-API-Key for `hxi_` prefix tokens, Bearer for session tokens). No new auth mechanism needed.

## Performance Expectations

| Operation | Expected Behavior | Mechanism |
|-----------|-------------------|-----------|
| `hlx library list` | <500ms | Single API call to /library/items |
| `hlx library show <ref>` | <1s | Item detail + summary API calls |
| `hlx library comments list` | <500ms | Single API call with optional anchor filter |
| `hlx library comments post` | <500ms | Single POST request |
| Item resolution | <500ms | Fetch list + client-side matching |

## Dependencies

| Dependency | Type | Risk |
|-----------|------|------|
| Server Phase 1 API contract | Cross-repo | Low — API shape defined in research report; CLI implements after server |
| hxFetch HTTP client | Existing utility | None — established in src/lib/http.ts |
| Flag parsing utilities | Existing utility | None — getFlag/hasFlag/requireFlag in src/lib/flags.ts |
| resolve-ticket.ts pattern | Existing pattern | None — 128-line pattern adapted for library items |
| comments/index.ts router | Existing pattern | None — 52-line router pattern directly replicable |

## Deferred to Round 2

| Feature | Why Deferred |
|---------|-------------|
| `--json` output flag | Output formatting layer; add in a future pass |
| Interactive section selection (fzf) | Terminal UI library dependency |
| Comment editing/deletion from CLI | Read and create are primary agent workflows |
| SSE streaming in terminal | CLI is request-response; real-time is a UI concern |
| `hlx library diff <ref1> <ref2>` | Cross-iteration comparison is a significant standalone feature |

## Summary Table

| Aspect | Decision |
|--------|----------|
| Module structure | New src/library/ with own router (not extending comments) |
| Item resolution | 3-strategy client-side matching (cuid, shortId, title) |
| Section targeting | Raw slugs and auto-slugified heading text |
| Routing | Two-level: library > [list, show, comments > [list, post]] |
| Output | Human-readable console; --json deferred |
| Agent discoverability | SKILL.md update (critical) |
| Import convention | .js extensions required |
| New files | 7 |
| Modified files | 2 |
| New dependencies | 0 |

## APL Statement

The CLI (Phase 2b) adds a new src/library/ module with 7 new files following the established comments module router pattern. Item resolution adapts the 3-strategy resolve-ticket.ts pattern for cuid/shortId/title matching. Section targeting supports both raw slugs and auto-slugified heading text. SKILL.md update is critical for agent discoverability. 7 new files, 2 modified files, no new dependencies.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|-------------|
| ticket.md (Research Report) | Primary specification | 9 CLI implementation steps, command formats, resolution strategies, SKILL.md update |
| diagnosis/apl.json (cli) | Starting investigation context | No library commands exist; all patterns established |
| diagnosis/diagnosis-statement.md (cli) | Root cause and scope | 7 new + 2 modified files; greenfield feature |
| product/product.md (cli) | Product requirements | 8 essential features; agent-first discoverability; section targeting |
| scout/reference-map.json (cli) | Key file identification | 11 files mapped; no library case in dispatcher |
| scout/scout-summary.md (cli) | Codebase pattern analysis | Router, resolution, flag, output formatting patterns all established |
| repo-guidance.json | Repo intent | CLI confirmed as Phase 2b target |
| src/index.ts:72-124 | Direct code inspection | Switch dispatcher; no library case; comments pattern at 87-91 |
| src/comments/index.ts:1-52 | Direct code inspection | Module router pattern with subcommand dispatch |
| src/lib/resolve-ticket.ts | Pattern reference | 3-strategy resolution pattern to adapt |
| src/lib/flags.ts | Utility reference | getFlag, hasFlag, getPositionalArgs, requireFlag available |
| src/lib/http.ts | Utility reference | hxFetch with auth, retry, basePath |

# Implementation Plan: helix-cli (Phase 2b) — Library Commands

## Overview

Add a new `src/library/` module to helix-cli with commands for listing library items, showing reports with section annotations, listing comments, and posting section ratings. Also create a library item resolution utility and update SKILL.md for agent discoverability. This Phase 2b consumes the server API contract established in Phase 1.

## Implementation Principles

- **Follow established patterns**: Mirror the `src/comments/` module router, `resolve-ticket.ts` resolution utility, and `hxFetch` HTTP client patterns exactly.
- **No new npm dependencies**: Build is TypeScript-only (`tsc`), no bundler.
- **Agent-first discoverability**: SKILL.md update is critical — agents read it to discover CLI capabilities.
- **Import conventions**: All imports use `.js` extensions (e.g., `import { x } from "./list.js"`), matching the established codebase convention.
- **Distinct module**: Library commands have distinct API endpoints, resolution, and interaction patterns from ticket comments.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Create item resolution utility | `src/lib/resolve-library-item.ts` |
| 2 | Create module router | `src/library/index.ts` |
| 3 | Create list command | `src/library/list.ts` |
| 4 | Create show command | `src/library/show.ts` |
| 5 | Create comments router | `src/library/comments.ts` |
| 6 | Create comments list command | `src/library/comments-list.ts` |
| 7 | Create comments post command | `src/library/comments-post.ts` |
| 8 | Register in main dispatcher | `src/index.ts` updated |
| 9 | Update SKILL.md | `skill-content/SKILL.md` updated |

## Detailed Implementation Steps

### Step 1: Item Resolution Utility

**Goal**: Create a multi-format library item resolution utility.

**What to Build**:
- Create `src/lib/resolve-library-item.ts` adapting the `resolve-ticket.ts` pattern (128 lines).
- `extractLibraryItemRef(args)`: extracts ref from positional args (first non-flag arg).
- `resolveLibraryItem(config, rawRef)`: fetches `GET /library/items` via `hxFetch(config, "/library/items", { basePath: "/api" })`, then matches using 3 strategies:
  1. **cuid**: `/^c[a-z0-9]{24}$/` — exact id match.
  2. **ticket shortId**: `/^[A-Z]+-\d+$/` — match against item's ticket shortId (from LibraryItemDetail response).
  3. **title fallback**: case-insensitive substring match on title.
- Returns `{ id, title, ticketShortId }`.
- Error handling: throw descriptive error if no match or multiple matches.

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- Resolution utility exports both functions.
- `tsc` compiles without errors.

### Step 2: Module Router

**Goal**: Create the library module router dispatching to subcommands.

**What to Build**:
- Create `src/library/index.ts` following `src/comments/index.ts` pattern (52 lines).
- `runLibrary(config, args)`:
  - Parse subcommand from `args[0]`.
  - Switch: `list` -> `cmdList`, `show` -> resolve item then `cmdShow`, `comments` -> resolve item then `runLibraryComments`.
  - Usage function with help text for `hlx library list|show|comments`.
  - Help flag detection.

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- Router dispatches to list/show/comments.
- `tsc` compiles.

### Step 3: List Command

**Goal**: Create `hlx library list` to display library items.

**What to Build**:
- Create `src/library/list.ts`.
- `cmdList(config, args)`:
  - Fetch `GET /library/items` via `hxFetch(config, "/library/items", { basePath: "/api" })`.
  - Display as table with columns: ID (truncated), Title, Status, Date.
  - Use `padEnd`-based column alignment matching `src/tickets/list.ts` pattern.
  - Handle empty list gracefully.

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- List command outputs table format.
- `tsc` compiles.

### Step 4: Show Command

**Goal**: Create `hlx library show <ref>` to display report with section annotations.

**What to Build**:
- Create `src/library/show.ts`.
- `cmdShow(config, resolvedId, args)`:
  - Fetch item detail: `GET /library/items/:id` for content.
  - Fetch comment summary: `GET /library/items/:id/comments/summary` for per-section counts.
  - Parse headings from markdown content (regex for `^#{1,6}\s+(.+)$` lines).
  - For each heading, generate slug (lowercase, spaces to hyphens, strip non-alphanumeric) and annotate with `[slug]` and comment summary.
  - Output: `## Heading Text [slug] (N comments: X thumbs-up, Y love, Z thumbs-down)`.

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- Show command displays headings with slug annotations and comment summaries.
- `tsc` compiles.

### Step 5: Comments Router

**Goal**: Create the nested comments router dispatching to list/post subcommands.

**What to Build**:
- Create `src/library/comments.ts`.
- `runLibraryComments(config, resolvedId, args)`:
  - Parse subcommand from `args[0]`.
  - Switch: `list` -> `cmdCommentsList`, `post` -> `cmdCommentsPost`.
  - Usage function with help text.

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- Nested router dispatches to list/post.
- `tsc` compiles.

### Step 6: Comments List Command

**Goal**: Create `hlx library comments list <ref>` to display comments grouped by section.

**What to Build**:
- Create `src/library/comments-list.ts`.
- `cmdCommentsList(config, resolvedId, args)`:
  - Parse optional `--section` flag (supports both raw slugs and heading text, auto-slugified).
  - Fetch: `GET /library/items/:id/comments` (with optional `?anchor=` query param if section filter provided).
  - Group comments by anchor section.
  - Output format:
    ```
    ## section-slug (N comments)
      [rating] Author (date): "text"
        -> [reply] Author (date): "text"
    ```
  - Handle empty state.

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- Comments list grouped by section with ratings.
- Section filter via `--section` flag works.
- `tsc` compiles.

### Step 7: Comments Post Command

**Goal**: Create `hlx library comments post <ref>` to post a section rating.

**What to Build**:
- Create `src/library/comments-post.ts`.
- `cmdCommentsPost(config, resolvedId, args)`:
  - Parse required `--section` flag (auto-slugify heading text if needed).
  - Parse required `--rating` flag: accepts `thumbs-up`/`up`, `thumbs-down`/`down`, `love`. Normalize to `THUMBS_UP`, `THUMBS_DOWN`, `LOVE`.
  - Parse optional `--reply-to` flag for threading.
  - Parse optional positional message text.
  - POST to `/library/items/:id/comments` with body: `{ anchor, rating, content?, parentCommentId? }`.
  - Output confirmation: `Posted: [rating] on section: "text"`.

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- Post command sends correct API request.
- Rating normalization works.
- `tsc` compiles.

### Step 8: Register in Main Dispatcher

**Goal**: Add `library` case to the main command dispatcher.

**What to Build**:
- Modify `src/index.ts`:
  - Add import: `import { runLibrary } from "./library/index.js"`.
  - Add case in switch statement (around line 91, after `comments`):
    ```
    case "library": {
      const config = configOrHelp(args.slice(1));
      await runLibrary(config, args.slice(1));
      break;
    }
    ```

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- `library` case added to dispatcher.
- `tsc` compiles.

### Step 9: SKILL.md Update

**Goal**: Document all library commands for agent discoverability.

**What to Build**:
- Modify `skill-content/SKILL.md`:
  - Add library commands to the Available Commands table:
    - `hlx library list` — List library items with ID, title, status, date.
    - `hlx library show <ref>` — Show report with section headings annotated with [slug] and comment summaries.
    - `hlx library comments list <ref> [--section <slug>]` — List comments grouped by section.
    - `hlx library comments post <ref> --section <slug> --rating <value> [message]` — Post section rating.
  - Add a Library section to Common Workflows with an agent workflow example:
    ```bash
    # Discover sections and feedback status
    hlx library show RSH-439
    # Read detailed feedback
    hlx library comments list RSH-439
    # Post feedback
    hlx library comments post RSH-439 --section key-findings --rating love "Expanded with patterns"
    ```
  - Document flag conventions: `--section` (slug or heading text), `--rating` (thumbs-up/up, thumbs-down/down, love), `--reply-to` (comment ID).

**Verification (AI Agent Runs)**:
```bash
npm run build
```

**Success Criteria**:
- SKILL.md includes all library commands.
- `npm run build` (tsc) passes as final quality gate.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|-----------------|----------------|
| Node.js runtime | available | package.json | CHK-01 through CHK-03 |
| npm dependencies installed | available | Run `npm install` | CHK-01 through CHK-03 |
| TypeScript compiler (tsc) | available | devDependency in package.json | CHK-01 |
| Server (Phase 1) running with library comment API | available | `npm run dev` in helix-global-server on port 4000 with .env | CHK-02, CHK-03 |
| .env file for helix-cli | available | Dev setup config provides HELIX_API_KEY and HELIX_URL | CHK-02, CHK-03 |
| Library item exists in database | unknown | Requires existing library data from Phase 1 testing | CHK-02, CHK-03 |

### Required Checks

[CHK-01] TypeScript build passes with zero errors.
- Action: Run `npm run build` in the helix-cli directory.
- Expected Outcome: `tsc` completes with exit code 0. No TypeScript errors.
- Required Evidence: Full command output from `npm run build` showing successful completion.

[CHK-02] CLI command execution: `hlx library list` returns library items.
- Action: Configure the CLI with the .env file (HELIX_API_KEY, HELIX_URL pointing to dev or staging server). Run `node dist/index.js library list`.
- Expected Outcome: Command outputs a table with ID, Title, Status, and Date columns. If library items exist, they appear in the table. If none exist, an appropriate empty-state message displays.
- Required Evidence: Command output showing the table format or empty-state message.

[CHK-03] CLI command execution: `hlx library show <ref>` displays section annotations.
- Action: If library items were listed in CHK-02, run `node dist/index.js library show <ref>` using an ID or short ID from the list.
- Expected Outcome: Command outputs report headings annotated with `[slug]` and comment summary counts (e.g., `## Key Findings [key-findings] (N comments: ...)`).
- Required Evidence: Command output showing annotated section headings.

## Success Metrics

- 7 new files created, 2 files modified.
- `npm run build` (tsc) passes with zero errors.
- All 4 commands functional: list, show, comments list, comments post.
- Item resolution supports cuid, shortId, and title match.
- SKILL.md documents all library commands for agent discoverability.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|-------------|
| ticket.md (Research Report) | Primary specification for Phase 2b | 9 CLI steps, command formats, resolution strategies, SKILL.md update |
| diagnosis/diagnosis-statement.md (cli) | Root cause and scope | 7 new + 2 modified files; no library module exists |
| product/product.md (cli) | Product requirements | 8 essential features, agent-first discoverability |
| tech-research/tech-research.md (cli) | Architecture decisions | New module (not extending comments), 3-strategy resolution, nested router, .js imports |
| scout/reference-map.json (cli) | Key file identification | Dispatcher at index.ts:72-124, comments router at comments/index.ts, flags at lib/flags.ts |
| scout/scout-summary.md (cli) | Codebase pattern analysis | Router, resolution, flag, output patterns all established |
| repo-guidance.json | Repo intent | CLI confirmed as Phase 2b target |
| src/index.ts:72-124 | Direct code inspection | Switch dispatcher, comments at 87-91, no library case |
| src/comments/index.ts | Direct code inspection | 52-line router pattern directly replicable |
| src/lib/resolve-ticket.ts | Pattern reference | 3-strategy resolution (128 lines) to adapt |

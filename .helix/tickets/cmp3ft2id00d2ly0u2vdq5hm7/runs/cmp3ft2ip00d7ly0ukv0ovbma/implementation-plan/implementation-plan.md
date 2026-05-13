# Implementation Plan: helix-cli — Library Comments and Iteration

## Overview

Build a new `src/library/` CLI module with list, show, and comments (list/post) commands. Also add a `resolve-library-item.ts` utility and update SKILL.md for agent discoverability. This is Phase 2b (parallel with client) — depends on the server API contract from Phase 1.

## Implementation Principles

1. **Follow established module pattern**: Mirror `src/comments/` module structure exactly — router index.ts dispatching to cmd* functions.
2. **Reuse existing utilities**: Use `hxFetch`, `getFlag`, `hasFlag`, `getPositionalArgs` from `src/lib/`.
3. **Non-interactive**: All commands use flags and positional args. No TTY prompts.
4. **SKILL.md is critical**: Agent discoverability depends on SKILL.md documentation.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Create resolve-library-item utility | `src/lib/resolve-library-item.ts` |
| 2 | Create library module router | `src/library/index.ts` |
| 3 | Create library list command | `src/library/list.ts` |
| 4 | Create library show command | `src/library/show.ts` |
| 5 | Create library comments router | `src/library/comments.ts` |
| 6 | Create library comments list command | `src/library/comments-list.ts` |
| 7 | Create library comments post command | `src/library/comments-post.ts` |
| 8 | Register library module in main dispatcher | `src/index.ts` updated |
| 9 | Update SKILL.md | `skill-content/SKILL.md` updated |

## Detailed Implementation Steps

### Step 1: Create resolve-library-item Utility

**Goal**: Multi-format library item resolution (cuid, ticket short ID, title match).

**What to Build**:
- New file: `src/lib/resolve-library-item.ts`
  - `extractLibraryRef(args: string[]): string | undefined` — checks `--item` flag first, then first positional arg
  - `resolveLibraryItem(config: HxConfig, ref: string): Promise<{ id: string; title: string }>`:
    1. If ref starts with 'c' and length is 25: use as item ID directly (verify via GET)
    2. If ref matches `/^[A-Z]+-\d+$/` (ticket short ID): call `GET /api/library/items?ticketShortId={ref}`, return latest item
    3. Fallback: call `GET /api/library/items`, find case-insensitive title substring match
  - HTTP calls via `hxFetch(config, path, { basePath: '/api' })`
  - Throw descriptive error if resolution fails

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — no errors

**Success Criteria**: Three resolution strategies with clear error messages on failure.

---

### Step 2: Create Library Module Router

**Goal**: Top-level library module that dispatches to subcommands.

**What to Build**:
- New file: `src/library/index.ts`
  - `runLibrary(config: HxConfig, args: string[])` — dispatches based on `args[0]`:
    - `'list'` -> `cmdLibraryList(config, args.slice(1))`
    - `'show'` -> `cmdLibraryShow(config, args.slice(1))`
    - `'comments'` -> `runLibraryComments(config, args.slice(1))`
    - Default: print usage and exit 1
  - `isHelpRequested(args)` check at top
  - Usage function listing available subcommands

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — no errors

**Success Criteria**: Router dispatches to correct subcommands, shows usage on help or unknown subcommand.

---

### Step 3: Create Library List Command

**Goal**: `hlx library list` — display library items.

**What to Build**:
- New file: `src/library/list.ts`
  - `cmdLibraryList(config: HxConfig, args: string[])`
  - Fetch: `GET /api/library/items` via `hxFetch(config, '/library/items', { basePath: '/api' })`
  - Output: tabular format with columns: ID (truncated cuid), Title, Status, Date
  - Handle empty result: "No library items found."
  - isHelpRequested check + usage function

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — no errors

**Success Criteria**: Lists items in a readable table format.

---

### Step 4: Create Library Show Command

**Goal**: `hlx library show <ref>` — display report with section slugs and comment summaries.

**What to Build**:
- New file: `src/library/show.ts`
  - `cmdLibraryShow(config: HxConfig, args: string[])`
  - Resolve item via `resolveLibraryItem(config, ref)`
  - Fetch item detail: `GET /api/library/items/{itemId}` (includes content)
  - Fetch comment summary: `GET /api/library/items/{itemId}/comments/summary`
  - Output: heading-level view — extract headings from markdown content (regex match `^#{1,6}\s+(.+)$`), annotate each with:
    - `[slug]` (slugified heading text)
    - Comment summary counts if any (e.g., `(2 comments: 1 thumbs-up, 1 love)`)
  - Optional `--full` flag: show complete markdown content with heading annotations inline
  - Slugify function: lowercase, replace spaces with hyphens, remove special chars (matches rehype-slug GFM algorithm)

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — no errors

**Success Criteria**: Show displays headings with slugs and comment summary counts.

---

### Step 5: Create Library Comments Router

**Goal**: Nested router for `hlx library comments` subcommands.

**What to Build**:
- New file: `src/library/comments.ts`
  - `runLibraryComments(config: HxConfig, args: string[])` — dispatches based on `args[0]`:
    - `'list'` -> `cmdLibraryCommentsList(config, args.slice(1))`
    - `'post'` -> `cmdLibraryCommentsPost(config, args.slice(1))`
    - Default: print usage and exit 1
  - Usage function listing available subcommands

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — no errors

**Success Criteria**: Nested router dispatches to list and post subcommands.

---

### Step 6: Create Library Comments List Command

**Goal**: `hlx library comments list <ref> [--section <slug>]` — display comments grouped by section.

**What to Build**:
- New file: `src/library/comments-list.ts`
  - `cmdLibraryCommentsList(config: HxConfig, args: string[])`
  - Resolve item via `resolveLibraryItem`
  - Optional `--section <slug>` flag for anchor filtering (slugify if contains spaces/uppercase)
  - Fetch: `GET /api/library/items/{itemId}/comments` with optional `?anchor=` query param
  - Output format (grouped by section):
    ```
    ## section-slug (N comments)
      [rating] AuthorName (date): "text content"
        -> [reply] AuthorName (date): "reply text"
    ```
  - Rating display: `[thumbs-up]`, `[thumbs-down]`, `[love]`
  - Handle no comments: "No comments found."

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — no errors

**Success Criteria**: Comments displayed grouped by section with ratings, authors, text, and threading.

---

### Step 7: Create Library Comments Post Command

**Goal**: `hlx library comments post <ref> --section <slug> --rating <value> [message]` — post section feedback.

**What to Build**:
- New file: `src/library/comments-post.ts`
  - `cmdLibraryCommentsPost(config: HxConfig, args: string[])`
  - Resolve item via `resolveLibraryItem`
  - Required flags: `--section` (heading slug), `--rating` (thumbs-up|love|thumbs-down, shorthands: up|down|love)
  - Optional: remaining positional args joined as message text
  - Rating mapping: `thumbs-up`/`up` -> `THUMBS_UP`, `love` -> `LOVE`, `thumbs-down`/`down` -> `THUMBS_DOWN`
  - Section slug normalization: if value contains spaces or uppercase, slugify it
  - POST: `/api/library/items/{itemId}/comments` with body `{ anchor, rating, content? }`
  - Output: confirmation message `Posted: [rating] on section-slug: "text content"`
  - Validate rating value before posting; show error for invalid values

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — no errors

**Success Criteria**: Posts comment with rating, section, and optional text. Shows confirmation.

---

### Step 8: Register Library Module in Main Dispatcher

**Goal**: Add `library` case to the CLI's switch-case dispatcher.

**What to Build**:
- Modify `src/index.ts`:
  - Import `runLibrary` from `./library/index.js`
  - Add case in switch dispatcher (around line 72-124): `case 'library': return runLibrary(config, args.slice(1));`

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — no errors
2. `npm run build` — tsc compilation succeeds

**Success Criteria**: `hlx library` routes to the library module.

---

### Step 9: Update SKILL.md

**Goal**: Add Library section to SKILL.md for agent discoverability.

**What to Build**:
- Modify `skill-content/SKILL.md`:
  - Add a `## Library` section in the Available Commands area with documentation for:
    - `hlx library list` — List library items
    - `hlx library show <ref>` — Show library item with section headings and feedback summary. `<ref>` can be item ID, ticket short ID, or title.
    - `hlx library comments list <ref> [--section <slug>]` — List comments on a library item, optionally filtered by section.
    - `hlx library comments post <ref> --section <slug> --rating <value> [message]` — Post feedback on a report section. Rating values: thumbs-up, love, thumbs-down (shorthands: up, love, down).

**Verification (AI Agent Runs)**:
1. `npm run build` — tsc compilation succeeds (SKILL.md is non-code but build confirms nothing broke)

**Success Criteria**: SKILL.md documents all 4 library commands with flag descriptions and examples.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|----------------|----------------|
| Node.js and npm installed | available | Dev setup config | CHK-01 through CHK-05 |
| .env file with HELIX_API_KEY and HELIX_URL | available | Dev setup config provides .env contents | CHK-03, CHK-04, CHK-05 |
| Server library comment API endpoints available | unknown | Depends on server deployment (staging URL in .env: helix-global-server-staging) | CHK-03, CHK-04, CHK-05 |
| Existing library item accessible via staging API | unknown | Depends on staging data | CHK-03, CHK-04, CHK-05 |

### Required Checks

[CHK-01] TypeScript compilation succeeds.
- Action: Run `npm run build` in the helix-cli directory.
- Expected Outcome: `tsc` compiles all source files with zero errors.
- Required Evidence: Build command output with exit code 0 and no error messages.

[CHK-02] Main dispatcher routes to library module.
- Action: After build, run `node dist/index.js library --help` (or `node dist/index.js library` with no args).
- Expected Outcome: Outputs library usage text listing available subcommands (list, show, comments).
- Required Evidence: Command output showing the usage message with subcommand list.

[CHK-03] Library list command fetches items from the API.
- Action: Write the .env file with the staging credentials. Run `node dist/index.js library list`.
- Expected Outcome: Displays a table of library items (or "No library items found" if the staging instance has none), demonstrating successful API communication.
- Required Evidence: Command output showing either the item table or the empty-state message. Must not show connection errors or auth failures.

[CHK-04] Library comments post command sends a comment to the API.
- Action: Identify a library item ID or ticket short ID from the list output. Run `node dist/index.js library comments post <ref> --section test-section --rating thumbs-up "Test from CLI"`.
- Expected Outcome: Outputs confirmation message `Posted: [thumbs-up] on test-section: "Test from CLI"`. The API returns 201 (or the command succeeds without error).
- Required Evidence: Command output showing the confirmation message.

[CHK-05] SKILL.md contains Library section with all commands documented.
- Action: Read `skill-content/SKILL.md` and search for the `## Library` section.
- Expected Outcome: The file contains a `## Library` section documenting `hlx library list`, `hlx library show`, `hlx library comments list`, and `hlx library comments post` with flag descriptions.
- Required Evidence: The SKILL.md file content showing the Library section with all four command descriptions.

## Success Metrics

1. New `src/library/` module with 6 files (index, list, show, comments, comments-list, comments-post).
2. `src/lib/resolve-library-item.ts` supports cuid, ticket short ID, and title match resolution.
3. `src/index.ts` routes `hlx library` to the new module.
4. `skill-content/SKILL.md` has a Library section documenting all commands.
5. `npm run build` passes with zero TypeScript errors.
6. All commands are non-interactive and use standard flag parsing.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (Research Report) | Primary specification | CLI module structure, 4 commands, rating flag values, section targeting, SKILL.md content, item resolution strategies |
| product/product.md | MVP scope | CLI commands are essential feature #9; agents read feedback via CLI (success criterion #4) |
| diagnosis/diagnosis-statement.md (CLI) | Gap analysis | No library module exists; established module pattern identified |
| tech-research/tech-research.md (CLI) | Technical decisions | Module structure, command syntax, item resolution strategies, rating flag mapping, SKILL.md content |
| scout/scout-summary.md (CLI) | Architecture patterns | Switch-case routing, flag parsing, hxFetch, configOrHelp pattern |
| scout/reference-map.json (CLI) | File locations | src/index.ts dispatcher, src/comments/ module, SKILL.md |
| src/index.ts | Dispatcher verification | Switch-case routing lines 72-124, no library case |
| src/comments/ | Module pattern reference | Router -> list/post dispatch |
| src/lib/resolve-ticket.ts | Resolution pattern | extractTicketRef + matchTicket with priority ordering |
| src/lib/flags.ts | Flag parsing | getFlag, hasFlag, getPositionalArgs |

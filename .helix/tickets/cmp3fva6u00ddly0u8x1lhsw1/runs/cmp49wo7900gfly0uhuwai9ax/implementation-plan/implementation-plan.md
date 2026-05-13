# Implementation Plan: Library Comments and Iteration (helix-cli)

## Overview

Add a new `hlx library` CLI module with 4 commands for listing library items, showing reports with section annotations, and posting/listing section-level comments. This is Phase 2b — depends on the server API contract and runs in parallel with the client. The work is entirely greenfield: a new `src/library/` module directory, a `resolve-library-item.ts` utility, and a SKILL.md update for agent discoverability.

## Implementation Principles

- **Separate module, not extension**: `src/library/` is its own module, not an extension of `src/comments/`. Different API endpoints, resolution logic, and flags justify separation.
- **Follow established patterns**: Module router, command files, resolution utility, and flag parsing all follow the exact patterns from the existing `comments` module and `resolve-ticket.ts`.
- **Agent discoverability**: SKILL.md update is critical — agents read this file to understand available CLI capabilities.
- **Flexible item resolution**: Three strategies (cuid, ticket short ID, title match) for broad usability.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Create resolve-library-item utility | src/lib/resolve-library-item.ts |
| 2 | Create library list command | src/library/list.ts |
| 3 | Create library show command | src/library/show.ts |
| 4 | Create library comments commands | src/library/comments.ts |
| 5 | Create library module router | src/library/index.ts |
| 6 | Add 'library' case to main router | src/index.ts updated |
| 7 | Update SKILL.md for agent discoverability | skill-content/SKILL.md updated |
| 8 | Quality gate | tsc passes |

## Detailed Implementation Steps

### Step 1: Create resolve-library-item Utility

**Goal**: Provide library item resolution matching resolve-ticket.ts pattern.

**What to Build**:
- Create `src/lib/resolve-library-item.ts` following `src/lib/resolve-ticket.ts` (128 lines):
  - `extractLibraryRef(args: string[])` — extract ref from positional arg (first non-flag argument)
  - `matchLibraryItem(items, rawRef)` — match priority:
    1. Exact cuid match on item.id
    2. Ticket short ID match on item.ticketShortId (case-insensitive)
    3. Title substring match (case-insensitive)
  - `resolveLibraryItem(config: HxConfig, rawRef: string)` — fetch items list via `hxFetch(config, "/library/items")`, then call matchLibraryItem
  - Return type: resolved item object with id, title, ticketShortId
  - Error handling: throw with descriptive message if no match found or multiple ambiguous matches

**Verification (AI Agent Runs)**:
```bash
npx tsc --noEmit
```

**Success Criteria**: Utility compiles; three-strategy resolution implemented; follows resolve-ticket.ts pattern.

### Step 2: Create Library List Command

**Goal**: Implement `hlx library list` to display available library items.

**What to Build**:
- Create `src/library/list.ts`:
  - `cmdLibraryList(config: HxConfig, args: string[])` — named export
  - Calls `hxFetch(config, "/library/items")` to get items list
  - Outputs table format: title, status, ticketShortId (if available), createdAt date
  - Handle empty list gracefully (print "No library items found.")
  - Handle `--help` via `isHelpRequested(args)`

**Verification (AI Agent Runs)**:
```bash
npx tsc --noEmit
```

**Success Criteria**: Command compiles; fetches and formats items list.

### Step 3: Create Library Show Command

**Goal**: Implement `hlx library show <ref>` to display report with section annotations.

**What to Build**:
- Create `src/library/show.ts`:
  - `cmdLibraryShow(config: HxConfig, args: string[])` — named export
  - Resolves item via `resolveLibraryItem(config, ref)`
  - Fetches item detail AND comment summary in parallel via `Promise.all([hxFetch(...item detail...), hxFetch(...comments/summary...)])`
  - Output format (three parts):
    1. Header: Title, Status, Ticket (shortId), Generated date
    2. Section index: each heading anchor with comment counts and rating distribution (from summary)
    3. Full markdown content (raw text)
  - Section index extraction: parse headings from content via regex (`/^#{1,6}\s+(.+)$/gm`) and slugify to get anchors
  - Slugify function: lowercase, replace spaces with hyphens, strip non-alphanumeric (matching rehype-slug algorithm)

**Verification (AI Agent Runs)**:
```bash
npx tsc --noEmit
```

**Success Criteria**: Command compiles; parallel API calls; three-part output format.

### Step 4: Create Library Comments Commands

**Goal**: Implement `hlx library comments list` and `hlx library comments post`.

**What to Build**:
- Create `src/library/comments.ts`:
  - `cmdLibraryCommentsList(config: HxConfig, args: string[])`:
    - Resolves item via resolveLibraryItem
    - Optional `--section <slug>` flag via `getFlag(args, "section")` — if text with spaces, auto-slugify
    - Calls `hxFetch(config, "/library/items/${itemId}/comments" + (anchor ? "?anchor=" + anchor : ""))`
    - Outputs comments grouped by anchor; each comment shows: rating, author, timestamp, content
  - `cmdLibraryCommentsPost(config: HxConfig, args: string[])`:
    - Resolves item via resolveLibraryItem
    - Required flags: `--section <slug>` (auto-slugified), `--rating <value>`
    - Rating mapping: `thumbs-up`/`up` -> `THUMBS_UP`, `love` -> `LOVE`, `thumbs-down`/`down` -> `THUMBS_DOWN`
    - Optional message: remaining positional args after flags are consumed (joined with spaces)
    - Calls `hxFetch(config, "/library/items/${itemId}/comments", { method: "POST", body: { anchor, rating, content? } })`
    - Output: success message with posted comment details
  - Slugify helper (inline or imported): lowercase, replace spaces/non-alnum with hyphens, trim leading/trailing hyphens

**Verification (AI Agent Runs)**:
```bash
npx tsc --noEmit
```

**Success Criteria**: Both commands compile; --section auto-slugifies; --rating maps to server values; POST includes body.

### Step 5: Create Library Module Router

**Goal**: Route `hlx library` subcommands to the correct handlers.

**What to Build**:
- Create `src/library/index.ts` following `src/comments/index.ts` (53 lines):
  - `runLibrary(config: HxConfig, args: string[])` — exported function
  - Switch on first arg (subcommand):
    - `"list"` -> cmdLibraryList(config, rest)
    - `"show"` -> extract ref, cmdLibraryShow(config, rest)
    - `"comments"` -> nested switch on next arg:
      - `"list"` -> extract ref, cmdLibraryCommentsList(config, rest)
      - `"post"` -> extract ref, cmdLibraryCommentsPost(config, rest)
      - default: comments usage
    - default: library usage (print help)
  - `libraryUsage()` helper function: print available subcommands
  - Help detection via `isHelpRequested(args)`

**Verification (AI Agent Runs)**:
```bash
npx tsc --noEmit
```

**Success Criteria**: Module router compiles; dispatches to all 4 commands; shows usage on unknown subcommand.

### Step 6: Add 'library' Case to Main Router

**Goal**: Wire the new module into the CLI entry point.

**What to Build**:
- Edit `src/index.ts`:
  - Add import: `import { runLibrary } from "./library/index.js"`
  - Add case in switch statement (after the 'comments' case at lines 87-90):
    ```
    case "library": {
      const config = configOrHelp(args.slice(1));
      await runLibrary(config, args.slice(1));
      break;
    }
    ```

**Verification (AI Agent Runs)**:
```bash
npx tsc --noEmit
```

**Success Criteria**: 'library' case added; follows 'comments' case pattern; configOrHelp used.

### Step 7: Update SKILL.md for Agent Discoverability

**Goal**: Document all library commands so agents can discover and use them.

**What to Build**:
- Edit `skill-content/SKILL.md`:
  - Add a "Library" section to the command table (after the existing Tickets/Comments sections):
    - `hlx library list` — List library items
    - `hlx library show <ref>` — Show report with section annotations and comment counts
    - `hlx library comments list <ref> [--section <slug>]` — List comments for a library item, optionally filtered by section
    - `hlx library comments post <ref> --section <slug> --rating <value> [message]` — Post feedback on a section
  - Add agent workflow example for the library feedback loop:
    1. `hlx library show RSH-439` — discover sections and feedback status
    2. `hlx library comments list RSH-439` — read detailed feedback
    3. `hlx library comments post RSH-439-v2 --section key-findings --rating love "Rewrote based on feedback"` — post feedback
  - Document rating values: thumbs-up (or up), love, thumbs-down (or down)
  - Document section auto-slugification: `--section "Key Findings"` becomes `key-findings`

**Verification (AI Agent Runs)**:
```bash
npx tsc --noEmit
```

**Success Criteria**: SKILL.md updated with all 4 commands, workflow example, and flag documentation.

### Step 8: Quality Gate

**Goal**: Ensure all changes compile.

**What to Build**: No new code; run validation.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmp3fva7700dily0uu2fkpch7/helix-cli
npx tsc --noEmit
npm run build
```

**Success Criteria**: Zero TypeScript errors; build produces dist/ output.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|----------------|----------------|
| Node.js available | available | CLI TypeScript project | CHK-01 through CHK-04 |
| npm dependencies installed | available | npm install must run first | CHK-01 through CHK-04 |
| .env with HELIX_API_KEY and HELIX_URL | available | Dev setup config provides CLI .env pointing to staging | CHK-03, CHK-04 |
| Server API endpoints available at HELIX_URL | unknown | CLI .env points to staging (helix-global-server-staging); library comment endpoints must be deployed first | CHK-03, CHK-04 |

### Required Checks

[CHK-01] TypeScript compilation passes with zero errors.
- Action: Run `npx tsc --noEmit` from the helix-cli root.
- Expected Outcome: Command exits with code 0 and produces no error output.
- Required Evidence: Full command output showing zero errors.

[CHK-02] Build produces dist/ output.
- Action: Run `npm run build` (which executes `tsc`) from the helix-cli root, then verify dist/ directory contains compiled JavaScript files including the new library module.
- Expected Outcome: Command exits with code 0. dist/library/index.js, dist/library/list.js, dist/library/show.js, dist/library/comments.js, and dist/lib/resolve-library-item.js exist.
- Required Evidence: Command output showing successful build plus file listing of dist/library/ directory.

[CHK-03] CLI library list command executes against staging server.
- Action: Write the .env file with the provided HELIX_API_KEY and HELIX_URL. Run `node dist/index.js library list` from the helix-cli root.
- Expected Outcome: The command connects to the staging server and either returns a list of library items or returns an empty list message. No crash or unhandled errors.
- Required Evidence: Command output showing either a formatted list of items or a "No library items found" message. If the server returns an auth or network error, that error message is the evidence (the command must not crash with an unhandled exception).

[CHK-04] SKILL.md includes Library section with all 4 commands.
- Action: Read the contents of `skill-content/SKILL.md` and verify it contains a Library section documenting: `hlx library list`, `hlx library show <ref>`, `hlx library comments list <ref>`, and `hlx library comments post <ref>`.
- Expected Outcome: All 4 commands are documented in the Library section with descriptions and flag documentation (--section, --rating). An agent workflow example is present.
- Required Evidence: Content excerpt from SKILL.md showing the Library section with all 4 commands.

## Success Metrics

1. `hlx library list` fetches and displays library items.
2. `hlx library show <ref>` displays header + section index + markdown content.
3. `hlx library comments list <ref>` displays comments grouped by section with optional --section filter.
4. `hlx library comments post <ref>` posts a comment with --section and --rating flags.
5. Item resolution works with cuid, ticket short ID, and title substring.
6. SKILL.md documents all 4 commands with agent workflow example.
7. `tsc` builds successfully with zero errors.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (cli) | Problem statement | Implementation ticket for RSH-443 |
| scout/reference-map.json (cli) | File inventory and patterns | 10 files; switch-based routing; --section/--rating flags |
| scout/scout-summary.md (cli) | Analysis synthesis | Comments module as pattern template; resolve-ticket.ts as resolution template |
| diagnosis/diagnosis-statement.md (cli) | Root cause and success criteria | 4 gaps: router, module, resolution, docs |
| diagnosis/apl.json (cli) | Diagnostic findings | Module structure; item resolution; SKILL.md scope |
| product/product.md (cli) | Feature scope and constraints | 8 essential features; agent workflow; resolution strategies |
| tech-research/tech-research.md (cli) | Architecture decisions | Separate module; list-based matching; show output format; rating mapping; SKILL.md content |
| repo-guidance.json | Repo intent | CLI is Phase 2b; parallel with client; depends on server |
| src/index.ts (lines 72-124) | Command router | Switch at lines 72-124; 'comments' case at 87-90 as template |
| src/comments/index.ts | Module router pattern | 53-line subcommand dispatch; configOrHelp |
| src/lib/resolve-ticket.ts | Resolution pattern | extractTicketRef + matchTicket; cuid > shortId > number |
| src/lib/flags.ts | Flag utilities | getFlag, requireFlag, isHelpRequested |
| src/lib/http.ts | HTTP client | hxFetch with retry, timeout, backoff |
| skill-content/SKILL.md | Agent docs | Command table to extend |

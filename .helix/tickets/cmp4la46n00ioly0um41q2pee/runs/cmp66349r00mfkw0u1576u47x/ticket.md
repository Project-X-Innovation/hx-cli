# Ticket Context

- ticket_id: cmp4la46n00ioly0um41q2pee
- short_id: BLD-448
- run_id: cmp66349r00mfkw0u1576u47x
- run_branch: helix/build/BLD-448-implement-ticket-to-implement-library-comments
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Implement: Ticket to Implement: Library Comments and Iteration

## Description
Make sure to implement all 3 phases outlined

## Research Report

# Implementation Ticket: Library Comments and Iteration

**Ticket**: RSH-443
**Date**: 2026-05-13
**Status**: Ready for Implementation
**Repos**: helix-global-server, helix-global-client, helix-cli

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Product Vision and User Flows](#product-vision-and-user-flows)
4. [Architecture Overview](#architecture-overview)
5. [Storage Design](#storage-design)
6. [Server Implementation (Phase 1)](#server-implementation-phase-1)
7. [Client Implementation (Phase 2a)](#client-implementation-phase-2a)
8. [CLI Implementation (Phase 2b)](#cli-implementation-phase-2b)
9. [Cross-Cutting Concerns](#cross-cutting-concerns)
10. [Technical Decisions Register](#technical-decisions-register)
11. [Enhancement Brainstorm](#enhancement-brainstorm)
12. [MVP Scope and Boundaries](#mvp-scope-and-boundaries)
13. [Risks and Mitigations](#risks-and-mitigations)
14. [Implementation Sequencing](#implementation-sequencing)
15. [Success Criteria](#success-criteria)
16. [Future Roadmap](#future-roadmap)

---

## Executive Summary

Library reports in the Helix platform are currently read-only markdown artifacts backed by Git. Once a report is generated and published, there is no mechanism for users to provide feedback, rate sections, or collaborate on improvements. This ticket defines a **section-level feedback and collaborative iteration system** for library reports, spanning three repositories and three user surfaces (web UI, CLI, agent/MCP).

The system introduces a Netflix-style three-level rating system (thumbs up / love / thumbs down) per heading section, optional text context, threaded discussions, real-time delivery via SSE, and automatic inclusion of feedback in continuation context for agent-driven iteration.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Storage** | Hybrid (DB + async Git sidecar) | Fast UX via PostgreSQL + Git self-containment for agents |
| **UI approach** | Wrap MarkdownRenderer, don't modify | 2-line backward-compatible change; new components via React Context |
| **Comment input** | Plain textarea (not Tiptap) | Brief feedback notes; lighter bundle |
| **CLI structure** | New `src/library/` module | Distinct domain from ticket comments |
| **Data model** | Parallel `LibraryComment` model | Unique fields (anchor, rating) justify separate model |
| **Rating storage** | String + Zod validation | No migration needed to add rating levels |

### Three-Repo Responsibility Split

| Repository | Phase | Responsibility |
|------------|-------|---------------|
| **helix-global-server** | Phase 1 (first) | Data model, API, SSE, MCP tools, Git sync, continuation integration |
| **helix-global-client** | Phase 2a (parallel) | Section feedback UI, React Query hooks, SSE hook |
| **helix-cli** | Phase 2b (parallel) | Library commands (list, show, comments list/post), SKILL.md |

---

## Problem Statement

Library reports are generated as markdown files committed to a Git repository. They represent research output, analysis, and findings that teams iterate on over multiple rounds. Today, these reports are **static, read-only documents** in the UI and CLI. The only way to discuss a report is through the originating ticket's discussion thread, which is disconnected from the report content itself.

### Pain Points

| Pain Point | Impact |
|-----------|--------|
| **No section-level feedback** | Users cannot express opinions about individual sections; feedback is all-or-nothing |
| **No quick triage** | A report owner scanning a 10-section report cannot quickly mark which sections hit and which missed |
| **No team collaboration** | Multiple team members cannot independently review and discuss sections |
| **No agent context** | When generating the next iteration, agents have no structured feedback data |
| **Disconnected editorial history** | The reasoning behind why sections changed between iterations is lost |

### The Feedback Loop Problem

Today's iteration flow is broken:

```
1. Agent generates report
2. User reads report, forms opinions about specific sections
3. User goes to ticket discussion to write feedback (disconnected from report)
4. User triggers continuation and manually re-states feedback
5. Agent generates next iteration with limited context
```

The desired flow:

```
1. Agent generates report
2. User rates sections directly on the report (30 seconds for 10 sections)
3. User optionally adds text context on specific sections
4. Team discusses sections in threaded comments (real-time)
5. User triggers continuation -- comments are AUTOMATICALLY included
6. Agent generates informed next iteration
```

---

## Product Vision and User Flows

### Core Principle

**Comments are the primary iteration mechanism.** Users should never need to manually re-state feedback when continuing a report. The accumulated comments *are* the continuation context.

### User Personas

| User | Role | Primary Need |
|------|------|-------------|
| **Report Owner** | Primary contributor who reviews their report | Quick section-level ratings to guide the next iteration |
| **Team Members** | Collaborators providing diverse perspectives | Add feedback, discuss sections, contribute different viewpoints |
| **Coding Agents** | Automated agents generating iterations | Read structured feedback as context for the next round; post comments programmatically |

### Flow 1: Quick Section Triage (Netflix-Style Rating)

The simplest and most important flow. A report owner opens a freshly generated report and wants to quickly signal what worked and what didn't.

1. Open a library report in the UI.
2. Hover over any heading section (e.g., "Key Findings").
3. A floating toolbar appears with three buttons: thumbs down, thumbs up, love.
4. Click a rating button. The rating is recorded immediately with a single click.
5. Move to the next section and repeat.

**Target**: Rate every section of a 10-section report within **30 seconds**. This creates enough signal to generate a meaningful second round, even without any text commentary.

### Flow 2: Rating with Context

When a section warrants more than a single rating, the user can add a brief text note alongside their rating.

1. Rate a section (same as Flow 1).
2. After clicking a rating, an optional text input expands below.
3. Type a brief note: "Dive deeper into this" / "Totally extra" / "Wrong level of abstraction"
4. Submit the comment.

**Example feedback patterns:**

| Rating | Text | Meaning |
|--------|------|---------|
| Thumbs up + "Dive deeper into this" | Positive direction, expand this section |
| Thumbs down + "Totally extra" | Remove this section entirely |
| Thumbs down + "Wrong" | Factual error or incorrect framing |
| Thumbs down + "Technically correct but wrong level of abstraction" | Valid content, wrong presentation |

### Flow 3: Team Review (Multi-User Discussion)

1. Multiple team members open the same report.
2. Each person independently rates sections and adds comments.
3. Team members see each other's comments in real-time (via SSE).
4. Anyone can reply to someone else's comment, creating a threaded discussion.
5. The discussion evolves into rich section-level collaborative review.

### Flow 4: Agent-Driven Iteration

1. Report owner adds a final summary comment and triggers a new iteration.
2. **Accrued comments are automatically included as continuation context** (no manual re-entry).
3. The coding agent reads structured section feedback and uses it to inform the next round.
4. Sections with "love" are preserved; sections with "thumbs down" are rewritten or removed.

### Flow 5: Cross-Iteration Review

1. Open a library report showing the latest version (Round 2).
2. Use the existing version selector to navigate to Round 1.
3. See the comments and ratings that were left on Round 1.
4. Understand *why* sections changed between iterations.

---

## Architecture Overview

### Hybrid Storage Architecture

The system uses **PostgreSQL as the operational source of truth** with **asynchronous Git sidecar sync** that writes structured `comments.json` files alongside report snapshots in the library repo.

```
                                    +-------------------+
                                    |   GitHub Library   |
                                    |      Repo          |
                                    |                    |
                                    | reports/           |
                                    |   {shortId}/       |
                                    |     runs/{runId}/  |
                                    |       report.md    |
                                    |       comments.json|  <-- sidecar
                                    +--------^----------+
                                             |
                                      [async, debounced]
                                      [5s per itemId]
                                             |
+----------+     +----------+     +----------+---------+
|          |     |          |     |                     |
|  Web UI  +---->+  REST    +---->+   PostgreSQL (DB)   |
|          |<----+  API     |<----+   LibraryComment    |
|          |     |          |     |   model (Prisma)    |
+----------+     +----+-----+     +---------------------+
                      |
              +-------+-------+
              |               |
        +-----v-----+  +-----v-----+
        |   SSE     |  |   MCP     |
        |  Events   |  |  Tools    |
        +-----------+  +-----------+
              ^               ^
              |               |
        +-----+-----+  +-----+-----+
        |  Web UI   |  |  Agents   |
        | (real-time)|  | (CLI/MCP) |
        +-----------+  +-----------+
```

### Data Flow: From User Action to Git Persistence

1. **User rates a section** (UI click, CLI command, or MCP tool call)
2. **API receives request** at `POST /library/items/:itemId/comments`
3. **Validation**: Zod validates rating taxonomy, anchor format, optional text
4. **DB write**: Prisma creates `LibraryComment` record (~10ms)
5. **SSE emission**: EventEmitter fires `library-comment:new` event (~1ms)
6. **API responds**: 201 Created with comment data (~50ms total)
7. **Async Git sync triggered**: Debounced per libraryItemId (5s window)
8. **Git sync executes**: Reads all comments, serializes to JSON, writes `comments.json` via GitHub Contents API (~500-2000ms)
9. **Git sync result**: Logged; failures don't block; next mutation retriggers

### Why Hybrid Storage

The ticket owner's vision is clear: "I think having all that context in the library would really be next level." At the same time, the product requirements demand real-time delivery, concurrent multi-user collaboration, and responsive API interactions that pure Git storage cannot deliver.

Four approaches were evaluated:

| Criterion | A: Pure Git | B: Pure DB | C: Hybrid (chosen) | D: Git-First |
|-----------|:-----------:|:----------:|:-------------------:|:------------:|
| Write latency | Slow (200-500ms) | Fast (<100ms) | **Fast (<100ms)** | Slow (200-500ms) |
| Real-time (SSE) | No | Yes | **Yes** | Partial |
| Git self-containment | Full | None | **Full (async)** | Full |
| Concurrent writes | Conflicts | Native | **Native** | Conflicts |
| Query/filter/sort | No | Yes | **Yes** | Yes (via cache) |
| Implementation complexity | Low | Low | **Medium** | High |
| Alignment with vision | High | Low | **High** | High |
| **Recommendation** | Not for MVP | Possible but limited | **Recommended** | Overly complex |

---

## Storage Design

### Database Model: LibraryComment

```prisma
model LibraryComment {
  id               String    @id @default(cuid())
  libraryItemId    String                          // FK to LibraryItem (specific version)
  organizationId   String                          // FK to Organization (tenant isolation)
  authorUserId     String                          // FK to User
  anchor           String                          // Heading slug (e.g., "key-findings")
  rating           String                          // "THUMBS_UP" | "LOVE" | "THUMBS_DOWN"
  content          String?   @db.Text              // Optional text context
  parentCommentId  String?                         // Threading (single-level)
  isHelixTagged    Boolean   @default(false)       // @helix mention detection
  isAgentAuthored  Boolean   @default(false)       // Agent-posted comments
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  libraryItem      LibraryItem   @relation(fields: [libraryItemId], references: [id])
  organization     Organization  @relation(fields: [organizationId], references: [id])
  author           User          @relation(fields: [authorUserId], references: [id])
  parent           LibraryComment? @relation("LibraryCommentThread", fields: [parentCommentId], references: [id])
  replies          LibraryComment[] @relation("LibraryCommentThread")

  @@index([libraryItemId, anchor, createdAt])      // Primary: comments by item + section
  @@index([libraryItemId, createdAt])              // Comments by item (all sections)
  @@index([organizationId])                        // Tenant isolation
  @@index([parentCommentId])                       // Thread lookups
}
```

### Key Model Decisions

| Choice | Decision | Rationale |
|--------|----------|-----------|
| **Rating type** | `String` (not Prisma enum) | Avoids migration-requiring changes if taxonomy evolves. Validated at API boundary via Zod. Consistent with `LibraryItem.status` pattern. |
| **Anchor format** | Heading slug (e.g., `"key-findings"`) | Matches rehype-slug output exactly. Shared contract between server, client, and CLI. |
| **Threading** | Single-level via `parentCommentId` | Replies to replies redirect to top-level parent. Deep nesting adds complexity without matching the feedback use case. |
| **Optional content** | `String? @db.Text` | Supports Flow 1 (rating-only) and Flow 2 (rating + text). |
| **Model name** | `LibraryComment` (not `ArtifactComment`) | Consistent with `LibraryItem` FK. Ticket owner suggested "artifact comments" for extensibility but expressed uncertainty. Premature abstraction deferred; rename possible later. |
| **@helix fields** | `isHelixTagged` + `isAgentAuthored` | Product requirement: @helix mentions in library comments trigger agent replies with report context. |
| **Conditional rating** | Required for top-level, optional for replies | Top-level comments ARE section ratings; replies are conversational discussion. |

### Rating Taxonomy

| User-Facing | Stored Value | CLI Flag | Meaning |
|-------------|-------------|----------|---------|
| Thumbs down | `THUMBS_DOWN` | `thumbs-down` / `down` | This section didn't work |
| Thumbs up | `THUMBS_UP` | `thumbs-up` / `up` | This section is good |
| Love | `LOVE` | `love` | This section is excellent |

### Git Sidecar Format

Comments are synced to the library repo as a structured JSON file at:
```
reports/{ticketShortId}/runs/{runId}/comments.json
```

**Structure:**

```json
{
  "libraryItemId": "clx1abc2def3ghi",
  "generatedAt": "2026-05-13T14:30:00.000Z",
  "sections": [
    {
      "anchor": "key-findings",
      "heading": "Key Findings",
      "comments": [
        {
          "id": "clx1comment1",
          "rating": "THUMBS_UP",
          "content": "Dive deeper into this",
          "author": { "name": "Alice", "email": "alice@company.com" },
          "createdAt": "2026-05-13T10:15:00.000Z",
          "replies": [
            {
              "id": "clx1reply1",
              "rating": "LOVE",
              "content": null,
              "author": { "name": "Bob", "email": "bob@company.com" },
              "createdAt": "2026-05-13T10:20:00.000Z"
            }
          ]
        }
      ],
      "summary": { "THUMBS_UP": 2, "LOVE": 1, "THUMBS_DOWN": 0 }
    }
  ]
}
```

**Design rationale:**
- Grouped by section for easy agent processing
- Pre-computed per-section summary for quick triage
- Author info denormalized for readability without DB access
- Threaded structure with nested replies
- Machine-readable JSON format

### Sync Strategy

| Aspect | Decision |
|--------|----------|
| **Trigger** | After each DB mutation (create/update/delete) |
| **Debounce** | 5 seconds per `libraryItemId` |
| **Execution** | Async, fire-and-forget (non-blocking) |
| **Write method** | GitHub Contents API (GET current SHA, PUT with SHA) |
| **Target branch** | Report's branch (from `LibraryItem.branch`) |
| **Failure handling** | Log error; don't block; next mutation retriggers |
| **Batching** | Rating 5 sections in 10 seconds produces 1 Git write |

---

## Server Implementation (Phase 1)

The server must be implemented first as it defines the API contract that both client and CLI consume.

### Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 24 | Runtime |
| Express | 5.2.1 | HTTP framework |
| Prisma | 6.19.2 | ORM with file-based migrations |
| Zod | 4.0.0 | API input validation |
| EventEmitter | Node built-in | SSE pub/sub |
| @modelcontextprotocol/sdk | 1.28.0 | MCP tool registration |
| GitHub Contents API | REST v3 | Git sidecar writes |

### New Files

| File | Purpose |
|------|---------|
| `src/services/library-comment-service.ts` | CRUD operations, threading, validation, 5-min edit window |
| `src/services/library-comment-events.ts` | SSE EventEmitter (emit + subscribe) |
| `src/controllers/library-comment-controller.ts` | HTTP handlers (5 functions) |
| `src/services/library-comment-git-sync.ts` | Debounced async Git sidecar writer |
| `src/mcp/tools/library-comments.ts` | 3 MCP tools for agent access |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add LibraryComment model + relations on LibraryItem, User, Organization |
| `prisma/migrations/` | New migration file (auto-generated) |
| `src/routes/api.ts` | Register 6 routes with dual auth before requireAuth |
| `src/mcp/register-tools.ts` | Import and call registerLibraryCommentTools |
| `src/helix-workflow/orchestrator.ts` | Add `## Library Report Feedback` section to ticket.md builder |
| `src/services/ticket-service.ts` | Fetch library comments during rerun creation |

### API Endpoints (6 Routes)

All registered before `requireAuth` (line 265 in api.ts) with `attachInspectionAuth + requireCommentAuth`:

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `POST` | `/library/items/:itemId/comments` | Create comment | Dual (session + inspection) |
| `GET` | `/library/items/:itemId/comments` | List comments (optional `?anchor=` filter) | Dual |
| `GET` | `/library/items/:itemId/comments/summary` | Per-section rating distribution | Dual |
| `PATCH` | `/library/items/:itemId/comments/:commentId` | Update (5-min edit window, own only) | Dual |
| `DELETE` | `/library/items/:itemId/comments/:commentId` | Delete (own only) | Dual |
| `GET` | `/library/items/:itemId/comments/stream` | SSE real-time delivery | Token query param |

### MCP Tools (3 Tools)

| Tool | Read-Only | Key Inputs |
|------|-----------|------------|
| `post-library-comment` | No | libraryItemId, anchor, rating, content?, parentCommentId? |
| `get-library-comments` | Yes | libraryItemId, anchor? |
| `manage-library-comment` | No | commentId, action (edit/delete), content?, rating? |

### Continuation Context Integration

When a rerun is triggered for a ticket with a published library item that has comments, a new `## Library Report Feedback` section is automatically injected into the generated ticket.md:

```markdown
## Library Report Feedback

### key-findings (2 thumbs-up, 1 love)
- [Alice] [THUMBS_UP]: "Dive deeper into this"
- [Bob] [LOVE]

### market-overview (1 thumbs-down)
- [Alice] [THUMBS_DOWN]: "Totally extra, can be removed"
```

This is rendered as a **separate section** from `## Continuation Context` to keep structured feedback distinct from user-provided continuation text.

### @helix Mention Support

Library comments support @helix mentions using the same `/\bhelix\b/i` regex. When detected:
1. `isHelixTagged: true` is set on the comment
2. Fire-and-forget call generates an agent reply with library-specific context:
   - Report content (the markdown being commented on)
   - Section discussion history (comments on the same anchor)
   - The triggering comment
3. Reply posted as a `LibraryComment` with `isAgentAuthored: true`

### Implementation Steps (Server)

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Prisma model + migration | `prisma/schema.prisma` updated, migration generated |
| 2 | CRUD service | `library-comment-service.ts` |
| 3 | SSE events | `library-comment-events.ts` |
| 4 | HTTP controller | `library-comment-controller.ts` |
| 5 | API routes | `api.ts` updated with 6 endpoints |
| 6 | Git sidecar sync | `library-comment-git-sync.ts` |
| 7 | Wire sync into mutations | Service triggers sync on create/update/delete |
| 8 | MCP tools | `library-comments.ts` + registration |
| 9 | Continuation integration | Orchestrator + ticket-service modifications |
| 10 | @helix support | Detection + reply generation |

### Performance Expectations (Server)

| Operation | Expected Latency | Mechanism |
|-----------|-----------------|-----------|
| Create comment | <100ms | Prisma DB write |
| List comments | <50ms | Prisma DB query with index |
| Summary query | <50ms | DB aggregate by anchor |
| SSE delivery | <10ms after write | In-memory EventEmitter |
| Git sidecar sync | 500-2000ms | GitHub API (async, non-blocking) |

---

## Client Implementation (Phase 2a)

### Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | Component framework |
| react-markdown | 10.1.0 | Markdown rendering with components prop |
| rehype-slug | 6.0 | Heading ID generation (section anchors) |
| @tanstack/react-query | 5.90 | Server state, cache, optimistic updates |
| Tailwind CSS | v4.1.18 | Styling (group-hover, transitions, print:hidden) |

No new npm dependencies required.

### Component Architecture

```
library-detail.tsx
  |
  +-- AnnotatedMarkdownRenderer
  |     |-- LibraryCommentContext.Provider
  |     |-- MarkdownRenderer (components={...headingComponents})
  |     |     |
  |     |     +-- SectionHeading (h1-h6, module-level component)
  |     |           |-- SectionFeedbackToolbar (hover, 3 rating buttons)
  |     |           |-- SectionCommentBadge (count, expand toggle)
  |     |
  |     +-- SectionCommentThread (per section, collapsible, OUTSIDE contentRef)
  |           |-- LibraryCommentItem (rating badge, author, text, timestamp)
  |           |-- LibraryCommentInput (rating buttons + textarea)
```

### New Files

| File | Purpose |
|------|---------|
| `src/components/library/library-comment-context.tsx` | React Context for comment data flow |
| `src/components/library/section-heading.tsx` | Custom h1-h6 with toolbar + badge |
| `src/components/library/section-feedback-toolbar.tsx` | Three rating buttons, progressive disclosure |
| `src/components/library/section-comment-badge.tsx` | Comment count indicator |
| `src/components/library/library-comment-input.tsx` | Rating buttons + plain textarea |
| `src/components/library/library-comment-item.tsx` | Individual comment renderer |
| `src/components/library/section-comment-thread.tsx` | Collapsible inline thread |
| `src/components/library/annotated-markdown-renderer.tsx` | Wrapper composing all components |
| `src/hooks/use-library-comment-stream.ts` | SSE hook for real-time delivery |

### Modified Files

| File | Change |
|------|--------|
| `src/components/markdown-renderer.tsx` | Add optional `components` prop (2-line change) |
| `src/api/library.ts` | Add 5 comment query/mutation hooks |
| `src/types/api.ts` | Add `LibraryComment` and `LibraryCommentSummary` types |
| `src/routes/library-detail.tsx` | Replace MarkdownRenderer with AnnotatedMarkdownRenderer |

### Key Design Patterns

**Wrap, Don't Modify MarkdownRenderer**

The existing `MarkdownRenderer` (148 lines) is a shared component used across the application. The change is a 2-line backward-compatible addition:
1. Accept optional `components?: Partial<Components>` prop
2. Spread: `{ ...internalComponents, ...components }`

`AnnotatedMarkdownRenderer` wraps it and passes custom h1-h6 heading components through this prop.

**React Context for Data Flow**

Comment data flows to deeply nested heading components via `LibraryCommentContext`. This avoids defining heading components inline (which would cause remount on every render per React best practices). Heading components are defined at module level and consume context.

**Progressive Disclosure**

1. Hover over heading: toolbar appears with 3 rating buttons
2. Click rating: optimistic update, optional textarea expands
3. Submit text or click away: comment posted
4. Entire flow can be completed in 1 click (rating only)

**PDF Safety**

Feedback toolbars and comment threads are excluded from PDF exports:
- Toolbar uses `opacity-0 group-hover:opacity-100` (invisible in static capture)
- Comment threads render **outside** the `contentRef` div used for PDF generation
- `print:hidden` Tailwind class as safety net

### React Query Hooks

| Hook | Type | Cache Key | Purpose |
|------|------|-----------|---------|
| `libraryCommentsQueryOptions(itemId, anchor?)` | Query | `['library', 'items', itemId, 'comments', { anchor }]` | Fetch comments |
| `libraryCommentSummaryQueryOptions(itemId)` | Query | `['library', 'items', itemId, 'comments', 'summary']` | Rating distribution |
| `useCreateLibraryComment()` | Mutation | - | POST with optimistic update |
| `useUpdateLibraryComment()` | Mutation | - | PATCH, invalidates comments |
| `useDeleteLibraryComment()` | Mutation | - | DELETE, invalidates both |

**Optimistic updates** for `useCreateLibraryComment`: immediately append the comment to cache, update summary counts, roll back on error. This ensures the "instant" feel for one-click ratings.

### SSE Hook

`useLibraryCommentStream(itemId)` follows the existing `use-comment-stream.ts` pattern:
- Creates `EventSource` to `/api/library/items/${itemId}/comments/stream?token=${token}`
- On events: invalidates React Query cache keys for comments and summary
- Auto-reconnect via EventSource
- Cleanup on unmount

### Implementation Steps (Client)

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | TypeScript types | `src/types/api.ts` updated |
| 2 | React Query hooks | `src/api/library.ts` with 5 hooks |
| 3 | SSE hook | `use-library-comment-stream.ts` |
| 4 | MarkdownRenderer extension | 2-line `components` prop addition |
| 5 | LibraryCommentContext | Context + provider |
| 6 | SectionHeading | Custom heading component factory |
| 7 | SectionFeedbackToolbar | 3 rating buttons, progressive disclosure |
| 8 | SectionCommentBadge | Count indicator with toggle |
| 9 | LibraryCommentInput | Rating buttons + textarea |
| 10 | LibraryCommentItem | Comment renderer with actions |
| 11 | SectionCommentThread | Collapsible inline thread |
| 12 | AnnotatedMarkdownRenderer | Wrapper composing all components |
| 13 | library-detail.tsx integration | Replace MarkdownRenderer |

---

## CLI Implementation (Phase 2b)

### Technology Stack

| Technology | Purpose |
|-----------|---------|
| TypeScript (tsc) | Compilation, no bundler |
| `src/lib/http.ts` | `hxFetch` HTTP client with auth |
| `src/lib/flags.ts` | Flag parsing (`getFlag`, `hasFlag`, `getPositionalArgs`) |
| `skill-content/SKILL.md` | Agent discoverability documentation |

No new npm dependencies required.

### New Files

| File | Purpose |
|------|---------|
| `src/library/index.ts` | Router: dispatches to list, show, comments |
| `src/library/list.ts` | `hlx library list` |
| `src/library/show.ts` | `hlx library show <ref>` |
| `src/library/comments.ts` | Nested router for comments subcommands |
| `src/library/comments-list.ts` | `hlx library comments list <ref>` |
| `src/library/comments-post.ts` | `hlx library comments post <ref>` |
| `src/lib/resolve-library-item.ts` | Multi-format item resolution |

### Modified Files

| File | Change |
|------|--------|
| `src/index.ts` | Add `'library'` case to switch dispatcher |
| `skill-content/SKILL.md` | Add Library section with all commands |

### Commands

#### `hlx library list`

Lists library items with status, title, and date.

```
$ hlx library list

ID          Title                    Status      Date
cm...abc    Market Analysis Report   PUBLISHED   2026-05-10
cm...def    Competitor Deep Dive     DRAFT       2026-05-12
```

#### `hlx library show <ref>`

Shows report with section headings annotated with slugs and comment summaries.

```
$ hlx library show RSH-439

# Market Analysis Report (cm...abc)

## Introduction [introduction] (2 comments: 1 thumbs-up, 1 love)
## Key Findings [key-findings] (3 comments: 1 thumbs-up, 1 thumbs-down, 1 love)
## Market Overview [market-overview] (1 comment: 1 thumbs-down)
```

The `[slug]` annotation makes section anchors discoverable for the `--section` flag.

#### `hlx library comments list <ref> [--section <slug>]`

Lists comments grouped by section.

```
$ hlx library comments list RSH-439

## introduction (2 comments)
  [thumbs-up] Alice (2026-05-10): "Great framing"
  [love] Bob (2026-05-11)

## key-findings (3 comments)
  [thumbs-down] Alice (2026-05-10): "Wrong level of abstraction"
    -> [reply] Bob (2026-05-11): "I disagree, this is the right level"
  [thumbs-up] Carol (2026-05-11): "Dive deeper into this"
```

#### `hlx library comments post <ref> --section <slug> --rating <value> [message]`

Posts a section rating with optional text.

```
$ hlx library comments post RSH-439 --section key-findings --rating thumbs-down \
    "Wrong level of abstraction for this audience"

Posted: [thumbs-down] on key-findings: "Wrong level of abstraction for this audience"
```

### Item Resolution

The `<ref>` argument supports three resolution strategies:

| Strategy | Detection | Example |
|----------|-----------|---------|
| **cuid** | Starts with 'c', 25 chars | `clx1abc2def3ghi4jkl5mno6p` |
| **Ticket short ID** | Matches `/^[A-Z]+-\d+$/` | `RSH-439` |
| **Title match** | Fallback | `"Market Analysis"` |

### Section Targeting

The `--section` flag accepts both raw slugs and heading text:
```
--section "Key Findings"  ->  anchor: "key-findings"  (auto-slugified)
--section key-findings    ->  anchor: "key-findings"  (used directly)
```

### Agent Workflow Example

```bash
# 1. Discover sections and feedback status
hlx library show RSH-439

# 2. Read detailed feedback
hlx library comments list RSH-439

# 3. Post feedback on changed sections
hlx library comments post RSH-439-v2 --section key-findings --rating love \
  "Rewrote based on feedback: focused on implementation patterns"
```

### SKILL.md Update

A new `## Library` section is added documenting all commands with flag descriptions. This is **critical for agent discoverability** -- agents read SKILL.md to understand available CLI capabilities.

### Implementation Steps (CLI)

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Resolution utility | `resolve-library-item.ts` |
| 2 | Module router | `src/library/index.ts` |
| 3 | List command | `src/library/list.ts` |
| 4 | Show command | `src/library/show.ts` |
| 5 | Comments router | `src/library/comments.ts` |
| 6 | Comments list | `src/library/comments-list.ts` |
| 7 | Comments post | `src/library/comments-post.ts` |
| 8 | Register in dispatcher | `src/index.ts` updated |
| 9 | SKILL.md | Library section with all commands |

---

## Cross-Cutting Concerns

### Version-Locked Comments

Comments are tied to a specific `libraryItemId`, which represents a specific run/version. When a new iteration is generated, a new `LibraryItem` is created. Comments on Round 1 stay with Round 1; Round 2 starts with a clean slate.

This is intentional: comments are **snapshots of thinking at a point in time**. Round 1 feedback may be addressed in Round 2, so mixing would create confusion.

In the Git repo, each iteration is a self-contained unit:
```
reports/RSH-439/
  runs/
    run-001/
      report.md          # Round 1 report
      comments.json      # Round 1 feedback
    run-002/
      report.md          # Round 2 report (informed by Round 1 feedback)
      comments.json      # Round 2 feedback
```

### Authentication

All library comment endpoints use **dual auth** (`attachInspectionAuth + requireCommentAuth`), matching the proven ticket comment pattern. This enables:
- Browser sessions for web UI users
- Inspection tokens for CLI agents and MCP tools

### Real-Time Delivery

SSE (Server-Sent Events) delivers real-time updates:
- Server: `EventEmitter` with channel per `libraryItemId`
- Client: `EventSource` with React Query cache invalidation
- 30-second keepalive heartbeat
- Auto-reconnect on connection loss

### Agent Access

Agents can access library comments through three channels:
1. **CLI**: `hlx library comments list/post` commands
2. **MCP tools**: `post-library-comment`, `get-library-comments`, `manage-library-comment`
3. **Git repo**: Read `comments.json` directly from the library repository clone

---

## Technical Decisions Register

### 1. Parallel LibraryComment Model vs. Generalized TicketComment

| Chosen | New parallel `LibraryComment` model |
|--------|-------------------------------------|
| Rejected | Generalizing `TicketComment` with nullable `anchor`/`rating` fields |
| Rationale | LibraryComment has unique fields (`anchor`, `rating`) absent from TicketComment, and lacks ticket-specific fields (`mentionedUserIds`). The coupling risk of generalization outweighs the duplication cost (~10 lines of threading logic). |

### 2. Custom Heading Components vs. DOM Post-Processing vs. Rehype Plugin

| Chosen | Custom h1-h6 components via react-markdown's `components` prop |
|--------|---------------------------------------------------------------|
| Rejected | (a) DOM post-processing (race conditions with Shiki); (b) Custom rehype plugin (complex AST manipulation) |
| Rationale | react-markdown's `components` prop is the intended extension mechanism. React-native, type-safe, composable. |

### 3. Inline Section Threads vs. Sidebar Panel vs. Popover

| Chosen | Inline threads below each section, collapsible |
|--------|------------------------------------------------|
| Rejected | (a) Sidebar panel (layout restructuring, spatial disconnect); (b) Popover/modal (small viewport, accessibility) |
| Rationale | Feedback spatially connected to content. Collapsed by default (badge only). Preserves clean reading experience. |

### 4. Plain Text Input vs. Tiptap Rich Editor

| Chosen | Plain `<textarea>` with character guidance |
|--------|------------------------------------------|
| Rejected | Tiptap rich text editor (significant bundle size for a textarea use case) |
| Rationale | Library comments are brief feedback notes. Plain text matches progressive disclosure principle. |

### 5. Debounced Async Git Sync vs. Queue-Based Worker

| Chosen | In-memory debounce (5s window per libraryItemId) |
|--------|------------------------------------------------|
| Rejected | (a) Synchronous Git writes (200-500ms latency per API response); (b) Redis/Bull queue (infrastructure overhead) |
| Rationale | Batches rapid ratings (5 ratings in 10s = 1 Git write). Non-blocking. Idempotent. Queue can be added later. |

### 6. New CLI Library Module vs. Extending Comments Module

| Chosen | New `src/library/` module with own router |
|--------|------------------------------------------|
| Rejected | Adding `--library` flag to existing `hlx comments` (conflates domains, awkward UX) |
| Rationale | Distinct API endpoints, resolution, and interaction patterns. Intuitive: `hlx library comments post`. |

### 7. React Context vs. Closure for Comment Data

| Chosen | `LibraryCommentContext` provider |
|--------|--------------------------------|
| Rejected | Closure-based (components inside AnnotatedMarkdownRenderer to capture data) |
| Rationale | Violates React best practice: inline components cause full remount on every render. Module-level components with Context preserve identity. |

### 8. Continuation Context: Separate Section vs. Appended

| Chosen | New `## Library Report Feedback` section in ticket.md |
|--------|------------------------------------------------------|
| Rejected | Appending to `continuationContext` string (max 10,000 chars) |
| Rationale | Structured feedback is distinct from user-provided continuation text. Separate sections are readable and parseable. |

---

## Enhancement Brainstorm

Beyond MVP, these creative enhancements extend the feedback and iteration flow:

### 1. Smart Feedback Summarization
AI agent automatically summarizes per-section feedback into a concise directive: "Team consensus: expand Key Findings with more data, remove Market Overview (3/4 thumbs down), keep Technical Architecture as-is (unanimously loved)." Reduces cognitive load before triggering the next iteration.

### 2. Consensus Heat Map
Visual indicators on each section showing team alignment. Unanimous "love" glows green, mixed ratings show amber, unanimous "thumbs down" shows red. Small badge shows ratio (e.g., "3/4 positive"). Scannable at a glance.

### 3. Feedback-Driven Section Ordering
Alternative view mode reordering sections by feedback intensity. Most-discussed sections appear first. Surfaces sections needing the most attention for the next iteration.

### 4. Comment Templates / Quick Reactions
Pre-built feedback phrases as one-click chips: "Dive deeper," "Too verbose," "Needs data," "Wrong audience," "Great framing." Faster than typing, creates structured categorizable feedback.

### 5. Cross-Report Feedback Patterns
Aggregate trends across multiple reports. Which sections consistently get low ratings? Are certain structures more successful? Transforms individual feedback into organizational learning.

### 6. Feedback-to-Task Conversion
Turn a thumbs-down comment into an actionable task: "Add citation data to Key Findings section." Bridges the gap between feedback and action.

### 7. Section-Level Version Diff
Show what changed in each section compared to the previous version. Closes the feedback loop: "I said thumbs down with 'wrong level of abstraction' and now this section has been completely reframed."

### 8. Agent Auto-Commentary
After generating a new iteration, agent automatically posts comments on changed sections explaining what it did and why. Creates transparent trail of agent reasoning.

---

## MVP Scope and Boundaries

### In Scope (14 Features)

| # | Feature |
|---|---------|
| 1 | Three-level section rating per heading (thumbs up, love, thumbs down) |
| 2 | Optional text with ratings |
| 3 | Section anchoring via heading slugs |
| 4 | Threaded comments per section (single-level) |
| 5 | Real-time comment delivery via SSE |
| 6 | Hybrid storage (DB operational + async Git sidecar) |
| 7 | Git sidecar files (comments.json alongside report.md) |
| 8 | API endpoints (6 CRUD + SSE) with dual auth |
| 9 | MCP tools (3 agent-accessible tools) |
| 10 | CLI commands (list, show, comments list, comments post) |
| 11 | Version-locked comments per report iteration |
| 12 | Section feedback summary (at-a-glance distribution) |
| 13 | @helix mentions with agent reply (report context) |
| 14 | Continuation auto-context (comments in ticket.md for reruns) |

### Explicitly Out of Scope

| Feature | Why Deferred |
|---------|-------------|
| Sub-heading anchoring (paragraph/list-item) | Requires custom rehype plugin; fragile across versions |
| Comment carry-forward between iterations | Requires "resolved" state tracking |
| Inline text-selection commenting | Fundamentally different from heading-level feedback |
| Auto-triggering iteration runs | Requires orchestrator integration |
| Rich text comment editing | Plain text sufficient for brief feedback |
| Comment resolution/close workflow | Adds complexity without MVP value |
| Diff view between iterations | Significant standalone feature |
| Notification system (email/push) | Requires notification infrastructure |
| Extending to non-library artifacts | Future scope; model naming accommodates |

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Concurrent Git sync conflicts** | Medium | Debounced async sync (5s window) batches rapid comments. Single-writer-per-item pattern avoids SHA conflicts. |
| **Anchor stability across heading renames** | Low | Acceptable because comments are version-locked. Old comments stay on old slug. |
| **GitHub API rate limits** | Low | At expected scale (<500 comments/item, debounced), well within limits. |
| **In-memory debounce in multi-instance** | Medium | Acceptable for MVP. Duplicate writes are harmless (idempotent). Redis-backed debounce deferred. |
| **Server Phase 1 blocks Phase 2** | Low | Server defines API contract; client and CLI are independent consumers and can proceed in parallel once the contract is established. |
| **PDF export with interactive overlays** | Low | Toolbar uses CSS-only hover (invisible in static capture). Threads render outside contentRef. print:hidden as safety net. |

---

## Implementation Sequencing

```
Phase 1: Server (helix-global-server) — FIRST
  Step 1:  Prisma migration: LibraryComment model
  Step 2:  library-comment-service.ts: CRUD, threading, validation
  Step 3:  library-comment-events.ts: SSE
  Step 4:  library-comment-controller.ts: HTTP handlers
  Step 5:  API routes: 6 endpoints with dual auth
  Step 6:  Git sidecar sync: debounced async
  Step 7:  Wire sync into service mutations
  Step 8:  MCP tools: 3 tools
  Step 9:  Continuation context integration
  Step 10: @helix mention support
  [All API and data contracts established]

Phase 2a: Client (helix-global-client)     Phase 2b: CLI (helix-cli)
  Steps 1-3:  Types, hooks, SSE              Steps 1-2: Resolution utility, router
  Steps 4-5:  MarkdownRenderer + Context     Steps 3-4: List, show commands
  Steps 6-8:  Heading, toolbar, badge        Steps 5-7: Comments subcommands
  Steps 9-11: Input, item, thread            Step 8:    Register in dispatcher
  Steps 12-13: Wrapper + integration         Step 9:    SKILL.md update
  [13 steps total]                           [9 steps total]
```

**Total new files**: ~18 across all repos
**Total modified files**: ~10 across all repos
**No new npm dependencies** in any repo

---

## Success Criteria

| # | Criterion | Surface |
|---|-----------|---------|
| 1 | A user can rate all sections of a 10-section report within **30 seconds** using one-click ratings | UI |
| 2 | Comments (ratings + optional text) appear for all viewers in **real-time** without page refresh | UI, SSE |
| 3 | Triggering a continuation **automatically includes** accrued comments as context | Server |
| 4 | Agents can read section-level feedback via `hlx library comments list` and MCP tools | CLI, MCP |
| 5 | Comments are persisted in Git as `comments.json` sidecar files alongside report snapshots | Server |
| 6 | Navigating between report versions shows the correct **version-locked comments** | UI |
| 7 | @helix mentions in library comments trigger agent replies with full report context | Server, UI |
| 8 | SKILL.md and agent prompts reference that previous version comments exist | CLI |
| 9 | `npm run build` passes with zero TypeScript errors in all three repos | All |

---

## Future Roadmap

| Enhancement | Priority | Complexity | Prerequisites |
|-------------|----------|------------|--------------|
| Smart feedback summarization (AI) | High | Medium | LLM integration, summary comment type |
| Section-level version diff | High | High | Markdown diff engine, section extraction |
| Auto-generated change rationale | High | Medium | Cross-version comment analysis |
| Sub-heading anchoring | Medium | High | Custom rehype plugin, stable IDs |
| Comment carry-forward | Medium | Medium | Resolved/unresolved state |
| Consensus heat map | Medium | Low | Summary endpoint already provides data |
| Annotated markdown view | Medium | Medium | Rendering engine changes |
| `--json` CLI output flag | Medium | Low | Output formatting layer |
| Comment resolution workflow | Low | Low | State field + UI toggle |
| Rich text editing (Tiptap) | Low | Medium | Bundle size considerations |
| Notification system | Low | High | Notification infrastructure |
| Interactive section selection (fzf) | Low | Low | Terminal UI library |
| Extending to non-library artifacts | Medium | Medium | Polymorphic model or rename |

---

## Appendix: TypeScript Types

### LibraryComment

```typescript
interface LibraryComment {
  id: string;
  libraryItemId: string;
  anchor: string;
  rating: 'THUMBS_UP' | 'LOVE' | 'THUMBS_DOWN' | null;
  content: string | null;
  authorUserId: string;
  authorUser: { id: string; name: string | null; email: string };
  parentCommentId: string | null;
  isHelixTagged: boolean;
  isAgentAuthored: boolean;
  replies: LibraryComment[];
  createdAt: string;
  updatedAt: string;
}
```

### LibraryCommentSummary

```typescript
interface LibraryCommentSummary {
  [anchor: string]: {
    THUMBS_UP: number;
    LOVE: number;
    THUMBS_DOWN: number;
    total: number;
  };
}
```

### Zod Validation (Server)

```typescript
const ratingSchema = z.enum(["THUMBS_UP", "LOVE", "THUMBS_DOWN"]);

const createLibraryCommentSchema = z.object({
  anchor: z.string().min(1),
  rating: ratingSchema,       // Required for top-level
  content: z.string().optional(),
  parentCommentId: z.string().optional(),
});
// Note: When parentCommentId is present, rating becomes optional
```

---

## Appendix: File Change Summary

### helix-global-server (10 steps)

| Type | File | Purpose |
|------|------|---------|
| New | `src/services/library-comment-service.ts` | CRUD, threading, validation |
| New | `src/services/library-comment-events.ts` | SSE EventEmitter |
| New | `src/controllers/library-comment-controller.ts` | HTTP handlers |
| New | `src/services/library-comment-git-sync.ts` | Debounced async Git writer |
| New | `src/mcp/tools/library-comments.ts` | 3 MCP tools |
| New | `prisma/migrations/*` | Migration file |
| Mod | `prisma/schema.prisma` | LibraryComment model + relations |
| Mod | `src/routes/api.ts` | 6 routes with dual auth |
| Mod | `src/mcp/register-tools.ts` | Register library comment tools |
| Mod | `src/helix-workflow/orchestrator.ts` | Library Report Feedback section |
| Mod | `src/services/ticket-service.ts` | Fetch comments during rerun |

### helix-global-client (13 steps)

| Type | File | Purpose |
|------|------|---------|
| New | `src/components/library/library-comment-context.tsx` | React Context |
| New | `src/components/library/section-heading.tsx` | Custom heading factory |
| New | `src/components/library/section-feedback-toolbar.tsx` | Rating buttons |
| New | `src/components/library/section-comment-badge.tsx` | Count indicator |
| New | `src/components/library/library-comment-input.tsx` | Rating + textarea |
| New | `src/components/library/library-comment-item.tsx` | Comment renderer |
| New | `src/components/library/section-comment-thread.tsx` | Collapsible thread |
| New | `src/components/library/annotated-markdown-renderer.tsx` | Wrapper component |
| New | `src/hooks/use-library-comment-stream.ts` | SSE hook |
| Mod | `src/components/markdown-renderer.tsx` | Optional `components` prop |
| Mod | `src/api/library.ts` | 5 comment hooks |
| Mod | `src/types/api.ts` | LibraryComment types |
| Mod | `src/routes/library-detail.tsx` | Use AnnotatedMarkdownRenderer |

### helix-cli (9 steps)

| Type | File | Purpose |
|------|------|---------|
| New | `src/library/index.ts` | Module router |
| New | `src/library/list.ts` | List command |
| New | `src/library/show.ts` | Show command |
| New | `src/library/comments.ts` | Comments nested router |
| New | `src/library/comments-list.ts` | Comments list command |
| New | `src/library/comments-post.ts` | Comments post command |
| New | `src/lib/resolve-library-item.ts` | Item resolution |
| Mod | `src/index.ts` | Add library case |
| Mod | `skill-content/SKILL.md` | Library section |

**Total**: ~18 new files, ~10 modified files, 0 new dependencies

## Attachments
- (none)

## Discussion
- **Helix** (2026-05-13T23:10:12.944Z) [Agent]: Changes applied to 3 repositories. Verification could not be fully completed — please review the changes manually.
- **Helix** (2026-05-15T00:12:52.286Z) [Agent]: Changes applied to 3 repositories. Verification could not be fully completed — please review the changes manually.
- **Usher** (2026-05-15T00:13:54.668Z) [Helix]: @Helix what's the status
- **Helix** (2026-05-15T00:14:06.897Z) [Agent]: Here's where things stand:

- **Ticket status:** Unverified
- **Runs completed:** 2
- **Repos with changes:** `helix-global-client`, `helix-global-server`, and `helix-cli` — all on the same feature branch.

The most recent run finished about **15 hours ago**. All the heavy lifting (analysis, planning, code changes, code review) was done in the first run. The second run went straight to testing, but both runs ended in an **unverified** state, meaning the automated testing couldn't fully confirm everything is working as expected.

**Next steps:** The changes are in place, but they need a manual review to verify correctness before the ticket can be marked complete. Would you like me to rerun, or would you prefer to review the branches manually first?
- **Usher** (2026-05-15T00:15:02.747Z) [Helix]: Why is it unverified
- **Helix** (2026-05-15T00:15:31.898Z) [Agent]: The testing step couldn't produce a verification report in either run, so I don't have a specific error message to point to. However, based on the details from both runs, there are a few **known gaps** that likely contributed:

1. **Missing optimistic updates** — When a comment is submitted, the UI waits for the server to respond before updating. Comments still work, but there's a visible delay. The spec called for instant/optimistic updates that were never implemented.

2. **Rating field is required when it shouldn't be** — The database schema marks the `rating` field as NOT NULL, but the spec says ratings should be optional for reply comments. This is a schema deviation that would need a migration to fix.

3. **@Helix replies in library comments are disabled** — The code detects `@helix` mentions in library comments, but the actual reply handler was intentionally disabled because it was calling the wrong service (it was passing a library item ID where a ticket ID was expected). So @helix won't respond to library comment mentions for now.

4. **Thread placement** — Comment threads render inside the PDF export boundary, though print-hiding CSS mitigates this in practice.

The code changes themselves are in place across all 3 repos and the build passes — these are feature gaps and spec deviations rather than hard failures. Would you like me to do a rerun to try verification again, or would you prefer to review and address these gaps first?
- **Usher** (2026-05-15T00:16:21.307Z) [Helix]: Let's go ahead and do those. Also I don't like the heart. It should be a double thumbs up.

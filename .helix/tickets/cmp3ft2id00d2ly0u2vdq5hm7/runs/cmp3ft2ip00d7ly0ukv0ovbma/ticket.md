# Ticket Context

- ticket_id: cmp3ft2id00d2ly0u2vdq5hm7
- short_id: RSH-443
- run_id: cmp3ft2ip00d7ly0ukv0ovbma
- run_branch: helix/research/RSH-443-ticket-to-implement-library-comments-and-iteration
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Ticket to Implement: Library Comments and Iteration

## Description
Give me a ticket to build this. Use the sensible defaults. I have three suggestions.

One, instead of calling the database table library comments, etc., you can call them artifact comments because we can extend it soon to any number of things. We can extend it to the artifact. We can extend it to the business Bible that'll come soon. I don't know if artifact comments is the right thing but really it's anything that is markdown or similar is commentable. That's valuable [context.It](http://context.It)'s out of scope for now but we'll bring it in at some point so I would lay the ground for that.

 

 

Second I think once we have this implemented, the primary way of doing continuations is going to be from the comments. I wanted to be clear that when you do a continuation it should bring those comments (aka corrections) along with whatever final comment in the continuation box is put in as the continuation context. This is an easy way to also bring in previous comments.

 

 

Third the comments must absolutely keep the @helix mentions for questions about the report. It should have access to all the information it currently has.

 

 

Although comments on previous versions is out of scope is, in the system prompt or skill for reports, to make mention that there may be previous comments and that they should look at all the versions of the comments to see the theme. It's very easy to do that. I don't know exactly how you should do that but I would imagine that that would be very simple to do there. All you have to do is inform the agent that it can avail itself to it, right? I want that to be clear that this is going to be the primary way to do continuations for reports and probably eventually for all tickets but now for reports. The user should not have to manually bring the comments into the context of the continuation. When you do a continuation, it should be implied that the continuation is on the accrued comments. Along with that, you can still add that final bit before hitting continue but that's just the icing on the top.

 

 

Once you're at it, feel free to update skills and prompts in general to understand this library process.

## Research Report

# Library Comments and Iteration: Research Report

**Ticket**: RSH-439  
**Date**: 2026-05-13  
**Repos**: helix-global-server, helix-global-client, helix-cli

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Space & User Flows](#problem-space--user-flows)
3. [Enhancement Brainstorm](#enhancement-brainstorm)
4. [Implementation Approaches](#implementation-approaches)
5. [Recommended Architecture](#recommended-architecture)
6. [Storage Design](#storage-design)
7. [UI Design](#ui-design)
8. [CLI & Agent Interface](#cli--agent-interface)
9. [Cross-Iteration & Version Access](#cross-iteration--version-access)
10. [Technical Decisions & Trade-offs](#technical-decisions--trade-offs)
11. [MVP Scope, Risks, & Future](#mvp-scope-risks--future)

---

## Executive Summary

Library reports in the Helix platform are currently read-only markdown artifacts backed by Git. Once a report is generated and published, there is no mechanism for users to provide feedback, rate sections, or collaborate on improvements. All discussion today lives on tickets, but the library is the natural home for iterating on research output. A report owner who wants to say "this section is great" or "this missed the mark" has no way to express that on the report itself.

This report proposes a **section-level feedback and collaborative iteration system** for library reports. Users and coding agents will be able to quickly rate any heading section of a report (thumbs up / love / thumbs down), add optional text context, and participate in threaded discussions that drive the next iteration. The system spans three surfaces with equal depth: the web UI, the Helix CLI, and agent/MCP integration.

The **recommended implementation** uses a **hybrid storage architecture**: PostgreSQL as the operational source of truth (fast CRUD, SSE real-time delivery, queries and aggregation) with asynchronous Git sync that writes structured `comments.json` sidecar files alongside report snapshots in the library repo. This delivers responsive, real-time collaboration while honoring the vision that the library repo should be a self-contained knowledge artifact with full editorial history.

The implementation spans **three repositories**: the server (data model, API, SSE, MCP tools, Git sync), the client (section feedback UI with progressive disclosure), and the CLI (new library module with list, show, and comment commands). The server must be implemented first, as both the client and CLI depend on its API.

---

## Problem Space & User Flows

### The Problem

Library reports are generated as markdown files committed to a Git repository. They represent research output, analysis, and findings that teams iterate on over multiple rounds. Today, these reports are **static, read-only documents** in the UI and CLI. The only way to discuss a report is through the originating ticket's discussion thread, which is disconnected from the report content itself.

This creates several pain points:

- **No section-level feedback**: Users cannot express opinions about individual sections. Feedback is all-or-nothing at the document level.
- **No quick triage**: A report owner scanning a 10-section report cannot quickly mark which sections hit and which missed without typing lengthy comments.
- **No team collaboration on reports**: Multiple team members cannot independently review and discuss sections.
- **No agent context for iteration**: When generating the next round, coding agents have no structured feedback data to inform improvements.
- **Disconnected editorial history**: The reasoning behind why sections changed between iterations is lost.

### User Personas

| User | Role | Primary Need |
|------|------|-------------|
| **Report Owner** | Primary contributor who reviews their report | Quick section-level ratings to guide the next iteration |
| **Team Members** | Collaborators providing diverse perspectives | Add feedback, discuss sections, contribute different viewpoints |
| **Coding Agents** | Automated agents generating report iterations | Read structured feedback as context for the next round; post comments programmatically |

### Flow 1: Quick Section Triage (Netflix-Style Rating)

The simplest and most important flow. A report owner opens a freshly generated report and wants to quickly signal what worked and what didn't.

**User actions:**
1. Open a library report in the UI.
2. Hover over any heading section (e.g., "Key Findings").
3. A floating toolbar appears with three buttons: thumbs down, thumbs up, love.
4. Click a rating button. The rating is recorded immediately with a single click.
5. Move to the next section and repeat.

**Expected outcome:** Within 30 seconds, the owner has rated every section of the report. This creates enough signal to generate a meaningful second round, even without any text commentary. The ratings themselves are valuable metadata: they encode what the report owner liked, what they loved, and what fell short.

**Why this matters:** As described in the ticket, "That should really be enough information to do a second round. First of all it marks information and it marks context: what I liked and what I didn't like." The Netflix three-level system (thumbs down / thumbs up / double thumbs up) is intentionally simple and fast.

### Flow 2: Rating with Context

When a section warrants more than a single rating, the user can add a brief text note alongside their rating.

**User actions:**
1. Rate a section (same as Flow 1).
2. After clicking a rating, an optional text input expands below.
3. Type a brief note: "Dive deeper into this" / "Totally extra" / "Wrong level of abstraction" / "Technically correct but wrong focus."
4. Submit the comment.

**Expected outcome:** The section now has a rating plus context. This provides richer signal for the next iteration. The text explains *why* the rating was given, making the feedback actionable.

**Example feedback patterns:**
- Thumbs up + "Dive deeper into this" = positive direction, expand this section
- Thumbs down + "Totally extra" = remove this section entirely
- Thumbs down + "Wrong" = factual error or incorrect framing
- Thumbs down + "Technically correct but the wrong level of abstraction" = valid content, wrong presentation

### Flow 3: Team Review (Multi-User Discussion)

Multiple team members independently contribute to a collaborative review. This builds threaded discussion per section.

**User actions:**
1. Multiple team members open the same report.
2. Each person independently rates sections and adds comments.
3. Team members can see each other's comments in real-time (via SSE).
4. Anyone can reply to someone else's comment, creating a threaded discussion.
5. The discussion evolves: "I didn't really like that" / "Let's dig deeper here" / "Here's how I would say this."

**Expected outcome:** Every section has a rich picture of team thinking. Agreement, disagreement, and nuance are all captured. As described in the ticket: "You can even comment on what someone else commented, right? You can fight back and this is all extremely valuable context."

### Flow 4: Agent-Driven Iteration

A coding agent reads all accumulated section feedback and uses it as context to generate the next iteration.

**User actions:**
1. Report owner adds a final summary comment and triggers a new iteration.
2. The coding agent reads all section comments via CLI (`hlx library comments list`) or MCP tools.
3. The agent can also read the `comments.json` sidecar file directly from the Git repo.
4. The agent uses section-level feedback to inform what to expand, cut, rewrite, or reframe.
5. Round 2 is generated with all feedback context.

**Expected outcome:** The next iteration is informed by structured, section-level feedback rather than a single vague instruction. Sections that received "love" are preserved; sections with "thumbs down" and explanatory text are rewritten or removed.

### Flow 5: Cross-Iteration Review

A user navigates to a previous version of the report to see what feedback was given and how it drove changes.

**User actions:**
1. Open a library report showing the latest version (Round 2).
2. Use the existing version selector to navigate to Round 1.
3. See the comments and ratings that were left on Round 1.
4. Understand *why* sections changed between iterations.

**Expected outcome:** Full editorial transparency. "Why did this section get rewritten?" becomes answerable by looking at Round 1's feedback. This creates a living editorial trail — not just what changed, but the reasoning behind it.

---

## Enhancement Brainstorm

The ticket specifically asked for brainstorming on ways to enhance the feedback and iteration flow. Here are creative ideas that extend beyond the core requirements, spanning all four surfaces (UI, CLI, agent, Git).

### 1. Smart Feedback Summarization

**Idea**: After a team review round, an AI agent automatically summarizes the feedback per section into a concise directive. Instead of a developer reading 12 comments across 8 sections, they get a one-paragraph summary: "Team consensus: expand Key Findings with more data, remove the Market Overview (3/4 thumbs down), and keep the Technical Architecture section as-is (unanimously loved)."

**Value**: Reduces cognitive load for the person triggering the next iteration. Especially valuable when 5+ team members contribute feedback. The summary itself becomes context for the next round.

**Surface**: Agent-driven (CLI or MCP tool: `hlx library comments summarize <ref>`). Output could be stored as a special "summary" comment or presented in the UI as a collapsible section.

### 2. Consensus Heat Map

**Idea**: A visual indicator on each section showing team alignment. Sections with unanimous "love" glow green. Sections with mixed ratings (some thumbs up, some thumbs down) show amber. Sections with unanimous "thumbs down" show red. A small badge shows the ratio (e.g., "3/4 positive").

**Value**: At a glance, the report owner can see where the team agrees and where there's tension. This visual language makes the report scannable for feedback status without reading individual comments.

**Surface**: UI-primary (color-coded badges or heat strips on section headings). Could also be reflected in CLI output: `[3/4 positive]` next to section titles.

### 3. Feedback-Driven Section Ordering

**Idea**: An alternative view mode that reorders sections by feedback intensity. The most-discussed sections (most comments, most disagreement) appear first. This surfaces the sections that need the most attention for the next iteration.

**Value**: For long reports with 15+ sections, some sections are uncontroversial and need no attention. Others are hotly debated. Reordering by feedback intensity focuses iteration effort where it matters most.

**Surface**: UI (toggle between "report order" and "feedback order" views). CLI (`hlx library show <ref> --sort feedback`).

### 4. Comment Templates / Quick Reactions

**Idea**: Pre-built feedback phrases that users can apply with a single click. Beyond the three-level rating, common feedback phrases like "Dive deeper," "Too verbose," "Needs data," "Wrong audience," "Great framing" appear as quick-select chips. These are faster than typing and create structured, categorizable feedback.

**Value**: Makes Flow 2 (rating with context) almost as fast as Flow 1 (quick rating). Creates consistency in feedback vocabulary across the team. The structured tags are machine-parseable for automated analysis.

**Surface**: UI (chips below rating buttons). CLI (`hlx library comments post <ref> --section <slug> --rating thumbs-up --template "dive-deeper"`).

### 5. Cross-Report Feedback Patterns

**Idea**: Aggregate feedback trends across multiple reports. Which sections consistently get low ratings across all reports? Are certain report structures more successful than others? Is there a pattern where "Introduction" sections always get thumbs down while "Technical Architecture" sections get love?

**Value**: Over time, this data reveals what works and what doesn't in report generation. It can inform report templates, section ordering, and generation prompts. It transforms individual feedback into organizational learning.

**Surface**: UI (analytics dashboard or trends view in the library). Agent (automated analysis triggered after N reports are reviewed).

### 6. Feedback-to-Task Conversion

**Idea**: Turn a thumbs-down comment with text into an actionable task. A "thumbs down + 'needs citation data'" comment could generate a to-do item: "Add citation data to Key Findings section." These tasks can be tracked, assigned, or fed directly to the iteration agent.

**Value**: Bridges the gap between feedback and action. Especially useful for team reviews where feedback is distributed across sections and people. The task list becomes a concrete iteration checklist.

**Surface**: UI (convert comment to task button). CLI (`hlx library comments promote <comment-id>`). Agent (auto-extract tasks from negative feedback).

### 7. Section-Level Version Diff

**Idea**: When viewing a new iteration, show what changed in each section compared to the previous version. A diff indicator next to each heading: "This section was rewritten" / "This section was expanded" / "This section is unchanged." Optionally, show a side-by-side diff of the section content.

**Value**: Closes the feedback loop. After providing feedback, reviewers can see exactly how their feedback was addressed. "I said thumbs down with 'wrong level of abstraction' and now this section has been completely reframed."

**Surface**: UI (diff indicators on headings, expandable side-by-side view). CLI (`hlx library diff <ref> --version v1 --version v2`). Git (standard git diff on the markdown files).

### 8. Agent Auto-Commentary

**Idea**: When a coding agent generates a new iteration, it automatically posts comments on sections it changed, explaining what it did and why. "Rewrote this section based on 3 thumbs-down ratings and feedback: 'wrong level of abstraction.' Now focuses on implementation patterns rather than theoretical framework."

**Value**: Creates a transparent trail of agent reasoning. Users can see not just what the agent changed, but why. This builds trust in the iteration process and provides context for the next review round.

**Surface**: Agent-driven (automatic post-generation comments). Visible in UI and CLI. Stored in Git sidecar alongside human comments.

---

## Implementation Approaches

The ticket asked for "a couple of ways to implement this because it's not exactly clear how to implement this" with "pros and cons and trade-offs." Here are four distinct approaches.

### Approach A: Pure Git Storage

Comments are stored entirely as files in the library Git repository. No database involvement.

**Architecture:**
```
User Action -> API Server -> GitHub Contents API -> Git Repository
                                                      |
                                                  comments.json / .md files
                                                      |
UI / CLI / Agent <-- read from Git directly or via API
```

**How it works:**
- Each comment is written as a JSON entry in a sidecar file (e.g., `comments.json`) alongside the report markdown.
- The API server reads and writes comments by calling the GitHub Contents REST API.
- Comments are part of the Git history, versioned with the report.
- No database model, no Prisma migration.

| Pros | Cons |
|------|------|
| Fully self-contained Git repo (the ultimate vision) | 200-500ms latency per write (GitHub API round-trip) |
| Version history is completely native | SHA conflicts on concurrent writes (multiple users commenting simultaneously) |
| No database complexity | Cannot support SSE real-time delivery (no event source) |
| Agents can read comments directly from repo clone | Cannot query, filter, sort, or aggregate without reading full files |
| Simple data model (just files) | No efficient per-section filtering |
| Aligns perfectly with ticket owner's Git preference | Poor UX for multi-user collaboration scenarios |

**Best suited for**: Solo use, low comment volume, environments where Git is the only available storage.

**Risk assessment**: HIGH for MVP. Concurrent write conflicts with multiple users would cause data loss or require complex conflict resolution. Real-time delivery (SSE) is impossible without a server-side event source.

### Approach B: Pure Database Storage

Comments are stored in PostgreSQL via Prisma. No Git persistence.

**Architecture:**
```
User Action -> API Server -> PostgreSQL (Prisma)
                    |
                    +--> SSE Events -> UI (real-time)
                    |
UI / CLI / Agent <-- REST API queries
```

**How it works:**
- New `LibraryComment` Prisma model with all comment data.
- Full CRUD via REST API endpoints.
- SSE real-time delivery from EventEmitter (same pattern as ticket comments).
- Comments exist only in the database.

| Pros | Cons |
|------|------|
| Fast CRUD (<100ms writes) | Library repo is NOT self-contained |
| Full SSE real-time support | Agents reading the Git repo don't see feedback context |
| Efficient queries, filtering, aggregation | Loses the "all context in the library" vision |
| Follows proven TicketComment pattern | No Git version history for comments |
| Handles concurrent writes natively | Comments are not portable (tied to DB) |
| Simplest implementation | Breaks the Git-native principle |

**Best suited for**: Environments prioritizing UX speed and real-time collaboration, where Git self-containment is not important.

**Risk assessment**: LOW technical risk, but HIGH misalignment with the ticket owner's stated vision: "I think having all that context in the library would really be next level."

### Approach C: Hybrid Storage (Recommended)

Database as operational source of truth with asynchronous Git sidecar sync.

**Architecture:**
```
User Action -> API Server -> PostgreSQL (Prisma) ---> SSE Events -> UI
                    |                |
                    |                +--[async, debounced]---> GitHub Contents API
                    |                                              |
                    |                                          comments.json
                    |
UI / CLI / Agent <-- REST API (fast)
Agent <-------------- Git repo (comments.json, slightly delayed)
```

**How it works:**
- `LibraryComment` Prisma model is the operational source of truth.
- All reads and writes go through the database for speed and reliability.
- After each DB mutation, an asynchronous, debounced sync writes the current comment state to a `comments.json` file in the Git repo alongside the report.
- The Git sidecar is a structured JSON snapshot that provides self-containment and agent readability.
- If the Git sync fails, it does not block the API response. The DB is authoritative; the next mutation retriggers the sync.

| Pros | Cons |
|------|------|
| Fast CRUD via DB + full SSE real-time | Additional complexity (sync layer) |
| Self-contained Git repo for agents and durability | Eventual consistency (Git lags DB by seconds) |
| Handles concurrent writes natively (DB) | Sync failure handling required |
| Git history captures comment evolution | Two sources of truth (DB is primary) |
| Satisfies both UX and Git-native requirements | Slightly more engineering effort |
| Comments survive DB failure (in Git) | Debounce window means rapid comments batch |

**Best suited for**: Production environments needing both responsive UX and Git self-containment. This is the sweet spot for the Helix use case.

**Risk assessment**: MEDIUM. The sync layer adds complexity, but it's a well-understood pattern (write-behind cache). Failures are non-blocking and self-healing (next mutation retriggers).

### Approach D: Git-First with DB Cache

Git is the source of truth. Database is a read cache populated from Git.

**Architecture:**
```
User Action -> API Server -> GitHub Contents API (write) -> Git Repository
                    |                                            |
                    +-- read from DB cache <-- sync from Git ----+
                    |
                    +--> SSE Events (from Git webhook)
```

**How it works:**
- All writes go to Git first (GitHub Contents API).
- A sync process reads from Git and populates a DB cache for fast reads.
- SSE events are triggered by Git webhooks or polling.
- The DB is a denormalized read cache, not a source of truth.

| Pros | Cons |
|------|------|
| Git is the true source of truth | Write latency (200-500ms per comment) |
| Self-contained repo by default | SHA conflicts on concurrent writes |
| DB provides fast reads | Complex sync from Git to DB |
| Git webhooks can drive SSE | Webhook delivery is not guaranteed |
| Strong data durability | Write path is fragile (GitHub API rate limits) |
| Aligns with "Git-first" philosophy | More moving parts than Approach C |

**Best suited for**: Environments where Git-as-source-of-truth is a hard requirement and write latency is acceptable.

**Risk assessment**: HIGH. The write path through GitHub API is fragile under concurrent load, and the Git-to-DB sync adds complexity without significant benefit over Approach C.

### Comparative Summary

| Criterion | A: Pure Git | B: Pure DB | C: Hybrid (rec.) | D: Git-First |
|-----------|:-----------:|:----------:|:-----------------:|:------------:|
| Write latency | Slow (200-500ms) | Fast (<100ms) | Fast (<100ms) | Slow (200-500ms) |
| Real-time (SSE) | No | Yes | Yes | Partial |
| Git self-containment | Full | None | Full (async) | Full |
| Concurrent writes | Conflicts | Native | Native | Conflicts |
| Query/filter/sort | No | Yes | Yes | Yes (via cache) |
| Implementation complexity | Low | Low | Medium | High |
| Alignment with vision | High | Low | High | High |
| Production readiness | Low | High | High | Medium |
| **Overall recommendation** | Not for MVP | Possible but limited | **Recommended** | Overly complex |

---

## Recommended Architecture

### Why Hybrid Storage

The ticket owner's vision is clear: "I think having all that context in the library would really be next level. I think that's the direction we should push in even if it's a little bit awkward." At the same time, the product requirements demand real-time delivery, concurrent multi-user collaboration, and responsive API interactions that pure Git storage cannot deliver.

The hybrid approach resolves this tension elegantly. As the ticket discussion confirmed: "We are also not beholden to a UI or CLI interface that exactly mirrors the way it is stored in Git. We can be creative in how the CLI and UI access the information."

The **storage format** (structured JSON in Git) is optimized for **durability, portability, and machine-readability**. Each **interface** (UI, CLI, agent) is optimized for **its user's experience**. They are separate design problems with separate solutions.

### Architecture Overview

```
                                    +-------------------+
                                    |   GitHub Library   |
                                    |      Repo          |
                                    |                   |
                                    | reports/           |
                                    |   {shortId}/       |
                                    |     runs/{runId}/  |
                                    |       report.md    |
                                    |       comments.json| <-- sidecar
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
8. **Git sync executes**: Reads all comments for the item, serializes to JSON, writes `comments.json` via GitHub Contents API (~500-2000ms)
9. **Git sync result**: Logged; failures don't block; next mutation retriggers

### Three-Repo Responsibility Split

| Repository | Responsibility | Key New Components |
|------------|---------------|--------------------|
| **helix-global-server** | Data model, API, SSE, MCP tools, Git sync | LibraryComment model, library-comment-service, library-comment-controller, library-comment-events, MCP tools |
| **helix-global-client** | Section feedback UI | AnnotatedMarkdownRenderer, SectionFeedbackToolbar, SectionCommentThread, LibraryCommentInput, API hooks, SSE hook |
| **helix-cli** | Library commands | src/library/ module (list, show, comments list/post), resolve-library-item, SKILL.md update |

**Implementation order**: Server first (it defines the API contract), then client and CLI in parallel (they are independent consumers of the same API).

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

**Key design choices:**

| Choice | Decision | Rationale |
|--------|----------|-----------|
| **Rating type** | `String` (not Prisma enum) | Avoids migration-requiring changes if taxonomy evolves. Validated at API boundary via Zod. Consistent with `LibraryItem.status` which also uses `String @default("DRAFT")`. |
| **Anchor format** | Heading slug (e.g., `"key-findings"`) | Matches rehype-slug output exactly. This is the shared contract between server, client, and CLI. |
| **Threading** | Single-level via `parentCommentId` | Replies to replies redirect to top-level parent (same as TicketComment). Deep nesting adds complexity without matching the use case. |
| **Optional content** | `String? @db.Text` | Supports Flow 1 (rating-only, no text) and Flow 2 (rating + text). |
| **No mentions/tags** | Omitted `mentionedUserIds`, `isHelixTagged` | Library comments are feedback-focused, not conversation-oriented. Different domain from ticket comments. |
| **Parallel model** | Separate from TicketComment | LibraryComment has fields absent from TicketComment (`anchor`, `rating`) and lacks ticket-specific fields. The coupling risk of generalization outweighs the duplication cost. |

### Rating Taxonomy

The three-level rating maps to the Netflix-style system described in the ticket:

| User-Facing | Stored Value | Meaning |
|-------------|-------------|---------|
| Thumbs down | `THUMBS_DOWN` | This section didn't work |
| Thumbs up | `THUMBS_UP` | This section is good |
| Love (double thumbs up) | `LOVE` | This section is excellent |

The rating is stored as a String and validated via Zod at the API boundary:

```typescript
const ratingSchema = z.enum(["THUMBS_UP", "LOVE", "THUMBS_DOWN"]);
```

### Git Sidecar Format

Comments are synced to the library repo as a structured JSON file at:

```
reports/{ticketShortId}/runs/{runId}/comments.json
```

This places the comments file alongside the immutable report snapshot (`report.md`), creating a self-contained unit of report + feedback.

**Sidecar JSON structure:**

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
          "author": {
            "name": "Alice",
            "email": "alice@company.com"
          },
          "createdAt": "2026-05-13T10:15:00.000Z",
          "replies": [
            {
              "id": "clx1reply1",
              "rating": "LOVE",
              "content": null,
              "author": {
                "name": "Bob",
                "email": "bob@company.com"
              },
              "createdAt": "2026-05-13T10:20:00.000Z"
            }
          ]
        }
      ],
      "summary": {
        "THUMBS_UP": 2,
        "LOVE": 1,
        "THUMBS_DOWN": 0
      }
    },
    {
      "anchor": "market-overview",
      "heading": "Market Overview",
      "comments": [
        {
          "id": "clx1comment2",
          "rating": "THUMBS_DOWN",
          "content": "Totally extra, can be removed",
          "author": {
            "name": "Alice",
            "email": "alice@company.com"
          },
          "createdAt": "2026-05-13T10:25:00.000Z",
          "replies": []
        }
      ],
      "summary": {
        "THUMBS_UP": 0,
        "LOVE": 0,
        "THUMBS_DOWN": 1
      }
    }
  ]
}
```

**Design rationale:**
- **Grouped by section**: Comments are organized under their anchor, making it easy for agents to process feedback per section.
- **Summary per section**: Pre-computed rating counts allow quick triage without iterating all comments.
- **Author info included**: Names and emails are denormalized for readability without DB access.
- **Threaded structure**: Replies are nested under their parent comment.
- **Machine-readable**: JSON format is parseable by any agent or tool.

### Sync Strategy

| Aspect | Decision |
|--------|----------|
| **Trigger** | After each DB mutation (create/update/delete) |
| **Debounce** | 5 seconds per `libraryItemId` |
| **Execution** | Async, fire-and-forget (does not block API response) |
| **Write method** | GitHub Contents API (GET current SHA, PUT with SHA) |
| **Target branch** | Report's branch (not main), so published reports get comments on merge |
| **Failure handling** | Log error; do not block; next mutation retriggers sync |
| **Reconciliation** | Not needed for MVP (DB is source of truth; manual resync could be added later) |

The debounce window batches rapid consecutive ratings. If a user rates 5 sections in 10 seconds, only one Git write occurs (after the 5s quiet period), containing all 5 ratings. This reduces GitHub API calls and avoids SHA conflicts from rapid sequential writes.

---

## UI Design

### Section Anchoring Foundation

The existing `MarkdownRenderer` component uses `rehype-slug` to generate deterministic heading IDs for all h1-h6 headings. For example, a heading "## Key Findings" gets the ID `key-findings`. These IDs are the natural anchor points for section-level comments.

For MVP, section anchoring is limited to heading-level granularity. Each "section" is the content block between two consecutive headings. Sub-heading anchoring (targeting individual paragraphs, list items, or text ranges) is deferred.

### Component Architecture

```
library-detail.tsx
  |
  +-- AnnotatedMarkdownRenderer
  |     |
  |     +-- MarkdownRenderer (existing, unchanged)
  |     |     |
  |     |     +-- Custom h1-h6 components (SectionHeading)
  |     |           |
  |     |           +-- SectionFeedbackToolbar
  |     |           |     (hover/focus, three rating buttons)
  |     |           |
  |     |           +-- SectionCommentBadge
  |     |                 (count + expand toggle)
  |     |
  |     +-- SectionCommentThread (inline, per section)
  |           |
  |           +-- LibraryCommentItem (individual comment)
  |           |     (author, rating badge, text, timestamp)
  |           |
  |           +-- LibraryCommentInput
  |                 (rating buttons + textarea)
```

### Component Details

**AnnotatedMarkdownRenderer**

A wrapper component that composes `MarkdownRenderer` without modifying it. Accepts `content`, `theme`, `comments`, `commentSummary`, `itemId`, and `onCommentCreated` props. Constructs custom heading components (`h1`-`h6`) that have access to comment data via closure or React Context. Passes the extended `components` prop to `react-markdown`.

The key architectural decision is to **wrap, not modify**, the existing `MarkdownRenderer`. It remains a pure display component used across the application. `AnnotatedMarkdownRenderer` adds the interactive feedback layer only for library use.

**SectionHeading**

Custom component registered for `h1` through `h6` in react-markdown's `components` prop. Receives the heading text, level, and `id` prop from rehype-slug. Renders:
- The heading text with its original styling
- A floating toolbar on hover/focus (SectionFeedbackToolbar)
- A comment count badge when the section has comments (SectionCommentBadge)

**SectionFeedbackToolbar**

Appears on hover or keyboard focus. Progressive disclosure pattern:
1. **Initial state**: Three icon buttons (thumbs down, thumbs up, love)
2. **After rating click**: Optional text input expands below (can be skipped)
3. **After text submit or skip**: Comment is posted, toolbar returns to initial state

Shows the user's existing rating with a highlighted state (e.g., filled vs. outline icon). Clicking a different rating updates the existing comment's rating.

**SectionCommentThread**

Collapsible inline thread that expands below the section when toggled. Shows all comments for this anchor, grouped with replies nested under parent comments. Includes the `LibraryCommentInput` for adding new comments or replies.

Default state: collapsed (just the badge showing comment count). Expanded state: full thread with all comments, reply buttons, and input.

**LibraryCommentItem**

Renders a single comment:
- Author name/avatar
- Rating badge (icon + color: red for thumbs down, blue for thumbs up, gold for love)
- Optional text content
- Timestamp (relative: "2 hours ago")
- Reply button (for team discussion)
- Edit/delete for own comments (within a 5-minute edit window)

**LibraryCommentInput**

Simplified input — intentionally lighter than the Tiptap-based ticket comment editor:
- Three rating buttons (required for top-level comments, optional for replies)
- Plain text `<textarea>` for optional text context
- Submit button
- Character guidance (not a hard limit)

### Interaction Flows in the UI

**Flow 1 (Quick Rating):**
1. User hovers over section heading
2. `SectionFeedbackToolbar` appears
3. User clicks rating button (e.g., thumbs up)
4. Optimistic update in React Query cache: rating appears immediately
5. Mutation fires in background: `POST /library/items/:itemId/comments { anchor, rating }`
6. Toolbar shows the rating as "selected" (filled icon)

**Flow 2 (Rating + Context):**
1. Same as Flow 1 steps 1-3
2. After rating click, text input expands below the toolbar
3. User types context: "Dive deeper into this"
4. User clicks Submit
5. Comment posted with both rating and content

**Flow 3 (Team Review):**
1. User opens report, sees badge: "3 comments" on Key Findings section
2. User clicks badge to expand `SectionCommentThread`
3. Thread shows: Alice [thumbs-down] "Wrong level of abstraction" -> Bob [reply] "I disagree..."
4. User clicks Reply on Bob's comment
5. `LibraryCommentInput` opens with reply context
6. User posts reply with optional rating

### API Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `libraryCommentsQueryOptions(itemId, anchor?)` | Query | Fetch comments for an item, optionally filtered by section |
| `libraryCommentSummaryQueryOptions(itemId)` | Query | Fetch rating distribution per section |
| `useCreateLibraryComment()` | Mutation | Post a new comment; invalidates comments + summary |
| `useUpdateLibraryComment()` | Mutation | Edit content/rating; invalidates comments |
| `useDeleteLibraryComment()` | Mutation | Delete own comment; invalidates comments + summary |

### SSE Hook: useLibraryCommentStream

Mirrors the existing `use-comment-stream.ts`:
- Subscribes to `GET /library/items/:itemId/comments/stream?token=...`
- On `new-comment` events, invalidates React Query cache keys for comments and summary
- Handles reconnection via EventSource auto-reconnect
- Ensures real-time delivery: a comment posted by one user appears for all other viewers without page refresh

### PDF Export Compatibility

The `contentRef` used for PDF generation captures the rendered markdown content. The feedback toolbar and comment threads are interactive overlays that must not appear in PDF exports. The toolbar uses absolute positioning and conditional rendering that naturally excludes it from the content snapshot. The `AnnotatedMarkdownRenderer` should ensure that during export, only the clean markdown content (via the underlying `MarkdownRenderer`) is captured.

---

## CLI & Agent Interface

### Module Structure

A new `src/library/` module follows the established CLI module pattern:

```
src/library/
  index.ts              # Router: dispatches to list, show, comments
  list.ts               # hlx library list
  show.ts               # hlx library show <ref>
  comments.ts           # Nested router: dispatches to comments-list, comments-post
  comments-list.ts      # hlx library comments list <ref>
  comments-post.ts      # hlx library comments post <ref>

src/lib/
  resolve-library-item.ts  # Resolve item by ID, short ID, or title
```

### Commands

#### `hlx library list`

Lists library items with status, title, and date.

```
$ hlx library list

ID          Title                    Status      Date
cm...abc    Market Analysis Report   PUBLISHED   2026-05-10
cm...def    Competitor Deep Dive     DRAFT       2026-05-12
cm...ghi    Technical Architecture   PUBLISHED   2026-05-13
```

#### `hlx library show <ref>`

Shows report content with section headings annotated with slugs and comment summaries.

```
$ hlx library show RSH-439

# Market Analysis Report (cm...abc)

## Introduction [introduction] (2 comments: 1 thumbs-up, 1 love)
The market for enterprise AI tools has grown significantly...

## Key Findings [key-findings] (3 comments: 1 thumbs-up, 1 thumbs-down, 1 love)
Our analysis reveals three key trends...

## Market Overview [market-overview] (1 comment: 1 thumbs-down)
The global market size is estimated at...
```

The `[slug]` annotation makes section anchors discoverable. Users and agents can copy the slug value for use with `--section`.

#### `hlx library comments list <ref> [--section <slug>]`

Lists comments grouped by section, with optional section filter.

```
$ hlx library comments list RSH-439

## introduction (2 comments)
  [thumbs-up] Alice (2026-05-10): "Great framing"
  [love] Bob (2026-05-11)

## key-findings (3 comments)
  [thumbs-down] Alice (2026-05-10): "Wrong level of abstraction"
    -> [reply] Bob (2026-05-11): "I disagree, this is the right level"
  [thumbs-up] Carol (2026-05-11): "Dive deeper into this"

$ hlx library comments list RSH-439 --section key-findings

## key-findings (3 comments)
  [thumbs-down] Alice (2026-05-10): "Wrong level of abstraction"
    -> [reply] Bob (2026-05-11): "I disagree, this is the right level"
  [thumbs-up] Carol (2026-05-11): "Dive deeper into this"
```

#### `hlx library comments post <ref> --section <slug> --rating <value> [message]`

Posts a section rating with optional text.

```
$ hlx library comments post RSH-439 --section key-findings --rating thumbs-down "Wrong level of abstraction for this audience"

Posted: [thumbs-down] on key-findings: "Wrong level of abstraction for this audience"

$ hlx library comments post RSH-439 --section introduction --rating love

Posted: [love] on introduction
```

### Rating Flag Values

The CLI accepts human-readable values that map to server enum values:

| CLI Flag Value | Server Value | Shorthand |
|---------------|-------------|-----------|
| `thumbs-up` | `THUMBS_UP` | `up` |
| `love` | `LOVE` | `love` |
| `thumbs-down` | `THUMBS_DOWN` | `down` |

### Section Targeting

The `--section` flag accepts heading slugs directly (e.g., `--section key-findings`). As a convenience, if the value contains spaces or uppercase letters, it is slugified before sending to the API:

```
--section "Key Findings"  ->  anchor: "key-findings"
--section key-findings    ->  anchor: "key-findings"
```

This uses the same slugification algorithm as rehype-slug (GitHub-flavored: lowercase, hyphens, remove special characters).

### Item Resolution

The `<ref>` argument supports three resolution strategies (following `resolve-ticket.ts`):

1. **cuid**: If the input starts with "c" and is 25 characters, treat as a library item ID directly.
2. **Short ID**: If the input matches `XXX-NNN` pattern (e.g., "RSH-439"), resolve the ticket, then find the latest library item for that ticket.
3. **Title match**: Fallback to case-insensitive title substring match.

### MCP Tools

Three MCP tools provide agent access to library comments (registered in `register-tools.ts`):

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `post-library-comment` | Post feedback on a library report section | `libraryItemId`, `anchor`, `rating`, `content?`, `parentCommentId?` |
| `get-library-comments` | Get comments for a library item | `libraryItemId`, `anchor?` |
| `manage-library-comment` | Edit or delete a library comment | `commentId`, `action` ("edit" or "delete"), `content?`, `rating?` |

All MCP tools use Zod schemas for input validation, following the pattern in `src/mcp/tools/comments.ts`.

### SKILL.md Documentation

The `skill-content/SKILL.md` file must be updated with a new "Library" section documenting all library commands. This is critical for agent discoverability: agents read SKILL.md to understand available CLI capabilities.

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

### Agent Workflow Example

A coding agent iterating on a report would follow this workflow:

```bash
# 1. List library items to find the report
hlx library list

# 2. Show the report with section feedback summary
hlx library show RSH-439

# 3. Read all comments for detailed feedback
hlx library comments list RSH-439

# 4. Use feedback as context for the next iteration
# (agent processes comments and generates improved report)

# 5. After generating the new iteration, auto-comment on changed sections
hlx library comments post RSH-439-v2 --section key-findings --rating love \
  "Rewrote based on feedback: focused on implementation patterns"
```

Alternatively, the agent can read `comments.json` directly from the Git repository clone, which provides the same structured feedback data without API calls.

---

## Cross-Iteration & Version Access

### Version-Locked Comments

Comments are tied to a specific `libraryItemId`, which represents a specific run/version of the report. When a new iteration is generated, a new `LibraryItem` record is created with a new ID. Comments on Round 1 stay attached to Round 1's `libraryItemId`; Round 2 starts with a clean comment slate.

This is intentional: comments are **snapshots of thinking at a point in time**. Round 1 feedback says "this section missed the mark" — that's true for Round 1, but Round 2 may have addressed it completely. Mixing comments across versions would create confusion.

### Cross-Version Navigation

The library detail page already has a version selector dropdown (visible when 2+ versions exist). This selector allows users to navigate between iterations. When viewing Round 1, the user sees Round 1's comments. When switching to Round 2, they see Round 2's comments (or an empty state if no feedback has been given yet).

No new UI is needed for this — the existing version navigation naturally separates comment contexts because each version has a different `libraryItemId`.

### Git History Tells the Story

In the Git repository, each iteration is a separate snapshot:

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

This structure provides natural version history:
- **What was the original report?** `runs/run-001/report.md`
- **What did people think?** `runs/run-001/comments.json`
- **How was it improved?** `runs/run-002/report.md`
- **What do people think of the improvements?** `runs/run-002/comments.json`

An agent can traverse this history to generate a complete change rationale: "Here's what changed from v1 to v2, and here's the feedback that drove it."

### How Feedback Drives New Iterations

When a new iteration is triggered (manually or via `hlx` continue/rerun):

1. The orchestrator reads the previous round's comments (via DB API or `comments.json`)
2. Section-level feedback is structured as context for the generation agent
3. The agent receives: "Section 'Key Findings' received 1 thumbs-down with comment 'wrong level of abstraction' and 2 thumbs-up"
4. The agent uses this to decide: preserve loved sections, rewrite criticized sections, expand sections where "dive deeper" was requested

### Future: Comment Carry-Forward

A future enhancement could automatically surface unresolved comments from the previous iteration on the new version. For example, if a thumbs-down on Round 1 said "needs citation data" and Round 2's "Key Findings" section still lacks citations, the old comment could be carried forward with a "from previous round" indicator.

This is explicitly deferred from MVP. The version-locked approach is simpler, clearer, and avoids the complexity of determining which comments are "resolved" by the new content.

### Future: Auto-Generated Change Rationale

Another future enhancement: after a new iteration is generated, automatically produce a change summary that maps Round 1 feedback to Round 2 changes. "Section 'Market Overview' was removed (3/4 thumbs-down; feedback: 'totally extra'). Section 'Key Findings' was expanded (feedback: 'dive deeper into this')."

---

## Technical Decisions & Trade-offs

This section consolidates the key technical decisions made across all three repositories, documenting the chosen option, rejected alternatives, and rationale.

### 1. Parallel LibraryComment Model vs. Generalized TicketComment

| Aspect | Detail |
|--------|--------|
| **Chosen** | New parallel `LibraryComment` model |
| **Rejected** | Generalizing `TicketComment` with nullable `anchor`/`rating` fields; polymorphic base model |
| **Rationale** | LibraryComment has unique fields (`anchor`, `rating`) absent from TicketComment, and lacks ticket-specific fields (`mentionedUserIds`, `isHelixTagged`, `isAgentAuthored`). The comment-service.ts contains ticket-specific logic (Helix tag auto-detection, agent-authored bypass, notification creation) that doesn't apply to library comments. Threading is the only shared pattern, and it's trivial to reimplement (~10 lines). The coupling risk of generalization outweighs the code duplication cost. |

### 2. String Rating vs. Prisma Enum vs. Emoji Reactions

| Aspect | Detail |
|--------|--------|
| **Chosen** | `rating String` with Zod validation at API boundary |
| **Rejected** | `rating LibraryCommentRating` (Prisma enum) — requires a new migration to add values; `CommentReaction` emoji pattern — reactions are freeform per-user-per-comment, not a fixed taxonomy |
| **Rationale** | Consistent with `LibraryItem.status` which also uses String. Zod validation provides the same safety at the API boundary without locking the taxonomy into a database-level constraint. If a fourth rating level is added in future, it's a code change, not a database migration. |

### 3. Debounced Async Git Sync vs. Synchronous Git Writes

| Aspect | Detail |
|--------|--------|
| **Chosen** | Fire-and-forget async with 5s debounce per `libraryItemId` |
| **Rejected** | Synchronous Git write per mutation — adds 200-500ms latency to every API response; queue-based worker — overengineered for MVP |
| **Rationale** | The GitHub Contents API has inherent latency (200-500ms per call). Synchronous writes would make every rating click feel slow. A debounced async approach batches rapid ratings (a user rating 5 sections in 10 seconds produces 1 Git write, not 5) and keeps API responses fast (<100ms). A dedicated queue (Redis, Bull) would add infrastructure complexity without benefit at MVP scale. |

### 4. Custom Heading Components vs. DOM Post-Processing vs. Rehype Plugin

| Aspect | Detail |
|--------|--------|
| **Chosen** | Custom h1-h6 components via react-markdown's `components` prop |
| **Rejected** | DOM post-processing via `useEffect` — race conditions with async code blocks (Shiki), imperative DOM manipulation conflicts with React; custom rehype plugin — complex AST manipulation, sections spanning from heading to next heading is non-trivial |
| **Rationale** | react-markdown's `components` prop is the intended extension mechanism. Custom heading components receive the heading text, level, and rehype-slug `id` prop. The approach is React-native (no imperative DOM), type-safe, and composable. The `AnnotatedMarkdownRenderer` wrapper passes extended components without modifying the shared `MarkdownRenderer`. |

### 5. Inline Section Threads vs. Sidebar Panel vs. Popover

| Aspect | Detail |
|--------|--------|
| **Chosen** | Inline threads below each section, collapsible |
| **Rejected** | Sidebar panel — requires layout restructuring, responsive challenges, spatially disconnects comments from content; popover/modal — small viewport, awkward for long threads, accessibility concerns |
| **Rationale** | The primary user flow is reading a report and providing section-by-section feedback. Inline threads keep feedback spatially connected to the content it references. The thread is collapsed by default (just a count badge), so it only expands when actively reviewing feedback. This preserves the clean reading experience while making discussion accessible. |

### 6. Plain Text Comment Input vs. Tiptap Rich Editor

| Aspect | Detail |
|--------|--------|
| **Chosen** | Plain `<textarea>` with character guidance |
| **Rejected** | Tiptap rich text editor — product explicitly scopes out rich text for MVP; adds significant bundle size for a textarea use case |
| **Rationale** | Library comments are brief feedback notes ("dive deeper into this," "wrong level of abstraction"), not formatted documents. A textarea is faster to render, lighter in bundle size, and matches the progressive disclosure principle: keep the simple path simple. Rich text can be added later if needed. |

### 7. New CLI Library Module vs. Extending Comments Module

| Aspect | Detail |
|--------|--------|
| **Chosen** | New `src/library/` module with its own router and subcommands |
| **Rejected** | Adding `--library` flag to existing `hlx comments` commands — awkward UX (`hlx comments post --library --item X`), conflates two domains, comments module is tightly coupled to `--ticket` flag |
| **Rationale** | Library items and ticket comments are distinct domains with different API endpoints, reference resolution, and interaction patterns. A new module provides intuitive hierarchy (`hlx library comments post`) consistent with how tickets and comments are separate modules. Follows the exact same structural pattern as existing modules. |

### 8. Heading Slug Targeting vs. Line Numbers vs. Text Match

| Aspect | Detail |
|--------|--------|
| **Chosen** | Heading slugs (e.g., `--section key-findings`) with text-to-slug fallback |
| **Rejected** | Line numbers — not meaningful for markdown, change with formatting; text match — ambiguous with partial matches, case sensitivity issues |
| **Rationale** | The server's `anchor` field stores heading slugs generated by rehype-slug. Using the same slugs in the CLI ensures direct mapping without translation. `hlx library show` displays slugs for discoverability. As a convenience, the CLI also accepts heading text ("Key Findings") and slugifies it before sending to the API. |

### 9. Dual Auth for Comment Routes (not Session-Only)

| Aspect | Detail |
|--------|--------|
| **Chosen** | `attachInspectionAuth + requireCommentAuth` (same pattern as ticket comments) |
| **Rejected** | Session-only auth — blocks agent access via inspection tokens |
| **Rationale** | The ticket explicitly requires agent accessibility. Inspection tokens allow agents (via CLI, MCP, or direct API calls) to read and post comments without a browser session. The dual-auth pattern is already proven and battle-tested on ticket comment routes. |

### 10. Comment Data Loading (Single Query vs. Per-Section Lazy)

| Aspect | Detail |
|--------|--------|
| **Chosen** | Single query per item, client-side anchor filtering |
| **Rejected** | Per-section lazy loading — heading-level granularity means <20 sections per report; total comment volume per item expected to be <500 |
| **Rationale** | A single query is simpler, avoids waterfall requests, and keeps the data loading predictable. With heading-level anchoring, even heavily commented reports will have manageable comment volumes. Per-section pagination can be added in future if comment volume grows significantly. |

---

## MVP Scope, Risks, & Future

### MVP Features (In Scope)

1. **Three-level section rating**: Thumbs up, love (double thumbs up), thumbs down per heading section
2. **Optional text with ratings**: Users can add a brief note alongside any rating
3. **Section anchoring via heading slugs**: Each heading in the markdown report is a targetable anchor
4. **Threaded comments per section**: Team members can reply to each other within a section's discussion
5. **Real-time comment delivery**: Comments appear for all viewers immediately via SSE
6. **Hybrid storage**: Database operational + async Git sidecar sync
7. **Git sidecar files**: Structured `comments.json` committed alongside report snapshots
8. **API endpoints**: 6 CRUD endpoints under `/library/items/:itemId/comments`
9. **MCP tools**: 3 agent-accessible tools (post, get, manage)
10. **CLI commands**: `hlx library list`, `show`, `comments list`, `comments post` with section targeting
11. **Version-locked comments**: Comments tied to a specific report iteration
12. **Previous iteration access**: View comments from earlier rounds via version navigation
13. **Section feedback summary**: At-a-glance rating distribution per section

### Explicitly Out of Scope (MVP)

| Feature | Why Deferred |
|---------|-------------|
| **Sub-heading anchoring** | Targeting individual paragraphs, list items, or sentences requires custom rehype plugin and stable sub-heading IDs — complex and fragile across versions |
| **Comment carry-forward** | Automatically surfacing unresolved comments from previous iteration on new version requires "resolved" state tracking and semantic comparison |
| **Inline text-selection commenting** | Google Docs-style highlight-and-comment on arbitrary text ranges requires character-level anchoring — fundamentally different from heading-level feedback |
| **Auto-triggering iteration runs** | Automatically kicking off a new round from accumulated feedback requires integration with the orchestrator's "continue" mechanism |
| **Rich text comment editing** | Tiptap adds bundle size for a textarea use case; plain text is sufficient for brief feedback |
| **Comment resolution/close workflow** | Marking comments as resolved adds state management and UI complexity without clear MVP value |
| **Diff view between iterations** | Side-by-side report comparison is a separate feature with significant UI work |
| **Notification system** | Email or push notifications for new comments require notification infrastructure not yet built |

### Open Questions & Risks

| Question / Risk | Status | Notes |
|----------------|--------|-------|
| **Git sidecar format stability** | Decided (JSON) | JSON is recommended for machine-readability. An annotated markdown variant could be generated as a secondary output in future. |
| **Concurrent Git sync conflicts** | Mitigated | Debounced async sync (5s window) batches rapid comments. Single-writer-per-item pattern avoids SHA conflicts. Edge case: two items syncing simultaneously to different files is safe. |
| **Rating taxonomy naming** | Decided | `THUMBS_UP` / `LOVE` / `THUMBS_DOWN` as strings, Zod-validated. CLI presents as `thumbs-up` / `love` / `thumbs-down`. |
| **Comment carry-forward** | Deferred | Version-locked comments are the MVP approach. Carry-forward requires "resolved" state tracking. |
| **"Continue" integration** | Out of scope | How "Okay do another run" connects to the existing continue/rerun mechanism is a separate ticket. The comment system provides the feedback data; the continuation mechanism consumes it. |
| **Sub-heading anchoring feasibility** | Deferred | Paragraphs and list items lack stable IDs. A custom rehype plugin could add them, but content changes between versions would break anchors. Heading-level is stable enough for MVP. |
| **GitHub API rate limits** | Low risk | At expected scale (<500 comments per item, debounced writes), GitHub API usage is well within rate limits. |
| **Anchor stability across edits** | Medium risk | If a heading is renamed between iterations, the slug changes. Comments remain attached to the old slug. This is acceptable because comments are version-locked. |

### Implementation Sequencing

```
Phase 1: Server (helix-global-server)
  - Prisma migration: LibraryComment model
  - library-comment-service.ts: CRUD, threading, validation
  - library-comment-controller.ts: HTTP handlers
  - Routes: 6 endpoints with dual auth
  - library-comment-events.ts: SSE
  - Git sidecar sync: debounced async
  - MCP tools: 3 tools
  [All API and data contracts established]

Phase 2a: Client (helix-global-client)     Phase 2b: CLI (helix-cli)
  - Types and API hooks                      - src/library/ module
  - SSE hook                                 - list, show commands
  - AnnotatedMarkdownRenderer                - comments list, post
  - SectionFeedbackToolbar                   - resolve-library-item
  - SectionCommentThread                     - SKILL.md update
  - LibraryCommentInput
  - library-detail.tsx integration
  [Parallel with CLI]                        [Parallel with Client]
```

### Future Roadmap

| Enhancement | Priority | Complexity | Prerequisites |
|-------------|----------|------------|--------------|
| Sub-heading anchoring (paragraph/list-item level) | Medium | High | Custom rehype plugin, stable sub-heading IDs |
| Comment carry-forward across iterations | Medium | Medium | Resolved/unresolved state, semantic matching |
| Annotated markdown view (interleaving comments inline) | Medium | Medium | Rendering engine changes |
| Smart feedback summarization (AI summary) | High | Medium | LLM integration, summary comment type |
| Consensus heat map | Medium | Low | Summary endpoint already provides data |
| Section-level version diff | High | High | Markdown diff engine, section extraction |
| Auto-generated change rationale | High | Medium | Cross-version comment analysis |
| Comment resolution/close workflow | Low | Low | State field + UI toggle |
| Notification system | Low | High | Notification infrastructure, email/push |
| `--json` flag for CLI output | Medium | Low | Output formatting layer |
| Rich text comment editing (Tiptap) | Low | Medium | Bundle size considerations |
| Interactive section selection (fzf-style) | Low | Low | Terminal UI library |

---

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary requirements and brainstorming request | Three feedback flows; Git-based storage preference; multi-surface access; explicit request to brainstorm enhancements and approaches with pros/cons |
| ticket.md Discussion | Stakeholder clarifications | Previous iteration comments must be viewable; storage and presentation are separate design problems; creative UI/CLI separate from Git storage |
| product/product.md | MVP scope and success criteria | 13 MVP features, 8 out-of-scope items, 7 success criteria, 5 design principles; hybrid storage required; heading-level anchoring for MVP |
| diagnosis/diagnosis-statement.md (server) | Server architecture analysis | Feature gap confirmed; hybrid storage recommended; LibraryComment model design; 7 new server components needed |
| diagnosis/diagnosis-statement.md (client) | Client architecture analysis | AnnotatedMarkdownRenderer approach; progressive disclosure UI; rehype-slug heading anchors |
| diagnosis/diagnosis-statement.md (CLI) | CLI architecture analysis | New library module needed; list/show/comments subcommands; SKILL.md update for agent discoverability |
| tech-research/tech-research.md (server) | Server technical decisions | Data model fields, 6 API endpoints, SSE pattern, 3 MCP tools, Git sidecar format, sync strategy, dual auth |
| tech-research/tech-research.md (client) | Client technical decisions | Custom heading components via react-markdown, inline threads, plain text input, component hierarchy, React Query hooks, SSE hook |
| tech-research/tech-research.md (CLI) | CLI technical decisions | Module structure, command syntax, item resolution, rating flag mapping, output formatting examples, SKILL.md content |
| scout/scout-summary.md (server) | Server current architecture | Dual storage (Prisma DB + GitHub repos), Git layout, existing comment/SSE/MCP infrastructure patterns |
| scout/scout-summary.md (client) | Client current architecture | MarkdownRenderer with rehype-slug, existing discussion component patterns, React Query usage, Tailwind v4 styling |
| scout/scout-summary.md (CLI) | CLI current architecture | Switch-based routing, flag parsing, HTTP client, SKILL.md for agent integration |
| scout/reference-map.json (all repos) | File mapping and facts | Specific files, dependencies, unknowns per repo; confirms no library comment infrastructure exists in any repo |
| repo-guidance.json | Repo intent and ordering | All three repos are change targets; server first, then client and CLI in parallel |

## Attachments
- (none)

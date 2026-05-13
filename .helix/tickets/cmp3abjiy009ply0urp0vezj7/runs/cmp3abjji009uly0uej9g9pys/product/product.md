# Product: Library Comments and Iteration

## Problem Statement

Library reports (Git-backed markdown) are read-only artifacts with no feedback mechanism. Users cannot rate sections, leave comments, or collaborate on report iteration. Today, all discussion lives on tickets, but the library is the natural home for iterating on reports. There is no way for a user or agent to say "this section is great" or "this section missed the mark" on the report itself, and no way to accumulate that feedback for a second round.

## Product Vision

Enable section-level feedback and collaborative iteration directly on library reports. Any user or coding agent should be able to quickly rate report sections, add context, and participate in threaded discussions that drive the next iteration. All feedback should live in the Git library repo alongside the report, making the library a self-contained knowledge artifact with full editorial history.

## Users

| User | Description |
|------|-------------|
| **Report owner** | Primary contributor who reviews their report and provides quick section ratings to guide the next iteration |
| **Team members** | Collaborators who add feedback, discuss sections, and contribute different perspectives |
| **Coding agents** | Automated agents that read feedback as context for generating the next iteration, and that post comments programmatically via CLI/MCP |

## Use Cases

1. **Quick section triage** (Flow 1): Report owner scans the report and rates each section with a single click (thumbs up / love / thumbs down) to signal what worked and what didn't.
2. **Rating with context** (Flow 2): User rates a section and adds a short text note explaining why ("dive deeper into this", "wrong level of abstraction", "totally extra").
3. **Team review** (Flow 3): Multiple team members independently rate and comment on sections, reply to each other's comments, and build a threaded discussion per section.
4. **Agent-driven iteration**: A coding agent reads all accumulated section feedback from the previous round and uses it as rich context to generate the next iteration of the report.
5. **Cross-iteration review**: User navigates to a previous version of the report to see what feedback was given and how it drove changes in the next round.

## Core Workflow

1. A report is generated and appears in the library (Round 1).
2. Report owner (or any team member) opens the report and rates sections with thumbs up / love / thumbs down.
3. Optionally, users add text context alongside their ratings.
4. Team members contribute additional feedback; threaded discussion develops per section.
5. When ready, a new iteration is triggered with all accumulated feedback as context.
6. Round 2 appears as a new version; Round 1 feedback remains accessible by navigating to the previous version.

## Essential Features (MVP)

- **Three-level section rating**: Thumbs up, love (double thumbs up), thumbs down per heading section
- **Optional text with ratings**: Users can add a brief note alongside any rating
- **Section anchoring via heading slugs**: Each heading in the markdown report is a targetable anchor (leveraging rehype-slug IDs)
- **Threaded comments per section**: Team members can reply to each other within a section's discussion
- **Real-time comment delivery**: Comments appear for all viewers immediately via SSE
- **Hybrid storage**: Database as operational source of truth (fast CRUD, SSE, queries) with asynchronous sync to Git sidecar files in the library repo
- **Git sidecar files**: Structured comment data committed alongside report snapshots (e.g., `comments.json`) so the library repo is self-contained
- **API endpoints**: CRUD for library comments under `/library/items/:itemId/comments`
- **MCP tools**: Agent-accessible tools for posting, reading, and managing library comments
- **CLI commands**: `hlx library list`, `hlx library show`, `hlx library comments list/post` with section targeting
- **Version-locked comments**: Comments are tied to a specific report iteration/version
- **Previous iteration access**: Users can view comments from earlier rounds via version navigation
- **Section feedback summary**: At-a-glance rating distribution per section (counts of each rating type)

## Features Explicitly Out of Scope (MVP)

- **Sub-heading anchoring**: Targeting individual paragraphs, list items, or sentences (MVP uses heading-level sections only)
- **Comment carry-forward**: Automatically surfacing unresolved comments from the previous iteration in the new version
- **Inline text-selection commenting**: Google Docs-style highlight-and-comment on arbitrary text ranges
- **Auto-triggering iteration runs**: Automatically kicking off a new report round from accumulated feedback
- **Full rich text editing for comments**: MVP uses plain text with ratings; no Tiptap/rich editor for comment body
- **Comment resolution/close workflow**: Marking individual comments as resolved or addressed
- **Diff view between iterations**: Side-by-side comparison of report versions
- **Notification system**: Email or push notifications when comments are added

## Success Criteria

1. A user can rate any heading section of a library report with a single click
2. A user can add optional text context alongside a rating
3. Multiple team members can independently rate and discuss sections with threaded replies
4. Comments are synced to structured sidecar files in the Git library repo alongside report snapshots
5. Agents can read and post library comments via CLI (`hlx library comments`) and MCP tools
6. Previous iteration comments are viewable by navigating to earlier versions
7. Real-time delivery: a comment posted by one user appears for others without page refresh

## Key Design Principles

- **Git-native**: All feedback persists in the library repo alongside the report. The repo is a self-contained artifact with full editorial context.
- **Progressive disclosure**: Quick rating (one click) -> rating with text -> threaded team discussion. The simplest path is the fastest.
- **Multi-surface parity**: The same feedback data is accessible and actionable from UI, CLI, and agent/MCP. Storage format is optimized for durability and machine-readability; each interface is optimized for its user.
- **Storage != Presentation**: How comments are stored in Git (structured sidecar files) is separate from how they are displayed in the UI or CLI. Each surface can present the data in the way that best fits its medium.
- **Version-locked context**: Comments are snapshots of thinking at a point in time, tied to the version of the report they were made on.

## Scope & Constraints

- **Three repos affected**: Server (data model, API, Git sync, MCP), Client (section feedback UI), CLI (library commands). Server must be implemented first as client and CLI depend on its API.
- **Hybrid storage is required**: Pure Git storage introduces latency, concurrent-write conflicts, and blocks real-time delivery. DB is the operational layer; Git is the persistence/context layer.
- **Heading-level anchoring for MVP**: rehype-slug provides stable IDs for h1-h6 headings. Sub-heading targeting is deferred.
- **Existing patterns to follow**: TicketComment model, comment service, SSE events, and MCP tools serve as reference patterns for the library equivalent.

## Future Considerations

- Sub-heading anchoring (paragraph, list item, arbitrary text range)
- Comment carry-forward across iterations with resolved/unresolved tracking
- Annotated markdown rendering that interleaves comments into the report text
- Auto-generated change rationale: "Here's what changed from v1 to v2 and the feedback that drove it"
- Integration with the "continue" / "do another run" flow to pass comment context automatically
- Notification system for new comments

## Open Questions / Risks

| Question / Risk | Notes |
|----------------|-------|
| **Git sidecar format** | JSON is recommended for machine-readability, but an annotated markdown variant (`comments-annotated.md`) could also be generated. Final format TBD. |
| **Concurrent Git sync** | Multiple users commenting simultaneously write to the DB instantly, but Git sync must handle sequential commits or batching to avoid SHA conflicts on the GitHub Contents API. |
| **Rating taxonomy naming** | Ticket says "thumbs up / double thumbs up / thumbs down". Diagnosis maps this to THUMBS_UP / LOVE / THUMBS_DOWN. Confirm naming convention. |
| **Comment carry-forward** | Ticket discussion suggests version-locked comments with cross-version viewing. Whether unresolved comments should automatically surface on the new version is deferred but needs a future decision. |
| **"Continue" integration** | How does "Okay do another run" connect to the existing ticket continue/rerun mechanism? Is it a new endpoint or an extension of the existing flow? |
| **Sub-heading anchoring feasibility** | Paragraphs and list items lack stable IDs today. A custom rehype plugin could add them, but content changes between versions would break anchors. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (all repos) | Primary requirements source | Three feedback flows (quick rating, rating+context, team collab); Git-based storage preference; multi-surface access (UI, CLI, agent); version-locked comments with cross-version viewing |
| ticket.md Discussion | Stakeholder clarifications | Previous iteration comments must be viewable; storage format and presentation are separate design problems |
| scout/scout-summary.md (server) | Server architecture | Dual storage (Prisma DB + GitHub repos), Git layout `reports/{shortId}/runs/{runId}/report.md`, existing comment infrastructure is ticket-scoped |
| scout/scout-summary.md (client) | Client architecture | MarkdownRenderer with rehype-slug heading anchors, existing discussion components (threading, reactions, SSE) are ticket-scoped |
| scout/scout-summary.md (CLI) | CLI architecture | Comment commands for tickets only, no library module, consistent command pattern to follow |
| scout/reference-map.json (server) | Server file mapping | No library comment models, services, routes, or MCP tools exist; TicketComment is the reference pattern |
| scout/reference-map.json (client) | Client file mapping | Library detail is read-only; discussion components hard-coupled to ticketId; rehype-slug provides heading anchors |
| scout/reference-map.json (CLI) | CLI file mapping | No src/library/ module; SKILL.md must be updated; resolve-ticket.ts is the reference pattern |
| diagnosis/diagnosis-statement.md (server) | Server diagnosis | Hybrid storage recommended (DB operational + Git sync); new LibraryComment model with anchor, rating, threading |
| diagnosis/diagnosis-statement.md (client) | Client diagnosis | Section anchoring via rehype-slug heading IDs; progressive disclosure UI (toolbar -> text -> thread) |
| diagnosis/diagnosis-statement.md (CLI) | CLI diagnosis | New library module with list/show/comments subcommands; section targeting via --section flag |
| repo-guidance.json | Repo intent | All three repos are change targets; server first, then client and CLI |

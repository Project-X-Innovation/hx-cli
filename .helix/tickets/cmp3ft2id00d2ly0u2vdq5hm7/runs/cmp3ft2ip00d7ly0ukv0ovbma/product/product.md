# Product: Library Comments and Iteration

## Problem Statement

Library reports are static, read-only documents. After a report is generated and published, users have no way to provide feedback on individual sections, collaborate on improvements, or create structured context for the next iteration. All feedback today must go through ticket discussions, which are disconnected from the report content itself. When users want to iterate on a report, they must manually re-state their feedback in a continuation prompt because the system has no awareness of accumulated section-level feedback.

This creates a broken feedback loop: users read a report, form opinions about specific sections, but have no way to express those opinions on the report itself or have them automatically inform the next round.

## Product Vision

A section-level feedback and collaborative iteration system for library reports. Users and agents rate individual report sections (thumbs up / thumbs down / love), optionally add text context, and participate in threaded discussions that automatically drive the next iteration. The system spans three surfaces equally: web UI, CLI, and agent/MCP.

Comments are the **primary mechanism for report iteration**. When a user triggers a continuation, accrued comments are automatically included as context without requiring manual re-entry.

## Users

| User | Primary Need |
|------|-------------|
| **Report Owner** | Quick section-level ratings to signal what worked and what didn't, driving the next iteration |
| **Team Members** | Add independent feedback and discuss sections with threaded replies |
| **Coding Agents** | Read structured section feedback as context for generating improved iterations; post comments programmatically |

## Use Cases

1. **Quick Section Triage**: Owner opens a report and rates every section in ~30 seconds using a Netflix-style three-level system (thumbs down / thumbs up / love). No text required. This alone provides enough signal for a meaningful next round.

2. **Rating with Context**: After rating, user optionally adds a brief text note ("Dive deeper into this", "Wrong level of abstraction", "Totally extra"). The text explains *why* the rating was given.

3. **Team Review**: Multiple team members independently rate and comment. Threaded replies allow discussion within a section. Real-time delivery ensures everyone sees new comments immediately.

4. **Agent-Driven Iteration**: When a continuation is triggered, the agent reads all section-level comments and uses them as structured context. Loved sections are preserved; criticized sections are rewritten or removed.

5. **Cross-Iteration Review**: Users navigate to a previous version to see what feedback was given and understand why sections changed between iterations.

## Core Workflow

1. Report is generated and published to the library.
2. Owner (and team) open the report and rate sections with one-click ratings.
3. Users optionally add text context or threaded discussion.
4. Owner triggers a continuation. **Accrued comments are automatically included as continuation context** alongside any final user-provided note.
5. Agent generates the next iteration informed by section-level feedback.
6. Comments on the previous version are preserved and viewable via version navigation.

## Essential Features (MVP)

1. **Three-level section rating** per heading: thumbs up, love, thumbs down.
2. **Optional text with ratings**: Brief notes alongside any rating.
3. **Section anchoring via heading slugs**: Each markdown heading is a targetable section.
4. **Threaded comments per section**: Single-level replies within a section's discussion.
5. **Real-time comment delivery**: SSE so all viewers see new comments immediately.
6. **Hybrid storage**: Database for fast operations + async Git sidecar sync (comments.json alongside report.md).
7. **API for all surfaces**: CRUD endpoints accessible by UI, CLI, and agents.
8. **Agent access via MCP tools**: Post, get, and manage library comments programmatically.
9. **CLI commands**: `hlx library list`, `show`, `comments list`, `comments post` with section targeting.
10. **Version-locked comments**: Each report iteration has its own comment set; switching versions shows the correct comments.
11. **Section feedback summary**: At-a-glance rating distribution per section.
12. **Continuation auto-context**: Comments are automatically included in continuation context for report reruns.
13. **@helix mentions**: Users can @helix in library comments to ask questions about the report; agent has full report context.
14. **Agent prompt awareness**: Skills and prompts updated to inform agents that previous version comments exist and should be reviewed for themes across iterations.

## Features Explicitly Out of Scope (MVP)

| Feature | Why Deferred |
|---------|-------------|
| Sub-heading anchoring (paragraph/list-item level) | Requires custom rehype plugin and stable sub-heading IDs; fragile across versions |
| Comment carry-forward between iterations | Requires "resolved" state tracking and semantic comparison |
| Inline text-selection commenting (Google Docs-style) | Fundamentally different from heading-level feedback |
| Auto-triggering iteration runs from accumulated feedback | Requires orchestrator integration; separate concern |
| Rich text comment editing | Plain text is sufficient for brief feedback notes |
| Comment resolution/close workflow | Adds state management complexity without clear MVP value |
| Diff view between iterations | Significant standalone feature with its own UI scope |
| Notification system (email/push) | Requires notification infrastructure not yet built |
| Extending comments to non-library artifacts (Business Bible, etc.) | Ticket owner explicitly notes future scope; data model should be extensible but first implementation targets library reports |

## Success Criteria

1. A user can rate all sections of a 10-section report within 30 seconds using one-click ratings.
2. Comments (ratings + optional text) appear for all viewers in real-time without page refresh.
3. Triggering a continuation automatically includes accrued comments as context without manual re-entry.
4. Agents can read section-level feedback via CLI (`hlx library comments list`) and MCP tools.
5. Comments are persisted in the Git repo as `comments.json` sidecar files alongside report snapshots.
6. Navigating between report versions shows the correct version-locked comments.
7. @helix mentions in library comments trigger agent replies with full report context.
8. SKILL.md and agent prompts reference that previous version comments exist and should be reviewed.

## Key Design Principles

1. **Comments are the primary iteration mechanism.** Users should never need to manually re-state feedback when continuing a report. The accumulated comments *are* the continuation context.
2. **Speed first for the simple path.** One-click ratings must be instantaneous. Text context is optional and progressive.
3. **Three surfaces, equal depth.** UI, CLI, and agent/MCP are all first-class consumers. No surface is an afterthought.
4. **Git self-containment.** The library repo should be a complete knowledge artifact including feedback. Hybrid storage serves both fast UX and this durability goal.
5. **Future-ready naming.** Data model uses naming that can extend to non-library artifacts (the ticket owner suggested "artifact comments") even though MVP targets library reports only.

## Scope & Constraints

- **Three repos**: Server (data model, API, SSE, MCP, Git sync), Client (section feedback UI), CLI (library commands + SKILL.md).
- **Server first**: Server defines the API contract that client and CLI consume. Client and CLI can proceed in parallel after server.
- **Heading-level granularity**: MVP anchors comments to heading slugs only, not arbitrary text ranges or sub-heading elements.
- **Single-level threading**: Replies to replies redirect to top-level parent. Deep nesting is not needed for this feedback use case.
- **Plain text comments**: No rich text editor. Brief feedback notes ("dive deeper", "wrong level of abstraction") are the expected input.

## Future Considerations

- **Extending to non-library artifacts**: The ticket owner explicitly wants this system to eventually cover the Business Bible and other commentable markdown content. Data model naming should accommodate this.
- **Smart feedback summarization**: AI-generated summary of team feedback per section to reduce cognitive load before continuation.
- **Consensus heat map**: Visual indicators showing team alignment/disagreement per section.
- **Comment carry-forward**: Automatically surfacing unresolved feedback from previous iterations.
- **Section-level version diff**: Showing what changed per section between iterations and mapping it to the feedback that drove it.

## Open Questions / Risks

| Question / Risk | Status | Notes |
|----------------|--------|-------|
| Exact "artifact comments" naming for the data model | Open | Ticket owner suggested "artifact comments" for extensibility. Research report uses "LibraryComment". Need to decide on final naming. |
| Continuation integration mechanics | Open | How exactly the continuation flow reads and formats accrued comments for the generation agent is a server-side detail to resolve. |
| @helix reply context for library comments | Open | The existing @helix reply flow uses ticket discussion history. Library comments need a parallel context assembly path. |
| Git sidecar sync reliability | Low risk | Debounced async sync is fire-and-forget. Failures are non-blocking and self-healing. |
| Anchor stability across heading renames | Acceptable risk | If a heading is renamed between iterations, old comments stay on the old slug. Acceptable because comments are version-locked. |
| GitHub API rate limits for sidecar writes | Low risk | At expected scale (<500 comments/item, debounced writes), well within limits. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (all repos) | Primary requirements and research report specification | Comprehensive research report defining 5 user flows, hybrid storage architecture, UI/CLI/MCP design, MVP scope with 13 features and 8 out-of-scope items |
| scout/scout-summary.md (server) | Server current state | Mature ticket comment infrastructure serves as pattern; no library comment infrastructure exists |
| scout/scout-summary.md (client) | Client current state | MarkdownRenderer with rehype-slug provides heading IDs; no feedback UI exists |
| scout/scout-summary.md (CLI) | CLI current state | No library module; SKILL.md has no library section; established module pattern to follow |
| diagnosis/diagnosis-statement.md (server) | Server gap analysis | Complete feature gap across 6 areas: model, API, SSE, Git sync, MCP, continuation integration |
| diagnosis/diagnosis-statement.md (client) | Client gap analysis | Complete UI gap: no annotation layer, no API hooks, no SSE hook, no types |
| diagnosis/diagnosis-statement.md (CLI) | CLI gap analysis | Complete gap: no module, no commands, no resolution utility, no SKILL.md section |
| repo-guidance.json | Cross-repo coordination | All three repos are change targets; server first (Phase 1), client + CLI in parallel (Phase 2) |

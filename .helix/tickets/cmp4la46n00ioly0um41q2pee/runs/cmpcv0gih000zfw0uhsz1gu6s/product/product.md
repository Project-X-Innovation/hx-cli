# Product: Library Comments and Iteration

## Problem Statement

Library reports are static, read-only markdown documents. After an agent generates a report, users have no way to provide section-level feedback directly on the content. The only feedback channel is the originating ticket's discussion thread, which is disconnected from the report itself. When users trigger a continuation to generate a next iteration, they must manually re-state their feedback because no structured signal is captured from the report. This broken feedback loop means agents generate follow-up iterations with minimal context about what worked and what didn't.

## Product Vision

**Comments are the primary iteration mechanism.** Users rate and annotate sections directly on the report. When a continuation is triggered, accumulated feedback is automatically included as context. The agent reads structured per-section ratings and text to produce an informed next iteration. No manual re-entry of feedback required.

## Users

| User | Primary Need |
|------|-------------|
| **Report Owner** | Quickly triage all sections of a fresh report (30 seconds for 10 sections) to guide the next iteration |
| **Team Members** | Independently review, rate, and discuss sections; see each other's feedback in real time |
| **Coding Agents** | Read structured per-section feedback as context when generating the next iteration |

## Use Cases

1. **Quick Section Triage**: Hover over a heading, click thumbs up / thumbs down / double-thumbs-up. One click per section. Rate an entire 10-section report in under 30 seconds.
2. **Rating with Text Context**: After clicking a rating, optionally type a brief note ("dive deeper into this", "totally extra", "wrong level of abstraction"). The rating and text are stored together.
3. **General Comments**: Add free-form text comments in a discussion section below the report, matching the familiar ticket comment experience (text input, @mentions, file uploads).
4. **Team Collaboration**: Multiple users independently rate and comment. Real-time updates via SSE so everyone sees new feedback without refreshing.
5. **Agent-Driven Iteration**: Trigger "Continue" to start a new iteration. All accrued ratings and comments are automatically injected into the agent's context. No manual re-entry.
6. **Cross-Iteration Review**: Navigate between report versions to see what feedback was left on each round and understand why sections changed.

## Core Workflow

```
1. Agent generates report (Round 1)
2. User opens report, rates sections with one-click reactions
3. User optionally adds text alongside ratings
4. Team discusses in comments (real-time)
5. User clicks "Continue" -- feedback auto-included
6. Agent generates Round 2 informed by structured feedback
7. User reviews Round 2 with fresh comments on new version
```

## Essential Features (MVP)

| # | Feature |
|---|---------|
| 1 | Three-level section rating: thumbs down, thumbs up, double-thumbs-up |
| 2 | One rating per user per section (selecting a new one replaces the old, not additive) |
| 3 | Optional text context alongside any rating |
| 4 | General comment section matching ticket comment UX (@mentions, text input, Helix banner) |
| 5 | Section anchoring via heading slugs (rehype-slug) |
| 6 | Single-level threaded replies per section |
| 7 | Real-time comment delivery via SSE |
| 8 | Hybrid storage: PostgreSQL for operational speed, async Git sidecar for agent-accessible comments.json |
| 9 | 6 REST API endpoints with dual auth (session + inspection token) |
| 10 | 3 MCP tools for agent access (post, get, manage) |
| 11 | CLI commands: hlx library list, show, comments list, comments post |
| 12 | Version-locked comments per report iteration (Round 1 comments stay on Round 1) |
| 13 | @helix mention support in library comments (agent replies with report context) |
| 14 | Continuation auto-context: Library Report Feedback section injected into ticket.md on rerun |
| 15 | Continuation UI on the library page reusing the same patterns as the ticket continuation |

## Features Explicitly Out of Scope (MVP)

| Feature | Why Deferred |
|---------|-------------|
| Sub-heading anchoring (paragraph/list-item level) | Requires custom rehype plugin; fragile across markdown versions |
| Comment carry-forward between iterations | Needs resolved/unresolved state tracking |
| Inline text-selection commenting | Fundamentally different from heading-level feedback |
| Auto-triggering iteration runs | Requires orchestrator integration beyond current scope |
| Rich text comment editing (Tiptap) | Plain text sufficient for brief feedback notes |
| Comment resolution/close workflow | Adds complexity without clear MVP value |
| Diff view between iterations | Significant standalone feature |
| Notification system (email/push) | Requires notification infrastructure |
| Extending to non-library artifacts | Future scope |

## Success Criteria

| # | Criterion | Surface |
|---|-----------|---------|
| 1 | A user can rate all sections of a 10-section report within 30 seconds using one-click ratings | UI |
| 2 | After rating, a user can optionally add a text note alongside the rating | UI |
| 3 | Each user has exactly one rating per section; changing it replaces the previous (not additive) | UI, API |
| 4 | Comments appear for all viewers in real-time without page refresh | UI, SSE |
| 5 | Triggering a continuation automatically includes accrued comments and ratings as agent context | Server |
| 6 | General comment section on library pages behaves consistently with ticket comment section (same UX patterns) | UI |
| 7 | Comments are persisted in Git as comments.json alongside report.md | Server |
| 8 | Version navigation shows version-locked comments | UI |
| 9 | npm run build passes with zero TypeScript errors in all three repos | All |

## Key Design Principles

- **Familiarity**: Library comments, discussion, and continuation should feel identical to their ticket counterparts. Same input patterns, same @mention highlighting, same "Helix" banner for agent responses. Reuse components where possible.
- **Progressive Disclosure**: Ratings are one-click. Text is optional. Threads are collapsed by default. Don't overwhelm the reading experience.
- **Speed**: Rating 10 sections should be faster than typing a single sentence. Optimistic updates so clicks feel instant.
- **Context Preservation**: Every rating and comment is automatically included in continuation context. Users never re-type feedback.
- **PDF Safety**: Interactive elements (toolbars, threads) are invisible in PDF exports. Report content remains clean for download.

## Scope & Constraints

- **Three repos**: Server (data model, API, SSE, MCP, Git sync, continuation), Client (UI components, hooks, SSE), CLI (library commands, SKILL.md).
- **No new npm dependencies** in any repo.
- **Rating taxonomy**: THUMBS_UP, THUMBS_DOWN, DOUBLE_THUMBS_UP stored as strings with Zod validation (not Prisma enum, to allow easy evolution).
- **Current run context**: This is a conflict resolution run after staging refresh. All 3 repos had one conflicted file each, but auto-merge resolved all cleanly with no markers remaining. The Library Comments feature is fully implemented from 8+ prior iterations. Build verification is the primary action needed.

## Future Considerations

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| Smart feedback summarization (AI-generated section directives) | High | Reduces cognitive load before triggering continuation |
| Section-level version diff | High | Closes feedback loop: shows what changed in response to feedback |
| Consensus heat map | Medium | Visual per-section alignment indicators (green/amber/red) |
| Comment templates / quick-reaction chips | Medium | "Dive deeper", "Too verbose", "Needs data" as one-click chips |
| --json CLI output flag | Medium | Structured output for automation |

## Open Questions / Risks

| Question / Risk | Severity | Notes |
|-----------------|----------|-------|
| @helix reply handler in library comments was previously disabled due to passing libraryItemId where ticketId expected. Is it now correctly wired? | Medium | Prior discussion flagged this; needs runtime verification |
| In-memory debounce for Git sidecar sync is per-process. Multiple server instances could produce duplicate writes. | Medium | Harmless (idempotent), but worth noting for scale |
| Migration has not been deployed to production (runtime inspection confirmed LibraryComment table missing) | Medium | Migration files exist; deployment is a release concern, not a code issue |
| Continuation UI consistency between ticket and library pages | Low | User explicitly requested these be identical; verify shared components |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (Research Report, all 3 repos) | Primary specification | Detailed 3-phase design across server/client/CLI with 14 MVP features, 5 user flows, and 9 success criteria |
| ticket.md (Discussion section) | User feedback from 8+ iterations | Key refinements: double thumbs up (not heart), one-rating-per-user-per-section, text-alongside-rating, UX consistency with ticket comments |
| ticket.md (Continuation Context) | Latest user direction | Focus on rating+text together, comment/continuation coherence, UX polish |
| scout/scout-summary.md (client) | Feature implementation status | All 13 Phase 2a client steps complete, 10 component files intact |
| scout/scout-summary.md (server) | Feature implementation status | All 10 Phase 1 server steps complete, migration not yet in production |
| scout/scout-summary.md (CLI) | Feature implementation status | All 9 Phase 2b CLI steps complete |
| diagnosis/diagnosis-statement.md (client) | Conflict resolution status | All 3 repos clean, no markers, auto-merge preserved both sides |
| diagnosis/diagnosis-statement.md (server) | Server conflict status | orchestrator/repositories.ts clean, library files unaffected |
| diagnosis/diagnosis-statement.md (CLI) | CLI conflict status | tickets/index.ts clean, library module unaffected |
| repo-guidance.json | Repo intent classification | All 3 repos are targets (conflict resolution context) |
| Attachment image.png | Current UI state | Shows working library comments: thumbs ratings, Helix agent replies, section grouping, @helix mention |
| Runtime inspection manifest | Production state | DB tables for LibraryComment not yet deployed; migration pending |

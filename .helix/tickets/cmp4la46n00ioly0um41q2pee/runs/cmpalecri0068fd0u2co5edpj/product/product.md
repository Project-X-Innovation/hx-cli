# Product Definition — Library Comments and Iteration (Continuation: Badge Polish & Hardening)

## Problem Statement

Library reports are static, read-only markdown documents. Once generated, there is no mechanism for users to rate individual sections, add contextual notes, or collaborate on improvements. Feedback lives in the ticket discussion thread — spatially disconnected from the report content and invisible to agents generating the next iteration.

This breaks the iteration loop: users form opinions about specific sections but must manually re-state that feedback every time they trigger a continuation. Section-level signal is lost between rounds.

**Continuation context:** The feature is fully implemented across all three repos from 6 prior runs. All architectural and functional gaps have been resolved. Two specific user complaints remain, plus a hardening pass:

1. **Badge shows wrong indicator**: The comment badge on section headings renders a generic speech-bubble icon with a total count. The user wants per-rating icons (thumbs down, thumbs up, double thumbs up) with individual counts visible at a glance — so you can immediately tell whether section feedback is positive or negative without expanding the thread.

2. **No visual proof**: The user has not seen what the rendered comments actually look like and wants thorough screenshot verification demonstrating the complete feature.

3. **Hardening**: Input validation gaps (server) and discoverability gaps (CLI) need tightening.

## Product Vision

Section-level feedback is the primary iteration mechanism. Users rate sections directly on the report in under 30 seconds. Optional text adds nuance. Teams discuss in threaded comments that arrive in real time. When a continuation is triggered, all accrued feedback is automatically included — no manual re-entry. The agent reads structured, section-organized feedback and generates an informed next round.

**At-a-glance principle (this run):** A user scanning a report should immediately see the sentiment of each section's feedback without clicking anything. Per-rating icons with counts on the section heading replace the generic comment bubble.

## Users

| User | Primary Need |
|------|-------------|
| **Report Owner** | Quick section-level triage: signal what worked and what didn't in seconds, then trigger a better next iteration |
| **Team Members** | Independently review sections, see each other's ratings and notes in real time, discuss via threaded replies |
| **Coding Agents** | Read structured section feedback as continuation context; post comments programmatically via CLI or MCP tools |

## Use Cases

1. **One-Click Section Rating** — Hover over any heading, click thumbs down / thumbs up / double thumbs up. Rating recorded instantly with optimistic UI. Target: rate a 10-section report in 30 seconds.
2. **Rating with Text Context** — After clicking a rating, an optional textarea expands. Type a brief note ("Dive deeper," "Totally extra," "Wrong level of abstraction") and submit.
3. **At-a-Glance Section Sentiment** — Without expanding threads, see per-rating icon counts on each section heading badge. Immediately know: 2 thumbs up, 1 thumbs down. No need to guess what the "3 comments" balloon means.
4. **Real-Time Team Review** — Multiple team members open the same report. Ratings and comments appear for all viewers in real time via SSE without page refresh.
5. **Threaded Discussion** — Reply to any comment to start a section-scoped conversation. Replies don't require a rating.
6. **Agent-Driven Iteration** — Trigger a continuation. Accrued comments are automatically injected as a structured `## Library Report Feedback` section. No manual re-entry.
7. **Cross-Version Review** — Navigate between report versions via the version selector. Each version shows its own version-locked comments.
8. **CLI Feedback** — Agents and power users discover sections via `hlx library show`, read feedback via `hlx library comments list`, and post ratings via `hlx library comments post`.
9. **@helix Mentions** — Mention @helix in a library comment to trigger an AI reply with full report context and section discussion history.

## Core Workflow

```
Web UI:
  1. Open library report detail view
  2. Hover heading -> floating toolbar appears (thumbs-down, thumbs-up, double-thumbs-up)
  3. Click rating -> instant optimistic update; optional textarea expands
  4. Submit text (optional) or click away -> comment posted
  5. Badge on heading shows per-rating icons with counts (e.g. 2 thumbs-up, 1 thumbs-down)
  6. Click badge -> expand inline comment thread
  7. Other users' comments arrive in real time via SSE
  8. Trigger continuation -> feedback auto-included in next run's context

CLI / Agent:
  1. hlx library show <ref>       -> see sections with [slug] annotations and rating summaries
  2. hlx library comments list <ref>  -> read section-grouped feedback with comment IDs
  3. hlx library comments post <ref> --section <slug> --rating <value> [message]
  4. MCP tools: post-library-comment, get-library-comments, manage-library-comment
```

## Essential Features (MVP)

| # | Feature |
|---|---------|
| 1 | Three-level section rating per heading (thumbs down, thumbs up, double thumbs up) |
| 2 | Optional text context with any rating |
| 3 | Section anchoring via heading slugs (rehype-slug) |
| 4 | Single-level threaded comments per section |
| 5 | Real-time delivery via SSE |
| 6 | Hybrid storage: PostgreSQL for speed + async Git sidecar for self-containment |
| 7 | Git sidecar: `comments.json` alongside `report.md` per version |
| 8 | 6 API endpoints with dual auth (session + inspection token) |
| 9 | 3 MCP tools for agent access |
| 10 | CLI commands: `hlx library list`, `show`, `comments list`, `comments post` |
| 11 | Version-locked comments (each iteration starts with a clean slate) |
| 12 | Per-section rating summary — at-a-glance per-rating icon counts on heading badge |
| 13 | @helix mentions with AI reply (report + section context) |
| 14 | Continuation auto-context: `## Library Report Feedback` section injected on reruns |

### This Run: Specific Changes

| # | Change | Surface | Rationale |
|---|--------|---------|-----------|
| C1 | Badge shows per-rating icons (thumbs-down, thumbs-up, double-thumbs-up) with individual counts instead of speech-bubble + total | Client | User request: "I think it would be better if you saw right away a thumbs up, thumbs down, or double thumbs up" |
| C2 | Only non-zero rating counts displayed (no visual clutter) | Client | Keeps badge compact when only 1-2 rating types have counts |
| C3 | Color scheme consistent with toolbar and comment items (green/blue/orange) | Client | Visual consistency across all rating surfaces |
| C4 | Comment content max length: 5,000 characters | Server | Prevents abuse via arbitrarily large comment text |
| C5 | Anchor whitespace trimming + rejection of empty strings | Server | Prevents whitespace-only anchors creating invalid records |
| C6 | Reply comments require at least a rating OR content | Server | Prevents empty database records with no useful data |
| C7 | `hlx library` listed in main `hlx --help` output | CLI | Users can't discover the feature if it's not in help |
| C8 | Comment IDs shown in `hlx library comments list` output | CLI | Required for `--reply-to` flag — currently undiscoverable |
| C9 | User-friendly error messages on network failures | CLI | Raw stack traces replaced with actionable error messages |

## Features Explicitly Out of Scope (MVP)

| Feature | Why Deferred |
|---------|-------------|
| Sub-heading anchoring (paragraph/list-item level) | Requires custom rehype plugin; fragile across versions |
| Comment carry-forward between iterations | Requires "resolved" state tracking |
| Inline text-selection commenting | Fundamentally different interaction model |
| Auto-triggering iteration runs | Requires orchestrator integration changes |
| Rich text comment editing (Tiptap) | Plain textarea sufficient for brief feedback; lighter bundle |
| Comment resolution/close workflow | Adds complexity without clear MVP value |
| Diff view between iterations | Significant standalone feature |
| Notification system (email/push) | Requires notification infrastructure |
| Consensus heat map visualization | Summary data available; visual layer deferred |
| Extending to non-library artifacts | Future scope; model naming accommodates |

## Success Criteria

| # | Criterion | How Verified |
|---|-----------|-------------|
| 1 | Section heading badge shows per-rating icons (thumbs-down, thumbs-up, double-thumbs-up) with individual counts — not a speech-bubble | Visual: badge on any section with comments shows rating breakdown |
| 2 | Only non-zero rating counts appear in the badge (no "0" clutter) | Visual: section with only thumbs-up shows only thumbs-up icon |
| 3 | Badge color scheme matches toolbar and comment item colors | Visual: green for thumbs-up, blue for double-thumbs-up, orange for thumbs-down |
| 4 | A user can rate all sections of a 10-section report within 30 seconds | UI walkthrough with timer |
| 5 | Ratings appear instantly via optimistic update before server response | Visual: no spinner/delay after click |
| 6 | Comments from other users appear in real time without page refresh | Multi-tab SSE test |
| 7 | Triggering a continuation automatically includes accrued comments as structured context | Verify `## Library Report Feedback` section in generated ticket.md |
| 8 | Agents can read section-level feedback via `hlx library comments list` and MCP tools | CLI output shows grouped ratings + text with comment IDs |
| 9 | Comments persisted in Git as `comments.json` sidecar files | Verify file in library repo after posting |
| 10 | @helix mentions trigger agent replies with report context | Post @helix comment, verify reply |
| 11 | Comment content rejects text over 5,000 characters | API returns validation error for oversized content |
| 12 | `hlx --help` shows library commands | CLI help text includes library section |
| 13 | `npm run build` passes with zero TypeScript errors in all three repos | Build gate |
| 14 | Thorough screenshot verification demonstrating: rating toolbar on hover, per-rating badge, expanded comment thread, comment input, reply flow, edit/delete actions | Visual proof provided to user |

## Key Design Principles

- **At-a-glance feedback**: Badge shows what users care about — sentiment breakdown, not a count. One look tells you "mostly positive" or "needs work."
- **Wrap, don't modify**: 2-line `components` prop addition to shared MarkdownRenderer. No breaking changes.
- **Progressive disclosure**: Hover -> toolbar; click -> textarea; submit -> done. Minimum 1 click.
- **PDF safety by construction**: Toolbar invisible in static capture (CSS hover); threads outside `contentRef`; `print:hidden` safety net.
- **Optimistic updates with rollback**: One-click ratings appear instantly; snapshot rollback on error.
- **Comments are the iteration mechanism**: No manual feedback re-entry on continuation.
- **Hybrid storage**: Fast UX via PostgreSQL; Git self-containment for agents via async sidecar.

## Scope & Constraints

- **Continuation run — polish pass**: All files exist. The feature works end-to-end. This run targets the badge display change, input validation hardening, CLI discoverability, and visual verification.
- **Three repos, one feature**: Server (Phase 1), Client (Phase 2a), CLI (Phase 2b).
- **No new npm dependencies** in any repo.
- **Single file change on client**: `section-comment-badge.tsx` is the only file that needs a rendering change. Data is already available via `LibraryCommentSummary` context.
- **Version-locked comments**: Each report iteration starts clean.
- **Single-level threading**: Replies to replies redirect to top-level parent.

## Future Considerations

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| Smart feedback summarization (AI-generated per-section directives) | High | Reduces cognitive load before triggering next iteration |
| Section-level version diff | High | Show what changed between iterations, closing the feedback loop |
| Agent auto-commentary on changed sections | High | Transparent trail of agent reasoning |
| Consensus heat map (color-coded alignment indicators) | Medium | Summary data already available; badge change makes this easier |
| Comment templates / quick-reaction chips | Medium | Faster than typing, categorizable |
| `--json` CLI output flag | Medium | Programmatic access for scripts |
| Comment carry-forward with resolved/unresolved state | Medium | Tracks whether feedback was addressed |
| Cross-report feedback pattern analysis | Low | Organizational learning from aggregate trends |

## Open Questions / Risks

| Question / Risk | Status |
|----------------|--------|
| In-memory debounce for Git sidecar sync in multi-instance deployments | Acceptable for MVP — duplicate writes are idempotent; Redis-backed debounce deferred |
| @helix reply quality in library context | Implemented but not runtime-tested; quality depends on prompt tuning |
| Heading hover behavior on touch/mobile devices | CSS hover only — no explicit touch handling; known limitation |
| `LOVE` stored value vs "double thumbs up" display label | Keeping `LOVE` as stored value per spec; display shows double-thumbs-up icon |
| Per-rating badge layout when all 3 rating types have counts | Badge shows up to 3 icon-count pairs — verify it doesn't overflow or look cramped |
| Production database migration for LibraryComment table | Migration file committed; deployment runs `prisma migrate deploy` |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (research report) | Primary specification for all 3 phases | Full architecture, data model, API contract, component design, CLI commands, success criteria |
| ticket.md (continuation context) | User's specific current requests | Replace speech-bubble badge with per-rating icons; provide visual proof of comments |
| ticket.md (discussion thread) | Prior run history (6 runs) | All deviations resolved; this run is final polish for badge + hardening |
| scout/scout-summary.md (client) | Current implementation state | All 9 components complete; only `section-comment-badge.tsx` needs rendering change; data available via context |
| scout/scout-summary.md (server) | Server completeness | All 6 service files present and functional; 3 Zod validation gaps identified |
| scout/scout-summary.md (CLI) | CLI completeness | All 7 library files present; 3 discoverability gaps identified |
| diagnosis/diagnosis-statement.md (client) | Badge change specification | Replace speech-bubble with per-rating icons matching toolbar/item color scheme; retain toggle/accessibility |
| diagnosis/diagnosis-statement.md (server) | Server hardening items | Content max 5000, anchor trim, empty reply prevention — all single-line Zod additions |
| diagnosis/diagnosis-statement.md (CLI) | CLI discoverability items | Missing from help, comment IDs not printed, no error handling |
| repo-guidance.json | Prior scope assessment | Client is primary target; server and CLI need minor hardening (updated to target all 3) |

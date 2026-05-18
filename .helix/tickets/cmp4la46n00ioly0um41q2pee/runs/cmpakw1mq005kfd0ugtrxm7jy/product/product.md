# Product Definition — Library Comments and Iteration (Run 4: Hardening & Polish)

## Problem Statement

Library reports are static, read-only markdown documents. Once a report is generated and published, there is no mechanism for users to rate individual sections, add contextual notes, or collaborate on improvements. The only way to provide feedback is through the originating ticket's discussion thread — which is spatially disconnected from the report content and structurally invisible to agents generating the next iteration.

This breaks the iteration loop: users form opinions about specific sections, but must manually re-state that feedback every time they trigger a continuation. Section-level signal is lost between rounds.

**Run 4 context:** The feature is architecturally complete across all three repos (server, client, CLI). All prior deviations from runs 1–3 have been resolved (nullable rating, @helix replies, double-thumbs icon, optimistic updates, threads outside PDF boundary). This run focuses on intuitiveness polish — making every interaction feel obvious and robust.

## Product Vision

Section-level feedback becomes the primary iteration mechanism. Users rate sections directly on the report in under 30 seconds. Optional text adds nuance. Teams discuss in threaded comments that arrive in real time. When a continuation is triggered, all accrued feedback is automatically included — no manual re-entry. The agent reads structured, section-organized feedback and generates an informed next round.

## Users

| User | Primary Need |
|------|-------------|
| **Report Owner** | Quick section-level triage: signal what worked and what didn't in seconds, then trigger a better next iteration |
| **Team Members** | Independently review sections, see each other's ratings and notes in real time, discuss via threaded replies |
| **Coding Agents** | Read structured section feedback as continuation context; post comments programmatically via CLI or MCP tools |

## Use Cases

1. **One-Click Section Rating (Flow 1)** — Hover over any heading, click thumbs down / thumbs up / double thumbs up. Rating recorded instantly with optimistic UI. Target: rate a 10-section report in 30 seconds.
2. **Rating with Text Context (Flow 2)** — After clicking a rating, an optional textarea expands. Type a brief note ("Dive deeper," "Totally extra," "Wrong level of abstraction") and submit.
3. **Real-Time Team Review (Flow 3)** — Multiple team members open the same report. Ratings and comments appear for all viewers in real time via SSE without page refresh.
4. **Threaded Discussion (Flow 3 extension)** — Reply to any comment to start a section-scoped conversation. Replies don't require a rating.
5. **Agent-Driven Iteration (Flow 4)** — User triggers a continuation. Accrued comments are automatically injected into the next run's context as a structured `## Library Report Feedback` section. No manual re-entry.
6. **Cross-Version Review (Flow 5)** — Navigate between report versions via the version selector. Each version shows its own version-locked comments. Understand why sections changed between iterations.
7. **CLI Feedback (Flow 4 extension)** — Agents and power users discover sections via `hlx library show`, read feedback via `hlx library comments list`, and post ratings via `hlx library comments post`.
8. **@helix Mentions** — Mention @helix in a library comment to trigger an AI reply with full report context and section discussion history.

## Core Workflow

```
Web UI:
  1. Open library report detail view
  2. Hover heading → floating toolbar appears (👎 👍 👍👍)
  3. Click rating → instant optimistic update; optional textarea expands
  4. Submit text (optional) or click away → comment posted
  5. Comment badge appears on heading → click to expand inline thread
  6. Other users' comments arrive in real time via SSE
  7. Trigger continuation → feedback auto-included in next run's context

CLI / Agent:
  1. hlx library show <ref>       → see sections with [slug] annotations
  2. hlx library comments list <ref>  → read section-grouped feedback
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
| 12 | Per-section rating summary (at-a-glance distribution) |
| 13 | @helix mentions with AI reply (report + section context) |
| 14 | Continuation auto-context: `## Library Report Feedback` section injected on reruns |

### Run 4 Polish Features

| # | Polish Item | Surface |
|---|-------------|---------|
| P1 | Reply button on comments — enables threaded discussion from UI | Client |
| P2 | Edit/delete actions on own comments (5-min edit window visible) | Client |
| P3 | Current user's rating highlighted on toolbar (visual "you already rated this") | Client |
| P4 | Accessibility: `aria-expanded` + chevron on comment badge | Client |
| P5 | Empty reply prevention (must have rating or text) | Client + Server |
| P6 | Form input preserved on mutation error (reset only on success) | Client |
| P7 | Content length limit (5000 chars) on comments | Server |
| P8 | Anchor whitespace trimming | Server |
| P9 | `hlx library` in main help text | CLI |
| P10 | Comment IDs shown in `comments list` output (needed for `--reply-to`) | CLI |

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
| 1 | A user can rate all sections of a 10-section report within **30 seconds** using one-click ratings | UI walkthrough with timer |
| 2 | Ratings appear instantly via optimistic update before server response | Visual: no spinner/delay after click |
| 3 | Comments from other users appear in real time without page refresh | Multi-tab SSE test |
| 4 | Triggering a continuation **automatically includes** accrued comments as structured context | Verify `## Library Report Feedback` section in generated ticket.md |
| 5 | Agents can read section-level feedback via `hlx library comments list` and MCP tools | CLI command output shows grouped ratings + text |
| 6 | Comments are persisted in Git as `comments.json` sidecar files | Verify file in library repo after posting comments |
| 7 | Navigating between report versions shows the correct version-locked comments | Version selector test in UI |
| 8 | @helix mentions in library comments trigger agent replies with report context | Post @helix comment, verify reply |
| 9 | Users can reply to specific comments via a Reply button | Click reply, post, see threaded structure |
| 10 | Users can edit/delete their own comments within the 5-min window | Edit and delete actions visible and functional on own recent comments |
| 11 | `hlx --help` shows library commands; `comments list` shows comment IDs | CLI help text and output format |
| 12 | LOVE rating displays double thumbs up icon (not heart) everywhere | Visual check across toolbar, input, and comment item |
| 13 | Comment threads excluded from PDF exports | PDF generation produces clean output |
| 14 | `npm run build` passes with zero TypeScript errors in all three repos | Build gate |

## Key Design Principles

- **Wrap, don't modify**: 2-line `components` prop addition to shared MarkdownRenderer — no breaking changes.
- **Module-level components + Context**: Heading components at module scope consume data via React Context, avoiding re-mount on every render.
- **Progressive disclosure**: Hover → toolbar; click → textarea; submit → done. Minimum 1 click, maximum 3 clicks.
- **PDF safety by construction**: Toolbar invisible in static capture (CSS hover); threads outside `contentRef`; `print:hidden` safety net.
- **Optimistic updates with rollback**: One-click ratings appear instantly; snapshot rollback on error preserves user input.
- **Comments are the iteration mechanism**: No manual feedback re-entry on continuation. The system carries forward what users already expressed.
- **Hybrid storage**: Fast UX via PostgreSQL; Git self-containment for agents via async sidecar.

## Scope & Constraints

- **Run 4 — polish and hardening pass**: All files exist. The feature works end-to-end. This run targets intuitiveness gaps and input validation hardening — not new architecture.
- **Three repos, one feature**: Server defines the API contract (Phase 1); Client and CLI consume it independently (Phase 2a/2b).
- **No new npm dependencies** in any repo.
- **Plain textarea, not Tiptap**: Brief feedback notes don't need rich text editing.
- **Version-locked comments**: Each report iteration starts clean. Comments are snapshots of thinking at a point in time.
- **Single-level threading**: Replies to replies redirect to top-level parent. Deep nesting adds complexity without matching the feedback use case.

## Future Considerations

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| Smart feedback summarization (AI-generated per-section directives) | High | Reduces cognitive load before triggering next iteration |
| Section-level version diff | High | Show what changed between iterations, closing the feedback loop |
| Agent auto-commentary on changed sections | High | Transparent trail of agent reasoning |
| Consensus heat map (color-coded alignment indicators) | Medium | Summary data already available |
| Comment templates / quick-reaction chips ("Dive deeper," "Too verbose") | Medium | Faster than typing, categorizable |
| `--json` CLI output flag | Medium | Programmatic access for scripts |
| Comment carry-forward with resolved/unresolved state | Medium | Tracks whether feedback was addressed |
| Cross-report feedback pattern analysis | Low | Organizational learning from aggregate trends |
| Rich text editing (Tiptap) | Low | Only if feedback patterns demand it |
| Notification system | Low | Requires separate infrastructure |

## Open Questions / Risks

| Question / Risk | Status |
|----------------|--------|
| In-memory debounce for Git sidecar sync in multi-instance deployments | Acceptable for MVP — duplicate writes are idempotent; Redis-backed debounce deferred |
| @helix reply quality in library context (report content + section discussion) | Implemented but not runtime-tested; quality depends on prompt tuning |
| Heading hover behavior on touch/mobile devices | CSS hover only — no explicit touch handling; known limitation |
| Whether `LOVE` label should be renamed in UI (e.g., "Double thumbs up") | Keeping `LOVE` as stored value per research report; only the icon changed to double thumbs up |
| Production database migration for LibraryComment table | Migration file committed; deployment runs `prisma migrate deploy` |
| Git sidecar sync behavior under concurrent multi-user rapid rating | Debounced at 5s per item; SHA-based writes are self-healing on retry |
| CLI library-specific error handling for 404/400 responses | hxFetch calls lack try-catch; raw stack traces on network errors (hardening item) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (research report) | Primary specification for all 3 phases | Full architecture, data model, API contract, component design, CLI commands, and success criteria |
| ticket.md (continuation context) | User's Run 4 directive | "Harden it up, make it slick, make it sweet, make it fun to use" — intuitiveness focus |
| ticket.md (discussion thread) | Prior run statuses and user feedback | All 4 deviations from runs 2-3 resolved; heart → double thumbs up; verification with screenshots requested |
| scout/scout-summary.md (client) | Run 4 implementation state | All 9 new + 4 modified files complete; 10 intuitiveness surface areas identified |
| scout/scout-summary.md (server) | Run 4 implementation state | All 6 new files complete (1,031 lines); continuation context integration confirmed at orchestrator lines 391-413 and 1181-1206 |
| scout/scout-summary.md (CLI) | Run 4 implementation state | All 7 new + 2 modified files complete; rating aliases, auto-slugification, SKILL.md confirmed |
| scout/reference-map.json (client) | File-level detail | Prior fixes confirmed: double thumbs, optimistic updates, nullable rating, threads outside contentRef |
| scout/reference-map.json (server) | File-level detail | Nullable rating in schema + migration, @helix reply service fully implemented |
| scout/reference-map.json (CLI) | File-level detail | 3-format item resolution, conditional rating require for replies |
| diagnosis/diagnosis-statement.md (client) | Intuitiveness gaps | No reply button, no edit/delete UI, currentUserRating not wired, badge accessibility, empty reply guard, form reset timing |
| diagnosis/diagnosis-statement.md (server) | Validation hardening gaps | Content length limit, anchor whitespace, empty reply prevention |
| diagnosis/diagnosis-statement.md (CLI) | Discoverability gaps | Missing from main help, comment IDs not in output, no error handling |
| diagnosis/apl.json (client) | 10-question intuitiveness audit | Confirmed: SSE works, optimistic keys align, PDF safety intact; gaps in reply, edit/delete, accessibility |
| diagnosis/apl.json (server) | Server hardening verification | Prior deviations resolved; 3 minor Zod schema additions needed |
| diagnosis/apl.json (CLI) | Discoverability verification | Library not in usage(), IDs not printed, rating aliases work well |
| repo-guidance.json | Repo roles and change scope | All 3 repos are targets: client (6 UX fixes), server (3 validation fixes), CLI (2 discoverability fixes) |

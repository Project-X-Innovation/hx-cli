# Product: Walkthrough Feature — Dual-Pronged Overhaul

## Problem Statement

Developers fear "slop" — AI-generated code that breaks the codebase's major architectural arteries. Every developer carries a mental map of how their codebase moves and breathes; they need to verify that AI changes add side streets, not dam rivers. The existing walkthrough feature was built to solve this but fails completely: production logs show zero user engagement, the viewer shows source code without diffs (so developers can't see what changed), the feature is buried inside run card expansion (so they can't find it), and 54% of completed runs have no walkthrough data at all. Meanwhile, the "Continue with Claude Code" handoff passes zero walkthrough context — it's a clipboard copy of a generic prompt.

Two channels are needed because developers are in both: some are already in the Helix web UI reviewing a ticket, others are in their coding agent (e.g., Claude Code) ready to pull changes. Both channels must deliver maximum architectural insight per interaction.

## Product Vision

Two equally important channels for walkthrough delivery — a sharp, high-density web UI for developers already in the dashboard, and a CLI command that pipes rich walkthrough data into coding agents like Claude Code. Both must answer the same question fast: "Did this AI change respect the codebase's major arteries?"

## Users

- **Primary**: Developers who direct Helix tickets and need to verify AI-generated code before merging. They split time between the Helix web UI and coding agents (Claude Code, VS Code, terminal).
- **Secondary**: Tech leads reviewing multiple tickets who need fast triage of which changes are safe vs. which need deeper manual review.

## Use Cases

1. **In-UI review**: Developer sees a completed ticket in the Helix dashboard. One click opens a walkthrough that shows diffs, explains why each change was made, and labels which architectural areas are touched — all without navigating away.
2. **CLI/Agent review**: Developer is in Claude Code or their terminal. They run `hlx walkthrough` and get structured walkthrough data that their coding agent can reason about, or they read a scannable text summary directly.
3. **Architectural spot-check**: Developer wants to verify a specific change didn't create a new major abstraction where one already exists. The walkthrough labels each step by impact area (API Surface, Data Model, UI Component, etc.).
4. **Confidence merge**: Developer scans the walkthrough summary, sees all changes are additive side-streets, and merges with confidence.

## Core Workflow

### Prong 1 — Web UI
1. Ticket completes → walkthrough data is pre-generated and stored.
2. Developer opens ticket detail → walkthrough is a prominent, top-level call-to-action (not buried in run card).
3. Developer clicks → full-screen viewer shows diffs with step-by-step explanation + architectural impact labels.
4. Each step delivers: what changed (diff), why it changed (explanation from APL), and where it fits (architectural category). Maximum weight per click.

### Prong 2 — CLI / Coding Agent
1. Ticket completes → developer runs `hlx walkthrough` in their terminal or coding agent.
2. Text format: scannable, high-density step-by-step output with file:line, descriptions, and summary.
3. JSON format: structured data that Claude Code or other agents consume for interactive review — replacing the current generic "Continue with Claude Code" clipboard command.
4. Developer reviews, approves, or sends back for revision — all without leaving their coding environment.

## Essential Features (MVP)

### Prong 1: UI Walkthrough (helix-global-client)
1. **Diff view in walkthrough viewer**: Each step shows the actual code change (diff/patch), not just source code at a line number. This is the single most important gap — developers can't assess changes they can't see.
2. **Prominent placement**: Walkthrough becomes a top-level CTA on ticket detail for completed runs, not buried inside RunCard expansion. One click to open, not three scrolls.
3. **Remove "Generate Walkthrough" relic**: The on-demand generation button is confirmed irrelevant. Remove it entirely.
4. **Architectural impact labels**: Each walkthrough step is labeled by the area it touches (API Surface, Data Model, Infrastructure, UI Component, Config, Tests) so developers can quickly gauge which arteries are affected.
5. **Declutter**: Collapse IntraView/VS Code links and download .tour buttons behind progressive disclosure (overflow menu or collapsible section). Show summary stats and "View Walkthrough" prominently.
6. **High information density**: Each step in the viewer must deliver diff + explanation + architectural label in a single view without additional clicks.

### Prong 2: CLI Walkthrough (helix-cli)
1. **`hlx walkthrough` command**: New top-level command that fetches and displays pre-computed walkthrough data. Follows existing `comments` module pattern (resolveTicketId with `--ticket` flag and `HELIX_TICKET_ID` env var fallback).
2. **Dual output format**: `--format text` (default) for human-readable terminal output; `--format json` for structured data consumable by coding agents like Claude Code.
3. **Run resolution**: `--run <id>` flag with default to latest completed run. Developers shouldn't need to know the run ID.
4. **Replace "Continue with Claude Code" handoff**: The current clipboard-copy feature passes zero walkthrough context. Replace with a command that includes actual walkthrough data, architectural framing, and diff context so the coding agent can provide meaningful interactive review.

### Shared Backend (helix-global-server)
1. **GET endpoint for stored walkthrough data**: New GET `/tickets/:ticketId/runs/:runId/walkthrough` that returns pre-computed `walkthroughData` without triggering regeneration. Must support `runId=latest` for latest completed run resolution.
2. **Fix findRunOrThrow bug**: Replace the currentRun-only check with a direct Prisma query scoped by organization and ticket. This is a confirmed oversight (not a security boundary) that blocks walkthrough access for any non-current run — breaks both UI and CLI.
3. **Suppress empty walkthroughs**: Filter out walkthroughs with 0 tour stops at read-time so neither channel surfaces hollow content.

## Features Explicitly Out of Scope (MVP)

- **Auto-pull of finished tickets into coding agents**: Automatically injecting walkthroughs into Claude Code sessions when a ticket completes. Valuable follow-up, but requires deeper third-party integration.
- **Automatic good/bad judgment**: The CLI immediately scoring changes as safe/unsafe. Requires quality-scoring infrastructure that doesn't exist.
- **Walkthrough content quality overhaul**: Improving the Claude prompt, raising APL truncation limits (currently 3000 chars), or switching generation models. Content quality when generated is adequate (8-14 steps with architectural rationale). The delivery problem is more urgent.
- **Usage analytics / click-tracking**: Measuring walkthrough adoption. Useful but not blocking for MVP.
- **Interactive terminal TUI**: Rich arrow-key navigation or syntax highlighting in terminal. MVP outputs formatted text/JSON.
- **Deprecating the web walkthrough**: The web viewer is retained and improved, not removed.
- **Diff computation on the client**: The server should provide diff data; the client should not fetch and diff files.

## Success Criteria

| Criteria | Measurement | Target |
|----------|-------------|--------|
| CLI walkthrough is used | Server logs show GET requests to walkthrough endpoint from CLI user-agent | > 0 requests within first week |
| UI walkthrough shows diffs | Walkthrough viewer renders code changes, not just source | Each step shows diff view |
| findRunOrThrow bug eliminated | Zero 404s on walkthrough endpoints for completed runs with data | 0 errors |
| Empty walkthroughs suppressed | Walkthroughs with 0 steps not surfaced to any channel | 0 empty walkthroughs visible |
| UI prominently surfaces walkthrough | Walkthrough CTA visible on ticket detail without expanding run card | Visible on page load for completed runs |
| Developer confidence | Qualitative feedback that walkthroughs help verify changes | Positive signal from >= 2 developers |

## Key Design Principles

- **Both channels are first-class**: The web UI and CLI are equally important. Developers are in both places; neither is secondary.
- **Maximum weight per click**: Every interaction must deliver the highest possible density of architectural insight. No wasted steps, no empty screens, no generic placeholders.
- **Show changes, not just code**: The fundamental unit of a walkthrough step is the diff — what changed — not the file at a line number. Explanation and context wrap around the change.
- **Speed over completeness**: Pre-computed data served in < 3 seconds beats a 60-second on-demand generation. The "Generate" relic is gone.
- **Structured for agents**: CLI output must be machine-readable (JSON) so coding agents can consume walkthroughs programmatically and provide interactive review.
- **Progressive disclosure**: Show what matters first (summary, architectural areas touched), details on demand (individual step diffs and explanations).

## Scope & Constraints

- **Three repos**: helix-global-client (UI overhaul), helix-global-server (GET endpoint, findRunOrThrow fix, empty suppression), helix-cli (new walkthrough command).
- **Server is prerequisite**: The GET endpoint and findRunOrThrow fix must land before either UI improvements or CLI can function reliably.
- **No new infrastructure**: walkthroughData already exists as JSONB on SandboxRun. No new database tables, services, or external dependencies needed.
- **Backward compatible**: Existing walkthrough generation pipeline (dual-path: agent-produced or server-generated) continues to work. We're fixing consumption, not generation.
- **Diff data source**: The server already fetches git diffs during walkthrough generation (fetchDiffPatches against staging branch, 12KB budget). This diff data needs to be served alongside tour steps, or the GET endpoint must include diff context.

## Future Considerations

- **Auto-pull integration**: Coding-agent plugins that automatically surface walkthroughs for recently completed tickets when a developer opens their agent session.
- **Quality scoring**: Automated assessment of walkthrough quality and change risk level to enable triage across multiple tickets.
- **Content quality iteration**: Raise APL truncation limits, improve the generation prompt with architectural categorization, or use longer-context models.
- **Feedback loop**: Developer thumbs up/down on walkthrough steps to build training signal for prompt improvement.
- **CodeTour IDE integration**: Deliver walkthroughs directly in VS Code via the CodeTour extension using the existing .tour file format.
- **Walkthrough generation reliability**: Address the 54% data gap by improving error handling and retry in the generation pipeline (currently best-effort, non-fatal, silently swallowed failures).

## Open Questions / Risks

| Question / Risk | Impact | Notes |
|-----------------|--------|-------|
| How should diff data be served for the UI viewer? | High — core of Prong 1 | Server currently generates diffs during walkthrough creation but doesn't persist them in walkthroughData. Either persist at generation time or add a diff-fetch endpoint. |
| Should architectural labels come from the generation prompt or be computed at render time? | Medium — affects both prongs | The merge-analysis-service already categorizes files (Schema, Config, API Surface, UI, Tests). Could reuse this pattern. |
| Will developers actually use walkthroughs once the delivery channel is fixed, or is the underlying concept flawed? | High — existential risk | Content quality is adequate when generated (8-14 steps, architectural rationale). Ship fast to validate the channel hypothesis. |
| How does `--run latest` resolution work when a ticket has multiple runs? | Medium — CLI UX | Need server-side resolution: most recent completed run with non-empty walkthrough data. |
| Does the staging branch comparison in diff generation affect walkthrough accuracy? | Low for MVP | fetchDiffPatches compares against staging, not main. May include irrelevant changes if staging diverges. Monitor post-launch. |
| What is the quality difference between agent-produced vs. server-generated walkthroughs? | Unknown | No tagging exists for the dual generation paths. Both produce walkthroughData in the same format. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-global-client) | Problem statement and motivation | Devs fear "slop" breaking major codebase arteries; current walkthrough "really bad"; dual approach proposed |
| User continuation context | Direction and priorities | Both UI and CLI prongs confirmed equally important; maximize weight per click; "Generate walkthrough" is a relic; make it amazing and optimal |
| scout/scout-summary.md (helix-global-client) | Client walkthrough surface area | 520-line viewer shows source not diffs; buried in RunCard; 45.9% population rate |
| scout/reference-map.json (helix-global-client) | Client file inventory and facts | Viewer lacks diff/architectural context; ~140 lines nested IIFE JSX; Claude Code handoff is generic |
| diagnosis/diagnosis-statement.md (helix-global-client) | Client root causes | Five compounding causes: no diff view, buried discovery, inconsistent availability, clutter, no CLI path |
| diagnosis/apl.json (helix-global-client) | Client quantified evidence | Zero production usage; production 404 on non-current run; content quality adequate when generated |
| scout/scout-summary.md (helix-global-server) | Server generation pipeline | Claude Sonnet 4.6 + APL + diffs; dual generation paths; findRunOrThrow blocks historical runs |
| scout/reference-map.json (helix-global-server) | Server file inventory | POST-only endpoints; findRunOrThrow oversight; merge-analysis-service categorization pattern |
| diagnosis/diagnosis-statement.md (helix-global-server) | Server root causes | No GET endpoint; findRunOrThrow confirmed oversight; 54% data gap from silent errors |
| diagnosis/apl.json (helix-global-server) | Server evidence | Three required changes: GET endpoint, findRunOrThrow fix, empty suppression |
| scout/scout-summary.md (helix-cli) | CLI extension surface | Zero walkthrough capability; comments pattern as template; hxFetch ready |
| scout/reference-map.json (helix-cli) | CLI patterns and readiness | resolveTicketId reusable; HTTP client with retry ready for new API calls |
| diagnosis/diagnosis-statement.md (helix-cli) | CLI feasibility and gaps | Greenfield gap; established patterns directly reusable; server GET endpoint is blocking dependency |
| diagnosis/apl.json (helix-cli) | CLI evidence | Existing patterns reusable; server dependency confirmed |
| repo-guidance.json | Repo intent from diagnosis | All three repos confirmed as targets with specific change proposals |

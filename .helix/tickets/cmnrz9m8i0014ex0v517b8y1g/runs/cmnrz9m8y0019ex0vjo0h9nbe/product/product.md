# Product: Walkthrough Feature Rework

## Problem Statement

Developers using Helix are uncomfortable merging AI-generated code without first verifying that it respects the codebase's architectural patterns ("major thoroughfares"). The existing walkthrough feature was built to address this need, but production evidence shows it is effectively unused: zero on-demand generation requests and zero successful viewer interactions were observed. The feature is delivered as a web-dashboard modal, which is fundamentally misaligned with where developers actually review code (their IDE or coding agent). Additionally, technical bugs (viewer breaks for non-current runs, 15% empty walkthroughs) and cluttered UX further degrade the experience.

## Product Vision

Give developers fast, high-quality, low-friction walkthroughs of AI-generated changes — delivered where they already work — so they can confidently verify that changes respect the codebase's architectural integrity before merging.

## Users

- **Primary**: Developers who direct Helix tickets and need to review AI-generated code changes before merging. They work primarily in IDEs and coding agents (e.g., Claude Code).
- **Secondary**: Tech leads who oversee multiple Helix tickets and want quick assurance that AI changes maintain codebase coherence.

## Use Cases

1. **Post-ticket review**: A developer's Helix ticket completes. They want to quickly understand what changed and whether it respects existing code patterns — without leaving their coding environment.
2. **Architectural spot-check**: A developer wants to verify that a specific change didn't introduce a new major abstraction where one already exists, or break an established data-flow pattern.
3. **Batch review**: A developer has several completed tickets and wants to triage which ones need deeper manual review vs. which can be merged confidently.

## Core Workflow

1. Developer's Helix ticket reaches a completed state (SUCCEEDED or UNVERIFIED).
2. Developer opens their coding agent or CLI and fetches the walkthrough for that ticket/run.
3. The walkthrough presents changes in data-flow order, highlighting which files changed, why, and how they relate to existing architectural patterns.
4. Developer either approves (merges) or flags concerns (sends back for revision).

## Essential Features (MVP)

1. **CLI walkthrough command** (`hlx walkthrough`): Fetch and display walkthrough data for a ticket/run from the terminal. Output must be readable both as terminal text and as structured data pipeable to coding agents.
2. **Fix findRunOrThrow bug** (server): Allow walkthrough data retrieval for any completed run, not just the ticket's current run. This is a blocking bug that breaks all walkthrough consumption regardless of channel.
3. **Suppress empty walkthroughs**: Do not surface walkthroughs with 0 tour stops to any channel. Either regenerate or hide them.
4. **Simplify web walkthrough UI**: De-clutter the run-history walkthrough section. Keep the "View Walkthrough" button and summary stats; remove or collapse secondary actions (IntraView banner, individual download buttons) behind an overflow menu.

## Features Explicitly Out of Scope (MVP)

- **Auto-pull of finished tickets into coding agents**: The "extend the Helix line" idea (automatically injecting completed ticket reviews into Claude Code sessions) is valuable but requires deeper integration with third-party coding agents. Deferred to a follow-up.
- **Automatic good/bad judgment**: The idea of the CLI immediately saying "good" or "bad" on a walkthrough requires quality-scoring infrastructure that does not exist. Deferred.
- **Walkthrough content quality overhaul**: Improving the Claude prompt, raising truncation limits, or switching generation models is valuable but orthogonal to the delivery-channel problem. Deferred unless MVP usage data shows content quality as the next bottleneck.
- **Usage analytics / click-tracking**: Useful for measuring adoption but not blocking for MVP. Can be added once the new delivery channel is live.
- **Deprecating the web walkthrough entirely**: The web viewer is a functional backup channel. Simplify it but do not remove it in MVP.
- **Interactive terminal step-through navigation**: A rich TUI (arrow-key navigation, syntax highlighting in terminal) is a nice-to-have. MVP can output formatted markdown or JSON.

## Success Criteria

| Criteria | Measurement | Target |
|----------|-------------|--------|
| CLI walkthrough is used | Server logs show GET/POST requests from CLI user-agent | > 0 requests within first week of release |
| findRunOrThrow bug eliminated | Zero 404s on walkthrough/files for completed runs | 0 errors |
| Empty walkthroughs suppressed | Walkthroughs with 0 stops are not served to any channel | 0 empty walkthroughs visible |
| Web UX de-cluttered | Walkthrough section in run-history reduced from ~140 lines to < 60 lines of JSX | Measurable in code |
| Developer confidence | Qualitative feedback from early adopters that walkthroughs help them verify changes | Positive signal from >= 2 developers |

## Key Design Principles

- **Meet developers where they work**: CLI and coding-agent integration is the primary channel; the web viewer is secondary.
- **Speed over completeness**: A walkthrough that loads in < 3 seconds and covers the key architectural decisions is more valuable than an exhaustive tour that takes 60 seconds to generate.
- **Structured output for agents**: CLI output must be machine-readable (JSON) so coding agents can consume and reason about walkthroughs programmatically.
- **Progressive disclosure**: Show summary first, details on demand. Don't overwhelm the developer with all tour stops at once.

## Scope & Constraints

- **Three repos affected**: helix-cli (new walkthrough command), helix-global-server (bug fixes, possible new GET endpoint), helix-global-client (UX simplification).
- **Server is the critical path**: The findRunOrThrow bug fix and empty-walkthrough suppression are prerequisites for any channel (CLI or web) to work reliably.
- **No new infrastructure**: The walkthrough data already exists in the database (walkthroughData JSONB on SandboxRun). The CLI needs to consume it, not generate it.
- **Backward compatible**: The web walkthrough viewer must continue to function (simplified, not removed).

## Future Considerations

- **Auto-pull integration**: Once CLI walkthrough works, explore coding-agent plugins that automatically surface walkthroughs for recently completed tickets when a developer opens their agent.
- **Quality scoring**: Add an automated quality score to walkthroughs (architectural impact assessment) so developers can triage which need manual review.
- **Walkthrough content improvements**: Raise truncation limits, improve the generation prompt, or use a longer-context model to produce richer walkthroughs.
- **Feedback loop**: Allow developers to rate walkthrough quality (thumbs up/down) to build training signal for prompt improvement.
- **CodeTour IDE integration**: Leverage the existing .tour file format to deliver walkthroughs directly in VS Code via the CodeTour extension, without requiring the Helix web UI.

## Open Questions / Risks

| Question / Risk | Impact | Notes |
|-----------------|--------|-------|
| What output format should `hlx walkthrough` use for coding agents? | High — affects usability | JSON is machine-readable; markdown is human-readable. May need a `--format` flag. |
| Should the CLI fetch walkthrough data via existing POST endpoints or a new GET endpoint? | Medium — API design | POST for read operations is semantically awkward. A GET endpoint for pre-computed data is more natural for CLI usage. |
| Will developers actually use a CLI walkthrough, or is the real problem walkthrough content quality? | High — existential risk | The diagnosis shows the delivery channel is wrong, but content quality is unmeasured. MVP should ship quickly to test the channel hypothesis. |
| How will the CLI discover which runs have walkthroughs without a listing endpoint? | Medium — UX friction | The CLI currently has no "list runs" command. May need a `--latest` flag or ticket-level walkthrough summary endpoint. |
| Is the 60-second Claude API timeout for walkthrough generation causing incomplete content? | Low for MVP | MVP focuses on delivery channel, not generation quality. Monitor post-launch. |
| What is the quality difference between implementation-agent-produced vs. server-generated walkthroughs? | Unknown | No tagging or comparison data exists for the dual generation paths. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement and brainstorming context | Devs fear "slop" (architectural pattern violations); current walkthrough is "really bad"; CLI alternative proposed |
| scout/scout-summary.md (helix-global-client) | Map client walkthrough surface | 519-line viewer modal, 140-line run-history integration, three distribution channels |
| scout/reference-map.json (helix-global-client) | Detailed facts and unknowns | 45.7% runs have walkthrough data; no usage analytics exist; production 404 observed |
| diagnosis/diagnosis-statement.md (helix-global-client) | Root cause analysis | Five compounding root causes: wrong delivery context, findRunOrThrow bug, 15% empty walkthroughs, no metrics, cluttered UX |
| diagnosis/apl.json (helix-global-client) | Quantified evidence | Zero on-demand requests; zero viewer interactions; findRunOrThrow confirmed as blocker |
| scout/scout-summary.md (helix-global-server) | Map server generation pipeline | Claude Sonnet 4.6 generation, dual paths, JSONB persistence, 596-line service |
| scout/reference-map.json (helix-global-server) | Server facts and unknowns | Input truncation limits, 60s timeout, no tests for walkthrough-service |
| diagnosis/diagnosis-statement.md (helix-global-server) | Server bug details | findRunOrThrow restricts to current run; 15% empty rate; truncation limits quality |
| diagnosis/apl.json (helix-global-server) | Server API surface assessment | Existing endpoints mostly sufficient; GET endpoint would improve CLI UX |
| scout/scout-summary.md (helix-cli) | Map CLI extension surface | 3 commands, HTTP client, env-based ticket resolution; zero walkthrough capability |
| scout/reference-map.json (helix-cli) | CLI patterns and readiness | Comments command is closest analog; HTTP client ready for new API calls |
| diagnosis/diagnosis-statement.md (helix-cli) | CLI feasibility assessment | CLI has right patterns; needs new walkthrough subcommand, minor server additions |
| diagnosis/apl.json (helix-cli) | CLI evidence | Existing patterns reusable; server endpoints partially sufficient |
| repo-guidance.json | Repo intent from diagnosis | Server is definite target; client and CLI were undecided pending product direction |

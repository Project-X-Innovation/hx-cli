# Product: Library Comments and Iteration — helix-cli (Phase 2b)

## Problem Statement

The CLI has no library-related commands. Agents and CLI users cannot discover, view, or interact with library reports or their section-level feedback. When an agent needs to read feedback on a report or post a comment, there is no CLI pathway. SKILL.md — the documentation agents read to discover available capabilities — has no library section, making the feature invisible to automated workflows.

## Product Vision

CLI users and agents can list library items, view reports with annotated section slugs and comment summaries, read detailed feedback grouped by section, and post section ratings with optional text. Agents discover these capabilities through SKILL.md and use them in iterative report improvement workflows.

The CLI (Phase 2b) consumes the server API contract established in Phase 1 to provide a terminal and agent interface for library feedback.

## Users

| User | Primary Need |
|------|-------------|
| **Coding Agents** | Discover feedback on library reports, post comments on changed sections, include feedback context in iterations |
| **CLI Users** | View reports and feedback from the terminal, post ratings without opening the web UI |

## Use Cases

1. **List Library Items**: `hlx library list` shows available reports with ID, title, status, and date.
2. **View Report with Feedback Summary**: `hlx library show <ref>` displays section headings annotated with slugs and comment summaries (e.g., "2 comments: 1 thumbs-up, 1 love").
3. **Read Section Feedback**: `hlx library comments list <ref>` lists all comments grouped by section with ratings, authors, timestamps, and optional text. Supports `--section` filter.
4. **Post Section Rating**: `hlx library comments post <ref> --section <slug> --rating <value> [message]` posts a rating with optional text context.
5. **Agent Iteration Workflow**: Agent runs `hlx library show` to discover sections, reads feedback with `hlx library comments list`, then posts comments on changed sections after generating a new iteration.

## Core Workflow

1. Agent or user runs `hlx library show RSH-439` to see section headings with anchors and feedback counts.
2. Runs `hlx library comments list RSH-439` to read detailed feedback per section.
3. Runs `hlx library comments post RSH-439 --section key-findings --rating love "Expanded with implementation patterns"` to post feedback.

## Essential Features (MVP)

| # | Feature |
|---|---------|
| 1 | `hlx library list` — list library items with ID, title, status, date |
| 2 | `hlx library show <ref>` — show report with section heading slugs and comment summaries |
| 3 | `hlx library comments list <ref>` — list comments grouped by section (supports `--section` filter) |
| 4 | `hlx library comments post <ref> --section <slug> --rating <value> [message]` — post section rating |
| 5 | Multi-format item resolution: cuid, ticket short ID (`RSH-439`), and title substring match |
| 6 | Section targeting: accepts raw slugs (`key-findings`) or heading text (`"Key Findings"`, auto-slugified) |
| 7 | SKILL.md update with all library commands for agent discoverability |
| 8 | Threaded replies via `--reply-to` flag |

## Features Explicitly Out of Scope (MVP)

| Feature | Reason Deferred |
|---------|----------------|
| `--json` output flag | Output formatting layer; add in a future pass |
| Interactive section selection (fzf) | Terminal UI library dependency |
| Comment editing/deletion from CLI | Read and create are the primary agent workflows |
| SSE streaming in terminal | CLI is request-response; real-time is a UI concern |

## Success Criteria

| # | Criterion | How Measured |
|---|-----------|-------------|
| 1 | `hlx library list` shows library items with correct formatting | Command execution |
| 2 | `hlx library show <ref>` displays section slugs and comment summaries | Command execution with a report that has comments |
| 3 | `hlx library comments list <ref>` shows comments grouped by section with ratings and text | Command execution |
| 4 | `hlx library comments post` successfully creates a comment with rating and optional text | POST to server API and confirmation output |
| 5 | Item resolution works for cuid, ticket short ID, and title match | Test with each format |
| 6 | SKILL.md includes all library commands in the Available Commands table | File inspection |
| 7 | `npm run build` (tsc) passes with zero TypeScript errors | CI build |

## Key Design Principles

- **Distinct module**: New `src/library/` module with its own router — don't overload existing `comments` module (different domain, different API, different resolution).
- **Follow established patterns**: Mirror the `comments` module router, `resolve-ticket` utility, and `hxFetch` HTTP client patterns.
- **Agent-first discoverability**: SKILL.md documentation is critical — agents read it to discover available CLI capabilities.
- **Section-slug discoverability**: `hlx library show` annotates headings with `[slug]` so agents can discover valid `--section` values.

## Scope & Constraints

- Depends on Phase 1 (server) API contract being established first.
- No new npm dependencies required.
- Build is TypeScript-only (`tsc`), no bundler. `.js` extension required in imports.
- No `src/library/` directory exists today — all 7 files are new.
- Follows established flag conventions: `--section`, `--rating`, `--reply-to`, positional `<ref>`.

## Future Considerations

- `--json` output flag for machine-readable output
- Interactive section selection for human CLI users
- Comment editing/deletion commands
- `hlx library diff <ref1> <ref2>` for cross-iteration comparison

## Open Questions / Risks

| Question / Risk | Severity | Notes |
|----------------|----------|-------|
| Whether the server's library items API supports querying by ticket short ID | Low | Resolution strategy depends on available API query parameters; may need client-side filtering |
| Whether library item list responses include `content` or only detail responses do | Low | Affects `show` command's ability to display headings without a second API call |
| Exact API response shape for library comments endpoints | Low | CLI depends on Phase 1 server contract; implement after server API is stable |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|-------------|
| ticket.md (Research Report) | Primary specification | 9 CLI implementation steps, command formats, resolution strategies, SKILL.md update |
| scout/scout-summary.md (cli) | Codebase pattern analysis | Router, resolution, flag, and output formatting patterns all established; no library code exists |
| scout/reference-map.json (cli) | Key file identification | 11 files mapped; no library case in dispatcher; flag utilities available |
| diagnosis/diagnosis-statement.md (cli) | Root cause and implementation scope | 7 new files + 2 modified files; greenfield feature |
| repo-guidance.json | Repo intent | CLI confirmed as Phase 2b target consuming server API contract |

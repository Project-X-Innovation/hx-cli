# Product Definition — Library Comments and Iteration

## Problem Statement

The CLI provides no library-related commands. Agents and CLI users cannot discover, view, or interact with library reports or their section-level feedback. SKILL.md — the documentation agents read to discover available capabilities — has no library section, making the feature invisible to automated workflows.

**Run 3 context:** Prior runs implemented all 7 new files and 2 modified files. The CLI is structurally complete. One spec deviation needs a targeted fix: `--rating` is required for all `comments post` invocations, but should be optional when `--reply-to` is present (replies are conversational, not section ratings).

## Product Vision

CLI users and agents can list library items, view reports with annotated section slugs and comment summaries, read detailed feedback grouped by section, and post section ratings with optional text. Agents discover these capabilities through SKILL.md and use them in iterative report improvement workflows.

## Users

| User | Primary Need |
|------|-------------|
| **Coding Agents** | Discover feedback on library reports, post comments on changed sections, include feedback context in iterations |
| **CLI Users** | View reports and feedback from the terminal, post ratings without opening the web UI |

## Use Cases

1. **List Library Items**: `hlx library list` shows available reports with ID, title, status, date.
2. **View Report with Feedback Summary**: `hlx library show <ref>` displays section headings annotated with `[slug]` and comment summaries.
3. **Read Section Feedback**: `hlx library comments list <ref>` lists all comments grouped by section. Supports `--section` filter.
4. **Post Section Rating**: `hlx library comments post <ref> --section <slug> --rating <value> [message]` posts a rating with optional text.
5. **Reply Without Rating**: `hlx library comments post <ref> --section <slug> --reply-to <id> "message"` posts a reply without requiring a rating.
6. **Agent Iteration Workflow**: Agent runs `show` → `comments list` → `comments post` to discover sections, read feedback, and post on changed sections.

## Core Workflow

```
1. hlx library show RSH-439        # See sections with [slug] and feedback counts
2. hlx library comments list RSH-439  # Read detailed per-section feedback
3. hlx library comments post RSH-439 --section key-findings --rating love "Expanded this section"
```

## Essential Features (MVP)

| # | Feature | Status (Run 3) |
|---|---------|----------------|
| 1 | `hlx library list` — library items table | Complete |
| 2 | `hlx library show <ref>` — annotated headings with slugs and summaries | Complete |
| 3 | `hlx library comments list <ref>` — comments grouped by section | Complete |
| 4 | `hlx library comments post <ref>` — post section rating with optional text | Complete — rating optional for replies needed |
| 5 | Multi-format item resolution: cuid, ticket short ID, title substring | Complete |
| 6 | Section targeting: raw slugs or heading text (auto-slugified) | Complete |
| 7 | SKILL.md with Library section for agent discoverability | Complete |
| 8 | Threaded replies via `--reply-to` flag | Complete |

## Features Explicitly Out of Scope (MVP)

| Feature | Why Deferred |
|---------|-------------|
| `--json` output flag | Output formatting layer; future pass |
| Interactive section selection (fzf) | Terminal UI library dependency |
| Comment editing/deletion from CLI | Read and create are the primary agent workflows |
| SSE streaming in terminal | CLI is request-response; real-time is a UI concern |

## Success Criteria

| # | Criterion | How Verified |
|---|-----------|-------------|
| 1 | `hlx library list` shows library items with correct formatting | Command execution |
| 2 | `hlx library show <ref>` displays section slugs and comment summaries | Command with commented report |
| 3 | `hlx library comments list <ref>` shows comments grouped by section | Command execution |
| 4 | `hlx library comments post` creates a comment with rating and optional text | POST + confirmation output |
| 5 | `hlx library comments post --reply-to <id>` works without `--rating` | Reply without rating test |
| 6 | Item resolution works for cuid, ticket short ID, and title match | Test each format |
| 7 | SKILL.md includes all library commands | File inspection |
| 8 | `tsc` (build) passes with zero TypeScript errors | Build gate |

## Key Design Principles

- **Distinct module**: New `src/library/` with own router — separate domain from ticket comments.
- **Follow established patterns**: Mirror comments module router, resolve-ticket utility, hxFetch HTTP client.
- **Agent-first discoverability**: SKILL.md documentation is critical for agent discovery.
- **Section-slug discoverability**: `hlx library show` annotates headings with `[slug]` so agents find valid `--section` values.

## Scope & Constraints

- **Run 3 — targeted fix only**: All files exist. One fix: make `--rating` optional when `--reply-to` is present.
- **No new dependencies**: TypeScript-only build (`tsc`), `.js` extension in imports.
- **Rating values**: thumbs-up/up, thumbs-down/down, love — stored as THUMBS_UP, THUMBS_DOWN, LOVE.
- **LOVE label unchanged**: CLI still uses `love` as the rating flag value; user-facing icon change is client-side only.

### CLI-Specific Fix Scope

| Fix | Location | What Changes |
|-----|----------|-------------|
| Rating optional for replies | comments-post.ts:29 | Use `getFlag` (optional) instead of `requireFlag` (mandatory) when `--reply-to` is present |

## Future Considerations

- `--json` output flag for machine-readable output
- Interactive section selection for human CLI users
- Comment editing/deletion commands
- `hlx library diff <ref1> <ref2>` for cross-iteration comparison

## Open Questions / Risks

| Question / Risk | Status |
|----------------|--------|
| Whether SKILL.md description needs updating given LOVE display changes from heart to double thumbs up | Low — CLI uses "love" as flag value; display is client concern |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (research report) | Primary specification for Phase 2b | 9 CLI steps, command formats, resolution strategies, SKILL.md |
| ticket.md (discussion) | User feedback from prior runs | Known gaps, icon change request |
| scout/scout-summary.md (CLI) | Current implementation state | All 9 files complete; rating optionality is the only gap |
| scout/reference-map.json (CLI) | File-level details | requireFlag vs getFlag for --rating when --reply-to present |
| diagnosis/diagnosis-statement.md (CLI) | Root cause analysis | Single fix: conditional flag requirement |
| repo-guidance.json | Repo roles | CLI is target with 1 fix |

# Product: Library Comments and Iteration (helix-cli)

## Problem Statement

Library reports are static, read-only markdown artifacts. Once generated and published, there is no mechanism for users to provide section-level feedback, rate individual sections, or collaborate with teammates on specific parts of a report. The only way to discuss a report is through the originating ticket's discussion thread, which is disconnected from the report content itself.

For CLI users and coding agents, there is no way to list library items, view report contents with section annotations, or post/list section-level comments from the terminal. Agents reading SKILL.md have no knowledge that library commands exist.

## Product Vision

**Comments are the primary iteration mechanism.** The CLI enables agents and power users to interact with library feedback from the terminal: discover reports, view section annotations with comment counts, and post structured feedback. This is critical for the agent-driven iteration loop -- agents read previous comments via `hlx library comments list` and post feedback on changed sections via `hlx library comments post`.

## Users

| User | Primary Need |
|------|-------------|
| **Coding Agents** | Read structured feedback as context for next iteration; post comments programmatically |
| **Power Users / Developers** | Interact with library feedback from terminal; quick scripting and automation |

## Use Cases

1. **Agent discovers sections**: Agent runs `hlx library show RSH-439` to see report headings with section slugs and comment counts, identifying which sections have feedback.
2. **Agent reads feedback**: Agent runs `hlx library comments list RSH-439` to read all section-level comments grouped by anchor, understanding what reviewers want changed.
3. **Agent posts feedback**: After generating a new iteration, agent runs `hlx library comments post RSH-439-v2 --section key-findings --rating love "Rewrote based on feedback"` to explain what changed.
4. **User lists library items**: User runs `hlx library list` to see all available library items with their titles and versions.
5. **Scripted review**: Power user writes a shell script to iterate over sections and post batch feedback.

## Core Workflow

**Agent iteration loop:**
1. `hlx library show <ref>` -- discover sections and feedback status
2. `hlx library comments list <ref>` -- read detailed feedback
3. (Agent generates new iteration based on feedback)
4. `hlx library comments post <ref> --section <slug> --rating <value> [message]` -- post feedback on changed sections

## Essential Features (MVP)

| # | Feature | CLI Scope |
|---|---------|----------|
| 1 | `hlx library list` | List library items with titles, versions, short IDs |
| 2 | `hlx library show <ref>` | Display report with section annotations (heading slugs, comment counts) |
| 3 | `hlx library comments list <ref>` | List comments grouped by section, with `--section <slug>` filter |
| 4 | `hlx library comments post <ref>` | Post rating + optional text with `--section <slug>` and `--rating <value>` flags |
| 5 | Library item resolution | Accept cuid, ticket short ID (RSH-439), or title substring as `<ref>` |
| 6 | Section targeting | `--section` flag accepts raw slugs or heading text (auto-slugified) |
| 7 | Rating flag | `--rating thumbs-up|love|thumbs-down` maps to server enum values |
| 8 | SKILL.md update | Library section documenting all commands for agent discoverability |

## Features Explicitly Out of Scope (MVP)

| Feature | Why Deferred |
|---------|-------------|
| `--json` output flag | Output formatting enhancement; not needed for MVP |
| Interactive section selection (fzf-style) | Terminal UI library dependency |
| Comment editing/deletion from CLI | PATCH/DELETE can be added later |
| Reply threading from CLI | Post-only for MVP; reading threads is supported |
| Rich output formatting (colors, tables) | Enhancement beyond MVP |

## Success Criteria

| # | Criterion |
|---|-----------|
| 1 | `hlx library list` returns available library items with titles and short IDs |
| 2 | `hlx library show <ref>` displays report headings with section slug annotations and comment counts |
| 3 | `hlx library comments list <ref>` shows comments grouped by section with ratings, authors, and text |
| 4 | `hlx library comments post <ref> --section <slug> --rating <value> [message]` posts a comment successfully |
| 5 | Item resolution works with cuid, ticket short ID, and title substring |
| 6 | `--section "Key Findings"` auto-slugifies to `key-findings` |
| 7 | SKILL.md includes Library section with all four commands and agent workflow example |
| 8 | `tsc` builds successfully |

## Key Design Principles

- **Separate module, not extension**: `src/library/` is its own module, not an extension of `src/comments/`. Library comments have different API endpoints, resolution, and interaction patterns.
- **Follow established patterns**: Module router, command files, resolution utility, and flag parsing all follow the exact patterns established by the existing `comments` module and `resolve-ticket.ts`.
- **Agent discoverability**: SKILL.md update is critical. Agents read SKILL.md to understand available CLI capabilities. Without it, library commands are invisible to agents.
- **Flexible item resolution**: Three strategies (cuid, short ID, title match) make commands usable in scripts, interactive sessions, and agent workflows.

## Scope & Constraints

- CLI is Phase 2b; depends on server API contract from Phase 1 (runs in parallel with client).
- No new npm dependencies needed.
- Build must pass: `tsc`.
- Follows switch-based routing in src/index.ts (add 'library' case).
- Uses existing shared utilities: hxFetch (HTTP client), getFlag (flag parsing), loadConfig (config).
- 4 commands across ~7 new files + 2 modified files (index.ts, SKILL.md).

## Future Considerations

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| `--json` output flag | Medium | Enables pipeline integration and structured scripting |
| Comment editing/deletion | Medium | PATCH/DELETE CLI commands |
| Interactive section picker | Low | fzf-style selection from available sections |
| Reply threading | Low | Post replies to existing comments |
| Rich terminal formatting | Low | Colors, tables, progress indicators |

## Open Questions / Risks

| Item | Type | Notes |
|------|------|-------|
| Library list endpoint data sufficiency for resolution | Question | Whether GET /library/items returns enough data for short ID-based resolution (needs ticket shortId mapping) |
| `hlx library show` output format | Question | Whether it fetches full report markdown or just metadata with headings |
| Section annotation rendering in terminal | Question | Whether annotations appear inline in markdown output or as a separate summary |
| Server API availability during parallel development | Risk (Low) | API contract is defined by research report; CLI can be developed against that contract |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (cli) | Problem statement | Implementation ticket for RSH-443 research |
| scout/scout-summary.md (cli) | Analysis synthesis | Comments module as pattern template; resolve-ticket.ts as resolution template; SKILL.md update needed |
| scout/reference-map.json (cli) | File inventory and facts | 10 files; switch-based routing; no src/library/ exists; --section/--rating flags |
| diagnosis/diagnosis-statement.md (cli) | Root cause and success criteria | 4 gaps (router, module, resolution, docs); established patterns for all components |
| diagnosis/apl.json (cli) | Diagnostic questions and answers | Item resolution strategy; SKILL.md update scope |
| RSH-443 research report (report.md) | Primary specification | CLI commands, item resolution, section targeting, agent workflow, SKILL.md content |
| repo-guidance.json | Repo intent | CLI is Phase 2b target; parallel with client; depends on server API contract |

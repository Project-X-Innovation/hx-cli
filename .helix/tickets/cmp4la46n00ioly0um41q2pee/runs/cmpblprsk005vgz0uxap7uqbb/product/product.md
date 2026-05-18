# Product Definition — Library Comments and Iteration (Conflict Resolution)

## Problem Statement

A staging refresh introduced a merge conflict in `src/tickets/index.ts` between the ticket branch's library CLI integration (4 commits) and staging's concurrent ticket command updates (1 commit). The Library CLI module — `hlx library list`, `show`, `comments list`, `comments post` — is fully implemented from prior runs. The conflict has been pre-resolved — no markers remain.

## Product Vision

The CLI provides agent and power-user access to library report feedback. Agents discover sections via `hlx library show`, read grouped feedback via `hlx library comments list`, and post ratings via `hlx library comments post`. SKILL.md documents all commands for agent discoverability.

**This run's focus:** Verify the merge resolution in `tickets/index.ts` preserved both the ticket's library command dispatch and staging's ticket command updates.

## Users

| User | Primary Need |
|------|-------------|
| **Coding Agents** | Discover sections, read feedback, post ratings via CLI commands |
| **Power Users** | Script-friendly access to library report feedback |

## Use Cases

1. **List Reports** — `hlx library list` shows library items with status, title, date.
2. **Show Report** — `hlx library show <ref>` annotates headings with `[slug]` and comment summaries.
3. **List Comments** — `hlx library comments list <ref> [--section <slug>]` shows section-grouped feedback.
4. **Post Comment** — `hlx library comments post <ref> --section <slug> --rating <value> [message]`.

## Core Workflow

```
Agent:
  1. hlx library show RSH-439          → sections with [slug] annotations + rating summaries
  2. hlx library comments list RSH-439  → section-grouped feedback with comment IDs
  3. hlx library comments post RSH-439 --section key-findings --rating thumbs-up "Expand this"

Resolution: <ref> supports cuid, ticket short ID (RSH-439), or title match.
Section: --section accepts raw slugs or heading text (auto-slugified).
```

## Essential Features (MVP)

| # | Feature |
|---|---------|
| 1 | `hlx library list` — list library items |
| 2 | `hlx library show <ref>` — annotated report view |
| 3 | `hlx library comments list <ref>` — section-grouped comments |
| 4 | `hlx library comments post <ref>` — post rating + optional text |
| 5 | Multi-format item resolution (cuid, short ID, title) |
| 6 | `hlx library` in main `hlx --help` output |
| 7 | SKILL.md Library section for agent discoverability |

### This Run: Conflict Resolution Scope

| Conflicted File | Ticket Side | Staging Side |
|----------------|-------------|--------------|
| `src/tickets/index.ts` | Library CLI integration + ticket lookup (4 commits) | Ticket command updates (1 commit: 6a4215c) |

Pre-resolved. No new features — merge integrity verification only.

## Features Explicitly Out of Scope (MVP)

| Feature | Why Deferred |
|---------|-------------|
| `--json` output flag | Output formatting layer |
| Interactive section selection (fzf) | Terminal UI library needed |
| Comment edit/delete CLI commands | MVP covers list + post |

## Success Criteria

| # | Criterion | How Verified |
|---|-----------|-------------|
| 1 | Zero conflict markers in `tickets/index.ts` | Grep (verified by diagnosis) |
| 2 | All 10 ticket subcommand imports preserved | File inspection (verified) |
| 3 | Library case registered in `src/index.ts` | File inspection (line ~98-100, verified) |
| 4 | `npm run build` passes (tsc) | Build gate |
| 5 | All 6 library command files present in `src/library/` | File existence check (verified by scout) |

## Key Design Principles

- **Preserve both intents**: Staging ticket command updates and ticket library integration must coexist.
- **Minimal touch**: Only `tickets/index.ts` is in scope.
- **Build is the gate**: TypeScript compilation is the primary verification.

## Scope & Constraints

- **Conflict resolution only** — no new features or refactoring.
- **One conflicted file** — `tickets/index.ts` per `.helix/merge-conflicts.json`.
- **Pre-resolved** — zero conflict markers confirmed by diagnosis.

## Future Considerations

| Enhancement | Priority |
|-------------|----------|
| `--json` CLI output flag | Medium |
| Comment edit/delete commands | Medium |
| Interactive section selection | Low |

## Open Questions / Risks

| Question / Risk | Status |
|----------------|--------|
| Resolved `tickets/index.ts` preserves all staging ticket command updates | Verified clean; build pending |
| All 10 subcommand handler imports intact | Verified by scout (150 lines, standard dispatcher) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (research report) | CLI Phase 2b spec | 6 library files, resolution utility, SKILL.md |
| `.helix/merge-conflicts.json` | Conflict scope | 1 file: tickets/index.ts, 4 ticket + 1 staging commits |
| `scout/scout-summary.md` | File state and conflict sweep | 150-line dispatcher clean; all 6 library files present |
| `scout/reference-map.json` | File inventory | All library CLI files confirmed |
| `diagnosis/diagnosis-statement.md` | Conflict analysis | Pre-resolved; all subcommand imports preserved |
| `repo-guidance.json` (client) | Repo intent | All 3 repos target for build verification |

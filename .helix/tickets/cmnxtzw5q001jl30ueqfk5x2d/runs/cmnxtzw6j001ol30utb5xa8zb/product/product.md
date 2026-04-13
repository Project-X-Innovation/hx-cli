# Product: CLI Artifact Access Gap (RSH-218 — helix-cli)

## Problem Statement

The Helix CLI (`hlx`) has no artifact-related commands. Users who need to access run artifacts — listing, viewing, or downloading step outputs like `product.md`, `scout-summary.md`, or `implementation-plan.md` — must use the web UI exclusively. This creates a GitHub dependency for artifact browsing (via committed `.helix/` folders) or forces sole reliance on the web UI's blob viewer for non-GitHub orgs.

## Product Vision

CLI users can list and retrieve artifacts for any ticket run directly from the command line, with the same content scope available in the web UI, regardless of whether artifacts are stored in GitHub or Vercel Blob.

## Users

| User | Impact |
|---|---|
| **Developers using CLI workflow** | Cannot access artifacts without switching to web UI or navigating GitHub branches manually |
| **Non-GitHub org members** | No alternative to web UI for artifact access; GitHub browse fallback unavailable |
| **CI/automation scripts** | Cannot programmatically retrieve artifacts for downstream processing |

## Use Cases

1. **Developer lists artifacts for a run**: `hlx artifacts list --ticket <id> --run <id>` shows available step artifacts grouped by step and repo.
2. **Developer views artifact content**: `hlx artifacts get --ticket <id> --run <id> --step <stepId> --file <filename>` prints artifact content to stdout.
3. **Developer downloads artifacts**: `hlx artifacts download --ticket <id> --run <id>` saves all artifacts to a local directory.

## Core Workflow

Current: User opens web UI > navigates to ticket > selects run > clicks "View Artifacts" or "Open" (GitHub link) to see step artifacts.

Desired: User runs `hlx artifacts list|get|download` from terminal to access the same content.

## Essential Features (MVP)

1. **`hlx artifacts list`**: List all available step artifacts for a ticket run (step name, repo key, file names).
2. **`hlx artifacts get`**: Retrieve and display a single artifact file's content.

## Features Explicitly Out of Scope (MVP)

1. **Bulk download to local directory**: Nice-to-have but not essential for initial CLI access.
2. **Cross-ticket artifact search**: No backend support exists yet; out of scope for CLI as well.
3. **Artifact upload via CLI**: Artifact production is agent-managed, not user-initiated.
4. **Offline/cached artifact access**: CLI should call the server API; no local caching layer.

## Success Criteria

| # | Criterion | Measurement |
|---|---|---|
| 1 | `hlx artifacts list` returns step artifacts for a given ticket+run | Command output matches web UI artifact entries |
| 2 | `hlx artifacts get` retrieves artifact file content from blob or GitHub | Content matches what ArtifactViewer modal displays |
| 3 | Both commands work for GitHub-commit and blob-only orgs | Tested against orgs with `commitArtifactsToGithub` true and false |

## Key Design Principles

- **Reuse existing APIs**: The server already exposes `/tickets/:id/runs/:runId/step-artifacts/:stepId` — CLI should consume these, not create new endpoints.
- **Consistent CLI patterns**: Follow existing `hlx inspect` and `hlx comments` command patterns for argument structure and output formatting.
- **Stdout-friendly output**: Artifact content should be printable and pipeable.

## Scope & Constraints

- **Research ticket**: RSH-218 identifies this gap. Implementation is deferred to a follow-up ticket.
- **Server API dependency**: CLI artifact commands require the existing step-artifacts API, which already supports both GitHub and blob retrieval with ancestor fallback.
- **Authentication**: Must use existing `hlx login` auth flow.

## Future Considerations

- **`hlx artifacts download`**: Bulk download all artifacts for a run to a local directory.
- **Cross-ticket artifact search**: `hlx artifacts search --query <term>` once backend support exists.
- **Artifact diff**: Compare artifacts between two runs of the same ticket.

## Open Questions / Risks

| # | Question/Risk | Status |
|---|---|---|
| 1 | Should CLI artifact commands be part of this research ticket or a separate implementation ticket? | Decision needed |
| 2 | Does the existing step-artifacts API return all needed data, or does CLI need a new list endpoint? | Needs API inspection |
| 3 | How should CLI handle large artifact files (e.g., reference-map.json)? Pagination or streaming? | Design decision |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md (helix-cli) | Read ticket scope | Ticket asks to evaluate CLI support for direct artifact access without GitHub dependency |
| scout/scout-summary.md (helix-global-server) | CLI gap analysis | CLI has only inspect, comments, and login commands — no artifact commands exist |
| diagnosis/diagnosis-statement.md (helix-global-server) | Root cause: CLI gap confirmed | Absence of CLI artifact commands documented as Gap 2 |
| diagnosis/apl.json (helix-global-server) | CLI-specific investigation answer | Confirmed no artifact-related files in helix-cli/src/ |
| repo-guidance.json (helix-global-client) | Repo intent classification | CLI classified as target for artifact access feature |

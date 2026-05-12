# Product — BLD-427

## Problem Statement

When `hlx tickets artifacts <ticket-ref>` returns no results (common for tickets in DEPLOYED, UNVERIFIED, or FAILED statuses), the command prints only "No artifacts found." and "No step artifacts found." with no further guidance. Users who want to retrieve specific step artifacts need a run ID to use the fallback command `hlx tickets artifact --run <runId> --step <stepId> --repo <repoKey>`, but the CLI never tells them what that run ID is. Users are left to find the run ID through other means, adding friction to a routine debugging workflow.

## Product Vision

Close the information gap in the empty-result path of `hlx tickets artifacts` so users can immediately act on the available fallback command without leaving the terminal or consulting other tools.

## Users

CLI users of `hlx tickets artifacts` who encounter empty results and need to fall back to per-step artifact retrieval. These are developers and operators debugging ticket workflows.

## Use Cases

1. **Empty result with implicit run**: User runs `hlx tickets artifacts BLD-123`. The server returns no artifacts (e.g., ticket is in DEPLOYED status). The CLI prints the latest run ID and a follow-up command template so the user can immediately query specific step artifacts.

2. **Empty result with explicit --run**: User runs `hlx tickets artifacts BLD-123 --run <someRunId>`. The server returns no artifacts. The CLI prints the exact run ID the user supplied (not a different one) and the same follow-up command template.

3. **Ticket with no runs**: User runs `hlx tickets artifacts` against a ticket that has never had a run. The CLI prints a clear "no runs available" message without a follow-up suggestion (since there is nothing to query).

4. **Run-ID lookup failure**: User runs `hlx tickets artifacts BLD-123` without `--run`, and the extra request to resolve the run ID fails. The CLI prints "No artifacts found." with a note that the run ID could not be resolved. No crash, no retry, exit 0.

5. **Success path (no change)**: User runs `hlx tickets artifacts` and the server returns artifacts or step-artifact summaries. Output is identical to current behavior.

## Core Workflow

1. User invokes `hlx tickets artifacts <ticket-ref> [--run <runId>]`.
2. CLI calls the server's `/tickets/:id/artifacts` endpoint.
3. **If artifacts or step-artifact summaries are returned** -> display them (unchanged).
4. **If both are empty**:
   - Determine the run ID: use the user-supplied `--run` value if present, otherwise resolve via the ticket's current/latest run.
   - Print the run ID and a one-line follow-up command suggestion.
   - Edge cases: no runs -> "no runs available" message; resolution failure -> graceful note.

## Essential Features (MVP)

| # | Feature | Rationale |
|---|---------|-----------|
| 1 | Print run ID in empty-result output | Users need the run ID to use the step-artifact fallback command. |
| 2 | Print follow-up command suggestion | Reduces friction by giving users the exact command template to run next. |
| 3 | Honor user-supplied `--run` exactly | When the user specifies a run, the echoed run ID must match — no substitution. |
| 4 | Resolve latest run ID when `--run` is omitted | The CLI must fetch the ticket's current run so the suggestion is actionable. |
| 5 | "No runs available" message for zero-run tickets | Prevents a misleading suggestion when no runs exist. |
| 6 | Graceful degradation on resolution failure | Exit 0, print "No artifacts found." plus a note. No crash, no retry. |

## Features Explicitly Out of Scope (MVP)

- Adding `--json` output mode to `hlx tickets artifacts`.
- Changing the server-side `/tickets/:id/artifacts` endpoint or its eligibility rules.
- Modifying the `hlx tickets artifact` (singular) command or other ticket subcommands.
- Restructuring the success-path output of `hlx tickets artifacts`.

## Success Criteria

1. **Empty response shows run ID and suggestion**: For a ticket whose artifacts response is empty, the command prints the latest run ID and a one-line follow-up command of the form `hlx tickets artifact <ticket-ref> --run <runId> --step <stepId> --repo <repoKey>`.
2. **Explicit --run is echoed exactly**: When `--run <runId>` is supplied and the response is empty, the printed run ID is the exact value the user supplied.
3. **Success path is unchanged**: When artifacts or step-artifact summaries are returned, output is byte-identical to current behavior.
4. **Zero-runs ticket handled**: For a ticket with no runs, the command prints a "no runs available" message with no follow-up suggestion.
5. **Graceful failure on lookup error**: When run-ID resolution fails, the command exits 0, prints "No artifacts found." and a single line noting the run ID could not be resolved.

## Key Design Principles

- **Smallest correct change**: Only the empty-result branch changes; everything else remains untouched.
- **Consistency**: Follow the same run-ID resolution pattern already used by sibling commands (`artifact.ts`, `bundle.ts`).
- **Fail-safe**: Never crash or exit non-zero due to an informational enhancement.
- **No server coupling**: This is purely a CLI presentation change — no server behavior depends on it.

## Scope & Constraints

- **Single repo**: helix-cli only. No server or other repo changes.
- **Single file primary target**: `src/tickets/artifacts.ts` — the `cmdTicketsArtifacts()` function.
- **Non-negotiable invariant**: User-supplied `--run` value must never be substituted with a different run ID.
- **Existing behavior preserved**: The success path and the existing follow-up suggestion (line 43, shown when `stepArtifactSummary` is non-empty) are not modified.

## Future Considerations

- The run-ID resolution pattern is duplicated across `artifact.ts`, `bundle.ts`, and now `artifacts.ts`. A future ticket could extract it into a shared utility.
- A `--json` output mode for `hlx tickets artifacts` may be added later.
- The server endpoint may eventually return artifact summaries for more ticket statuses, which would reduce how often users hit the empty-result path.

## Open Questions / Risks

| # | Item | Type | Notes |
|---|------|------|-------|
| 1 | ArtifactsResponse may not include a runId field | Technical unknown | Scout/diagnosis confirmed the typed response has no `runId` — an extra request to resolve it is expected when `--run` is omitted. |
| 2 | Follow-up suggestion uses placeholder tokens | Design question | The existing pattern (line 43 of artifacts.ts) uses `<ticket-id>`, `<stepId>`, `<repoKey>` as placeholders. The new suggestion should follow the same convention, with only the run ID as a concrete resolved value. |
| 3 | No existing tests for `src/tickets/` commands | Test coverage risk | No tests exist for `cmdTicketsArtifacts`. Depending on implementation approach, test coverage may remain a gap. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | 5 acceptance criteria, non-negotiable invariants (user-supplied --run echoed exactly), failure behavior (exit 0), and explicit scope boundaries (empty-result branch only, CLI-only). |
| scout/scout-summary.md | Synthesized code analysis | Identified `src/tickets/artifacts.ts` as primary target, confirmed run-ID resolution pattern in two sibling files, surfaced that `rawRef` is not passed to `cmdTicketsArtifacts`, and noted test coverage gap. |
| scout/reference-map.json | Detailed file + line inventory | Line-level anchors for empty-result branches (L34-35, L44-45), run-ID resolution pattern (artifact.ts L29-40, bundle.ts L33-39), and router dispatch (index.ts L119). Confirmed ArtifactsResponse has no runId field. |
| diagnosis/diagnosis-statement.md | Root cause and change scope | Confirmed root cause is a missing code path in artifacts.ts; single-file change with combined empty check, run-ID resolution reusing established pattern, and try/catch for graceful failure. |
| diagnosis/apl.json | Diagnostic questions and answers | Validated that no signature change is needed, hxFetch throws on failure requiring try/catch, and follow-up suggestion should use placeholder tokens with only runId resolved. |
| repo-guidance.json | Repo intent context | Confirmed helix-cli is the sole target repo for this CLI-only change. |

# Product: Add --run Selection to `hlx tickets artifacts` and Harden Missing Artifact Errors

## Problem Statement

Users inspecting ticket artifacts through the helix-cli encounter two friction points:

1. **Cannot scope artifact summaries by run**: `hlx tickets artifacts <ticket-id> --run <runId>` silently ignores the `--run` flag, returning the default (often empty) summary. The server already supports run-scoped artifact summaries via a `runId` query parameter, but the CLI never sends it.

2. **Noisy failures on missing step artifacts**: `hlx tickets artifact <ticket-id> --step <step> --repo <repo>` for a non-existent artifact produces a raw HTTP 404 error message and may trigger a Node assertion failure, instead of showing a clear "not found" message.

Both issues degrade the artifact discovery workflow and cause confusion, especially when a ticket has multiple runs or when users explore which steps have completed.

## Product Vision

Make artifact inspection reliable and intuitive: users can target specific runs when listing artifacts, and missing artifacts produce clear, actionable feedback rather than cryptic errors.

## Users

- **Helix CLI users** (developers, operators) who inspect ticket workflow artifacts to understand run status, review outputs, or debug issues.

## Use Cases

1. **Run-scoped artifact listing**: A user wants to see artifact summaries for a specific run of a ticket (e.g., to compare outputs across retries). They pass `--run <runId>` and expect the CLI to return only artifacts from that run.

2. **Exploring step artifacts**: A user requests a specific step artifact that does not exist yet (e.g., a step that hasn't run). They expect a clean error message telling them the artifact was not found, not a raw HTTP dump or Node crash.

3. **Default artifact listing**: A user runs `hlx tickets artifacts <ticket-id>` without `--run` and expects the current default behavior to remain unchanged.

## Core Workflow

1. User runs `hlx tickets artifacts <ticket-id>` (optionally with `--run <runId>`).
2. CLI forwards the request to the server, including `runId` as a query parameter when provided.
3. Server returns artifact summaries (scoped to the run if specified).
4. CLI displays the results.

For single-artifact fetch:
1. User runs `hlx tickets artifact <ticket-id> --step <step> --repo <repo> [--run <runId>]`.
2. If the artifact exists, CLI displays it.
3. If the artifact does not exist (404), CLI prints a clear human-readable message (e.g., "No artifact found for step X in repo Y") and exits with code 1.

## Essential Features (MVP)

| # | Feature | User Value |
|---|---------|------------|
| 1 | `--run <runId>` flag on `hlx tickets artifacts` | Users can retrieve artifact summaries for a specific run |
| 2 | Forward `runId` as query parameter to the server endpoint | Enables run-scoped results from the existing server API |
| 3 | Updated usage/help text showing `--run` for `artifacts` subcommand | Users discover the option without consulting external docs |
| 4 | Graceful 404 handling on `hlx tickets artifact` | Missing artifacts produce a clean, human-readable error instead of raw HTTP text or Node crashes |

## Features Explicitly Out of Scope (MVP)

- **Changes to the server artifact endpoint**: The server already supports `runId`; only the CLI needs updating.
- **Automatic run selection / run discovery**: If `--run` is omitted from `artifacts`, behavior stays as-is (server default). No auto-resolve logic is added.
- **Updating `bundle.ts`**: Although `bundle.ts` also calls the artifacts endpoint without `runId`, the ticket does not scope it in and it is a separate workflow concern.
- **Changes to the global error handler** (`src/index.ts`): Error hardening is scoped to the `artifact` command call site, not a global behavior change.
- **New tests or CI pipelines**: The repository has no existing test infrastructure; introducing it is a separate effort.

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `hlx tickets artifacts <ticket-id> --run <runId>` sends `runId` as a query parameter to the server and returns run-scoped results | Observe the HTTP request includes the query parameter; server responds with run-specific data |
| 2 | `hlx tickets artifacts <ticket-id>` (without `--run`) continues to work as before | Default behavior unchanged |
| 3 | `hlx tickets artifact` for a missing artifact shows a clean, human-readable error and exits with code 1 | No raw HTTP error text, no Node assertion failure in output |
| 4 | Usage text for `hlx tickets artifacts` includes `[--run <runId>]` | Visible in CLI help output |
| 5 | `tsc --noEmit` passes with no type errors | Build gate remains green |

## Key Design Principles

- **Follow existing patterns**: Both the `--run` flag support and error handling have established patterns in sibling commands (`artifact.ts` and `bundle.ts`). The fix should mirror them rather than inventing new approaches.
- **Minimal surface change**: Only touch the three files identified in diagnosis. No architectural changes needed.
- **User-facing clarity**: Error messages should name what was not found (step, repo) so the user knows exactly what to adjust.

## Scope & Constraints

- **Single repository**: All changes are in `helix-cli`. No server or cross-repo changes needed.
- **Three files changed**: `src/tickets/artifacts.ts`, `src/tickets/index.ts`, `src/tickets/artifact.ts`.
- **No runtime dependencies added**: The fix uses existing utilities (`getFlag`, `hxFetch` `queryParams`).
- **No test infrastructure**: The repo has no tests, CI, or lint config. Verification relies on typecheck and manual testing.
- **Server query parameter name**: The ticket states the server supports `runId` as a query parameter. This is assumed correct but not independently verified from CLI source.

## Future Considerations

- **Run-scoped support for `bundle.ts`**: `bundle.ts` also calls the artifacts endpoint without `runId` (line 43). A future ticket could add `--run` there for consistency.
- **Automatic run fallback on `artifacts`**: If `--run` is absent, the CLI could auto-resolve to the latest run (as `artifact.ts` does for single-artifact fetch). This is not in scope for this ticket.
- **Structured error types in `hxFetch`**: The current throw-on-error approach makes it hard to distinguish expected 404s from unexpected failures. A future improvement could introduce typed error classes or status-aware return values.
- **Test infrastructure**: Adding tests for CLI commands would catch regressions in flag forwarding and error handling.

## Open Questions / Risks

| # | Question / Risk | Impact | Mitigation |
|---|----------------|--------|------------|
| 1 | Exact server query parameter name (`runId` vs `run`) is not verified from CLI source | Wrong name would silently return unfiltered results | Confirm with server endpoint documentation or test against live API |
| 2 | Root cause of Node assertion failure on 404 is not fully determined from static analysis | Fix may address the symptom (raw error propagation) without resolving the underlying assertion | The try-catch approach prevents the error from reaching the global handler, which should eliminate the assertion trigger regardless of exact cause |
| 3 | No test infrastructure to verify changes automatically | Regressions could be introduced without detection | Typecheck (`tsc --noEmit`) catches type-level issues; manual testing covers runtime behavior |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and requirements | Two defects: missing --run on `artifacts`, noisy 404 on `artifact` |
| scout/scout-summary.md | File-level analysis and established patterns | Identified all change surfaces, reference patterns in sibling commands, and build gates |
| scout/reference-map.json | Detailed evidence with line-level citations | Confirmed function signatures, missing args forwarding, and exact error propagation path |
| diagnosis/diagnosis-statement.md | Root cause analysis and success criteria | Confirmed three-file change scope, two independent defects, and verification criteria |
| diagnosis/apl.json | Structured diagnosis with evidence chains | Validated root causes with line-level evidence; surfaced unknowns about 404 assertion mechanism and query param name |
| repo-guidance.json | Repository role classification | Confirmed helix-cli is the sole change target |

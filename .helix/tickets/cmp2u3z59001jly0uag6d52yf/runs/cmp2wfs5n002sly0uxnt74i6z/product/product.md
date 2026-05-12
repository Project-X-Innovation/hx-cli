# Product: Harden Ignored-Path Staging and Clean helix-cli Tracked Dependencies

## Problem Statement

Helix ticket runs against `helix-cli` consistently fail at the implementation commit phase with `git add changes for implementation failed`. The server-side staging logic collects all tracked modified files—including those matching `.gitignore`—then passes them to `git add`, which rejects ignored paths. Simultaneously, `helix-cli` has `node_modules` tracked in the Git index on remote branches despite a correct `.gitignore` rule. Neither issue alone is the full problem: the server is brittle to any repo with legacy tracked-ignored files, and the CLI repo has legacy state that triggers that brittleness.

## Product Vision

Make the Helix implementation commit phase resilient to repos with legacy tracked-ignored files, while cleaning the known offender (`helix-cli`) so both the systemic and immediate causes are resolved.

## Users

| User | Impact |
|------|--------|
| **Helix automated workflow** | Cannot complete ticket runs against `helix-cli`; the implementation commit step aborts on every attempt. |
| **Internal developers using Helix** | Ticket runs against `helix-cli` fail repeatedly, requiring manual investigation and blocking automated code changes. |
| **Future repos with legacy tracked-ignored files** | Any repo that ends up with tracked-ignored paths would trigger the same failure without the server-side fix. |

## Use Cases

1. **Primary**: A Helix ticket run against any repo (including `helix-cli`) completes the implementation commit phase without failing due to tracked-but-ignored paths in the staging list.
2. **Secondary**: If a repo has legacy tracked-ignored files, the staging logic silently excludes those paths and stages only valid committable files.
3. **Edge case**: If the staging logic cannot reliably determine which tracked paths match ignore rules, the run fails with an explicit error rather than staging an unsafe path set.

## Core Workflow

1. Helix workflow runs a ticket against a target repo (e.g. `helix-cli`).
2. The implementation agent produces code changes.
3. The commit phase collects modified tracked files and new untracked files.
4. **[New behavior]** Before staging, tracked files that match Git ignore rules are identified and excluded from the staging path list.
5. `git add` runs against only the clean, committable path set.
6. `.helix` artifacts continue to be staged separately with force-add, unchanged.
7. The commit completes successfully.

## Essential Features (MVP)

1. **Generic tracked-ignored-path filter** in the server-side staging logic — excludes any tracked file matching Git ignore rules from the `git add` pathspec, not limited to `node_modules`.
2. **Regression test coverage** proving that tracked-ignored paths are excluded while normal tracked and untracked source files still stage correctly.
3. **helix-cli index cleanup** — `node_modules` removed from the Git index on all active Helix base branches.
4. **helix-cli .gitignore verification** — `node_modules/` ignore rule confirmed present after cleanup.

## Features Explicitly Out of Scope (MVP)

- Broad Git history rewriting across unrelated branches in `helix-cli` or other repos.
- General dependency-management refactors in `helix-cli`.
- Workflow or ticket-orchestration changes outside the staging failure path.
- Force-adding ignored files as a workaround.
- Special-casing `node_modules` by name in the server logic.

## Success Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| 1 | Server staging logic excludes tracked-ignored paths generically without regressing normal file staging or `.helix` artifact handling. | Regression test + code review |
| 2 | Server has new test coverage for the tracked-ignored-path exclusion case. | Test execution |
| 3 | `helix-cli` no longer has `node_modules` tracked on active Helix ticket base branches. | Git index inspection per branch |
| 4 | `helix-cli/.gitignore` explicitly ignores `node_modules/`. | File content check |
| 5 | A previously failing `helix-cli` ticket run completes the implementation commit phase. | End-to-end rerun or continuation |
| 6 | No force-add of ignored files; no `node_modules`-specific string matching in the fix. | Code review |

## Key Design Principles

- **Fail closed on real errors, not on ignored paths**: The commit phase must still abort on genuine Git failures but must not treat tracked-ignored paths as a fatal staging error.
- **Generic, not special-cased**: The filter must work for any tracked-ignored path, not just the currently observed `node_modules`.
- **Preserve `.helix` artifact handling**: The existing force-add behavior for `.helix` paths is a separate concern and must not be affected.
- **Both halves required**: Server hardening alone leaves `helix-cli` with dirty tracked state; CLI cleanup alone leaves the server brittle for future occurrences.

## Scope & Constraints

- **Two repos, one ticket**: `helix-global-server` (code change + tests) and `helix-cli` (Git index cleanup + `.gitignore` verification). Both must be completed together.
- **Branch cardinality**: The `helix-cli` cleanup must cover every Helix-relevant base branch, verified explicitly per branch.
- **No manual cleanup dependency**: The solution must not require manual developer intervention for future ticket runs.
- **Existing callers unaffected**: The staging function (`commitBranchChanges`) is called from at least 5 orchestrator modules — the fix must be internal to the staging logic, not require caller changes.

## Future Considerations

- A broader audit of other repos for tracked-ignored files could be valuable but is not required for this ticket.
- Monitoring or alerting when tracked-ignored paths are excluded during staging could improve observability.
- A pre-flight repo-health check before ticket runs could proactively detect repos with tracked-ignored files.

## Open Questions / Risks

| # | Question / Risk | Status |
|---|----------------|--------|
| 1 | Which specific `helix-cli` remote branches have `node_modules` tracked? Cannot determine without Git commands (orchestrator-managed). | Open — must be verified at implementation time |
| 2 | Whether `git check-ignore` or `git ls-files -i --exclude-standard` is the most reliable mechanism in the sandbox environment for identifying tracked-ignored paths. | Technical — deferred to tech-research/implementation |
| 3 | Git version compatibility of the chosen ignore-check command in the sandbox environment. | Technical — deferred to tech-research/implementation |
| 4 | Whether other callers of `commitBranchChanges` (e.g. `onboarding-service.ts`) could also be affected in practice. | Low risk — same code path, same fix applies |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/scout-summary.md (helix-global-server) | Understand the staging logic flow and caller inventory | 5-step staging flow with a gap between path collection and `git add`; no existing tests for git-ops.ts |
| scout/scout-summary.md (helix-cli) | Understand CLI repo state and cleanup requirements | `.gitignore` already correct; `node_modules` tracked on remote branches only; zero runtime deps |
| diagnosis/diagnosis-statement.md (helix-global-server) | Root cause analysis and fix approach | Missing ignore-rule filter between lines 358–360 in git-ops.ts; `git check-ignore` or `git ls-files -i` as filter mechanism |
| diagnosis/diagnosis-statement.md (helix-cli) | Confirm CLI-side root cause and cleanup approach | Legacy index state; `git rm -r --cached` required per branch; `.gitignore` needs no change |
| diagnosis/apl.json (helix-global-server) | Detailed evidence of the code-level defect | Confirmed exact lines, error propagation via `runCheckedCommand`, and separation from `.helix` handling |
| diagnosis/apl.json (helix-cli) | Confirm CLI-specific facts and unknowns | Branch list unknown without Git commands; cleanup approach confirmed |
| repo-guidance.json (helix-global-server) | Confirm both repos are targets with defined intents | helix-global-server: code change + tests; helix-cli: Git index cleanup |
| ticket.md (helix-global-server) | Full ticket scope, constraints, acceptance criteria | Both-repo fix required; generic not special-cased; fail-closed on real errors |

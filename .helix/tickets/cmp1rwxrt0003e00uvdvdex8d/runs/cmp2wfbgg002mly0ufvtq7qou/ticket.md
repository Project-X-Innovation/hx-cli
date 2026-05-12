# Ticket Context

- ticket_id: cmp1rwxrt0003e00uvdvdex8d
- short_id: BLD-427
- run_id: cmp2wfbgg002mly0ufvtq7qou
- run_branch: helix/build/BLD-427-hlx-tickets-artifacts-include-the-run-id-and
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
hlx tickets artifacts: include the run id and follow-up command suggestion when no artifacts are returned

## Description
# `hlx tickets artifacts` — include the run id when no artifacts are returned

## Summary
When `hlx tickets artifacts <ticket-ref>` returns no results, the command currently prints `No artifacts found.` and nothing else. Users then need a run id to fall back to `hlx tickets artifact --run <runId> --step <stepId> --repo <repoKey>`, but the CLI never tells them what that run id is. This ticket changes the empty-results output to include the relevant run id and a follow-up command suggestion.

## Why
For tickets in statuses like `DEPLOYED`, `UNVERIFIED`, or `FAILED`, the server's `/tickets/:id/artifacts` endpoint returns an empty summary even when step artifacts exist for the latest run. The user-facing workaround is `hlx tickets artifact --run <runId> --step ... --repo ...`, but users cannot get the run id from `hlx tickets artifacts` today. This closes the gap without changing server behavior.

## Decisions Already Made
- CLI-only change.
- No JSON mode is being added in this ticket.
- The printed run id must be the one the server considered (or, when `--run` is supplied, the value the user supplied).

## Do Not Re-Decide
- Do not change the server endpoint or its eligibility rules for which ticket statuses return artifact summaries.
- Do not restructure the success-path output of `hlx tickets artifacts`.

## Non-Negotiable Invariants
- When `--run <runId>` was supplied by the user, the run id printed in the empty-result output must equal that supplied value. Do not substitute another run id.
- The success path (when artifacts or step-artifact summaries are returned) must be unchanged.

## In Scope
- The empty-result branch of `hlx tickets artifacts` (both `items` and `stepArtifactSummary` empty).

## Out of Scope
- Adding `--json` to `hlx tickets artifacts`.
- Changing the server-side `/tickets/:id/artifacts` endpoint.
- Modifying `hlx tickets artifact` behavior or other ticket subcommands.

## Required Behavior
1. When the response contains no artifact items and no step-artifact summary entries, the command must print the relevant run id.
2. If the user supplied `--run <runId>`, that supplied value is the run id printed.
3. If the user did not supply `--run`, the command must resolve the ticket's current/latest run id and print it. If the ticket has no runs at all, the command must print a clear "no runs available" message instead, with no follow-up suggestion.
4. The empty-result output must include a single follow-up command suggestion of the form:
   `Use: hlx tickets artifact <ticket-ref> --run <runId> --step <stepId> --repo <repoKey>`

## Failure Behavior
- If resolving the run id requires an extra request and that request fails (network or server error), the command must still exit 0, print `No artifacts found.`, and print a single line stating that the run id could not be resolved. It must not retry, must not throw, and must not exit non-zero.

## Acceptance Criteria
1. For a ticket whose `hlx tickets artifacts` response is empty, the command prints the latest run id and a one-line follow-up command suggestion.
2. For `hlx tickets artifacts <ticket> --run <runId>` whose response is empty, the printed run id is the exact `<runId>` supplied; no other run id appears.
3. For a ticket with artifacts or step artifacts, the output is byte-identical to current behavior.
4. For a ticket with zero runs (when reachable), the command prints a "no runs available" message and does not include the follow-up command suggestion.
5. Negative: when the run-id lookup fails, the command exits 0 with `No artifacts found.` plus a single line noting the run id could not be resolved. The command must not throw, retry, or exit non-zero.

## Attachments
- (none)

## Discussion
- **Helix** (2026-05-11T22:48:52.893Z) [Agent]: I'm working on this, I'll get back to you when ready.
- **Helix** (2026-05-12T16:27:40.226Z) [Agent]: I'm working on this, I'll get back to you when ready.

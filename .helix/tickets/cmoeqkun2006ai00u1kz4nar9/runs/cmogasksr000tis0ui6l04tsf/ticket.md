# Ticket Context

- ticket_id: cmoeqkun2006ai00u1kz4nar9
- short_id: BLD-317
- run_id: cmogasksr000tis0ui6l04tsf
- run_branch: helix/build/BLD-317-turn-helix-cli-into-an-org-aware-helix-workbench
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Turn helix-cli into an org-aware Helix workbench for Codex

## Description
Expand `helix-cli` from a narrow inspection tool into an org-aware Helix client that lets users switch orgs, browse and filter tickets, inspect ticket context and artifacts, load ticket context locally for Codex, create tickets, reply to comments, and continue tickets.

## Why

Users should be able to talk to Codex naturally using Helix data and workflows, for example:

- “show me the latest ticket in this org”

- “load this ticket locally and inspect what’s missing”

- “continue this ticket with this new context”

- “create a new ticket from this prompt”

The backend already exposes most of the needed data. The main gap is CLI product surface, not backend reinvention.

## Product Decisions

- `helix-cli` is a thin client over the existing Helix backend.

- Tickets are visible to all authenticated users in the current org.

- The CLI must work at org scope, not just “my tickets”.

- Org switching is a first-class CLI capability.

- “Continue” is a user-friendly CLI command built on the existing rerun flow with `continuationContext`.

- The CLI should support two modes:

  - readable terminal output for humans

  - local context materialization for Codex

- Artifact reads should print the real artifact content directly.

- Do not add direct GitHub/Vercel data access in the CLI when Helix backend already has the data.

## In Scope

- Org commands:

  - `hlx org current`

  - `hlx org list`

  - `hlx org switch <org>`

- Ticket discovery:

  - `hlx tickets list`

  - `hlx tickets latest`

  - `hlx tickets get <ticket-id>`

- Ticket filters:

  - `--user`

  - `--status`

  - `--status-not-in`

  - `--archived`

  - `--sprint`

- Ticket inspection:

  - branch name

  - repos involved

  - run history

  - merge status

  - report/preview/proof where available

- Artifact inspection:

  - list available ticket artifacts

  - fetch step artifact content

- Local Codex workflow:

  - `hlx tickets bundle <ticket-id> --out <dir>`

- Ticket actions:

  - create ticket

  - reply to comment

  - rerun ticket

  - continue ticket with continuation context

## Out of Scope

- Full-text search backend

- Direct repo clone/checkout behavior

- Auto-fixing or code modification inside the CLI

- Auto-update / publish work

- New backend workflows unless a CLI command is blocked by a clearly missing minimal API

## Required Behavior

1. Users can switch orgs and all subsequent commands use the selected org.

2. Users can list and inspect all tickets visible in the current org.

3. Users can filter tickets by user and status.

4. Users can inspect ticket details, runs, repos, branch names, and artifacts.

5. Users can load one ticket into a deterministic local bundle for Codex inspection.

6. Users can create tickets, reply to comments, rerun tickets, and continue tickets.

7. `continue` must use the existing rerun endpoint with `continuationContext`.

8. The CLI must stay readable and practical for interactive use.

## Non-Negotiable Constraints

- Do not redesign auth.

- Do not narrow ticket visibility to reporter-only.

- Do not invent ticket data client-side.

- Do not create a separate backend “continue” concept.

- Do not bypass the backend with direct GitHub/Vercel calls.

- Do not write local bundle files into the repo by default.

## Acceptance Criteria

- `hlx org current|list|switch` works.

- `hlx tickets list|latest|get` works at org scope.

- Ticket filters work for user/status/archive/sprint.

- Ticket detail output includes branch, repos, and run context.

- Artifact discovery and step artifact reads work.

- `hlx tickets bundle` creates a deterministic local context folder for Codex.

- Ticket creation, comment reply, rerun, and continue flows are available in the CLI.

- The implementation remains a thin client over Helix backend APIs.

## Verification

- Switch org and verify later commands use the new org.

- List tickets in an org and filter by user/status.

- Get a ticket and confirm branch/repos/runs are visible.

- Read a step artifact and confirm raw markdown/json prints correctly.

- Bundle a ticket locally and confirm the expected context files are written.

- Create a ticket, reply to a comment, rerun a ticket, and continue a ticket.

- Verify invalid org/ticket/input failures are clear and non-silent.

## Attachments
- (none)

## Discussion
- **Helix** (2026-04-26T20:51:22.564Z) [Agent]: I'm working on this, I'll get back to you when ready.

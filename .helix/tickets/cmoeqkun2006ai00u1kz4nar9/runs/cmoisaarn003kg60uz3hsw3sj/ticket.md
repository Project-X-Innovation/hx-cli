# Ticket Context

- ticket_id: cmoeqkun2006ai00u1kz4nar9
- short_id: BLD-317
- run_id: cmoisaarn003kg60uz3hsw3sj
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
- **Helix** (2026-04-27T02:12:10.677Z) [Agent]: Your changes are ready! Updated 2 repositories.
- **Luis** (2026-04-28T15:29:50.522Z) [Helix]: Can you verify if the Agents of Helix will be able to use the CLI as usual after we deploy this ticket?
- **Helix** (2026-04-28T15:30:14.996Z) [Agent]: Based on the code review, **yes — existing CLI usage should continue working normally after deployment.** Here's the summary:

- **No regression risks were identified.** The changes are entirely additive — new commands were layered on top of the existing CLI without modifying any current behavior.
- **One bug was caught and fixed** during code review: the `continue` command was incorrectly including the ticket ID in the continuation context. This was fixed before the changes were finalized.
- **Auth was not touched**, and the existing config/env var model is unchanged, so any agents relying on `HELIX_API_KEY` or `HELIX_URL` will behave exactly as before.

The only thing worth noting is that **org switching is ineffective when `HELIX_API_KEY` env vars are set** (env vars take priority over the config file). But that's a pre-existing design choice, not something this ticket introduced.

In short: Agents of Helix get all the new commands, and nothing they rely on today should break.

## Continuation Context
## ROLE
This is a CONFLICT RESOLUTION run. Your only job is to resolve git merge conflicts.
Do NOT re-implement the original ticket. Do NOT add new features or refactor code.

## TASK
Read `.helix/merge-conflicts.json` in each repo for the list of conflicted files.
Each entry includes `ticketCommits` and `stagingCommits` context explaining what each side changed.
You MUST resolve conflicts in EVERY file listed in merge-conflicts.json. Do not stop until all files are clean.

## RESOLUTION STRATEGY
Process files one at a time. Read the file, resolve all markers, write it back, then move to the next file.
1. For each conflicted file, understand the intent of both the ticket changes and the staging changes.
2. Remove all `<<<<<<<`, `=======`, and `>>>>>>>` conflict markers.
3. Reconcile both sets of changes so both intents are preserved.
4. When both intents cannot coexist, favor the staging version and re-implement the ticket's intent on top.

## FILE-TYPE GUIDANCE
- **JSON files**: Carefully parse the structure around conflict markers. Merge array items and object keys from both sides. Ensure valid JSON after resolution.
- **Test files**: Include all test cases from both sides. Do not drop tests from either branch.
- **TypeScript/JavaScript source**: Merge imports from both sides. Ensure no duplicate imports or missing references.

## VERIFICATION
After resolving ALL files, verify no conflict markers remain by searching every resolved file for `<<<<<<<`, `=======`, and `>>>>>>>`. If any remain, fix them before finishing.

## CONSTRAINTS
- Do NOT modify files that are not listed in merge-conflicts.json.
- Do NOT re-implement the original ticket description — only resolve merge conflicts.
- Do NOT run scout, diagnosis, or planning steps — go straight to resolving conflicts in the source files.
- Only touch files with conflict markers or files listed in merge-conflicts.json.

## FALLBACK
If no `.helix/merge-conflicts.json` exists in a repo, the merge was clean for that repo — no changes needed.

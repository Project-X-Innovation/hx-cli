# Ticket Context

- ticket_id: cmolxmbmb000skq0ua7x6wbxz
- short_id: FIX-349
- run_id: cmolxmbmj000vkq0um1qxf7ua
- run_branch: helix/fix/FIX-349-add-run-selection-to-hlx-tickets-artifacts-and
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Add run Selection To hlx tickets artifacts And Harden Missing Artifact Errors

## Description
# Ticket: Add run Selection To hlx tickets artifacts And Harden Missing Artifact Errors

## Summary
Improve the artifact inspection CLI so users can request artifact summaries for a specific run and so missing step artifacts fail cleanly. `hlx tickets artifacts` must support `--run <runId>` and pass it to the server, and `hlx tickets artifact` must handle expected 404 responses without triggering noisy Node assertion failures.

## Why
The server artifact summary endpoint already supports a `runId` query parameter, but the CLI `tickets artifacts` command does not expose it. Passing `--run <runId>` to the CLI is currently ignored because `src/tickets/artifacts.ts` calls `/tickets/${ticketId}/artifacts` with no query params.

This made artifact discovery confusing when the default summary command returned empty. Direct artifact fetch worked when run/step/repo were known:

```powershell
hlx tickets artifact cmolkrnae0013eg0u71xp0gle --run cmolkrnas0016eg0uk3l2mtq2 --step implementation --repo helix-cli
```

But requesting a missing step artifact returned 404 and then Node emitted an assertion failure:

```text
HTTP 404 Not Found — {error:No

## Attachments
- (none)

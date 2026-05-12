# Ticket Context

- ticket_id: cmp1sq1fd000te00u807e0udb
- short_id: BLD-430
- run_id: cmp1sq1fu000we00ux7bx8fb9
- run_branch: helix/build/BLD-430-fix-hlx-tickets-bundle-returns-0-artifacts-for
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Fix: hlx tickets bundle returns 0 artifacts for PREVIEW_READY tickets

## Description
# `hlx tickets bundle` returns 0 artifacts for `PREVIEW_READY` tickets

## Symptom

`hlx tickets bundle <ticket-ref> --out <dir>` produces an empty archive (0 artifact files) for tickets whose status is `PREVIEW_READY`, even though step artifacts exist on the latest run and are individually fetchable via `hlx tickets artifact`. The command prints a "Could not fetch artifact for step=… repo=…" warning for every step and exits with "0 artifact file(s)".

## Concrete repro

- Ticket: `cmp1jfwt5002lmo0tts95de2q` (BLD-425)
- Status: `PREVIEW_READY`
- Latest run: `cmp1jfwtl002pmo0tmzw6d6nv`

Commands and observed behavior:

1. `hlx tickets bundle cmp1jfwt5002lmo0tts95de2q --out ./out`
   - Prints a `Warning: Could not fetch artifact for step=… repo=…` line for every step.
   - Final output: `0 artifact file(s)`.
   - Archive is effectively empty.

2. `hlx tickets artifacts cmp1jfwt5002lmo0tts95de2q --run cmp1jfwtl002pmo0tmzw6d6nv`
   - Returns the full step summary as expected.

3. `hlx tickets artifact cmp1jfwt5002lmo0tts95de2q --run cmp1jfwtl002pmo0tmzw6d6nv --step implementation --repo helix-global-server`
   - Returns the full artifact content (~15 KB).

So the artifacts are present and reachable — `bundle` just isn't reaching them.

## Existing workaround

`hlx tickets artifact` and `hlx tickets artifacts` both accept `--run <runId>`, which is what makes them work for non-active statuses. `hlx tickets bundle` does not expose an equivalent path, so the user has to fetch each step artifact individually and assemble the bundle by hand.

## Related context

The `hlx-cli` skill notes already document that for terminal statuses (`DEPLOYED`, `UNVERIFIED`, `FAILED`) the artifact summary endpoint returns empty unless a run id is supplied explicitly. `PREVIEW_READY` exhibits the same behavior, and `bundle` currently has no way to recover.

## What good looks like

`hlx tickets bundle` should successfully produce an archive containing the step artifacts for any ticket whose run artifacts are reachable via `hlx tickets artifact` / `hlx tickets artifacts` — including `PREVIEW_READY` and other non-active statuses where the default artifact summary endpoint is empty. The fix path (new flag, smarter default resolution, server-side change, etc.) is left to the implementer.

## Attachments
- (none)

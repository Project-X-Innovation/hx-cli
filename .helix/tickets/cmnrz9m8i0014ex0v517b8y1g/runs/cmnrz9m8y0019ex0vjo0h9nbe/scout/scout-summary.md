# Scout Summary — helix-cli

## Problem

The ticket proposes extending helix-cli as an alternative walkthrough delivery channel, allowing devs to review AI-generated changes directly in their coding agent (e.g., Claude Code). Currently, helix-cli has no walkthrough, review, or change-inspection commands. The scout maps the existing CLI structure and extension points relevant to a potential walkthrough command.

## Analysis Summary

helix-cli is a lightweight Node.js CLI (v1.2.0, 57-line router) with three top-level commands: `login`, `inspect`, and `comments`. It has no walkthrough capability today.

**Existing patterns relevant to a walkthrough command**:
- The `comments` subcommand provides the closest structural analog — it has list/post subcommands, uses `--ticket` flag (with HELIX_TICKET_ID env fallback), makes authenticated server API calls, and outputs formatted data to the terminal.
- The `inspect` subcommand demonstrates read-only data fetching patterns (db, logs, api, repos).
- The HTTP client (`src/lib/http.ts`) supports retry with exponential backoff, 30s timeout, and Retry-After handling.

**What exists on the server side that a CLI could consume**:
- `POST /tickets/:ticketId/runs/:runId/walkthrough` — generates and returns walkthrough data
- `POST /tickets/:ticketId/runs/:runId/walkthrough/files` — fetches source file contents
- Tour files committed to GitHub branches at `.helix/tickets/{id}/runs/{id}/intraview/{repoKey}-walkthrough.json`

**What does not exist**:
- No CLI command for listing recent completed runs for a ticket
- No CLI command for fetching or displaying walkthrough data
- No mechanism for auto-pulling recently finished tickets (the "extend the Helix line" idea from the ticket)
- No CodeTour parsing or terminal rendering capability

## Relevant Files

| File | Role | Lines |
|------|------|-------|
| `src/index.ts` | Main CLI router with switch on command | 57 |
| `src/comments/index.ts` | Comments subcommand router — pattern for new subcommand | — |
| `src/comments/list.ts` | Example of data-fetching CLI command with flags | — |
| `src/inspect/index.ts` | Inspect subcommand router — alternative pattern | — |
| `src/lib/http.ts` | Shared HTTP client with retry logic | — |
| `package.json` | v1.2.0, Node 18+. Quality gates: build (tsc), typecheck (tsc --noEmit). No lint or test. | — |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand the CLI alternative proposal | Ticket suggests extending CLI to auto-pull finished tickets and walk devs through changes |
| src/index.ts (source) | Map CLI command structure | Three commands: login, inspect, comments. No walkthrough. |
| src/comments/ (source) | Identify closest structural pattern | list/post subcommands with --ticket flag, server API calls |
| src/lib/http.ts (source) | Map the HTTP client capabilities | Retry, exponential backoff, Retry-After — ready for new API calls |
| package.json (source) | Map quality gates and version | build (tsc), typecheck (tsc --noEmit). No lint or test scripts. |

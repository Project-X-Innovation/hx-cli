# Diagnosis Statement — helix-cli

## Problem Summary

The CLI has no command to fetch a ticket's research report. The user explicitly expects CLI as one of multiple independent report access paths. The server API endpoint `GET /tickets/:ticketId/report` exists and is wrappable via the CLI's existing `hxFetch` utility.

## Root Cause Analysis

The CLI's ticket subcommand registry (`src/tickets/index.ts` lines 15-32) includes commands for listing, getting, creating, and managing ticket artifacts, but has no `report` subcommand. The `get` command (`src/tickets/get.ts`) outputs ticket metadata without report content, relationship fields (afterTicketId, implementFromTicketId), or ticket mode.

The server-side `GET /tickets/:ticketId/report` endpoint (routes/api.ts line 299) returns `{ report: { content, filename, generatedAt } | null }` and is fully functional for web/API clients. The CLI simply never wraps it.

## Evidence Summary

- `src/tickets/index.ts` lines 15-32: no report subcommand exists
- `src/tickets/get.ts`: TicketDetail type lacks report content and relationship fields
- Server endpoint exists at `GET /tickets/:ticketId/report` returning report content
- `src/lib/http.ts`: hxFetch utility available for authenticated API calls

## Success Criteria

1. `hlx tickets report <ticket-ref>` command exists and outputs research report content
2. Command uses existing `resolveTicketRef` for flexible ticket reference (shortId, number, ID)
3. Clear output when no report exists for the given ticket

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/reference-map.json (helix-cli) | File map and current commands | No report command; hxFetch available for API calls |
| scout/scout-summary.md (helix-cli) | CLI analysis | Server endpoint exists; CLI gap confirmed |
| Continuation context | User expectations | CLI should be one of multiple report access paths |

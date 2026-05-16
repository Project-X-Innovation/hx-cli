# Scout Summary — helix-cli

## Problem

The CLI has no command to fetch a ticket's research report. The server API endpoint `GET /tickets/:ticketId/report` exists and returns report content, but the CLI does not wrap it. The user expects agents to be able to independently look up research reports via CLI during runs — this is one of the "multiple ways" reports should be accessible when a research ticket is referenced.

## Analysis Summary

### Current CLI Ticket Commands

The CLI (`src/tickets/index.ts` lines 15-32) exposes these ticket subcommands:
- `list` — search/filter tickets
- `latest` — most recently updated ticket
- `get` — ticket detail (id, shortId, title, status, branch, reporter, repos, runs)
- `create` — create a ticket
- `update-description` — update description
- `rerun` — re-execute workflow
- `continue` — continue with context
- `artifacts` — list step artifacts for a run
- `artifact` — get specific step artifact
- `bundle` — bundle artifacts for Codex

**No `report` command exists.** The `get` command doesn't include research report content, relationship fields (afterTicketId, implementFromTicketId, referencedTicketIds), or mode.

### Server API Availability

The server has `GET /tickets/:ticketId/report` (routes/api.ts line 299) returning:
```typescript
{ report: { content: string; filename: string; generatedAt: string } | null; errorMessage?: string | null }
```

The CLI has `hxFetch` utility for authenticated API calls (`src/lib/http.ts`), making a new report command straightforward to implement.

### Agent Access During Runs

Whether agents can use CLI commands during sandbox runs depends on:
1. CLI installation in the sandbox environment
2. Authentication credentials available to the agent
3. Network access to the server API

These factors are **unknown** — the CLI may not be usable by agents during runs even if a report command is added.

### Quality Gates

| Command | What |
|---------|------|
| `npm run build` | `tsc` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `tsc && node --test dist/**/*.test.js` |

## Relevant Files

| File | Role |
|------|------|
| `src/tickets/index.ts` | Ticket subcommand registry — no report command |
| `src/tickets/get.ts` | Ticket detail — no report content or relationship fields |
| `src/tickets/artifacts.ts` | Step artifacts listing — separate from research reports |
| `src/tickets/artifact.ts` | Individual step artifact fetch |
| `src/lib/http.ts` | hxFetch utility for API calls |
| `src/lib/resolve-ticket.ts` | Ticket reference resolution (shortId, number, ID) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand ticket scope | User expects CLI as one of multiple report access paths |
| Continuation context | User guidance on report access | Agent should be able to use CLI to look up reports |
| helix-cli/src/tickets/index.ts | Verify available commands | No report command exists |
| helix-global-server/src/routes/api.ts | Verify server API endpoint | GET /tickets/:ticketId/report exists and is wrappable |

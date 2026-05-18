# Scout Summary — RSH-488: Goals (helix-cli)

## Problem

RSH-488 explores the "Goals" concept. The helix-cli is the command-line interface that would expose Goal creation and management. Currently no Goal CLI commands exist.

## Analysis Summary

### Current CLI State

The CLI has a modular command structure with 8 top-level command groups: login, token, org, tickets, inspect, comments, skill, update. Ticket creation supports 5 modes (AUTO|BUILD|FIX|RESEARCH|EXECUTE) with no GOAL option.

### Relevant Patterns

- **Command structure**: Each command group in its own directory (src/tickets/, src/comments/, etc.)
- **HTTP client**: Centralized hxFetch with auth, org-scoping, retries
- **Ticket resolution**: Flexible reference resolver accepting internal ID, short ID, or ticket number
- **Output formatting**: Consistent table/detail formatting patterns

### Impact Assessment

If Goals are a ticket type (GOAL mode): Minimal CLI changes — add GOAL to mode enum, possibly add child-ticket display to `hlx tickets get`.

If Goals are a separate entity: New `hlx goals` command group needed with create, list, get, status, children subcommands.

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/tickets/create.ts` | Ticket creation — GOAL mode would be added here |
| `src/tickets/index.ts` | Ticket command group structure |
| `src/index.ts` | Top-level command registration |
| `src/lib/http.ts` | HTTP client for API calls |
| `src/lib/resolve-ticket.ts` | Ticket reference resolution |
| `package.json` | Build configuration |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Ticket scope | Goals concept exploration — CLI would need to expose Goal management commands |
| `src/tickets/create.ts` | CLI creation command | 5 modes supported, no GOAL. Pattern is clear for adding new mode. |
| `src/index.ts` | CLI entry point | 8 top-level command groups. New 'goals' group would register here if Goals are separate from tickets. |
| `src/tickets/index.ts` | Ticket command structure | Modular subcommand pattern — consistent template for new commands. |
| `library/reports/RSH-411/report.md` | Predecessor research | GOAL as TicketMode — CLI would add mode value. No separate Goal CLI commands proposed in RSH-411. |

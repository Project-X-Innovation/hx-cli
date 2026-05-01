# Scout Summary — helix-cli (RSH-358)

## Problem

RSH-358 identifies the CLI as part of the portability limitation: "there is a CLI that other agents can use but it's not inherently portable." The user's concern is that database-only storage forces all mind map interaction through Helix's API infrastructure, limiting who/what can contribute.

## Analysis Summary

### Current state

- **No mind map commands exist** in the CLI.
- The CLI is an HTTP-based interface to the Helix server — all operations route through `hxFetch` to REST API endpoints.
- Current command categories: tickets, inspect, comments, org, auth.
- No evidence that RSH-353 planned CLI mind map commands.

### Portability concern

The user's point: with database storage, every mind map interaction requires:
1. Authentication via API key or bearer token
2. HTTP call to the Helix server
3. Server-side auth + org scoping middleware

With repository storage, mind maps become files that any agent or human can:
1. Read directly from a git clone
2. Edit with any text editor or tool
3. Commit changes via standard git operations
4. No Helix server dependency for read/write access

### CLI role under each approach

| Approach | CLI role | Agent access |
|----------|----------|-------------|
| Database | Required intermediary — would need new mind map commands | Must use CLI or direct API calls |
| Repository | Optional convenience — git provides native access | Direct file/git access, no Helix dependency |

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/index.ts` | Command registry — no mind map commands |
| `src/lib/http.ts` | HTTP client layer — the 'not portable' intermediary |
| `src/tickets/` | Ticket commands — closest analog for potential mind map commands |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (RSH-358) | Primary ticket — references CLI portability limitation | CLI as intermediary is the concern; repo-based storage would bypass it |
| CLI source exploration | Understand current command structure and HTTP communication | No mind map commands; all operations go through server HTTP API |
| package.json | Dependencies and structure | TypeScript + Commander.js CLI framework |

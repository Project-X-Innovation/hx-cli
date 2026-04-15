# Scout Summary: helix-cli

## Problem

The CLI provides production inspection and ticket collaboration commands but has no director/ownership awareness. It is a supporting tool for the Helix platform but does not currently surface or enable any product ownership workflows.

## Analysis Summary

### Current CLI Capabilities

The CLI (`hlx` binary, v1.2.0) has three command families:
1. **login** — OAuth/API key authentication
2. **inspect** — Read-only database queries, log retrieval, API inspection
3. **comments** — List/post comments on tickets (supports `HELIX_TICKET_ID` env var for agent integration)

### Director/Ownership Gap

No CLI commands exist for:
- Viewing or assigning ticket directors
- Listing tickets by director
- Approval or sign-off workflows
- Team alignment visibility (e.g., who is working on what)

The comments system is the only collaboration surface. It supports `isHelixTagged` and `isAgentAuthored` flags via the server API, but the CLI itself does not expose these as filter options beyond `--helix-only`.

### Quality Gates

| Command | Script |
|---------|--------|
| Build | `tsc` |
| Typecheck | `tsc --noEmit` |
| Lint | (none configured) |
| Test | (none configured) |

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/comments/list.ts` | Comment listing with --helix-only and --since filters |
| `src/comments/post.ts` | Comment posting for agent and human interaction |
| `src/inspect/db.ts` | Database query tool (could surface ownership data) |
| `src/index.ts` | Command routing entry point |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand problem scope | Ticket is about platform-wide ownership; CLI is a peripheral tool |
| package.json | Identify build commands and capabilities | Minimal tooling; no test or lint scripts |
| src/index.ts | Map available CLI commands | Three command families; no ownership/director commands |
| src/comments/*.ts | Understand collaboration surface | Comments are the only interactive feature; no director awareness |

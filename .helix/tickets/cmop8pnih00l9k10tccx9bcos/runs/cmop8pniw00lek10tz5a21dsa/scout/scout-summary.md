# Scout Summary: Ego Agent Continued (helix-cli)

## Problem

The ticket describes an Ego Agent that needs to interact with production systems, diagnose deploy failures, and post feedback. The CLI is the interface layer through which in-sandbox agents access production data and post comments. It currently supports comment posting/listing and production inspection (database, logs, API) as a stateless executor.

## Analysis Summary

### Existing CLI Capabilities

**Comment Interface:** `hlx comments post` and `hlx comments list` provide the mechanism for agents to participate in ticket discussions. The `--helix-only` filter helps agents focus on Helix-tagged comments. `HELIX_TICKET_ID` env var provides implicit context inside sandboxes.

**Production Inspection:** `hlx inspect db` (SQL), `hlx inspect logs` (with --limit), `hlx inspect api` (HTTP proxy) give agents read-only access to production data. This is directly relevant to the ego agent's ability to diagnose deploy failures and runtime issues.

**Stateless Design:** The CLI is a thin RPC interface with zero runtime dependencies. Agents provide full context, CLI executes, returns JSON. No persistent state or session management.

**Resilience:** 30-second timeout, 3 retries with exponential backoff, HTML error detection for proxy issues.

### CLI Gaps for Ego Agent

1. **No Multi-Ticket Commands** - Cannot list, search, or switch between tickets. Only per-ticket comment interaction.
2. **No APL Commands** - Cannot inspect or modify APL assumptions.
3. **No Run Management** - Cannot view run status or trigger reruns from CLI.
4. **No Real-Time Streaming** - Stateless request-response only; no SSE/WebSocket for live interaction.

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/comments/post.ts` | Agent comment posting mechanism |
| `src/comments/list.ts` | Agent comment reading with filters |
| `src/inspect/db.ts` | Production database queries |
| `src/inspect/logs.ts` | Production log retrieval |
| `src/inspect/api.ts` | Production API inspection |
| `src/lib/http.ts` | HTTP resilience layer |
| `src/lib/config.ts` | Auth/config resolution |
| `package.json` | Build scripts, zero deps |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand ego agent's need for production inspection and comment interaction | Agent needs deploy log diagnosis, runtime data access, and comment-based feedback |
| src/comments/post.ts (direct read via agent) | Map comment posting capability | Stateless post with HELIX_TICKET_ID env var for implicit context |
| src/comments/list.ts (direct read via agent) | Map comment reading capability | --helix-only and --since filters for focused agent reading |
| src/inspect/* (direct read via agent) | Map production inspection commands | db, logs, api, repos subcommands for read-only runtime access |
| src/lib/http.ts (direct read via agent) | Map resilience patterns | 30s timeout, 3 retries, exponential backoff |
| package.json (direct read) | Build pipeline and dependencies | Zero runtime deps, tsc build, Node >=18 |

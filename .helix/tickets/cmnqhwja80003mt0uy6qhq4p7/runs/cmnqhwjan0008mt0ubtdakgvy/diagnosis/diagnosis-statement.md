# Diagnosis Statement — helix-cli

## Problem Summary

The Helix CLI (`hlx`) has no commands for reading or writing ticket comments. The HTTP client (`hxFetch`) hardcodes `/api/inspect` as the base path, making comment endpoints at `/api/tickets/:id/comments` unreachable. The ticket ID is not available as an environment variable in the sandbox. These gaps prevent agents and external CLI users from participating in ticket discussions.

## Root Cause Analysis

Three specific gaps in the CLI prevent comment functionality:

### 1. No Comment Commands
The CLI's command router (index.ts) only handles `login`, `inspect`, and `--version`. No comment-related code exists anywhere in the CLI. New `hlx comments list` and `hlx comments post` commands must be added following the existing subcommand dispatch pattern from `inspect/index.ts`.

### 2. HTTP Client Path Limitation
`hxFetch` (http.ts line 43) builds URLs as `${config.url}/api/inspect${path}`. Comment endpoints live at `/api/tickets/:ticketId/comments` — a completely different path prefix. The HTTP client needs to support non-inspect API paths, either via a basePath parameter or a parallel function.

### 3. Ticket ID Not Available
Agents in the sandbox receive `HELIX_INSPECT_TOKEN` and `HELIX_INSPECT_BASE_URL` via env.sh, but no `HELIX_TICKET_ID`. The CLI needs the ticket ID to construct comment API URLs. This is a server-side change (orchestrator must inject the env var) but affects CLI design — the CLI should support both `--ticket` flag and `HELIX_TICKET_ID` env var.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| CLI command router | `index.ts` lines 24-44 | Only login, inspect, --version; no comments |
| HTTP base path hardcoded | `http.ts` line 43 | `/api/inspect` prefix; comment endpoints unreachable |
| Subcommand pattern | `inspect/index.ts` | Reusable dispatch pattern with getFlag/getPositionalArgs |
| Auth header logic | `http.ts` lines 52-56 | hxi_ → X-API-Key, else → Bearer; works for both endpoint types |
| Env vars in sandbox | Server `orchestrator.ts` lines 1158-1164 | Only HELIX_INSPECT_TOKEN and HELIX_INSPECT_BASE_URL |
| Config loading | `config.ts` | Env vars take priority over file config |

## Success Criteria

1. `hlx comments list --ticket <id>` returns comments with author, content, timestamp, isHelixTagged
2. `hlx comments post --ticket <id> "message"` creates a comment via the API
3. `HELIX_TICKET_ID` env var auto-detected when --ticket flag is omitted
4. HTTP client supports comment API paths alongside inspect paths
5. Output is formatted for both human reading (terminal) and agent consumption

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/scout-summary.md (helix-cli) | Map CLI current state | No comment commands; HTTP hardcodes /api/inspect; zero deps |
| scout/reference-map.json (helix-cli) | Identify relevant files | index.ts, http.ts, config.ts, inspect/index.ts as key files |
| scout/scout-summary.md (helix-global-server) | Understand server-side constraints | Auth gap on comment routes; env.sh lacks HELIX_TICKET_ID |
| http.ts | Verify HTTP client implementation | Confirmed /api/inspect hardcoded; auth header logic reusable |
| index.ts | Verify command router | Confirmed simple switch pattern |
| inspect/index.ts | Verify subcommand pattern | getFlag/getPositionalArgs pattern for new commands |

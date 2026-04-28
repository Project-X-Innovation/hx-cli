# Diagnosis Statement: helix-cli

## Problem Summary

The helix-cli was a narrow inspection tool supporting only `login`, `inspect`, and `comments` commands. The ticket requires expanding it into an org-aware Helix workbench supporting org switching, ticket discovery with filters, ticket detail inspection, artifact reads, local Codex bundling, and ticket actions (create, rerun, continue, comment reply).

## Root Cause Analysis

This is a feature expansion, not a bug fix. The "gap" was product surface area: the backend already exposed all necessary data through its API, but the CLI lacked commands to access it. The one server-side gap (no `reporterUserId` query param on `GET /api/tickets`) has been addressed with a ~5-line change in helix-global-server.

The implementation is complete in the current branch state:
- **13 new source files** added across `src/org/` (4 files) and `src/tickets/` (10 files)
- **CLI version** bumped from 0.1.0 to 1.2.0
- **Config model** extended with `orgId` and `orgName` for persistent org context
- **All 9 ticket subcommands** implemented: list, latest, get, create, rerun, continue, artifacts, artifact, bundle
- **All 3 org subcommands** implemented: current, list, switch
- **Typecheck passes** with zero errors
- **Zero production dependencies** maintained

The architecture correctly maintains the CLI as a thin client over existing backend endpoints. Command structure follows the established pattern from `src/comments/` (switch-based router + individual handler files + shared `hxFetch`).

## Evidence Summary

### Backend API Coverage (Verified)

| CLI Command | Backend Endpoint | Status |
|---|---|---|
| `hlx org current` | `GET /api/auth/me` | Pre-existing |
| `hlx org list` | `GET /api/auth/me` | Pre-existing |
| `hlx org switch` | `POST /api/auth/switch-org` | Pre-existing |
| `hlx tickets list` | `GET /api/tickets` | Modified (added reporterUserId) |
| `hlx tickets latest` | `GET /api/tickets` | Pre-existing |
| `hlx tickets get` | `GET /api/tickets/:id` | Pre-existing |
| `hlx tickets create` | `POST /api/tickets` | Pre-existing |
| `hlx tickets rerun` | `POST /api/tickets/:id/rerun` | Pre-existing |
| `hlx tickets continue` | `POST /api/tickets/:id/rerun` | Pre-existing |
| `hlx tickets artifacts` | `GET /api/tickets/:id/artifacts` | Pre-existing |
| `hlx tickets artifact` | `GET /api/tickets/:id/runs/:rid/step-artifacts/:sid` | Pre-existing |
| `hlx tickets bundle` | Multiple endpoints | Pre-existing |
| `hlx comments post` | `POST /api/tickets/:id/comments` | Pre-existing |

### Runtime Evidence

- **reporterUserId column**: Exists in production Ticket table as `text` type; 381/381 tickets populated (100%)
- **TicketStatus enum**: All 15 values present in production DB (QUEUED, RUNNING, SANDBOX_READY, FAILED, VERIFYING, DEPLOYING, PREVIEW_READY, IN_PROGRESS, DEPLOYED, UNVERIFIED, STAGING_MERGED, WAITING, DRAFT, MERGING, REPORT_READY)
- **Production logs**: No recent ticket-related errors

### Non-Blocking Observations

1. **No tests**: No `*.test.ts` or `*.spec.ts` files exist. Verification requires runtime testing.
2. **Token expiration**: No refresh flow visible; expired JWTs will fail with no automatic recovery.
3. **--status filter**: Applied client-side since backend only supports `statusNotIn`. This is a design trade-off, not a bug.
4. **Bundle error handling**: Artifact fetch failures are warned, not fatal. Reasonable for partial artifact availability.

## Success Criteria

1. `hlx org current|list|switch` works and persists org context across commands
2. `hlx tickets list|latest|get` returns org-scoped ticket data
3. Ticket filters (`--user`, `--status`, `--status-not-in`, `--archived`, `--sprint`) function correctly
4. Ticket detail output includes branch, repos, runs, and merge status
5. Artifact discovery and step artifact raw content reads work
6. `hlx tickets bundle` creates deterministic local context directory for Codex
7. Ticket create, comment reply, rerun, and continue flows complete successfully
8. Invalid inputs produce clear error messages (non-silent failures)
9. Server-side reporterUserId filter works without affecting existing API consumers

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md | Ticket specification and acceptance criteria | Defined full command surface, filters, constraints |
| scout/reference-map.json (helix-cli) | CLI implementation inventory | 13 new files, all commands implemented, typecheck passes |
| scout/reference-map.json (helix-global-server) | Server change scope | ~5 lines changed, all other routes pre-existed |
| scout/scout-summary.md (helix-cli) | Architecture and pattern analysis | Thin client confirmed, zero deps, manual flag parsing |
| scout/scout-summary.md (helix-global-server) | Backend API surface mapping | 14+ CLI routes pre-existed, auth architecture documented |
| repo-guidance.json | Prior repo intent classification | Both repos correctly identified as targets |
| Runtime DB: Ticket columns | Verify filter columns exist | reporterUserId, status, isArchived, sprintId all present |
| Runtime DB: reporterUserId population | Verify filter data availability | 381/381 tickets have reporterUserId populated |
| Runtime DB: TicketStatus enum | Verify status values for --status filter | All 15 enum values confirmed in production |
| Runtime logs: recent errors | Check for ticket-related production issues | No ticket errors in recent logs |

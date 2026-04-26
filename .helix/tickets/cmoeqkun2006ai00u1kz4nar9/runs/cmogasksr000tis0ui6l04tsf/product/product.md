# Product: Turn helix-cli into an org-aware Helix workbench for Codex

## Problem Statement

`helix-cli` is a narrow inspection tool with only three command groups (`login`, `inspect`, `comments`). Users who want to interact with Helix ticket data and workflows from the terminal -- or load ticket context into Codex -- have no CLI surface for org switching, ticket discovery, ticket inspection, artifact reads, local bundling, or ticket actions (create, rerun, continue). The backend already exposes the necessary APIs; the gap is entirely CLI product surface.

## Product Vision

Transform `helix-cli` from a read-only inspection tool into a practical org-aware Helix workbench that lets users discover, inspect, and act on tickets entirely from the terminal. The CLI serves two complementary audiences: human operators who want readable terminal output, and Codex/AI sessions that need deterministic local context.

## Users

| User | Need |
|---|---|
| **Developer using Helix** | Browse, filter, and inspect tickets across an org from the terminal without switching to the web UI |
| **Codex / AI agent** | Load a ticket's full context (details, artifacts, run history) into a local directory for analysis and continuation |
| **Org admin / lead** | List tickets across the org, filter by user or status, and take actions (create, rerun, continue) from the CLI |

## Use Cases

1. **Org switching**: A user belongs to multiple orgs and switches context so all subsequent commands scope to the selected org.
2. **Ticket discovery**: A developer lists recent tickets, filters by status or reporter, or finds the latest ticket in their org.
3. **Ticket inspection**: A developer gets full ticket detail -- branch name, repos involved, run history, merge status -- to understand where a ticket stands.
4. **Artifact read**: A developer reads a specific step artifact (diagnosis, implementation plan, etc.) directly as raw markdown/JSON in the terminal.
5. **Local Codex bundle**: A Codex agent bundles a ticket's context (detail + artifacts) into a deterministic local folder structure for offline inspection and continuation.
6. **Ticket creation**: A user creates a new ticket from the CLI with a title, description, and target repos.
7. **Comment reply**: A user posts a comment on a ticket without leaving the terminal.
8. **Rerun / Continue**: A user reruns a ticket or continues it with new context, both using the existing rerun endpoint (with `continuationContext` for continue).

## Core Workflow

```
hlx login <url>                          # Authenticate (existing)
hlx org switch <org>                     # Set active org
hlx tickets list --status-not-in DEPLOYED,FAILED  # Discover tickets
hlx tickets get <ticket-id>              # Inspect detail
hlx tickets artifacts <ticket-id>        # List artifacts
hlx tickets artifact <ticket-id> --step <step> --repo <repo>  # Read artifact
hlx tickets bundle <ticket-id> --out ./context  # Bundle for Codex
hlx tickets continue <ticket-id> "new context"  # Continue with context
```

## Essential Features (MVP)

### Org management
- `hlx org current` -- show the active org and user
- `hlx org list` -- show all orgs the user belongs to
- `hlx org switch <org>` -- switch org by name or ID; persist the new session token and org metadata for all subsequent commands

### Ticket discovery
- `hlx tickets list` -- list tickets in the current org
- `hlx tickets latest` -- shortcut to the most recently updated ticket
- `hlx tickets get <ticket-id>` -- full ticket detail (branch, repos, runs, merge status)

### Ticket filters
- `--user <email-or-name>` -- filter by ticket reporter (resolved to `reporterUserId` via the org members endpoint; tries exact email match, then case-insensitive name match)
- `--status <status>` -- positive status match (applied client-side since backend only supports `statusNotIn`)
- `--status-not-in <statuses>` -- exclude statuses (comma-separated, server-side)
- `--archived` -- include archived tickets
- `--sprint <sprint-id>` -- filter by sprint

### Artifact inspection
- `hlx tickets artifacts <ticket-id>` -- list available artifacts and step artifact summaries
- `hlx tickets artifact <ticket-id> --step <step> --repo <repo>` -- fetch and print raw artifact content

### Local Codex bundle
- `hlx tickets bundle <ticket-id> --out <dir>` -- write deterministic local folder:
  - `ticket.json` -- full ticket detail
  - `manifest.json` -- ticketId, bundledAt, cliVersion
  - `artifacts/<stepId>/<repoKey>/<filename>` -- step artifact content

### Ticket actions
- `hlx tickets create --title "..." --description "..." --repos repo1,repo2` -- create a ticket
- `hlx comments post --ticket <id> "message"` -- reply to a ticket (pre-existing command)
- `hlx tickets rerun <ticket-id>` -- rerun a ticket
- `hlx tickets continue <ticket-id> "continuation context"` -- continue a ticket using the existing rerun endpoint with `continuationContext`

## Features Explicitly Out of Scope (MVP)

- **Full-text search backend** -- ticket listing with filters is sufficient for now.
- **Direct repo clone/checkout** -- the CLI does not manage local repos.
- **Auto-fixing or code modification** -- the CLI reads data and triggers actions, not code changes.
- **Auto-update / publish** -- release and distribution is a separate concern.
- **New backend workflows** -- the only backend change is exposing the existing `reporterUserId` field as a query parameter on `GET /api/tickets`.
- **Direct GitHub/Vercel API calls** -- the CLI always goes through the Helix backend.
- **Pagination** -- deferred; current single-request fetch is acceptable for existing ticket volumes.
- **Token refresh flow** -- expired JWTs fail; users re-login (default token TTL is 24h).
- **Test suite** -- no tests exist or are added for this iteration.

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Org switching persists | Switch org, run `hlx org current` and `hlx tickets list` to confirm new org context |
| 2 | Ticket listing at org scope | List tickets, apply `--user`, `--status`, `--status-not-in`, `--archived`, `--sprint` filters |
| 3 | Ticket detail is complete | `hlx tickets get <id>` shows branch, repos, runs, and merge status |
| 4 | Artifact discovery and reads work | `hlx tickets artifacts <id>` lists summaries; `hlx tickets artifact <id>` prints raw content |
| 5 | Codex bundle is deterministic | `hlx tickets bundle <id> --out <dir>` creates `ticket.json`, `manifest.json`, and artifact files |
| 6 | Ticket actions complete | Create, rerun, continue, and comment reply execute successfully |
| 7 | Continue uses rerun endpoint | `continuationContext` sent via `POST /tickets/:id/rerun`, not a separate backend concept |
| 8 | Clear error handling | Invalid org, missing ticket ID, bad input produce non-silent error messages |
| 9 | Thin client maintained | No client-side data invention; all data fetched from Helix backend APIs |

## Key Design Principles

1. **Thin client**: The CLI sends HTTP requests to Helix backend APIs. It does not compute, cache, or invent data.
2. **Org-scoped**: Every data command operates within the currently active org. Org switching is explicit and persistent.
3. **Two output modes**: Human-readable terminal output by default; structured local bundles for Codex.
4. **Zero production dependencies**: Node.js built-in APIs only. No CLI framework.
5. **Pattern consistency**: New command groups follow the established structure (switch-based subcommand router + individual handler files + shared `hxFetch`).

## Scope & Constraints

- **helix-cli** is the primary change target: 13 new source files across `src/org/` (4 files) and `src/tickets/` (10 files), config model update, CLI entry point routing, version bump to 1.2.0.
- **helix-global-server** requires a minimal change: ~5 lines across 2 files to add `reporterUserId` as an optional query parameter on `GET /api/tickets`. The column pre-exists on the Ticket model (100% populated in production); no schema migration needed.
- Auth is not redesigned. OAuth login produces session JWTs compatible with all ticket routes.
- Config schema is extended with `orgId` and `orgName` for persistent org context after switch.
- Manual login (`--manual` with `hxi_` keys) remains valid for its original inspection scope but does not grant access to ticket CRUD routes (those require session JWTs via `requireAuth` middleware).
- Bundle output goes to the user-specified `--out` directory; never writes into the repo by default.
- `--status` positive filter is client-side because the backend only supports `statusNotIn`. This is an acceptable trade-off for MVP.

## Future Considerations

- Pagination for large ticket lists (current single-request fetch works for ~381 tickets in production).
- `--json` output flag for all commands to support piping and scripting.
- Server-side positive `--status` filter to avoid client-side filtering overhead.
- Token refresh flow for long-lived CLI sessions.
- Richer artifact rendering (syntax highlighting, truncation controls).
- Auto-update and CLI distribution mechanism.

## Open Questions / Risks

| # | Question / Risk | Impact | Status |
|---|---|---|---|
| 1 | Inspection tokens (`hxi_`) may not have permissions for ticket CRUD routes that require session JWTs | Users who used `--manual` login cannot use new ticket commands | Open -- verify during runtime testing; OAuth login path produces the correct session JWT |
| 2 | No token refresh flow; expired JWTs fail all commands | Users must re-login after token expiration (default 24h TTL) | Accepted -- out of scope for this ticket |
| 3 | Bundle artifact fetch errors are caught and warned, not fatal | Users may get partial bundles if some artifacts are unavailable | Accepted -- partial bundle with warnings is the intended behavior |
| 4 | `--status` client-side filter fetches full ticket list before filtering | Performance concern for orgs with many tickets | Low risk for now (~381 tickets in production); consider server-side positive filter later |
| 5 | `hlx tickets latest` fetches full list client-side and takes first item | Wasteful if ticket volume grows | Low -- optimizable later with `limit=1` query param |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `helix-cli ticket.md` | Primary ticket specification | Full command surface, filters, constraints, acceptance criteria, non-negotiable constraints |
| `helix-cli scout/scout-summary.md` | CLI implementation state and architecture | 13 new files implemented, all commands functional, typecheck passes, zero deps |
| `helix-cli scout/reference-map.json` | File inventory, facts, and unknowns | 25 relevant files mapped with purposes, 5 unknowns identified, API endpoint mapping confirmed |
| `helix-cli diagnosis/diagnosis-statement.md` | Gap analysis and acceptance verification | Feature expansion confirmed complete; all acceptance criteria met; no blocking gaps |
| `helix-cli diagnosis/apl.json` | Evidence-backed diagnostic Q&A | Thin client confirmed, continue uses rerun correctly, no functional gaps |
| `helix-global-server scout/scout-summary.md` | Backend API surface and change scope | ~5 lines changed across 2 files; 14+ CLI routes pre-existed; auth architecture documented |
| `helix-global-server diagnosis/diagnosis-statement.md` | Server change assessment | Backward-compatible reporterUserId filter; column pre-existed at 100% population; no migration |
| `helix-global-server diagnosis/apl.json` | Server change correctness | Change follows established filter pattern; zero risk to existing behavior |
| `helix-global-server repo-guidance.json` | Cross-repo intent classification | helix-cli = primary target, helix-global-server = minor target |

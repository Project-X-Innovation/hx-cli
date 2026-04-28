# Product: Turn helix-cli into an org-aware Helix workbench for Codex

## Problem Statement

`helix-cli` is a narrow inspection tool with only three command groups (login, inspect, comments). Users who want to interact with Helix data and workflows from the terminal — or feed ticket context to Codex — have no CLI surface for org switching, ticket discovery, ticket inspection, artifact reads, local bundling, or ticket actions (create, rerun, continue). The backend already exposes the necessary APIs; the gap is entirely in CLI product surface.

## Product Vision

Transform `helix-cli` from a read-only inspection tool into a practical org-aware Helix workbench that lets users discover, inspect, and act on tickets entirely from the terminal. The CLI serves two complementary audiences: human operators who want readable terminal output, and Codex sessions that need deterministic local context.

## Users

| User | Need |
|---|---|
| **Developer using Helix** | Browse, filter, and inspect tickets across an org from the terminal without switching to the web UI |
| **Codex agent** | Load a ticket's full context (details, artifacts, run history) into a local directory for offline analysis and continuation |
| **Org admin / lead** | List tickets across the org, filter by user or status, and take actions (create, rerun, continue) from the CLI |

## Use Cases

1. **Org switching**: A user belongs to multiple orgs and needs to switch context before browsing tickets.
2. **Ticket discovery**: A developer lists recent tickets, filters by status (e.g., exclude archived), or finds the latest ticket in their org.
3. **Ticket inspection**: A developer gets full ticket detail — branch name, repos involved, run history, merge status — to understand where a ticket stands.
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
- `hlx org current` — show the active org and user
- `hlx org list` — show all orgs the user belongs to
- `hlx org switch <org>` — switch org; persist the new session token for all subsequent commands

### Ticket discovery
- `hlx tickets list` — list tickets in the current org
- `hlx tickets latest` — shortcut to the most recent ticket
- `hlx tickets get <ticket-id>` — full ticket detail (branch, repos, runs, merge status)

### Ticket filters
- `--user <email-or-name>` — filter by ticket reporter
- `--status <status>` — filter by status
- `--status-not-in <statuses>` — exclude statuses (comma-separated)
- `--archived` — include archived tickets
- `--sprint <sprint-id>` — filter by sprint

### Artifact inspection
- `hlx tickets artifacts <ticket-id>` — list available artifacts and step summaries
- `hlx tickets artifact <ticket-id> --step <step> --repo <repo>` — fetch and print raw artifact content

### Local Codex bundle
- `hlx tickets bundle <ticket-id> --out <dir>` — write ticket detail + artifacts to a deterministic local folder for Codex consumption

### Ticket actions
- `hlx tickets create --title "..." --description "..." --repos repo1,repo2` — create a ticket
- `hlx comments post --ticket <id> "message"` — reply to a ticket (existing, already works)
- `hlx tickets rerun <ticket-id>` — rerun a ticket
- `hlx tickets continue <ticket-id> "continuation context"` — continue a ticket using the existing rerun endpoint with `continuationContext`

## Features Explicitly Out of Scope (MVP)

- **Full-text search backend** — not needed; ticket listing with filters is sufficient.
- **Direct repo clone/checkout** — the CLI does not manage local repos.
- **Auto-fixing or code modification** — the CLI reads data and triggers actions, not code changes.
- **Auto-update / publish** — release and distribution is a separate concern.
- **New backend workflows** — the only backend change is exposing the existing `reporterUserId` field as a query parameter on the ticket list endpoint.
- **Direct GitHub/Vercel API calls** — the CLI always goes through the Helix backend.
- **Pagination UI** — defer to a future iteration if ticket volume demands it.

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Org switching persists and all subsequent commands use the new org | Switch org, then run `hlx org current` and `hlx tickets list` to confirm org context |
| 2 | Ticket listing and filtering works at org scope | List tickets, apply `--user`, `--status`, `--status-not-in`, `--archived`, `--sprint` filters |
| 3 | Ticket detail shows branch, repos, runs, and merge status | `hlx tickets get <id>` outputs all expected fields |
| 4 | Artifact discovery and reads work | `hlx tickets artifacts <id>` lists summaries; `hlx tickets artifact <id> --step --repo` prints raw content |
| 5 | Local Codex bundle writes deterministic output | `hlx tickets bundle <id> --out ./dir` creates a folder with ticket detail and artifact files |
| 6 | Ticket creation, rerun, and continue work | Each command completes successfully against the backend |
| 7 | Continue uses the existing rerun endpoint with `continuationContext` | No new backend "continue" concept introduced |
| 8 | Invalid inputs produce clear, non-silent errors | Bad org, missing ticket ID, invalid flags all surface helpful messages |
| 9 | CLI remains a thin client over backend APIs | No client-side data invention; all data fetched from Helix API |

## Key Design Principles

1. **Thin client**: The CLI sends HTTP requests to Helix backend APIs. It does not compute, cache, or invent data.
2. **Org-scoped**: Every data command operates within the currently active org. Org switching is explicit and persistent.
3. **Two output modes**: Human-readable terminal output by default; structured local bundles for Codex.
4. **Zero production dependencies**: The CLI maintains its current zero-dependency posture using Node.js built-in APIs only.
5. **Pattern consistency**: New command groups follow the same structure as existing `comments` and `inspect` commands — subcommand router + individual handler files + shared `hxFetch`.

## Scope & Constraints

- **helix-cli** is the primary change target (~12-15 new source files for org and ticket command groups).
- **helix-global-server** requires a minimal change: add `reporterUserId` as a query parameter to `GET /api/tickets` (~3 lines). The column already exists on the Ticket model; no migration needed.
- Auth is not redesigned. OAuth login already produces session JWTs compatible with ticket routes.
- Config schema (`{apiKey, url}`) is extended minimally for org switching — storing the new JWT after switch is sufficient.
- Manual login (`--manual` with `hxi_` keys) remains valid for its original inspection scope but will not support ticket CRUD routes (those require session JWTs).
- Bundle output (`--out`) defaults to a specified directory, never writing into the current repo directory unless the user explicitly opts in.

## Future Considerations

- Pagination for large ticket lists.
- `--json` output flag for all commands to support piping and scripting.
- Ticket search / full-text search if the backend adds it later.
- Auto-update and CLI publishing.
- Richer artifact rendering (e.g., syntax highlighting in terminal).

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|---|---|
| 1 | **How should `--user` resolve users?** The backend org members endpoint returns `{id, email, name}`. The CLI must map a user-supplied email or name to a `reporterUserId`. Whether to use email, name, or a fuzzy match is an UX decision. | Medium — affects usability of the `--user` filter |
| 2 | **What is the exact bundle folder structure?** Ticket says "deterministic local context folder" but the precise file layout (e.g., `ticket.json`, `artifacts/<step>/<repo>/...`) is not specified. | Medium — affects Codex integration contract |
| 3 | **Should `hlx tickets latest` be client-side or a dedicated endpoint?** Currently planned as client-side (take first from a sorted list). If ticket volume grows, this becomes wasteful. | Low — easy to optimize later with a `limit=1` param |
| 4 | **Token lifecycle after org switch**: The CLI stores one `apiKey`. After org switch, the old token is overwritten. If the switch fails mid-flight, the user may need to re-login. | Low — mitigable by only overwriting on confirmed success |
| 5 | **Inspection-key users lose access to new commands**: Users who logged in with `--manual` (hxi_ keys) will not be able to use ticket CRUD commands (session JWT required). The CLI should surface a clear error directing them to use OAuth login. | Low — documentation and error messaging |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `helix-cli/ticket.md` | Primary ticket specification | Defined full command surface, filters, constraints, acceptance criteria, and non-negotiable constraints |
| `helix-cli/scout/scout-summary.md` | CLI current state and expansion scope | Mapped all 14 CLI commands to backend endpoints; identified auth compatibility and pattern template |
| `helix-cli/scout/reference-map.json` | File inventory, facts, and unknowns | Confirmed 11 relevant files, zero-dep constraint, config schema, version mismatch, and 5 open unknowns |
| `helix-global-server/scout/scout-summary.md` | Backend API coverage analysis | Confirmed near-complete API coverage; identified single `--user` filter gap |
| `helix-global-server/scout/reference-map.json` | Backend file inventory and facts | Confirmed 10 relevant server files, all endpoint shapes, auth middleware, and TicketStatus enum |
| `helix-cli/diagnosis/diagnosis-statement.md` | Root cause analysis for CLI | Confirmed feature-addition gap, auth compatibility, clean patterns, zero-dep constraint |
| `helix-cli/diagnosis/apl.json` | Diagnosis Q&A with evidence | Confirmed OAuth → session JWT flow, config sufficiency for org switch, ~3-line backend fix |
| `helix-global-server/diagnosis/diagnosis-statement.md` | Backend gap analysis | Confirmed only `reporterUserId` query param is missing; ~3 lines, no migration |
| `helix-global-server/diagnosis/apl.json` | Backend diagnosis Q&A | Confirmed no other backend gaps exist beyond reporterUserId |
| `helix-global-server/repo-guidance.json` | Repo intent guidance | Confirmed helix-cli as primary target, helix-global-server as minor target |

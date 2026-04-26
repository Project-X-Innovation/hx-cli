# Tech Research: helix-cli

## Technology Foundation

| Aspect | Value |
|---|---|
| Runtime | Node.js >= 18 |
| Language | TypeScript 6.x, strict mode |
| Module system | ESM (`"type": "module"`, Node16 resolution, `.js` extensions) |
| Target | ES2022 |
| Dependencies | Zero production dependencies; `@types/node` + `typescript` dev-only |
| Build | `tsc` (produces `dist/` output) |
| Quality gates | `tsc --noEmit` (typecheck, passes with 0 errors); no lint or test configured |
| Distribution | `"bin": { "hlx": "dist/index.js" }` via npm package `@projectxinnovation/helix-cli` |
| Version | 1.2.0 (bumped from 0.1.0) |

The CLI uses only Node.js built-in APIs (`fs`, `path`, `os`, `fetch`) and has zero npm production dependencies. This is a deliberate architectural constraint maintained by this ticket.

## Architecture Decision

### Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A. Manual switch-based routing (chosen)** | Extend the existing manual command dispatch pattern: `src/index.ts` switch -> command group routers (`src/org/index.ts`, `src/tickets/index.ts`) -> individual handler files | Zero deps maintained; consistent with existing `comments/` and `inspect/` patterns; simple and auditable | Manual flag parsing is verbose; no built-in help generation or argument validation |
| B. CLI framework (commander/yargs) | Adopt a CLI framework for structured command parsing, help generation, and argument validation | Better DX for complex commands; auto-generated help; type-safe args | Adds production dependency (violates zero-deps constraint); migration cost for existing commands; framework lock-in |
| C. Monolithic single-file handler | Add all new commands directly in `src/index.ts` | Minimal new files | Unreadable at scale; no separation of concerns; hard to maintain |

### Chosen Option: A. Manual switch-based routing

**Rationale**: The ticket explicitly requires "zero production dependencies" (confirmed in product spec and existing architecture). The manual dispatch pattern is already established in `src/comments/index.ts` and `src/inspect/index.ts`. Extending it to `src/org/` and `src/tickets/` is the smallest correct change. The 13 new source files follow a clean 1-file-per-handler pattern that is easy to navigate.

## Core API/Methods

### CLI-to-Backend API Mapping

All CLI commands are thin wrappers over existing Helix backend endpoints. The only new endpoint behavior is `reporterUserId` on `GET /api/tickets`.

| CLI Command | HTTP Method | Endpoint | Notes |
|---|---|---|---|
| `hlx org current` | GET | `/api/auth/me` | Returns user + org + availableOrgs |
| `hlx org list` | GET | `/api/auth/me` | Extracts `availableOrganizations` array |
| `hlx org switch <org>` | POST | `/api/auth/switch-org` | Body: `{organizationId}`. Returns new `accessToken` |
| `hlx tickets list` | GET | `/api/tickets` | Query: `archived`, `statusNotIn`, `sprintId`, `reporterUserId` |
| `hlx tickets latest` | GET | `/api/tickets` | Takes first item from list (sorted by `updatedAt desc`) |
| `hlx tickets get <id>` | GET | `/api/tickets/:ticketId` | Full detail: branch, repos, runs, merge status |
| `hlx tickets create` | POST | `/api/tickets` | Body: `{title, description, repositoryIds}` |
| `hlx tickets rerun <id>` | POST | `/api/tickets/:ticketId/rerun` | Body: `{}` |
| `hlx tickets continue <id>` | POST | `/api/tickets/:ticketId/rerun` | Body: `{continuationContext}` |
| `hlx tickets artifacts <id>` | GET | `/api/tickets/:ticketId/artifacts` | Returns `items[]` + `stepArtifactSummary[]` |
| `hlx tickets artifact <id>` | GET | `/api/tickets/:id/runs/:rid/step-artifacts/:sid` | Query: `repoKey`. Returns `files[{filename, content}]` |
| `hlx tickets bundle <id>` | Multiple | GET ticket detail + GET artifacts + GET each step artifact | Writes deterministic local directory |
| `hlx comments post` | POST | `/api/tickets/:id/comments` | Pre-existing |

### Shared Infrastructure

- **`hxFetch(config, path, options)`** (`src/lib/http.ts`): Unified HTTP client with 3-attempt retry, exponential backoff (2s base + jitter), 30s timeout, Retry-After support for 429s. Auth dispatch: `hxi_*` -> `X-API-Key`, else -> `Bearer`. New commands use `basePath: "/api"` (vs. `/api/inspect` for inspection commands).
- **`loadConfig() / saveConfig()`** (`src/lib/config.ts`): Persists `{apiKey, url, orgId?, orgName?}` to `~/.hlx/config.json`. Env vars (`HELIX_API_KEY`, `HELIX_URL`) take priority. Org switch replaces `apiKey` with new session JWT.
- **`getFlag() / hasFlag() / requireFlag() / getPositionalArgs()`** (`src/lib/flags.ts`): Consolidated manual `indexOf`-based flag parsing shared across all command groups.
- **`resolveTicketId(args)`** (`src/tickets/index.ts`): Resolves ticket ID from `--ticket` flag -> `HELIX_TICKET_ID` env var -> first positional arg.

## Technical Decisions

### 1. Auth model: Session JWT for ticket routes, inspection tokens for inspect/comments

**Decision**: The CLI stores a single `apiKey` field. When the token starts with `hxi_`, it sends `X-API-Key`; otherwise it sends `Authorization: Bearer`. Ticket CRUD routes require session JWTs (behind `requireAuth` middleware). Inspection and comment routes accept either token type.

**Rationale**: This matches the existing server auth architecture with zero changes. OAuth login produces session JWTs that work for all routes. Manual login (`hlx login --manual`) with `hxi_` keys works only for inspect/comments (the original scope).

**Rejected alternative**: Refactoring auth to make inspection tokens work for ticket CRUD. This would violate the "do not redesign auth" constraint.

### 2. Org switch: Replace stored JWT with new org-scoped token

**Decision**: `hlx org switch` calls `POST /api/auth/switch-org`, receives a new `accessToken` JWT scoped to the target org, and replaces the stored `apiKey` in `~/.hlx/config.json`. Also persists `orgId` and `orgName` for display. Org is resolved by name (via `/auth/me` availableOrganizations) or directly by CUID.

**Rationale**: The server issues new JWTs with `orgId` in the payload on org switch. The CLI must store this new token because all subsequent API calls need to authenticate against the new org. Write-on-success only: config is only updated after a successful switch.

**Risk**: Token TTL is 24h (configurable via `ACCESS_TOKEN_TTL_MINUTES`). No refresh flow exists; expired tokens fail all commands. Users must re-login. Accepted as out of scope per product spec.

### 3. `--user` filter: Client-side user resolution + server-side `reporterUserId` query

**Decision**: The CLI resolves `--user <email-or-name>` to a `reporterUserId` by calling `GET /api/organization/members`. It tries exact email match first, then case-insensitive name match. The resolved ID is sent as a query parameter to `GET /api/tickets?reporterUserId=<id>` (new server-side filter).

**Rationale**: The backend had no user resolution endpoint that accepts email/name and returns a user ID for filtering. The two-step approach (resolve user -> filter tickets) uses two existing endpoints with one ~5-line server change to accept `reporterUserId`. This is the minimal path.

**Rejected alternative**: Fuzzy/partial matching -- adds ambiguity inappropriate for CLI tooling. Also rejected: server-side email/name resolution -- mixes concerns in the ticket controller.

### 4. `--status` filter: Client-side positive match

**Decision**: The `--status` flag filters tickets client-side because the backend `GET /api/tickets` only supports `statusNotIn` (negative filter), not a positive `status` filter.

**Rationale**: Adding a server-side positive status filter would require additional server changes for minimal gain at current ticket volumes (~381 tickets). The client-side approach is a pragmatic MVP trade-off.

**Trade-off**: This fetches the full ticket list before filtering. Acceptable at current scale; documented as a future optimization opportunity.

### 5. `continue` command: Reuse `rerun` endpoint with `continuationContext`

**Decision**: `hlx tickets continue <id> "context"` calls `POST /api/tickets/:id/rerun` with `{continuationContext}` in the body. The server's rerun endpoint already accepts `continuationContext?: string` (max 10000 chars, stored in `SandboxRun.continuationContext`).

**Rationale**: Non-negotiable constraint: "Do not create a separate backend 'continue' concept." The rerun endpoint already supports this exact behavior. The CLI simply exposes it as a user-friendly command. Positional args after the ticket ID are joined with spaces to form the context string.

### 6. Bundle format: Deterministic local directory

**Decision**: `hlx tickets bundle <id> --out <dir>` writes:
- `ticket.json` -- full ticket detail (raw JSON from GET /api/tickets/:id)
- `manifest.json` -- `{ticketId, bundledAt, cliVersion}` (cliVersion hardcoded as "1.2.0")
- `artifacts/<stepId>/<repoKey>/<filename>` -- step artifact content files

**Rationale**: Codex/AI agents need a predictable, self-contained directory layout. The `manifest.json` provides provenance. Artifact files are organized by step and repo, mirroring the backend's `stepArtifactSummary` structure. Partial bundles with warnings are acceptable.

**Rejected alternative**: Flat file layout -- ambiguous when multiple repos/steps share similar filenames.

### 7. Error handling: Graceful degradation for artifact fetches

**Decision**: Bundle artifact fetch failures log a warning to stderr and continue (not fatal). All other command errors use `process.exit(1)` with clear error messages. Missing ticket ID errors list the three resolution options (--ticket, HELIX_TICKET_ID, positional).

**Rationale**: Some artifacts may be unavailable (permissions, incomplete runs, non-terminal ticket status). A partial bundle with warnings is more useful than a fatal error that produces nothing.

### 8. Flag parsing: Consolidated shared module

**Decision**: Flag utilities consolidated in `src/lib/flags.ts` with `getFlag()`, `hasFlag()`, `requireFlag()`, `getPositionalArgs()`. All command groups import from this shared module.

**Rationale**: Eliminates duplication that previously existed across `comments/index.ts`, `comments/list.ts`, `inspect/index.ts`. New ticket commands add ~10 more consumers of these utilities.

### 9. `hlx tickets latest`: Client-side first-item selection

**Decision**: Fetches the full ticket list (backend returns sorted by `updatedAt desc`), takes `items[0]`, then calls `printTicketDetail` for full output.

**Rationale**: Avoids a new backend endpoint for a convenience shortcut. Wasteful at scale; optimizable with `limit=1` query param later.

## Cross-Platform Considerations

- **Config path**: `~/.hlx/config.json` uses `os.homedir()`, which works on macOS, Linux, and Windows.
- **File operations**: Uses `node:fs` built-ins with `mkdirSync(..., {recursive: true})`, portable across platforms.
- **Path separators**: Uses `node:path.join()`, handles OS-specific separators.
- **Browser open (login)**: Already handles macOS (`open`), Linux (`xdg-open`), Windows (`start`).
- **Node.js >= 18**: Required for built-in `fetch` API. This is the minimum viable version.

## Performance Expectations

| Operation | Expected behavior | Scale concern |
|---|---|---|
| Ticket list | Single HTTP request, returns full list | ~381 tickets currently; acceptable. Pagination deferred. |
| `--status` filter | Client-side filter on full list | Linear scan, negligible at current scale |
| `--user` filter | 2 HTTP requests (members + filtered tickets) | Members list is small per org; server-side filter limits ticket response |
| `hlx tickets latest` | Fetches full list, takes first item | Wasteful at scale; optimizable with `limit=1` query param later |
| Bundle | 1 + N+1 HTTP requests (detail + artifacts summary + N step-artifact fetches) | Sequential fetches. Acceptable for typical artifact counts (~10-20). Parallelization deferred. |
| HTTP retry | 3 attempts, exponential backoff (2s base + jitter) | 30s timeout per request. Retry-After header respected for 429s. |
| CLI startup | Near-instant; no framework initialization, no dependency loading | N/A |

## Dependencies

### helix-cli (primary target)

| Dependency | Type | Purpose |
|---|---|---|
| Node.js >= 18 | Runtime | Built-in `fetch`, ESM support, `fs`, `path`, `os` |
| TypeScript ^6.0.2 | Dev | Compilation, type checking |
| @types/node ^25.5.0 | Dev | Node.js type definitions |

**Zero production dependencies** -- maintained by design.

### Backend API Dependencies (External)

The CLI depends on these pre-existing Helix backend endpoints being available and stable:

- `GET /api/auth/me` -- User/org context
- `POST /api/auth/switch-org` -- Org switch + new JWT
- `GET /api/tickets` -- Ticket list with filters (modified: added `reporterUserId`)
- `GET /api/tickets/:id` -- Ticket detail
- `POST /api/tickets` -- Ticket creation
- `POST /api/tickets/:id/rerun` -- Rerun/continue
- `GET /api/tickets/:id/artifacts` -- Artifact discovery
- `GET /api/tickets/:id/runs/:rid/step-artifacts/:sid` -- Step artifact content
- `GET /api/organization/members` -- User resolution for `--user` filter
- `GET/POST /api/tickets/:id/comments` -- Comment list/post (pre-existing)

### Cross-Repo Deployment Dependency

The CLI's `--user` filter requires the server-side `reporterUserId` query param to be deployed. If the backend change is not yet live, the extra query param is silently ignored by Express (no error) and the filter becomes a no-op. The CLI can ship before or simultaneously with the backend update.

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Inspection tokens (`hxi_`) cannot access ticket CRUD routes | Medium | Users who used `hlx login --manual` cannot use new ticket commands | Server returns 401/403; clear error directs to re-login with OAuth |
| 2 | Token expiration (24h TTL) with no refresh flow | Certain | Users must re-login after 24h | Out of scope per product spec; CLI error message directs to re-login |
| 3 | `--status` client-side filter fetches full list | Low (current scale) | Performance degradation at high ticket counts | Monitor ticket volumes; add server-side positive status filter later |
| 4 | `hlx tickets latest` fetches full list | Low (current scale) | Unnecessary data transfer at scale | Add `limit=1` query param to backend later |
| 5 | No tests for any CLI commands | Medium | Regressions undetectable without manual testing | Out of scope per product spec; runtime verification planned |
| 6 | Bundle artifact fetch errors produce partial bundles | Low | Users may not notice missing artifacts | Warnings printed to stderr for each failed artifact |
| 7 | Backend deploy timing for `--user` filter | Low | `--user` becomes no-op if backend not updated | Extra query param silently ignored; no error |

## Deferred to Round 2

- **Pagination**: Backend returns all matching tickets; add `limit`/`offset` when volume grows.
- **`--json` output flag**: All commands output human-readable text; machine-readable JSON output deferred.
- **Server-side positive `--status` filter**: Replace client-side filtering once backend supports it.
- **Token refresh flow**: Automatic JWT refresh for long-lived sessions.
- **Bundle parallelization**: Fetch step artifacts in parallel instead of sequentially.
- **Richer artifact rendering**: Syntax highlighting, truncation controls for terminal output.
- **Test suite**: Unit and integration tests for CLI commands.
- **Tab completion**: Shell completion scripts for bash/zsh.

## Summary Table

| Dimension | Decision |
|---|---|
| Architecture | Thin CLI client over existing Helix backend API; switch-based manual command routing |
| New CLI files | 13 files across `src/org/` (4) and `src/tickets/` (10), plus config model update and entry point routing |
| Server change | ~5 lines across 2 files: `reporterUserId` query param on `GET /api/tickets` |
| Dependencies | Zero production deps maintained; Node.js >= 18 built-in APIs only |
| Auth model | Session JWT for ticket routes; inspection tokens for inspect/comments only |
| Org switching | New JWT persisted on switch; `orgId`/`orgName` in config for display |
| User filter | 2-step: resolve via `/organization/members` -> filter via `reporterUserId` server param |
| Status filter | `statusNotIn` server-side; positive `status` client-side |
| Continue | Reuses `POST /tickets/:id/rerun` with `{continuationContext}` |
| Bundle | Deterministic directory: `ticket.json`, `manifest.json`, `artifacts/<step>/<repo>/<file>` |
| Error handling | Graceful degradation for artifact fetches; `process.exit(1)` for input errors |
| Flag parsing | Consolidated shared `src/lib/flags.ts` module |
| Version | 1.2.0 (aligned between package.json and src/index.ts) |

## APL Statement Reference

See `tech-research/apl.json`. All questions resolved with followups=[].

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `helix-cli ticket.md` | Primary ticket specification | Full command surface, 9 ticket + 3 org subcommands, non-negotiable constraints, acceptance criteria |
| `helix-cli scout/reference-map.json` | File inventory and implementation facts | 25 files mapped; 13 new files; typecheck passes; zero deps; ESM with .js extensions |
| `helix-cli scout/scout-summary.md` | Architecture patterns and quality gates | Switch-based routing, manual flag parsing, hxFetch shared client, config persistence model |
| `helix-cli diagnosis/diagnosis-statement.md` | Gap analysis and completeness check | All acceptance criteria met; no blocking gaps; non-blocking concerns (no tests, no token refresh) |
| `helix-cli diagnosis/apl.json` | Evidence-backed diagnostic answers | Thin client confirmed; continue uses rerun correctly; --status client-side intentional |
| `helix-cli product/product.md` | Product vision and scope | Two audiences (human + Codex); org-scoped design; zero deps constraint; deferred features listed |
| `helix-global-server scout/scout-summary.md` | Backend API surface and change scope | 14+ routes pre-existed; ~5 lines changed; Prisma ORM; auth architecture |
| `helix-global-server diagnosis/diagnosis-statement.md` | Server change correctness | reporterUserId filter backward-compatible; column 100% populated; no migration needed |
| `helix-global-server diagnosis/apl.json` | Server change risk assessment | Follows established filter pattern; zero risk to existing behavior |
| `helix-global-server product/product.md` | Cross-repo product scope | Server is minor target; only reporterUserId addition |
| `repo-guidance.json` | Cross-repo intent | helix-cli = primary target, helix-global-server = minor target |
| `src/index.ts` (helix-cli, direct inspection) | CLI entry point | Verified 5 command groups routed; version 1.2.0; usage text covers all commands |
| `src/lib/http.ts` (helix-cli, direct inspection) | HTTP client | Retry/timeout/auth logic verified; basePath routing confirmed |
| `src/lib/config.ts` (helix-cli, direct inspection) | Config model | HxConfig type with orgId/orgName; env var priority; saveConfig persistence |
| `src/tickets/*.ts` (helix-cli, direct inspection) | Command implementations | All 9 subcommands verified; patterns consistent; error handling present |
| `src/org/switch.ts` (helix-cli, direct inspection) | Org switch | CUID detection; name resolution via /auth/me; new JWT + org metadata saved |
| `src/controllers/ticket-controller.ts` (server, direct inspection) | Controller change | Lines 206-209: reporterUserId parsed; line 211: passed to service |
| `src/services/ticket-service.ts` (server, direct inspection) | Service change | Line 1479: signature updated; line 1530: conditional WHERE clause |
| Runtime inspection manifest | Available checks | DATABASE and LOGS for helix-global-server; used by diagnosis for column/population verification |

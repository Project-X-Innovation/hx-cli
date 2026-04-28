# Tech Research: Turn helix-cli into an org-aware Helix workbench for Codex

## Technology Foundation

- **Runtime**: Node.js >= 18 (per `package.json` engines field)
- **Language**: TypeScript 6.x, strict mode, ESM (`"module": "Node16"`)
- **Build**: `tsc` only; no bundler. Output to `dist/`, bin entry at `dist/index.js`
- **Dependencies**: Zero production dependencies (only `@types/node` and `typescript` as devDeps). This constraint is maintained for all new code.
- **HTTP Client**: Built-in `fetch` API (Node 18+) via existing `hxFetch` wrapper in `src/lib/http.ts`
- **Filesystem**: Node.js built-in `fs`, `path`, `os` modules for config and bundle output
- **Backend**: helix-global-server (Express 5 + Prisma + Zod). Requires only a ~3-line change to expose `reporterUserId` on ticket listing.

## Architecture Decision

### Option A: CLI Framework (commander/yargs) - REJECTED

Introduce a CLI framework like `commander` or `yargs` for parsing and routing.

- **Pro**: Automatic help generation, flag parsing, validation, subcommand nesting
- **Con**: Violates the zero-production-dependency constraint. The existing manual pattern works well and is already battle-tested across 3 command groups (login, inspect, comments).
- **Rejected because**: The ticket explicitly requires zero production dependencies. The existing manual routing pattern is sufficient for the expansion scope.

### Option B: Extend Existing Patterns - CHOSEN

Add new command groups (`org`, `tickets`) following the same architecture as existing `comments` and `inspect`:

1. **Top-level router**: `src/index.ts` switch-case adds `"org"` and `"tickets"` cases
2. **Group router**: `src/org/index.ts` and `src/tickets/index.ts` handle subcommand dispatch
3. **Individual handlers**: One file per command (e.g., `src/tickets/list.ts`, `src/org/switch.ts`)
4. **Shared HTTP**: All commands use `hxFetch` with `basePath: "/api"`
5. **Shared flag parsing**: Extract `getFlag()`, `getPositionalArgs()`, and `hasFlag()` into `src/lib/flags.ts` to eliminate duplication across `comments/index.ts`, `comments/list.ts`, `inspect/index.ts`, and all new command files

**Rationale**: Maintains zero-dep constraint, follows established patterns (minimizes learning curve for contributors), and keeps the codebase consistent. The manual switch-based routing is adequate for ~14 subcommands.

### Option C: Config Redesign for Org Awareness - REJECTED

Redesign config schema to store org ID, org name, token type, multi-org tokens, etc.

- **Rejected because**: The ticket says "do not redesign auth." The existing `{apiKey, url}` schema is sufficient. On org switch, POST `/api/auth/switch-org` returns a new `accessToken` (JWT encoding the new orgId). The CLI simply overwrites `apiKey` with the new JWT. Optionally storing org name/id is a minor UX enhancement, not a redesign.

### Chosen Approach: Minimal Config Extension

Extend `HxConfig` type to:
```
{ apiKey: string; url: string; orgId?: string; orgName?: string }
```
- `orgId` and `orgName` are set on successful org switch (allows `hlx org current` without a network call)
- `loadConfig()` reads them if present but does not require them (backward-compatible)
- `saveConfig()` writes them when provided
- Existing env-var priority (`HELIX_API_KEY`, `HELIX_URL`) remains unchanged

## Core API/Methods

### Backend Endpoints Consumed by New CLI Commands

| CLI Command | Method | Endpoint | Key Request Params | Key Response Fields |
|---|---|---|---|---|
| `hlx org current` | GET | `/api/auth/me` | - | `user.{id,email,name,organizationId}`, `organization.{id,name}` |
| `hlx org list` | GET | `/api/auth/me` | - | `availableOrganizations[{id,name}]` |
| `hlx org switch` | POST | `/api/auth/switch-org` | `{organizationId}` | `{accessToken, user, organization, availableOrganizations}` |
| `hlx tickets list` | GET | `/api/tickets` | `?archived&statusNotIn&sprintId&reporterUserId` | `{items[{id,title,status,shortId,branchName,reporter,...}]}` |
| `hlx tickets latest` | GET | `/api/tickets` | (same, client takes first) | (same, first item) |
| `hlx tickets get` | GET | `/api/tickets/:ticketId` | - | Full ticket detail incl. `runs[]`, `repositories[]`, `branchName`, `mergeQueueStatus` |
| `hlx tickets create` | POST | `/api/tickets` | `{title, description, repositoryIds[]}` | `{ticket:{id,title,status,repositories[],runId}}` |
| `hlx tickets rerun` | POST | `/api/tickets/:ticketId/rerun` | `{}` (empty body) | `{started, runId, ticket}` |
| `hlx tickets continue` | POST | `/api/tickets/:ticketId/rerun` | `{continuationContext}` | (same as rerun) |
| `hlx tickets artifacts` | GET | `/api/tickets/:ticketId/artifacts` | `?runId` (optional) | `{items[{id,label,repoUrl,runId,branch,path,url}], stepArtifactSummary[{stepId,repoKey}]}` |
| `hlx tickets artifact` | GET | `/api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId` | `?repoKey` | `{stepId, repoKey, files[{name,content,contentType}]}` |
| `hlx tickets bundle` | Multiple GETs | (ticket detail + artifacts + step artifacts) | - | Composed locally |
| `--user` resolution | GET | `/api/organization/members` | - | `{members[{id,email,name}]}` |

### Backend Change: reporterUserId Filter

The only backend change needed is adding `reporterUserId` support to `GET /api/tickets`:

1. **ticket-controller.ts:190-208** (`getTickets`): Parse `reporterUserId` from `req.query`, pass to service options
2. **ticket-service.ts:1522-1530** (`listTicketsForOrganization`): Add `...(options?.reporterUserId ? { reporterUserId: options.reporterUserId } : {})` to the Prisma where-clause
3. **ticket-service.ts:1479** (options type): Add `reporterUserId?: string` to the options type

The `Ticket` model already has `reporterUserId` as a String field (schema.prisma:306). No schema migration needed. The `userId` option already exists but is used only for comment unread tracking (lines 1626-1629); `reporterUserId` is a separate filter concern.

## Technical Decisions

### 1. `--user` Resolution Strategy

**Decision**: Exact-match on email first; fall back to case-insensitive name match.

**Implementation**:
1. CLI calls `GET /api/organization/members` to fetch `[{id, email, name}]`
2. Try exact email match: `members.find(m => m.email === userInput)`
3. If no match, try case-insensitive name match: `members.find(m => m.name?.toLowerCase() === userInput.toLowerCase())`
4. If still no match, error with "User not found. Available users: ..."
5. Pass the resolved `id` as `reporterUserId` query param to `GET /api/tickets`

**Rejected alternative**: Fuzzy/partial matching. Adds complexity and ambiguity; exact match is clearer and more predictable for a CLI tool.

### 2. Bundle Folder Structure

**Decision**: Deterministic nested layout:

```
<out-dir>/
  ticket.json              # Full ticket detail (GET /api/tickets/:id response)
  artifacts/
    <step-id>/
      <repo-key>/
        <filename>         # Raw artifact file content
  manifest.json            # Bundle metadata (ticket ID, bundle timestamp, CLI version)
```

**Rationale**:
- `ticket.json` gives Codex the full ticket context (title, description, branch, repos, runs, status)
- Artifacts organized by step/repo mirror the backend's `stepArtifactSummary` structure
- `manifest.json` provides provenance metadata for deterministic reproducibility
- Files use the original filenames from the step-artifacts response (`files[].name`)

**Rejected alternative**: Flat file layout (all artifacts in one directory). Too ambiguous when multiple repos/steps share similar filenames.

### 3. `hlx tickets latest` Implementation

**Decision**: Client-side (take first item from the sorted ticket list response).

The backend already returns tickets sorted by `updatedAt: "desc"`. The CLI fetches the list and takes `items[0]`.

**Rationale**: Avoids adding a backend endpoint for a convenience shortcut. The list response includes enough data for a detail view. If ticket volume becomes a concern, the backend can later accept a `limit` query param.

**Rejected alternative**: Dedicated backend endpoint. Over-engineering for MVP; the sorted list already provides this.

### 4. Token Lifecycle on Org Switch

**Decision**: Write-on-success only.

1. Call `POST /api/auth/switch-org` with `{organizationId}`
2. Only if response is successful (200), overwrite `apiKey` in config with the new `accessToken`
3. Also persist `orgId` and `orgName` from the response for UX

**Rationale**: If the request fails, the existing token remains valid. The user does not need to re-login after a failed switch attempt.

### 5. Auth Error Handling for hxi_ Keys

**Decision**: When a command requires session auth and the stored token starts with `hxi_`, surface a clear error before making the request.

```
Error: This command requires OAuth authentication. 
Your current session uses an inspection key (hxi_...).
Run `hlx login <server-url>` to authenticate with OAuth.
```

**Rationale**: The backend returns a generic 401/403 for inspection keys on ticket routes. A client-side pre-check provides a better UX by directing the user to the fix immediately.

### 6. Flag Parsing Consolidation

**Decision**: Extract shared flag utilities into `src/lib/flags.ts`.

Functions:
- `getFlag(args, flag)` — returns flag value or undefined
- `hasFlag(args, flag)` — returns boolean for presence-only flags (e.g., `--archived`)
- `getPositionalArgs(args, excludeFlags)` — returns non-flag args
- `requireFlag(args, flag, errorMsg)` — getFlag + error if missing

**Rationale**: `getFlag` is currently duplicated in `src/comments/index.ts`, `src/comments/list.ts`, and `src/inspect/index.ts`. New command groups would add more duplication. A single shared module eliminates this.

### 7. Version Fix

**Decision**: Read version from `package.json` at runtime or align the hardcoded value.

The current `src/index.ts:47` hardcodes `"0.1.0"` while `package.json` says `"1.2.0"`. Fix by importing from a version constant or using `createRequire` to read `package.json`.

Simplest approach: update the hardcoded string to match `package.json`. (Zero-dep constraint makes dynamic `package.json` reading slightly awkward in ESM, but doable via `import.meta.url` + `readFileSync`.)

## Cross-Platform Considerations

- **Config path**: `~/.hlx/config.json` via `os.homedir()` — works on macOS, Linux, Windows
- **Bundle output**: Uses `node:fs` and `node:path` — cross-platform by default
- **Browser open (login)**: Already handles macOS (`open`), Linux (`xdg-open`), Windows (`start`) in `src/login.ts`
- **ESM imports**: All use `.js` extensions as required by Node16 module resolution

## Performance Expectations

- **CLI startup**: Near-instant. No framework initialization, no dependency loading.
- **Network latency**: Dominated by backend response times. `hxFetch` has 30s timeout with 3 retries + exponential backoff.
- **Bundle command**: Sequential fetches (ticket detail → artifact list → step artifacts for each step/repo). For a ticket with N step-artifact entries, this is O(N+2) HTTP requests. Acceptable for interactive use; could be parallelized in future if needed.
- **Memory**: Minimal. All responses are small JSON payloads. Artifact files may be larger (markdown/JSON documents) but are written to disk immediately via streaming.

## Dependencies

### helix-cli
- **No new production dependencies.** All functionality uses Node.js built-in APIs.
- **Dev dependencies unchanged**: `@types/node ^25.5.0`, `typescript ^6.0.2`

### helix-global-server
- **No new dependencies.** The ~3-line change uses existing Prisma client and Express infrastructure.
- **No database migration.** The `reporterUserId` column already exists on the `Ticket` model.

### Cross-Repo Dependency
- helix-cli's `--user` filter requires the helix-global-server `reporterUserId` backend change to be deployed first (or simultaneously). If the backend change is not yet live, the `--user` filter will receive an error or be ignored by the server. The CLI should handle this gracefully (the extra query param is ignored by the current backend, so no hard failure).

## Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Backend deploy timing**: CLI `--user` depends on backend `reporterUserId` support | Low | Extra query param is ignored by current backend; filter silently becomes a no-op until backend is updated |
| 2 | **Token expiry during bundle**: Long bundle operations may see JWT expire mid-flight | Low | `hxFetch` retry logic handles 401; user can re-login. Bundle can be re-run idempotently |
| 3 | **Large ticket lists without pagination**: Orgs with many tickets may receive large responses | Low | Defer pagination to future iteration per product decision; current response sizes are manageable |
| 4 | **Artifact content size**: Step artifacts could be large markdown files | Low | Files are written directly to disk; no in-memory accumulation concern beyond the JSON response |
| 5 | **Breaking change to backend API**: Future backend changes could break CLI assumptions | Low | CLI is a thin wrapper; tight coupling is intentional and version-aligned |

## Deferred to Round 2

- **Pagination**: Add `--page` / `--limit` flags and backend `limit`/`offset` support when ticket volume demands it
- **`--json` output mode**: Add `--json` flag for all commands to support piping and scripting
- **Artifact syntax highlighting**: Richer terminal rendering for markdown/JSON artifacts
- **Parallel bundle fetches**: Speed up `hlx tickets bundle` by fetching step artifacts in parallel
- **Auto-update**: CLI version checking and self-update mechanism
- **Tab completion**: Shell completion scripts for bash/zsh

## Summary Table

| Aspect | Decision |
|---|---|
| **Primary repo** | helix-cli (~12-15 new source files) |
| **Secondary repo** | helix-global-server (~3-line change) |
| **Architecture** | Extend existing switch-based routing pattern |
| **Dependencies** | Zero new production deps |
| **Config change** | Add optional `orgId`/`orgName` to `HxConfig` |
| **Auth** | Existing OAuth → session JWT works; no redesign |
| **Backend change** | Add `reporterUserId` query param to `GET /api/tickets` |
| **Migration** | None needed |
| **Bundle layout** | `ticket.json` + `artifacts/<step>/<repo>/<file>` + `manifest.json` |
| **User resolution** | Email exact match → name case-insensitive match → error |
| **Latest ticket** | Client-side (first from sorted list) |
| **Flag parsing** | Extract shared `src/lib/flags.ts` utility |
| **Version fix** | Align hardcoded version with `package.json` |

## APL Statement Reference

See `tech-research/apl.json` for the complete APL record. Key findings:
- The CLI expansion is a feature-addition task following clean existing patterns.
- Backend API coverage is near-complete; only `reporterUserId` filter is missing.
- Auth compatibility is confirmed: OAuth login produces session JWTs that pass `requireAuth`.
- Zero-dep constraint is maintained throughout.
- Bundle structure and `--user` resolution are the two design decisions not specified in the ticket that this research resolves.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `helix-cli/ticket.md` | Primary specification | Defined full command surface, constraints, acceptance criteria |
| `helix-global-server/ticket.md` | Cross-repo specification | Confirmed same ticket scope applies to both repos |
| `helix-cli/diagnosis/diagnosis-statement.md` | Root cause analysis | Confirmed feature-addition gap, auth compatibility, clean patterns |
| `helix-cli/diagnosis/apl.json` | Diagnosis evidence | Confirmed OAuth JWT flow, config sufficiency, backend API mapping |
| `helix-global-server/diagnosis/diagnosis-statement.md` | Backend gap analysis | Confirmed only `reporterUserId` is missing; ~3 lines, no migration |
| `helix-global-server/diagnosis/apl.json` | Backend evidence | Confirmed all endpoints present; single filter gap |
| `helix-cli/product/product.md` | Product direction | Defined command surface, UX principles, open questions, bundle concept |
| `helix-global-server/product/product.md` | Cross-repo product context | Same product spec confirms server scope is minimal |
| `helix-cli/scout/scout-summary.md` | CLI architecture analysis | Mapped current command surface, patterns, and expansion plan |
| `helix-cli/scout/reference-map.json` | CLI file inventory | Identified 11 relevant files, zero-dep constraint, version mismatch |
| `helix-global-server/scout/scout-summary.md` | Backend API mapping | Confirmed all needed endpoints exist with response shapes |
| `helix-global-server/scout/reference-map.json` | Backend file inventory | Confirmed endpoint signatures, auth middleware, TicketStatus enum |
| `repo-guidance.json` | Repo intent | Confirmed helix-cli as primary target, helix-global-server as minor target |
| `src/index.ts` (helix-cli) | Direct code inspection | Verified switch-based routing pattern, version mismatch |
| `src/lib/config.ts` (helix-cli) | Direct code inspection | Verified `{apiKey, url}` schema, env var priority, saveConfig behavior |
| `src/lib/http.ts` (helix-cli) | Direct code inspection | Verified hxFetch auth header routing, retry logic, basePath convention |
| `src/comments/index.ts` (helix-cli) | Direct code inspection | Verified subcommand routing pattern, flag parsing, ticket ID resolution |
| `src/comments/list.ts` (helix-cli) | Direct code inspection | Verified GET handler pattern with hxFetch and basePath "/api" |
| `src/comments/post.ts` (helix-cli) | Direct code inspection | Verified POST handler pattern with body via hxFetch |
| `src/inspect/index.ts` (helix-cli) | Direct code inspection | Verified getFlag/getPositionalArgs utilities, subcommand pattern |
| `src/login.ts` (helix-cli) | Direct code inspection | Verified OAuth callback stores key as apiKey; session JWT confirmed |
| `src/controllers/ticket-controller.ts` (server) | Direct code inspection | Verified getTickets params (lines 190-208), rerun schema (line 329), artifact endpoints |
| `src/services/ticket-service.ts` (server) | Direct code inspection | Verified where-clause gap (lines 1522-1530), userId usage (lines 1626-1629), artifact response shapes |
| `src/controllers/auth-controller.ts` (server) | Direct code inspection | Verified getMe response shape, postSwitchOrg delegates to service |
| `src/controllers/organization-controller.ts` (server) | Direct code inspection | Verified members endpoint returns `[{id, email, name}]` |
| `src/services/org-switch-service.ts` (server) | Direct code inspection | Verified switchOrganization response shape with accessToken |

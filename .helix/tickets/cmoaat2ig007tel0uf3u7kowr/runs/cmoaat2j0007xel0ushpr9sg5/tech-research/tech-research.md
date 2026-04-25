# Tech Research: helix-cli packaging, documentation, and artifact retrieval

## Technology Foundation

- **Runtime**: Node.js >= 18 (enforced in `engines` field)
- **Language**: TypeScript (^6.0.2), strict mode, ES2022 target, Node16 module resolution
- **Module system**: ESM only (`"type": "module"` in package.json)
- **Build**: `tsc` only, outputs to `dist/`
- **Dependencies**: Zero production dependencies (Node.js builtins only); devDependencies are typescript and @types/node
- **CLI framework**: None (custom switch/case routing with getFlag/getPositionalArgs helpers)
- **HTTP transport**: `hxFetch()` in `src/lib/http.ts` with retry logic, auth headers, configurable basePath
- **Auth**: `hxi_` API keys sent via `X-API-Key` header; other tokens via `Authorization: Bearer`
- **Config**: env vars (`HELIX_API_KEY`, `HELIX_URL`, etc.) take priority, fallback to `~/.hlx/config.json`

## Architecture Decisions

### 1. Artifact Command Module Structure

**Options considered:**
- **A) New `src/artifacts/` module following existing pattern** — index.ts router with subcommand files (ticket.ts, run.ts), using hxFetch with basePath `/api`
- **B) Add artifact subcommands to existing inspect module** — extend src/inspect/ with artifact-related commands
- **C) Introduce a CLI framework (commander/yargs) and restructure all commands** — proper subcommand parsing with built-in help

**Chosen: Option A**

**Rationale:** The CLI already has a proven module pattern (src/comments/, src/inspect/) with consistent routing, flag parsing, and HTTP transport. Adding a new src/artifacts/ module follows this pattern exactly. Option B conflates inspection (live system probes) with artifact retrieval (historical data lookup) — different concerns. Option C violates the zero-dependency policy and over-engineers a 4-command CLI.

**Structure:**
- `src/artifacts/index.ts` — Router: parses subcommand (ticket/run), resolves ticket ID, delegates
- `src/artifacts/ticket.ts` — `hlx artifacts ticket <ticket-id>`: calls `GET /api/tickets/:ticketId/artifacts`
- `src/artifacts/run.ts` — `hlx artifacts run <run-id> --ticket <ticket-id>`: calls `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId`
- `src/index.ts` — Add `case "artifacts"` to the top-level switch

### 2. Version String Fix

**Options considered:**
- **A) `createRequire(import.meta.url)` to read package.json at runtime** — uses node:module builtin, stable since Node 12
- **B) JSON import assertions** (`import pkg from '../package.json' with { type: 'json' }`) — native ESM JSON import
- **C) Build-time code generation** — pre-build script writes a `src/version.ts` with the version constant
- **D) `readFileSync` with `import.meta.url` path resolution** — manual file reading

**Chosen: Option A**

**Rationale:** `createRequire(import.meta.url)` is the most reliable approach for ESM modules that need to import JSON. It's stable across all Node 18+ versions, requires no build step changes, and npm always includes `package.json` in published packages regardless of the `files` field. Option B (import assertions) is not stable across all Node 18.x patch versions and requires `resolveJsonModule` in tsconfig. Option C adds build complexity for a single value. Option D works but `createRequire` is more idiomatic.

**Implementation:** In `src/index.ts`, replace the hardcoded `"0.1.0"` with:
```
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
```
Then `console.log(version)` in the `--version` handler.

### 3. GitHub Actions Publish Workflow

**Options considered:**
- **A) Publish on push to main, only when version changes** — compare local version with npm registry
- **B) Publish on every push to main** — always attempt publish
- **C) Publish only on GitHub Release creation** — manual release gating
- **D) Use semantic-release or changesets** — automated versioning and changelog

**Chosen: Option A**

**Rationale:** Version-change detection is the safest automated approach. Option B causes npm 403 errors when the version already exists (unless using `--force`, which is dangerous). Option C requires manual release creation which defeats automation for a small internal tool. Option D is over-engineering for the current maturity stage — can be adopted later.

**Workflow design:**
- **Trigger**: `push` to `main` branch
- **Node version**: 20.x (LTS, stable for build and publish)
- **Steps**: checkout -> setup-node with registry-url -> `npm ci` -> `npm run build` -> `npm run typecheck` -> version check (compare `package.json` version with `npm view` output) -> `npm publish` if version changed
- **Auth**: `NODE_AUTH_TOKEN` set to `${{ secrets.NPM_TOKEN }}`
- **Safety**: If `npm view` fails (package never published), treat as "publish needed"
- **Permissions**: `contents: read`, `id-token: write` (for npm provenance)

### 4. CLI as Thin Client (Artifact Data Source)

**Options considered:**
- **A) Call Helix server API exclusively** — server abstracts over storage backends
- **B) Call GitHub Actions Artifacts API directly** — CLI talks to GitHub
- **C) Call Vercel Blob API directly** — CLI accesses blob storage
- **D) Hybrid: server for metadata, direct storage for content** — split transport

**Chosen: Option A**

**Rationale:** The server is the single source of truth for artifact data. It already handles both storage backends transparently (Vercel Blob for content, optional GitHub branch commits for URLs). Direct API calls (options B/C) would duplicate server logic, require additional auth credentials (GitHub PAT, Vercel token), and break the established architecture where the CLI communicates with the Helix server only. The server's existing two endpoints provide both metadata and content retrieval.

**Note:** The ticket mentions "GitHub Actions artifacts" and "Vercel storage" but the actual implementation uses Vercel Blob for content storage and optional GitHub branch commits (not the GitHub Actions Artifacts API). The server endpoints abstract this distinction.

### 5. Output Format

**Options considered:**
- **A) Human-readable default + `--json` flag** — text output by default, structured JSON on request
- **B) JSON only** — always output JSON
- **C) Table format with `--json` option** — formatted tables by default

**Chosen: Option A**

**Rationale:** Matches the existing comments command pattern (human-readable console.log per item). JSON mode enables scripting/piping. Table format would require a table-rendering dependency or manual column alignment, which is unnecessary complexity.

**Format details:**
- Human-readable: one section per repo/run with key metadata on each line (similar to comments list)
- JSON: `JSON.stringify(data, null, 2)` of the raw API response to stdout
- Empty state: `"No artifacts found."` message (matches comments pattern)
- Errors: stderr for auth/connection issues (already handled by hxFetch)

## Core API/Methods

### CLI Command Signatures

```
hlx artifacts ticket <ticket-id> [--json]
hlx artifacts ticket --ticket <ticket-id> [--json]
hlx artifacts run <run-id> --ticket <ticket-id> [--repo-key <key>] [--step <step-id>] [--json]
```

- Ticket ID resolution: `--ticket` flag > positional arg > `HELIX_TICKET_ID` env var
- Run ID: positional argument for `run` subcommand
- `--repo-key` and `--step`: required for step-level artifact retrieval (the server requires both)

### Server Endpoints Used

1. **`GET /api/tickets/:ticketId/artifacts?runId=<optional>`**
   - Returns: `{ items: [{id, label, repoUrl, runId, branch, path, url}], stepArtifactSummary: [{stepId, repoKey}] }`
   - Used by: `hlx artifacts ticket`

2. **`GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId?repoKey=<required>`**
   - Returns: `{ stepId, repoKey, files: [{name, content, contentType}] }`
   - Used by: `hlx artifacts run`

### hxFetch Usage Pattern

```
hxFetch(config, `/tickets/${ticketId}/artifacts`, { basePath: '/api', queryParams: { runId } })
hxFetch(config, `/tickets/${ticketId}/runs/${runId}/step-artifacts/${stepId}`, { basePath: '/api', queryParams: { repoKey } })
```

## Technical Decisions

### Flag and Env Var Conventions

| Flag | Env Var | Purpose |
|------|---------|---------|
| `--ticket <id>` | `HELIX_TICKET_ID` | Ticket ID (existing pattern from comments) |
| `--json` | — | Output raw JSON instead of human-readable text |
| `--repo-key <key>` | — | Repo key for step-level artifact retrieval |
| `--step <step-id>` | — | Step ID for step-level artifact retrieval |

`HELIX_RUN_ID` env var support is not included in MVP. The `--run` flag or positional argument is sufficient, and no existing command uses `HELIX_RUN_ID`.

### prepublishOnly Script

Add `"prepublishOnly": "npm run build"` to `package.json` scripts. This ensures `dist/` is built before any publish — whether from CI or manual `npm publish`. Without this, a manual publish without running `tsc` first would ship an empty or stale `dist/` directory.

### Rejected: New Server Endpoints

No new server endpoints are needed. The existing two artifact endpoints provide all required data. Adding CLI-specific endpoints would be unnecessary when the only issue is auth access (solved by route re-ordering).

### Rejected: Artifact Download-to-Disk Command

A dedicated `hlx artifacts download` command is explicitly out of scope for MVP. The `hlx artifacts run` command returns file content to stdout, which can be redirected to a file if needed.

## Cross-Platform Considerations

- The CLI uses Node.js builtins only, so it works on all platforms Node supports.
- The `login` command uses platform-specific browser opening (`open`/`xdg-open`/`start`), which is already implemented.
- Config file path uses `homedir()` + `.hlx/config.json`, which is cross-platform.
- No additional cross-platform concerns for artifact commands.

## Performance Expectations

- **Artifact list (ticket)**: Single HTTP request to server. Response size is proportional to number of repos/runs (typically small — 1-5 repos, few runs). Expected <500ms.
- **Step artifact content (run)**: Single HTTP request per step/repo combination. Content is fetched from Vercel Blob by the server. Response size depends on artifact file sizes (typically markdown/JSON, <100KB). Expected <2s.
- **hxFetch retry**: Up to 3 attempts with exponential backoff (2s base). Timeout per request: 30s. This is already implemented and sufficient.
- **No caching**: Artifacts are immutable once written, but caching is not worth the complexity for a CLI tool. Each invocation makes a fresh request.

## Dependencies

### Production Dependencies (unchanged: zero)

The CLI will continue to have zero production dependencies. All functionality uses Node.js builtins:
- `node:fs` (readFileSync for config)
- `node:path`, `node:url`, `node:os` (path resolution, config paths)
- `node:http` (login server)
- `node:crypto` (login state generation)
- `node:module` (createRequire for version reading — new)
- `node:child_process` (browser opening)
- `node:readline` (manual login prompt)
- Global `fetch` (available in Node 18+, used by hxFetch)

### Dev Dependencies (unchanged)

- `typescript` ^6.0.2
- `@types/node` ^25.5.0

### CI Dependencies

- `actions/checkout@v6` — repository checkout
- `actions/setup-node@v4` — Node.js setup with npm registry auth
- `NPM_TOKEN` secret — npm authentication (must be configured in GitHub repo settings)

### Cross-Repo Dependency

- **helix-global-server auth fix** is a prerequisite for CLI artifact commands to function with `hxi_` API keys. Without it, CLI users will get 401 errors from artifact endpoints. The server change must be deployed before the CLI publish.

## Deferred to Round 2

- `hlx artifacts list` (broader artifact browser without ticket scoping)
- `hlx artifacts download` (dedicated download-to-disk command)
- Lookup by PR number
- Filtering by date, repo, source, or artifact name
- `HELIX_RUN_ID` env var support
- Test infrastructure for the CLI
- Versioning automation (semantic-release or changesets)
- Lint and formatting setup

## Summary Table

| Component | Change Type | Files | Complexity |
|-----------|------------|-------|------------|
| Artifact command module | New feature | `src/artifacts/index.ts`, `src/artifacts/ticket.ts`, `src/artifacts/run.ts` | Moderate — follows established pattern |
| Command routing | Modify | `src/index.ts` | Trivial — add `case "artifacts"` + import |
| Version string fix | Bug fix | `src/index.ts` | Trivial — replace hardcoded string with createRequire |
| prepublishOnly script | Config | `package.json` | Trivial — add one script |
| GitHub Actions workflow | New feature | `.github/workflows/publish.yml` | Moderate — standard npm publish with version check |
| README.md | New feature | `README.md` | Moderate — documentation based on existing code |
| Server auth fix | Config change | `helix-global-server/src/routes/api.ts` | Trivial — move 2 route registrations, add middleware |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NPM_TOKEN secret not configured in GitHub repo | High | Workflow fails silently | Document required secret in README and workflow comments |
| Server auth fix not deployed before CLI publish | Medium | CLI artifact commands return 401 | Coordinate deployment order; document server dependency |
| npm package @projectxinnovation/helix-cli may be on a private registry | Medium | Workflow auth configuration differs | Verify registry during implementation; adjust workflow if needed |
| OAuth login may return session JWT (not hxi_ key) | Low | OAuth users might not need server auth fix | Auth fix is still needed for manual API key users; the fix is correct regardless |
| Version already exists on npm registry | Low | npm publish fails with 403 | Version check in workflow prevents duplicate publish attempts |

## APL Statement Reference

The technical direction for helix-cli is to add a new `src/artifacts/` command module following the established router pattern, fix the version string using `createRequire` to read `package.json` at runtime, add a GitHub Actions workflow that publishes on version change, and add a `prepublishOnly` script. The CLI remains a thin client calling the server's existing two artifact endpoints via `hxFetch` with `basePath: '/api'`. For helix-global-server, the only change is moving two artifact route registrations before the `requireAuth` gate and adding `attachInspectionAuth` + `requireCommentAuth` middleware, following the established comment-endpoint pattern. No new dependencies, no handler changes, no schema changes.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli) | Primary requirements source | Three deliverables: README, npm publish workflow, artifact retrieval commands |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause analysis | Five root causes: auth boundary, missing docs, no CI/CD, version drift, feature gap |
| `diagnosis/apl.json` (helix-cli) | Diagnosis Q&A findings | CLI should call server API not GitHub/Vercel directly; established command patterns documented |
| `product/product.md` (helix-cli) | Product requirements and scope | Thin client principle, zero-dependency policy, explicit out-of-scope items |
| `scout/reference-map.json` (helix-cli) | File inventory and facts | Version mismatch confirmed, zero prod deps, ESM-only, custom arg parsing |
| `scout/scout-summary.md` (helix-cli) | Architecture analysis | Auth boundary is critical cross-repo issue; hxFetch basePath pattern documented |
| `diagnosis/diagnosis-statement.md` (helix-global-server) | Server root cause | Route registration order is the only change needed; handlers compatible |
| `diagnosis/apl.json` (helix-global-server) | Server auth fix details | attachInspectionAuth + requireCommentAuth pattern confirmed; no handler changes |
| `scout/reference-map.json` (helix-global-server) | Server file inventory | Artifact endpoints at lines 261, 274 after requireAuth at line 236 |
| `product/product.md` (helix-global-server) | Server scope definition | Auth fix only; no new endpoints, handlers, or schema changes |
| `repo-guidance.json` | Repo intent | Both repos are change targets; helix-cli primary, server for auth fix only |
| `package.json` (helix-cli) | Direct verification | v1.2.0, ESM, zero prod deps, no prepublishOnly, no publishConfig |
| `tsconfig.json` (helix-cli) | Build config verification | ES2022 target, Node16 module, strict, outputs to dist/ |
| `src/index.ts` (helix-cli) | CLI entrypoint verification | Hardcoded 0.1.0, switch/case routing, shebang present |
| `src/lib/http.ts` (helix-cli) | Transport layer verification | hxFetch API: config, path, options with basePath/queryParams |
| `src/lib/config.ts` (helix-cli) | Config system verification | Env var priority, config file fallback, HxConfig type |
| `src/comments/index.ts` (helix-cli) | Pattern reference | resolveTicketId with --ticket flag and HELIX_TICKET_ID env |
| `src/comments/list.ts` (helix-cli) | Output pattern reference | Human-readable format, typed response, basePath override |
| `src/inspect/index.ts` (helix-cli) | Pattern reference | Subcommand routing with getFlag/getPositionalArgs |
| `src/login.ts` (helix-cli) | Auth flow analysis | OAuth callback returns opaque key; manual mode expects hxi_ key |
| `src/routes/api.ts` (server) | Route registration verification | Lines 236 (requireAuth gate), 261/274 (artifact endpoints), 192-196 (comment pattern) |
| `src/auth/middleware.ts` (server) | Auth middleware verification | attachInspectionAuth handles hxi_ keys, rate limits; requireCommentAuth checks non-null auth |
| `src/controllers/ticket-controller.ts` (server) | Handler verification | Both artifact handlers use getRequiredAuth — compatible with inspection auth |
| `src/services/ticket-service.ts` (server) | Response shape verification | Exact JSON shapes for both artifact endpoints confirmed |
| GitHub Actions docs (Context7) | Workflow pattern reference | setup-node with registry-url, NODE_AUTH_TOKEN for npm auth, --provenance flag |

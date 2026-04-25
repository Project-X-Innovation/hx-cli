# Tech Research: helix-cli packaging, documentation, and artifact retrieval

## Technology Foundation

- **Runtime**: Node.js >= 18 (enforced in `engines` field)
- **Language**: TypeScript (^6.0.2), strict mode, ES2022 target, Node16 module resolution
- **Module system**: ESM only (`"type": "module"` in package.json)
- **Build**: `tsc` only, outputs to `dist/`
- **Dependencies**: Zero production dependencies (Node.js builtins only); devDependencies are typescript and @types/node
- **CLI framework**: None (custom switch/case routing with getFlag helpers)
- **HTTP transport**: `hxFetch()` in `src/lib/http.ts` with retry logic (3 attempts, exponential backoff, 30s timeout), auth headers, configurable basePath
- **Auth**: `hxi_` API keys sent via `X-API-Key` header; other tokens via `Authorization: Bearer`
- **Config**: env vars (`HELIX_API_KEY`, `HELIX_URL`, etc.) take priority, fallback to `~/.hlx/config.json`
- **Package**: `@projectxinnovation/helix-cli`, scoped under `@projectxinnovation` npm org, MIT license, published as public

### Critical Correction: No Server-Side Changes Needed

The helix-global-server diagnosis incorrectly claimed artifact endpoints are behind `requireAuth` (citing stale line numbers 261/274). **Direct reading of `src/routes/api.ts` lines 236-240 confirms artifact routes are ALREADY before `requireAuth` with the correct middleware:**

```
Line 236: // Artifact routes registered before requireAuth so inspection tokens / API keys can reach them.
Line 237: apiRouter.get("/tickets/:ticketId/artifacts", attachInspectionAuth, requireCommentAuth, getTicketArtifacts);
Line 238: apiRouter.get("/tickets/:ticketId/runs/:runId/step-artifacts/:stepId", attachInspectionAuth, requireCommentAuth, getStepArtifacts);
Line 240: apiRouter.use(requireAuth);
```

This means `hxi_` API keys from the CLI already work with artifact endpoints. **All changes are confined to the helix-cli repository.**

## Architecture Decisions

### 1. GitHub Actions Publish Workflow (Primary Deliverable)

**Options considered:**
- **A) Publish on push to main, only when version changes** — compare local version with npm registry
- **B) Publish on every push to main unconditionally** — always attempt `npm publish`
- **C) Publish only on GitHub Release creation** — manual release gating
- **D) Use semantic-release or changesets** — automated versioning and changelog

**Chosen: Option A**

**Rationale:** The user explicitly requires "when we push to the main branch, the package should be published automatically." Option A satisfies this with safety against duplicate-version failures. Option B causes npm 403 errors when the version already exists on the registry (npm disallows re-publishing the same version). Option C requires manual release creation which defeats the automation goal. Option D is over-engineering for a small internal tool — can be adopted later.

**Workflow design:**
- **Trigger**: `push` to `main` branch
- **Node version**: 20.x (current LTS, matches development environment)
- **Steps**: checkout (`actions/checkout@v6`) -> setup-node (`actions/setup-node@v4`) with `registry-url: 'https://registry.npmjs.org'` -> `npm ci` -> `npm run build` -> `npm run typecheck` -> version check -> `npm publish --provenance --access public`
- **Version check**: Compare `package.json` version with `npm view @projectxinnovation/helix-cli version`. If equal, skip publish. If `npm view` fails (package never published or network issue), treat as "publish needed."
- **Auth**: `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` environment variable
- **Permissions**: `contents: read`, `id-token: write` (for npm provenance attestation)
- **Provenance**: `--provenance` flag establishes verifiable build provenance for supply chain security. If the npm org doesn't support provenance, the flag can be removed without affecting functionality.

### 2. GitHub/npm Secrets Setup (Required Infrastructure)

This section documents the one-time setup steps needed before the publish workflow can function. These must be included in the README.

**npm Side Setup:**
1. Log into [npmjs.com](https://www.npmjs.com) with an account that has publish rights to `@projectxinnovation` scope
2. Navigate to Settings -> Access Tokens -> Generate New Token
3. Choose **Automation** token type (Classic) — this bypasses org-level 2FA requirements for CI use
4. Alternative: **Granular Access Token** scoped to `@projectxinnovation/helix-cli` with Read and Write permissions (more restrictive, recommended if available)
5. Copy the generated token value

**GitHub Side Setup:**
1. Navigate to the `helix-cli` repository on GitHub
2. Go to Settings -> Secrets and variables -> Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: paste the npm access token from step above
6. Note: `GITHUB_TOKEN` is automatically available in GitHub Actions workflows — no manual setup needed for this

**Required Secrets Summary:**

| Secret | Location | Purpose | How to Obtain |
|--------|----------|---------|---------------|
| `NPM_TOKEN` | GitHub repo secret | npm registry authentication for publishing | Generate at npmjs.com -> Access Tokens; use "Automation" type (Classic) |
| `GITHUB_TOKEN` | Automatic | Checkout and workflow operations | Automatically provided by GitHub Actions — no setup needed |

### 3. Artifact Command Module Structure

**Options considered:**
- **A) New `src/artifacts/` module following existing pattern** — index.ts router with subcommand files, using hxFetch with basePath `/api`
- **B) Add artifact subcommands to existing inspect module** — extend `src/inspect/` with artifact commands
- **C) Introduce a CLI framework (commander/yargs) and restructure all commands** — proper subcommand parsing

**Chosen: Option A**

**Rationale:** The CLI has a proven module pattern (`src/comments/`, `src/inspect/`) with consistent routing, flag parsing, and HTTP transport. Adding `src/artifacts/` follows this pattern exactly. Option B conflates inspection (live system probes via `/api/inspect`) with artifact retrieval (historical data via `/api`) — these use different basePaths and represent different concerns. Option C violates the zero-dependency policy and over-engineers a 4-command CLI.

**Structure:**
- `src/artifacts/index.ts` — Router: parses subcommand (ticket/run), resolves ticket ID, delegates
- `src/artifacts/ticket.ts` — `hlx artifacts ticket <ticket-id>`: calls `GET /api/tickets/:ticketId/artifacts`
- `src/artifacts/run.ts` — `hlx artifacts run <run-id> --ticket <ticket-id> --step <step-id> --repo-key <key>`: calls step-artifact endpoint
- `src/index.ts` — Add `case "artifacts"` to the top-level switch, import `runArtifacts`

### 4. Version String Fix

**Options considered:**
- **A) `createRequire(import.meta.url)` to read package.json at runtime** — uses `node:module` builtin
- **B) JSON import assertions** (`import pkg from '../package.json' with { type: 'json' }`) — native ESM JSON import
- **C) Build-time code generation** — pre-build script writes a `src/version.ts` file
- **D) `readFileSync` with `import.meta.url` path resolution** — manual file reading

**Chosen: Option A**

**Rationale:** `createRequire(import.meta.url)` is the most reliable approach for ESM modules reading JSON. It's stable across all Node 18+ versions, requires no build step changes, and npm always includes `package.json` in published packages regardless of the `files` field. Option B (import assertions) requires `resolveJsonModule` in tsconfig and behavior varies across Node 18.x patch versions. Option C adds build complexity for a single value. Option D works but `createRequire` is the idiomatic ESM pattern for this use case.

**Implementation approach:** In `src/index.ts`, replace the hardcoded `"0.1.0"` at line 47 with a dynamic version read using `createRequire`. The `require("../package.json")` path resolves correctly because compiled `dist/index.js` is one level below the root `package.json`.

### 5. CLI as Thin Client (Artifact Data Source)

**Options considered:**
- **A) Call Helix server API exclusively** — server abstracts over storage backends
- **B) Call GitHub Actions Artifacts API directly** — CLI talks to GitHub
- **C) Call Vercel Blob API directly** — CLI accesses blob storage
- **D) Hybrid: server for metadata, direct storage for content**

**Chosen: Option A**

**Rationale:** The server is the single source of truth for artifact data. It handles Vercel Blob storage for content and optional GitHub branch commits for URLs transparently. Direct API calls (B/C) would duplicate server logic, require additional auth credentials (GitHub PAT, Vercel token), and break the established architecture where the CLI communicates with the Helix server only. The ticket mentions "GitHub Actions artifacts" and "Vercel storage" but the server endpoints abstract this distinction — no direct storage access is needed.

## Core API/Methods

### CLI Command Signatures

```
hlx artifacts ticket <ticket-id>
hlx artifacts ticket --ticket <ticket-id>
hlx artifacts run <run-id> --ticket <ticket-id> --step <step-id> --repo-key <key>
```

- Ticket ID resolution: `--ticket` flag > positional arg > `HELIX_TICKET_ID` env var (matches existing comments pattern from `src/comments/index.ts`)
- Run ID: positional argument for `run` subcommand
- `--step` and `--repo-key`: required for step-level artifact retrieval (server endpoint requires both)

### Server Endpoints Used (Already Accessible)

1. **`GET /api/tickets/:ticketId/artifacts?runId=<optional>`**
   - Auth: `attachInspectionAuth` + `requireCommentAuth` (accepts `hxi_` API keys)
   - Returns: `{ items: [{id, label, repoUrl, runId, branch, path, url}], stepArtifactSummary: [{stepId, repoKey}] }`
   - Used by: `hlx artifacts ticket`

2. **`GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId?repoKey=<required>`**
   - Auth: `attachInspectionAuth` + `requireCommentAuth` (accepts `hxi_` API keys)
   - Returns: `{ stepId, repoKey, files: [{name, content, contentType}] }`
   - Used by: `hlx artifacts run`

### hxFetch Usage Pattern

Artifact commands use `hxFetch` with `basePath: '/api'` (same as comments), not the default `/api/inspect`:

```
hxFetch(config, `/tickets/${ticketId}/artifacts`, { basePath: '/api', queryParams: { runId } })
hxFetch(config, `/tickets/${ticketId}/runs/${runId}/step-artifacts/${stepId}`, { basePath: '/api', queryParams: { repoKey } })
```

## Technical Decisions

### Output Format (MVP: Human-Readable Only)

Human-readable output follows the pattern from `src/comments/list.ts`:
- Ticket artifacts: display repo label, branch, run ID, URL per item, followed by step artifact summary
- Run step artifacts: display step ID, repo key, and file names with content type
- Empty state: `"No artifacts found."` (matches comments pattern)
- Errors: stderr for auth/connection issues (already handled by `hxFetch` retry and error formatting)

`--json` structured output mode is explicitly out of scope for MVP per the product specification. It can be added later as a non-breaking enhancement.

### Flag and Env Var Conventions

| Flag | Env Var | Purpose |
|------|---------|---------|
| `--ticket <id>` | `HELIX_TICKET_ID` | Ticket ID (existing pattern from comments) |
| `--repo-key <key>` | — | Repo key for step-level artifact retrieval |
| `--step <step-id>` | — | Step ID for step-level artifact retrieval |

`HELIX_RUN_ID` env var is not included in MVP. The positional argument is sufficient, and no existing command uses `HELIX_RUN_ID`.

### prepublishOnly Script

Add `"prepublishOnly": "npm run build"` to `package.json` scripts. This ensures `dist/` is built before any publish — whether from CI or manual `npm publish`. Without this, a manual publish without running `tsc` first would ship an empty or stale `dist/` directory (confirmed: `npm pack --dry-run` without build produces only 371 bytes — just `package.json`).

### Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|----------------|
| Server-side auth changes | Not needed — artifact routes already have correct middleware (verified at `api.ts:237-238`) |
| CLI framework (commander/yargs) | Violates zero-dependency policy; 4-command CLI doesn't justify the overhead |
| Direct GitHub/Vercel API calls | Duplicates server logic; requires additional auth credentials |
| `--json` output in MVP | Explicitly out of scope per product spec; non-breaking to add later |
| `hlx artifacts download` | Out of scope for MVP; stdout output can be redirected to file |
| `semantic-release` / `changesets` | Over-engineering for current maturity; can adopt later |
| New server endpoints | Existing two endpoints provide all required data |

## Cross-Platform Considerations

- The CLI uses Node.js builtins only — works on all platforms Node supports
- The `login` command's browser opening (`open`/`xdg-open`/`start`) is already implemented
- Config file path uses `homedir()` + `.hlx/config.json`, which is cross-platform
- No additional cross-platform concerns for artifact commands or the publish workflow

## Performance Expectations

- **Artifact list (ticket)**: Single HTTP request to server. Response size is proportional to number of repos/runs (typically 1-5 repos, few runs per ticket). Expected < 500ms.
- **Step artifact content (run)**: Single HTTP request per step/repo combination. Content fetched from Vercel Blob by the server. Response size depends on artifact file sizes (typically markdown/JSON, < 100KB). Expected < 2s.
- **hxFetch retry**: Up to 3 attempts with exponential backoff (2s base, 30s timeout). Already implemented and sufficient.
- **No caching**: Artifacts are immutable once written, but caching is unnecessary complexity for a CLI tool.

## Dependencies

### Production Dependencies (unchanged: zero)

All functionality uses Node.js builtins:
- `node:fs` (readFileSync for config and login)
- `node:path`, `node:url`, `node:os` (path resolution, config paths)
- `node:http` (login server)
- `node:crypto` (login state generation)
- `node:module` (createRequire for version reading — new usage)
- `node:child_process` (browser opening)
- `node:readline` (manual login prompt)
- Global `fetch` (available in Node 18+, used by hxFetch)

### Dev Dependencies (unchanged)

- `typescript` ^6.0.2
- `@types/node` ^25.5.0

### CI Dependencies (new)

- `actions/checkout@v6` — repository checkout
- `actions/setup-node@v4` — Node.js setup with npm registry auth configuration
- `NPM_TOKEN` repository secret — npm authentication for publishing (must be configured in GitHub repo settings; see "GitHub/npm Secrets Setup" section above)

### Cross-Repo Dependencies: None

The server artifact endpoints are already accessible with `hxi_` API keys. No server changes, no deployment coordination, no cross-repo prerequisites. The helix-global-server is context only for understanding the API contract.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `NPM_TOKEN` secret not configured in GitHub repo | High (first-time setup required) | Workflow fails on publish step | Document required secret setup in README with step-by-step instructions; workflow logs clear error |
| npm org `@projectxinnovation` requires 2FA that blocks Automation tokens | Low | Publish from CI fails | Use Granular Access Token instead of Automation type; document both options |
| Version already exists on npm registry | Low | npm publish fails with 403 | Version check in workflow compares local vs registry version before publishing |
| `--provenance` flag not supported by npm org | Low | Publish step fails | Flag can be removed without affecting core functionality; document as optional |
| Package is currently public (MIT license) but team may want private | Low | `--access public` flag inappropriate | Verify access preference during implementation; adjust if needed |

## Deferred to Round 2

- `--json` structured output mode for artifact commands
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
| GitHub Actions publish workflow | New feature | `.github/workflows/publish.yml` | Moderate — standard npm publish with version check |
| README documentation | New feature | `README.md` | Moderate — covers install, auth, commands, artifact examples, publish setup |
| Artifact command module | New feature | `src/artifacts/index.ts`, `src/artifacts/ticket.ts`, `src/artifacts/run.ts` | Moderate — follows established comments pattern |
| Command routing | Modify | `src/index.ts` | Trivial — add `case "artifacts"` + import + usage line |
| Version string fix | Bug fix | `src/index.ts` | Trivial — replace hardcoded `"0.1.0"` with createRequire |
| prepublishOnly script | Config | `package.json` | Trivial — add one script |

**All changes are in the helix-cli repository only. No helix-global-server changes needed.**

## APL Statement Reference

The technical direction for helix-cli is to: (1) add a GitHub Actions workflow (`.github/workflows/publish.yml`) triggered on push to main that builds, typechecks, and publishes to npm only when the version changes, using `NPM_TOKEN` as a repository secret; (2) add a comprehensive `README.md` including GitHub/npm secrets setup instructions for maintainers; (3) add a new `src/artifacts/` command module following the established comments module pattern, consuming the server's existing and already-accessible artifact endpoints via `hxFetch` with `basePath: '/api'`; (4) fix the version hardcode at `src/index.ts:47` using `createRequire`; and (5) add a `prepublishOnly` script. Zero new production dependencies. No helix-global-server changes are needed — direct verification of `api.ts` lines 236-240 confirms artifact routes are already before `requireAuth` with `attachInspectionAuth` + `requireCommentAuth` middleware.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli) | Primary requirements and continuation context | Auto-publish on push to main + GitHub/npm secrets setup instructions emphasized by user |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause analysis with corrected auth finding | Five root causes identified; critical correction that no server changes needed |
| `diagnosis/apl.json` (helix-cli) | Structured diagnosis evidence | CLI should call server API; hxFetch basePath pattern; version drift confirmed |
| `product/product.md` (helix-cli) | Product requirements, scope, and constraints | Thin client principle, zero-dependency policy, `--json` out of scope for MVP |
| `scout/reference-map.json` (helix-cli) | File inventory, npm registry state, module patterns | Zero prod deps, ESM-only, no `.github/`, established command patterns |
| `scout/scout-summary.md` (helix-cli) | Architecture analysis with corrected auth boundary | Server endpoints already accessible; detailed publish workflow requirements |
| `diagnosis/diagnosis-statement.md` (helix-global-server) | Server diagnosis (contains incorrect claim) | Claims route-move fix needed — contradicted by direct source reading of `api.ts:236-240` |
| `product/product.md` (helix-global-server) | Server scope definition | Auth fix was its proposed scope — now confirmed unnecessary |
| `repo-guidance.json` | Repo intent classification | helix-cli = target, helix-global-server = context only (confirmed correct) |
| `package.json` (helix-cli, direct read) | Build/publish config verification | v1.2.0, ESM, zero prod deps, no prepublishOnly, `files: ["dist"]` |
| `tsconfig.json` (helix-cli, direct read) | TypeScript config verification | ES2022 target, Node16 module, strict, outputs to `dist/` |
| `src/index.ts` (helix-cli, direct read) | CLI entrypoint verification | Line 47 hardcodes `"0.1.0"`, switch/case routing, shebang present |
| `src/comments/index.ts` (helix-cli, direct read) | Pattern reference for artifacts module | resolveTicketId with `--ticket` flag and `HELIX_TICKET_ID` env var |
| `src/comments/list.ts` (helix-cli, direct read) | hxFetch usage and output pattern | `basePath: '/api'`, typed response, human-readable console.log output |
| `src/lib/http.ts` (helix-cli, direct read) | Transport layer API contract | hxFetch(config, path, {basePath, queryParams, method, body}) |
| `src/lib/config.ts` (helix-cli, direct read) | Config system and env vars | `HELIX_API_KEY`/`HELIX_URL` env vars, `~/.hlx/config.json` fallback |
| `src/routes/api.ts:225-254` (server, direct read) | **Definitive auth boundary verification** | Lines 237-238: artifact routes with `attachInspectionAuth + requireCommentAuth` BEFORE `requireAuth` at line 240 |
| GitHub Actions docs (Context7) | Current workflow patterns | `actions/checkout@v6`, `actions/setup-node@v4`, `--provenance --access public`, `NODE_AUTH_TOKEN` pattern |

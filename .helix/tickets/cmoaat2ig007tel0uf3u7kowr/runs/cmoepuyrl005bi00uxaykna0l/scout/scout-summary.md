# Scout Summary — HLX-299: helix-cli packaging, docs, and artifact retrieval

## Problem

`helix-cli` (`@projectxinnovation/helix-cli` v1.2.0) is a working CLI tool with no CI/CD infrastructure, no README, and no artifact retrieval commands. There is no `.github/` directory at all — the package has been published manually (twice: 1.1.0 and 1.2.0 by `usherpx`). The user's continuation context emphasizes adding a GitHub Actions workflow for automatic npm publishing on push to main, plus documenting the required GitHub/npm secrets setup.

## Analysis Summary

### Repository State
- **Package**: `@projectxinnovation/helix-cli` v1.2.0, scoped npm package, MIT license
- **Published versions**: 1.1.0 and 1.2.0 (manually by `usherpx`)
- **Build system**: TypeScript compiled via `tsc` (src/ → dist/), ES2022 target, Node16 modules
- **dist/ is gitignored**: The publish workflow MUST build before publishing
- **Zero runtime dependencies**: Uses only Node.js built-ins + global fetch
- **No `.github/` directory**: No workflows, no CI configuration whatsoever
- **No README.md, no tests, no .npmrc, no .npmignore**

### Version Drift
- `package.json` declares version `1.2.0`
- `src/index.ts` line 47 hardcodes `"0.1.0"` for `--version` output
- `npm pack --dry-run` without building produces only 371 bytes (just package.json). Published package is 14.5 kB — confirms dist/ must be built before publish.

### Existing Command Structure
Commands follow a consistent modular pattern (router + subcommand files):
- `hlx login <server-url>` / `hlx login --manual` — OAuth browser flow or manual API key
- `hlx inspect repos|db|logs|api` — Production inspection (basePath: `/api/inspect`)
- `hlx comments list|post` — Ticket comments (basePath: `/api`)
- `hlx --version` — Prints hardcoded `0.1.0`

No artifact commands exist yet.

### Authentication Architecture
- CLI sends `hxi_*` keys via `X-API-Key` header; other tokens via `Authorization: Bearer`
- Config loaded from env vars (HELIX_API_KEY + HELIX_URL) or `~/.hlx/config.json`
- HTTP client: custom retry logic, 3 attempts, exponential backoff, 30s timeout

### Server-Side Artifact API (helix-global-server) — CORRECTION from prior scout

**Prior scout incorrectly claimed artifact endpoints are behind `requireAuth` and inaccessible via hxi_ tokens.** Direct reading of `src/routes/api.ts` lines 236-240 shows:

```
// Line 236: comment about artifact routes being before requireAuth
// Line 237: apiRouter.get("/tickets/:ticketId/artifacts", attachInspectionAuth, requireCommentAuth, getTicketArtifacts);
// Line 238: apiRouter.get("/tickets/:ticketId/runs/:runId/step-artifacts/:stepId", attachInspectionAuth, requireCommentAuth, getStepArtifacts);
// Line 240: apiRouter.use(requireAuth);  <-- general auth gate is AFTER artifact routes
```

Both artifact routes use `attachInspectionAuth + requireCommentAuth` middleware, the same auth pattern as comment endpoints. **hxi_ API keys CAN access artifact endpoints. No server-side changes needed.**

**API Response Shapes:**
- `GET /api/tickets/:ticketId/artifacts?runId=X` → `{ items: [{id, label, repoUrl, runId, branch, path, url}], stepArtifactSummary: [{stepId, repoKey}] }`
- `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId?repoKey=X` → `{ stepId, repoKey, files: [{name, content, contentType}] }`

### GitHub Actions Publish Workflow — Setup Requirements

For automated npm publishing on push to main:

**GitHub Repository Secrets Required:**

| Secret Name | Purpose | How to Obtain |
|---|---|---|
| `NPM_TOKEN` | npm authentication for publishing | Generate at npmjs.com → Access Tokens. Use "Automation" type (bypasses 2FA) or "Granular Access Token" with publish permission for `@projectxinnovation` scope |

**npm Side Setup:**
1. Log into npmjs.com with an account that has publish rights to `@projectxinnovation`
2. Generate an access token (Settings → Access Tokens → Generate New Token)
3. Token type: "Automation" (Classic) for simplest CI use — bypasses org-level 2FA requirements
4. Alternatively: "Granular Access Token" scoped to `@projectxinnovation/helix-cli` with Read/Write permissions

**GitHub Side Setup:**
1. Navigate to the `helix-cli` repository on GitHub → Settings → Secrets and variables → Actions
2. Add a repository secret named `NPM_TOKEN` with the npm access token value
3. `GITHUB_TOKEN` is automatically available in workflows (no manual setup needed)

**Workflow Design Signals:**
- Trigger: `push` to `main` branch
- Must run `npm ci` + `npm run build` before publishing (dist/ is gitignored)
- Should run `npm run typecheck` as quality gate
- Use `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` for npm registry auth
- Strategy choice: publish every push vs version-check — can compare `package.json` version to `npm view` output to skip no-op publishes
- No test script exists currently (workflow should not fail on missing tests)

### Pattern for New Artifact Commands
Following established module pattern:
- New `src/artifacts/index.ts` as command router
- Subcommand files for ticket/run/list operations
- Reuse `hxFetch` with `basePath: "/api"` (same as comments)
- Ticket ID via `--ticket <id>` flag or `HELIX_TICKET_ID` env var (same as comments)

## Relevant Files

| File | Role |
|------|------|
| `package.json` | Package metadata, version, bin entry, scripts, files field |
| `tsconfig.json` | TypeScript build configuration |
| `src/index.ts` | CLI entrypoint, command router, version hardcode at line 47 |
| `src/lib/config.ts` | Auth config loading (env vars + ~/.hlx/config.json) |
| `src/lib/http.ts` | HTTP transport with retry, auth headers, basePath |
| `src/lib/resolve-repo.ts` | Repo resolution helper |
| `src/login.ts` | OAuth and manual login flows |
| `src/inspect/index.ts` | Inspect command router (pattern reference) |
| `src/inspect/repos.ts` | Standard subcommand pattern reference |
| `src/inspect/db.ts` | POST request pattern with resolve-repo |
| `src/inspect/logs.ts` | Command with optional flag (--limit) |
| `src/inspect/api.ts` | GET with query params |
| `src/comments/index.ts` | Comments router, ticket ID resolution pattern |
| `src/comments/list.ts` | List with client-side filtering, basePath /api |
| `src/comments/post.ts` | POST request pattern |
| `.gitignore` | Confirms dist/ excluded from git |
| *(server)* `src/routes/api.ts:236-240` | Artifact endpoints registered before requireAuth with inspection auth |
| *(server)* `src/services/ticket-service.ts:1850-2010` | Artifact API implementation and response types |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli run root) | Primary ticket spec and continuation context | User emphasizes auto-publish on push to main + setup instructions for GitHub/npm secrets |
| `repo-guidance.json` (helix-cli run root) | Prior diagnosis intent classification | helix-cli is target; but prior claim about needing server artifact route changes is incorrect — routes already accessible |
| npm registry (`npm info`, `npm view versions`) | Verify published package state | Two versions (1.1.0, 1.2.0), published manually by usherpx, 14.5 kB unpacked |
| `npm pack --dry-run` | Verify what would be published from current source | Only package.json without build — confirms workflow must build first |
| `/tmp/helix-inspect/manifest.json` | Runtime inspection availability | Only helix-global-server has inspection (DATABASE, LOGS); no runtime probes needed for helix-cli |
| Prior `scout/reference-map.json` | Compare against fresh evidence | Prior scout had incorrect claim about artifact endpoints being behind requireAuth; corrected with direct api.ts reading |
| `src/routes/api.ts` lines 236-240 (server) | Verify artifact auth boundary | Artifact routes ARE before requireAuth with attachInspectionAuth — no server changes needed |

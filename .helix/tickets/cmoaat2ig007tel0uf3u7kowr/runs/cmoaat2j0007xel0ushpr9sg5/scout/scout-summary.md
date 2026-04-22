# Scout Summary: helix-cli

## Problem

`helix-cli` (package `@projectxinnovation/helix-cli` v1.2.0) needs three additions: a README, an npm publish GitHub Actions workflow, and CLI commands for artifact retrieval by ticket/run ID. The CLI currently supports `login`, `inspect`, and `comments` commands but has no documentation, no CI/CD, and no artifact access. A version mismatch exists between `package.json` (1.2.0) and `src/index.ts` `--version` output (0.1.0).

## Analysis Summary

### Repository Structure
- Lean TypeScript CLI with zero production dependencies (all Node.js builtins)
- ESM-only (`type: module`), targets Node >= 18, strict TypeScript
- Custom argument parsing (no CLI framework) with simple switch/case routing
- Build: `tsc` only. No lint, no tests, no prepublishOnly script
- `dist/` is gitignored and does not exist in repo; `files: ["dist"]` restricts npm package contents
- `bin.hlx` points to `dist/index.js`

### Existing Command Pattern
- `src/index.ts` routes top-level commands to module routers (`runInspect`, `runComments`, `runLogin`)
- Each command module has an `index.ts` router and subcommand files
- `hxFetch()` in `src/lib/http.ts` is the single HTTP transport: retry logic, auth headers, configurable basePath
- Inspect commands use default basePath `/api/inspect`; comments use `/api` override

### Authentication Boundary (Critical)
- CLI sends `hxi_*` keys via `X-API-Key` header; other tokens via `Authorization: Bearer`
- Server has two auth paths:
  - `attachAuthContext` (global): Only recognizes session JWTs via Bearer header
  - `attachInspectionAuth` (inspection/comments): Recognizes hxi_ keys, inspection tokens, AND session JWTs
- **Artifact endpoints** (`GET /tickets/:ticketId/artifacts`, `GET /tickets/:ticketId/runs/:runId/step-artifacts/:stepId`) are registered **after** the `requireAuth` gate, which depends on `attachAuthContext`
- Comment/inspection endpoints are registered **before** `requireAuth` with their own `attachInspectionAuth`
- This means: **hxi_ API keys cannot currently access artifact endpoints**. Either the server must move artifact routes before the auth gate (like comments) or the CLI must use OAuth-obtained session JWTs.

### Server Artifact APIs (helix-global-server)
- `GET /api/tickets/:ticketId/artifacts?runId=X` returns metadata: repo labels, GitHub URLs, branch info, step artifact summary
- `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId?repoKey=X` returns actual file content from Vercel Blob storage
- Artifacts are stored in Vercel Blob (private) at `artifacts/{runId}/{repoKey}/{stepId}/{filename}`
- GitHub URLs are built from committed branch artifacts when `commitArtifactsToGithub` is enabled
- Ancestor chain fallback: if current run has no artifacts for a step, walks `parentRunId` chain

### Version Drift
- `package.json` version: `1.2.0`
- `src/index.ts` line 47 `--version` output: `0.1.0`
- No `publishConfig` in package.json; unclear what registry is targeted

### Publishing Gaps
- No `.github/workflows/` directory exists
- No `prepublishOnly` or `prepack` script to ensure build runs before publish
- No `npm test` script (would need to be handled gracefully in CI)

## Relevant Files

| File | Role |
|------|------|
| `package.json` | Package metadata, version, bin, scripts, dependencies |
| `tsconfig.json` | TypeScript build config (ES2022, Node16, strict) |
| `src/index.ts` | CLI entrypoint and command router |
| `src/lib/config.ts` | Auth config loading (env vars + ~/.hlx/config.json) |
| `src/lib/http.ts` | HTTP transport with retry, auth headers, basePath |
| `src/login.ts` | OAuth and manual login flows |
| `src/inspect/index.ts` | Inspect command router (pattern reference) |
| `src/comments/index.ts` | Comments command router (pattern reference, uses /api basePath) |
| `src/comments/list.ts` | Comments list implementation (output format reference) |
| `.gitignore` | Confirms dist/ is not committed |
| *(server)* `src/routes/api.ts` | Server route registration showing artifact endpoints behind requireAuth |
| *(server)* `src/auth/middleware.ts` | Auth middleware showing attachAuthContext vs attachInspectionAuth boundary |
| *(server)* `src/services/ticket-service.ts:1850-2034` | getTicketArtifactsForOrganization and getStepArtifactsForOrganization implementations |
| *(server)* `src/services/blob-storage.ts` | Vercel Blob upload/retrieve for step artifacts |
| *(server)* `src/helix-workflow/run-summary.ts:54-76` | StepArtifactEntry/StepArtifactFileEntry/SandboxRunSummary types |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli run root) | Primary requirements source | Three deliverables: README, npm publish workflow, artifact retrieval commands |
| /tmp/helix-inspect/manifest.json | Check runtime inspection availability | Only helix-global-server has inspection configured (DATABASE, LOGS) - no CLI runtime inspection available |
| package.json (helix-cli) | Package metadata and build config | v1.2.0, ESM, zero prod deps, dist-only publish, no prepublishOnly script |
| src/index.ts (helix-cli) | CLI entrypoint | Version hardcoded as 0.1.0 (drift), simple switch/case routing |
| src/lib/http.ts (helix-cli) | HTTP transport | hxFetch with configurable basePath, retry logic, auth header branching |
| src/lib/config.ts (helix-cli) | Config loading | Env var precedence, ~/.hlx/config.json fallback, HxConfig type |
| src/auth/middleware.ts (server) | Auth boundary analysis | Artifact routes behind requireAuth (session only); inspection routes use separate attachInspectionAuth that accepts hxi_ keys |
| src/routes/api.ts (server) | Route registration | Artifact endpoints at lines 261, 274 are after requireAuth gate |
| src/services/ticket-service.ts (server) | Artifact API response shapes | Exact JSON shapes for ticket artifacts and step artifact content |
| src/services/blob-storage.ts (server) | Artifact storage mechanism | Vercel Blob with private access, path pattern artifacts/{runId}/{repoKey}/{stepId}/{filename} |

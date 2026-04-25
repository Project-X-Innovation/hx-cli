# Diagnosis Statement: helix-cli packaging, documentation, and artifact retrieval

## Problem Summary

`helix-cli` is a minimally documented internal CLI (`@projectxinnovation/helix-cli` v1.2.0) that currently supports `login`, `inspect`, and `comments` commands. It lacks a README, has no automated npm publish workflow, and has no artifact retrieval commands. A version string mismatch exists (package.json says 1.2.0, `src/index.ts` line 47 outputs 0.1.0). The server-side artifact endpoints exist but are unreachable from the CLI due to an auth boundary mismatch.

## Root Cause Analysis

This ticket addresses multiple related gaps, each with a distinct root cause:

### 1. Auth Boundary Mismatch (Cross-Repo, Critical Path)

The server's artifact endpoints (`GET /api/tickets/:ticketId/artifacts`, `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId`) are registered **after** `apiRouter.use(requireAuth)` at line 236 of `src/routes/api.ts`. The `requireAuth` gate depends on `attachAuthContext`, which only recognizes session JWTs — it does not process `hxi_` API keys sent by the CLI via `X-API-Key` header.

The server already has a proven pattern for inspection-token-compatible routes: comment endpoints (lines 192-196) and inspection endpoints (lines 186-189) are registered **before** `requireAuth` with `attachInspectionAuth` + `requireCommentAuth`. The `attachInspectionAuth` middleware handles hxi_ keys, inspection tokens, and session JWTs. The fix is to move artifact route registrations before the `requireAuth` gate and apply the same middleware chain.

### 2. Missing Documentation

No `README.md` exists. The CLI was built as an internal tool without documentation. The existing usage string in `src/index.ts` (lines 12-24) provides minimal help text but no install instructions, auth flow, env var config, or examples.

### 3. No CI/CD Pipeline

No `.github/` directory exists. The CLI has likely been published manually (if at all). Additionally, `package.json` lacks a `prepublishOnly` script, meaning a manual publish without building first would ship an empty or stale `dist/` directory.

### 4. Version String Drift

`package.json` version `1.2.0` does not match the hardcoded `"0.1.0"` at `src/index.ts` line 47. The version was never updated in source when the package version was bumped.

### 5. Artifact Command Feature Gap

No artifact commands exist in the CLI. The CLI has a well-established pattern for adding commands: module routers in subdirectories (e.g., `src/comments/`, `src/inspect/`) with subcommand files, all using `hxFetch()` for HTTP transport.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| Auth boundary | `helix-global-server/src/routes/api.ts` lines 236, 261, 274 | Artifact endpoints after requireAuth; comments/inspection before it |
| Auth middleware | `helix-global-server/src/auth/middleware.ts` lines 15-27, 126-189 | `attachAuthContext` session-only; `attachInspectionAuth` handles hxi_ keys |
| Artifact handlers | `helix-global-server/src/controllers/ticket-controller.ts` lines 303-321 | Both use `getRequiredAuth(req)` — compatible with inspection auth once route order is fixed |
| CLI auth | `helix-cli/src/lib/http.ts` lines 53-54 | hxi_ keys sent as X-API-Key header |
| Version mismatch | `helix-cli/package.json` line 3, `src/index.ts` line 47 | 1.2.0 vs 0.1.0 |
| No README | `ls` of helix-cli root | No README.md file present |
| No CI/CD | Glob `.github/**/*` | No files found |
| No prepublishOnly | `helix-cli/package.json` scripts | Only `build` and `typecheck` scripts |
| Command pattern | `helix-cli/src/comments/index.ts`, `src/inspect/index.ts` | Established router pattern with flag parsing and hxFetch calls |
| Server API shapes | `helix-global-server/src/controllers/ticket-controller.ts` | Two endpoints: ticket artifacts metadata + step artifacts content |
| Ticket/env resolution | `helix-cli/src/comments/index.ts` lines 11-19 | `resolveTicketId()` pattern using `--ticket` flag or `HELIX_TICKET_ID` env |

## Success Criteria

1. **README.md** exists at helix-cli root with install instructions, auth flow, env vars, command reference, artifact examples, and maintainer publish notes.
2. **GitHub Actions workflow** publishes to npm on push to `main` (with build, optional typecheck, and npm auth via secrets).
3. **Version string** in `src/index.ts` matches `package.json` (read dynamically or kept in sync).
4. **`prepublishOnly` script** added to `package.json` to ensure build before publish.
5. **`hlx artifacts` commands** can list and retrieve artifacts by ticket ID and run ID.
6. **Server artifact routes** moved before `requireAuth` with `attachInspectionAuth` so hxi_ keys work.
7. **Clear error messages** when no artifacts found or credentials missing.
8. **Artifact command output** is human-readable with optional `--json` mode.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Primary requirements source | Three deliverables: README, npm publish workflow, artifact retrieval commands |
| scout/reference-map.json (helix-cli) | File inventory and facts | Version mismatch, no README, no CI/CD, zero prod deps, auth boundary details |
| scout/scout-summary.md (helix-cli) | Analysis summary | Auth boundary is the critical cross-repo issue; existing command pattern well-documented |
| scout/reference-map.json (helix-global-server) | Server-side file inventory | Artifact endpoints behind requireAuth, established pattern for inspection-compatible routes |
| scout/scout-summary.md (helix-global-server) | Server analysis | Two existing artifact endpoints, Vercel Blob storage, no schema changes needed |
| /tmp/helix-inspect/manifest.json | Runtime inspection availability | Only helix-global-server has inspection (DATABASE, LOGS); no CLI runtime inspection |
| package.json (helix-cli) | Direct verification | Confirmed v1.2.0, bin entry, files array, missing scripts |
| src/index.ts (helix-cli) | Direct verification | Confirmed hardcoded "0.1.0", command routing pattern |
| src/routes/api.ts (helix-global-server) | Direct verification | Confirmed artifact routes at lines 261, 274 after requireAuth at line 236 |
| src/auth/middleware.ts (helix-global-server) | Direct verification | Confirmed attachAuthContext session-only, attachInspectionAuth handles hxi_ keys |
| src/controllers/ticket-controller.ts (helix-global-server) | Direct verification | Confirmed getRequiredAuth usage — no handler changes needed |
| src/lib/http.ts (helix-cli) | Direct verification | Confirmed hxFetch basePath pattern, auth header branching |
| src/comments/index.ts (helix-cli) | Pattern reference | resolveTicketId pattern, basePath '/api' usage |
| src/inspect/index.ts (helix-cli) | Pattern reference | Subcommand routing with getFlag/getPositionalArgs helpers |
| src/login.ts (helix-cli) | Auth flow analysis | OAuth returns opaque 'key'; manual login stores hxi_ keys |

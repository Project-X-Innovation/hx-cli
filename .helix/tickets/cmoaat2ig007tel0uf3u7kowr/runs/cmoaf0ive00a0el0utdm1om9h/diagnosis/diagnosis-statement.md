# Diagnosis Statement — HLX-299: Improve helix-cli packaging, documentation, and artifact retrieval

## Problem Summary

`helix-cli` (`@projectxinnovation/helix-cli`) is a working CLI with three infrastructure gaps: no CI/CD publishing workflow, no README documentation, and no artifact retrieval commands. The user's continuation context specifically emphasizes that pushing to `main` on the helix-cli repo should automatically publish the npm package, and that the diagnosis must include setup instructions for the required GitHub/npm secrets.

## Root Cause Analysis

The root causes are **missing infrastructure**, not bugs in existing code:

1. **No CI/CD**: The `.github/` directory does not exist. Both prior npm publishes (v1.1.0 and v1.2.0) were done manually by `usherpx`. There is no automated path from merge-to-main to npm publish.

2. **No documentation**: No `README.md` exists. A new engineer has no written guide for installation, authentication, or usage.

3. **No artifact commands**: The `src/artifacts/` module does not exist. The server-side artifact endpoints (`GET /api/tickets/:ticketId/artifacts` and `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId`) already exist and are accessible with hxi_ inspection tokens (confirmed at `helix-global-server/src/routes/api.ts` lines 237-238, before `requireAuth` at line 240). Only the CLI client code is missing.

4. **Version drift**: `package.json` declares version `1.2.0` but `src/index.ts` line 47 hardcodes `"0.1.0"` for `--version` output.

5. **No publish safety**: No `prepublishOnly` script prevents accidentally publishing without building `dist/`.

**Critical correction from prior diagnosis**: The previous diagnosis claimed artifact endpoints were behind `requireAuth` and needed server-side route changes. Direct reading of `src/routes/api.ts` lines 236-240 shows this was incorrect — the artifact routes are registered BEFORE `requireAuth` with `attachInspectionAuth + requireCommentAuth` middleware (identical to comment endpoints). **No server-side changes are needed.**

## Evidence Summary

### helix-cli Repository State
| Observation | Evidence |
|---|---|
| No `.github/` directory | `ls .github/` → `NO_GITHUB_DIR` |
| No `README.md` | `ls README.md` → `NO_README` |
| No artifact commands | `src/index.ts` switch/case has only: login, inspect, comments, --version |
| Version hardcode drift | `src/index.ts:47` prints `"0.1.0"`; `package.json:3` declares `"1.2.0"` |
| dist/ gitignored | `.gitignore` line 2: `dist/` |
| No prepublishOnly | `package.json` scripts: only `build` and `typecheck` |
| Two manual npm publishes | npm view shows v1.1.0 and v1.2.0, published by usherpx |
| Zero runtime deps | `package.json` has only devDependencies (typescript, @types/node) |
| ESM-only package | `package.json` type: `"module"`, engines: `node >=18` |

### Server Artifact Auth Verification (helix-global-server — context only)
| Observation | Evidence |
|---|---|
| Artifact routes BEFORE requireAuth | `src/routes/api.ts:237-238` — artifact routes with `attachInspectionAuth, requireCommentAuth` |
| requireAuth gate AFTER artifacts | `src/routes/api.ts:240` — `apiRouter.use(requireAuth)` |
| Explicit code comment | `src/routes/api.ts:236` — `// Artifact routes registered before requireAuth so inspection tokens / API keys can reach them.` |
| Same auth as comments | Comment routes at lines 192-196 also use `attachInspectionAuth + requireCommentAuth` |
| API response shapes known | `GET .../artifacts` → `{ items, stepArtifactSummary }`, `GET .../step-artifacts/:stepId` → `{ stepId, repoKey, files }` |

### Publish Workflow Requirements
| Requirement | Source |
|---|---|
| NPM_TOKEN secret needed | GitHub Actions docs (Context7): npm auth via `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` |
| setup-node with registry-url | GitHub Actions docs: `actions/setup-node@v4` with `registry-url: 'https://registry.npmjs.org'` |
| Must build before publish | `dist/` gitignored, `files: ["dist"]` in package.json |
| Automation token type recommended | Bypasses org-level 2FA for CI use |

## Success Criteria

1. A `.github/workflows/publish.yml` exists that triggers on push to `main`, builds the package, runs typecheck, and publishes to npm
2. `README.md` exists with install, auth, command reference, artifact retrieval examples, and publish setup instructions (including GitHub/npm secret configuration steps)
3. `hlx artifacts` commands can list and retrieve artifacts by ticket ID and run ID via the existing server API
4. Version hardcode at `src/index.ts:47` is fixed to match `package.json`
5. `prepublishOnly` script added to `package.json` for publish safety
6. No changes to helix-global-server are required

### GitHub/npm Secret Setup Instructions (to be documented in README)

**npm side:**
1. Log into npmjs.com with an account that has publish rights to `@projectxinnovation`
2. Go to Settings → Access Tokens → Generate New Token
3. Choose **Automation** token type (Classic) — this bypasses org-level 2FA for CI
4. Alternatively: **Granular Access Token** scoped to `@projectxinnovation/helix-cli` with Read/Write permissions

**GitHub side:**
1. Navigate to the `helix-cli` repository on GitHub
2. Go to Settings → Secrets and variables → Actions
3. Add a new repository secret named `NPM_TOKEN` with the npm access token value
4. Note: `GITHUB_TOKEN` is automatically available in GitHub Actions workflows (no manual setup needed)

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli run root) | Primary ticket spec and continuation context | User emphasizes auto-publish workflow + GitHub/npm secrets setup instructions |
| `scout/reference-map.json` (helix-cli) | Package metadata, version drift, npm state, file inventory | v1.2.0 published manually, 0.1.0 hardcoded, no .github/, no README |
| `scout/scout-summary.md` (helix-cli) | Corrected auth analysis, publish workflow design, command patterns | Artifact endpoints accessible; detailed publish workflow requirements |
| `scout/reference-map.json` (helix-global-server) | Server-side artifact endpoint details and auth boundary | Claimed endpoints behind requireAuth — required direct verification |
| `scout/scout-summary.md` (helix-global-server) | Artifact storage architecture and auth patterns | Vercel Blob storage, ancestor chain fallback, auth middleware details |
| `repo-guidance.json` (prior, from scout) | Initial repo intent classification | helix-cli=target, helix-global-server=context; confirmed by direct evidence |
| `src/routes/api.ts:220-300` (helix-global-server) | Direct verification of auth boundary | Lines 237-238 artifact routes BEFORE line 240 requireAuth — no server changes needed |
| `src/index.ts` (helix-cli) | CLI entry point, version hardcode | Line 47 hardcodes "0.1.0", confirms missing "artifacts" case in switch |
| `src/comments/index.ts` (helix-cli) | Module pattern reference | resolveTicketId + router pattern to replicate for artifacts |
| `src/comments/list.ts` (helix-cli) | Subcommand pattern reference | hxFetch with basePath '/api', typed response, client-side filtering |
| `src/lib/http.ts` (helix-cli) | HTTP client for artifact API calls | hxFetch with basePath override, retry logic, auth header injection |
| `src/lib/config.ts` (helix-cli) | Config/auth loading | HELIX_API_KEY/HELIX_INSPECT_TOKEN env vars, ~/.hlx/config.json fallback |
| `package.json` (helix-cli) | Build/publish configuration | No prepublishOnly, files: ["dist"], dist/ gitignored, ESM module |
| `.gitignore` (helix-cli) | Build output confirmation | dist/ and node_modules/ gitignored |
| GitHub Actions docs (Context7) | Publish workflow best practices | setup-node@v4, registry-url, NPM_TOKEN via NODE_AUTH_TOKEN, --provenance flag |
| `/tmp/helix-inspect/manifest.json` | Runtime inspection availability | Only helix-global-server has inspection (DATABASE, LOGS); no CLI runtime probes needed |
| Prior `diagnosis/apl.json` | Revision target | Contained incorrect auth boundary claim; corrected with direct source verification |

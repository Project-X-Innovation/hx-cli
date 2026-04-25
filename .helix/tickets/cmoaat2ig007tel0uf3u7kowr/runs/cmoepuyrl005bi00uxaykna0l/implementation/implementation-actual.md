# Implementation Actual — HLX-299: helix-cli packaging, documentation, and artifact retrieval

## Summary of Changes

Implemented all 9 steps from the implementation plan in the `helix-cli` repository:

1. Added `prepublishOnly` safety script to `package.json`
2. Fixed version hardcode in `src/index.ts` using `createRequire` to read `package.json` dynamically
3. Created artifact command router at `src/artifacts/index.ts`
4. Created ticket artifact listing command at `src/artifacts/ticket.ts`
5. Created run step-artifact retrieval command at `src/artifacts/run.ts`
6. Wired artifact commands into the CLI entry point with updated usage text
7. Created GitHub Actions publish workflow at `.github/workflows/publish.yml`
8. Created comprehensive `README.md` with install, auth, commands, artifacts, and maintainer publishing setup

No changes to `helix-global-server` — confirmed context-only.

## Files Changed

| File | Why Changed | Review Hotspot |
|---|---|---|
| `package.json` | Added `prepublishOnly: "npm run build"` script to prevent broken publishes | Package scripts (public interface) |
| `src/index.ts` | Fixed version hardcode (0.1.0 → dynamic from package.json), added `artifacts` command case, updated usage text, added `createRequire` import and `runArtifacts` import | CLI entry point (public interface, command routing) |
| `src/artifacts/index.ts` (new) | Artifact command router following `src/comments/index.ts` pattern — resolveTicketId, getFlag, subcommand switch | New module (shared CLI plumbing patterns: resolveTicketId, getFlag) |
| `src/artifacts/ticket.ts` (new) | `hlx artifacts ticket <id>` command — calls `GET /api/tickets/:ticketId/artifacts` via hxFetch | New module (uses hxFetch with basePath '/api') |
| `src/artifacts/run.ts` (new) | `hlx artifacts run <id>` command — calls `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId` via hxFetch, validates `--step` and `--repo-key` flags | New module (uses hxFetch with basePath '/api', flag validation) |
| `.github/workflows/publish.yml` (new) | GitHub Actions workflow: build, typecheck, version-change check, conditional npm publish with `NPM_TOKEN` | CI/CD configuration (deployment-critical) |
| `README.md` (new) | Full documentation: install, auth (env vars, config file, OAuth), command reference, artifact retrieval, maintainer publishing setup (npm token creation, GitHub secret setup) | Documentation (public-facing) |

## Steps Executed

### Step 1: prepublishOnly script
- Added `"prepublishOnly": "npm run build"` to `package.json` scripts section.
- Verified: `node -e` check confirms presence.

### Step 2: Version hardcode fix
- Added `import { createRequire } from "node:module"` at top of `src/index.ts`.
- Added `const require = createRequire(import.meta.url)` and `const pkgVersion = ...` to read version from `package.json`.
- Replaced `console.log("0.1.0")` with `console.log(pkgVersion)`.
- Verified: `node dist/index.js --version` outputs `1.2.0`.

### Step 3: Artifact command router
- Created `src/artifacts/index.ts` with `runArtifacts`, `resolveTicketId`, `getFlag`, `artifactsUsage`.
- Follows `src/comments/index.ts` pattern exactly.

### Step 4: Ticket artifact listing
- Created `src/artifacts/ticket.ts` with `cmdTicketArtifacts`.
- Calls `GET /api/tickets/:ticketId/artifacts` via `hxFetch` with `basePath: '/api'`.
- Supports optional `--run` filter.
- Handles empty state with clear message.

### Step 5: Run step-artifact retrieval
- Created `src/artifacts/run.ts` with `cmdRunArtifacts`.
- Validates `--step` and `--repo-key` as required flags.
- Calls `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId?repoKey=<key>`.
- Prints file content directly for each artifact file.

### Step 6: Wire into CLI entry point
- Added `import { runArtifacts }` to `src/index.ts`.
- Added `case "artifacts"` to switch statement.
- Updated usage text with artifact command syntax.

### Step 7: GitHub Actions publish workflow
- Created `.github/workflows/publish.yml` with:
  - Trigger: push to `main`
  - Steps: checkout, setup-node (v20, registry-url), npm ci, build, typecheck, verify dist/index.js exists, version check comparing local vs published, conditional npm publish
  - Uses `NPM_TOKEN` secret for npm auth

### Step 8: README.md
- Created comprehensive README covering all required sections.
- Includes step-by-step npm token creation (Automation type) and GitHub secret setup.

### Step 9: Final verification
- `npm run build`: exit 0
- `npm run typecheck`: exit 0
- All verification checks run and documented below.

## Verification Commands Run + Outcomes

| Command | Result |
|---|---|
| `npm run build` | Exit 0, dist/ populated with all compiled files |
| `npm run typecheck` | Exit 0, no type errors |
| `node dist/index.js --version` | Outputs `1.2.0` (matches package.json) |
| `node dist/index.js` (no args) | Usage text includes artifact commands |
| `node dist/index.js artifacts` (with dummy auth) | Artifact subcommand usage displayed |
| `node dist/index.js artifacts run X --ticket Y` (with dummy auth) | "Error: --step flag is required..." |
| `node dist/index.js artifacts run X --ticket Y --step Z` (with dummy auth) | "Error: --repo-key flag is required..." |
| `npm pack --dry-run` | Package includes dist/index.js, all dist/artifacts/*.js files, README.md |
| `node -e "..." prepublishOnly check` | PASS |
| `ls dist/artifacts/` | index.js, ticket.js, run.js (+ .d.ts files) |

## Test/Build Results

- **Build**: PASS (exit 0)
- **Typecheck**: PASS (exit 0)
- **npm pack**: 34 files, 9.7 kB packed, includes dist/index.js and all artifact command files
- **Zero new dependencies**: No runtime deps added. Only Node.js builtins used.

## Deviations from Plan

1. **Plan workspace paths**: The plan referenced `/vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli` but actual workspace is at `/vercel/sandbox/workspaces/cmoepuyrl005bi00uxaykna0l/helix-cli`. No functional impact — paths adjusted.

2. **CHK-04 live test blocked**: The implementation plan expected optional live testing against a Helix server. The dev server (helix-global-server) has a Prisma schema drift (User.avatarUrl column missing from production database), preventing login. Auth error path verified with dummy credentials instead. This is a pre-existing server-side issue, not a CLI bug.

## Known Limitations / Follow-ups

- **No `--json` output**: As specified in the plan and product scope, human-readable output only. Can be added later.
- **No tests**: The repository has no test infrastructure (no test script, no test files). Adding tests was out of scope per the implementation plan.
- **Live artifact retrieval untested**: Blocked by server schema drift. The CLI code follows the same hxFetch + basePath pattern proven in the comments module.

## Verification Plan Results

| Check ID | Outcome | Evidence/Notes |
|---|---|---|
| CHK-01 | pass | `npm run build` exits 0; `dist/artifacts/` contains index.js, ticket.js, run.js |
| CHK-02 | pass | `npm run typecheck` exits 0, no errors |
| CHK-03 | pass | `node dist/index.js --version` outputs `1.2.0` |
| CHK-04 | blocked | Server schema drift (User.avatarUrl missing) prevents login; auth error handling verified separately — CLI exits with clear "Not authenticated" message, no crash |
| CHK-05 | pass | Missing `--step` produces "Error: --step flag is required..."; missing `--repo-key` produces "Error: --repo-key flag is required..."; both exit non-zero |
| CHK-06 | pass | .github/workflows/publish.yml contains: trigger on push to main, actions/checkout@v4, actions/setup-node@v4 with registry-url, npm ci, npm run build, npm run typecheck, dist/index.js existence check, version comparison step with should_publish output, conditional npm publish with NODE_AUTH_TOKEN from secrets.NPM_TOKEN, permissions block with contents: read and id-token: write |
| CHK-07 | pass | README.md contains: npm install command, Node >=18 requirement, hlx login + env vars + config file auth docs, command reference for all commands including artifacts, Automation token instructions, NPM_TOKEN GitHub secret setup |
| CHK-08 | pass | package.json scripts contains "prepublishOnly": "npm run build" |
| CHK-09 | pass | `node dist/index.js` usage text includes "hlx artifacts ticket" and "hlx artifacts run" lines |

Self-verification is partially blocked due to CHK-04. All other checks pass.

## APL Statement Reference

Implementation complete for helix-cli: added prepublishOnly script, fixed version hardcode, created artifact commands module (ticket and run subcommands) following the comments module pattern, wired into CLI entry point, created GitHub Actions publish workflow with version-change gating and NPM_TOKEN secret, and created comprehensive README with install, auth, commands, artifact retrieval, and maintainer publishing setup documentation. All changes in helix-cli only. Build and typecheck pass. Live artifact test blocked by server schema drift.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `implementation-plan/implementation-plan.md` (helix-cli) | Primary implementation blueprint | 9-step plan covering prepublishOnly, version fix, artifact commands, CLI wiring, workflow, README |
| `implementation-plan/apl.json` (helix-cli) | Step ordering and cross-repo analysis | Confirmed no server changes needed, all changes in helix-cli |
| `scout/reference-map.json` (helix-cli) | File inventory and patterns | Zero prod deps, ESM-only, comments module as pattern reference, no .github/ or README |
| `repo-guidance.json` (helix-cli) | Repo intent classification | helix-cli = target, helix-global-server = context only |
| `ticket.md` (helix-cli) | Ticket requirements and continuation context | Three deliverables: publish workflow, README, artifact commands |
| `src/comments/index.ts` (helix-cli) | Router pattern reference | resolveTicketId, getFlag, subcommand routing pattern replicated in artifacts module |
| `src/comments/list.ts` (helix-cli) | Subcommand implementation pattern | hxFetch with basePath '/api', typed response, human-readable output |
| `src/lib/http.ts` (helix-cli) | HTTP transport API | hxFetch signature with basePath and queryParams options |
| `src/lib/config.ts` (helix-cli) | Auth/config loading | HxConfig type, env var priority order, config file path |
| `src/index.ts` (helix-cli) | CLI entry point structure | Switch/case routing, version hardcode at line 47, usage function pattern |
| `package.json` (helix-cli) | Build/package configuration | Version 1.2.0, type: "module", files: ["dist"], engines: node >=18 |

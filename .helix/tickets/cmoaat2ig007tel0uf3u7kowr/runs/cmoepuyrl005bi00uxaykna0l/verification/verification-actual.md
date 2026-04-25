# Verification Actual — HLX-299: helix-cli packaging, documentation, and artifact retrieval

## Outcome

**pass**

All 9 Required Checks (CHK-01 through CHK-09) passed with direct evidence. CHK-04's primary path (live artifact listing) was blocked by a pre-existing server schema drift (User.avatarUrl column missing from production database), but the check's own fallback evidence path ("If credentials are unavailable, the command should output a clear authentication error message (not a crash)") is fully satisfied.

## Steps Taken

1. **[CHK-01] Installed dependencies and ran TypeScript build**: `npm install` (up to date), then `npm run build` — exit code 0. Listed `dist/artifacts/` confirming `index.js`, `ticket.js`, `run.js` (plus `.d.ts` files) present.

2. **[CHK-02] Ran TypeScript typecheck**: `npm run typecheck` — exit code 0, no type errors.

3. **[CHK-03] Verified version output**: `node dist/index.js --version` outputs `1.2.0` matching `package.json` version field. Not the old hardcoded `0.1.0`.

4. **[CHK-04] Tested artifact ticket command with unavailable credentials**:
   - Started `helix-global-server` on port 4000 with provided .env config.
   - Server started successfully but login failed due to Prisma schema drift (`User.avatarUrl` column missing from database).
   - Without credentials: `node dist/index.js artifacts ticket cmoaat2ig007tel0uf3u7kowr` outputs "Not authenticated. Run `hlx login <server-url>` or set HELIX_API_KEY + HELIX_URL env vars." (exit 1).
   - With fake credentials against live server: `HELIX_API_KEY=fake_key HELIX_URL=http://localhost:4000 node dist/index.js artifacts ticket cmoaat2ig007tel0uf3u7kowr` outputs "HTTP 401 Unauthorized — {"error":"Unauthorized."}" (exit 1).
   - Both paths produce clear error messages. No stack traces or unhandled errors.
   - CHK-04 fallback evidence path ("If credentials are unavailable, the command should output a clear authentication error message (not a crash)") is satisfied.

5. **[CHK-05] Tested artifact run command flag validation**:
   - Missing `--step`: "Error: --step flag is required for run artifact retrieval." (exit 1).
   - Missing `--repo-key`: "Error: --repo-key flag is required for run artifact retrieval." (exit 1).
   - Both produce clear error messages with non-zero exit codes.

6. **[CHK-06] Verified GitHub Actions workflow file structure**: Read `.github/workflows/publish.yml` and confirmed all required elements:
   - Trigger: `on: push: branches: [main]` ✓
   - `actions/checkout@v4` ✓
   - `actions/setup-node@v4` with `node-version: "20"` and `registry-url: "https://registry.npmjs.org"` ✓
   - `npm ci` step ✓
   - `npm run build` step ✓
   - `npm run typecheck` step ✓
   - Verify build output step checking `dist/index.js` exists ✓
   - Version comparison step: compares local version to `npm view @projectxinnovation/helix-cli version` with step output `should_publish` ✓
   - Publish step: `npm publish --access public` with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` ✓
   - Publish conditional: `if: steps.version_check.outputs.should_publish == 'true'` ✓
   - Permissions block: `contents: read`, `id-token: write` ✓

7. **[CHK-07] Verified README contains all required sections**: Read `README.md` and confirmed:
   - (a) Install command: `npm install -g @projectxinnovation/helix-cli` ✓
   - (b) Node.js requirement: "Requires **Node.js >= 18**" ✓
   - (c) Authentication: `hlx login`, env vars (HELIX_API_KEY, HELIX_URL, and aliases), config file (~/.hlx/config.json) ✓
   - (d) Command reference: all commands including `hlx artifacts ticket` and `hlx artifacts run` with flags ✓
   - (e) Maintainer section: npm token creation steps mentioning "Automation" token type ✓
   - (f) GitHub repository secret setup: mentions `NPM_TOKEN` with step-by-step instructions ✓

8. **[CHK-08] Verified prepublishOnly script**: Read `package.json` — `scripts` contains `"prepublishOnly": "npm run build"` ✓

9. **[CHK-09] Verified CLI usage text includes artifact commands**: `node dist/index.js` (no args) outputs usage text containing:
   - `hlx artifacts ticket <ticket-id> [--run <run-id>]`
   - `hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>`

10. **Additional verification**: Ran `npm pack --dry-run` confirming package includes dist/index.js, dist/artifacts/*.js, and README.md (34 files, 9.7 kB packed).

## Findings

| Check ID | Outcome | Evidence |
|---|---|---|
| CHK-01 | pass | `npm run build` exits 0; `dist/artifacts/` contains `index.js`, `ticket.js`, `run.js` |
| CHK-02 | pass | `npm run typecheck` exits 0, no type errors |
| CHK-03 | pass | `node dist/index.js --version` outputs `1.2.0` (matches `package.json`) |
| CHK-04 | pass (fallback path) | No valid credentials available (server schema drift). CLI outputs clear auth errors: "Not authenticated..." and "HTTP 401 Unauthorized..." with exit code 1. No crashes or stack traces. Satisfies check's explicit fallback: "If credentials are unavailable, the command should output a clear authentication error message (not a crash)." |
| CHK-05 | pass | Missing `--step` → clear error + exit 1; missing `--repo-key` → clear error + exit 1 |
| CHK-06 | pass | Workflow file contains all required elements: trigger, checkout, setup-node with registry-url, npm ci, build, typecheck, dist/index.js verify, version check with should_publish output, conditional publish with NPM_TOKEN secret, permissions block |
| CHK-07 | pass | README has all 6 required content areas: install cmd, Node >=18, auth docs, full command reference, Automation token instructions, NPM_TOKEN GitHub secret setup |
| CHK-08 | pass | `package.json` scripts contains `"prepublishOnly": "npm run build"` |
| CHK-09 | pass | Usage text includes `hlx artifacts ticket <ticket-id> [--run <run-id>]` and `hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>` |

## Notes

- **CHK-04 server blocker**: The helix-global-server has a pre-existing Prisma schema drift (`User.avatarUrl` column missing from production database), preventing any authenticated operations including login. This is documented by the implementation as a known issue and is **not** a CLI bug. The CLI's error handling was verified under both no-credentials and invalid-credentials scenarios.
- **Code review changes**: Code review added `[--run <run-id>]` to usage text in `src/index.ts` (line 28) and `src/artifacts/index.ts` (line 24). Both changes are cosmetic (usage text only) and build/typecheck pass. The additional `--run` filter is visible in CHK-09 output.
- **Package contents verified**: `npm pack --dry-run` shows 34 files including all artifact command compiled outputs and README.md.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `implementation-plan/implementation-plan.md` (helix-cli) | Verification plan with 9 Required Checks (CHK-01–CHK-09) | Defined checks, pre-conditions, expected outcomes, and required evidence for each check |
| `implementation/implementation-actual.md` (helix-cli) | Context on what was implemented and self-verification results | 9 steps completed; CHK-04 blocked by server schema drift (same result in independent verification) |
| `code-review/code-review-actual.md` (helix-cli) | Code review changes and risk assessment | Minor usage text fix (added `[--run <run-id>]`); no correctness issues; no verification impact |
| `code-review/apl.json` (helix-cli) | Structured code review evidence | Confirmed all requirements met, one cosmetic fix applied |
| `package.json` (helix-cli) | CHK-08 verification target | Contains `prepublishOnly: "npm run build"`, version 1.2.0 |
| `src/index.ts` (helix-cli) | CHK-03, CHK-09 verification target | Dynamic version via `createRequire`, artifacts case wired, usage text includes artifact commands |
| `src/artifacts/index.ts` (helix-cli) | CHK-04, CHK-05 verification target | Router with resolveTicketId, getFlag, subcommand routing |
| `src/artifacts/ticket.ts` (helix-cli) | CHK-04 verification target | Calls GET /api/tickets/:ticketId/artifacts via hxFetch |
| `src/artifacts/run.ts` (helix-cli) | CHK-05 verification target | Validates --step and --repo-key flags with clear error messages |
| `.github/workflows/publish.yml` (helix-cli) | CHK-06 verification target | Complete workflow with trigger, build, version check, conditional publish |
| `README.md` (helix-cli) | CHK-07 verification target | Comprehensive docs: install, auth, commands, artifacts, maintainer setup |

# Verification Actual — BLD-375: Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Outcome

**pass** — All 12 Required Checks completed successfully with direct evidence.

## Steps Taken

1. [CHK-01] Ran `npm run typecheck` in helix-cli repo root. Command exited with code 0, `tsc --noEmit` produced no errors.
2. [CHK-02] Ran `npm test` in helix-cli repo root. Command exited with code 0. All 30 tests passed across 6 suites (isHelpRequested, hasFlag, getFlag, getPositionalArgs, matchTicket, extractTicketRef), 0 failures, 0 skipped.
3. [CHK-03] Ran `node -e` to extract `repository` and `publishConfig` from `package.json`. Output confirmed: `repository.type` = `"git"`, `repository.url` = `"https://github.com/Project-X-Innovation/helix-cli.git"`, `publishConfig.access` = `"public"`, `publishConfig.provenance` = `true`, `publishConfig.registry` = `"https://registry.npmjs.org"`.
4. [CHK-04] Ran `npm run build && npm pack --dry-run`. Output listed 73 files including `dist/index.js`. Grep for `.test.` patterns returned no matches — confirmed zero `.test.js` or `.test.d.ts` files in the tarball.
5. [CHK-05] Ran `npm run build && node dist/index.js --version`. Output: `1.2.0`, exit code 0.
6. [CHK-06] Ran `npm run build && node dist/index.js --help`. The `hlx update` line reads "Check for and apply updates from npm". Grep for "GitHub main" returned no matches.
7. [CHK-07] Read `.github/workflows/publish.yml`. Confirmed all required elements:
   - (a) Tag push trigger: `on: push: tags: ['v*']` (lines 3–6)
   - (b) OIDC permissions: `id-token: write`, `contents: read` (lines 8–10)
   - (c) `actions/setup-node@v4` with `registry-url: 'https://registry.npmjs.org'` (lines 18–21)
   - (d) `npm ci` step (line 23)
   - (e) `npm test` step (line 26)
   - (f) Version-match step comparing `GITHUB_REF_NAME` tag to `package.json` version (lines 29–36)
   - (g) `npm pack` + `tar -tzf` + `grep -q "package/dist/index.js"` validation + test file leak check (lines 39–55)
   - (h) `npm publish *.tgz --provenance` (line 59)
   - No `NPM_TOKEN` or `NODE_AUTH_TOKEN` references (grep confirmed 0 matches).
8. [CHK-08] Read `src/lib/config.ts`. `InstallSource` type at line 5–11: `mode: "github" | "npm" | "unknown"` (includes `"npm"`), `version?: string` field present. All existing fields (`repo`, `branch`, `commit`) preserved.
9. [CHK-09] Read `src/update/check.ts`. Confirmed:
   - `NPM_PACKAGE = "@projectxinnovation/helix-cli"` (line 9)
   - `fetchLatestVersion()` calls `npm view @projectxinnovation/helix-cli version` via `execSync` (lines 15–29)
   - `isNewerVersion(remote, local)` compares major.minor.patch numerically with NaN guards (lines 36–47)
10. [CHK-10] Read `src/update/perform.ts`. Confirmed:
    - Imports `NPM_PACKAGE` from `./check.js` (line 2)
    - `installSpec = \`\${NPM_PACKAGE}@latest\`` (line 15), resolves to `@projectxinnovation/helix-cli@latest`
    - No `github:` install spec remains
11. [CHK-11] Read `src/update/index.ts`. Confirmed:
    - `runUpdate()` calls `fetchLatestVersion()` (line 55) and uses `isNewerVersion()` (line 65)
    - `checkAutoUpdate()` uses the same npm-based flow: `fetchLatestVersion()` (line 132), `isNewerVersion()` (line 138)
    - `isCanonicalSource()` returns `true` for `mode === "npm"` (line 22), also accepts `mode === "github"` with repo/branch check for backward compatibility
    - Config saved with `mode: "npm"` and `version` field (lines 93–97, 155–158)
    - No SHA comparison logic remains in the main update path
12. [CHK-12] Read `.npmignore`. File contains exactly two patterns: `dist/**/*.test.js` (line 1) and `dist/**/*.test.d.ts` (line 2).

## Findings

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npm run typecheck` exit code 0, `tsc --noEmit` zero errors |
| CHK-02 | pass | `npm test` exit code 0, 30/30 tests pass, 0 failures |
| CHK-03 | pass | JSON output: `repository.url` = `https://github.com/Project-X-Innovation/helix-cli.git`, `publishConfig.access` = `public`, `provenance` = `true`, `registry` = `https://registry.npmjs.org` |
| CHK-04 | pass | `npm pack --dry-run`: 73 files listed, `dist/index.js` present, grep for `.test.` yields zero matches |
| CHK-05 | pass | `node dist/index.js --version` outputs `1.2.0`, exit code 0 |
| CHK-06 | pass | `node dist/index.js --help` shows "Check for and apply updates from npm", no "GitHub main" found |
| CHK-07 | pass | File read confirms: tag trigger `v*`, `id-token: write` + `contents: read`, `setup-node` with `registry-url`, `npm ci`, `npm test`, version-match step, `npm pack` + `tar -tzf` + `dist/index.js` grep, test file leak check, `npm publish *.tgz --provenance`, zero NPM_TOKEN/NODE_AUTH_TOKEN references |
| CHK-08 | pass | `src/lib/config.ts` line 6: `mode: "github" \| "npm" \| "unknown"`, line 10: `version?: string` |
| CHK-09 | pass | `src/update/check.ts`: `NPM_PACKAGE = "@projectxinnovation/helix-cli"`, `fetchLatestVersion()` uses `npm view`, `isNewerVersion()` compares major.minor.patch numerically |
| CHK-10 | pass | `src/update/perform.ts`: imports `NPM_PACKAGE` from `./check.js`, `installSpec = NPM_PACKAGE@latest`, no `github:` reference |
| CHK-11 | pass | `src/update/index.ts`: `runUpdate()` uses `fetchLatestVersion()` + `isNewerVersion()`, `checkAutoUpdate()` same, `isCanonicalSource()` returns true for npm mode, config saved with `mode: "npm"` + `version` |
| CHK-12 | pass | `.npmignore` contains `dist/**/*.test.js` and `dist/**/*.test.d.ts` |

## Remediation Guidance

Not applicable — all checks passed.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `implementation-plan/implementation-plan.md` | Verification Plan with 12 Required Checks | Defined all checks, actions, expected outcomes, and required evidence |
| `implementation/implementation-actual.md` | Context on what was implemented and deviations | 8 steps completed, deviation on test exclusion mechanism (files negation + .npmignore) |
| `code-review/code-review-actual.md` | Code review findings and verification impact | No code changes by review; all 12 checks valid; no issues found |
| `ticket.md` | Primary requirements and acceptance criteria | 7 acceptance criteria; OIDC, no NPM_TOKEN, fail-closed, tarball validation |
| `.github/workflows/publish.yml` (direct read) | CHK-07 verification | Full OIDC publish workflow with tarball validation |
| `src/lib/config.ts` (direct read) | CHK-08 verification | InstallSource type with npm mode and version field |
| `src/update/check.ts` (direct read) | CHK-09 verification | NPM_PACKAGE constant, fetchLatestVersion, isNewerVersion |
| `src/update/perform.ts` (direct read) | CHK-10 verification | NPM_PACKAGE@latest install spec |
| `src/update/index.ts` (direct read) | CHK-11 verification | npm-based update orchestration |
| `.npmignore` (direct read) | CHK-12 verification | Test file exclusion patterns |

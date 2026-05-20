# Verification Actual — BLD-527: Replace hlx self-update with GitHub release assets

## Outcome

**pass**

All 12 required checks from the Verification Plan were executed and passed with direct evidence.

## Steps Taken

1. **[CHK-01] TypeScript typecheck passes** — Ran `npx tsc --noEmit` from the repository root after `npm install`. Command exited with code 0 and reported zero type errors.

2. **[CHK-02] Full build succeeds** — Ran `npm run build`. Command exited with code 0. Verified `dist/update/` contains all expected compiled files: `check.js`, `check.d.ts`, `index.js`, `index.d.ts`, `perform.js`, `perform.d.ts`, `validate.js`, `validate.d.ts`, `version.js`, `version.d.ts`.

3. **[CHK-03] Tests pass** — Ran `npm test`. Command exited with code 0. Output: 51 tests passed, 0 failed, 0 skipped, 0 cancelled across 17 test suites. Tests cover flag parsing, ticket resolution, and skill operations.

4. **[CHK-04] CLI --version runs after build** — Ran `node dist/index.js --version`. Command exited with code 0, output: `1.3.4` (with an informational message about running `hlx update` to refresh metadata).

5. **[CHK-05] auto-tag.yml is deleted** — `ls .github/workflows/auto-tag.yml` returned "No such file or directory" (exit code 2). `ls .github/workflows/` shows only `build-release.yml` and `publish.yml`.

6. **[CHK-06] publish.yml is preserved unchanged** — Read the full content of `.github/workflows/publish.yml`. Confirmed it triggers on `push: tags: ['v*']` (line 4-6), has `id-token: write` permission (line 9), and runs `npm publish *.tgz --provenance` (line 62). The file contains OIDC trusted publishing, version verification, and tarball validation steps. Note: git diff was unavailable (git commands blocked in sandbox), so verification was done by reading and confirming the file contains all expected structural elements matching the original described in the implementation plan.

7. **[CHK-07] build-release.yml exists with correct structure** — Read `.github/workflows/build-release.yml`. Verified: triggers on `push: branches: [main]` (line 4-6), `permissions: contents: write` (line 8-9), concurrency group `build-release` with `cancel-in-progress: true` (lines 11-13), uses `actions/checkout@v4` and `actions/setup-node@v4` with Node 22, runs `npm ci` and `npm test`, generates `build-metadata.json` with `$GITHUB_SHA`, creates tarball excluding test files, deletes existing `latest` release, creates new `latest` release with `gh release create latest`. Tag `latest` does not match `v*`.

8. **[CHK-08] No hardcoded npm install -g git+https references remain** — Searched `src/`, `.github/`, and `skill-content/` for `npm install -g git+https` — zero matches in all three directories. Searched `src/` for `GIT_INSTALL_SPEC` — zero matches. Matches found only in `.helix/` ticket artifacts (not application code).

9. **[CHK-09] Update module uses GitHub REST API, not git ls-remote** — Searched `src/update/check.ts` for `git ls-remote` — zero matches. Read the file and confirmed: `fetchLatestRelease` function exported (line 50) that calls `https://api.github.com/repos/Project-X-Innovation/helix-cli/releases/tags/latest` (line 56). `getGitHubToken` function exported (line 25) implementing auth chain: `GITHUB_TOKEN` -> `GH_TOKEN` -> `gh auth token` -> null.

10. **[CHK-10] Staged update mechanism implemented in perform.ts** — Read `src/update/perform.ts` and confirmed: `performStagedUpdate` exported (line 77), staging path `~/.hlx/staging/` (line 16), downloads tarball via `fetch()` with `Accept: application/octet-stream` (lines 96-106), extracts via `tar -xzf` (line 124), calls `validateStaged()` (line 134), rename-based swap with `.bak` backup directories (lines 149-188), rollback on swap failure (lines 189-223), cleanup in `finally` block (lines 234-245), EXDEV cross-filesystem fallback (lines 50-54), Windows retry via `Atomics.wait` (lines 56-60). Grep confirmed zero `npm install -g` references.

11. **[CHK-11] Validation operates on staged directory, not npm global path** — Read `src/update/validate.ts`. `validateStaged` exported (line 14), takes `stagingDir: string` parameter, checks `dist/index.js` existence (line 22), checks `package.json` existence (line 30), runs `node <dir>/dist/index.js --version` with `HLX_SKIP_UPDATE_CHECK=1` env var (lines 38-42). Grep confirmed zero `npm root` references.

12. **[CHK-12] Error messages provide explicit GitHub auth guidance** — Read `src/update/index.ts`. Lines 59-64 in `runUpdate()` handle auth failure with explicit guidance mentioning: (1) `GITHUB_TOKEN` environment variable, (2) `GH_TOKEN` environment variable, (3) `gh auth login`. `process.exit(1)` called after the message (line 66). `checkAutoUpdate()` also handles auth failure at line 162 with a warning that references `hlx update` for details.

## Findings

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | **pass** | `npx tsc --noEmit` exits 0, no type errors reported |
| CHK-02 | **pass** | `npm run build` exits 0; `dist/update/` contains check.js, perform.js, validate.js, index.js, version.js (plus .d.ts files) |
| CHK-03 | **pass** | `npm test` exits 0; 51 tests passed, 0 failed, 0 skipped |
| CHK-04 | **pass** | `node dist/index.js --version` exits 0, outputs `1.3.4` |
| CHK-05 | **pass** | `auto-tag.yml` does not exist; `ls .github/workflows/` shows only `build-release.yml` and `publish.yml` |
| CHK-06 | **pass** | `publish.yml` contains expected structure: triggers on `v*` tags, `id-token: write`, `npm publish *.tgz --provenance` |
| CHK-07 | **pass** | `build-release.yml` has correct trigger (push to main), permissions (contents: write), concurrency group, all build/test/release steps, uses `latest` tag (not `v*`) |
| CHK-08 | **pass** | Zero matches for `npm install -g git+https` in src/, .github/, skill-content/; zero matches for `GIT_INSTALL_SPEC` in src/ |
| CHK-09 | **pass** | No `git ls-remote` in check.ts; `fetchLatestRelease` calls `api.github.com`; `getGitHubToken` implements GITHUB_TOKEN -> GH_TOKEN -> gh auth token chain |
| CHK-10 | **pass** | `performStagedUpdate` stages to `~/.hlx/staging/`, downloads via fetch, extracts via tar, validates, does rename-based swap with `.bak`, rollback on failure, cleanup in finally block; no `npm install -g` |
| CHK-11 | **pass** | `validateStaged` takes directory path, checks `dist/index.js` and `package.json` existence, runs `--version` with `HLX_SKIP_UPDATE_CHECK=1`; no `npm root` |
| CHK-12 | **pass** | Auth failure message mentions `GITHUB_TOKEN`, `GH_TOKEN`, and `gh auth login` (lines 59-64 of index.ts) |

### Additional Observations

- **Code Review fix verified**: The code review added `--ignore-scripts` to the install instruction in `cli-content.ts`. This is a documentation-only change that does not affect any behavioral verification check.
- **Fail-open / fail-closed behavior preserved**: `runUpdate()` calls `process.exit(1)` on failure (fail-closed). `checkAutoUpdate()` uses `return` with `console.error` warnings on failure (fail-open, never exits).
- **No browser verification required**: This ticket is entirely CLI/workflow/API changes with no UI components.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `implementation-plan/implementation-plan.md` | Verification Plan with 12 Required Checks | Defined CHK-01 through CHK-12 with specific actions, expected outcomes, and required evidence |
| `implementation/implementation-actual.md` | Context about what implementation agent attempted | All 8 steps claimed complete; used as context only, independently verified each check |
| `code-review/code-review-actual.md` | Understanding code review changes and verification impact | One fix: `--ignore-scripts` added to cli-content.ts install instruction; no verification impact |
| `code-review/apl.json` | Structured code review evidence | Confirmed the installation instruction bug and fix; all acceptance criteria satisfied |
| `implementation/apl.json` | Implementation structured evidence | Cross-referenced claims against direct observation |
| `ticket.md` | Primary requirements and acceptance criteria | Acceptance criteria used to validate completeness of implementation |

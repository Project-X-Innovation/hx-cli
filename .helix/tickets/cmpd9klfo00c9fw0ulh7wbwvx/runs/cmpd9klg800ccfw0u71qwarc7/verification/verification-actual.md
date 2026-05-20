# Verification Actual — BLD-517: Install and update hlx from GitHub main instead of npm

## Outcome

**pass**

All 9 required checks from the Verification Plan were executed independently and passed with direct evidence.

## Steps Taken

1. **Environment setup**: Wrote `.env` file, ran `npm install` (which also ran `prepare` script / `tsc` build). Dependencies installed successfully.
2. **[CHK-01] TypeScript typecheck**: Ran `npm run typecheck` — exited with code 0, zero type errors.
3. **[CHK-02] Project build**: Ran `npm run build` — exited with code 0. Listed `dist/update/` — confirmed presence of `check.js`, `perform.js`, `version.js`, `index.js`, `validate.js` (plus `.d.ts` declaration files).
4. **[CHK-03] hlx --version**: Ran `HLX_SKIP_UPDATE_CHECK=1 node dist/index.js --version` — output `1.3.4` (stdout) and `Run 'hlx update' to refresh install metadata.` (stderr). Exit code 0. Matches expected behavior for sandbox with no config SHA.
5. **[CHK-04] No npm registry query code in update module**: Ran `grep -rn "fetchLatestVersion\|npm view\|npm registry" src/update/` — zero matches (exit code 1). Confirmed `fetchRemoteSha()` is the only remote-check function.
6. **[CHK-05] No @projectxinnovation/helix-cli@latest references**: Ran `grep -rn "@projectxinnovation/helix-cli@latest" src/ skill-content/` — zero matches (exit code 1).
7. **[CHK-06] GIT_INSTALL_SPEC constant**: Ran `grep -n "GIT_INSTALL_SPEC" src/update/check.ts src/update/perform.ts` — confirmed:
   - `check.ts:9`: export const `GIT_INSTALL_SPEC` = `` `git+${CANONICAL_REPO_URL}#${CANONICAL_BRANCH}` ``
   - `perform.ts:2`: imported from `./check.js`
   - `perform.ts:15`: used as `const installSpec = GIT_INSTALL_SPEC`
8. **[CHK-07] Install source recording**: Ran `grep -n` on `src/update/index.ts` — confirmed `saveConfig()` calls at lines 109-112 and 175-178 record `{ mode: "github", repo: CANONICAL_REPO, branch: CANONICAL_BRANCH, commit: remoteSha }` in both `runUpdate()` and `checkAutoUpdate()`.
9. **[CHK-08] Documentation references canonical install command**: Used Grep tool on `src/docs/cli-content.ts`, `src/skill/show.ts`, `src/skill/paths.ts` — found 4 matches:
   - `cli-content.ts:18` — install section
   - `cli-content.ts:301` — troubleshooting reinstall
   - `show.ts:15` — error message
   - `paths.ts:25` — error message
10. **[CHK-09] Existing tests pass**: Ran `npm test` — 51 tests pass, 0 fail, 0 cancelled, 0 skipped. Exit code 0.

## Findings

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | **pass** | `npm run typecheck` exits 0 with zero type errors in output. |
| CHK-02 | **pass** | `npm run build` exits 0. `dist/update/` contains check.js, perform.js, version.js, index.js, validate.js plus corresponding `.d.ts` files. |
| CHK-03 | **pass** | `HLX_SKIP_UPDATE_CHECK=1 node dist/index.js --version` outputs `1.3.4` (stdout) and `Run 'hlx update' to refresh install metadata.` (stderr). Exit code 0. Matches expected behavior for sandbox without config SHA. |
| CHK-04 | **pass** | `grep -rn "fetchLatestVersion\|npm view\|npm registry" src/update/` returns zero matches. No npm registry query code remains in the update module. |
| CHK-05 | **pass** | `grep -rn "@projectxinnovation/helix-cli@latest" src/ skill-content/` returns zero matches. All old npm install references removed. |
| CHK-06 | **pass** | `GIT_INSTALL_SPEC` defined in `check.ts:9` as export composing `CANONICAL_REPO_URL` + `CANONICAL_BRANCH`; imported in `perform.ts:2` and used as install spec at `perform.ts:15`. |
| CHK-07 | **pass** | `saveConfig()` calls in `runUpdate()` (lines 109-112) and `checkAutoUpdate()` (lines 175-178) both record `{ mode: "github", repo: CANONICAL_REPO, branch: CANONICAL_BRANCH, commit: remoteSha }`. |
| CHK-08 | **pass** | 4 matches found across documentation files: `cli-content.ts:18`, `cli-content.ts:301`, `show.ts:15`, `paths.ts:25`. All reference the canonical `git+https://github.com/Project-X-Innovation/helix-cli.git#main` URL. |
| CHK-09 | **pass** | `npm test` — 51 tests pass, 0 fail, 0 cancelled, 0 skipped. All existing test suites (flags.test.ts, resolve-ticket.test.ts, skill.test.ts) pass. Exit code 0. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| implementation-plan/implementation-plan.md | Contains the Verification Plan with all 9 Required Checks and pre-conditions | Defined CHK-01 through CHK-09 with specific actions, expected outcomes, and required evidence |
| implementation/implementation-actual.md | Context about what was implemented and claimed outcomes | 9 files changed; all 7 steps executed; used as context only, not as proof |
| code-review/code-review-actual.md | Code review findings and verification impact notes | No code changes made by review; all CHK-01 through CHK-09 remain valid as-is; no new risks identified |
| ticket.md | Primary specification with acceptance criteria | SHA-based comparison, git+https URL, npm migration, fail-closed semantics, --version with SHA |

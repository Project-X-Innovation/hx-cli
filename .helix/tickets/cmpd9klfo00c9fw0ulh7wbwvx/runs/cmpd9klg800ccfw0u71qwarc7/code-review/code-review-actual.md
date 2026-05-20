# Code Review Actual - BLD-517: Install and update hlx from GitHub main instead of npm

## Review Scope

Reviewed the complete implementation of BLD-517, which rewires the `hlx` CLI update system from npm-registry-based semver comparison to GitHub-main SHA-based comparison. The review covered all 9 changed files listed in the implementation artifact, plus supporting files (config.ts, validate.ts) and all user-facing documentation surfaces.

Review focus areas:
- Correctness of SHA-based update flow (both explicit and auto-update)
- Migration logic for npm-sourced installs
- Fail-closed (runUpdate) vs fail-open (checkAutoUpdate) error handling
- Completeness of npm registry reference removal
- Documentation and error message accuracy
- Version output format compliance
- Regression risk to existing functionality

## Files Reviewed

| File | Review Result | Notes |
|------|---------------|-------|
| `src/update/check.ts` | Clean | GIT_INSTALL_SPEC correctly composed from existing constants; NPM_PACKAGE/fetchLatestVersion/isNewerVersion removed; fetchRemoteSha and isUpdateAvailable retained |
| `src/update/perform.ts` | Clean | GIT_INSTALL_SPEC imported and used as installSpec; JSDoc updated |
| `src/update/version.ts` | Clean | loadFullConfig import added; SHA appended when commit >= 7 chars; try-catch prevents throws |
| `src/update/index.ts` | Clean | SHA-based comparison in both runUpdate and checkAutoUpdate; migration detection correct; fail-closed/fail-open behavior correct; saveConfig records github mode with SHA |
| `src/index.ts` | Clean | Usage text updated; --version handler prints fallback note on stderr when SHA absent |
| `src/docs/cli-content.ts` | Clean | All 4 npm references updated to git+https URL; keyword "npm" replaced with "github" |
| `src/skill/show.ts` | Clean | Reinstall error message updated to git+https URL |
| `src/skill/paths.ts` | Clean | Reinstall error message updated to git+https URL |
| `skill-content/references/commands.md` | Clean | "updates from npm" changed to "updates from GitHub" |
| `src/update/validate.ts` (supporting) | Clean - unchanged | Path construction uses package name (correct for git installs); npm used only as installer tool |
| `src/lib/config.ts` (supporting) | Clean - unchanged | InstallSource type supports commit field; saveConfig does read-merge-write; loadFullConfig returns Partial<HxConfig> |
| `skill-content/SKILL.md` (supporting) | Clean - unchanged | No npm registry references present |

## Missed Requirements & Issues Found

### Requirements Gaps

None. All ticket requirements and acceptance criteria are addressed:
1. Canonical install command uses git+https URL
2. `hlx update` uses SHA-based comparison with fail-closed semantics
3. `--enable-auto`/`--disable-auto` behavior preserved
4. Pre-command auto-update check is non-blocking
5. Migration path detects npm/missing/unknown install source
6. `hlx --version` includes short SHA with semver-only fallback
7. All npm registry references removed from user-facing text
8. Neither install nor update path queries the npm registry

### Correctness / Behavior Issues

None found. The implementation correctly:
- Exits non-zero when remote SHA fetch fails (runUpdate) and warns on stderr without blocking (checkAutoUpdate)
- Records `{mode: "github", repo, branch, commit}` on successful update in both paths
- Does not record success when install or validation fails
- Handles missing/corrupt config as "no install source" (triggers migration)
- Separates stdout (version) from stderr (fallback note) in --version handler

### Regression Risks

None identified. Key mitigations verified:
- `validateInstall()` path construction uses package name (works identically for git installs)
- `isCanonicalSource()` accepts both "npm" and "github" modes (auto-update works for both)
- `HLX_SKIP_UPDATE_CHECK=1` env var is set during install to prevent update loop
- `SKIP_AUTO_UPDATE` set in main index.ts excludes --version, update, and skill commands
- All 51 existing tests pass after changes

### Code Quality / Robustness

Minor observations (not requiring fixes):
1. **Dead code in non-quiet validation path**: In `runUpdate()` (index.ts:97-98), `if (result.stderr)` checks stderr after `performUpdate({ quiet: false })`. When quiet=false, perform.ts uses `stdio: "inherit"`, so stderr is not captured and always returns undefined. This block is unreachable but harmless - npm stderr is already displayed via "inherit" mode.
2. **Unused export `isUpdateAvailable()`**: Retained in check.ts but never imported. The implementation artifact acknowledges this as intentional ("valid utility function for future callers").

### Verification / Test Gaps

- Pre-existing: No unit tests exist for the update module. This was noted in the implementation plan and ticket as a pre-existing gap, not a requirement for this change.
- All 51 existing tests pass, confirming no regressions in adjacent functionality.

## Changes Made by Code Review

None. No code fixes were needed. The implementation correctly addresses all ticket requirements with clean error handling and no regressions.

## Remaining Risks / Deferred Items

1. **No update-module tests**: The update flow has no test coverage. This is a pre-existing gap acknowledged by the ticket ("no existing update tests"). The implementation was verified via typecheck, build, test suite, static analysis, and runtime --version check.
2. **`isUpdateAvailable()` dead code**: Exported but unused. Low risk - it's a correct utility that could be cleaned up in a future PR or used by future callers.
3. **CI workflows**: The auto-tag and npm-publish CI workflows are now dead weight. Explicitly out of scope per ticket.
4. **`publishConfig` in package.json**: Still references npm registry. Explicitly out of scope per ticket.

## Verification Impact Notes

No changes were made by code review, so all verification checks remain valid as-is:
- CHK-01 through CHK-09 in the verification plan are unaffected.
- No behavioral changes or assumption shifts introduced by review.

## APL Statement Reference

Code review complete. All 9 changed files reviewed against ticket requirements, product spec, and implementation plan. No issues requiring code fixes were found. The implementation correctly replaces npm-registry-based semver comparison with GitHub-main SHA-based comparison, adds migration detection for npm-sourced installs, extends --version with commit SHA, updates all user-facing documentation, and passes all quality gates (typecheck, build, 51/51 tests). followups=[].

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification with acceptance criteria and behavioral requirements | SHA-based comparison, git+https install URL, migration, fail-closed semantics, --version with SHA, 8 acceptance criteria |
| implementation/implementation-actual.md | Scope map for changed files and claimed verification results | 9 files changed across 7 steps; used as starting review scope, not as proof |
| implementation/apl.json | Implementation answers and evidence claims | Cross-referenced claimed evidence against direct code inspection |
| product/product.md | Product vision, use cases, success criteria | Confirmed fail-closed vs fail-open split, migration as inline (not separate command), single-repo scope |
| implementation-plan/implementation-plan.md | Step-by-step plan with verification checks | 7 implementation steps, 9 verification checks (CHK-01 through CHK-09) |
| diagnosis/diagnosis-statement.md | Root cause analysis with line-numbered evidence | 12 npm-referencing locations identified; validateInstall unchanged; git primitives ready to wire |
| repo-guidance.json | Repo intent classification | Confirmed helix-cli is sole target repo |
| src/update/check.ts (direct) | Verified GIT_INSTALL_SPEC definition, removed functions, retained exports | Constant correctly composed; npm functions removed; fetchRemoteSha/isUpdateAvailable retained |
| src/update/perform.ts (direct) | Verified install spec change | GIT_INSTALL_SPEC used; npm as installer tool only |
| src/update/version.ts (direct) | Verified SHA display logic and error handling | loadFullConfig reads commit; try-catch prevents throws; correct format |
| src/update/index.ts (direct) | Verified update flow rewiring and migration logic | SHA comparison correct; migration detection for npm/unknown/missing; fail-closed/open correct |
| src/index.ts (direct) | Verified CLI entry point changes | Usage text updated; --version handler separates stdout/stderr correctly |
| src/docs/cli-content.ts (direct) | Verified documentation updates | All 4 npm references updated; keyword changed |
| src/skill/show.ts (direct) | Verified error message update | Reinstall command uses git+https URL |
| src/skill/paths.ts (direct) | Verified error message update | Reinstall command uses git+https URL |
| skill-content/references/commands.md (direct) | Verified command reference update | "updates from GitHub" |
| src/lib/config.ts (direct) | Verified config type schema and persistence | InstallSource supports commit; saveConfig does read-merge-write |
| src/update/validate.ts (direct) | Verified unchanged path construction | Uses @projectxinnovation package name for path - works for git installs |

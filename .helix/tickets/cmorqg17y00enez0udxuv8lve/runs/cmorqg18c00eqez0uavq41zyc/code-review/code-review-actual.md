# Code Review Actual -- BLD-375: Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Review Scope

Reviewed all 8 files changed by the implementation agent against ticket requirements, product spec, implementation plan, tech-research decisions, and npm Trusted Publishing documentation (verified via Context7). The review covered:

- Package metadata correctness for npm Trusted Publishing OIDC
- Publish workflow structure, OIDC setup, and tarball validation logic
- Update subsystem migration from GitHub-direct to npm-based flow
- Type safety across `InstallSource` type changes
- Cross-module data flow between config, check, perform, and index
- Test file exclusion from published tarball
- CLI help text accuracy
- No regressions to existing CLI commands

## Files Reviewed

| File | Review Focus | Verdict |
|------|-------------|---------|
| `package.json` | `repository`, `publishConfig`, `files` negation patterns | Correct |
| `.npmignore` (new) | Test exclusion patterns; interaction with `files` field | Correct (no-op with npm 11, retained for documentation) |
| `src/lib/config.ts` | `InstallSource` type extension (`"npm"` mode, `version` field) | Correct |
| `src/update/check.ts` | `NPM_PACKAGE` constant, `fetchLatestVersion()`, `isNewerVersion()` | Correct |
| `src/update/perform.ts` | `NPM_PACKAGE@latest` install spec | Correct |
| `src/update/index.ts` | `runUpdate()`, `checkAutoUpdate()`, `isCanonicalSource()` rewrite | Correct |
| `src/index.ts` | Help text update (line 52) | Correct |
| `.github/workflows/publish.yml` (new) | OIDC permissions, tarball validation, fail-closed pipeline | Correct |
| `src/update/version.ts` (unchanged, read for context) | `../../package.json` relative path resolution | Not affected |
| `src/update/validate.ts` (unchanged, read for context) | Post-install validation logic | Not affected |
| `tsconfig.json` (unchanged, read for context) | Build configuration | Not affected |

## Missed Requirements & Issues Found

### Requirements Gaps

None. All 7 acceptance criteria from the ticket are satisfied:

1. `.github/workflows/publish.yml` exists with OIDC permissions -- verified.
2. `package.json` contains exact `repository` metadata -- verified (`https://github.com/Project-X-Innovation/helix-cli.git`).
3. Publish workflow fails before publish if tarball omits `dist/index.js` -- verified (`grep -q "package/dist/index.js"` with `exit 1` on failure).
4. Workflow does not require `NPM_TOKEN` -- verified (no `NPM_TOKEN` or `NODE_AUTH_TOKEN` references).
5. Release flow documented via tag-push trigger on `publish.yml` -- verified.
6. `hlx update` targets npm releases instead of GitHub main -- verified (uses `npm view` + `NPM_PACKAGE@latest`).
7. No unrelated CLI changes -- verified (only update-path and metadata changes).

### Correctness/Behavior Issues

None found.

### Regression Risks

None identified. The implementation:
- Preserves all existing CLI commands (login, token, org, tickets, inspect, comments) without modification
- Retains legacy `fetchRemoteSha()` and `isUpdateAvailable()` for backward compatibility
- `isCanonicalSource()` still accepts `mode === "github"` for users with legacy config
- `bin.hlx` -> `dist/index.js` entrypoint contract unchanged
- `version.ts` relative path resolution unchanged

### Code Quality/Robustness

No issues requiring fixes. Observations:

1. **`isNewerVersion()` pre-release handling**: If npm ever returns a pre-release version like `1.3.0-beta.1`, the function defensively returns `false` (NaN check). This is correct per the tech-research decision to defer pre-release support.
2. **`fetchLatestVersion()` regex**: The `/^\d+\.\d+\.\d+/` test anchors at start but not end, meaning it would accept `1.2.3-beta.1`. However, the `isNewerVersion()` NaN guard handles this safely. No fix needed.
3. **Recovery message hardcodes package name**: `runUpdate()` line 87 hardcodes `@projectxinnovation/helix-cli@latest` instead of using `NPM_PACKAGE` constant. Cosmetic; not worth changing since the string appears in user-facing recovery text and the constant is co-located in the same codebase.
4. **Legacy dead code**: `fetchRemoteSha()` and `isUpdateAvailable()` are retained but no longer called by the main update flow. Acceptable per implementation notes; cleanup deferred.

### Verification/Test Gaps

No gaps. The existing test suite (30 tests, 6 suites) covers `flags` and `resolve-ticket` modules. The update module has no unit tests, but this predates this ticket and the update logic is integration-oriented (subprocess calls, network I/O). The implementation was verified via runtime checks (typecheck, test suite, npm pack, CLI version/help output).

## Changes Made by Code Review

No code changes were made. The implementation is correct and complete.

## Remaining Risks / Deferred Items

| Risk | Severity | Notes |
|------|----------|-------|
| npm scope `@projectxinnovation` must exist and be org-controlled | High (blocks first publish) | Outside code scope; UI-side prerequisite |
| npm Trusted Publisher UI configuration required | High (blocks first publish) | Must link package to `Project-X-Innovation/helix-cli` repo + `publish.yml` workflow |
| Version 1.2.0 may already be claimed on npm | Medium (blocks first publish) | Version bump needed if already published |
| `npm view` returns null before first publish | Low | `fetchLatestVersion()` handles this gracefully (returns null, "no update available") |
| Legacy `fetchRemoteSha()`/`isUpdateAvailable()` dead code | Low | Cleanup deferred to future ticket |

## Verification Impact Notes

No changes were made by Code Review, so all 12 Required Check IDs (CHK-01 through CHK-12) from the Verification Plan remain valid with no additional scrutiny needed.

## APL Statement Reference

Code review complete. All 8 changed files reviewed against ticket requirements, product spec, implementation plan, and npm Trusted Publishing documentation (Context7-verified). No issues requiring code fixes were found. Quality gates pass: TypeScript typecheck clean, 30/30 tests pass, npm pack produces correct tarball (73 files, dist/index.js present, no test files). The implementation correctly implements OIDC Trusted Publishing workflow, tarball validation, npm-based update mechanism, and package metadata. One documented deviation from plan: test exclusion uses `files` field negation patterns instead of `.npmignore` alone, which is correct for npm 11. All 12 verification checks remain valid.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements and acceptance criteria | 7 acceptance criteria verified against implementation |
| `implementation/implementation-actual.md` | Scope map of changed files and deviations | 8 files changed, 1 documented deviation (files negation vs .npmignore) |
| `implementation/apl.json` | Implementation Q&A with evidence | Confirmed all 5 questions answered with evidence, all 12 checks reported passing |
| `implementation-plan/implementation-plan.md` | Blueprint with verification plan | 8 implementation steps, 12 verification checks used as cross-reference |
| `product/product.md` | Product vision and success criteria | Fail-closed principle, validate-the-artifact requirement, minimal published surface |
| `diagnosis/diagnosis-statement.md` | Root cause analysis of 4 gaps | Verified all 4 gaps (metadata, workflow, update, tarball) are closed by implementation |
| `tech-research/tech-research.md` | Architecture decisions with rationale | Verified implementation matches chosen options (tag push, npm pack+tar, npm view, numeric semver, .npmignore) |
| npm Trusted Publishing docs (Context7) | OIDC workflow requirements | Confirmed: `id-token: write` + `setup-node` with `registry-url` + no `NODE_AUTH_TOKEN` is the documented pattern |
| `src/update/version.ts` (direct read) | Cross-module context | Confirmed `../../package.json` path unaffected by changes |
| `src/update/validate.ts` (direct read) | Cross-module context | Confirmed post-install validation logic unaffected |
| `tsconfig.json` (direct read) | Build configuration context | Confirmed build compiles all src/ to dist/, no test exclusion mechanism needed in tsconfig |

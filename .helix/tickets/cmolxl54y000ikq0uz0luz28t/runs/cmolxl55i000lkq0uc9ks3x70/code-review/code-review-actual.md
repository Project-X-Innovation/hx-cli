# Code Review — FIX-347: Make hlx update Validate Installed Package And Recover From Broken Installs

## Review Scope

Three files changed in `src/update/`, all confined to the update subsystem as required by the ticket and product spec:

1. **`src/update/perform.ts`** — Refactored from `execSync` to `spawnSync` with stderr capture
2. **`src/update/validate.ts`** — New file providing `validateInstall()` function
3. **`src/update/index.ts`** — Validation gates inserted in both `runUpdate()` and `checkAutoUpdate()`

Supporting context files read (not changed): `src/update/check.ts`, `src/update/version.ts`, `src/index.ts`, `src/lib/config.ts`, `package.json`, `tsconfig.json`.

## Files Reviewed

| File | Lines | Review Focus |
|------|-------|-------------|
| `src/update/perform.ts` | 48 | spawnSync migration, stderr capture, return type compatibility, error handling |
| `src/update/validate.ts` | 79 | npm root resolution, file existence check, version execution check, cross-platform handling, error paths |
| `src/update/index.ts` | 175 | Validation gate placement, saveConfig gating, error messaging, recovery instructions, exit code handling |
| `src/update/check.ts` | 44 | Constants consumed by perform.ts — verified unchanged and consistent |
| `src/update/version.ts` | 20 | Version resolution pattern — confirmed validate.ts correctly avoids import.meta.url approach |
| `src/index.ts` | 98 | --version handler and auto-update skip logic — verified alignment with validation subprocess |
| `src/lib/config.ts` | 60 (read) | InstallSource type, saveConfig interface — verified index.ts usage is type-correct |
| `package.json` | 25 | bin contract (`dist/index.js`), package name, build scripts, no test framework |
| `tsconfig.json` | 15 | `declaration: true` — confirms partial-build failure mode described in ticket |
| `dist/update/validate.js` | 59 | Compiled output matches source logic |
| `dist/update/perform.js` | 40 | Compiled output matches source logic |

## Missed Requirements & Issues Found

### Requirements Gaps

None. All six ticket acceptance criteria are satisfied:

1. **AC1** — Valid install reports success: `saveConfig()` and success message at lines 96-105 of `index.ts` only execute after validation passes. ✅
2. **AC2** — Missing `dist/index.js` exits non-zero: `validate.ts:50-55` returns `{valid: false, error: "Bin target missing: <path>"}`, triggering `process.exit(1)` at `index.ts:92`. ✅
3. **AC3** — npm warnings visible: In manual mode (`quiet: false`), npm output streams live via `stdio: 'inherit'`. In auto mode (`quiet: true`), stderr is captured and surfaced at `index.ts:158-159`. ✅
4. **AC4** — Declaration-only dist/ rejected: `existsSync` checks for `dist/index.js` specifically — `.d.ts` files do not satisfy this check. The version execution check (`node "{path}" --version`) also fails if only declarations exist. ✅
5. **AC5** — Recovery message: Lines 87-91 of `index.ts` print clone/build/link instructions plus a retry hint. ✅
6. **AC6** — Existing behavior unchanged: Validation is purely additive; the happy path (valid install) runs the same `saveConfig()` + success message as before, with only the new validation check inserted between npm success and metadata save. ✅

### Correctness / Behavior Issues

None found. Specific verification points:

- **`performUpdate()` return type** is backward-compatible (additive `stderr?: string`). Only two consumers exist (`index.ts` lines 73 and 152), both confirmed compatible by grep and typecheck.
- **`validateInstall()` never throws** — all failure paths (npm root failure, file missing, version check failure, timeout, signal) return structured `{valid: false, ...}` results.
- **Recursion guard** (`HLX_SKIP_UPDATE_CHECK=1`) correctly set in `validate.ts:63` for the version subprocess, matching the existing pattern in `perform.ts:22`.
- **Cross-platform path construction** via `path.join()` in `validate.ts:41-47` avoids hardcoded separators.
- **Shell mode** (`shell: true`) on all `spawnSync` calls handles Windows `npm.cmd` resolution correctly.
- **Timeout guards** present on both subprocess calls in `validate.ts` (15s for npm root, 10s for version check).

### Regression Risks

None identified. Analysis:

- `performUpdate` is only imported/consumed by `src/update/index.ts` — no other modules depend on it.
- `validateInstall` is new code with no existing dependents.
- No changes to files outside `src/update/`.
- No changes to `package.json`, `tsconfig.json`, or any shared utilities.
- The `InstallSource` type in `src/lib/config.ts` is unchanged; `saveConfig()` calls in `index.ts` match the existing type signature.

### Code Quality / Robustness

No material issues. Minor observations (not actionable):

- In `runUpdate()`, `result.stderr` (line 84) is always `undefined` because `quiet: false` → `stdio: 'inherit'` → stderr is not captured. The `if (result.stderr)` branch is dead code in the manual path. This is by design (documented in tech-research.md) and forward-compatible — it harms nothing and would activate if `quiet` behavior changes later.
- Hardcoded package name `@projectxinnovation/helix-cli` in `validate.ts:42-44` matches `package.json` name and is consistent with `CANONICAL_REPO` usage elsewhere. Acceptable coupling.

### Verification / Test Gaps

- No automated tests exist. The repository has no test framework (`package.json` has no test script or test dependencies). This is explicitly out of scope per the product spec.
- Validation correctness was verified by the implementation agent via direct function invocation and simulated broken installs, which is appropriate given the constraint.

## Changes Made by Code Review

No code changes made. The implementation is correct and complete as written.

## Remaining Risks / Deferred Items

| Risk | Likelihood | Impact | Notes |
|------|-----------|--------|-------|
| `npm root -g` returns unexpected path on exotic Node version managers (nvm, volta, etc.) | Low | False negative — valid install incorrectly rejected | Graceful error message; user can re-run `hlx update` to retry |
| No automated test coverage for validation logic | Medium | Future regressions may go undetected | Test framework introduction is explicitly deferred per product spec |
| Hardcoded package name in validate.ts | Very Low | Would break if package is renamed | Matches existing hardcoded values; rename would require broader changes |

## Verification Impact Notes

No changes were made by code review. All verification checks from the implementation plan remain valid:

| Check ID | Status | Notes |
|----------|--------|-------|
| CHK-01 | Still valid | Typecheck passes — confirmed by code review |
| CHK-02 | Still valid | Build succeeds — confirmed by code review |
| CHK-03 | Still valid | validateInstall exports correctly — confirmed by code review (dist/update/validate.js inspected) |
| CHK-04 | Still valid | Missing bin target detection — logic verified by code reading |
| CHK-05 | Still valid | Valid install detection — logic verified by code reading |

## APL Statement Reference

Code review complete. Three changed files reviewed: `src/update/perform.ts` (spawnSync refactor with stderr capture), `src/update/validate.ts` (new post-install validation), `src/update/index.ts` (validation gates in both update paths). All six ticket acceptance criteria are satisfied. No correctness issues, regression risks, or requirement gaps found. Quality gates pass (typecheck, build). No code changes made by review.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary requirements and acceptance criteria | Six acceptance criteria defining success; fail-closed requirement; recovery messaging; non-zero exit on failure |
| implementation/implementation-actual.md | Scope map for review — files changed and verification results | Three files changed in src/update/; five verification checks all passed; one deviation (command strings vs args arrays) |
| implementation/apl.json | Implementation agent's self-assessment | All four steps completed; deviation documented; no unresolved followups |
| implementation-plan/implementation-plan.md | Expected implementation structure and verification plan | Four sequential steps; five required checks (CHK-01 through CHK-05); success metrics |
| product/product.md | Product specification with use cases and scope | Four use cases; fail-closed principle; no test framework introduction; metadata save gating |
| diagnosis/diagnosis-statement.md | Root cause analysis | npm exit 0 equated with valid install; metadata poisoning; stderr lost on success path |
| tech-research/tech-research.md | Technical decisions and API design | spawnSync over execSync; npm root -g; node {path} --version; mode-dependent stderr capture |
| src/update/perform.ts | Changed file — full review | spawnSync migration correct; error handling covers spawn failures and non-zero exits; stderr capture mode-dependent |
| src/update/validate.ts | Changed file — full review | Two-step validation (file + version); cross-platform path.join; never throws; timeouts on both subprocesses |
| src/update/index.ts | Changed file — full review | Validation gates correctly placed; saveConfig gated on validation; manual exits non-zero; auto warns and continues |
| src/update/check.ts | Context — constants consumed by changed files | CANONICAL_REPO, CANONICAL_BRANCH constants unchanged; install spec pattern verified |
| src/update/version.ts | Context — version resolution pattern | Confirms import.meta.url resolves to running CLI, not installed copy; validates npm root -g approach in validate.ts |
| src/index.ts | Context — CLI entrypoint and --version handler | --version skips auto-update; getPackageVersion reads package.json; top-level ESM imports provide comprehensive startup validation |
| src/lib/config.ts | Context — saveConfig and InstallSource types | InstallSource type matches index.ts usage; saveConfig interface unchanged |
| package.json | Context — bin contract and build config | bin: dist/index.js; name: @projectxinnovation/helix-cli; prepare: npm run build; no test framework |
| tsconfig.json | Context — TypeScript config | declaration: true confirms partial-build failure mode |

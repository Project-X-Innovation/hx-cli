# Code Review — BLD-527: Replace hlx self-update with GitHub release assets

## Review Scope

Reviewed the complete implementation of BLD-527, which replaces the `hlx update` and auto-update mechanism from `npm install -g git+https://...#main` to a staged download-validate-swap mechanism using prebuilt GitHub Release assets. The review covers:

- 1 new CI workflow (`build-release.yml`)
- 1 deleted workflow (`auto-tag.yml`)
- 4 rewritten source files in `src/update/` (check.ts, validate.ts, perform.ts, index.ts)
- 3 updated documentation/error-message files (cli-content.ts, show.ts, paths.ts)
- 1 preserved workflow (`publish.yml` — verified unchanged)
- Supporting context: `src/index.ts`, `src/update/version.ts`, `src/lib/config.ts`, `package.json`, `tsconfig.json`, `skill-content/references/commands.md`

## Files Reviewed

| File | Verdict | Notes |
|------|---------|-------|
| `.github/workflows/build-release.yml` | Clean | Correct trigger (push to main), `contents: write`, concurrency group, tarball creation, rolling `latest` tag (does not match `v*`), `GITHUB_TOKEN` via `github.token` |
| `.github/workflows/auto-tag.yml` | Deleted | Confirmed absent from `.github/workflows/` |
| `.github/workflows/publish.yml` | Unchanged | Verified: triggers on `v*` tags, OIDC trusted publishing, `npm publish *.tgz --provenance` — identical to original |
| `src/update/check.ts` | Clean | GitHub REST API fetch, auth token discovery chain (GITHUB_TOKEN -> GH_TOKEN -> gh auth token -> null), SHA regex validation, correct asset URL handling |
| `src/update/validate.ts` | Clean | Validates staged directory: entrypoint existence, package.json existence, `--version` subprocess with HLX_SKIP_UPDATE_CHECK=1 |
| `src/update/perform.ts` | Clean | Staged download -> extract -> validate -> rename-based swap with `.bak` backup dirs. EXDEV cross-filesystem fallback. Windows retry via `Atomics.wait`. Rollback on swap failure. Cleanup in `finally` block. |
| `src/update/index.ts` | Clean | Correct fail-closed (runUpdate: process.exit(1)) and fail-open (checkAutoUpdate: warn-and-return) behavior. Explicit GitHub auth guidance on 401/403. Config persistence with installSource metadata. |
| `src/docs/cli-content.ts` | **Fixed** | Installation instruction `npm install -g ./` would fail because extracted tarball has no `src/` directory but `prepare` script runs `tsc` which requires it. Fixed: added `--ignore-scripts` flag. |
| `src/skill/show.ts` | Clean | Recovery message points to `hlx update` and GitHub release URL |
| `src/skill/paths.ts` | Clean | Recovery message points to `hlx update` and GitHub release URL |
| `src/update/version.ts` | Not changed (verified) | Already uses `import.meta.url` for package root, reads commit SHA from config |
| `src/lib/config.ts` | Not changed (verified) | `InstallSource` type already supports `mode: 'github'`, `repo`, `branch`, `commit` |
| `src/index.ts` | Not changed (verified) | Auto-update call and `--version` handler work correctly with new update module |
| `package.json` | Not changed (verified) | Zero production deps, `prepare` -> `tsc`, bin entry correct |
| `tsconfig.json` | Not changed (verified) | `rootDir: "src"`, `include: ["src"]` — confirms the `npm install -g ./` bug |
| `skill-content/references/commands.md` | Not changed (verified) | Already says "Check for and apply CLI updates from GitHub" — correct |

## Missed Requirements & Issues Found

### Correctness/Behavior Issues

1. **Installation instruction would fail (Fixed)** — `src/docs/cli-content.ts` line 19 instructed users to run `npm install -g ./` from the extracted tarball directory. The CI tarball only contains `dist/`, `skill-content/`, `package.json`, and `build-metadata.json` — it does NOT contain `src/`. The `prepare` script in `package.json` runs `npm run build` -> `tsc`, and `tsconfig.json` has `"rootDir": "src"` and `"include": ["src"]`. Running `npm install -g ./` from the extracted tarball would trigger `tsc`, which would fail because there are no TypeScript source files to compile. Fixed by adding `--ignore-scripts` flag and a clarifying note.

### Requirements Gaps

None. All ticket acceptance criteria are satisfied:
- AC-1: `build-release.yml` creates prebuilt GitHub Release asset without `v*` tag
- AC-2: `auto-tag.yml` deleted
- AC-3: `publish.yml` preserved unchanged for manual tag-driven npm releases
- AC-4: `hlx update` uses prebuilt artifact, no `tsc` required (after documentation fix)
- AC-5: Failed update preserves current install (backup/rollback mechanism)
- AC-6: Auto-update uses same staged mechanism, fail-open behavior preserved
- AC-7: Auth failures produce explicit GitHub auth guidance (GITHUB_TOKEN, GH_TOKEN, gh auth login)
- AC-8: No `npm install -g git+https://...#main` or `npm install -g @projectxinnovation/helix-cli@latest` references remain as the primary install/update path
- AC-9: `hlx --version` includes commit SHA (read from config after successful update)
- AC-10: Staged validation prevents bricked CLI — live install is immutable until candidate passes

### Regression Risks

None identified. The changes are confined to the update module and CI workflows. Existing tests (flag parsing, ticket resolution, skill operations) all pass. `publish.yml` is byte-for-byte identical to the original.

### Code Quality/Robustness

No material issues. Minor observations (not requiring fixes):
- `version.ts` does not read `build-metadata.json` as a fallback for commit SHA display. This is acceptable because: (1) config is saved with commit SHA after successful `hlx update`, (2) the `--version` handler in `src/index.ts` already hints users to run `hlx update` when the SHA is absent.
- No unit tests exist for the update module. This is explicitly called out as a known limitation and out of scope for this ticket.

### Verification/Test Gaps

None beyond the known limitation of no update-module unit tests.

## Changes Made by Code Review

| File | Line | Description |
|------|------|-------------|
| `src/docs/cli-content.ts` | 19 | Changed `npm install -g ./` to `npm install -g ./ --ignore-scripts` — the extracted tarball does not contain `src/` so `tsc` (triggered by the `prepare` script) would fail without this flag |
| `src/docs/cli-content.ts` | 20-21 | Added clarifying note: "The `--ignore-scripts` flag is required because the tarball ships prebuilt -- no build step is needed." |

## Remaining Risks / Deferred Items

1. **End-to-end update test requires CI run**: The full update flow cannot be tested until `build-release.yml` runs on GitHub and creates the initial `latest` release. This is inherent to the design and documented in the implementation.
2. **No update module unit tests**: The `src/update/` module has zero test files. This was identified as a gap but is out of scope for this ticket.
3. **GitHub API rate limits**: Unauthenticated requests are limited to 60/hr. Auto-update checks are infrequent, so this is low-risk. Auth token usage raises the limit to 5000/hr.
4. **`build-metadata.json` not used by `version.ts`**: The file is embedded in the tarball and copied to the install root, but `version.ts` only reads the commit SHA from config. This means a fresh tarball install (without running `hlx update`) won't display the SHA. The `--version` handler already mitigates this by printing a hint.

## Verification Impact Notes

No verification checks are affected by the code review change. The fix is in documentation content only and does not change any behavioral logic or function signatures. All 12 verification checks (CHK-01 through CHK-12) remain valid as defined.

## APL Statement Reference

Code review complete. One correctness issue found and fixed: the installation instruction `npm install -g ./` in `cli-content.ts` would fail when run from the extracted CI tarball because the tarball lacks `src/` and the `prepare` script runs `tsc`. Fixed by adding `--ignore-scripts` flag. All other implementation changes are correct: staged download-validate-swap mechanism, fail-open/fail-closed behavior, auth error messaging, backup/rollback, workflow changes, and documentation updates. Quality gates pass after fix: typecheck clean, 51/51 tests pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements and acceptance criteria | 10 acceptance criteria, non-negotiable invariants (never brick CLI, fail-open/fail-closed), workflow changes |
| `implementation/implementation-actual.md` | Scope map for review — file list and claimed outcomes | 8 changed files, 12 verification checks claimed passing |
| `implementation/apl.json` | Implementation structured evidence | Cross-referenced with code to verify claims |
| `implementation-plan/implementation-plan.md` | Step-by-step plan with verification checks | Compared actual changes against planned changes; found documentation divergence (plan said "add to PATH", implementation used `npm install -g ./`) |
| `product/product.md` | Product vision and success criteria | Confirmed fail-open/closed split, never-brick principle, "no user-side build tools" requirement |
| `tech-research/tech-research.md` | Architecture decisions | Confirmed GitHub Releases + rolling `latest` tag, rename-based swap, system tar, build-metadata.json |
| `diagnosis/diagnosis-statement.md` | Root cause analysis | 4 root causes confirmed addressed: source-based install, destructive npm install -g, auto-tag chains, no prebuilt artifact |
| `scout/scout-summary.md` | Codebase architecture overview | Confirmed 5-file update module structure, 6 npm-install references, zero tests |
| `tsconfig.json` | TypeScript build configuration | `rootDir: "src"`, `include: ["src"]` — proved the `npm install -g ./` bug |
| `package.json` | Project configuration | `prepare: "npm run build"` → `tsc` — confirmed the install instruction would trigger a build |
| `src/index.ts` | CLI entry point | Verified auto-update integration, `--version` handler with SHA hint |
| `.github/workflows/publish.yml` | npm publish workflow | Verified unchanged — triggers on `v*` tags, OIDC trusted publishing |

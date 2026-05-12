# Code Review — BLD-429: Bundle hlx-cli agent skill in the CLI

## Review Scope

Reviewed all 10 changed files (7 new, 3 modified) introduced by the implementation for BLD-429. Cross-referenced against ticket requirements, product spec, implementation plan, and established codebase patterns. Verified quality gates (typecheck, tests) and ran end-to-end behavioral validation of all key safety invariants.

## Files Reviewed

| File | Type | Review Focus |
|------|------|-------------|
| `skill-content/SKILL.md` | New | Content accuracy against CLI command surface |
| `skill-content/references/commands.md` | New | Content accuracy, per-command flag correctness |
| `src/skill/paths.ts` | New | Path resolution correctness, corrupt-install detection |
| `src/skill/show.ts` | New | Clean stdout output, no interleaved noise |
| `src/skill/install.ts` | New | Three-tier target resolution, no-overwrite safety, atomic rollback |
| `src/skill/index.ts` | New | Router pattern correctness, corrupt-install gate |
| `src/skill/skill.test.ts` | New | Test coverage of safety invariants, test hygiene |
| `src/index.ts` | Modified | Command routing, SKIP_AUTO_UPDATE, usage text |
| `package.json` | Modified | `files[]` tarball inclusion |
| `.github/workflows/publish.yml` | Modified | CI tarball validation check |

### Cross-Referenced Context Files

| File | Purpose |
|------|---------|
| `src/lib/flags.ts` | Verified flag parsing API (`getFlag`, `hasFlag`, `isHelpRequested`) used correctly |
| `src/inspect/index.ts` | Verified subcommand router pattern is followed faithfully |
| `src/update/version.ts` | Verified `import.meta.url` path resolution pattern matches |
| `.npmignore` | Verified no conflict with `skill-content/` inclusion |

## Missed Requirements & Issues Found

**No issues found.** The implementation correctly addresses all 8 ticket acceptance criteria and all non-negotiable invariants.

### Requirements Gaps

None. All ticket requirements are met:

1. **AC-1** (tarball contains skill files): `package.json` `files[]` includes `"skill-content"`. Verified via `npm pack --dry-run` — lists `skill-content/SKILL.md` (4.7kB) and `skill-content/references/commands.md` (3.9kB).
2. **AC-2** (`hlx skill show` prints content): Verified — exits 0, stdout contains YAML frontmatter (`---\nname: hlx-cli`) and full SKILL.md content. No banners, no noise.
3. **AC-3** (auto-detect single agent dir): Code logic in `install.ts` lines 115-117 correctly handles the single-directory case. Byte-for-byte match confirmed via runtime comparison.
4. **AC-4** (both dirs present exits non-zero with `--for`): Code logic in `install.ts` lines 107-113 correctly exits with error containing `--for`.
5. **AC-5** (no-overwrite without `--force`): Code logic in `install.ts` lines 33-39 correctly refuses and exits 1 with `--force` mentioned. Verified at runtime.
6. **AC-6** (`--target <path>` writes to `<path>/hlx-cli/`): Code logic in `install.ts` lines 83-84 correctly joins target with `SKILL_DIR_NAME`. Verified at runtime.
7. **AC-7** (corrupt detection with reinstall message): `paths.ts` lines 21-28 correctly detect missing `skill-content/` and emit reinstall instruction. Verified at runtime — error contains `npm install -g @projectxinnovation/helix-cli@latest`.
8. **AC-8** (atomic rollback on copy failure): `install.ts` lines 62-70 catch copy errors and remove partial destination. Test `"does not leave a partial directory on copy failure"` verifies this.

### Correctness/Behavior Issues

None.

### Regression Risks

None. This is a new feature with no modifications to existing behavior:
- Existing commands are unaffected (only `case "skill"` added to switch).
- `SKIP_AUTO_UPDATE` set gains `"skill"` which only affects the new command.
- No changes to `flags.ts`, `config.ts`, or any shared utilities.
- No runtime dependencies added.
- All 22 existing tests continue to pass alongside 20 new tests.

### Code Quality/Robustness

No issues requiring fixes. Minor observations for awareness:

1. **`readdirSync` flat-copy only** (`install.ts:58`): The `references/` copy only handles flat files. If a subdirectory is added to `references/` in the future, `copyFileSync` would throw `EISDIR`, caught by the try-catch rollback. Acceptable today since `references/` only contains `commands.md`.

2. **Force mode + copy failure**: In `--force` mode, the old directory is removed (line 43) before the copy attempt. If the copy fails, both old and new content are lost. The ticket requires "no half-populated state" which is satisfied. A transactional backup-and-restore approach would be more resilient but adds complexity without ticket justification.

### Verification/Test Gaps

None requiring action. Minor observation:

- The auto-detection test (`skill.test.ts:194-231`) uses a loose assertion (`--target` OR `--for`) that covers both "neither exists" and "both exist" scenarios depending on the CI environment. This is pragmatic for CI but slightly less precise than isolated mocking of each scenario. The behavior is separately verified by code inspection and manual testing.

## Changes Made by Code Review

None. No code fixes were needed. The implementation is clean and correct.

## Remaining Risks / Deferred Items

| # | Risk | Severity | Notes |
|---|------|----------|-------|
| 1 | `readdirSync` in install.ts doesn't recurse subdirectories in `references/` | Low | Only relevant if future skill content adds nested dirs. The try-catch rollback preserves the atomic install invariant even if `copyFileSync` throws on a directory. |
| 2 | Force mode copy failure results in no installation (old removed, new failed) | Low | Ticket only requires "no half-populated state." A backup-and-restore approach is possible but not required. |
| 3 | Auto-detection test relies on CI environment state | Low | Test passes in current CI. The "both exist" branch is verified by code inspection and the `--for` validation test covers the error path. |

## Verification Impact Notes

No changes were made by Code Review. All 9 verification checks (CHK-01 through CHK-09) remain valid and unaffected.

## APL Statement Reference

Code review complete. All 10 changed files reviewed against ticket requirements and codebase patterns. Zero issues requiring fixes. All 8 acceptance criteria verified via code inspection and runtime validation. Quality gates pass: TypeScript typecheck 0 errors, 42 tests pass (22 existing + 20 new). No code changes made by review.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification for acceptance criteria cross-check | 8 acceptance criteria, non-negotiable invariants (no-overwrite, atomic, corrupt detection), failure behavior requirements |
| `implementation/implementation-actual.md` | Scope map for files changed | 7 new files, 3 modified files, 10 implementation steps, 9 verification checks reported as passing |
| `implementation/apl.json` | Implementation agent's Q&A and evidence claims | All 10 steps claimed complete with evidence — verified independently |
| `implementation-plan/implementation-plan.md` | Design intent and code patterns to follow | Established patterns: `inspect/index.ts` router, `version.ts` path resolution, `flags.ts` utilities, `node:test` conventions |
| `product/product.md` | Product requirements and success criteria | 8 success criteria table, auto-detection logic definition, design principles (zero deps, safety by default) |
| `repo-guidance.json` | Repo scope confirmation | Single-repo ticket — helix-cli only, no cross-repo impact |
| `src/lib/flags.ts` (direct read) | Verified flag parsing API used correctly in install.ts | `getFlag`, `hasFlag`, `isHelpRequested` signatures match usage |
| `src/inspect/index.ts` (direct read) | Verified router pattern followed by skill/index.ts | `usage()` + switch + `isHelpRequested()` per subcommand — pattern matched |
| `src/update/version.ts` (direct read) | Verified path resolution pattern followed by skill/paths.ts | `dirname(fileURLToPath(import.meta.url))` + `join(thisDir, "..", "..")` — pattern matched |
| `.npmignore` (direct read) | Verified no conflict with skill-content inclusion | Only excludes `dist/**/*.test.js` and `dist/**/*.test.d.ts` — no interference |

# Implementation Actual — BLD-429: Bundle hlx-cli agent skill in the CLI

## Summary of Changes

Added a canonical `hlx-cli` agent skill (SKILL.md + references/) as bundled static files in the `@projectxinnovation/helix-cli` npm package, exposed via a new `hlx skill` top-level command with `show` and `install` subcommands. Zero new runtime dependencies. All 8 ticket acceptance criteria met.

## Files Changed

### New Files (7)

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `skill-content/SKILL.md` | Canonical skill content — operational guidance for AI agents using hlx CLI. YAML frontmatter with name/description, guardrails, environment setup, command reference, workflows, flag conventions. | Content accuracy — describes the full CLI command surface |
| `skill-content/references/commands.md` | Detailed per-command reference with flags, usage patterns, and tips. | Content accuracy — must match actual CLI behavior |
| `src/skill/paths.ts` | Shared utility: resolves bundled `skill-content/` directory at runtime via `import.meta.url`. Validates existence and exits with reinstall instruction on corrupt install. | **Cross-module dependency** — used by index.ts, show.ts, install.ts |
| `src/skill/show.ts` | `hlx skill show` handler — reads SKILL.md with `readFileSync`, writes to `process.stdout.write`. No banners or log noise. | Clean stdout output for piping |
| `src/skill/install.ts` | `hlx skill install` handler — three-tier target resolution (--target > --for > auto-detect), no-overwrite safety, --force mode, atomic install with rollback. | **Safety-critical**: no-overwrite check, atomic rollback, auto-detection logic. Uses `homedir()` for `~/.claude/skills/` and `~/.codex/skills/` |
| `src/skill/index.ts` | Skill command router — dispatches to show/install, calls `getSkillContentDir()` before any subcommand (corrupt-install gate). | **Public interface** — exported `runSkill()` called from CLI entry point |
| `src/skill/skill.test.ts` | 20 unit tests covering path resolution, show output, install to target, byte-for-byte match, no-overwrite safety, --force overwrite, auto-detection failure, --for validation, atomic rollback. | Test coverage for all safety invariants |

### Modified Files (3)

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/index.ts` | Added `import { runSkill }`, `"skill"` to `SKIP_AUTO_UPDATE` set, usage text lines for `hlx skill show` and `hlx skill install`, and `case "skill"` in the switch. | **CLI entry point** — affects global command routing |
| `package.json` | Added `"skill-content"` to `files[]` array to include bundled skill in npm tarball. | **Publish config** — affects what ships to npm |
| `.github/workflows/publish.yml` | Added `grep -q "package/skill-content/SKILL.md"` tarball validation check before publish. | **CI pipeline** — prevents publishing without skill content |

## Steps Executed

| Plan Step | Description | Status |
|-----------|-------------|--------|
| 1 | Author canonical skill content (SKILL.md + references/commands.md) | Done |
| 2 | Bundle skill content in npm tarball (package.json files[]) | Done |
| 3 | Implement path resolution utility (src/skill/paths.ts) | Done |
| 4 | Implement `hlx skill show` handler (src/skill/show.ts) | Done |
| 5 | Implement `hlx skill install` handler (src/skill/install.ts) | Done |
| 6 | Implement skill command router (src/skill/index.ts) | Done |
| 7 | Wire skill command into CLI entry point (src/index.ts) | Done |
| 8 | Add CI tarball validation (.github/workflows/publish.yml) | Done |
| 9 | Write unit tests (src/skill/skill.test.ts) | Done |
| 10 | Run quality gates and end-to-end verification | Done |

## Verification Commands Run + Outcomes

| Command | Purpose | Exit Code | Result |
|---------|---------|-----------|--------|
| `npx tsc --noEmit` | TypeScript typecheck | 0 | No errors |
| `npm test` | Build + run all tests | 0 | 42 pass, 0 fail |
| `node dist/index.js skill show` | Print bundled skill content | 0 | Prints SKILL.md with YAML frontmatter |
| `node dist/index.js skill --help` | Skill usage screen | 0 | Shows show, install, --target, --for, --force |
| `node dist/index.js --help` | Global help includes skill | 0 | Includes `hlx skill show` and `hlx skill install` |
| `node dist/index.js skill install --target /tmp/hlx-skill-verify-test` | Install to target | 0 | Creates hlx-cli/ with SKILL.md and references/commands.md |
| Byte-for-byte comparison | Installed matches bundled | 0 | SKILL.md is identical |
| `node dist/index.js skill install --target /tmp/hlx-skill-verify-test` (repeat) | No-overwrite check | 1 | Error mentions --force |
| `node dist/index.js skill install --target /tmp/hlx-skill-verify-test --force` | Force overwrite | 0 | Files reinstalled |
| `mv skill-content skill-content-bak && node dist/index.js skill show` | Corrupt detection | 1 | Error contains `npm install -g @projectxinnovation/helix-cli@latest` |
| `npm pack --dry-run` | Tarball includes skill files | 0 | Lists skill-content/SKILL.md and skill-content/references/commands.md |

## Test/Build Results

- **TypeScript**: `npx tsc --noEmit` exits 0, zero errors.
- **Build**: `npm run build` (tsc) exits 0.
- **Tests**: `npm test` — 42 tests pass, 0 fail, 0 skipped. Includes 22 existing tests (flags, matchTicket, extractTicketRef) and 20 new skill tests (SKILL_DIR_NAME, getSkillContentDir, cmdShow, cmdInstall with 6 sub-groups).
- **No new runtime dependencies**: `package.json` devDependencies unchanged, no runtime dependencies added.

## Deviations from Plan

None. All 10 steps implemented as specified.

## Known Limitations / Follow-ups

- Auto-detection test for "both skills dirs exist" scenario relies on the test environment not having both `~/.claude/skills/` and `~/.codex/skills/`. The test covers "neither exists" (the more common CI case). Both-exist behavior is verified by the no-overwrite/force tests and by code inspection.
- The `--for` flag creates the intermediate `skills/` directory if it doesn't exist (`mkdirSync recursive`). This is by design so users don't need to pre-create the agent directory.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | **pass** | `npx tsc --noEmit` exits 0 with no output |
| CHK-02 | **pass** | `npm test` exits 0; 42 tests pass, 0 fail |
| CHK-03 | **pass** | `node dist/index.js skill show` exits 0; stdout starts with `---\nname: hlx-cli` YAML frontmatter |
| CHK-04 | **pass** | `node dist/index.js skill --help` exits 0; output lists `hlx skill show`, `hlx skill install`, `--target`, `--for`, `--force` |
| CHK-05 | **pass** | `node dist/index.js skill install --target /tmp/hlx-skill-verify-test` exits 0; `ls -R` shows SKILL.md + references/commands.md; byte-for-byte comparison confirms match |
| CHK-06 | **pass** | Repeat install without --force exits 1; stderr contains `--force`; destination files unchanged |
| CHK-07 | **pass** | `node dist/index.js skill install --target /tmp/hlx-skill-verify-test --force` exits 0; files present after overwrite |
| CHK-08 | **pass** | `mv skill-content skill-content-bak && node dist/index.js skill show` exits 1; stderr contains `npm install -g @projectxinnovation/helix-cli@latest` |
| CHK-09 | **pass** | `npm pack --dry-run` output lists `skill-content/SKILL.md` (4.7kB) and `skill-content/references/commands.md` (3.9kB) |

All 9 required checks pass.

## APL Statement Reference

Implementation complete. All 10 plan steps executed: 7 new files created, 3 files modified. All 9 verification checks pass. 42 total tests pass (22 existing + 20 new). Zero runtime dependencies added. All 8 ticket acceptance criteria met.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification | Detailed behavioral requirements, 8 acceptance criteria, safety invariants, failure behavior |
| `implementation-plan/implementation-plan.md` | Step-by-step implementation guide | 10 sequenced steps, file-by-file instructions, code patterns to follow, verification plan with 9 checks |
| `implementation-plan/apl.json` | Plan rationale and Q&A | Bottom-up dependency order, content authoring guidance, verification-to-AC mapping |
| `diagnosis/diagnosis-statement.md` | Root cause and approach | Confirmed new feature scope, top-level skill-content/ strategy, files to create/modify |
| `scout/scout-summary.md` | Codebase structure | tsc cannot copy .md files, command routing pattern, no existing skill content, zero runtime deps constraint |
| `src/index.ts` (direct read) | CLI entry point patterns | Switch dispatch, SKIP_AUTO_UPDATE set, usage() function format |
| `src/inspect/index.ts` (direct read) | Subcommand router template | Usage function + switch + isHelpRequested() pattern |
| `src/update/version.ts` (direct read) | Runtime path resolution pattern | import.meta.url + dirname + join navigating to package root |
| `src/lib/flags.ts` (direct read) | Flag parsing API | getFlag, hasFlag, isHelpRequested — all used in new skill code |
| `src/lib/flags.test.ts` (direct read) | Test conventions | node:test + node:assert, describe/it blocks — template for skill tests |
| `src/token/index.ts` (direct read) | No-auth command pattern | Dispatched without config, takes only args |
| `src/lib/config.ts` (direct read) | homedir() pattern | homedir() usage for ~/.hlx/ config dir — same for skill install targets |
| `package.json` (direct read) | Build config and files[] | Confirmed files[] needs skill-content added, ESM package, test script |
| `tsconfig.json` (direct read) | Build constraints | rootDir=src, outDir=dist — confirmed tsc won't copy .md files |
| `.npmignore` (direct read) | Tarball exclusions | Only excludes test files — no conflict with skill-content/ |
| `.github/workflows/publish.yml` (direct read) | CI validation | Existing grep checks on lines 50-51 — added skill-content check |

# Implementation Plan — BLD-429: Bundle hlx-cli agent skill in the CLI

## Overview

Add a canonical `hlx-cli` agent skill (SKILL.md + references/) as bundled static files in the published `@projectxinnovation/helix-cli` npm package, and expose them via a new `hlx skill` top-level command with `show` (print to stdout) and `install` (copy to agent skills directory) subcommands.

This is a new feature — no existing behavior is modified. The scope is:
- Author skill content (`skill-content/SKILL.md` + `skill-content/references/*.md`)
- Bundle via `package.json` `files[]` (no build pipeline changes)
- New `src/skill/` command module (4 source files + 1 test file)
- Wire into CLI entry point (`src/index.ts`) and CI validation (`.github/workflows/publish.yml`)

## Implementation Principles

1. **Follow established patterns**: Use `src/inspect/index.ts` as the subcommand router template, `src/token/index.ts` for no-auth dispatch, `src/update/version.ts` for runtime path resolution, and `src/lib/flags.ts` for all flag parsing.
2. **Zero runtime dependencies**: Use only Node.js built-in modules (`node:fs`, `node:path`, `node:os`, `node:url`).
3. **Synchronous FS operations**: Small file set (few markdown files); sync APIs simplify atomicity with try-catch rollback.
4. **Static bundling without build changes**: Top-level `skill-content/` directory added to `files[]` — no build script modifications needed.
5. **Safety by default**: No-overwrite without `--force`, atomic install with cleanup, corrupt-install detection before every subcommand.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Author canonical skill content | `skill-content/SKILL.md`, `skill-content/references/*.md` |
| 2 | Bundle skill content in npm tarball | Updated `package.json` `files[]` |
| 3 | Implement path resolution utility | `src/skill/paths.ts` |
| 4 | Implement `hlx skill show` handler | `src/skill/show.ts` |
| 5 | Implement `hlx skill install` handler | `src/skill/install.ts` |
| 6 | Implement skill command router | `src/skill/index.ts` |
| 7 | Wire skill command into CLI entry point | Updated `src/index.ts` |
| 8 | Add CI tarball validation for skill content | Updated `.github/workflows/publish.yml` |
| 9 | Write unit tests | `src/skill/skill.test.ts` |
| 10 | Run quality gates and end-to-end verification | Build, typecheck, test all pass; manual CLI verification |

## Detailed Implementation Steps

### Step 1: Author Canonical Skill Content

**Goal**: Create the bundled skill content files that provide operational guidance for AI agents using the `hlx` CLI.

**What to Build**:
- Create directory `skill-content/` at the package root.
- Create `skill-content/SKILL.md` — the primary operational guidance document for the hlx-cli skill. Must include:
  - YAML frontmatter with `name` and `description` fields (matching the format in workspace `.claude/skills/runtime-inspection/SKILL.md`).
  - Guardrails section (what agents must/must-not do with hlx).
  - Environment setup section (how `hlx` is configured).
  - Available commands overview (login, token, org, tickets, inspect, comments, update, skill).
  - Common workflows (authentication, ticket management, inspection, skill installation).
  - Flag conventions.
- Create `skill-content/references/` directory with at least one reference file covering detailed per-command usage. The content should be derived from the existing CLI command surface visible in `src/index.ts` usage text (lines 33-58) and the command modules.

**Verification (AI Agent Runs)**:
- `test -f skill-content/SKILL.md && echo "SKILL.md exists"` — file exists
- `head -5 skill-content/SKILL.md` — contains YAML frontmatter with `---`
- `test -d skill-content/references && echo "references/ exists"` — directory exists
- `ls skill-content/references/*.md` — at least one reference file

**Success Criteria**:
- `skill-content/SKILL.md` is a non-empty markdown file with YAML frontmatter.
- `skill-content/references/` contains at least one `.md` reference file.
- Content covers the hlx CLI command surface accurately.

---

### Step 2: Bundle Skill Content in npm Tarball

**Goal**: Ensure the `skill-content/` directory is included in the published npm tarball.

**What to Build**:
- In `package.json`, add `"skill-content"` to the `files[]` array. Current value (lines 18-22):
  ```json
  "files": [
    "dist",
    "!dist/**/*.test.js",
    "!dist/**/*.test.d.ts"
  ]
  ```
  Updated:
  ```json
  "files": [
    "dist",
    "!dist/**/*.test.js",
    "!dist/**/*.test.d.ts",
    "skill-content"
  ]
  ```
- Verify `.npmignore` (currently only excludes test files) does not interfere with `skill-content/`.

**Verification (AI Agent Runs)**:
- `node -e "const p=require('./package.json'); console.log(p.files)"` — output includes `skill-content`
- `npm pack --dry-run 2>&1 | grep skill-content` — skill-content files appear in dry-run output

**Success Criteria**:
- `package.json` `files[]` includes `"skill-content"`.
- `npm pack --dry-run` lists skill-content files in the tarball.

---

### Step 3: Implement Path Resolution Utility

**Goal**: Create a shared utility that resolves the absolute path to the bundled `skill-content/` directory at runtime.

**What to Build**:
- Create `src/skill/paths.ts` with a single exported function:
  ```
  getSkillContentDir(): string
  ```
- Uses `dirname(fileURLToPath(import.meta.url))` following the pattern from `src/update/version.ts` (lines 10-14).
- From `dist/skill/paths.js` at runtime, navigates `../../skill-content/` to reach the package root's skill content directory.
- Validates the directory exists with `existsSync()`.
- If the directory is missing, calls `process.stderr.write()` with a message containing the reinstall instruction `npm install -g @projectxinnovation/helix-cli@latest`, then calls `process.exit(1)`.
- Also export a constant `SKILL_DIR_NAME = "hlx-cli"` for the install target subdirectory name.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — no type errors
- `test -f src/skill/paths.ts && echo "paths.ts exists"` — file created

**Success Criteria**:
- `src/skill/paths.ts` compiles without errors.
- Uses `import.meta.url` + `dirname` + `join` path resolution pattern.
- Validates `existsSync()` and exits with reinstall instruction on missing directory.

---

### Step 4: Implement `hlx skill show` Handler

**Goal**: Print the bundled SKILL.md content to stdout with no interleaved noise.

**What to Build**:
- Create `src/skill/show.ts` with exported function:
  ```
  cmdShow(skillContentDir: string): void
  ```
- Reads `join(skillContentDir, "SKILL.md")` using `readFileSync(path, "utf8")`.
- Writes content to stdout via `process.stdout.write(content)`.
- If the SKILL.md file does not exist within the validated skill content dir, exits non-zero with a clear error (this is a secondary check — primary check is in `paths.ts`).
- Uses only `node:fs` and `node:path` imports.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — no type errors
- `test -f src/skill/show.ts && echo "show.ts exists"` — file created

**Success Criteria**:
- `src/skill/show.ts` compiles without errors.
- Uses `readFileSync` + `process.stdout.write` for clean pipe-friendly output.
- No console.log, no banners, no version output.

---

### Step 5: Implement `hlx skill install` Handler

**Goal**: Copy bundled skill files to the target agent skills directory with safety invariants.

**What to Build**:
- Create `src/skill/install.ts` with exported function:
  ```
  cmdInstall(args: string[], skillContentDir: string): void
  ```
- **Flag parsing** (using `src/lib/flags.ts` utilities):
  - `getFlag(args, "--target")` — explicit target path
  - `getFlag(args, "--for")` — agent name (`claude` or `codex`)
  - `hasFlag(args, "--force")` — allow overwrite
- **Target resolution** (three-tier priority):
  1. If `--target <path>` provided: install to `join(path, "hlx-cli")`.
  2. If `--for <agent>` provided: install to `join(homedir(), ".<agent>", "skills", "hlx-cli")`. Create the intermediate `skills/` directory if it doesn't exist.
  3. Auto-detect: check `existsSync(join(homedir(), ".claude", "skills"))` and `existsSync(join(homedir(), ".codex", "skills"))`:
     - Exactly one exists: install to `join(thatDir, "hlx-cli")`.
     - Both exist: `stderr.write` error message containing `--for`, `process.exit(1)`.
     - Neither exists: `stderr.write` error message containing `--target`, `process.exit(1)`.
- **No-overwrite check**: If destination directory exists and `--force` is not passed, exit non-zero with no destination changes. Message should mention `--force`.
- **Force mode**: When `--force` is passed and destination exists, `rmSync(dest, { recursive: true, force: true })` before starting the fresh install.
- **Atomic install**: Wrap entire copy operation in try-catch:
  1. `mkdirSync(dest, { recursive: true })` — create target directory.
  2. Copy `SKILL.md` from skillContentDir to dest.
  3. If `references/` directory exists in skillContentDir, create `references/` in dest and copy each file.
  4. On any error in the catch block: `rmSync(dest, { recursive: true, force: true })` to clean up, then re-throw.
- **Success message**: Print a brief confirmation to stderr (not stdout) with the installed path.
- Uses `node:fs`, `node:path`, `node:os` imports.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — no type errors
- `test -f src/skill/install.ts && echo "install.ts exists"` — file created

**Success Criteria**:
- `src/skill/install.ts` compiles without errors.
- Implements three-tier target resolution, no-overwrite safety, force mode, and atomic install with rollback.
- Uses only `src/lib/flags.ts` utilities for flag parsing.
- Uses `homedir()` from `node:os` for home directory resolution.

---

### Step 6: Implement Skill Command Router

**Goal**: Create the top-level `hlx skill` command module that dispatches to show/install subcommands.

**What to Build**:
- Create `src/skill/index.ts` with exported function:
  ```
  runSkill(args: string[]): void
  ```
- Follows the subcommand router pattern from `src/inspect/index.ts`:
  - `skillUsage(exitCode)` function for help text displaying all subcommands and flags.
  - Switch dispatch on `args[0]` (subcommand).
  - Cases: `"show"`, `"install"`, `"--help"` / `"-h"`, default.
- At the top of `runSkill`, call `getSkillContentDir()` from `paths.ts` — this validates bundled files exist before any subcommand runs (corrupt-install detection).
- For `"show"`: check `isHelpRequested(rest)`, then call `cmdShow(skillContentDir)`.
- For `"install"`: check `isHelpRequested(rest)`, then call `cmdInstall(rest, skillContentDir)`.
- For help: call `skillUsage(0)`.
- Default: print unknown command error, call `skillUsage(1)`.
- Usage text should include:
  ```
  hlx skill show                          Print the bundled hlx-cli skill to stdout
  hlx skill install [--target <path>]     Install skill to a directory
  hlx skill install [--for <claude|codex>] Install skill for a specific agent
  hlx skill install [--force]             Overwrite existing installation
  ```

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — no type errors
- `test -f src/skill/index.ts && echo "index.ts exists"` — file created

**Success Criteria**:
- `src/skill/index.ts` compiles without errors.
- Follows the `src/inspect/index.ts` router pattern.
- Calls `getSkillContentDir()` before dispatching (corrupt-install gate).
- Does not require config/auth.

---

### Step 7: Wire Skill Command into CLI Entry Point

**Goal**: Add `hlx skill` to the CLI command router, usage text, and skip-auto-update set.

**What to Build**:
- In `src/index.ts`:
  1. Add import at top: `import { runSkill } from "./skill/index.js";`
  2. Add `"skill"` to the `SKIP_AUTO_UPDATE` set on line 61.
  3. Add usage text lines to the `usage()` function (between the `hlx comments` and `hlx update` blocks):
     ```
     hlx skill show                Print the bundled hlx-cli skill to stdout
     hlx skill install [flags]     Install the skill to an agent's skills directory
     ```
  4. Add `case "skill"` to the switch block (between `update` and `--version`):
     ```
     case "skill":
       runSkill(args.slice(1));
       break;
     ```
     Note: `runSkill` takes only `args` (no config), and is synchronous (no `await` needed) — but use `await` if the function is declared `async` for consistency.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` — no type errors
- `npx tsc && node dist/index.js skill --help` — prints skill usage
- `npx tsc && node dist/index.js --help` — output includes "skill"

**Success Criteria**:
- `src/index.ts` compiles without errors.
- `hlx skill --help` prints the skill usage screen.
- `hlx --help` includes the skill command in the global help.
- `skill` is in the `SKIP_AUTO_UPDATE` set.

---

### Step 8: Add CI Tarball Validation for Skill Content

**Goal**: Prevent publishing without bundled skill content.

**What to Build**:
- In `.github/workflows/publish.yml`, add a grep check after the existing tarball validation lines (around line 51):
  ```
  grep -q "package/skill-content/SKILL.md" tarball-contents.txt || { echo "::error::skill-content/SKILL.md missing from tarball"; exit 1; }
  ```
  This goes alongside the existing checks for `package/dist/index.js` and `package/package.json`.

**Verification (AI Agent Runs)**:
- Inspect `.github/workflows/publish.yml` for the new grep line.

**Success Criteria**:
- The publish workflow validates `skill-content/SKILL.md` presence in the tarball before publishing.

---

### Step 9: Write Unit Tests

**Goal**: Test the skill command logic following established test conventions.

**What to Build**:
- Create `src/skill/skill.test.ts` using `node:test` + `node:assert` (matching `src/lib/flags.test.ts` pattern).
- Test groups:
  1. **Path resolution**: Test that `getSkillContentDir()` returns a valid path when skill-content exists. Test that it throws/exits when the directory is missing (may need to mock or use a temp directory approach).
  2. **Show handler**: Test that `cmdShow()` reads the SKILL.md file and writes to stdout. Test error case when SKILL.md is missing from the dir.
  3. **Install target resolution**: Test auto-detection logic (mock filesystem with temp dirs):
     - Only `~/.claude/skills/` exists -> selects claude
     - Only `~/.codex/skills/` exists -> selects codex
     - Both exist -> error with `--for`
     - Neither exists -> error with `--target`
  4. **No-overwrite behavior**: Test that existing destination without `--force` exits non-zero.
  5. **Force mode**: Test that `--force` with existing destination succeeds.
  6. **Flag parsing**: Test that `--target`, `--for`, `--force` are correctly parsed.
- Use `describe`/`it` blocks. Use temp directories (`mkdtempSync` from `node:os`/`node:fs`) for filesystem tests. Clean up in `afterEach`.

**Verification (AI Agent Runs)**:
- `npm test` — all tests pass (compiles then runs tests)

**Success Criteria**:
- All test cases pass.
- Tests cover path resolution, show, install target resolution, no-overwrite, and force mode.
- Test file follows `node:test` + `node:assert` conventions.

---

### Step 10: Run Quality Gates and End-to-End Verification

**Goal**: Confirm the full implementation is correct and all acceptance criteria are met.

**What to Build**: Nothing — this is a verification-only step.

**Verification (AI Agent Runs)**:
1. `npx tsc --noEmit` — typecheck passes
2. `npm run build` — build succeeds
3. `npm test` — all tests pass
4. `node dist/index.js skill show` — prints SKILL.md content to stdout
5. `node dist/index.js skill --help` — prints skill usage
6. `node dist/index.js --help` — includes skill in global help
7. `npm pack --dry-run 2>&1 | grep skill-content` — skill files in tarball
8. Test install to a temp directory:
   ```
   node dist/index.js skill install --target /tmp/test-skill-install
   ls /tmp/test-skill-install/hlx-cli/SKILL.md
   ```
9. Test no-overwrite: run install again without `--force` to same target — should exit non-zero
10. Test `--force` overwrite: run install with `--force` — should succeed
11. Test corrupt detection: temporarily rename `skill-content/` and run `node dist/index.js skill show` — should exit non-zero with reinstall message

**Success Criteria**:
- All quality gates pass (typecheck, build, test).
- All `hlx skill` subcommands produce correct output.
- Install safety invariants hold (no-overwrite, force, atomic, corrupt detection).

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 installed | available | `package.json` engines field; sandbox environment | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06, CHK-07, CHK-08, CHK-09 |
| npm available for `npm test`, `npm pack` | available | Dev setup config specifies `npm run dev` | CHK-01, CHK-02, CHK-09 |
| TypeScript compiler (`tsc`) available via devDependencies | available | `package.json` devDependencies includes `typescript` | CHK-01, CHK-02 |
| No external services or network required | available | Feature is entirely local (file reads/copies) | All checks |
| Writable temp directory for install tests | available | `/tmp/` is writable in sandbox | CHK-05, CHK-06, CHK-07, CHK-08 |

### Required Checks

[CHK-01] TypeScript typecheck passes with no errors.
- Action: Run `npx tsc --noEmit` in the helix-cli repository root.
- Expected Outcome: Command exits 0 with no error output.
- Required Evidence: Command exit code and stdout/stderr output showing no errors.

[CHK-02] Build and test suite pass.
- Action: Run `npm test` in the helix-cli repository root (this runs `tsc && node --test dist/**/*.test.js`).
- Expected Outcome: Build succeeds and all tests pass, including the new skill tests.
- Required Evidence: Command exit code 0 and test runner output showing all tests passed with counts.

[CHK-03] `hlx skill show` prints bundled SKILL.md content.
- Action: Run `node dist/index.js skill show` after building.
- Expected Outcome: Command exits 0 and prints non-empty content to stdout that includes the SKILL.md content (contains the skill name in YAML frontmatter and operational guidance sections).
- Required Evidence: Command exit code and stdout output excerpt showing SKILL.md content.

[CHK-04] `hlx skill --help` displays usage screen with show and install subcommands.
- Action: Run `node dist/index.js skill --help` after building.
- Expected Outcome: Command exits 0 and prints usage text listing `hlx skill show`, `hlx skill install`, and the `--target`, `--for`, `--force` flags.
- Required Evidence: Command exit code and stdout output showing the usage screen.

[CHK-05] `hlx skill install --target <path>` copies skill files to the target directory.
- Action: Run `node dist/index.js skill install --target /tmp/hlx-skill-verify-test` after building.
- Expected Outcome: Command exits 0. The directory `/tmp/hlx-skill-verify-test/hlx-cli/` is created containing `SKILL.md` and a `references/` subdirectory with at least one `.md` file.
- Required Evidence: Command exit code, `ls -R /tmp/hlx-skill-verify-test/hlx-cli/` output showing the installed files, and file content comparison showing SKILL.md matches the bundled source.

[CHK-06] `hlx skill install` refuses to overwrite existing destination without `--force`.
- Action: After CHK-05 succeeds (destination exists), run `node dist/index.js skill install --target /tmp/hlx-skill-verify-test` again without `--force`.
- Expected Outcome: Command exits non-zero. The error message contains `--force`. The existing destination files are unchanged.
- Required Evidence: Non-zero exit code, stderr output containing `--force`, and `ls -R /tmp/hlx-skill-verify-test/hlx-cli/` output showing files remain unchanged.

[CHK-07] `hlx skill install --force` overwrites existing destination.
- Action: Run `node dist/index.js skill install --target /tmp/hlx-skill-verify-test --force` (destination already exists from CHK-05).
- Expected Outcome: Command exits 0. The destination is fully replaced with the current bundled content.
- Required Evidence: Command exit code 0 and `ls -R /tmp/hlx-skill-verify-test/hlx-cli/` output showing the reinstalled files.

[CHK-08] Corrupt-install detection exits non-zero with reinstall instruction.
- Action: After building, temporarily rename `skill-content/` to `skill-content-bak/`, run `node dist/index.js skill show`, then rename it back.
- Expected Outcome: Command exits non-zero. The error message contains the substring `npm install -g @projectxinnovation/helix-cli@latest`.
- Required Evidence: Non-zero exit code and stderr output containing the reinstall instruction string.

[CHK-09] npm tarball includes bundled skill content files.
- Action: Run `npm pack --dry-run 2>&1` in the helix-cli repository root.
- Expected Outcome: The dry-run output lists `skill-content/SKILL.md` and at least one file under `skill-content/references/`.
- Required Evidence: Command output excerpt showing skill-content files in the tarball listing.

## Success Metrics

1. All 10 implementation steps completed with passing verification.
2. Zero new runtime dependencies introduced.
3. All 8 ticket acceptance criteria met (bundled tarball, show output, auto-detect install, ambiguity error, no-overwrite, target override, corrupt detection, atomic install).
4. Quality gates pass: typecheck, build, and full test suite.
5. `hlx skill show` output is clean (no banners, no log noise, no update checks).
6. `hlx skill install` safety invariants hold in all tested scenarios.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification | Detailed behavioral requirements for show/install, 8 acceptance criteria, safety invariants (no-overwrite, atomic, corrupt detection), and explicit out-of-scope items |
| `scout/scout-summary.md` | Codebase structure analysis | Key boundary: tsc cannot copy non-TS files; skill content must bundle outside dist/; no skill content exists today; command routing pattern via switch in src/index.ts |
| `scout/reference-map.json` | File map, facts, unknowns | Confirmed all relevant source files, flag parsing utilities, path resolution pattern, zero-runtime-dependency constraint, and test conventions |
| `diagnosis/diagnosis-statement.md` | Root cause and approach | Confirmed new feature scope; recommended top-level skill-content/ directory strategy; enumerated files to create (7) and modify (3) |
| `diagnosis/apl.json` | Technical Q&A | Validated bundling strategy, import.meta.url path resolution, no-auth dispatch, sync FS for atomicity, and CI tarball validation need |
| `product/product.md` | Product definition | Defined use cases, core workflow, auto-detection logic, success criteria table, and key design principles (version coupling, zero deps, safety by default) |
| `tech-research/tech-research.md` | Architecture decisions | Confirmed Option A (top-level skill-content/) as chosen approach; detailed API signatures for all new modules; cross-platform considerations; performance expectations |
| `tech-research/apl.json` | Research Q&A | Validated all 6 technical questions: bundling strategy, path resolution, command integration, atomic install, content requirements, and show output scope |
| `repo-guidance.json` | Repo intent | Single-repo ticket; helix-cli is the sole target with no cross-repo impact |
| `src/index.ts` (direct read) | CLI entry point verification | Confirmed switch dispatch (lines 69-117), SKIP_AUTO_UPDATE set (line 61), usage() function (lines 33-58) |
| `package.json` (direct read) | Build and publish config | Confirmed files[] includes only dist/ (lines 18-22), zero runtime deps, ESM package, test uses node:test |
| `tsconfig.json` (direct read) | Build constraints | rootDir=src, outDir=dist — tsc only emits .js/.d.ts, cannot copy .md files |
| `.npmignore` (direct read) | Tarball exclusion rules | Only excludes test files — no conflict with skill-content/ |
| `.github/workflows/publish.yml` (direct read) | CI validation | Lines 50-51 grep for dist/index.js and package.json; needs skill-content/SKILL.md check added |
| `src/inspect/index.ts` (direct read) | Subcommand router pattern | Usage function + switch dispatch + per-subcommand isHelpRequested() — exact template for skill router |
| `src/token/index.ts` (direct read) | No-auth command pattern | runToken(args) takes only args, no config — confirms skill command signature |
| `src/update/version.ts` (direct read) | Runtime path resolution | import.meta.url + dirname + join navigating ../../package.json — same pattern for skill-content/ |
| `src/lib/flags.ts` (direct read) | Flag parsing API | getFlag, hasFlag, isHelpRequested, getPositionalArgs — all needed, no new utilities required |
| `src/lib/config.ts` (direct read) | homedir() and mkdirSync patterns | homedir() for ~/.hlx/ (line 37); mkdirSync with { recursive: true } (line 131) |
| `src/lib/flags.test.ts` (direct read) | Test conventions | node:test + node:assert, describe/it blocks — template for new skill tests |
| Workspace `.claude/skills/runtime-inspection/SKILL.md` (direct read) | Skill content format | YAML frontmatter with name + description, guardrails section, environment section — format template |

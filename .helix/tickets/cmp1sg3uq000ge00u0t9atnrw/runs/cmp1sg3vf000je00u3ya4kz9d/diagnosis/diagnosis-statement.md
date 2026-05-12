# Diagnosis Statement — BLD-429: Bundle hlx-cli agent skill in the CLI

## Problem Summary

The `hlx` CLI (`@projectxinnovation/helix-cli`) does not bundle or expose any agent skill content. Users and AI agents that need operational guidance for `hlx` must manually locate skill files from external sources. This ticket adds a canonical `hlx-cli` skill (SKILL.md + references/) as static assets in the published package, and exposes them via a new `hlx skill` top-level command with `show` and `install` subcommands.

## Root Cause Analysis

This is a new feature — there is no bug or regression. The gap is structural:

1. **No skill content exists anywhere in the repository.** Searches for `SKILL.md` and `references/` in the helix-cli repo returned zero results. The workspace `.claude/skills/` contains 8 skills for other tools but none for hlx-cli. The skill content must be authored as part of this implementation.

2. **The npm package only ships compiled JS.** The `files` field in `package.json` (lines 18-22) includes only `dist/` (minus test files). The TypeScript compiler (`tsc`) configured in `tsconfig.json` compiles `src/` to `dist/` but does not copy non-TS files like markdown. There is no mechanism today to include static asset files in the published tarball beyond the `dist/` directory.

3. **No `hlx skill` command exists.** The CLI command router in `src/index.ts` (lines 69-117) handles: login, token, inspect, comments, org, tickets, update, --version, --help. There is no `skill` case. No `src/skill/` directory exists.

## Evidence Summary

### Static Asset Bundling Boundary (Key Decision Point)

The TypeScript build (`tsc`) cannot copy markdown files. Two viable strategies exist:

| Strategy | Pros | Cons |
|----------|------|------|
| **Top-level `skill-content/` added to `files[]`** | Zero build changes; simple path resolution from package root; clean separation of source and content | Slightly unusual (most projects ship everything from dist/) |
| **Build script copies .md into `dist/`** | Content co-located with compiled output; simpler runtime resolution | Requires build script modification; blurs dist/ as "compiled output only" |

**Recommendation: Top-level `skill-content/` directory.** This requires only adding `"skill-content"` to the `files[]` array. Runtime path resolution follows the established pattern from `src/update/version.ts` (lines 10-14): `dirname(fileURLToPath(import.meta.url))` navigating up to package root. From `dist/skill/index.js`, package root is `../../`, making skill content at `../../skill-content/`.

### Command Integration Pattern

Established patterns from existing command modules:

- **Router pattern** (`src/inspect/index.ts`): export a `runX(args)` function, switch on subcommand, usage function for help, `isHelpRequested()` checks on each subcommand.
- **No-auth pattern** (`src/token/index.ts`): dispatch directly from `src/index.ts` switch without `configOrHelp()`. The `skill` command is purely local (reads bundled files, copies to disk) and needs no authentication.
- **Flag parsing** (`src/lib/flags.ts`): `getFlag()`, `hasFlag()`, `isHelpRequested()`, `getPositionalArgs()` cover all needed flag operations for `--target`, `--for`, `--force`, `--help`.
- **SKIP_AUTO_UPDATE** (`src/index.ts` line 61): `skill` should be added to this set — no reason to check for updates before a local-only command.

### Install Safety Requirements

The ticket mandates:
- No-overwrite without `--force` (exit non-zero, no destination changes)
- Atomic install: either fully complete or clean up partial destination
- Agent auto-detection: check `~/.claude/skills/` and `~/.codex/skills/` existence; disambiguate when both present
- Corrupt-install detection: verify bundled skill files exist before any operation

The `homedir()` pattern from `src/lib/config.ts` (line 37) provides the base for resolving `~/.claude/skills/` and `~/.codex/skills/`.

### Files to Create

| File | Purpose |
|------|---------|
| `skill-content/SKILL.md` | Canonical skill content for hlx-cli agent guidance |
| `skill-content/references/*.md` | Reference material for the skill |
| `src/skill/index.ts` | Skill command router (`runSkill(args)`) |
| `src/skill/show.ts` | `hlx skill show` — read and print bundled SKILL.md to stdout |
| `src/skill/install.ts` | `hlx skill install` — detect target, copy files, handle --force/--target/--for |
| `src/skill/paths.ts` | Shared path resolution for bundled skill content location |
| `src/skill/skill.test.ts` | Tests for skill command logic |

### Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Add `case "skill"` dispatch, add `"skill"` to SKIP_AUTO_UPDATE, add skill line to usage() |
| `package.json` | Add `"skill-content"` to `files[]` array |
| `.github/workflows/publish.yml` | Add tarball validation check for `skill-content/SKILL.md` |

### CI Pipeline Impact

The publish workflow (`.github/workflows/publish.yml` lines 50-51) validates tarball contents with grep checks. A new check for `package/skill-content/SKILL.md` should be added to prevent publishing without skill content.

## Success Criteria

1. Published npm tarball contains `skill-content/SKILL.md` and `skill-content/references/` files
2. `hlx skill show` prints bundled SKILL.md content to stdout (exit 0, clean output)
3. `hlx skill install` auto-detects agent, copies to correct skills directory, handles ambiguity
4. `hlx skill install --force` overwrites existing destination
5. `hlx skill install --target <path>` bypasses auto-detection
6. Corrupt-install detection exits non-zero with reinstall instruction
7. Partial install cleanup leaves no half-populated destination
8. All operations use only Node.js built-in modules (zero runtime dependencies preserved)

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | Detailed behavioral requirements for show/install subcommands, safety invariants, failure behavior, and acceptance criteria |
| scout/reference-map.json | Understand codebase structure and key files | Identified all relevant files, confirmed no existing skill content, documented static-asset bundling boundary as key challenge |
| scout/scout-summary.md | High-level analysis of implementation approach | Confirmed tsc cannot copy non-TS files, established file creation list, validated command integration pattern |
| src/index.ts | Verify command routing and dispatch patterns | Switch-case dispatch on lines 69-117; no-auth commands skip configOrHelp(); SKIP_AUTO_UPDATE on line 61 |
| package.json | Understand npm publish payload | files[] includes only dist/ (lines 18-22); zero runtime deps; ESM package |
| tsconfig.json | Understand build constraints | rootDir=src, outDir=dist; tsc only emits .js and .d.ts — cannot copy .md files |
| .npmignore | Verify tarball exclusion rules | Only excludes .test.js/.test.d.ts files — no conflict with skill content |
| .github/workflows/publish.yml | Understand CI validation | Tarball validated for dist/index.js and package.json presence before publish (lines 50-51) |
| src/inspect/index.ts | Subcommand router reference pattern | Usage function + switch dispatch + per-subcommand help + isHelpRequested() |
| src/token/index.ts | No-auth command reference pattern | Dispatched without config; runToken(args) takes only args |
| src/update/version.ts | Runtime path resolution pattern | import.meta.url + dirname + join to navigate to package root (lines 10-14) |
| src/update/validate.ts | Package install validation pattern | npm root -g resolution + existsSync validation |
| src/lib/flags.ts | Shared flag parsing utilities | getFlag, hasFlag, isHelpRequested, getPositionalArgs — all needed for skill command |
| src/lib/config.ts | homedir() usage pattern | homedir() used for ~/.hlx/ config dir (line 37); same pattern needed for skill install targets |
| src/lib/flags.test.ts | Test convention reference | node:test + node:assert, describe/it blocks |
| Workspace .claude/skills/ | Canonical skill directory format | Skills are `<name>/SKILL.md` with optional `references/`; 8 existing skills confirm format |

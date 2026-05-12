# Scout Summary — BLD-429: Bundle hlx-cli agent skill in the CLI

## Problem

The hlx-cli agent skill (`SKILL.md` + `references/`) currently lives outside the CLI package. Users and agents must manually locate and copy skill files into their agent's skills directory. This ticket requires:

1. Bundling the canonical skill content as static files inside the published `@projectxinnovation/helix-cli` npm package.
2. Adding a new `hlx skill` top-level command with `show` (stdout print) and `install` (copy to disk) subcommands.
3. Enforcing safety invariants: no silent overwrite, atomic install (cleanup on partial failure), corrupt-install detection, and clean stdout for `show`.

## Analysis Summary

### Command Integration Pattern
The CLI routes commands via a switch statement in `src/index.ts` (lines 69-117). Each command module lives in `src/<command>/index.ts` and exports a router function. The `skill` command does not need authentication (like `login`, `token`, `update`), so it dispatches directly without `configOrHelp()`. Flag parsing uses shared utilities from `src/lib/flags.ts`.

### Static Asset Bundling — Key Boundary
This is the most significant implementation boundary. The current build pipeline compiles TypeScript (`tsc`) from `src/` to `dist/`, and the `files` field in `package.json` only includes `dist/`. TypeScript does **not** copy non-TS files. The skill content (markdown files) cannot be placed in `src/` and expected to appear in `dist/`. The implementation must either:
- Add a top-level directory (e.g., `skill-content/`) to the `files[]` array in `package.json`, or
- Add a build step that copies static files into `dist/`, or
- Use a combination approach

### Runtime Path Resolution
The codebase already has a pattern for resolving paths relative to the installed package: `dirname(fileURLToPath(import.meta.url))` navigating up to the package root (see `src/update/version.ts`). The skill command needs similar resolution to locate bundled files at runtime.

### Skill Content — Does Not Exist Yet
No `SKILL.md` or `references/` directory exists in the helix-cli repository. The workspace `.claude/skills/` shows the canonical skill format (directory with `SKILL.md` + optional `references/`), but no hlx-cli skill is present there either. The skill content must be authored as part of this ticket.

### Publish Pipeline Impact
The CI workflow (`.github/workflows/publish.yml`) validates tarball contents before publishing. Currently checks for `dist/index.js` and `package.json` presence, and rejects `.test.js` files. If skill files are bundled, tarball validation should also verify their presence.

### Target Install Directories
Install targets are `~/.claude/skills/hlx-cli/` and `~/.codex/skills/hlx-cli/`. The command must detect which directories exist, handle ambiguity (both present), and support `--target` for explicit path override.

### No External Dependencies
The package has zero runtime dependencies — only devDependencies for TypeScript compilation. The skill command implementation should continue this pattern, using only Node.js built-in modules (`node:fs`, `node:path`, `node:os`).

## Relevant Files

| File | Role |
|------|------|
| `src/index.ts` | CLI entry point; add `skill` case to switch, update usage text, possibly update SKIP_AUTO_UPDATE |
| `package.json` | Update `files[]` to include skill content directory; version 1.3.2 |
| `tsconfig.json` | Build config — tsc cannot copy non-TS files; determines path resolution |
| `.npmignore` | Must not exclude skill files from tarball |
| `.github/workflows/publish.yml` | Tarball validation may need skill file checks |
| `src/lib/flags.ts` | Shared flag utilities used by all commands |
| `src/inspect/index.ts` | Reference pattern for subcommand router with help |
| `src/token/index.ts` | Reference pattern for no-auth command dispatch |
| `src/update/version.ts` | Reference pattern for runtime path resolution via import.meta.url |
| `src/update/validate.ts` | Reference for resolving global npm install path |
| `src/lib/config.ts` | Uses `homedir()` pattern needed for install target resolution |
| `src/lib/flags.test.ts` | Test pattern: node:test built-in runner, describe/it blocks |
| `src/lib/resolve-ticket.test.ts` | Test pattern: env var mocking with beforeEach/afterEach |

## New Files Required

| Path | Purpose |
|------|---------|
| `src/skill/index.ts` | Skill command router (runSkill) |
| `src/skill/show.ts` | `hlx skill show` handler — read and print bundled SKILL.md |
| `src/skill/install.ts` | `hlx skill install` handler — copy skill files to agent skills dir |
| `skill-content/SKILL.md` | Canonical skill content (to be authored) |
| `skill-content/references/*.md` | Reference files (to be authored) |
| `src/skill/skill.test.ts` | Unit tests for skill command logic |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification for the feature | Detailed behavioral requirements for show/install, failure modes, acceptance criteria, and non-negotiable invariants |
| src/index.ts | Map CLI entry point and command routing | Switch-case dispatch pattern; no-auth commands skip configOrHelp(); SKIP_AUTO_UPDATE set controls auto-update bypass |
| package.json | Understand publish payload and build scripts | `files` only includes `dist/`; zero runtime deps; test uses node:test built-in |
| tsconfig.json | Understand build constraints | tsc only compiles TS → JS; does not copy static assets like .md files |
| .npmignore | Verify tarball exclusions | Only excludes test files; no current risk to skill files |
| .github/workflows/publish.yml | Understand CI validation | Tarball is validated for required files before publish |
| src/inspect/index.ts | Command module reference pattern | Usage function + switch + per-subcommand help + isHelpRequested |
| src/token/index.ts | No-auth command reference | Dispatched without config; minimal router pattern |
| src/update/version.ts | Runtime path resolution reference | import.meta.url + dirname + relative navigation to package root |
| src/update/validate.ts | Package install path resolution | npm root -g + known package path structure |
| src/lib/flags.ts | Shared flag parsing API | getFlag, hasFlag, isHelpRequested, requireFlag, getPositionalArgs |
| src/lib/config.ts | homedir() usage pattern | Config path at ~/.hlx/; same os.homedir() needed for skill install targets |
| src/lib/flags.test.ts | Test conventions | node:test + node:assert, describe/it structure |
| Workspace .claude/skills/ | Canonical skill directory structure | Each skill is `<name>/SKILL.md` with optional `references/` |

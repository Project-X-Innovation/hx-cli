# Tech Research — BLD-429: Bundle hlx-cli agent skill in the CLI

## Technology Foundation

- **Runtime**: Node.js >= 18 (ESM, `"type": "module"`)
- **Language**: TypeScript 6.x compiled with `tsc` (target ES2022, module Node16)
- **Build**: `tsc` compiles `src/` to `dist/`. No bundler. Non-TS static files are NOT copied by `tsc`.
- **Package**: `@projectxinnovation/helix-cli` v1.3.2, published to npm with provenance
- **Dependencies**: Zero runtime dependencies. All functionality uses Node.js built-in modules (`node:fs`, `node:path`, `node:os`, `node:url`)
- **Test runner**: Node.js built-in test runner (`node:test` + `node:assert`)
- **CI**: GitHub Actions publish workflow validates tarball contents before `npm publish`

No new runtime dependencies are introduced by this feature.

## Architecture Decision

### Options Considered

#### Option A: Top-level `skill-content/` directory added to `files[]` (Chosen)

Place the canonical skill files (`SKILL.md` and `references/*.md`) in a top-level `skill-content/` directory at the package root. Add `"skill-content"` to the `package.json` `files[]` array so npm includes it in the tarball alongside `dist/`.

**Pros:**
- Zero build pipeline changes — no new build scripts, no modifications to `tsc` config
- Clean separation: `dist/` remains compiled-only output; `skill-content/` is static assets
- The `.npmignore` only excludes test files, so no conflicts
- Runtime path resolution follows the same `import.meta.url` pattern already used by `src/update/version.ts`

**Cons:**
- Slightly unusual to have a non-`dist/` directory in the published package (minor)

#### Option B: Build script copies .md files into `dist/`

Add a post-build step (e.g., in `package.json` scripts) that copies markdown files from a source location into `dist/skill-content/`.

**Pros:**
- All published content lives under `dist/`, so `files[]` stays as `["dist"]`
- Simpler runtime resolution (skill files are siblings to compiled modules)

**Cons:**
- Adds build complexity — a new copy step that must stay in sync
- Blurs `dist/` convention as "tsc compiled output only"
- Fragile if the build step is forgotten or misconfigured

#### Option C: Inline skill content in TypeScript strings

Embed the SKILL.md content as template literal strings within TypeScript source files.

**Pros:**
- No static asset bundling concern at all — compiled into JS

**Cons:**
- Violates the ticket invariant: "The bundled files are verbatim copies of the existing canonical SKILL.md and references/* files" — content must remain as standalone files
- Violates "The bundled skill files are read-only at distribution time. The CLI must not rewrite or regenerate them at runtime"
- Makes content editing impractical
- Cannot produce byte-for-byte file copies during install

### Chosen: Option A

**Rationale**: Option A is the simplest correct approach. It requires a one-line change to `package.json` (`files[]`) and respects all ticket invariants. The existing `import.meta.url` path resolution pattern (verified in `src/update/version.ts` lines 10-14) works identically for locating `skill-content/` from compiled code in `dist/`. No build pipeline changes are needed.

## Core API/Methods

### New Module: `src/skill/index.ts`

Exports `runSkill(args: string[]): Promise<void>` — the skill command router.

- Follows the subcommand router pattern from `src/inspect/index.ts`: a `skillUsage()` help function, switch dispatch on the first arg, and per-subcommand `isHelpRequested()` checks.
- Takes only `args` (no config) — same as `src/token/index.ts`.

### Path Resolution Utility (internal to skill module)

```
getSkillContentDir(): string
```

Resolves the absolute path to the bundled `skill-content/` directory at runtime:
- Uses `dirname(fileURLToPath(import.meta.url))` to get the directory of the compiled module
- From `dist/skill/*.js`, navigates `../../skill-content/` to reach package root's skill content
- Validates the directory exists with `existsSync()` before returning
- Throws/exits with reinstall instruction if missing (corrupt-install detection)

### Show Handler: `src/skill/show.ts`

```
cmdShow(skillContentDir: string): void
```

- Reads `SKILL.md` from the resolved skill content directory using `readFileSync`
- Writes content to `process.stdout.write()` for clean pipe-friendly output
- Exits 0 on success, non-zero if file missing

### Install Handler: `src/skill/install.ts`

```
cmdInstall(args: string[], skillContentDir: string): void
```

- Parses flags: `--target <path>`, `--for <claude|codex>`, `--force`
- Target resolution priority: `--target` > `--for` > auto-detect
- Auto-detect logic uses `existsSync()` to check `~/.claude/skills/` and `~/.codex/skills/` via `homedir()` from `node:os`
- Install destination is always `<resolved-target>/hlx-cli/`
- Copies all files from `skill-content/` to destination (SKILL.md + references/ recursively)
- Atomic: entire copy in try-catch, `rmSync` cleanup on failure

### Flag Usage

All flag parsing uses existing utilities from `src/lib/flags.ts`:
- `getFlag(args, "--target")` — extract target path
- `getFlag(args, "--for")` — extract agent name
- `hasFlag(args, "--force")` — check force flag
- `isHelpRequested(args)` — check for --help/-h

No new flag utilities are needed.

## Technical Decisions

### 1. Command Dispatch: No-Auth, Skip Auto-Update

**Decision**: The `skill` command dispatches without `configOrHelp()` and is added to `SKIP_AUTO_UPDATE`.

**Rationale**: The command is purely local — it reads bundled files from disk and optionally copies them to another local directory. It never contacts the Helix API. Adding an auto-update network check before a local-only operation adds unnecessary latency (the update check makes an HTTP request to npm registry).

**Evidence**: `src/index.ts` lines 70-76 show `login` and `token` dispatched without `configOrHelp()`. Line 61 shows `SKIP_AUTO_UPDATE` set. `src/token/index.ts` confirms the `runToken(args)` signature with no config parameter.

**Rejected alternative**: Requiring config/auth for skill commands — no API calls are made, so auth would be a useless barrier.

### 2. Synchronous File Operations

**Decision**: Use synchronous Node.js FS APIs (`readFileSync`, `copyFileSync`, `mkdirSync`, `readdirSync`, `existsSync`, `rmSync`) for all skill operations.

**Rationale**: The operation set is small (reading one markdown file for show; copying ~5-10 small files for install). Synchronous operations simplify the atomicity guarantee — the try-catch rollback pattern is straightforward without async error handling complexity. The rest of the codebase already uses sync FS operations extensively (see `src/lib/config.ts`, `src/update/version.ts`).

**Rejected alternative**: Async FS with `fs/promises` — adds complexity for no benefit given the small file set and the need for sequential atomic semantics.

### 3. Atomic Install Strategy

**Decision**: Wrap the entire install operation (mkdir + all file copies) in a single try-catch. On any error, `rmSync(targetDir, { recursive: true, force: true })` before re-throwing.

**Rationale**: The ticket mandates "Either the install completes fully or the partial destination is removed before exit." The try-catch-cleanup pattern is the simplest way to guarantee this with synchronous operations. `rmSync` with `{ recursive: true, force: true }` handles both partially and fully created directories.

**Implementation detail**: When `--force` is used, the existing directory should be removed *before* the new install begins (not after), so the old content is gone and the new install is subject to the same atomic guarantee.

### 4. Destination Resolution Logic

**Decision**: Three-tier resolution: `--target` overrides everything; `--for` selects a specific agent; auto-detect checks both `~/.claude/skills/` and `~/.codex/skills/`.

**Implementation detail**:
1. If `--target <path>` is provided, install to `<path>/hlx-cli/`. No auto-detection.
2. If `--for claude` or `--for codex` is provided, install to `~/<agent>/skills/hlx-cli/`. Create the skills directory if it doesn't exist.
3. If neither flag is provided:
   - Check `existsSync(join(homedir(), '.claude', 'skills'))` and `existsSync(join(homedir(), '.codex', 'skills'))`
   - If exactly one exists -> install there
   - If both exist -> exit non-zero, message includes `--for`
   - If neither exists -> exit non-zero, message includes `--target`

**Rationale**: Directly from ticket required behavior points 2-4.

### 5. Corrupt-Install Detection

**Decision**: Validate bundled skill content directory existence at the entry point of every `hlx skill` subcommand (before any operation).

**Implementation detail**: The path resolution function `getSkillContentDir()` checks `existsSync()` on the resolved `skill-content/` directory. If it doesn't exist, all subcommands (show, install, help-related content) exit non-zero with: `"Bundled skill files are missing. Reinstall with: npm install -g @projectxinnovation/helix-cli@latest"`.

**Rationale**: Ticket failure behavior requirement. Centralizing in path resolution avoids duplicating the check across subcommands.

### 6. `hlx skill show` Prints SKILL.md Only

**Decision**: The `show` subcommand prints only the `SKILL.md` file content, not the references directory.

**Rationale**: The ticket says "at minimum the full SKILL.md." Printing only SKILL.md keeps stdout predictable and pipe-friendly. References are supplementary material installed via `hlx skill install`. The invariant "must emit only the skill content. No log noise, no version banner" confirms the output should be clean and minimal.

### 7. Usage Text in Global Help

**Decision**: Add a `hlx skill` section to the global usage function in `src/index.ts`.

**Implementation detail**: Add two lines to the usage text:
```
  hlx skill show                Print the bundled hlx-cli skill to stdout
  hlx skill install [flags]     Install the skill to an agent's skills directory
```

**Rationale**: Every existing command has a corresponding entry in the global `usage()` function (lines 33-58). Consistency requires the skill command to appear there.

### 8. Skill Content Authoring

**Decision**: The `SKILL.md` and `references/` content must be authored as part of this ticket's implementation. There is no pre-existing canonical source.

**Rationale**: Exhaustive search confirmed no SKILL.md or references/ directory exists in the helix-cli repository or workspace skills. The ticket says "verbatim copies of the existing canonical SKILL.md" — this invariant applies post-authoring: once the content is written, the bundled files ship unchanged. The content should describe hlx CLI operational guidance for AI agents: available commands, common workflows, flag conventions, and guardrails.

## Cross-Platform Considerations

- **Path separators**: Use `node:path` `join()` consistently (never hardcode `/`). This matters for Windows users running the CLI via Node.js.
- **Home directory**: Use `homedir()` from `node:os` (not `process.env.HOME` which is undefined on Windows).
- **Agent skills directories**: `~/.claude/skills/` and `~/.codex/skills/` — these are Unix-convention paths. On Windows, `homedir()` returns `C:\Users\<user>`, so the actual paths would be `C:\Users\<user>\.claude\skills\`. The `join()` function handles this correctly.
- **File copy permissions**: `copyFileSync` preserves content but not POSIX permissions on all platforms. This is acceptable since markdown files don't need execute permissions.

## Performance Expectations

- **`hlx skill show`**: Single `readFileSync` call + stdout write. Sub-millisecond. No network calls.
- **`hlx skill install`**: Disk I/O only. Copies ~5-10 small markdown files (each < 50KB). Sub-second on any modern filesystem.
- **`hlx skill` with SKIP_AUTO_UPDATE**: No auto-update HTTP request overhead. Command starts immediately.
- **Package size impact**: Adding ~50-100KB of markdown content to the npm tarball. Negligible impact on install time.

## Dependencies

### Runtime Dependencies
None. The skill command uses only Node.js built-in modules:
- `node:fs` — readFileSync, copyFileSync, mkdirSync, readdirSync, existsSync, rmSync, statSync
- `node:path` — join, dirname, basename
- `node:os` — homedir
- `node:url` — fileURLToPath

This preserves the package's zero-runtime-dependency stance.

### Dev Dependencies
No new dev dependencies. Existing TypeScript + @types/node are sufficient.

### External Dependencies
None. No network calls, no external APIs, no remote registries.

## Deferred to Round 2

- **Multi-skill support**: The ticket explicitly scopes this to a single bundled skill named `hlx-cli`. If additional skills are bundled in the future, the `skill-content/` structure and command flags would need extension (e.g., `--name` flag, `hlx skill list`). Out of scope per ticket.
- **Auto-install on `hlx update`**: Explicitly out of scope. `hlx update` does not trigger skill reinstallation.
- **Remote skill registry**: Explicitly out of scope. The skill is bundled, not fetched.
- **Skill content review quality**: The SKILL.md and references content will be authored in implementation. Content review for accuracy and completeness is a post-implementation concern.
- **Templates directory**: The workspace skill format shows some skills include a `templates/` directory (e.g., `agent-browser`). The hlx-cli skill does not need templates — only SKILL.md and references/.

## Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Asset bundling | Top-level `skill-content/` in `files[]` | Zero build changes; clean separation from dist/ |
| Path resolution | `import.meta.url` + navigate up 2 dirs | Follows existing version.ts pattern exactly |
| Command dispatch | No-auth, skip auto-update | Purely local operation; no API or network needed |
| FS API style | Synchronous (readFileSync, etc.) | Small file set; simpler atomicity; matches codebase style |
| Atomicity | try-catch + rmSync cleanup | Guarantees no half-populated state on failure |
| Install target | 3-tier: --target > --for > auto-detect | Directly from ticket required behavior |
| Corrupt detection | Validate at entry of every subcommand | Centralized in path resolution; fail-fast |
| Show output | SKILL.md only | Ticket says "at minimum SKILL.md"; pipe-friendly |
| Content authoring | Author from scratch in implementation | No existing source; confirmed by exhaustive search |
| CI validation | Add skill-content/SKILL.md tarball check | Prevents publishing without skill content |

## Files to Create

| File | Purpose |
|------|---------|
| `skill-content/SKILL.md` | Canonical hlx-cli agent skill guidance document |
| `skill-content/references/*.md` | Supporting reference documents for detailed per-command usage |
| `src/skill/index.ts` | Skill command router: `runSkill(args)`, usage function, switch dispatch |
| `src/skill/show.ts` | `hlx skill show` handler: read and print bundled SKILL.md |
| `src/skill/install.ts` | `hlx skill install` handler: target resolution, atomic file copy, rollback |
| `src/skill/paths.ts` | Shared path resolution: locate skill-content/ from compiled module at runtime |
| `src/skill/skill.test.ts` | Unit tests for path resolution, target detection, flag handling |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Add `case "skill"` to switch (import + dispatch `runSkill`); add `"skill"` to `SKIP_AUTO_UPDATE`; add skill lines to `usage()` |
| `package.json` | Add `"skill-content"` to `files[]` array |
| `.github/workflows/publish.yml` | Add `grep -q "package/skill-content/SKILL.md"` tarball validation check |

## APL Statement Reference

This is a new feature ticket — no bug or regression. The technical direction is confirmed: bundle skill content in a top-level `skill-content/` directory added to `package.json` `files[]`, implement a new `src/skill/` command module following established CLI patterns (no-auth, skip-auto-update, switch-based subcommand router), resolve bundled file paths at runtime via `import.meta.url`, and use synchronous Node.js built-in FS APIs with try-catch rollback for atomic install. Skill content (SKILL.md + references/) must be authored as part of implementation since no canonical source exists. All diagnosis findings confirmed; no contradictions found during direct code inspection.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary feature specification | Detailed behavioral requirements for show/install, safety invariants (no-overwrite, atomic install, corrupt detection), acceptance criteria, and explicit out-of-scope boundaries |
| scout/reference-map.json | Codebase file map, facts, and unknowns | Confirmed command routing pattern, tsc limitation for non-TS files, zero-runtime-dependency constraint, and that no skill content exists yet |
| scout/scout-summary.md | High-level analysis of implementation approach | Identified static-asset bundling as key boundary; enumerated new files and modifications needed |
| diagnosis/apl.json | Answered technical questions from scout phase | Validated top-level skill-content/ bundling strategy, import.meta.url path resolution, no-auth dispatch, atomic install pattern, and CI validation need |
| diagnosis/diagnosis-statement.md | Root cause analysis and implementation recommendation | Confirmed new feature (no regression); provided strategy comparison table for asset bundling; established files-to-create and files-to-modify lists |
| product/product.md | Product definition and success criteria | Defined use cases, core workflow, auto-detection logic, and key design principles (version coupling, zero deps, safety by default) |
| repo-guidance.json | Repo intent classification | Confirmed single-repo scope: helix-cli is the sole target with no cross-repo impact |
| src/index.ts (direct) | Verify command router, SKIP_AUTO_UPDATE, usage() | Confirmed switch dispatch lines 69-117, SKIP_AUTO_UPDATE set line 61, usage function lines 33-58 |
| package.json (direct) | Verify files[], scripts, dependencies | Confirmed files only includes dist/ (lines 18-22), zero runtime deps, ESM package, test uses node:test |
| tsconfig.json (direct) | Verify build constraints | rootDir=src, outDir=dist — tsc only emits .js/.d.ts, cannot copy markdown |
| .npmignore (direct) | Verify tarball exclusions | Only excludes test files; no conflict with skill-content/ |
| .github/workflows/publish.yml (direct) | Verify CI tarball validation | Lines 50-51 grep for dist/index.js and package.json; skill-content/SKILL.md check needed |
| src/inspect/index.ts (direct) | Subcommand router reference | Usage function + switch dispatch + per-subcommand isHelpRequested() — pattern to follow |
| src/token/index.ts (direct) | No-auth command reference | runToken(args) with no config — confirms skill command signature |
| src/update/version.ts (direct) | Runtime path resolution reference | import.meta.url + dirname + join navigating ../../package.json from dist/update/ — same depth for skill module |
| src/lib/flags.ts (direct) | Flag parsing API | getFlag, hasFlag, isHelpRequested, getPositionalArgs — all needed, no new utilities required |
| src/lib/config.ts (direct) | homedir() and mkdirSync patterns | homedir() for ~/.hlx/ (line 37); mkdirSync with { recursive: true } (line 131) |
| Workspace .claude/skills/ (direct) | Canonical skill directory format | Skills follow <name>/SKILL.md + optional references/ structure; some also have templates/ |

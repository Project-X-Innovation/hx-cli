# Product Definition — BLD-429: Bundle hlx-cli agent skill in the CLI

## Problem Statement

AI agents that use the Helix CLI (`hlx`) have no built-in way to learn its operational guidance. The `hlx-cli` skill content (how to use `hlx` commands effectively) lives outside the published CLI package. Users and agents must manually find the skill files on a teammate's machine or infer usage from source code. This creates a fragile onboarding path where skill content can be stale, missing, or mismatched with the installed CLI version.

## Product Vision

A single `hlx skill` command makes agent onboarding instant. The skill content ships inside the CLI package itself, guaranteeing the guidance always matches the installed CLI version. No manual file hunting, no version drift, no external dependencies.

## Users

| User | Need |
|------|------|
| **AI agent operators** (engineers setting up Claude, Codex, or similar agents) | One-command install of hlx operational guidance into their agent's skills directory |
| **AI agents** (Claude, Codex) | Accurate, version-matched operational guidance for hlx commands |
| **CLI developers** | Single source of truth for skill content, versioned with the CLI |

## Use Cases

1. **Agent setup**: An engineer installs the Helix CLI and immediately installs the hlx skill into their agent's skills directory with a single command (`hlx skill install`).
2. **Skill inspection**: A user or agent previews the bundled skill content without modifying anything on disk (`hlx skill show`).
3. **Multi-agent disambiguation**: An engineer with both Claude and Codex installed is prompted to specify which agent receives the skill, preventing accidental misinstall.
4. **Custom target install**: An engineer working with a non-standard agent setup installs the skill to an explicit path (`hlx skill install --target <path>`).
5. **Skill update**: After upgrading the CLI, an engineer reinstalls the skill with `--force` to get the latest guidance matching the new CLI version.

## Core Workflow

```
hlx skill show          --> prints skill content to stdout (pipe-friendly, no noise)
hlx skill install       --> auto-detects agent, copies to ~/.claude/skills/hlx-cli/ or ~/.codex/skills/hlx-cli/
hlx skill install --for claude   --> explicit agent selection
hlx skill install --target /path --> explicit directory
hlx skill install --force        --> overwrites existing install
```

**Auto-detection logic:**
- One agent directory exists -> install there
- Both exist -> require `--for <claude|codex>`
- Neither exists -> require `--target <path>`

## Essential Features (MVP)

1. **Bundled skill content**: The published `@projectxinnovation/helix-cli` npm tarball includes the canonical `SKILL.md` and `references/` directory as static files. Content is versioned with the CLI.
2. **`hlx skill show`**: Prints the full bundled `SKILL.md` to stdout. Exit 0, clean output only (no banners, no log noise, no update checks).
3. **`hlx skill install`**: Copies all bundled skill files to the target agent's skills directory at `<target>/hlx-cli/`. Supports `--target`, `--for`, and `--force` flags.
4. **No-overwrite safety**: Refuses to overwrite an existing `hlx-cli/` directory without `--force`. Exits non-zero with no destination changes.
5. **Atomic install**: If copying fails partway, the partial destination is cleaned up. No half-populated state is left on disk.
6. **Corrupt-install detection**: If bundled skill files are missing (e.g., damaged npm install), all `hlx skill` subcommands exit non-zero with a reinstall instruction (`npm install -g @projectxinnovation/helix-cli@latest`).
7. **`hlx skill --help`**: Usage screen following the same convention as `tickets` and `inspect`.

## Features Explicitly Out of Scope (MVP)

- Remote skill registry or remote fetching of skill content at runtime.
- Auto-install on `hlx update`.
- Editing skill content from within the CLI.
- Multi-skill support (the CLI bundles exactly one skill named `hlx-cli`).
- Splitting the skill into a separate npm package or GitHub release.
- Modifying the canonical skill source format.

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Published tarball contains `SKILL.md` and `references/` as static assets | Inspect tarball contents |
| 2 | `hlx skill show` prints non-empty SKILL.md content verbatim, exits 0 | Run on fresh install, verify output matches bundled file |
| 3 | `hlx skill install` with one agent dir present installs correctly | Verify byte-for-byte match with bundled files |
| 4 | `hlx skill install` with both agent dirs exits non-zero, mentions `--for` | Run with both dirs present, verify error message |
| 5 | `hlx skill install` against existing destination without `--force` exits non-zero, no changes | Verify destination untouched |
| 6 | `hlx skill install --target <path>` writes to `<path>/hlx-cli/` regardless of agent dirs | Verify target path used |
| 7 | Missing bundled files causes non-zero exit with reinstall instruction | Delete bundled files, run any `hlx skill` form |
| 8 | Mid-copy failure leaves no partial destination | Simulate FS error, verify clean state |

## Key Design Principles

- **Version coupling**: Skill content always matches the CLI version. No separate versioning or distribution.
- **Zero runtime dependencies**: Uses only Node.js built-in modules, consistent with the rest of the CLI.
- **Safety by default**: Never silently overwrites. Requires explicit `--force`.
- **Clean output**: `hlx skill show` is pipe-friendly with no interleaved noise.
- **Bundled files are read-only**: The CLI never rewrites or regenerates skill content at runtime.

## Scope & Constraints

- **Single repo**: All changes are within `helix-cli`. No cross-repo impact.
- **Skill content authoring**: The skill content (`SKILL.md` and `references/`) does not exist in the repository today. It must be authored as part of this work to provide accurate operational guidance for the current CLI commands.
- **Build pipeline**: TypeScript (`tsc`) does not copy non-TS files. Skill content must be bundled outside `dist/` (e.g., a top-level `skill-content/` directory added to `package.json` `files[]`).
- **No-auth command**: `hlx skill` operates locally with no network/auth requirements. Should skip auto-update checks.
- **CI validation**: The publish pipeline validates tarball contents; skill file presence should be validated before publish.

## Future Considerations

- If additional skills are bundled in the future, the `hlx skill` command may need a `--name` flag or list subcommand. This is explicitly out of scope for MVP.
- If agents adopt a standard skill discovery protocol, the install logic may need to adapt.
- Post-MVP, `hlx update` could optionally prompt to re-install the skill, but auto-install is explicitly excluded.

## Open Questions / Risks

| # | Question / Risk | Impact | Mitigation |
|---|----------------|--------|------------|
| 1 | The canonical SKILL.md content does not exist yet. The ticket says "verbatim copies" of existing files, but no source exists in the repo or workspace. | Content must be authored, not just bundled. This adds scope. | Treat content authoring as in-scope. The "verbatim" invariant applies post-authoring: bundled files must ship unchanged. |
| 2 | Which specific files belong in `references/`? The ticket mentions `references/*` but no canonical source is identified. | Determines the file set to bundle and copy. | Author the references alongside SKILL.md, informed by the CLI's existing command surface. |
| 3 | Should `skill` be added to the SKIP_AUTO_UPDATE set? | Minor UX concern: auto-update check before a local-only command adds unnecessary latency. | Diagnosis recommends yes. Product agrees: `skill` is purely local, skip update check. |
| 4 | Pipe-friendliness of `hlx skill show`: should it also emit `references/` content or only `SKILL.md`? | Affects what agents/scripts receive when piping stdout. | Ticket says "at minimum the full SKILL.md". Start with SKILL.md only; references are installed via `install`. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification | Detailed behavioral requirements, acceptance criteria, invariants, and failure modes for show/install subcommands |
| `scout/scout-summary.md` | Understand codebase structure and implementation boundaries | Key boundary: tsc cannot copy non-TS files; skill content must bundle outside dist/; no skill content exists today |
| `scout/reference-map.json` | Map relevant files, facts, and unknowns | Confirmed command routing patterns, flag utilities, path resolution approach, and zero-runtime-dependency constraint |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and implementation approach | Confirmed new feature (no regression); recommended top-level skill-content/ dir strategy; enumerated files to create and modify |
| `diagnosis/apl.json` | Answered technical questions from scout | Validated bundling strategy, path resolution pattern, no-auth dispatch, atomic install approach, and CI changes |
| `repo-guidance.json` | Repo intent and scope | Confirmed single-repo ticket; helix-cli is the sole target |

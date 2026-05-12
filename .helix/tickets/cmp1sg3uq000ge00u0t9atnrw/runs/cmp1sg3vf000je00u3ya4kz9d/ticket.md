# Ticket Context

- ticket_id: cmp1sg3uq000ge00u0t9atnrw
- short_id: BLD-429
- run_id: cmp1sg3vf000je00u3ya4kz9d
- run_branch: helix/build/BLD-429-helix-cli-bundle-the-hlx-cli-agent-skill-in-the
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Helix CLI: bundle the hlx-cli agent skill in the CLI and expose it via hlx skill

## Description
# Helix CLI: bundle the hlx-cli agent skill in the CLI and expose it via `hlx skill`

## Summary
The hlx-cli agent skill (operational guidance for AI agents on how to use `hlx`) lives outside the CLI today. Users and agents have to know where the skill files exist on disk and copy them manually into their agent's skills directory. This ticket bundles the canonical skill content inside the published `@projectxinnovation/helix-cli` package and adds a `hlx skill` command with two user-facing modes: print the content to stdout, or install it into the local agent's skills directory.

## Why
An agent that wants the operational guidance for `hlx` today must find the skill files on a teammate's machine, infer commands from CLI source, or already have the skill from a prior manual copy. Bundling the skill in the published CLI guarantees the skill version always matches the CLI version, and a single command makes agent onboarding instant.

## Decisions Already Made
- The skill content ships inside the published `@projectxinnovation/helix-cli` package as static files. It is not distributed separately and is not remote-fetched at runtime.
- The skill content is versioned alongside the CLI itself. Shipping CLI version X always carries the skill content authored against version X.
- The CLI exposes both print-to-stdout and install-to-disk modes. Users pick which they need.
- Default install destination is the active agent's skills directory. When multiple agents are detected, the command requires an explicit selection.

## Do Not Re-Decide
- Do not split the skill into a separate npm package, GitHub release, or remote registry.
- Do not modify the canonical skill source format. The bundled files are verbatim copies of the existing canonical `SKILL.md` and `references/*` files.
- Do not auto-install the skill on `hlx update`.

## Non-Negotiable Invariants
- `hlx skill install` must not silently overwrite an existing destination. If a directory already exists at the install target, the command must require `--force` or exit non-zero with no destination changes.
- `hlx skill show` must emit only the skill content. No log noise, no version banner, no update-check output.
- The bundled skill files are read-only at distribution time. The CLI must not rewrite or regenerate them at runtime.

## In Scope
- Bundling the canonical hlx-cli skill (`SKILL.md` and the `references/` directory) into the published `@projectxinnovation/helix-cli` package as static assets, included in the npm tarball.
- A new top-level `hlx skill` subcommand with these forms:
  - `hlx skill show` — prints the bundled skill content to stdout.
  - `hlx skill install [--target <path>] [--for <claude|codex>] [--force]` — copies the bundled skill into a target skills directory.
  - `hlx skill --help` — usage screen following the same `--help` convention as `tickets` and `inspect`.

## Out of Scope
- Hosting the skill on a remote registry.
- Auto-installing the skill on `hlx update`.
- Editing skill content from within the CLI.
- Multi-skill support. The CLI bundles exactly one canonical skill named `hlx-cli`.

## Required Behavior
1. `hlx skill show` exits 0 and prints the bundled skill content (at minimum the full `SKILL.md`) to stdout, with nothing else interleaved.
2. `hlx skill install` with no flags:
   - detects whether `~/.claude/skills/` and/or `~/.codex/skills/` exist
   - if exactly one exists, installs to `<that-dir>/hlx-cli/`
   - if both exist, exits non-zero with a message instructing the user to pass `--for <claude|codex>`
   - if neither exists, exits non-zero with a message instructing the user to pass `--target <path>`
3. `hlx skill install --for <claude|codex>` installs to the corresponding canonical skills directory (`~/.claude/skills/hlx-cli/` or `~/.codex/skills/hlx-cli/`).
4. `hlx skill install --target <path>` installs to `<path>/hlx-cli/`, ignoring agent auto-detection.
5. `hlx skill install` refuses to overwrite an existing destination unless `--force` is passed. Refusal exits non-zero with no destination modifications.

## Failure Behavior
- If the bundled skill files are missing from the installed CLI package (corrupt install), every `hlx skill` form must exit non-zero with a clear message that includes a reinstall instruction (`npm install -g @projectxinnovation/helix-cli@latest`).
- If `hlx skill install` fails partway through copying (file system error after creating the destination directory), it must not leave the destination in a half-populated state. Either the install completes fully or the partial destination is removed before exit.

## Acceptance Criteria
1. The published `@projectxinnovation/helix-cli` tarball contains the canonical skill files (`SKILL.md` and `references/`) bundled as static assets, reachable from the installed package on disk.
2. `hlx skill show` on a freshly npm-installed CLI prints non-empty content that includes the bundled `SKILL.md` content verbatim.
3. `hlx skill install` with only `~/.claude/skills/` present installs to `~/.claude/skills/hlx-cli/`, and the installed files match the bundled files byte-for-byte.
4. `hlx skill install` with both `~/.claude/skills/` and `~/.codex/skills/` present exits non-zero, the destination is not modified, and the error message contains the substring `--for`.
5. `hlx skill install` against a pre-existing destination without `--force` exits non-zero with no changes to the destination.
6. `hlx skill install --target <path>` writes to `<path>/hlx-cli/` regardless of which agent skills directories exist.
7. Negative: removing the bundled skill files from a global install and then running `hlx skill show` exits non-zero with a message that includes a reinstall instruction.
8. Negative: simulating a copy failure mid-install leaves no half-populated destination on disk.

## Attachments
- (none)

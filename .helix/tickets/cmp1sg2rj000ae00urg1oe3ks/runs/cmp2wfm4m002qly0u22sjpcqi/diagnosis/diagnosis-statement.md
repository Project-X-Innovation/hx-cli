# Diagnosis Statement — helix-cli

## Problem Summary

The helix-cli repository must provide a canonical documentation content source that the helix-global-client front-end consumes. Currently, the repo has zero documentation artifacts — no README, no docs/ directory, no content files. The only existing command reference is the `usage()` string in `src/index.ts`.

## Root Cause Analysis

The absence is straightforward: no documentation content file was ever created. The CLI source code contains all the information needed to write accurate documentation (commands, flags, behaviors), but that information exists only as scattered implementation details across source files, not as a consumable documentation artifact.

To make the content importable by helix-global-client:
1. A TypeScript content module (`src/docs/cli-content.ts`) must be created, exporting structured documentation data.
2. A `package.json` `exports` map entry must be added so the compiled output at `dist/docs/cli-content.js` is importable via `@projectxinnovation/helix-cli/docs`.

No changes to the `files` array are needed — `dist/` is already published. The `declaration: true` tsconfig setting ensures type declarations are generated automatically.

### Verified Command Inventory

All commands required by the ticket acceptance criteria have been verified against source code:

| Command | Source | Key Flags |
|---------|--------|-----------|
| `hlx tickets list` | `src/tickets/list.ts` | `--search`, `--user`, `--status`, `--status-not-in`, `--archived`, `--sprint`, `--json` |
| `hlx tickets get <ref>` | `src/tickets/get.ts` | `--json`; accepts internal ID, short ID (BLD-339), or number (339) |
| `hlx tickets create` | `src/tickets/create.ts` | `--title`, `--description` / `--description-file` (mutually exclusive), `--repos`, `--mode` (AUTO\|BUILD\|FIX\|RESEARCH\|EXECUTE) |
| `hlx tickets artifacts <ref>` | `src/tickets/artifacts.ts` | `--run` |
| `hlx tickets continue <ref>` | `src/tickets/continue.ts` | `--dry-run`; requires continuation context string |
| `hlx tickets update-description <ref>` | `src/tickets/update-description.ts` | `--file` / `--text` (mutually exclusive) |
| `hlx inspect repos` | `src/inspect/repos.ts` | (none) |
| `hlx comments post` | `src/comments/post.ts` | `--ticket` |
| `hlx login <url>` | `src/login.ts` | `--manual` for API key entry |
| `hlx update` | `src/update/index.ts` | `--enable-auto`, `--disable-auto` |
| `hlx token add` | `src/token/index.ts` | `--token`, `--url`, `--name`, `--current` |
| `hlx org` | `src/org/` | `current`, `list`, `switch` subcommands |

## Evidence Summary

| Evidence | Location | Finding |
|----------|----------|---------|
| No documentation files | `ls` repo root | Only package.json, tsconfig.json, src/, node_modules/ |
| Files field | `package.json` lines 18-21 | `["dist", ...]` — dist/ published, no docs/ directory needed |
| Declarations enabled | `tsconfig.json` line 12 | `declaration: true` — .d.ts auto-generated |
| Public package | `package.json` line 27 | `publishConfig.access: "public"` |
| No exports map | `package.json` | No `exports` field — needs adding |
| Usage string | `src/index.ts` lines 35-55 | Only existing command reference |
| Config location | `src/lib/config.ts` line 37-38 | `~/.hlx/config.json` — needed for troubleshooting section |
| Auth methods | `src/login.ts` | OAuth browser flow + `--manual` API key entry |
| Auto-update | `src/update/index.ts` lines 60-61 | Skips for --version, -v, update, --help, -h |

## Success Criteria

1. `src/docs/cli-content.ts` exists and exports structured documentation data covering install, auth, commands, worked examples, and troubleshooting.
2. `package.json` has `exports: { "./docs": { ... } }` pointing to the compiled output.
3. The content module is a pure data module with no Node-specific imports (no `fs`, `path`, etc.) so it can be bundled by Vite for the browser.
4. All documented commands and flags match the verified source code inventory above.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements | Canonical content in helix-cli, consumed by helix-global-client, build-fail-on-missing |
| `scout/reference-map.json` (helix-cli) | Package structure and command inventory | Only dist/ published, 7 command groups, all required flags identified |
| `scout/scout-summary.md` (helix-cli) | Publishing config and auth flow | Public npm, OAuth + manual login, config at ~/.hlx/config.json |
| `package.json` | npm publishing configuration | files, publishConfig, no exports field |
| `tsconfig.json` | Build output configuration | declaration: true, outDir: dist, rootDir: src |
| CLI source files | Verify exact command flags | All required commands confirmed with precise flag names and behaviors |

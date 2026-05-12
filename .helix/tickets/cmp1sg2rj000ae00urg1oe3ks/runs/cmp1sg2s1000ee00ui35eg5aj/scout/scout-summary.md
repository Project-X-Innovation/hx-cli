# Scout Summary — helix-cli

## Problem

The helix-cli repository must provide a canonical documentation content source that the `helix-global-client` front-end consumes at build or render time. Currently, no documentation file or directory exists in this repo. The npm package (`@projectxinnovation/helix-cli@1.3.2`) only publishes compiled `dist/` files. A new content source must be created and published so the front-end can import it.

## Analysis Summary

### Current State

The repository is a pure TypeScript CLI tool with no existing documentation artifacts:
- **No README.md** at repo root
- **No docs/ directory**
- **No HELIX_CLI_NOTES.md** (mentioned in ticket as historical — not currently present)
- The only command reference is the `usage()` string in `src/index.ts` (lines 35-55)

### CLI Command Structure

The `hlx` binary has 7 command groups. The ticket requires worked examples for 6 specific commands:

| Required Example | Source File | Key Flags |
|---|---|---|
| `hlx tickets list` | `src/tickets/list.ts` | `--search`, `--user`, `--status`, `--status-not-in`, `--archived`, `--sprint`, `--json` |
| `hlx tickets get` | `src/tickets/get.ts` | `--json`; accepts internal ID, short ID, or ticket number |
| `hlx tickets create` | `src/tickets/create.ts` | `--title`, `--description` or `--description-file`, `--repos`, `--mode` |
| `hlx tickets artifacts` | `src/tickets/artifacts.ts` | `--run` |
| `hlx inspect repos` | `src/inspect/repos.ts` | (no flags) |
| `hlx comments post` | `src/comments/post.ts` | `--ticket` |

Additional high-value patterns mentioned: `update-description`, `continue --dry-run`, `hlx update`.

### npm Package Publishing

- `files` field: `["dist", "!dist/**/*.test.js", "!dist/**/*.test.d.ts"]`
- `publishConfig`: `{ "access": "public", "provenance": true, "registry": "https://registry.npmjs.org" }`
- To publish a canonical docs content file to npm, the `files` array must be extended (e.g., add `"docs"`) or the content must be generated into `dist/`.

### Build & Quality Gates

- `npm run build` → `tsc`
- `npm run typecheck` → `tsc --noEmit`
- `npm run test` → `tsc && node --test dist/**/*.test.js`
- `npm run prepare` → `npm run build` (runs before `npm publish`)

### Authentication & Config

- OAuth login: `hlx login <server-url>` opens browser
- Manual token: `hlx login --manual` or `hlx token add`
- Config stored at `~/.hlx/config.json`
- Multi-org support: `hlx org current`, `hlx org list`, `hlx org switch`

## Relevant Files

| File | Role |
|------|------|
| `package.json` | Package metadata — name, version, bin, files, scripts, publishConfig |
| `src/index.ts` | Entry point — command router and usage string |
| `src/tickets/list.ts` | `hlx tickets list` implementation and flags |
| `src/tickets/get.ts` | `hlx tickets get` implementation and flags |
| `src/tickets/create.ts` | `hlx tickets create` implementation and flags |
| `src/tickets/artifacts.ts` | `hlx tickets artifacts` implementation and flags |
| `src/tickets/continue.ts` | `hlx tickets continue` with `--dry-run` |
| `src/tickets/update-description.ts` | `hlx tickets update-description` with `--file`/`--text` |
| `src/inspect/repos.ts` | `hlx inspect repos` implementation |
| `src/comments/post.ts` | `hlx comments post` implementation and flags |
| `src/login.ts` | Authentication flow — OAuth and manual |
| `src/update/index.ts` | `hlx update` and auto-update logic |
| `src/lib/config.ts` | Config storage at `~/.hlx/config.json` |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement and acceptance criteria | Canonical content source must live in helix-cli; front-end consumes it; build fails if missing |
| `package.json` | Package publishing configuration | Only `dist/` is published to npm; `files` field needs extension for docs content |
| `src/index.ts` | Authoritative command tree | 7 command groups: login, token, org, tickets, inspect, comments, update |
| `src/tickets/create.ts` | Validate command flags for docs accuracy | Modes: AUTO, BUILD, FIX, RESEARCH, EXECUTE; requires --title, --description/--description-file, --repos |
| `src/login.ts` | Authentication flow details | OAuth browser flow + manual API key entry |
| `src/lib/config.ts` | Config file location for troubleshooting section | `~/.hlx/config.json` stores credentials and org tokens |

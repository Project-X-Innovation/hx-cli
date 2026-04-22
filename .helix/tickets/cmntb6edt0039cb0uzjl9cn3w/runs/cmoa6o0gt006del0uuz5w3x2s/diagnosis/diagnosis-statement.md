# Diagnosis Statement — HLX-207

## Problem Summary

The `helix-cli` repository (`@projectxinnovation/helix-cli`) is a functional internal CLI for Helix production inspection, but it lacks three categories of capability requested by the ticket:

1. **No documentation** — No `README.md` exists. A new engineer cannot discover install instructions, auth flow, or command reference without reading source code.
2. **No CI/CD for publishing** — No `.github/` directory exists at all. There is no automated npm publish workflow, meaning publishes are manual and error-prone. The `dist/` directory is gitignored and must be built before publish.
3. **No artifact retrieval** — No `artifacts` command or artifact-fetching logic exists. The CLI currently supports only `login`, `inspect`, and `comments`.

Additionally, there is a **version drift defect**: `package.json` declares version `1.2.0` but `src/index.ts` line 47 hardcodes `"0.1.0"` for the `--version` output.

## Root Cause Analysis

This ticket describes feature gaps and a code defect, not a regression:

- **README gap**: The CLI was built as an internal tool and documentation was never added.
- **CI gap**: No `.github/` directory was ever created. Publishing was presumably manual.
- **Artifact retrieval gap**: The capability was never implemented. No artifact-related code, API routes, or types exist in the codebase.
- **Version drift**: The `--version` handler was written with a hardcoded string (`"0.1.0"`) and was never updated when `package.json` version was bumped to `1.2.0`. The version should be derived from `package.json` at build time or runtime rather than hardcoded.

### Architectural Decision: Artifact Command Pattern

All existing authenticated commands follow a consistent thin-client pattern:
```
requireConfig() → hxFetch(config, path, opts) → display result
```

The CLI sends all requests to the Helix backend server (configured via `HELIX_URL` or `~/.hlx/config.json`). It never calls external APIs (GitHub, Vercel) directly. The HTTP client (`src/lib/http.ts`) supports configurable `basePath` — inspect commands use `/api/inspect`, comments use `/api`.

**Recommendation**: Artifact commands should follow this same pattern, routing through the Helix backend. This:
- Keeps the CLI as a thin client (consistent architecture)
- Avoids requiring users to configure separate GitHub/Vercel tokens
- Lets the backend handle credential management and API integration
- Maintains the zero-runtime-dependency property of the CLI

The backend API endpoints for artifacts are **assumed to exist or be created separately** — this is an unknown the implementation plan must address. If backend endpoints don't exist yet, the CLI should be designed with clear API contracts so the backend can be built to match.

### Publish Workflow Decision

The ticket asks whether publishing should happen on every push to `main` or only on version bumps. Given:
- No tests exist (risk of publishing broken code)
- The typecheck script is the only available validation gate
- Version bumps are an explicit, intentional signal

**Recommendation**: Publish only when the version in `package.json` changes. This is safer and more intentional. The workflow should: install → build → typecheck → publish, using an `NPM_TOKEN` secret.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| `package.json` version field | `"1.2.0"` |
| `src/index.ts` line 47 | Hardcoded `console.log("0.1.0")` — confirmed version drift |
| Repo root `ls` | No `README.md` present |
| `.github/` directory check | Does not exist — no CI/CD whatsoever |
| `src/index.ts` switch statement (lines 28-53) | Only routes: login, inspect, comments, --version |
| `src/lib/http.ts` `hxFetch()` | All API calls go through Helix backend; no direct external API calls |
| `package.json` `files` field | `["dist"]` — only dist/ is published to npm |
| `.gitignore` | `dist/` is ignored — must be built before publish |
| `package.json` `devDependencies` | Only `@types/node` and `typescript` — zero runtime deps |
| `package.json` `engines` | `"node": ">=18"` required for native fetch |
| `tsconfig.json` | Compiles `src/` → `dist/`, ES2022 target, Node16 module resolution |

## Success Criteria

1. A `README.md` exists at repo root covering: what the CLI does, npm install, Node version, auth flow, env var/config file setup, full command reference with examples, artifact retrieval examples, and maintainer publish notes.
2. A `.github/workflows/publish.yml` exists that builds and publishes to npm when the version in `package.json` changes on `main`.
3. The version drift is fixed — `--version` output matches `package.json`.
4. New `src/artifacts/` module with command router and subcommands for `ticket` and `run` lookups.
5. Artifact commands follow the existing `hxFetch` pattern with appropriate basePath.
6. Artifact commands support `--source` flag for filtering by github/vercel.
7. Artifact commands return clear errors for missing artifacts or missing credentials.
8. The `src/index.ts` command router is updated to include the `artifacts` command.

### Scope

- **Files to create**: `README.md`, `.github/workflows/publish.yml`, `src/artifacts/index.ts`, `src/artifacts/ticket.ts`, `src/artifacts/run.ts`
- **Files to modify**: `src/index.ts` (add artifacts command routing, fix version drift)
- **Files unchanged**: All existing command modules (`inspect/`, `comments/`, `lib/`, `login.ts`) — no behavioral changes to existing commands.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand full scope, acceptance criteria, and open decisions | Three workstreams: README, CI publish, artifact retrieval; version drift needs fixing |
| scout/reference-map.json | Get structured map of all files and their roles, confirmed facts and unknowns | 13 source files, version drift confirmed, zero deps/tests/CI, hxFetch is the HTTP pattern |
| scout/scout-summary.md | Cross-check scout analysis and verify completeness | Confirmed architecture pattern, version drift, and key decisions needed |
| package.json (direct read) | Verify version, npm config, scripts, deps | v1.2.0, scoped package, bin→dist/index.js, files→[dist], ESM, Node≥18 |
| src/index.ts (direct read) | Verify version drift, command router structure | Line 47 hardcodes "0.1.0", switch routes 4 commands |
| src/lib/http.ts (direct read) | Understand HTTP client for artifact command design | hxFetch with configurable basePath, auth via apiKey, retry/backoff |
| src/lib/config.ts (direct read) | Understand auth/config model for README documentation | Env vars (HELIX_API_KEY, HELIX_URL) or ~/.hlx/config.json |
| src/comments/index.ts (direct read) | Understand command pattern for new artifacts module | getFlag/switch pattern, resolveTicketId from --ticket or env var |
| src/inspect/index.ts (direct read) | Understand subcommand routing pattern | getFlag/getPositionalArgs helpers, switch-based routing |
| All remaining src/ files (direct reads) | Complete architecture understanding | Consistent thin-client pattern across all commands |

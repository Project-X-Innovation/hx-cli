# Scout Summary — HLX-207: Improve helix-cli packaging, documentation, and artifact retrieval

## Problem

The `helix-cli` repo (`@projectxinnovation/helix-cli`) is a functional but minimally packaged internal CLI. It lacks a README, has no CI/CD workflow for npm publishing, has no artifact retrieval capability, and has confirmed version drift between `package.json` (1.2.0) and the hardcoded `--version` output in source (0.1.0).

## Analysis Summary

### Current State
- **13 source files** in `src/` organized into `inspect/`, `comments/`, `lib/`, plus top-level `index.ts` and `login.ts`.
- **3 command groups**: `login`, `inspect` (repos/db/logs/api), `comments` (list/post).
- **Zero runtime dependencies** — uses only Node builtins and native `fetch` (requires Node ≥18).
- **Build**: TypeScript compiles `src/` → `dist/` via `tsc`. Typecheck passes cleanly.
- **No tests** of any kind exist.
- **No CI** — no `.github/` directory at all.
- **No README**.

### Version Drift
- `package.json` declares version `1.2.0`.
- `src/index.ts` line 47 hardcodes `console.log("0.1.0")` for `--version`.
- These must be reconciled; ideally the version should be read from `package.json` or injected at build time.

### Architecture Pattern (for artifact commands)
- All authenticated commands follow the same pattern: `requireConfig()` → `hxFetch(config, path, options)` → `console.log(JSON.stringify(result))`.
- The HTTP client (`src/lib/http.ts`) sends requests to the Helix backend server with retry/backoff. It does **not** call GitHub or Vercel APIs directly.
- `hxFetch` supports configurable `basePath` (default `/api/inspect`; comments use `/api`).
- Arg parsing is hand-rolled (no commander/yargs); new commands follow the `getFlag`/switch pattern.

### Key Decisions Needed (not for scout to resolve)
1. Should artifact commands call GitHub/Vercel APIs directly or go through the Helix backend (consistent with current pattern)?
2. Should npm publish trigger on every push to `main` or only on version changes?
3. What npm token/secret name should the GitHub Actions workflow use?

## Relevant Files

| File | Role |
|------|------|
| `package.json` | Package metadata, npm config, scripts (build/typecheck), bin entry |
| `tsconfig.json` | TypeScript build configuration (src → dist) |
| `.gitignore` | Ignores node_modules/ and dist/ |
| `src/index.ts` | CLI entrypoint, command router, hardcoded version string |
| `src/lib/config.ts` | Auth config: env vars + ~/.hlx/config.json |
| `src/lib/http.ts` | HTTP client with retry, auth headers, configurable basePath |
| `src/lib/resolve-repo.ts` | Repository name/ID resolution via backend API |
| `src/login.ts` | Browser-based OAuth + manual login flow |
| `src/inspect/index.ts` | Inspect command router (repos/db/logs/api) |
| `src/inspect/repos.ts` | List repos with inspection types |
| `src/inspect/db.ts` | SQL query via backend |
| `src/inspect/logs.ts` | Log query via backend |
| `src/inspect/api.ts` | API inspection via backend |
| `src/comments/index.ts` | Comments command router (list/post) |
| `src/comments/list.ts` | List ticket comments with filters |
| `src/comments/post.ts` | Post comment to ticket |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand ticket scope and acceptance criteria | Three workstreams: README, CI publish workflow, artifact retrieval commands |
| package.json | Determine package identity, version, build/publish config | Scoped package @projectxinnovation/helix-cli v1.2.0, bin → dist/index.js, files → [dist] |
| src/index.ts | Map CLI entrypoint and command structure | Hardcoded version 0.1.0 (drift), switch-based command router, no artifacts command exists |
| src/lib/config.ts | Understand auth/config model for documentation | Env vars or ~/.hlx/config.json, HxConfig type |
| src/lib/http.ts | Understand HTTP/API pattern for new commands | All calls go through Helix backend, not direct to external APIs; configurable basePath |
| .gitignore | Confirm dist/ is not committed | dist/ must be built before npm publish |
| tsconfig.json | Confirm build pipeline | tsc compiles src/ → dist/ with declarations |

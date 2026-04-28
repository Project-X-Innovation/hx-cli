# Diagnosis Statement — HLX-316: Add GitHub main self-update and auto-update to helix-cli

## Problem Summary

helix-cli needs a self-update mechanism sourced from GitHub `main` (not npm registry). Three capabilities must be added: (1) an explicit `hlx update` command, (2) a persisted `autoUpdate` setting with enable/disable commands, and (3) an auto-update check before every CLI invocation when enabled. Additionally, `hlx --version` is broken — it outputs a hardcoded `"0.1.0"` while `package.json` declares `"1.2.0"`.

## Root Cause Analysis

This ticket is primarily a **greenfield feature addition** with one pre-existing bug. There are four root-cause issues that must be addressed:

### 1. Version Drift Bug (pre-existing)

**Root cause**: `src/index.ts:47` contains `console.log("0.1.0")` — a hardcoded string literal that was never updated when the package version changed. `package.json` declares `"1.2.0"`.

**Fix**: Replace the hardcoded string with a runtime read of `package.json` version. In the ES module context (`"type": "module"` in package.json, `"module": "Node16"` in tsconfig), the recommended approach is `readFileSync` with path resolution relative to `import.meta.url` using `fileURLToPath` from `node:url`.

### 2. Lossy Config System (blocking for new features)

**Root cause**: `saveConfig()` in `src/lib/config.ts:35-38` serializes the entire config as `JSON.stringify(config)` where `config` is typed as `HxConfig = { apiKey: string; url: string }`. This overwrites the entire file with only those two fields, destroying any additional fields.

**Impact**: Any new fields (`autoUpdate`, update-source metadata) would be silently destroyed whenever `saveConfig()` is called — which happens during `hlx login` (src/login.ts:38, 107).

**Fix**: 
- Extend `HxConfig` type to include optional `autoUpdate`, `installSource`, and related update metadata fields.
- Modify `saveConfig` to read-merge-write: read existing config, overlay new values, write back. This preserves fields not being updated.
- Alternatively, separate the save logic into partial-update helpers.

### 3. No Update Infrastructure (greenfield)

**Root cause**: Zero update-related code exists. No `src/update/` directory, no GitHub API integration, no install-mode detection, no commit SHA tracking. The entire update feature must be built from scratch.

**Required new components**:
- **GitHub SHA check**: Fetch latest commit SHA from `https://api.github.com/repos/Project-X-Innovation/helix-cli/commits/main` (REST API) or via `git ls-remote https://github.com/Project-X-Innovation/helix-cli.git refs/heads/main` (shell command). Both are viable; the REST API approach uses the existing `fetch` global and avoids a git binary dependency, but has a 60-req/hr unauthenticated rate limit. The `git ls-remote` approach has no rate limit but requires git.
- **Self-update mechanism**: Execute `npm install -g github:Project-X-Innovation/helix-cli` via `child_process.execSync`. This installs directly from the GitHub repo's `main` branch tarball without using the npm registry.
- **Install-mode detection**: Persist install-source metadata in `~/.hlx/config.json` on first update or setup. Check `installSource.repo` and `installSource.branch` to verify canonical install before allowing self-update.
- **Loop prevention**: Use an environment variable flag (e.g., `HLX_SKIP_UPDATE_CHECK=1`) to prevent recursive update checks if the updated CLI re-executes itself.

### 4. HTTP Client Not Reusable for GitHub (architectural constraint)

**Root cause**: `hxFetch` in `src/lib/http.ts:52-57` unconditionally attaches Helix-specific auth headers (`X-API-Key` or `Authorization: Bearer`). It requires an `HxConfig` parameter. GitHub API calls for a public repo should be unauthenticated.

**Fix**: Do not modify `hxFetch`. Use the global `fetch()` (available in Node >=18, which is the minimum engine requirement per `package.json:13-15`) directly for GitHub API calls within the new update module. This keeps concerns separated and avoids coupling update logic to Helix auth.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| `src/index.ts:47` | `console.log("0.1.0")` — hardcoded, drifted from package.json |
| `package.json:3` | `"version": "1.2.0"` — actual package version |
| `src/lib/config.ts:5-8` | `HxConfig = { apiKey: string; url: string }` — only two fields |
| `src/lib/config.ts:35-38` | `saveConfig` overwrites entire file with only HxConfig fields |
| `src/login.ts:38,107` | Calls `saveConfig({ apiKey, url })` — would destroy new fields |
| `src/lib/http.ts:52-57` | `hxFetch` attaches Helix auth headers — not reusable for GitHub |
| `package.json:4` | `"type": "module"` — ES module context, affects version reading |
| `package.json:13-15` | `"engines": { "node": ">=18" }` — global fetch() available |
| `tsconfig.json:3-5` | `"module": "Node16"` — ES module resolution |
| `src/login.ts:3` | `import { exec } from "node:child_process"` — precedent for shell exec |
| `src/` directory listing | 13 .ts files, zero update-related files — entirely greenfield |
| `.gitignore` | `dist/` and `node_modules/` ignored — confirms no committed artifacts |
| Scout reference-map | No helix-global-server scout artifacts — confirms server is context-only |

## Success Criteria

1. `hlx --version` reads version from `package.json` at runtime and outputs `"1.2.0"` (current package version).
2. `hlx update` checks GitHub `main` HEAD commit SHA vs local installed SHA, reports "already current" or performs update.
3. `autoUpdate` can be enabled/disabled via command surface (e.g., `hlx config set autoUpdate true/false`), persists in `~/.hlx/config.json`, and round-trips without destroying `apiKey` or `url`.
4. With `autoUpdate` enabled, CLI invocations perform one GitHub `main` HEAD check before executing the requested command.
5. Install-mode detection prevents self-update for unrecognized installs (not from canonical GitHub `main`).
6. No infinite self-update loops: at most one update check and one update attempt per invocation.
7. Network/API failures produce clear error messages; do not corrupt install or config.
8. All changes are scoped to `helix-cli`; `helix-global-server` requires no modifications.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Primary specification with requirements, constraints, acceptance criteria | All changes scoped to helix-cli; update source is GitHub main commit SHA; autoUpdate persisted in ~/.hlx/config.json; no npm/server checks |
| scout/reference-map.json (helix-cli) | Identified all relevant files, confirmed facts, and cataloged unknowns | Version drift confirmed (0.1.0 vs 1.2.0); config system is lossy; no update infrastructure exists; HTTP client not reusable for GitHub |
| scout/scout-summary.md (helix-cli) | High-level analysis of current state and boundaries | helix-cli is primary repo; helix-global-server is context-only; 7 key boundaries identified including lossy config and ES module context |
| src/index.ts | Direct inspection of CLI entry point and version output | Confirmed hardcoded "0.1.0" at line 47; switch-based dispatcher at lines 28-53; no update command case |
| src/lib/config.ts | Direct inspection of config type and save logic | Confirmed HxConfig has only {apiKey, url}; saveConfig overwrites entire file; loadConfig reads from env vars or file |
| src/lib/http.ts | Direct inspection of HTTP client | Confirmed Helix-specific auth headers; not reusable for GitHub API; retry logic pattern is reference material |
| package.json | Package metadata and build configuration | version=1.2.0; type=module; engines node>=18; no runtime deps; bin entry hlx=dist/index.js |
| tsconfig.json | TypeScript build configuration | module=Node16; strict=true; outDir=dist; rootDir=src; new files under src/ auto-included |
| src/login.ts | Reference for exec and saveConfig usage patterns | child_process.exec precedent; saveConfig called with only {apiKey, url} — confirms field-loss risk |
| .gitignore | Repo boundary verification | dist/ and node_modules/ ignored; confirms no committed build artifacts |
| /tmp/helix-inspect/manifest.json | Runtime inspection availability | Only helix-global-server has inspection (DATABASE, LOGS) — not relevant to CLI-only ticket |

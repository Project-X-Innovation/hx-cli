# Scout Summary — HLX-316: Add GitHub main self-update and auto-update to helix-cli

## Problem

helix-cli needs a self-update mechanism sourced from GitHub `main` branch (not npm registry). Three capabilities are required: (1) an explicit `hlx update` command, (2) a persisted `autoUpdate` setting that triggers an update check before every CLI invocation, and (3) local metadata to track install origin and current commit SHA. Additionally, the version reporting is broken — `hlx --version` outputs a hardcoded `"0.1.0"` while `package.json` declares `"1.2.0"`.

## Analysis Summary

### Current State

The helix-cli is a small TypeScript CLI (~10 source files) with zero runtime dependencies, no tests, no CI, and no documentation. The command dispatcher in `src/index.ts` uses a top-level `switch` statement. The config system in `src/lib/config.ts` manages `~/.hlx/config.json` with a two-field type (`apiKey`, `url`). The HTTP client in `src/lib/http.ts` is tightly coupled to Helix server authentication and cannot be reused for GitHub API calls.

### Key Boundaries Identified

1. **Version drift (confirmed bug)**: `src/index.ts:47` hardcodes `"0.1.0"` while `package.json` version is `"1.2.0"`. The ticket explicitly requires fixing this to use package metadata.

2. **Config system is lossy**: `saveConfig()` in `src/lib/config.ts:35-38` writes only `{apiKey, url}` to the config file, destroying any other fields. Adding `autoUpdate` and update metadata to `~/.hlx/config.json` requires modifying both the type definition and the save logic to preserve existing fields.

3. **No update infrastructure exists**: There is no `src/update/` directory, no update command, no GitHub API integration, no install-mode detection, and no commit SHA tracking. Everything must be built from scratch.

4. **HTTP module is not reusable for GitHub**: `hxFetch` sends Helix-specific auth headers (`X-API-Key` or `Authorization: Bearer`). GitHub API calls for a public repo are unauthenticated — a separate fetch mechanism is needed.

5. **ES module context affects runtime introspection**: The project uses `"type": "module"`. Reading the package version at runtime requires ES module-compatible approaches (e.g., `createRequire` from `node:module`, or `fs.readFileSync` relative to `import.meta.url`). Standard `require('./package.json')` will not work.

6. **Auto-update hook insertion point**: The main dispatcher in `src/index.ts:27-53` needs a pre-command check point. The `try/catch` block with `switch` statement is the only entry point — the auto-update check must be inserted before the `switch` executes.

7. **No test or CI infrastructure**: There are no existing tests or CI workflows. The ticket calls for targeted tests for update/config/version behavior, which will be net-new.

### Repo Topology

- **helix-cli**: Primary and only repo requiring changes. All ticket work is contained here.
- **helix-global-server**: Context-only. Has no CLI version endpoints, no update-related APIs. The only CLI-related code is an `/auth/cli` OAuth redirect endpoint for login, which is unrelated to this ticket.

## Relevant Files

| File | Role | Impact |
|------|------|--------|
| `src/index.ts` | CLI entry point / command dispatcher | Must add `update` command, auto-update hook, fix version output |
| `src/lib/config.ts` | Config load/save/type definition | Must expand HxConfig type, fix saveConfig to preserve fields |
| `src/lib/http.ts` | HTTP client (Helix-auth only) | May need minimal extension or sibling for unauthenticated GitHub fetch |
| `package.json` | Package metadata, scripts, bin entry | Source of truth for display version; may need test script addition |
| `tsconfig.json` | TypeScript build config | New src/update/* files auto-included via `"include": ["src"]` |
| `src/login.ts` | Login command (reference pattern) | Uses child_process.exec — precedent for shell exec in the codebase |
| `.gitignore` | Ignored paths (dist/, node_modules/) | Confirms dist/ not committed; update must not write state to repo |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification for all requirements, constraints, and acceptance criteria | Commit SHA is update identity; autoUpdate persisted in ~/.hlx/config.json; no npm or server checks; must fix version drift |
| src/index.ts | CLI entry point containing command dispatcher and version output | Version hardcoded to "0.1.0" (drift); switch-based dispatcher needs update command case and pre-command auto-update hook |
| src/lib/config.ts | Config management module | HxConfig type has only {apiKey, url}; saveConfig overwrites entire file — will lose new fields; config path is ~/.hlx/config.json |
| src/lib/http.ts | HTTP client module | Tightly coupled to Helix auth; not reusable for GitHub API; retry logic pattern is reusable reference |
| package.json | Package identity and scripts | version=1.2.0 (drifted from CLI output); type=module; no runtime deps; build=tsc; typecheck=tsc --noEmit; no test script |
| tsconfig.json | Build config boundaries | strict=true; ES2022 target; Node16 modules; src/ auto-includes new files |
| src/login.ts | Command pattern reference | Uses child_process.exec precedent; demonstrates saveConfig usage that would lose new fields |
| .gitignore | Repo boundary | dist/ and node_modules/ ignored; confirms no committed build artifacts |

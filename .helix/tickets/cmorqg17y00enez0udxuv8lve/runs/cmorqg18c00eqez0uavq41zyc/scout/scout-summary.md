# Scout Summary — BLD-375: Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Problem

The `@projectxinnovation/helix-cli` package needs to be published to npm using Trusted Publishing with GitHub Actions OIDC. Currently: no CI/CD workflows exist, `package.json` is missing the `repository` metadata required for Trusted Publishing, and the entire `hlx update` mechanism installs from GitHub directly (`npm install -g github:...`). A previous broken install where `dist/index.js` was missing motivates adding tarball validation before publish.

## Analysis Summary

### Current State

The repo is a pure TypeScript CLI with no runtime dependencies. Build (`tsc`) and tests (30/30 via `node:test`) both pass cleanly. The `files: ["dist"]` field correctly limits published content. The `bin` field maps `hlx` -> `dist/index.js` (which has the correct shebang). No `.github` directory exists at all — the publish workflow must be created from scratch.

### Gaps Identified

1. **No `repository` field in `package.json`** — npm Trusted Publishing requires this to match the GitHub repo URL exactly (`https://github.com/Project-X-Innovation/helix-cli.git`).

2. **No `.github/workflows/publish.yml`** — the primary deliverable. No CI infrastructure exists to build on.

3. **Update mechanism is GitHub-direct** — `src/update/perform.ts` runs `npm install -g github:Project-X-Innovation/helix-cli#main`. `src/update/check.ts` uses `git ls-remote` to compare commit SHAs. The `InstallSource` type in `src/lib/config.ts` only supports `mode: "github" | "unknown"`.

4. **Test files included in tarball** — `npm pack --dry-run` shows `dist/lib/flags.test.js` and `dist/lib/resolve-ticket.test.js` (and their `.d.ts` companions) in the published package. These are unnecessary for installed CLI users.

5. **No README** — npm packages typically include a README for the registry page.

### What Already Works

- `files: ["dist"]` correctly scopes the published package
- `bin.hlx` -> `dist/index.js` entrypoint contract is correct
- `dist/index.js` has `#!/usr/bin/env node` shebang
- `version.ts` reads `../../package.json` relative to `dist/update/version.js` — this path resolves correctly whether installed from GitHub or npm since `package.json` is included in the tarball
- `validate.ts` already checks `dist/index.js` existence and runs a version smoke test — this logic pattern is reusable for workflow pack validation
- Zero runtime dependencies keeps the publish clean

### Boundary Files

| Area | Files | Current State |
|------|-------|---------------|
| Publish workflow | `.github/workflows/publish.yml` | Does not exist |
| Package metadata | `package.json` | Missing `repository`, no `publishConfig` |
| Update: version check | `src/update/check.ts` | Uses `git ls-remote` + commit SHA comparison |
| Update: install | `src/update/perform.ts` | Uses `npm install -g github:...` |
| Update: orchestration | `src/update/index.ts` | Saves `mode: "github"` metadata |
| Update: validation | `src/update/validate.ts` | Checks dist/index.js + version — reusable pattern |
| Config types | `src/lib/config.ts` | `InstallSource.mode` = `"github" \| "unknown"` |
| CLI entrypoint | `src/index.ts` | Help text references "GitHub main" |
| Build config | `tsconfig.json` | ES2022, Node16, outDir=dist |

## Relevant Files

- `package.json` — needs `repository` field; defines bin, files, scripts, version
- `.github/workflows/publish.yml` — new file; the publish workflow
- `src/update/check.ts` — constants and SHA-based version checking to migrate
- `src/update/perform.ts` — GitHub-direct install to migrate to npm
- `src/update/index.ts` — update orchestration referencing GitHub mode
- `src/update/validate.ts` — post-install validation (reusable pattern)
- `src/update/version.ts` — runtime version reading (verify npm compat)
- `src/lib/config.ts` — InstallSource type to extend with "npm" mode
- `src/index.ts` — CLI entrypoint and help text
- `tsconfig.json` — build configuration
- `.gitignore` — confirms dist/ is gitignored (must be built in workflow)
- `package-lock.json` — dependency lock for reproducible CI builds
- `src/lib/flags.test.ts` — test file compiled into dist/ (tarball bloat)
- `src/lib/resolve-ticket.test.ts` — test file compiled into dist/ (tarball bloat)

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and acceptance criteria | Defines exact requirements: OIDC publish, pack validation, repository metadata, update path migration |
| package.json | Package configuration and publish scope | Missing `repository` field; `files: ["dist"]` is correct; `prepare` script builds on install; version 1.2.0 |
| tsconfig.json | Build configuration | Compiles src/ to dist/ with ESM output; must build before pack |
| .gitignore | File exclusion rules | dist/ is gitignored — workflow must build before publish |
| src/update/check.ts | Current version-check mechanism | Uses git ls-remote for SHA comparison; defines canonical repo constants |
| src/update/perform.ts | Current install mechanism | Hardcodes `npm install -g github:...` install spec |
| src/update/index.ts | Update orchestration | Saves installSource with mode="github"; auto-update only for canonical source |
| src/update/validate.ts | Post-install validation | Checks dist/index.js exists + runs version smoke test |
| src/update/version.ts | Runtime version reading | Uses ../../package.json relative path from dist/update/ |
| src/lib/config.ts | InstallSource type definition | mode: "github" \| "unknown" — needs "npm" variant |
| src/index.ts | CLI entrypoint | Help text references GitHub main; routes update command |
| npm pack --dry-run output | Tarball content verification | 77 files, includes test files; dist/index.js confirmed present |
| npm test output | Test suite status | 30/30 tests pass; test runner uses compiled dist files |
| npm run build output | Build verification | tsc completes cleanly with no errors |

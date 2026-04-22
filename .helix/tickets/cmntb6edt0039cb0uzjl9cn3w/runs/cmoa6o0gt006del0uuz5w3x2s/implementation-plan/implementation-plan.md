# Implementation Plan — HLX-207: Improve helix-cli packaging, documentation, and artifact retrieval

## Overview

This plan adds three capabilities and fixes one defect in the `helix-cli` repository:

1. **Version drift fix**: Replace the hardcoded `"0.1.0"` in `src/index.ts` with a runtime read from `package.json` using `createRequire`.
2. **Artifact retrieval commands**: Add `hlx artifacts ticket <id>` and `hlx artifacts run <id>` subcommands that call the Helix backend via the existing `hxFetch` thin-client pattern.
3. **Automated npm publish workflow**: Add `.github/workflows/publish.yml` that builds, typechecks, and publishes to npm only when the `package.json` version differs from the npm registry.
4. **README documentation**: Add a comprehensive `README.md` covering installation, authentication, command reference, artifact examples, and maintainer publishing notes.

Additionally, shared arg-parsing helpers (`getFlag`, `getPositionalArgs`) are extracted into `src/lib/args.ts` to eliminate duplication before adding the artifacts module.

All changes are within the `helix-cli` repository. Zero new runtime dependencies are introduced.

## Implementation Principles

- **Thin client**: Artifact commands route through the Helix backend via `hxFetch`, consistent with all existing commands. No direct GitHub/Vercel API calls from the CLI.
- **Zero new runtime dependencies**: Continue using only Node builtins and native `fetch`.
- **Hand-rolled arg parsing**: Follow the existing `getFlag`/`switch` pattern. No commander/yargs.
- **Minimal impact**: Existing commands (`login`, `inspect`, `comments`) must remain behaviorally identical.
- **Version-gated publishing**: Publish workflow triggers only when `package.json` version differs from npm registry.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Extract shared arg-parsing helpers | `src/lib/args.ts` |
| 2 | Update existing modules to use shared args | Modified `src/inspect/index.ts`, `src/comments/index.ts`, `src/comments/list.ts` |
| 3 | Create artifact subcommand modules | `src/artifacts/ticket.ts`, `src/artifacts/run.ts` |
| 4 | Create artifacts command router | `src/artifacts/index.ts` |
| 5 | Update CLI entrypoint: fix version drift + register artifacts | Modified `src/index.ts` |
| 6 | Create GitHub Actions publish workflow | `.github/workflows/publish.yml` |
| 7 | Create README documentation | `README.md` |

## Detailed Implementation Steps

### Step 1: Extract shared arg-parsing helpers into `src/lib/args.ts`

**Goal**: Consolidate duplicated `getFlag` and `getPositionalArgs` helpers into a shared module to eliminate duplication and provide a clean import for the new artifacts module.

**What to Build**:
- Create `src/lib/args.ts` exporting two functions:
  - `getFlag(args: string[], flag: string): string | undefined` — finds a flag and returns its value (identical logic to `src/inspect/index.ts` lines 7-10).
  - `getPositionalArgs(args: string[], excludeFlags: string[]): string[]` — returns non-flag arguments, excluding known flag values (identical logic to `src/inspect/index.ts` lines 12-19).
- Both functions are direct extractions of existing code, with no behavioral changes.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` passes after adding the new file.

**Success Criteria**:
- `src/lib/args.ts` exports `getFlag` and `getPositionalArgs`.
- TypeScript compiles without errors.

---

### Step 2: Update existing modules to import from shared args

**Goal**: Replace local `getFlag` and `getPositionalArgs` definitions in existing modules with imports from `src/lib/args.ts`.

**What to Build**:
- **`src/inspect/index.ts`**: Remove the local `getFlag` (lines 7-10) and `getPositionalArgs` (lines 12-19) definitions. Add `import { getFlag, getPositionalArgs } from "../lib/args.js";` at the top.
- **`src/comments/index.ts`**: Remove the local `getFlag` (lines 5-8) definition. Add `import { getFlag } from "../lib/args.js";` at the top.
- **`src/comments/list.ts`**: Remove the local `getFlag` (lines 15-18) definition. Add `import { getFlag } from "../lib/args.js";` at the top.
- No behavioral changes to any existing command.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` passes after the refactor.
- `npm run build && node dist/index.js --version` still outputs `0.1.0` (proving existing behavior preserved, version fix is step 5).

**Success Criteria**:
- No local `getFlag` or `getPositionalArgs` definitions remain in `src/inspect/index.ts`, `src/comments/index.ts`, or `src/comments/list.ts`.
- All three files import from `../lib/args.js`.
- Typecheck passes.

---

### Step 3: Create artifact subcommand modules

**Goal**: Implement the two artifact retrieval subcommands that call the Helix backend via `hxFetch`.

**What to Build**:

#### `src/artifacts/ticket.ts`
- Export `async function cmdTicket(config: HxConfig, ticketId: string, args: string[]): Promise<void>`.
- Parse optional `--source` flag using `getFlag` from `../lib/args.js`.
- Build query params: if `--source` is provided (`"github"` or `"vercel"`), include `source` in `queryParams`.
- Call `hxFetch(config, `/artifacts/tickets/${ticketId}`, { basePath: "/api", queryParams })`.
- Response type: `{ artifacts: ArtifactInfo[] }` where `ArtifactInfo` = `{ id: string; name: string; source: "github" | "vercel"; createdAt: string; sizeBytes?: number; url?: string; metadata?: Record<string, unknown> }`.
- Define the `ArtifactInfo` type locally in this file (or in a shared types location — keep it simple, define locally first since it's only used by two files).
- If `artifacts.length === 0`, print `"No artifacts found."` and return.
- Otherwise, format each artifact as: `[createdAt] [source] name  (humanized size)` — similar to comment list output.
- Handle `sizeBytes` formatting (KB/MB) with a small inline helper.

#### `src/artifacts/run.ts`
- Export `async function cmdRun(config: HxConfig, runId: string, args: string[]): Promise<void>`.
- Nearly identical to `ticket.ts` but calls `/artifacts/runs/${runId}` instead.
- Same `--source` parsing, same response type, same display format.
- Reuse the `ArtifactInfo` type — either duplicate it (it's small) or extract to a shared location. Given two files, defining it in both is acceptable for MVP simplicity. The implementation agent may choose to extract it to keep DRY.

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` passes after adding both files.

**Success Criteria**:
- Both files export their respective command functions.
- Both use `hxFetch` with `basePath: "/api"` and appropriate paths.
- Both handle the `--source` optional filter.
- Both handle empty artifact results gracefully.
- TypeScript compiles without errors.

---

### Step 4: Create artifacts command router

**Goal**: Create the `src/artifacts/index.ts` module that routes `hlx artifacts <subcommand>` to the appropriate handler.

**What to Build**:
- Create `src/artifacts/index.ts` following the pattern of `src/comments/index.ts` and `src/inspect/index.ts`.
- Export `async function runArtifacts(config: HxConfig, args: string[]): Promise<void>`.
- Import `getFlag`, `getPositionalArgs` from `../lib/args.js`.
- Import `cmdTicket` from `./ticket.js` and `cmdRun` from `./run.js`.
- Parse subcommand from `args[0]`:
  - `"ticket"`: extract the ticket ID from `args[1]` (positional) or `--ticket` flag. Require it. Call `cmdTicket(config, ticketId, rest)`.
  - `"run"`: extract the run ID from `args[1]` (positional) or `--run` flag. Require it. Call `cmdRun(config, runId, rest)`.
  - default: print usage and exit with code 1.
- Usage text:
  ```
  Usage:
    hlx artifacts ticket <ticket-id> [--source github|vercel]
    hlx artifacts run <run-id> [--source github|vercel]
  ```

**Verification (AI Agent Runs)**:
- `npx tsc --noEmit` passes.

**Success Criteria**:
- `src/artifacts/index.ts` exports `runArtifacts`.
- Routes `ticket` and `run` subcommands to the correct handlers.
- Prints clear usage text for unknown subcommands or missing arguments.
- TypeScript compiles without errors.

---

### Step 5: Update `src/index.ts` — fix version drift and register artifacts command

**Goal**: Fix the hardcoded version string and add the `artifacts` command to the CLI router.

**What to Build**:
- **Version drift fix**: At the top of `src/index.ts`, add:
  ```typescript
  import { createRequire } from "node:module";
  const require = createRequire(import.meta.url);
  const pkg = require("../package.json") as { version: string };
  ```
  Then replace line 47 (`console.log("0.1.0")`) with `console.log(pkg.version)`.
- **Artifacts command routing**: Add `import { runArtifacts } from "./artifacts/index.js";` at the top. Add a new case in the switch:
  ```typescript
  case "artifacts": {
    const config = requireConfig();
    await runArtifacts(config, args.slice(1));
    break;
  }
  ```
- **Update usage text**: Add artifact command examples to the `usage()` function:
  ```
  hlx artifacts ticket <ticket-id> [--source github|vercel]
  hlx artifacts run <run-id> [--source github|vercel]
  ```

**Verification (AI Agent Runs)**:
- `npm run build && node dist/index.js --version` outputs `1.2.0` (matches `package.json`).
- `npm run build && node dist/index.js` shows usage text including `artifacts` commands.
- `npx tsc --noEmit` passes.

**Success Criteria**:
- `--version` outputs the version from `package.json` (currently `1.2.0`), not `0.1.0`.
- The `artifacts` command is registered and reachable in the switch statement.
- Usage text includes the new `artifacts ticket` and `artifacts run` commands.
- TypeScript compiles without errors.

---

### Step 6: Create GitHub Actions publish workflow

**Goal**: Add an automated publish pipeline that builds, typechecks, and publishes to npm when the version changes on `main`.

**What to Build**:
- Create `.github/workflows/publish.yml`:
  - **Trigger**: `push` to `main` branch.
  - **Runner**: `ubuntu-latest`.
  - **Steps**:
    1. `actions/checkout@v4` — check out the repo.
    2. `actions/setup-node@v4` — set up Node 18 with npm registry URL `https://registry.npmjs.org`.
    3. `npm ci` — install dependencies deterministically.
    4. `npm run build` — compile TypeScript to dist/.
    5. `npm run typecheck` — validate types.
    6. **Version check step**: Compare `package.json` version against npm registry:
       ```bash
       CURRENT_VERSION=$(node -p "require('./package.json').version")
       PUBLISHED_VERSION=$(npm view @projectxinnovation/helix-cli version 2>/dev/null || echo "0.0.0")
       if [ "$CURRENT_VERSION" = "$PUBLISHED_VERSION" ]; then
         echo "Version $CURRENT_VERSION is already published. Skipping."
         echo "should_publish=false" >> "$GITHUB_OUTPUT"
       else
         echo "Publishing version $CURRENT_VERSION (published: $PUBLISHED_VERSION)"
         echo "should_publish=true" >> "$GITHUB_OUTPUT"
       fi
       ```
    7. **Publish step** (conditional on `should_publish == 'true'`):
       ```bash
       npm publish
       ```
       With `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` env var.
  - The workflow should have clear comments explaining each step.

**Verification (AI Agent Runs)**:
- The file `.github/workflows/publish.yml` exists and is valid YAML (verifiable with a simple parse check).
- The workflow references `actions/checkout@v4`, `actions/setup-node@v4`.
- The workflow uses `secrets.NPM_TOKEN` for publish authentication.
- The version-comparison logic is present.

**Success Criteria**:
- `.github/workflows/publish.yml` is valid YAML.
- Workflow triggers on push to `main`.
- Build and typecheck run before any publish attempt.
- Publish is conditional on version change.
- Uses `NPM_TOKEN` secret for npm authentication.

---

### Step 7: Create README documentation

**Goal**: Write a comprehensive `README.md` so a new engineer can install, authenticate, and use the CLI without tribal knowledge.

**What to Build**:
- Create `README.md` at repo root with these sections:
  1. **Title and description**: `@projectxinnovation/helix-cli` — what the CLI does (production inspection for databases, logs, APIs, comments, and artifacts).
  2. **Installation**: `npm install -g @projectxinnovation/helix-cli`.
  3. **Requirements**: Node.js >= 18.
  4. **Authentication**: Explain `hlx login <server-url>` browser flow and `hlx login --manual` for API key. Mention env vars as alternative.
  5. **Configuration**: Document all env vars (`HELIX_API_KEY`, `HELIX_URL`, fallback vars `HELIX_INSPECT_TOKEN`, `HELIX_INSPECT_API_KEY`, `HELIX_INSPECT_BASE_URL`, `HELIX_INSPECT_URL`) and `~/.hlx/config.json` format.
  6. **Command Reference**:
     - `hlx login <server-url>` / `hlx login --manual`
     - `hlx inspect repos`
     - `hlx inspect db --repo <name> "<sql>"`
     - `hlx inspect logs --repo <name> "<query>" [--limit N]`
     - `hlx inspect api --repo <name> <path>`
     - `hlx comments list [--ticket <id>] [--helix-only] [--since <iso-date>]`
     - `hlx comments post [--ticket <id>] <message>`
     - `hlx artifacts ticket <ticket-id> [--source github|vercel]`
     - `hlx artifacts run <run-id> [--source github|vercel]`
     - `hlx --version`
  7. **Artifact Retrieval Examples**: Concrete examples showing ticket and run lookups, with and without `--source` filtering.
  8. **Release / Publishing (Maintainers)**: Explain version-gated publish workflow. Steps: bump version in `package.json`, merge to `main`, CI builds/typechecks/publishes. Mention `NPM_TOKEN` secret requirement.
  9. **License**: MIT (matching `package.json`).
- Derive all content from the actual source code (already read) — do not speculate about behavior.

**Verification (AI Agent Runs)**:
- `README.md` exists at repo root.
- README includes sections for installation, authentication, configuration, command reference, artifact examples, and maintainer publishing notes.

**Success Criteria**:
- `README.md` covers all required sections from the ticket acceptance criteria.
- Installation instructions are correct (`npm install -g @projectxinnovation/helix-cli`).
- Node version requirement matches `package.json` engines field (>=18).
- All existing and new commands are documented with examples.
- Maintainer publishing workflow is documented.

---

## Verification Plan

### Pre-conditions

| # | Dependency | Status | Source/Evidence | Affects Checks |
|---|-----------|--------|-----------------|----------------|
| 1 | Node.js >= 18 installed | available | Required by `package.json` engines field; standard CI environment | CHK-01, CHK-02, CHK-03, CHK-04 |
| 2 | npm and `package-lock.json` present | available | `package-lock.json` exists in repo root | CHK-01, CHK-02 |
| 3 | Helix backend with `/api/artifacts/*` endpoints | unknown | No runtime inspection manifest available; backend endpoints may not exist yet (documented risk from all prior artifacts) | CHK-05 |

### Required Checks

**[CHK-01] TypeScript typecheck passes**
- Action: Run `npm ci && npx tsc --noEmit` from the repo root.
- Expected Outcome: The command exits with code 0 and produces no type errors.
- Required Evidence: Full command output showing exit code 0 with no error lines.

**[CHK-02] Build succeeds and produces dist/ output**
- Action: Run `npm run build` from the repo root (after `npm ci`).
- Expected Outcome: The command exits with code 0. The `dist/` directory contains compiled JavaScript files including `dist/index.js`, `dist/lib/args.js`, `dist/artifacts/index.js`, `dist/artifacts/ticket.js`, and `dist/artifacts/run.js`.
- Required Evidence: Command exit code plus directory listing of `dist/` showing the expected files.

**[CHK-03] Version drift is fixed — `--version` outputs the package.json version**
- Action: Run `npm run build && node dist/index.js --version` from the repo root.
- Expected Outcome: The output is exactly `1.2.0` (matching `package.json` version field).
- Required Evidence: Command output showing `1.2.0`.

**[CHK-04] CLI usage text includes artifacts commands**
- Action: Run `npm run build && node dist/index.js 2>&1` from the repo root (no arguments triggers usage output on stderr).
- Expected Outcome: The usage text includes `hlx artifacts ticket` and `hlx artifacts run` lines. The usage text also still includes existing commands (`login`, `inspect`, `comments`).
- Required Evidence: Command output showing the full usage text with artifacts commands present.

**[CHK-05] Artifact commands produce clear error when backend is unreachable**
- Action: Run `HELIX_API_KEY=test HELIX_URL=http://localhost:1 node dist/index.js artifacts ticket test-id` from the repo root (after build). This uses a non-routable backend URL to simulate an unreachable backend.
- Expected Outcome: The command exits with a non-zero code and prints a clear error message (e.g., network error, connection refused, or timeout). It does not crash with an unhandled exception or stack trace.
- Required Evidence: Command output showing the error message and non-zero exit code.

**[CHK-06] Artifact commands require authentication**
- Action: Run `node dist/index.js artifacts ticket test-id` from the repo root with no `HELIX_API_KEY`/`HELIX_URL` env vars set and no `~/.hlx/config.json` present (or after temporarily renaming it).
- Expected Outcome: The command exits with a non-zero code and prints the authentication error message: `"Not authenticated. Run \`hlx login <server-url>\` or set HELIX_API_KEY + HELIX_URL env vars."`.
- Required Evidence: Command output showing the authentication error message.

**[CHK-07] GitHub Actions workflow file is valid YAML with correct structure**
- Action: Run `node -e "const yaml = require('yaml'); const fs = require('fs'); const doc = yaml.parse(fs.readFileSync('.github/workflows/publish.yml', 'utf8')); console.log(JSON.stringify({on: doc.on, jobs: Object.keys(doc.jobs)}))"` (or equivalent YAML parse check) from the repo root. If `yaml` is not available, use `npx yaml` or `node -e` with a basic JSON structure check.
- Expected Outcome: The file parses as valid YAML. The `on` trigger includes `push` to `main`. At least one job exists. The workflow references `secrets.NPM_TOKEN`.
- Required Evidence: Parsed YAML structure output showing trigger config and job names, plus a grep for `NPM_TOKEN` in the file.

**[CHK-08] README exists with all required sections**
- Action: Verify `README.md` exists at repo root. Check that it contains sections for: installation, Node version requirement (>=18), authentication, configuration (env vars and config file), command reference (login, inspect, comments, artifacts), artifact retrieval examples, and maintainer publishing notes.
- Expected Outcome: `README.md` exists and contains all required sections. The installation command references `@projectxinnovation/helix-cli`. The Node version requirement is `>=18`.
- Required Evidence: File existence confirmation plus content excerpts showing each required section heading and key content (install command, Node version, env var names, all command groups).

**[CHK-09] Shared arg-parsing helpers are consolidated**
- Action: Check that `src/lib/args.ts` exists and exports `getFlag` and `getPositionalArgs`. Verify that `src/inspect/index.ts`, `src/comments/index.ts`, and `src/comments/list.ts` import from `../lib/args.js` and do not contain local `getFlag` or `getPositionalArgs` function definitions.
- Expected Outcome: `src/lib/args.ts` exports both functions. The three modified files import from the shared module. No local definitions of these functions remain in those files.
- Required Evidence: Content of `src/lib/args.ts` showing exports, plus content excerpts from the three modified files showing import statements and absence of local definitions.

**[CHK-10] No new runtime dependencies introduced**
- Action: Check `package.json` for the `dependencies` field.
- Expected Outcome: `package.json` has no `dependencies` field (or it is empty). Only `devDependencies` exist.
- Required Evidence: Content of `package.json` showing absence of runtime dependencies.

## Success Metrics

| Metric | Target |
|--------|--------|
| TypeScript typecheck | Passes with zero errors |
| Build output | `dist/` contains all expected files including new artifacts modules |
| Version drift | `hlx --version` outputs `package.json` version |
| Artifact commands | Registered in CLI router, handle auth errors and backend errors gracefully |
| Publish workflow | Valid YAML, triggers on `main` push, version-gated, uses `NPM_TOKEN` |
| README completeness | Covers installation, auth, config, full command reference, artifacts, publishing |
| Runtime dependencies | Zero (unchanged from baseline) |
| Existing command behavior | Unchanged — `login`, `inspect`, `comments` work identically |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand scope, acceptance criteria, open decisions | Three workstreams: README, CI publish, artifact retrieval; version drift fix needed |
| scout/scout-summary.md | Understand current repo architecture | 13 source files, 3 command groups, zero deps/tests/CI, hxFetch thin-client pattern |
| scout/reference-map.json | Structured file inventory, facts, unknowns | Version drift confirmed (1.2.0 vs 0.1.0), dist/ gitignored, ESM package |
| diagnosis/diagnosis-statement.md | Root cause analysis and architectural recommendations | Use hxFetch pattern for artifacts, publish on version change, derive version from package.json |
| diagnosis/apl.json | Diagnosis evidence and conclusions | All three gaps confirmed; backend-proxy pattern recommended |
| product/product.md | Product requirements, success criteria, scope boundaries | Zero new runtime deps, thin-client pattern, version-gated publish, explicit out-of-scope items |
| tech-research/tech-research.md | Technical decisions and API contracts | createRequire for version, hxFetch for artifacts, npm registry comparison for publish, extract args.ts |
| tech-research/apl.json | Technical answers with evidence | Implementation approach for all five research questions confirmed |
| repo-guidance.json | Repo intent classification | helix-cli is sole target repo, no cross-repo changes |
| src/index.ts (direct read) | Verify command router and version drift | Line 47 hardcodes "0.1.0"; switch routes 4 commands |
| src/lib/http.ts (direct read) | Understand hxFetch API for artifact commands | basePath, queryParams, auth, retry/backoff |
| src/lib/config.ts (direct read) | Understand auth model | requireConfig(), env vars, ~/.hlx/config.json |
| src/comments/index.ts (direct read) | Reference command router pattern | getFlag pattern, resolveTicketId, switch routing |
| src/comments/list.ts (direct read) | Reference subcommand pattern | hxFetch with basePath "/api", type casting, empty-result handling |
| src/inspect/index.ts (direct read) | Reference command router with getPositionalArgs | Both arg helpers defined here, switch routing |
| package.json (direct read) | Verify npm config, version, scripts | v1.2.0, scoped, files: [dist], ESM, Node>=18 |
| tsconfig.json (direct read) | Verify TS config | ES2022 target, Node16 module, strict |

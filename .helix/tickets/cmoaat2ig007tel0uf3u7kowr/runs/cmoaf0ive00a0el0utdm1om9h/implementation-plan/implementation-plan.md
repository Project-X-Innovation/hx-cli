# Implementation Plan — HLX-299: helix-cli packaging, documentation, and artifact retrieval

## Overview

Add four categories of changes to the `helix-cli` repository — all additive, no server-side changes needed:

1. **GitHub Actions publish workflow** (`.github/workflows/publish.yml`) — automated npm publish on push to `main` with version-change detection
2. **README.md** — comprehensive documentation including step-by-step GitHub/npm secrets setup instructions for maintainers
3. **Artifact commands** (`src/artifacts/`) — new CLI commands to list and retrieve artifacts via the existing Helix server API
4. **Housekeeping** — fix version hardcode at `src/index.ts:47`, add `prepublishOnly` safety script to `package.json`

The `helix-global-server` requires **NO changes**. Direct verification of `src/routes/api.ts` lines 236-238 confirms artifact endpoints are already registered before `requireAuth` (line 240) with `attachInspectionAuth + requireCommentAuth` middleware — the same auth pattern as comment endpoints. The CLI's `hxi_` API keys already work with these endpoints.

## Implementation Principles

- **Follow existing patterns**: New artifact commands mirror `src/comments/` module structure exactly (router + subcommand files, `hxFetch` with `basePath: '/api'`, `resolveTicketId` with `--ticket` flag / `HELIX_TICKET_ID` env var).
- **Zero new dependencies**: Maintain the zero-runtime-dependency footprint. Use `node:module` `createRequire` for version reading (Node.js builtin).
- **Thin client**: CLI calls existing Helix server endpoints — no direct GitHub/Vercel API calls.
- **Build-before-publish safety**: Both CI workflow and `prepublishOnly` script ensure `dist/` is built before publishing.
- **ESM-only**: All new code uses ES module syntax consistent with `"type": "module"` in `package.json`.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add publish safety script | Updated `package.json` with `prepublishOnly` |
| 2 | Fix version hardcode | Updated `src/index.ts` with dynamic version from `package.json` |
| 3 | Create artifact command router | New `src/artifacts/index.ts` |
| 4 | Create ticket artifact listing command | New `src/artifacts/ticket.ts` |
| 5 | Create run step-artifact retrieval command | New `src/artifacts/run.ts` |
| 6 | Wire artifact commands into CLI entry point | Updated `src/index.ts` with `artifacts` case and usage text |
| 7 | Create GitHub Actions publish workflow | New `.github/workflows/publish.yml` |
| 8 | Create README documentation | New `README.md` with full docs and secrets setup instructions |
| 9 | Final build and typecheck verification | Verify all changes compile cleanly |

## Detailed Implementation Steps

### Step 1: Add `prepublishOnly` script to `package.json`

**Goal**: Prevent broken publishes by ensuring `dist/` is built before any `npm publish` (manual or CI).

**What to Build**:
- In `package.json`, add `"prepublishOnly": "npm run build"` to the `scripts` section.
- No other changes to `package.json`. Version stays at `1.2.0`; no new dependencies.

**Files changed**: `package.json`

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
node -e "const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8')); if(pkg.scripts.prepublishOnly === 'npm run build') console.log('PASS'); else console.log('FAIL');"
```

**Success Criteria**: `package.json` scripts section contains `"prepublishOnly": "npm run build"`.

---

### Step 2: Fix version hardcode in `src/index.ts`

**Goal**: Make `hlx --version` print the actual version from `package.json` instead of the hardcoded `"0.1.0"`.

**What to Build**:
- At the top of `src/index.ts`, add: `import { createRequire } from "node:module";`
- Before the switch statement, resolve version dynamically:
  ```typescript
  const require = createRequire(import.meta.url);
  const pkgVersion = (require("../package.json") as { version: string }).version;
  ```
- Replace the hardcoded `console.log("0.1.0")` at line 47 with `console.log(pkgVersion);`

**Why `createRequire`**: This is the idiomatic ESM approach for reading JSON in Node.js. `package.json` is always included in npm packages regardless of the `files` field. The compiled `dist/index.js` resolves `../package.json` to the root correctly.

**Files changed**: `src/index.ts`

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
npm install && npm run build && node dist/index.js --version
# Expected output: 1.2.0
```

**Success Criteria**: `hlx --version` outputs `1.2.0` (matching `package.json`), not `0.1.0`.

---

### Step 3: Create artifact command router (`src/artifacts/index.ts`)

**Goal**: Create the artifact module's entry point following the `src/comments/index.ts` pattern.

**What to Build**:
- New file `src/artifacts/index.ts`
- Export `runArtifacts(config: HxConfig, args: string[]): Promise<void>`
- Implement `resolveTicketId(args)` using `--ticket` flag or `HELIX_TICKET_ID` env var (same logic as `src/comments/index.ts` lines 11-19)
- Implement `getFlag(args, flag)` helper (same as `src/comments/index.ts` lines 5-8)
- Route to subcommands via switch: `ticket` -> `cmdTicketArtifacts`, `run` -> `cmdRunArtifacts`
- Display usage/error for unknown or missing subcommands with `artifactsUsage()` function

**Pattern reference**: `src/comments/index.ts` (router with resolveTicketId, getFlag, subcommand switch)

**Files changed**: `src/artifacts/index.ts` (new)

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
npm run typecheck
```

**Success Criteria**: Module compiles cleanly, exports `runArtifacts`, resolves ticket IDs consistently with comments module, routes to ticket/run subcommands.

---

### Step 4: Create ticket artifact listing command (`src/artifacts/ticket.ts`)

**Goal**: Implement `hlx artifacts ticket <ticket-id>` to list artifacts for a ticket.

**What to Build**:
- New file `src/artifacts/ticket.ts`
- Export `cmdTicketArtifacts(config: HxConfig, ticketId: string, args: string[]): Promise<void>`
- Call `hxFetch(config, `/tickets/${ticketId}/artifacts`, { basePath: '/api' })` — optionally pass `queryParams: { runId }` if `--run <runId>` flag is present
- Type the response matching the server contract:
  ```typescript
  type ArtifactResponse = {
    items: Array<{ id: string; label: string; repoUrl: string; runId: string; branch: string; path: string; url: string }>;
    stepArtifactSummary: Array<{ stepId: string; repoKey: string }>;
  };
  ```
- Display human-readable output: for each item, print repo label, run ID, branch, URL; then step artifact summary listing
- Handle empty state: print `"No artifacts found for this ticket."`

**Pattern reference**: `src/comments/list.ts` (hxFetch with `basePath: '/api'`, typed response, human-readable `console.log` output, empty state handling)

**Files changed**: `src/artifacts/ticket.ts` (new)

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
npm run typecheck
```

**Success Criteria**: Command calls `GET /api/tickets/:ticketId/artifacts` via hxFetch, displays artifact metadata in human-readable format, handles empty responses with clear message.

---

### Step 5: Create run step-artifact retrieval command (`src/artifacts/run.ts`)

**Goal**: Implement `hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>` to fetch step-level artifacts.

**What to Build**:
- New file `src/artifacts/run.ts`
- Export `cmdRunArtifacts(config: HxConfig, ticketId: string, args: string[]): Promise<void>`
- Parse `<run-id>` as positional arg from `args[0]`
- Parse `--step <stepId>` and `--repo-key <repoKey>` from flags using `getFlag`
- Validate all required params are present; print clear error and exit(1) if missing:
  - Missing run ID: `"Error: Run ID is required. Usage: hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>"`
  - Missing `--step`: `"Error: --step flag is required for run artifact retrieval."`
  - Missing `--repo-key`: `"Error: --repo-key flag is required for run artifact retrieval."`
- Call `hxFetch(config, `/tickets/${ticketId}/runs/${runId}/step-artifacts/${stepId}`, { basePath: '/api', queryParams: { repoKey } })`
- Type the response:
  ```typescript
  type StepArtifactResponse = {
    stepId: string;
    repoKey: string;
    files: Array<{ name: string; content: string; contentType: string }>;
  };
  ```
- Display human-readable output: step ID, repo key, then for each file: name, content type, and content
- Handle empty state: `"No step artifacts found."`

**Files changed**: `src/artifacts/run.ts` (new)

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
npm run typecheck
```

**Success Criteria**: Command requires and validates `--step` and `--repo-key` flags, calls the correct server endpoint, displays file content in readable format, handles missing params and empty responses gracefully.

---

### Step 6: Wire artifact commands into CLI entry point (`src/index.ts`)

**Goal**: Register the `artifacts` command in the main CLI router and update usage text.

**What to Build**:
- Add import at the top of `src/index.ts`: `import { runArtifacts } from "./artifacts/index.js";`
- Add `case "artifacts"` to the switch statement (after the `"comments"` case):
  ```typescript
  case "artifacts": {
    const config = requireConfig();
    await runArtifacts(config, args.slice(1));
    break;
  }
  ```
- Update the `usage()` function to include artifact command examples:
  ```
  hlx artifacts ticket <ticket-id>    List artifacts for a ticket
  hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>
  ```

**Files changed**: `src/index.ts`

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
npm run build && node dist/index.js 2>&1 | grep -i "artifacts"
# Expected: usage lines mentioning "artifacts"
```

**Success Criteria**: `hlx` (no args) displays usage including artifact commands. `hlx artifacts` routes to the artifact module.

---

### Step 7: Create GitHub Actions publish workflow

**Goal**: Automate npm publishing when a push to `main` includes a version change.

**What to Build**:
- New directory: `.github/workflows/`
- New file: `.github/workflows/publish.yml`
- Configuration:
  - **name**: `Publish to npm`
  - **trigger**: `on: push: branches: [main]`
  - **permissions**: `contents: read`, `id-token: write` (for npm provenance attestation)
  - **job**: `publish` on `ubuntu-latest`
  - **steps**:
    1. `actions/checkout@v4`
    2. `actions/setup-node@v4` with `node-version: '20'` and `registry-url: 'https://registry.npmjs.org'`
    3. `npm ci` — install dependencies
    4. `npm run build` — compile TypeScript to `dist/`
    5. `npm run typecheck` — verify type safety
    6. **Version check step**: Shell script that compares `package.json` version to `npm view @projectxinnovation/helix-cli version 2>/dev/null || echo "0.0.0"`. Sets a step output (`should_publish=true/false`). If versions match, logs "Version unchanged, skipping publish."
    7. **Publish step** (conditional on version check): `npm publish --access public` with `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. Uses `if: steps.version_check.outputs.should_publish == 'true'`.

**Files changed**: `.github/workflows/publish.yml` (new)

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
test -f .github/workflows/publish.yml && echo "WORKFLOW_EXISTS" || echo "MISSING"
cat .github/workflows/publish.yml
```

**Success Criteria**: Workflow file exists with correct trigger (push to main), build steps, version-change detection, and npm publish using `NPM_TOKEN` secret.

---

### Step 8: Create README.md

**Goal**: Provide comprehensive documentation for install, auth, usage, artifact retrieval, and publish infrastructure setup.

**What to Build**:
- New file `README.md` at repository root
- Sections (in order):
  1. **Title and description**: `@projectxinnovation/helix-cli` — CLI for Helix production inspection, comments, and artifact retrieval
  2. **Installation**: `npm install -g @projectxinnovation/helix-cli` with Node.js >= 18 requirement
  3. **Authentication**:
     - `hlx login <server-url>` (OAuth browser flow)
     - `hlx login --manual` (paste API key)
     - Env vars: `HELIX_API_KEY` + `HELIX_URL` (and aliases `HELIX_INSPECT_TOKEN`, `HELIX_INSPECT_API_KEY`, etc.)
     - Config file: `~/.hlx/config.json`
     - Env vars take priority over config file
  4. **Command Reference** with examples for all commands:
     - `hlx login`
     - `hlx inspect` (repos, db, logs, api)
     - `hlx comments` (list, post)
     - `hlx artifacts` (ticket, run)
     - `hlx --version`
  5. **Artifact Retrieval**: Detailed examples and explanation of the `ticket` and `run` subcommands, required flags (`--ticket`, `--step`, `--repo-key`), and error cases
  6. **Publishing Setup (Maintainers)**:
     - How the automated workflow operates (push to main triggers publish if version changed)
     - **npm Side Setup** — step-by-step:
       1. Log into npmjs.com with an account that has publish rights to `@projectxinnovation`
       2. Navigate to Settings -> Access Tokens -> Generate New Token
       3. Choose **Automation** token type (Classic) — bypasses org-level 2FA for CI
       4. Alternative: Granular Access Token scoped to `@projectxinnovation/helix-cli` with Read/Write permissions
       5. Copy the generated token value
     - **GitHub Side Setup** — step-by-step:
       1. Navigate to the `helix-cli` repository on GitHub
       2. Go to Settings -> Secrets and variables -> Actions
       3. Click "New repository secret"
       4. Name: `NPM_TOKEN`, Value: the npm access token
       5. Note: `GITHUB_TOKEN` is automatically available in workflows — no manual setup needed
     - **Required Secrets Summary Table**: NPM_TOKEN (GitHub secret, manual setup), GITHUB_TOKEN (automatic)
  7. **License**: MIT

**Files changed**: `README.md` (new)

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
test -f README.md && echo "README_EXISTS" || echo "MISSING"
grep -c "npm install -g @projectxinnovation/helix-cli" README.md
grep -c "NPM_TOKEN" README.md
grep -c "hlx artifacts" README.md
grep -c "Automation" README.md
```

**Success Criteria**: README covers installation, auth (with all env var names), all commands with examples, artifact retrieval section, and complete GitHub/npm secrets setup instructions with step-by-step guidance.

---

### Step 9: Final build and typecheck verification

**Goal**: Ensure all changes compile and typecheck successfully.

**What to Build**: No new code — verification-only step.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli
npm install && npm run build && npm run typecheck
```

**Success Criteria**: Both `build` and `typecheck` complete with exit code 0. `dist/` directory contains compiled output including `dist/artifacts/index.js`, `dist/artifacts/ticket.js`, `dist/artifacts/run.js`.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|---|---|---|---|
| Node.js >= 18 installed | available | Runtime environment; `package.json` engines field | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06, CHK-07, CHK-08, CHK-09 |
| npm available | available | Runtime environment | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| helix-cli repo at workspace path | available | `/vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli` | All checks |
| npm dependencies installed | available | Run `npm install` before verification | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| Helix server accessible with valid `hxi_` API key | unknown | Requires live auth credentials (`HELIX_API_KEY` + `HELIX_URL` env vars) to test artifact commands against a running server | CHK-04 |
| Test ticket with artifacts on the Helix server | unknown | Needed for live artifact retrieval test | CHK-04 |
| `NPM_TOKEN` GitHub secret configured | unknown | Requires manual one-time setup by maintainer — documented in README; cannot be tested in dev environment | CHK-06 (static only) |

### Required Checks

[CHK-01] TypeScript build succeeds
- Action: Run `cd /vercel/sandbox/workspaces/cmoaf0ive00a0el0utdm1om9h/helix-cli && npm install && npm run build` in the helix-cli repository.
- Expected Outcome: `tsc` compiles without errors; `dist/` directory is populated with compiled files including `dist/index.js`, `dist/artifacts/index.js`, `dist/artifacts/ticket.js`, `dist/artifacts/run.js`.
- Required Evidence: Exit code 0 from `npm run build` and file listing of `dist/artifacts/` showing the three compiled `.js` files.

[CHK-02] TypeScript typecheck passes
- Action: Run `npm run typecheck` in the helix-cli repository.
- Expected Outcome: `tsc --noEmit` completes with no type errors.
- Required Evidence: Exit code 0 from `npm run typecheck` and command output confirming no errors.

[CHK-03] Version output is correct
- Action: Run `node dist/index.js --version` in the helix-cli repository after building.
- Expected Outcome: Output is `1.2.0` (matching `package.json` version), not the old hardcoded `0.1.0`.
- Required Evidence: Command stdout showing exactly `1.2.0`.

[CHK-04] Artifact ticket command calls correct endpoint and handles responses
- Action: Set `HELIX_API_KEY` and `HELIX_URL` env vars to valid Helix server credentials, then run `node dist/index.js artifacts ticket <ticket-id>` against the live Helix server using a known ticket ID.
- Expected Outcome: The command outputs artifact metadata (repo labels, run IDs, branches, URLs) in human-readable format, OR a clear "No artifacts found for this ticket." message if the ticket has no artifacts. No stack traces or unhandled errors.
- Required Evidence: Command stdout showing either the artifact listing with identifiable fields (label, runId, branch) or the empty-state message. If credentials are unavailable, the command should output a clear authentication error message (not a crash).

[CHK-05] Artifact run command validates required flags
- Action: Run `node dist/index.js artifacts run some-run-id --ticket some-ticket-id` (without `--step` and `--repo-key` flags) in the helix-cli repository after building.
- Expected Outcome: The command outputs a clear error message indicating that `--step` and/or `--repo-key` flags are required, and exits with a non-zero code.
- Required Evidence: Command stderr/stdout showing the validation error message about missing flags and a non-zero exit code.

[CHK-06] GitHub Actions workflow file is structurally correct
- Action: Read `.github/workflows/publish.yml` and verify it contains all required elements: trigger on `push` to `main` branch, `actions/checkout@v4`, `actions/setup-node@v4` with `registry-url: 'https://registry.npmjs.org'`, `npm ci`, `npm run build`, `npm run typecheck`, a version comparison step, and an `npm publish` step that uses `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`.
- Expected Outcome: All listed workflow elements are present. The version check step compares local version to npm registry. The publish step is conditional on the version check.
- Required Evidence: File content showing the trigger configuration, each required step, the version check logic with step output, the conditional publish step with NPM_TOKEN secret reference, and `permissions` block.

[CHK-07] README contains all required sections
- Action: Read `README.md` and verify it contains: (a) npm install command (`npm install -g @projectxinnovation/helix-cli`), (b) Node.js version requirement (>=18), (c) authentication instructions covering `hlx login`, env vars (`HELIX_API_KEY`, `HELIX_URL`), and config file (`~/.hlx/config.json`), (d) command reference for all commands including `hlx artifacts ticket` and `hlx artifacts run`, (e) maintainer section with npm token creation steps (mentioning "Automation" token type), and (f) GitHub repository secret setup steps (mentioning `NPM_TOKEN`).
- Expected Outcome: All six content areas are present with substantive instructions, not placeholder text.
- Required Evidence: Excerpts from `README.md` showing each of the six required content areas.

[CHK-08] package.json contains prepublishOnly script
- Action: Read `package.json` and check the `scripts` section.
- Expected Outcome: The `scripts` object contains `"prepublishOnly": "npm run build"`.
- Required Evidence: The relevant excerpt from `package.json` showing the `prepublishOnly` entry.

[CHK-09] CLI usage text includes artifact commands
- Action: Run `node dist/index.js 2>&1` (no arguments, after building) in the helix-cli repository.
- Expected Outcome: The usage/help text printed to stderr includes artifact command entries showing `hlx artifacts ticket` and `hlx artifacts run` syntax.
- Required Evidence: Command output showing the usage text with artifact command lines visible.

## Success Metrics

1. `npm run build` and `npm run typecheck` pass with exit code 0
2. `hlx --version` outputs `1.2.0` (matches `package.json`)
3. `hlx artifacts ticket <id>` calls `GET /api/tickets/:ticketId/artifacts` via hxFetch and displays results
4. `hlx artifacts run <id> --ticket <id> --step <id> --repo-key <key>` calls the step-artifact endpoint
5. Missing required flags produce clear error messages (not crashes)
6. `.github/workflows/publish.yml` triggers on push to main with version-change detection and `NPM_TOKEN` secret
7. `README.md` enables self-service install, auth, usage, and includes complete GitHub/npm secrets setup instructions
8. `prepublishOnly` script prevents empty `dist/` publishes
9. Zero new runtime dependencies added

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli) | Primary ticket spec and continuation context | Three deliverables: publish workflow, README, artifact commands. User emphasizes auto-publish on push to main + GitHub/npm secrets setup instructions. |
| `scout/scout-summary.md` (helix-cli) | Package state, module patterns, corrected auth analysis | No .github/ dir, no README, version drift; artifact endpoints already accessible with hxi_ tokens (corrected from prior scout). Detailed secrets setup requirements. |
| `scout/reference-map.json` (helix-cli) | File inventory, npm registry state | Zero prod deps, ESM-only, established command patterns in src/comments/ and src/inspect/, dist/ gitignored |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause analysis | Five root causes: no CI/CD, no docs, no artifact commands, version drift, no prepublishOnly. No server changes needed. |
| `diagnosis/apl.json` (helix-cli) | Structured diagnosis evidence | Confirmed server endpoints accessible with hxi_ keys, CLI should use server API exclusively |
| `product/product.md` (helix-cli) | Product scope and constraints | Thin client principle, zero-dependency policy, --json out of scope for MVP, single repo changed |
| `tech-research/tech-research.md` (helix-cli) | Architecture decisions with rationale | Publish on version-change (Option A), createRequire for version (Option A), src/artifacts/ module (Option A), server API only (Option A) |
| `tech-research/apl.json` (helix-cli) | Structured tech decisions | Version check strategy, basePath '/api', human-readable output, all 8 decisions with evidence |
| `repo-guidance.json` (helix-cli) | Repo intent classification | helix-cli = target, helix-global-server = context only (confirmed by direct source verification) |
| `src/routes/api.ts:225-284` (server, direct read) | Definitive auth boundary verification | Lines 237-238 confirm artifact routes before requireAuth at line 240 with correct middleware — no server changes needed |
| `src/index.ts` (helix-cli, direct read) | CLI entry point structure | Switch/case routing at lines 28-53, line 47 hardcodes "0.1.0", shebang present |
| `src/comments/index.ts` (helix-cli, direct read) | Router pattern reference | resolveTicketId with --ticket flag and HELIX_TICKET_ID env var, getFlag helper, switch/case subcommand routing |
| `src/comments/list.ts` (helix-cli, direct read) | Subcommand implementation pattern | hxFetch with basePath '/api', typed response, human-readable console.log output, empty state handling |
| `src/lib/http.ts` (helix-cli, direct read) | HTTP transport API contract | hxFetch(config, path, {basePath, queryParams, method, body}) with retry, auth header injection |
| `src/lib/config.ts` (helix-cli, direct read) | Auth/config system | HELIX_API_KEY/HELIX_URL env vars, ~/.hlx/config.json fallback, HxConfig type |
| `package.json` (helix-cli, direct read) | Build/publish configuration | v1.2.0, type: "module", ESM, zero prod deps, no prepublishOnly, files: ["dist"], engines: node >=18 |
| `tsconfig.json` (helix-cli, direct read) | TypeScript configuration | ES2022 target, Node16 module, strict, rootDir src/, outDir dist/ |
| `.gitignore` (helix-cli, direct read) | Build output exclusion | dist/ and node_modules/ gitignored — workflow must build before publishing |

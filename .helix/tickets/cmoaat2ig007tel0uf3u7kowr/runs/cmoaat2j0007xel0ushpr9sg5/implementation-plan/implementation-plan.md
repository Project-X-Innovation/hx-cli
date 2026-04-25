# Implementation Plan: helix-cli packaging, documentation, and artifact retrieval

## Overview

Add a `README.md`, a GitHub Actions npm publish workflow, fix the version string drift, add a `prepublishOnly` script, and implement `hlx artifacts` commands (`ticket` and `run` subcommands) that call the Helix server's existing artifact endpoints via `hxFetch`. The CLI remains a thin client with zero production dependencies.

## Implementation Principles

- **Follow established patterns**: New artifact commands mirror `src/comments/` and `src/inspect/` module structure, using `hxFetch` with `basePath: '/api'`.
- **Zero new dependencies**: Use only Node.js builtins (add `node:module` for `createRequire`).
- **Thin client**: CLI calls the server API; does not access GitHub or Vercel APIs directly.
- **Minimal change footprint**: Only add files and modify the minimum lines needed.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Fix version string drift | Modified `src/index.ts` |
| 2 | Add prepublishOnly script | Modified `package.json` |
| 3 | Add artifact command module (ticket subcommand) | New `src/artifacts/index.ts`, `src/artifacts/ticket.ts` |
| 4 | Add artifact command module (run subcommand) | New `src/artifacts/run.ts` |
| 5 | Register artifact command in CLI entrypoint | Modified `src/index.ts` |
| 6 | Add GitHub Actions npm publish workflow | New `.github/workflows/publish.yml` |
| 7 | Add README.md | New `README.md` |

## Detailed Implementation Steps

### Step 1: Fix version string drift

**Goal**: Make `hlx --version` output match `package.json` version dynamically.

**What to Build**:

In `src/index.ts`:
1. Add import at top: `import { createRequire } from "node:module";`
2. Create require function: `const require = createRequire(import.meta.url);`
3. Read version: `const { version } = require("../package.json") as { version: string };`
4. Replace the hardcoded `console.log("0.1.0")` at line 47 with `console.log(version)`.

**Verification (AI Agent Runs)**:
1. `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npx tsc --noEmit` — typecheck passes.
2. `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npm run build && node dist/index.js --version` — outputs `1.2.0`.

**Success Criteria**:
- `node dist/index.js --version` outputs the version from `package.json` (currently `1.2.0`).
- No hardcoded version string remains in `src/index.ts`.

### Step 2: Add prepublishOnly script

**Goal**: Ensure `dist/` is built before any npm publish.

**What to Build**:

In `package.json`, add to the `scripts` object:
```json
"prepublishOnly": "npm run build"
```

**Verification (AI Agent Runs)**:
1. Confirm `package.json` contains `"prepublishOnly": "npm run build"` in scripts.

**Success Criteria**:
- `npm run build` is automatically invoked before any `npm publish`.

### Step 3: Add artifact command module — router and ticket subcommand

**Goal**: Implement `hlx artifacts ticket <ticket-id>` that lists artifact metadata for a ticket.

**What to Build**:

**`src/artifacts/index.ts`** — Router module following `src/comments/index.ts` pattern:
- Import `HxConfig` type from `../lib/config.js`
- Implement `getFlag(args, flag)` helper (same pattern as comments/inspect)
- Implement `resolveTicketId(args)` using `--ticket` flag, then positional arg, then `HELIX_TICKET_ID` env var (extended from comments pattern to also accept positional args)
- Implement `getPositionalArgs(args, excludeFlags)` helper (same as inspect)
- Implement `artifactsUsage()` function showing help text
- Implement `runArtifacts(config, args)` export: switch on subcommand (`ticket`, `run`), resolve ticket ID, delegate to subcommand files
- Export `runArtifacts`

**`src/artifacts/ticket.ts`** — Ticket artifact list subcommand:
- Import `HxConfig` from `../lib/config.js` and `hxFetch` from `../lib/http.js`
- Define response type matching server: `{ items: Array<{id, label, repoUrl, runId, branch, path, url}>, stepArtifactSummary: Array<{stepId, repoKey}> }`
- Implement `cmdTicket(config, ticketId, args)`:
  - Check for `--json` flag in args
  - Call `hxFetch(config, `/tickets/${ticketId}/artifacts`, { basePath: '/api' })`
  - If `--json`: `console.log(JSON.stringify(data, null, 2))`
  - If human-readable: iterate `data.items`, print repo label, runId, branch, GitHub URL per item; then print step artifact summary; print `"No artifacts found."` if both arrays are empty
- Support optional `--run <runId>` flag to pass `runId` as query parameter to the endpoint

**Verification (AI Agent Runs)**:
1. `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npx tsc --noEmit` — typecheck passes.

**Success Criteria**:
- `src/artifacts/index.ts` and `src/artifacts/ticket.ts` exist and compile cleanly.
- Router follows the `comments/index.ts` pattern (switch/case, resolveTicketId, getFlag).
- Ticket command calls `GET /api/tickets/:ticketId/artifacts` via hxFetch with `basePath: '/api'`.

### Step 4: Add artifact command module — run subcommand

**Goal**: Implement `hlx artifacts run <run-id> --ticket <ticket-id> --step <step-id> --repo-key <key>` that retrieves step-level artifact content.

**What to Build**:

**`src/artifacts/run.ts`** — Run artifact retrieval subcommand:
- Import `HxConfig` from `../lib/config.js` and `hxFetch` from `../lib/http.js`
- Define response type matching server: `{ stepId: string, repoKey: string, files: Array<{name: string, content: string, contentType: string}> }`
- Implement `cmdRun(config, ticketId, args)`:
  - Parse `runId` from positional args (first positional arg)
  - Parse `--step <stepId>` and `--repo-key <repoKey>` from flags (both required)
  - Check for `--json` flag
  - Validate all required params present; exit with error if missing
  - Call `hxFetch(config, `/tickets/${ticketId}/runs/${runId}/step-artifacts/${stepId}`, { basePath: '/api', queryParams: { repoKey } })`
  - If `--json`: `console.log(JSON.stringify(data, null, 2))`
  - If human-readable: print step ID, repo key, then for each file print name, content type, and content (truncated if long)
  - Print clear error if no files returned

**Verification (AI Agent Runs)**:
1. `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npx tsc --noEmit` — typecheck passes.

**Success Criteria**:
- `src/artifacts/run.ts` exists and compiles cleanly.
- Command requires `--ticket`, `--step`, and `--repo-key` flags; errors clearly if any are missing.
- Calls `GET /api/tickets/:ticketId/runs/:runId/step-artifacts/:stepId?repoKey=<key>` via hxFetch.

### Step 5: Register artifact command in CLI entrypoint

**Goal**: Wire `hlx artifacts` into the top-level command router.

**What to Build**:

In `src/index.ts`:
1. Add import: `import { runArtifacts } from "./artifacts/index.js";`
2. Add a new case in the switch statement (after `"comments"` case):
   ```
   case "artifacts": {
     const config = requireConfig();
     await runArtifacts(config, args.slice(1));
     break;
   }
   ```
3. Update the `usage()` help text to include artifact command examples:
   ```
   hlx artifacts ticket <ticket-id> [--json]
   hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key> [--json]
   ```

**Verification (AI Agent Runs)**:
1. `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npx tsc --noEmit` — typecheck passes.
2. `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npm run build && node dist/index.js artifacts` — shows artifacts usage/help.
3. `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && node dist/index.js` — shows updated usage including artifact commands.

**Success Criteria**:
- `hlx artifacts` triggers the artifact command router.
- `hlx` (no args) shows usage text including artifact command examples.
- Build and typecheck pass.

### Step 6: Add GitHub Actions npm publish workflow

**Goal**: Automate npm publishing when a version change is pushed to `main`.

**What to Build**:

**`.github/workflows/publish.yml`**:
- **Trigger**: `push` to `main` branch
- **Permissions**: `contents: read`, `id-token: write`
- **Job**: `publish` running on `ubuntu-latest`
- **Steps**:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with `node-version: '20'` and `registry-url: 'https://registry.npmjs.org'`
  3. `npm ci` — install dependencies
  4. `npm run build` — compile TypeScript
  5. `npm run typecheck` — verify types
  6. **Version check**: Compare `package.json` version with `npm view @projectxinnovation/helix-cli version 2>/dev/null || echo "0.0.0"`. If they match, skip publish with a message. If they differ (or package never published), proceed.
  7. `npm publish --access public` with env `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
- Add comments documenting: the required `NPM_TOKEN` secret, the version-change-only publish strategy, and that `prepublishOnly` runs automatically.

**Verification (AI Agent Runs)**:
1. Confirm `.github/workflows/publish.yml` exists with correct YAML syntax.
2. Verify the workflow file is valid YAML (no syntax errors).

**Success Criteria**:
- Workflow file exists at `.github/workflows/publish.yml`.
- Triggers on push to `main` only.
- Includes version-change detection to avoid duplicate publishes.
- Uses `NPM_TOKEN` secret for auth.
- Runs build and typecheck before publish.

### Step 7: Add README.md

**Goal**: Document installation, authentication, configuration, all commands, and maintainer guidance.

**What to Build**:

**`README.md`** at the helix-cli root:
- **What it does**: Brief description of helix-cli as a CLI for Helix production inspection, comments, and artifact retrieval.
- **Install instructions**: `npm install -g @projectxinnovation/helix-cli` (requires Node >= 18).
- **Authentication flow**:
  - `hlx login <server-url>` for OAuth browser flow
  - `hlx login --manual` for pasting an API key directly
  - Config stored in `~/.hlx/config.json`
- **Configuration via env vars**: `HELIX_API_KEY`, `HELIX_URL` (and aliases `HELIX_INSPECT_TOKEN`, `HELIX_INSPECT_API_KEY`, `HELIX_INSPECT_BASE_URL`, `HELIX_INSPECT_URL`). Env vars take priority over config file.
- **Command reference with examples**:
  - `hlx login`
  - `hlx inspect repos`, `hlx inspect db`, `hlx inspect logs`, `hlx inspect api`
  - `hlx comments list`, `hlx comments post`
  - `hlx artifacts ticket <ticket-id>`, `hlx artifacts ticket <ticket-id> --json`
  - `hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>`
  - `hlx --version`
- **Artifact retrieval section**: Explain the two subcommands, required flags, `--json` mode, and error cases.
- **Release/publish notes for maintainers**: Explain the GitHub Actions workflow, the `NPM_TOKEN` secret requirement, the version-change-only trigger, and how `prepublishOnly` ensures builds.

**Verification (AI Agent Runs)**:
1. Confirm `README.md` exists at the helix-cli root.
2. Verify it includes sections for: installation, authentication, configuration, command reference (all commands including artifacts), and maintainer release notes.

**Success Criteria**:
- A new engineer can follow the README to install, authenticate, and run all commands without additional guidance.
- All existing commands and new artifact commands are documented with examples.
- Maintainer section explains the publish workflow and required secrets.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 installed | available | Package.json engines field; dev environment | CHK-01, CHK-02, CHK-03, CHK-04, CHK-06 |
| npm dependencies installed | available | `npm install` in helix-cli | CHK-01, CHK-02, CHK-03, CHK-04 |
| helix-global-server auth fix deployed | unknown | Server change is in a parallel repo; must be deployed before CLI artifact endpoints return 200 | CHK-06 |
| helix-global-server dev server running on port 4000 | available | Dev setup config provides .env and `npm run dev` command | CHK-06 |
| `.env` file for helix-global-server | available | Dev setup config provides full .env contents | CHK-06 |
| Valid `hxi_` API key and test ticket ID | unknown | No test credentials provided in dev setup | CHK-06 |

### Required Checks

[CHK-01] TypeScript compilation succeeds.
- Action: Run `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npx tsc --noEmit`.
- Expected Outcome: Command exits with code 0 and produces no type errors.
- Required Evidence: Terminal output showing clean exit with no error lines.

[CHK-02] Build succeeds and CLI entrypoint works.
- Action: Run `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npm run build && node dist/index.js --version`.
- Expected Outcome: Build completes successfully and `--version` outputs the version from package.json (currently `1.2.0`), not `0.1.0`.
- Required Evidence: Terminal output showing build success and correct version string.

[CHK-03] Artifact command router is wired and shows usage.
- Action: Run `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npm run build && node dist/index.js artifacts 2>&1; echo "EXIT:$?"`.
- Expected Outcome: The command outputs usage/help text for artifact subcommands (ticket, run) to stderr and exits with code 1 (since no subcommand was provided).
- Required Evidence: Terminal output showing artifact usage text and exit code 1.

[CHK-04] Top-level usage includes artifact commands.
- Action: Run `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npm run build && node dist/index.js 2>&1`.
- Expected Outcome: The top-level usage text includes artifact command examples (`hlx artifacts ticket`, `hlx artifacts run`).
- Required Evidence: Terminal output showing usage text with artifact command entries.

[CHK-05] README.md exists and contains required sections.
- Action: Read `README.md` at the helix-cli root and verify it contains sections for: installation, authentication, configuration (env vars), command reference (login, inspect, comments, artifacts), and maintainer release notes.
- Expected Outcome: All six sections are present with substantive content (not placeholder text).
- Required Evidence: File content showing each named section with non-trivial content.

[CHK-06] Artifact ticket command returns data from running server.
- Action: Write the `.env` file for helix-global-server from dev setup config. Run `npm install` in both repos. Start the helix-global-server dev server (`npm run dev` on port 4000). Then run `cd /vercel/sandbox/workspaces/cmoaat2j0007xel0ushpr9sg5/helix-cli && npm run build && HELIX_URL=http://localhost:4000 HELIX_API_KEY=<hxi_key> node dist/index.js artifacts ticket <ticket-id> --json` using a valid hxi_ API key and ticket ID.
- Expected Outcome: The command outputs JSON containing artifact data (items array and stepArtifactSummary array), or a clear "No artifacts found." message. It does not output an authentication error.
- Required Evidence: Terminal output showing the JSON response or empty-state message (not a 401 error).

[CHK-07] GitHub Actions workflow file is valid.
- Action: Verify `.github/workflows/publish.yml` exists and contains valid YAML with: trigger on push to main, checkout, setup-node, npm ci, npm run build, npm run typecheck, version comparison, and npm publish with NPM_TOKEN secret reference.
- Expected Outcome: File exists, is valid YAML, and contains all required workflow steps.
- Required Evidence: File content showing the complete workflow definition.

[CHK-08] prepublishOnly script is present in package.json.
- Action: Read `package.json` and verify the `scripts` object contains `"prepublishOnly": "npm run build"`.
- Expected Outcome: The prepublishOnly script is present and invokes `npm run build`.
- Required Evidence: Relevant excerpt from package.json showing the prepublishOnly script.

## Success Metrics

- 4 new files created: `src/artifacts/index.ts`, `src/artifacts/ticket.ts`, `src/artifacts/run.ts`, `.github/workflows/publish.yml`, `README.md` (5 total)
- 2 files modified: `src/index.ts` (version fix + artifacts case), `package.json` (prepublishOnly)
- Zero new production dependencies
- TypeScript and build pass cleanly
- `hlx --version` outputs the correct version from package.json
- `hlx artifacts ticket` and `hlx artifacts run` call the correct server endpoints via hxFetch
- README covers all commands including artifacts

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` (helix-cli) | Primary requirements source | Three deliverables: README, npm publish workflow, artifact retrieval commands |
| `scout/scout-summary.md` (helix-cli) | CLI architecture analysis | Auth boundary, version drift, zero deps, established command pattern |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause analysis | Five root causes: auth boundary, missing docs, no CI/CD, version drift, feature gap |
| `diagnosis/apl.json` (helix-cli) | Diagnosis evidence | CLI should call server API; established patterns for commands |
| `product/product.md` (helix-cli) | Product requirements and scope | Thin client, zero deps, explicit out-of-scope items, success criteria |
| `tech-research/tech-research.md` (helix-cli) | Technical decisions | createRequire for version, src/artifacts/ module structure, basePath '/api', version-change publish |
| `tech-research/apl.json` (helix-cli) | Technical rationale | All architecture decisions with evidence |
| `repo-guidance.json` | Repo intent | helix-cli is primary target; server for auth fix only |
| `src/index.ts` (direct read) | CLI entrypoint pattern | Switch/case routing, hardcoded 0.1.0 at line 47 |
| `src/comments/index.ts` (direct read) | Router pattern reference | resolveTicketId, getFlag, switch/case subcommand routing |
| `src/comments/list.ts` (direct read) | Output format reference | Human-readable console.log per item, hxFetch with basePath '/api' |
| `src/inspect/index.ts` (direct read) | Router pattern reference | getPositionalArgs helper, subcommand routing with flag parsing |
| `src/lib/http.ts` (direct read) | Transport layer | hxFetch signature, basePath option, queryParams support |
| `src/lib/config.ts` (direct read) | Config system | HxConfig type, env var names, config file path |
| `package.json` (direct read) | Package metadata | v1.2.0, ESM, zero prod deps, no prepublishOnly, files: ['dist'] |
| `tsconfig.json` (direct read) | Build config | ES2022, Node16 module, strict, outDir dist/ |

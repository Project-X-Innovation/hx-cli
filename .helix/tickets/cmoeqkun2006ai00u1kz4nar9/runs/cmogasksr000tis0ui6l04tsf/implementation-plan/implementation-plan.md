# Implementation Plan: helix-cli

## Overview

The helix-cli expansion is already implemented in the current branch. All 13 new source files exist across `src/org/` (4 files) and `src/tickets/` (10 files), implementing the full command surface: org management (current/list/switch), ticket discovery with filters (list/latest/get), ticket actions (create/rerun/continue), artifact inspection (artifacts/artifact), and Codex bundling (bundle). The config model has been extended with `orgId`/`orgName`, the entry point routes all 5 command groups, and the version is bumped to 1.2.0. Typecheck was previously confirmed to pass with zero errors.

The implementation step must:
1. Verify the existing code compiles and builds correctly.
2. Start the helix-global-server backend and test all CLI commands at runtime against the real API.
3. Fix any issues discovered during runtime testing.

## Implementation Principles

1. **Verify existing code**: All commands are already written. Focus on quality gates and runtime validation.
2. **Test against real backend**: Use the dev server at port 4000 with provided credentials to test all CLI commands.
3. **Fix-forward**: If runtime testing reveals issues, fix them in the existing files rather than rewriting.
4. **Zero production dependencies**: Maintained throughout -- all code uses Node.js built-in APIs only.
5. **Pattern consistency**: All new code follows the established switch-based routing + individual handler + `hxFetch` pattern.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Set up dev environment for both repos | `.env` for server, `npm install` in both repos |
| 2 | Run CLI quality gates | TypeScript typecheck and build pass |
| 3 | Start backend server | Dev server running on port 4000 |
| 4 | Authenticate and test org commands | Org current/list/switch verified at runtime |
| 5 | Test ticket discovery commands | Ticket list/latest/get with filters verified |
| 6 | Test ticket action commands | Create/rerun/continue verified |
| 7 | Test artifact inspection commands | Artifacts list and raw content read verified |
| 8 | Test bundle command | Deterministic local bundle created and verified |
| 9 | Test error handling | Invalid input produces clear error messages |

## Detailed Implementation Steps

### Step 1: Set up dev environment

**Goal**: Prepare both repos for building and runtime testing.

**What to Build**:
- Write `.env` file in helix-global-server root with all required env vars from dev setup config.
- Run `npm install` in helix-global-server root.
- Run `npm install` in helix-cli root.

**Verification (AI Agent Runs)**:
```bash
# In helix-global-server
test -f .env && echo "server env exists"
ls node_modules/.prisma/client/ 2>/dev/null | head -3

# In helix-cli
ls node_modules/typescript/bin/ 2>/dev/null | head -3
```

**Success Criteria**: Both repos have dependencies installed. Server has `.env` with database URL and auth secret.

### Step 2: Run CLI quality gates

**Goal**: Verify the helix-cli code compiles cleanly and produces a working build.

**What to Build**: No code changes. Run quality gates.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmogasksr000tis0ui6l04tsf/helix-cli
npm run typecheck
npm run build
ls dist/org/ dist/tickets/
```

**Success Criteria**: `tsc --noEmit` passes with zero errors. `tsc` build produces `dist/` directory with compiled JS for all command groups including `dist/org/` and `dist/tickets/`.

### Step 3: Start backend server

**Goal**: Get the helix-global-server running on port 4000 for CLI testing.

**What to Build**: No code changes. Start the server.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmogasksr000tis0ui6l04tsf/helix-global-server
npm run dev &
# Wait for port 4000 to be available
sleep 10
curl -s http://localhost:4000/api/health | head -20
```

**Success Criteria**: Server responds on port 4000.

### Step 4: Authenticate and test org commands

**Goal**: Verify `hlx org current|list|switch` work against the real backend.

**What to Build**: No code changes. Authenticate and test.

**Verification (AI Agent Runs)**:
```bash
# Authenticate to get session JWT
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"support@projectxinnovation.com","password":"=(ohR58-w"}' \
  | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.accessToken||j.token)})")

# Test org commands
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js org current
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js org list
```

**Success Criteria**: `org current` displays org name, ID, user name, email. `org list` shows available organizations with current marker.

### Step 5: Test ticket discovery commands

**Goal**: Verify `hlx tickets list|latest|get` with filters work at runtime.

**What to Build**: No code changes. Test commands.

**Verification (AI Agent Runs)**:
```bash
# List tickets
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets list

# List with status filter
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets list --status-not-in DEPLOYED,FAILED

# Get latest
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets latest

# Get specific ticket
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets get <ticket-id-from-list>
```

**Success Criteria**: List shows tickets with short ID, status, reporter, title. Filters narrow results. Get shows branch, repos, runs, merge status.

### Step 6: Test ticket action commands

**Goal**: Verify create, rerun, and continue commands work.

**What to Build**: No code changes. Test commands. Note: create and rerun/continue are destructive operations (create tickets, trigger runs). Test with caution or verify the command structure without executing if creating real tickets is undesirable.

**Verification (AI Agent Runs)**:
```bash
# Test continue (uses rerun endpoint with continuationContext)
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets continue <ticket-id> "test context"
```

**Success Criteria**: Commands call the correct backend endpoints. Continue sends `continuationContext` via the rerun endpoint. Error responses from the backend are displayed clearly.

### Step 7: Test artifact inspection commands

**Goal**: Verify artifact discovery and raw content reads work.

**What to Build**: No code changes. Test commands.

**Verification (AI Agent Runs)**:
```bash
# List artifacts for a ticket with completed runs
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets artifacts <ticket-id>

# Read a specific step artifact
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets artifact <ticket-id> --step <step-id> --repo <repo-key>
```

**Success Criteria**: Artifacts command lists items and step artifact summaries. Artifact command prints raw markdown/JSON content to stdout.

### Step 8: Test bundle command

**Goal**: Verify the bundle creates a deterministic local directory.

**What to Build**: No code changes. Test the bundle command.

**Verification (AI Agent Runs)**:
```bash
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets bundle <ticket-id> --out /tmp/test-bundle
ls -R /tmp/test-bundle/
cat /tmp/test-bundle/manifest.json
```

**Success Criteria**: Bundle directory contains `ticket.json`, `manifest.json`, and `artifacts/<step>/<repo>/<file>` structure. `manifest.json` has `ticketId`, `bundledAt`, and `cliVersion` fields.

### Step 9: Test error handling

**Goal**: Verify invalid inputs produce clear, non-silent error messages.

**What to Build**: No code changes. Test error cases.

**Verification (AI Agent Runs)**:
```bash
# Missing ticket ID
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets get 2>&1

# Unknown subcommand
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets foobar 2>&1

# Missing required flags for create
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js tickets create 2>&1

# Invalid org switch
HELIX_API_KEY=$TOKEN HELIX_URL=http://localhost:4000 node dist/index.js org switch nonexistent-org 2>&1
```

**Success Criteria**: All invalid input scenarios produce clear error messages to stderr and exit with code 1. No silent failures or unhandled exceptions.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|---|---|---|---|
| `npm install` completed in helix-cli | available | Standard setup step | CHK-01, CHK-02, CHK-03 through CHK-12 |
| `npm install` completed in helix-global-server | available | Standard setup step | CHK-03 through CHK-12 |
| helix-global-server `.env` file written with all env vars | available | Dev setup config provides all required values | CHK-03 through CHK-12 |
| helix-global-server dev server running on port 4000 | available | Dev setup config: port 4000, dev command: `npm run dev` | CHK-03 through CHK-12 |
| helix-cli built via `npm run build` | available | package.json has build script: `tsc` | CHK-03 through CHK-12 |
| Valid session JWT obtained from `POST /api/auth/login` with dev credentials (support@projectxinnovation.com / =(ohR58-w)) | available | Dev setup config provides login credentials | CHK-03 through CHK-12 |
| Org with existing tickets in the connected database | available | Production Neon DB has 381 tickets per diagnosis runtime evidence | CHK-06, CHK-07, CHK-08, CHK-09, CHK-10, CHK-11 |

### Required Checks

[CHK-01] TypeScript typecheck passes.
- Action: Run `npm run typecheck` (which runs `tsc --noEmit`) in the helix-cli directory after `npm install`.
- Expected Outcome: Command exits with code 0 and no type errors reported.
- Required Evidence: Command output showing successful completion with exit code 0.

[CHK-02] Build completes and dist/ directory contains all command groups.
- Action: Run `npm run build` (which runs `tsc`) in the helix-cli directory. List the contents of the `dist/` directory.
- Expected Outcome: Command exits with code 0. `dist/` contains `index.js`, `org/` directory (with `index.js`, `current.js`, `list.js`, `switch.js`), and `tickets/` directory (with `index.js`, `list.js`, `latest.js`, `get.js`, `create.js`, `rerun.js`, `continue.js`, `artifacts.js`, `artifact.js`, `bundle.js`).
- Required Evidence: Build command output showing exit code 0, plus directory listing of `dist/org/` and `dist/tickets/` confirming all expected JS files are present.

[CHK-03] `hlx org current` displays current org and user.
- Action: Start the helix-global-server dev server on port 4000. Obtain a session JWT by calling `POST /api/auth/login` with dev credentials (support@projectxinnovation.com / =(ohR58-w)) against `http://localhost:4000`. Set `HELIX_API_KEY=<jwt>` and `HELIX_URL=http://localhost:4000`. Run `node dist/index.js org current`.
- Expected Outcome: Output displays the current organization name, org ID, user name, and user email.
- Required Evidence: Command output showing all four fields (org name, org ID, user name, email) from the dev server at port 4000.

[CHK-04] `hlx org list` displays available organizations.
- Action: Using the same env vars from CHK-03, run `node dist/index.js org list`.
- Expected Outcome: Output lists one or more organizations with IDs and names. The current org is marked with `(current)`.
- Required Evidence: Command output showing at least one organization entry with ID and name.

[CHK-05] `hlx org switch` changes the active org context.
- Action: Using the same env vars from CHK-03, if multiple orgs are available from CHK-04, run `node dist/index.js org switch <org-name-or-id>` with a valid org. Then run `node dist/index.js org current` to verify the switch. If only one org is available, attempt to switch to the current org (should succeed idempotently) or test with an invalid org name to verify the error path.
- Expected Outcome: Switch command shows confirmation "Switched to org: <name>". Subsequent `org current` shows the switched org context.
- Required Evidence: Output from both the switch and current commands. If only one org exists, output from the switch command showing confirmation of the same org, or error output for invalid org showing available orgs list.

[CHK-06] `hlx tickets list` returns org-scoped tickets.
- Action: Run `node dist/index.js tickets list` with the dev server env vars.
- Expected Outcome: Output displays a formatted list of tickets from the current org, with each line showing short ID, status, reporter, timestamp, and title.
- Required Evidence: Command output showing ticket entries (short IDs, statuses, titles). If the org has no tickets, the output shows "No tickets found."

[CHK-07] `hlx tickets list` with `--status-not-in` filter narrows results.
- Action: Run `node dist/index.js tickets list --status-not-in DEPLOYED,FAILED` with the dev server env vars.
- Expected Outcome: Output displays only tickets whose status is NOT DEPLOYED or FAILED. The result set is a subset of or equal to the unfiltered list from CHK-06.
- Required Evidence: Command output showing filtered ticket list where no entries have DEPLOYED or FAILED status.

[CHK-08] `hlx tickets get` shows full ticket detail with branch, repos, and runs.
- Action: Run `node dist/index.js tickets get <ticket-id>` using a valid ticket ID from CHK-06 output.
- Expected Outcome: Output includes: Title, Short ID, Status, Branch name, Reporter, Repositories section (display name and repo URL), Runs section (run ID, status, timestamps).
- Required Evidence: Command output containing all expected fields: Title, Branch, at least one repository entry, at least one run entry.

[CHK-09] `hlx tickets artifacts` lists step artifact summaries.
- Action: Run `node dist/index.js tickets artifacts <ticket-id>` using a ticket ID that has completed runs (pick one with a non-QUEUED/RUNNING status from CHK-06).
- Expected Outcome: Output lists artifact items and/or step artifact summary entries showing step ID and repo key pairs. If the ticket has no artifacts, the output shows "No artifacts found." or "No step artifacts found."
- Required Evidence: Command output showing artifact entries. If a ticket with completed artifacts is available, output includes at least one step artifact summary entry.

[CHK-10] `hlx tickets artifact` prints raw step artifact content.
- Action: Using step ID and repo key from CHK-09 output, run `node dist/index.js tickets artifact <ticket-id> --step <step-id> --repo <repo-key>`.
- Expected Outcome: Raw markdown or JSON content is printed directly to stdout without wrapping or formatting. If the artifact has multiple files, each file is preceded by a filename header.
- Required Evidence: Command output containing raw artifact text (markdown or JSON content), not an error message or empty output.

[CHK-11] `hlx tickets bundle` creates deterministic local bundle.
- Action: Run `node dist/index.js tickets bundle <ticket-id> --out /tmp/test-bundle` using a ticket with completed runs.
- Expected Outcome: The `/tmp/test-bundle/` directory is created containing: `ticket.json` (full ticket detail JSON), `manifest.json` (with `ticketId`, `bundledAt`, `cliVersion` fields), and `artifacts/<stepId>/<repoKey>/<filename>` files for available step artifacts.
- Required Evidence: Directory listing of `/tmp/test-bundle/` showing `ticket.json` and `manifest.json`. Contents of `manifest.json` showing `ticketId`, `bundledAt` (ISO timestamp), and `cliVersion` ("1.2.0") fields. If artifacts were available, at least one file under `artifacts/`.

[CHK-12] Error handling produces clear messages for invalid input.
- Action: Run `node dist/index.js tickets get` (missing ticket ID), `node dist/index.js tickets foobar` (unknown subcommand), and `node dist/index.js org switch nonexistent-org-name` (invalid org) with the dev server env vars.
- Expected Outcome: Each command exits with non-zero exit code and prints a clear error message to stderr. Missing ticket ID error lists the three resolution methods (--ticket, HELIX_TICKET_ID, positional). Unknown subcommand shows usage text. Invalid org shows available organizations.
- Required Evidence: Error output from all three commands showing descriptive error messages (not stack traces or silent failures).

## Success Metrics

- TypeScript compiles with zero errors (`tsc --noEmit` passes)
- Build produces complete `dist/` directory with all command groups
- All 5 command groups route correctly (org, tickets, login, inspect, comments)
- Org switching persists new JWT and org metadata
- Ticket listing supports filters (--user, --status, --status-not-in, --archived, --sprint)
- Ticket detail shows branch, repos, runs, merge status
- Artifact inspection prints raw content
- Bundle creates deterministic local context for Codex
- Continue uses existing rerun endpoint with continuationContext
- Invalid inputs produce clear, non-silent error messages
- Zero production dependencies maintained
- CLI version is 1.2.0

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md (helix-cli) | Primary ticket specification | Full command surface, filters, constraints, acceptance criteria |
| scout/reference-map.json (helix-cli) | File inventory and facts | 13 new files implemented, typecheck passes, zero deps, all commands present |
| scout/scout-summary.md (helix-cli) | Architecture and pattern analysis | Switch-based routing, manual flag parsing, hxFetch shared client, config model |
| diagnosis/diagnosis-statement.md (helix-cli) | Gap analysis | Feature expansion confirmed complete; all acceptance criteria met |
| diagnosis/apl.json (helix-cli) | Diagnostic evidence | Thin client confirmed, continue uses rerun, no blocking gaps |
| product/product.md (helix-cli) | Product vision and scope | Two audiences (human + Codex); org-scoped; zero deps; deferred features |
| tech-research/tech-research.md (helix-cli) | Architecture decisions | Switch routing, shared flags, config extension, bundle layout, user resolution |
| tech-research/apl.json (helix-cli) | Tech evidence | All architecture decisions evidence-backed |
| diagnosis/diagnosis-statement.md (helix-global-server) | Backend API coverage | All endpoints pre-existed; reporterUserId change is minimal |
| scout/scout-summary.md (helix-global-server) | Backend API surface | 14+ CLI routes mapped; auth architecture documented |
| repo-guidance.json | Cross-repo intent | helix-cli = primary target, helix-global-server = minor target |
| src/index.ts (helix-cli, direct inspection) | CLI entry point | 5 command groups routed; version 1.2.0; usage text covers all |
| src/lib/config.ts (direct inspection) | Config model | HxConfig includes orgId/orgName; env var priority; saveConfig |
| src/lib/http.ts (direct inspection) | HTTP client | hxFetch with retry, auth dispatch, basePath; all new commands use /api |
| src/lib/flags.ts (direct inspection) | Flag parsing | getFlag, hasFlag, requireFlag, getPositionalArgs shared module |
| src/org/*.ts (direct inspection) | Org commands | current/list/switch all implemented following established patterns |
| src/tickets/*.ts (direct inspection) | Ticket commands | All 9 subcommands implemented with correct endpoint mapping |
| package.json (direct inspection) | Build/version | Version 1.2.0, zero prod deps, tsc build, typecheck scripts |
| tsconfig.json (direct inspection) | TS config | ES2022 target, Node16 module, strict mode, declaration |

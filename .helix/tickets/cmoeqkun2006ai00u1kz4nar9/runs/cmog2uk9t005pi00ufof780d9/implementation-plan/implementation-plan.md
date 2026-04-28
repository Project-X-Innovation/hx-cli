# Implementation Plan: helix-cli

## Overview

Expand `helix-cli` from a narrow inspection tool (login, inspect, comments) into an org-aware Helix workbench. Add two new command groups (`org`, `tickets`) following the existing command pattern. The CLI remains a thin client over the Helix backend API with zero production dependencies.

New commands:
- `hlx org current|list|switch` - org management
- `hlx tickets list|latest|get` - ticket discovery with filters (`--user`, `--status`, `--status-not-in`, `--archived`, `--sprint`)
- `hlx tickets create|rerun|continue` - ticket actions
- `hlx tickets artifacts|artifact` - artifact inspection
- `hlx tickets bundle` - local Codex context bundle

## Implementation Principles

- Follow existing patterns: switch-based routing, subcommand routers, individual handler files, `hxFetch` with `basePath: "/api"`.
- Zero production dependencies: use only Node.js built-in APIs.
- Thin client: all data fetched from Helix backend; no client-side data invention.
- ESM module: all imports use `.js` extensions per Node16 module resolution.
- Backward-compatible: existing login, inspect, and comments commands unchanged.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|---|---|---|
| 1 | Shared flag parsing utilities | `src/lib/flags.ts` |
| 2 | Extend config for org awareness | Modified `src/lib/config.ts` |
| 3 | Org command group | `src/org/index.ts`, `current.ts`, `list.ts`, `switch.ts` |
| 4 | Tickets router + discovery commands | `src/tickets/index.ts`, `list.ts`, `latest.ts`, `get.ts` |
| 5 | Ticket action commands | `src/tickets/create.ts`, `rerun.ts`, `continue.ts` |
| 6 | Artifact inspection commands | `src/tickets/artifacts.ts`, `artifact.ts` |
| 7 | Bundle command | `src/tickets/bundle.ts` |
| 8 | Register commands + fix version | Modified `src/index.ts` |
| 9 | Refactor existing flag parsing | Modified `src/comments/index.ts`, `src/comments/list.ts`, `src/inspect/index.ts` |

## Detailed Implementation Steps

### Step 1: Create Shared Flag Parsing Utilities

**Goal:** Eliminate flag parsing duplication and provide a consistent utility for all command groups.

**What to Build:**

Create `src/lib/flags.ts` exporting:
- `getFlag(args: string[], flag: string): string | undefined` - returns flag value or undefined (mirrors existing pattern from `comments/index.ts:5-9`)
- `hasFlag(args: string[], flag: string): boolean` - returns true if flag is present (for boolean flags like `--archived`)
- `getPositionalArgs(args: string[], excludeFlags: string[]): string[]` - returns non-flag args (mirrors existing pattern from `inspect/index.ts:13-20`)
- `requireFlag(args: string[], flag: string, errorMsg: string): string` - getFlag + throws error if missing

**Verification (AI Agent Runs):**
```bash
cd /vercel/sandbox/workspaces/cmog2uk9t005pi00ufof780d9/helix-cli
npx tsc --noEmit
```

**Success Criteria:**
- Module compiles cleanly with strict TypeScript.
- Exports all four functions with correct signatures.

### Step 2: Extend Config for Org Awareness

**Goal:** Store current org metadata after org switch so `hlx org current` can work without a network call.

**What to Build:**

Modify `src/lib/config.ts`:
- Extend `HxConfig` type to add `orgId?: string` and `orgName?: string`.
- Update `loadConfig()` to read `orgId`/`orgName` from config file when present (optional fields, backward-compatible).
- Update `saveConfig()` to write `orgId`/`orgName` when present in the config object.
- No changes to env-var priority logic.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- `HxConfig` type includes optional `orgId` and `orgName`.
- Existing config files without these fields load correctly (backward-compatible).

### Step 3: Create Org Command Group

**Goal:** Implement `hlx org current|list|switch` commands.

**What to Build:**

1. **`src/org/index.ts`** - Router function `runOrg(config, args)`:
   - Switch-based subcommand dispatch for `current`, `list`, `switch`.
   - Usage/error output for unknown subcommands.
   - Follow the pattern of `src/comments/index.ts`.

2. **`src/org/current.ts`** - `cmdOrgCurrent(config)`:
   - Call `GET /api/auth/me` via `hxFetch(config, "/auth/me", { basePath: "/api" })`.
   - Display: org name, org ID, user name, user email.
   - If config has cached `orgId`/`orgName`, display those. Always fetch fresh data from server for accuracy.

3. **`src/org/list.ts`** - `cmdOrgList(config)`:
   - Call `GET /api/auth/me` via `hxFetch`.
   - Display `availableOrganizations` array as a table: ID, name, with `(current)` marker for the active org.

4. **`src/org/switch.ts`** - `cmdOrgSwitch(config, args)`:
   - Take org identifier from positional args (can be org ID or org name).
   - If input looks like a name (not a CUID), call `GET /api/auth/me` to resolve name to ID from `availableOrganizations`.
   - Call `POST /api/auth/switch-org` with `{ organizationId }` via `hxFetch`.
   - On success: overwrite config `apiKey` with new `accessToken`, store `orgId`/`orgName` from response.
   - Call `saveConfig()` with the updated config.
   - Display confirmation: "Switched to org: <name>".

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- All three commands compile and follow the hxFetch + basePath: "/api" pattern.
- Org switch persists the new token and org metadata to config.

### Step 4: Create Tickets Router and Discovery Commands

**Goal:** Implement `hlx tickets list|latest|get` with filter support.

**What to Build:**

1. **`src/tickets/index.ts`** - Router function `runTickets(config, args)`:
   - Switch-based dispatch for: `list`, `latest`, `get`, `create`, `rerun`, `continue`, `artifacts`, `artifact`, `bundle`.
   - Use `getFlag` from `src/lib/flags.ts` for ticket ID resolution (from `--ticket` flag or `HELIX_TICKET_ID` env var or positional arg).
   - Usage/error output for unknown subcommands.

2. **`src/tickets/list.ts`** - `cmdTicketsList(config, args)`:
   - Build `queryParams` from flags:
     - `--status-not-in <statuses>` -> `statusNotIn=<statuses>`
     - `--archived` (boolean flag) -> `archived=true`
     - `--sprint <id>` -> `sprintId=<id>`
     - `--status <status>` -> `statusNotIn` set to all other statuses (invert to match API), OR client-side filter (simpler: fetch all, filter by status client-side since the API doesn't have a direct `status` param)
     - `--user <email-or-name>` -> resolve to `reporterUserId` (see user resolution below)
   - **User resolution for `--user`**: Call `GET /api/organization/members` via `hxFetch(config, "/organization/members", { basePath: "/api" })`. Match input against member email (exact) then name (case-insensitive). If no match, error with available users listed. Use resolved `id` as `reporterUserId` query param.
   - Call `GET /api/tickets` via `hxFetch` with built `queryParams`.
   - Display as a table: shortId, title, status, reporter name/email, updatedAt.

3. **`src/tickets/latest.ts`** - `cmdTicketsLatest(config, args)`:
   - Call `GET /api/tickets` via `hxFetch` (same as list, respects same filters).
   - Take `items[0]` from response (backend returns sorted by `updatedAt: desc`).
   - Display full ticket summary (same format as `hlx tickets get`).

4. **`src/tickets/get.ts`** - `cmdTicketsGet(config, ticketId)`:
   - Call `GET /api/tickets/<ticketId>` via `hxFetch`.
   - Display comprehensive detail:
     - Title, short ID, status
     - Branch name
     - Repositories (name, URL)
     - Run history (run ID, status, timestamps)
     - Merge queue status (if present)
     - Reporter name/email
     - Description (truncated if very long)

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- List command supports all five filter flags.
- User resolution works via org members endpoint.
- Get command displays branch, repos, runs, merge status.
- Latest is a convenience shortcut over list.

### Step 5: Create Ticket Action Commands

**Goal:** Implement `hlx tickets create|rerun|continue`.

**What to Build:**

1. **`src/tickets/create.ts`** - `cmdTicketsCreate(config, args)`:
   - Parse flags: `--title <title>`, `--description <desc>`, `--repos <repo1,repo2>`.
   - All three flags are required; error if missing.
   - Call `POST /api/tickets` with `{ title, description, repositoryIds: repos.split(",") }` via `hxFetch`.
   - Display: created ticket ID, short ID, status, run ID.

2. **`src/tickets/rerun.ts`** - `cmdTicketsRerun(config, ticketId)`:
   - Call `POST /api/tickets/<ticketId>/rerun` with empty body `{}` via `hxFetch`.
   - Display: "Rerun started" with new run ID.

3. **`src/tickets/continue.ts`** - `cmdTicketsContinue(config, ticketId, args)`:
   - Collect continuation context from positional args (everything not a flag, joined with spaces).
   - If no context provided, error with clear message.
   - Call `POST /api/tickets/<ticketId>/rerun` with `{ continuationContext }` via `hxFetch`.
   - Display: "Continue started" with new run ID.
   - **Critical**: This uses the existing rerun endpoint. Do NOT create a separate backend "continue" concept.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- Create validates required flags and calls POST /api/tickets.
- Rerun calls POST /api/tickets/:id/rerun with empty body.
- Continue calls POST /api/tickets/:id/rerun with `continuationContext` in body.

### Step 6: Create Artifact Inspection Commands

**Goal:** Implement `hlx tickets artifacts|artifact` for discovering and reading step artifacts.

**What to Build:**

1. **`src/tickets/artifacts.ts`** - `cmdTicketsArtifacts(config, ticketId)`:
   - Call `GET /api/tickets/<ticketId>/artifacts` via `hxFetch`.
   - Display two sections:
     - **Artifacts**: list `items[]` with label, repo URL, branch, path.
     - **Step Artifact Summary**: list `stepArtifactSummary[]` with step ID, repo key. This is the data needed for the `artifact` command.

2. **`src/tickets/artifact.ts`** - `cmdTicketsArtifact(config, ticketId, args)`:
   - Parse flags: `--step <stepId>`, `--repo <repoKey>`, `--run <runId>` (optional).
   - `--step` and `--repo` are required.
   - If `--run` is not provided, need the latest run ID. Call `GET /api/tickets/<ticketId>` to get `currentRun.id` or the latest from `runs[]`.
   - Call `GET /api/tickets/<ticketId>/runs/<runId>/step-artifacts/<stepId>?repoKey=<repoKey>` via `hxFetch`.
   - Print each file's content directly to stdout (raw markdown/JSON). If multiple files, print filename header between each.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- Artifacts command lists both items and step artifact summaries.
- Artifact command fetches and prints raw file content.
- Step and repo flags are required; run is optional (defaults to latest).

### Step 7: Create Bundle Command

**Goal:** Implement `hlx tickets bundle <ticket-id> --out <dir>` for local Codex context.

**What to Build:**

Create `src/tickets/bundle.ts` - `cmdTicketsBundle(config, ticketId, args)`:

1. Parse `--out <dir>` flag (required).
2. Fetch ticket detail: `GET /api/tickets/<ticketId>`.
3. Fetch artifacts: `GET /api/tickets/<ticketId>/artifacts`.
4. Create output directory structure:
   ```
   <out-dir>/
     ticket.json              # Full ticket detail response
     artifacts/
       <step-id>/
         <repo-key>/
           <filename>         # Raw artifact file content
     manifest.json            # { ticketId, bundledAt, cliVersion }
   ```
5. Write `ticket.json`: JSON.stringify the full ticket detail response.
6. For each entry in `stepArtifactSummary`:
   - Determine the run ID (use current/latest run).
   - Call `GET /api/tickets/<ticketId>/runs/<runId>/step-artifacts/<stepId>?repoKey=<repoKey>`.
   - For each file in the response, write to `artifacts/<stepId>/<repoKey>/<filename>`.
7. Write `manifest.json` with `{ ticketId, bundledAt: new Date().toISOString(), cliVersion: "1.2.0" }`.
8. Use `node:fs` (`mkdirSync`, `writeFileSync`) and `node:path` (`join`) - all built-in.
9. Display summary: total files written, output path.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- Bundle creates the deterministic directory structure.
- `ticket.json` contains the full ticket detail.
- Artifacts are organized by step/repo.
- `manifest.json` provides provenance metadata.

### Step 8: Register Commands in Entry Point + Fix Version

**Goal:** Wire up the new command groups and fix the version mismatch.

**What to Build:**

Modify `src/index.ts`:

1. Add imports:
   ```typescript
   import { runOrg } from "./org/index.js";
   import { runTickets } from "./tickets/index.js";
   ```

2. Add switch cases after `"comments"` case:
   ```typescript
   case "org": {
     const config = requireConfig();
     await runOrg(config, args.slice(1));
     break;
   }
   case "tickets": {
     const config = requireConfig();
     await runTickets(config, args.slice(1));
     break;
   }
   ```

3. Update version from `"0.1.0"` to `"1.2.0"` (line 47) to match `package.json`.

4. Update the usage string to include all new commands:
   ```
   hlx org current|list|switch        Manage org context
   hlx tickets list|latest|get        Discover and inspect tickets
   hlx tickets create|rerun|continue  Ticket actions
   hlx tickets artifacts|artifact     Inspect step artifacts
   hlx tickets bundle <id> --out <dir> Bundle for Codex
   ```

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
node dist/index.js --version
```

**Success Criteria:**
- `hlx --version` outputs `1.2.0`.
- `hlx org` and `hlx tickets` route to the new command groups.
- Unknown commands still show updated usage text.

### Step 9: Refactor Existing Flag Parsing to Use Shared Module

**Goal:** Remove duplicated `getFlag`/`getPositionalArgs` functions from existing command files.

**What to Build:**

1. **`src/comments/index.ts`**: Remove local `getFlag` function (lines 5-9). Import `{ getFlag }` from `"../lib/flags.js"`.

2. **`src/comments/list.ts`**: Remove local `getFlag` function (lines 15-19). Import `{ getFlag }` from `"../lib/flags.js"`.

3. **`src/inspect/index.ts`**: Remove local `getFlag` and `getPositionalArgs` functions (lines 7-20). Import `{ getFlag, getPositionalArgs }` from `"../lib/flags.js"`.

**Verification (AI Agent Runs):**
```bash
npx tsc --noEmit
```

**Success Criteria:**
- All existing commands continue to compile and work with shared flag utilities.
- No duplicate `getFlag`/`getPositionalArgs` functions remain in the codebase.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|---|---|---|---|
| `npm install` completed in helix-cli | available | Standard setup step | CHK-01, CHK-02 |
| helix-global-server `.env` file written | available | Dev setup config provides all env vars | CHK-03 through CHK-12 |
| `npm install` completed in helix-global-server | available | Standard setup step | CHK-03 through CHK-12 |
| helix-global-server dev server running on port 4000 (`npm run dev`) | available | Dev setup config: port 4000 | CHK-03 through CHK-12 |
| Valid session JWT obtained via `POST /api/auth/login` with dev credentials (support@projectxinnovation.com / =(ohR58-w) | available | Dev setup config provides login credentials | CHK-03 through CHK-12 |
| helix-cli built (`npm run build`) | available | package.json has build script | CHK-03 through CHK-12 |
| Org with existing tickets in the dev database | unknown | Depends on database state; tickets may need to be created first via CLI or API | CHK-06, CHK-07, CHK-08, CHK-09, CHK-10, CHK-11 |

### Required Checks

[CHK-01] TypeScript typecheck passes.
- Action: Run `npm run typecheck` in the helix-cli directory.
- Expected Outcome: Command exits with code 0 and no type errors.
- Required Evidence: Command output showing successful completion with exit code 0.

[CHK-02] Build completes successfully.
- Action: Run `npm run build` in the helix-cli directory.
- Expected Outcome: Command exits with code 0 and `dist/` directory is populated with compiled JavaScript.
- Required Evidence: Command output showing successful build, plus file listing of `dist/` directory confirming new files (org/, tickets/) are present.

[CHK-03] `hlx org current` displays current org and user.
- Action: Set `HELIX_URL=http://localhost:4000` and `HELIX_API_KEY=<session-jwt>` (obtained from POST /api/auth/login against the dev server at port 4000). Run `node dist/index.js org current`.
- Expected Outcome: Output displays the current organization name, org ID, user name, and user email.
- Required Evidence: Command output showing org and user information from the configured dev server at port 4000.

[CHK-04] `hlx org list` displays available organizations.
- Action: Using the same env vars from CHK-03, run `node dist/index.js org list`.
- Expected Outcome: Output lists one or more organizations with IDs and names. The current org is marked.
- Required Evidence: Command output showing at least one organization entry.

[CHK-05] `hlx org switch` changes the active org context.
- Action: Using the same env vars from CHK-03, run `node dist/index.js org switch <org-name-or-id>` with a valid org from the list in CHK-04. Then run `node dist/index.js org current` to verify the switch took effect.
- Expected Outcome: Switch command shows confirmation. Subsequent `org current` shows the new org. The config file at `~/.hlx/config.json` is updated with the new token and org metadata.
- Required Evidence: Output from both the switch and current commands, plus contents of `~/.hlx/config.json` showing updated `orgId`/`orgName`.

[CHK-06] `hlx tickets list` returns org-scoped tickets.
- Action: Run `node dist/index.js tickets list` with the dev server env vars.
- Expected Outcome: Output displays a list of tickets from the current org, showing short ID, title, status, reporter, and updated timestamp.
- Required Evidence: Command output showing at least one ticket entry (or an empty list message if no tickets exist, which would indicate the dev database needs seeding first).

[CHK-07] `hlx tickets list` with `--status-not-in` filter works.
- Action: Run `node dist/index.js tickets list --status-not-in DEPLOYED,FAILED`.
- Expected Outcome: Output displays only tickets whose status is NOT DEPLOYED or FAILED.
- Required Evidence: Command output showing filtered ticket list where no entries have DEPLOYED or FAILED status.

[CHK-08] `hlx tickets get` shows full ticket detail.
- Action: Run `node dist/index.js tickets get <ticket-id>` with a valid ticket ID from CHK-06.
- Expected Outcome: Output includes: title, short ID, status, branch name, repositories (name and URL), run history (at least one run with ID and status), and merge queue status.
- Required Evidence: Command output containing all expected fields: title, branchName, repositories list, runs list.

[CHK-09] `hlx tickets artifacts` lists step artifact summaries.
- Action: Run `node dist/index.js tickets artifacts <ticket-id>` with a ticket that has completed runs.
- Expected Outcome: Output lists available artifacts and step artifact summaries (step ID + repo key pairs).
- Required Evidence: Command output showing step artifact summary entries.

[CHK-10] `hlx tickets artifact` prints raw artifact content.
- Action: Run `node dist/index.js tickets artifact <ticket-id> --step <step-id> --repo <repo-key>` using values from CHK-09.
- Expected Outcome: Raw markdown or JSON content is printed directly to stdout.
- Required Evidence: Command output containing the raw artifact file content (not an error message or empty output).

[CHK-11] `hlx tickets bundle` creates deterministic local bundle.
- Action: Run `node dist/index.js tickets bundle <ticket-id> --out /tmp/test-bundle` with a ticket that has completed runs.
- Expected Outcome: The `/tmp/test-bundle/` directory is created with: `ticket.json`, `manifest.json`, and `artifacts/<step>/<repo>/<file>` structure.
- Required Evidence: Directory listing of `/tmp/test-bundle/` showing `ticket.json`, `manifest.json`, and at least one artifact file. Contents of `manifest.json` showing ticketId and bundledAt fields.

[CHK-12] `hlx tickets continue` sends continuationContext via rerun endpoint.
- Action: Run `node dist/index.js tickets continue <ticket-id> "test continuation context"` against the dev server at port 4000.
- Expected Outcome: The command calls POST /api/tickets/:id/rerun with `{ continuationContext: "test continuation context" }` and displays a confirmation with a new run ID.
- Required Evidence: Command output showing "Continue started" (or equivalent) with a run ID. If the server rejects the rerun for workflow reasons, the error message from the backend is displayed (not a silent failure or client-side crash).

## Success Metrics

- All 9 implementation steps compile cleanly (typecheck passes).
- The built CLI binary routes `org` and `tickets` commands correctly.
- Org switching persists the new JWT and org metadata.
- Ticket listing supports all five filter flags (--user, --status, --status-not-in, --archived, --sprint).
- Ticket detail shows branch, repos, runs, and merge status.
- Artifact inspection prints raw content.
- Bundle creates deterministic local context for Codex.
- Continue uses the existing rerun endpoint with continuationContext.
- All invalid inputs produce clear, non-silent error messages.
- Zero production dependencies maintained.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md | Primary specification | Defined full command surface, filters, constraints, acceptance criteria |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis | Confirmed feature-addition gap, auth compatibility, clean patterns |
| diagnosis/apl.json (helix-cli) | Diagnosis evidence | Confirmed OAuth JWT flow, config sufficiency, all backend endpoints present |
| product/product.md | Product direction | Defined command surface, UX principles, bundle concept, open questions resolved |
| tech-research/tech-research.md (helix-cli) | Architecture decisions | Chose: extend existing patterns, shared flags.ts, config extension, bundle layout, user resolution strategy, version fix |
| tech-research/apl.json (helix-cli) | Tech research evidence | Confirmed zero-dep constraint, switch routing, flag consolidation |
| scout/scout-summary.md (helix-cli) | CLI architecture analysis | Mapped current command surface and identified existing patterns to follow |
| scout/reference-map.json (helix-cli) | File inventory | Identified 11 relevant files, version mismatch, zero-dep constraint |
| diagnosis/diagnosis-statement.md (helix-global-server) | Backend gap analysis | Confirmed reporterUserId is the only missing param; backend API otherwise complete |
| scout/scout-summary.md (helix-global-server) | Backend API mapping | All endpoint shapes and auth requirements documented |
| repo-guidance.json | Repo intent | Confirmed helix-cli as primary target with ~12-15 new files |
| src/index.ts (helix-cli) | Direct code inspection | Verified switch-based routing pattern, version mismatch at line 47 |
| src/lib/config.ts (helix-cli) | Direct code inspection | Verified {apiKey, url} schema, saveConfig/loadConfig behavior |
| src/lib/http.ts (helix-cli) | Direct code inspection | Verified hxFetch auth header routing, basePath convention, retry logic |
| src/comments/index.ts (helix-cli) | Direct code inspection | Verified subcommand routing pattern to replicate |
| src/comments/list.ts (helix-cli) | Direct code inspection | Verified GET handler pattern with hxFetch and basePath "/api" |
| src/comments/post.ts (helix-cli) | Direct code inspection | Verified POST handler pattern with body |
| src/inspect/index.ts (helix-cli) | Direct code inspection | Verified getPositionalArgs utility and subcommand pattern |
| src/login.ts (helix-cli) | Direct code inspection | Verified OAuth callback stores key as apiKey (session JWT) |

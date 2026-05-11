# Implementation Plan — BLD-401

## Overview

Fix three usability defects in `hlx tickets create`: resolve repo names/keys before API calls, add `--description-file` with file-path detection, and add `update-description` subcommand. All changes are CLI-only in helix-cli. No server modifications needed — the server already supports all required endpoints.

**Files modified**: 3 existing (`src/lib/resolve-repo.ts`, `src/tickets/create.ts`, `src/tickets/index.ts`)
**Files created**: 1 new (`src/tickets/update-description.ts`)

## Implementation Principles

- Reuse existing infrastructure: `resolveRepo` pattern, `extractTicketRef + resolveTicket` pattern, `hxFetch` with PATCH.
- Fail fast, fail clearly: All validation (repo resolution, file existence, flag conflicts) happens before any API call.
- Follow existing conventions: one file per subcommand, switch-based dispatch, sync flag parsing.
- No new dependencies: use Node.js built-in `node:fs` (already in use by `config.ts`).
- Throw errors in new code (not `process.exit`) to allow callers to format messages.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Batch repo resolution function | `resolveAllRepos()` in `src/lib/resolve-repo.ts` |
| 2 | Rework `create.ts` for description handling and repo resolution | Modified `src/tickets/create.ts` |
| 3 | New `update-description` subcommand handler | New `src/tickets/update-description.ts` |
| 4 | Register subcommand and update help text | Modified `src/tickets/index.ts` |
| 5 | Quality gates | Typecheck, build, and test pass |

## Detailed Implementation Steps

### Step 1: Add `resolveAllRepos()` to `src/lib/resolve-repo.ts`

**Goal**: Provide a batch repo resolution function that makes one API call and reports all unknown entries at once.

**What to Build**:
- Add a new exported async function `resolveAllRepos(config: HxConfig, namesOrIds: string[]): Promise<string[]>` to `src/lib/resolve-repo.ts`.
- The function calls `listRepos(config)` once to fetch the full repo list.
- For each entry in `namesOrIds`, apply the same matching logic as `resolveRepo`: exact ID match > exact `displayName` match (case-insensitive) > partial `displayName` match.
- Collect all unresolved entries. If any exist, throw an `Error` with a message listing all unknown entries and all available repos (displayName + id). Do NOT call `process.exit` — the caller (`create.ts`) formats the final error with the `hlx inspect repos` reference.
- On success, return `string[]` of resolved repository IDs in the same input order.
- Do not modify the existing `resolveRepo()` function (used by 3 other callers: `inspect logs`, `inspect db`, `inspect api`).

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes after adding the function.
- The function signature is exported and the `RepoInfo` type is available (already defined at line 4).

**Success Criteria**:
- `resolveAllRepos` is exported from `resolve-repo.ts`.
- It calls `listRepos` exactly once regardless of input array length.
- It throws `Error` (not `process.exit`) on any unresolved entry.
- Existing `resolveRepo` function is unchanged.

---

### Step 2: Rework `src/tickets/create.ts` — description handling and repo resolution

**Goal**: Replace raw `--repos` pass-through with `resolveAllRepos`, add `--description-file` flag, add mutual exclusivity, and add file-path detection on `--description`.

**What to Build**:

1. **Import changes**: Add `import { readFileSync, accessSync, statSync, constants } from "node:fs"` and `import { resolveAllRepos } from "../lib/resolve-repo.js"`.

2. **Replace `requireFlag('--description')` with dual-flag logic**:
   - `const descriptionRaw = getFlag(args, '--description');`
   - `const descriptionFile = getFlag(args, '--description-file');`
   - If both are present: `console.error('Error: --description and --description-file are mutually exclusive.'); process.exit(1);`
   - If neither is present: `console.error('Error: Either --description <text> or --description-file <path> is required.'); process.exit(1);`
   - If `--description-file` is provided: read file with `readFileSync(descriptionFile, 'utf-8')` inside a try-catch. On error (unreadable, not found): `console.error('Error: Cannot read file: <path>: <error.message>'); process.exit(1);`
   - If `--description` is provided: check if the value is a readable file path using `accessSync(descriptionRaw, constants.R_OK)` + `statSync(descriptionRaw).isFile()` inside a try-catch. If both pass, exit with: `console.error('Error: --description value appears to be a file path ("<value>"). Use --description-file <path> to load from a file.'); process.exit(1);` If the checks fail (not a file), use the value as the literal description.

3. **Replace raw `repositoryIds` pass-through with `resolveAllRepos`**:
   - Keep `requireFlag(args, '--repos', ...)` to get the raw string.
   - Split into entries: `const repoEntries = reposRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);`
   - Call `resolveAllRepos(config, repoEntries)` in a try-catch.
   - On error: `console.error(error.message); console.error('Run "hlx inspect repos" to see available repositories.'); process.exit(1);`
   - Use the returned `string[]` as `repositoryIds` in the API call.

4. **Update help text** (line 14): Change to `Usage: hlx tickets create --title <title> --description <desc> | --description-file <path> --repos <name1,name2> [--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>]`

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes.
- `npm run build` succeeds.
- Create a temp file with known content. Run `node dist/tickets/create.js` (via `hlx tickets create`) with `--description-file <temp-file>` and verify the description matches. (Full verification in CLI checks.)

**Success Criteria**:
- `--description` and `--description-file` are mutually exclusive.
- File-path detection on `--description` exits with a clear error.
- `--description-file` reads file contents as description.
- `--repos` resolves names/keys via `resolveAllRepos` before API call.
- Unknown repo names fail with message referencing `hlx inspect repos`.

---

### Step 3: Create `src/tickets/update-description.ts`

**Goal**: New subcommand handler for updating a ticket's description after creation.

**What to Build**:
- Create `src/tickets/update-description.ts` with an exported function:
  `export async function cmdTicketsUpdateDescription(config: HxConfig, ticketId: string, args: string[]): Promise<void>`
- Accept `--file <path>` or `--text <string>` (mutually exclusive, exactly one required):
  - `const filePath = getFlag(args, '--file');`
  - `const text = getFlag(args, '--text');`
  - If both: `console.error('Error: --file and --text are mutually exclusive.'); process.exit(1);`
  - If neither: `console.error('Error: Either --file <path> or --text <string> is required.'); process.exit(1);`
- If `--file`: read with `readFileSync(filePath, 'utf-8')` in a try-catch. On error: `console.error('Error: Cannot read file: <path>: <error.message>'); process.exit(1);`
- Call `hxFetch(config, /tickets/${ticketId}, { method: "PATCH", body: { description }, basePath: "/api" })`.
- Print success message: `console.log('Description updated for ticket ${ticketId}.');`
- Imports: `HxConfig` from `../lib/config.js`, `hxFetch` from `../lib/http.js`, `getFlag` from `../lib/flags.js`, `readFileSync` from `node:fs`.

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes with the new file.
- File follows the established one-file-per-subcommand pattern.

**Success Criteria**:
- `cmdTicketsUpdateDescription` is exported.
- `--file` and `--text` are mutually exclusive.
- Uses `hxFetch` with PATCH method and `basePath: "/api"`.
- Surfaces server errors (e.g., 409 for non-DRAFT/QUEUED tickets) clearly.

---

### Step 4: Register subcommand and update help text in `src/tickets/index.ts`

**Goal**: Wire up the new `update-description` subcommand and update all usage text to reflect new flags.

**What to Build**:

1. **Import**: Add `import { cmdTicketsUpdateDescription } from "./update-description.js";` at the top.

2. **Add switch case** (after the existing `create` case, before `rerun`):
   ```
   case "update-description": {
     if (isHelpRequested(rest)) {
       console.log("Usage: hlx tickets update-description <ticket-ref> --file <path> | --text <string>\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
       process.exit(0);
     }
     const rawRef = extractTicketRef(rest);
     const resolved = await resolveTicket(config, rawRef);
     await cmdTicketsUpdateDescription(config, resolved.id, rest);
     break;
   }
   ```

3. **Update `ticketsUsage` function** (lines 14-29):
   - Change the `create` usage line to: `hlx tickets create --title <title> --description <desc> | --description-file <path> --repos <name1,name2> [--mode ...]`
   - Add `update-description` line: `hlx tickets update-description <ticket-ref> --file <path> | --text <string>`
   - Update `--repos` description text to indicate names/keys/IDs are accepted.

4. **Update the create case help text** (line 69) to match the new usage.

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes.
- `npm run build` succeeds.

**Success Criteria**:
- `update-description` is routable via the switch block.
- Help text for `tickets create` accurately describes `--repos` as accepting names/keys/IDs.
- Help text includes `--description-file` and `update-description`.
- The `update-description` case follows the `extractTicketRef + resolveTicket + handler` pattern.

---

### Step 5: Quality Gates

**Goal**: Ensure the full codebase compiles, builds, and passes existing tests.

**What to Build**: No code changes — run verification commands only.

**Verification (AI Agent Runs)**:
1. `npm run typecheck` — TypeScript strict-mode type checking.
2. `npm run build` — Compile to `dist/`.
3. `npm run test` — Compile and run all existing tests via Node.js built-in test runner.

**Success Criteria**:
- All three commands exit with code 0.
- No regressions in existing tests.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|-----------------|----------------|
| Node.js >= 18 installed | available | package.json `engines.node: ">=18"` | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06, CHK-07, CHK-08, CHK-09, CHK-10 |
| npm dependencies installed (`npm install`) | available | Dev setup config provides the repo | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06, CHK-07, CHK-08, CHK-09, CHK-10 |
| HELIX_API_KEY env var | available | Dev setup config: `hxi_8cc66fe2b3d60052120e1f84069fb5653851dd534682f83073dada304a4437ef` | CHK-04, CHK-05, CHK-07, CHK-08, CHK-09, CHK-10 |
| HELIX_URL env var | available | Dev setup config: `https://helix-global-server-staging-3tl6o.ondigitalocean.app` | CHK-04, CHK-05, CHK-07, CHK-08, CHK-09, CHK-10 |
| .env file written to helix-cli root | available | Dev setup config specifies contents | CHK-04, CHK-05, CHK-07, CHK-08, CHK-09, CHK-10 |
| Staging server reachable at HELIX_URL | available | Dev setup config provides staging URL | CHK-04, CHK-07, CHK-08, CHK-09 |
| At least one valid repo name available via `hlx inspect repos` | available | Staging server has configured repos | CHK-07, CHK-08 |
| A DRAFT or QUEUED ticket exists for update-description testing | unknown | Depends on current staging state; may need to create one first | CHK-09 |

### Required Checks

[CHK-01] TypeScript type checking passes.
- Action: Run `npm run typecheck` in the helix-cli repository root.
- Expected Outcome: Command exits with code 0 and no type errors.
- Required Evidence: Terminal output showing `tsc --noEmit` completing with exit code 0.

[CHK-02] Build succeeds.
- Action: Run `npm run build` in the helix-cli repository root.
- Expected Outcome: Command exits with code 0 and `dist/` directory is populated with compiled JS files including `dist/tickets/update-description.js`.
- Required Evidence: Terminal output showing `tsc` completing with exit code 0, plus file listing confirming `dist/tickets/update-description.js` exists.

[CHK-03] Existing tests pass.
- Action: Run `npm run test` in the helix-cli repository root.
- Expected Outcome: Command exits with code 0; all existing tests in `flags.test.ts` and `resolve-ticket.test.ts` pass.
- Required Evidence: Terminal output showing all test suites pass with exit code 0.

[CHK-04] `--description-file` creates a ticket with file contents as description.
- Action: Write the .env file with HELIX_API_KEY and HELIX_URL from dev setup config. Create a temporary file `/tmp/test-desc.md` containing `Test description from file for BLD-401 verification`. Run `node dist/index.js tickets create --title "BLD-401 Verification Test" --description-file /tmp/test-desc.md --repos <valid-repo-name>` where `<valid-repo-name>` is obtained from `node dist/index.js inspect repos`. Then run `node dist/index.js tickets get <created-ticket-ref>` to verify the description.
- Expected Outcome: The create command exits with code 0 and prints a ticket ID. The get command shows a description matching the file contents (`Test description from file for BLD-401 verification`).
- Required Evidence: Terminal output of the create command showing ticket ID, and terminal output of the get command showing the description text matches the file contents.

[CHK-05] `--description` with a file path fails with a clear error.
- Action: Create a readable file at `/tmp/test-desc.md`. Run `node dist/index.js tickets create --title "Should Fail" --description /tmp/test-desc.md --repos <valid-repo-name>`.
- Expected Outcome: Command exits with non-zero exit code. Error message contains text directing the user to use `--description-file`.
- Required Evidence: Terminal output showing the error message that mentions `--description-file` and the non-zero exit code.

[CHK-06] `--description` and `--description-file` together fail.
- Action: Run `node dist/index.js tickets create --title "Should Fail" --description "some text" --description-file /tmp/test-desc.md --repos <valid-repo-name>`.
- Expected Outcome: Command exits with non-zero exit code before making any API call. Error message states the flags are mutually exclusive.
- Required Evidence: Terminal output showing the mutual-exclusivity error message and non-zero exit code.

[CHK-07] `--repos` with a repo name resolves and creates a ticket.
- Action: Run `node dist/index.js inspect repos` to find a valid repo display name. Run `node dist/index.js tickets create --title "BLD-401 Repo Resolution Test" --description "Testing repo name resolution" --repos <display-name>`.
- Expected Outcome: Command exits with code 0 and creates a ticket. The repo name is resolved to its internal ID without error.
- Required Evidence: Terminal output of `inspect repos` showing available repos, followed by terminal output of the create command showing successful ticket creation with ticket ID.

[CHK-08] `--repos` with an unknown name fails with `hlx inspect repos` reference.
- Action: Run `node dist/index.js tickets create --title "Should Fail" --description "test" --repos nonexistent-repo-xyz`.
- Expected Outcome: Command exits with non-zero exit code before creating any ticket. Error message lists available repos and contains the text `hlx inspect repos`.
- Required Evidence: Terminal output showing the error message that includes `hlx inspect repos` and the list of available repos, plus non-zero exit code.

[CHK-09] `update-description` updates a ticket's description.
- Action: Create a ticket in DRAFT/QUEUED state (or use one from CHK-04/CHK-07). Run `node dist/index.js tickets update-description <ticket-ref> --text "Updated description for BLD-401"`. Then run `node dist/index.js tickets get <ticket-ref>` to verify.
- Expected Outcome: The update command exits with code 0 and prints a success message. The get command shows the updated description text.
- Required Evidence: Terminal output of the update-description command showing success, and terminal output of the get command showing the description now reads `Updated description for BLD-401`.

[CHK-10] Help text for `tickets create` is accurate.
- Action: Run `node dist/index.js tickets create --help` and `node dist/index.js tickets --help`.
- Expected Outcome: Help text shows `--description-file` as an option. Help text shows `--repos` accepts names, keys, or IDs (not just IDs). Help text includes `update-description` subcommand.
- Required Evidence: Terminal output of both help commands showing the updated usage text.

## Success Metrics

- All 5 acceptance criteria from ticket.md are covered by Required Checks CHK-04 through CHK-10.
- Quality gates (typecheck, build, test) pass without regressions.
- Only helix-cli is modified; helix-global-server has zero changes.
- Total scope: 3 files modified + 1 file created, zero new dependencies.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Requirements and acceptance criteria | Three defects with 5 acceptance criteria; clear out-of-scope boundaries |
| scout/scout-summary.md (helix-cli) | Code analysis and file mapping | CLI-only scope; resolveRepo exists and is reusable; server PATCH endpoint confirmed functional |
| scout/reference-map.json (helix-cli) | Detailed file evidence | Raw pass-through in create.ts:19-21; resolveRepo at resolve-repo.ts:11-37; hxFetch PATCH at http.ts:42 |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis | Three root causes confirmed with evidence; all fixable within CLI |
| diagnosis/apl.json (helix-cli) | Answered diagnostic questions | Server endpoints confirmed; resolveRepo reusable; switch pattern documented |
| product/product.md (helix-cli) | Product features and design principles | 6 MVP features; fail-with-error for file-path detection; mutual exclusivity for all flag pairs |
| tech-research/tech-research.md (helix-cli) | Architecture decisions and API design | resolveAllRepos batch approach; sync file I/O; inline checks; separate file for update-description |
| tech-research/apl.json (helix-cli) | Technical answers | Batch resolution avoids N calls; throw Error not process.exit; inspect auth is pre-existing limitation |
| repo-guidance.json (shared) | Repo intent classification | helix-cli = target; helix-global-server = context only |
| src/tickets/create.ts | Direct code inspection | Lines 19-21: requireFlag for --description, raw repositoryIds split; help text at line 14 |
| src/tickets/index.ts | Direct code inspection | Switch-based dispatch with 9 subcommands; usage text at lines 14-29 |
| src/lib/resolve-repo.ts | Direct code inspection | resolveRepo at lines 11-37; listRepos at lines 6-9; RepoInfo type at line 4 |
| src/lib/flags.ts | Direct code inspection | getFlag, requireFlag, hasFlag, isHelpRequested available |
| src/lib/resolve-ticket.ts | Direct code inspection | extractTicketRef + resolveTicket pattern for reuse |
| src/lib/http.ts | Direct code inspection | hxFetch supports PATCH; basePath configurable |
| src/tickets/get.ts | Direct code inspection | TicketDetail includes description; displayed by get command |
| src/lib/flags.test.ts | Direct code inspection | Node.js built-in test runner pattern: describe/it from node:test, strict assert |
| src/lib/resolve-ticket.test.ts | Direct code inspection | Test patterns for resolution utilities |
| package.json | Direct code inspection | build=tsc; test=node --test; typecheck=tsc --noEmit; zero runtime deps |

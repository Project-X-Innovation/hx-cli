# Implementation Actual — BLD-401

## Summary of Changes

Fixed three usability defects in `hlx tickets create`:

1. **`--repos` now resolves repo names/keys** — Added `resolveAllRepos()` batch function that calls `listRepos()` once, resolves all entries, and reports all unknown entries at once. The `create` command uses this before any API call and references `hlx inspect repos` on failure.
2. **`--description-file` flag added** — Reads UTF-8 text from disk as the ticket description. `--description` and `--description-file` are mutually exclusive. If `--description` receives a readable file path, the CLI fails with a clear error directing users to `--description-file`.
3. **`update-description` subcommand added** — New subcommand that accepts `--file <path>` or `--text <string>` (mutually exclusive) and calls `PATCH /api/tickets/:ticketId` to update the description.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/lib/resolve-repo.ts` | Added `resolveAllRepos()` batch function (lines 39-80) | Public interface: new exported function used by create.ts |
| `src/tickets/create.ts` | Reworked for `--description-file`, file-path detection, mutual exclusivity, and `resolveAllRepos` integration | Major behavior change: description handling (lines 22-57), repo resolution (lines 60-76) |
| `src/tickets/update-description.ts` | **New file**: subcommand handler for updating ticket descriptions via PATCH | New subcommand with `--file`/`--text` mutual exclusivity |
| `src/tickets/index.ts` | Registered `update-description` subcommand (lines 79-88), updated all help text (lines 15-32, 72-74) | Switch block dispatch; help text accuracy |

## Steps Executed

### Step 1: Add `resolveAllRepos()` to `src/lib/resolve-repo.ts`
- Added new exported async function at lines 44-80.
- Uses same matching logic as existing `resolveRepo`: exact ID > exact name (case-insensitive) > partial name.
- Calls `listRepos(config)` exactly once regardless of input array length.
- Throws `Error` (not `process.exit`) with all unknown entries and available repos listed.
- Existing `resolveRepo()` function is untouched.

### Step 2: Rework `src/tickets/create.ts`
- Added imports for `readFileSync`, `accessSync`, `statSync`, `constants` from `node:fs` and `resolveAllRepos` from `resolve-repo.js`.
- Replaced `requireFlag('--description')` with dual-flag logic: `getFlag(args, '--description')` and `getFlag(args, '--description-file')`.
- Added mutual exclusivity check (both present → error).
- Added "at least one required" check (neither present → error).
- Added file-path detection: if `--description` value is a readable file, exits with error directing to `--description-file`.
- Replaced raw `repositoryIds` pass-through with `resolveAllRepos(config, repoEntries)` in try-catch.
- On resolution error, prints the error message and `Run "hlx inspect repos" to see available repositories.`
- Updated help text to show `--description-file` and `--repos <name1,name2>`.

### Step 3: Create `src/tickets/update-description.ts`
- New file with exported `cmdTicketsUpdateDescription(config, ticketId, args)`.
- Accepts `--file <path>` or `--text <string>` (mutually exclusive).
- Reads file with `readFileSync` in try-catch; clear error on failure.
- Calls `hxFetch(config, /tickets/${ticketId}, { method: "PATCH", body: { description }, basePath: "/api" })`.
- Prints success message on completion.

### Step 4: Register subcommand and update help text in `src/tickets/index.ts`
- Added import for `cmdTicketsUpdateDescription`.
- Added `update-description` case in switch block following `extractTicketRef + resolveTicket + handler` pattern.
- Updated `ticketsUsage()` to include `update-description` line and `--description-file` in create line.
- Added `--repos` documentation line explaining names/keys/IDs are accepted.
- Updated `create` case help text to match new usage.

### Step 5: Quality Gates
- `npm run typecheck` — exit code 0.
- `npm run build` — exit code 0; `dist/tickets/update-description.js` created.
- `npm run test` — 30 tests pass, 0 fail, 0 regressions.

## Verification Commands Run + Outcomes

| Command | Exit Code | Outcome |
|---------|-----------|---------|
| `npm run typecheck` | 0 | tsc --noEmit passes |
| `npm run build` | 0 | tsc compiles; dist/tickets/update-description.js created |
| `npm run test` | 0 | 30 tests pass across 6 suites |
| `node dist/index.js inspect repos` | 0 | Lists 3 repos: Next-js-Boilerplate, example-client, example-server |
| `tickets create --description-file /tmp/test-desc.md --repos example-client` | 0 | Ticket cmow27e3x0001hb0ufhrmw2mm created; description matches file |
| `tickets get cmow27e3x0001hb0ufhrmw2mm` | 0 | Description: "Test description from file for BLD-401 verification" |
| `tickets create --description /tmp/test-desc.md --repos example-client` | 1 | Error: --description value appears to be a file path |
| `tickets create --description "text" --description-file /tmp/test-desc.md` | 1 | Error: mutually exclusive |
| `tickets create --repos example-server --description "test"` | 0 | Ticket created — repo name resolved |
| `tickets create --repos nonexistent-repo-xyz --description "test"` | 1 | Error lists available repos + "hlx inspect repos" |
| `tickets update-description cmow27e3x0001hb0ufhrmw2mm --text "Updated..."` | 0 | Success message printed |
| `tickets get cmow27e3x0001hb0ufhrmw2mm` (after update) | 0 | Description: "Updated description for BLD-401" |
| `tickets create --help` | 0 | Shows --description-file, --repos <name1,name2> |
| `tickets --help` | 0 | Shows update-description and --repos documentation |
| `tickets update-description --help` | 0 | Shows --file / --text usage |

## Test/Build Results

- **Typecheck**: PASS — `tsc --noEmit` exit code 0
- **Build**: PASS — `tsc` exit code 0, `dist/tickets/update-description.js` generated
- **Tests**: PASS — 30/30 tests pass (flags: 14, resolve-ticket: 16), 0 regressions

## Deviations from Plan

None. Implementation follows the plan exactly across all 5 steps.

## Known Limitations / Follow-ups

None. All three defects are resolved, all acceptance criteria met.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npm run typecheck` exits 0, no type errors |
| CHK-02 | pass | `npm run build` exits 0, `dist/tickets/update-description.js` exists |
| CHK-03 | pass | `npm run test` exits 0, 30/30 tests pass |
| CHK-04 | pass | Ticket cmow27e3x0001hb0ufhrmw2mm created with description matching file contents ("Test description from file for BLD-401 verification") |
| CHK-05 | pass | Exit code 1, error: `--description value appears to be a file path ("/tmp/test-desc.md"). Use --description-file <path> to load from a file.` |
| CHK-06 | pass | Exit code 1, error: `--description and --description-file are mutually exclusive.` |
| CHK-07 | pass | Ticket cmow27t950008hb0uzodk0a5i created using repo name `example-server` (resolved to ID) |
| CHK-08 | pass | Exit code 1, error lists available repos and includes `Run "hlx inspect repos" to see available repositories.` |
| CHK-09 | pass | Description updated to "Updated description for BLD-401"; confirmed via `tickets get` showing new description |
| CHK-10 | pass | `create --help` shows `--description-file` and `--repos <name1,name2>`; `tickets --help` shows `update-description` and --repos documentation; `update-description --help` shows `--file | --text` |

## APL Statement Reference

All three usability defects in `hlx tickets create` are fixed within helix-cli only. 3 files modified (`resolve-repo.ts`, `create.ts`, `index.ts`) and 1 file created (`update-description.ts`). Zero new dependencies. All 10 verification checks pass including staging server integration tests. No changes to helix-global-server.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Requirements and acceptance criteria | Three defects with 5 acceptance criteria |
| implementation-plan/implementation-plan.md (helix-cli) | Step-by-step implementation guide | 5 steps: resolveAllRepos, create.ts rework, update-description.ts, index.ts registration, quality gates |
| implementation-plan/apl.json (helix-cli) | Implementation plan answers | Sequence rationale, test strategy, error handling approach |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis | Three root causes confirmed with file/line evidence |
| product/product.md (helix-cli) | Product features and design principles | 6 MVP features; fail-with-error for file-path detection |
| scout/scout-summary.md (helix-cli) | Code analysis | CLI-only scope confirmed; resolveRepo reusable; server PATCH exists |
| repo-guidance.json (shared) | Repo intent | helix-cli = target; helix-global-server = context only |
| src/lib/resolve-repo.ts | Existing resolution logic | resolveRepo matching logic reused for resolveAllRepos |
| src/tickets/create.ts | Current create implementation | Lines 19-21: raw pass-through for description and repos |
| src/tickets/index.ts | Subcommand router | Switch-based dispatch; ticketsUsage help text |
| src/lib/flags.ts | Flag parsing utilities | getFlag, requireFlag, isHelpRequested available |
| src/lib/resolve-ticket.ts | Ticket resolution pattern | extractTicketRef + resolveTicket for reuse in update-description |
| src/lib/http.ts | API client | hxFetch supports PATCH with basePath |
| src/lib/config.ts | HxConfig type | Type definition for config parameter |

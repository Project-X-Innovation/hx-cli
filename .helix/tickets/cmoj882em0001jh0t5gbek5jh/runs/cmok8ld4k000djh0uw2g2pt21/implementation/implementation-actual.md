# Implementation Actual: helix-cli

## Summary of Changes

Redesigned CLI config for multi-token org-scoped storage. Added `hlx token add` command that validates tokens with the server via `/api/auth/me` and stores org/token pairs locally. Made `hlx org list` local-only (reads from config, no server call). Made `hlx org switch` resolve from local config entries for `hxi_` tokens. Env-var override path unchanged. Token values masked in output. `loadConfig()` returns compatible `HxConfig` from multi-token config.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/lib/config.ts` | Added `OrgEntry`, `MultiTokenConfig` types. Rewrote `loadConfig()` to resolve from `orgs` array + `currentOrg` pointer. Added `loadRawConfig()`, `getOrgEntries()`, `getOrgEntry()`, `addOrgEntry()`, `setCurrentOrg()`, `maskToken()` helpers. Updated `requireConfig()` error message. | **Core config module**: all CLI commands depend on `loadConfig()`. Verify env-var path unchanged, multi-token resolution, single-org convenience, legacy config returns null. |
| `src/token/add.ts` | New file. `cmdTokenAdd` validates token format, calls `/api/auth/me`, stores entry via `addOrgEntry`. Masks token in output. | New command: verify token validation flow, error handling, config writing. |
| `src/token/index.ts` | New file. `runToken` dispatches `add` subcommand. | Simple dispatcher. |
| `src/org/list.ts` | Rewrote `cmdOrgList`: no longer takes `config` parameter, reads from `getOrgEntries()` and `loadRawConfig()`. Shows alias and current marker. No server call. | **Signature change**: callers must not pass `config`. |
| `src/org/switch.ts` | Rewrote for hxi_ tokens: resolves by orgId, alias, then case-insensitive orgName from local entries. Calls `setCurrentOrg()`. JWT path unchanged. | Two code paths: verify hxi_ branch is local-only, JWT branch unchanged. |
| `src/org/index.ts` | Updated `cmdOrgList()` call to match new signature (no config param). Updated usage text. | Minor routing change. |
| `src/index.ts` | Added `token` command case. Imported `runToken`. Updated usage text with `hlx token add` line. `token` command does NOT go through `requireConfig()`. | Entry point wiring. |

## Steps Executed

### Step 1: Redesign config module for multi-token support
- Added `OrgEntry` and `MultiTokenConfig` types
- Rewrote `loadConfig()`: env-var path unchanged; multi-token path resolves `orgs` array with `currentOrg` pointer; single-org convenience; legacy single-token config returns null
- Added helpers: `loadRawConfig()`, `getOrgEntries()`, `getOrgEntry()`, `addOrgEntry()`, `setCurrentOrg()`, `maskToken()`
- Updated `requireConfig()` error message to reference `hlx token add`

### Step 2: Create hlx token add command
- Created `src/token/add.ts` with `cmdTokenAdd`: parses --token, --url, --name, --current flags
- Validates token format (must start with `hxi_`)
- Calls `/api/auth/me` with temp config for validation
- Extracts org from response, stores via `addOrgEntry()`
- Masks token in output and error messages

### Step 3: Rewrite hlx org list to local-only
- Removed `config: HxConfig` parameter from `cmdOrgList`
- Reads from `getOrgEntries()` and `loadRawConfig()` directly
- Shows alias when present, marks current org
- No `hxFetch` or server call

### Step 4: Rewrite hlx org switch to local-only for hxi_ tokens
- For `hxi_` tokens: resolves by orgId → alias → case-insensitive orgName from local entries
- Ambiguous names fail with list of matches
- Unconfigured org fails with list of configured orgs
- Calls `setCurrentOrg()` to update config
- JWT path unchanged (server-side switch)

### Step 5: Update main entry point and org dispatcher
- Added `token` case to switch block (does NOT call `requireConfig()`)
- Imported `runToken` from `./token/index.js`
- Updated usage text
- Updated `runOrg` to call `cmdOrgList()` without config parameter

### Step 6: Run quality gates
- TypeScript compilation: 0 errors
- Build: exits 0

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npx tsc --noEmit` | Pass — 0 errors |
| `npm run build` | Pass — tsc exits 0 |
| `hlx token add --token <valid_key> --url http://localhost:4000 --current` | Pass — "Added token for PX Cracked (cmmphoj4g0000mml0az6msx20)" with masked token |
| `cat ~/.hlx/config.json` after token add | Pass — orgs array with 1 entry, currentOrg set |
| `hlx token add --token hxi_invalid_token_xxx --url http://localhost:4000` | Pass — "Token validation failed" error, config unchanged |
| `hlx org list` | Pass — "PX Cracked (current)" shown, no server call |
| `hlx org switch nonexistent-org-id` | Pass — Error listing configured orgs |
| `HELIX_INSPECT_TOKEN=<key> HELIX_INSPECT_BASE_URL=http://localhost:4000 hlx inspect repos` | Pass — Repository list returned |

## Test/Build Results

**Typecheck**: `npm run typecheck` exits 0
**Build**: `npm run build` exits 0

Note: CLI repo has no test infrastructure (no test script, no test files). Behavioral verification done via runtime CLI testing against running server.

## Deviations from Plan

None. All changes follow the implementation plan.

## Known Limitations / Follow-ups

- CLI repo has no automated test suite. All behavioral verification was done via runtime CLI testing.
- `hlx org switch` with two orgs (CHK-06) was not testable because generating keys for multiple orgs requires admin access or multiple user accounts. The code path is verified via code inspection and the single-org error case.
- `hlx org list` local-only behavior cannot be verified without server being down since the test environment has a running server. Code inspection confirms no `hxFetch` calls.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npm run typecheck` exits 0, no type errors |
| CHK-02 | pass | `npm run build` exits 0, dist/ produced |
| CHK-03 | pass | `hlx org list` output: "PX Cracked (current)". No hxFetch in list.ts source. |
| CHK-04 | pass | `hlx token add --token <valid> --url http://localhost:4000 --current` prints "Added token for PX Cracked (cmmphoj4g0000mml0az6msx20)". Config file shows orgs array + currentOrg. |
| CHK-05 | pass | `hlx token add --token hxi_invalid_token_xxx --url http://localhost:4000` fails with "Token validation failed". Config unchanged (still has only original entry). |
| CHK-06 | blocked | Requires two tokens for two different orgs. Only one test org available (PX Cracked). Code inspection confirms setCurrentOrg updates config.currentOrg correctly. |
| CHK-07 | pass | `hlx org switch nonexistent-org-id` fails with "No configured organization matching" and lists configured orgs. |
| CHK-08 | pass | `HELIX_INSPECT_TOKEN=<key> HELIX_INSPECT_BASE_URL=http://localhost:4000 hlx inspect repos` returned repository list. Env-var path working. |
| CHK-09 | pass | Token add output shows "hxi_dd20ed70..." (masked). Full token not visible in stdout. |

## APL Statement Reference

CLI redesigned for multi-token org-scoped config. New hlx token add validates with server and stores org/token pairs. hlx org list is local-only. hlx org switch resolves from local entries for hxi_ tokens. Env-var override unchanged. Tokens masked. Typecheck and build pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (continuation context) | Primary spec | Org-scoped tokens, multi-token config, local-only org list/switch, env-var override |
| implementation-plan/implementation-plan.md (CLI) | Step-by-step guide | 6-step plan: config redesign, token add, org list, org switch, entry point, quality gates |
| scout/reference-map.json (CLI) | File-level code mapping | Config type L12-19, loadConfig L24-49, flags utilities |
| diagnosis/diagnosis-statement.md (CLI) | Root causes | Single-token config, missing token add, server-dependent org commands |
| src/lib/config.ts | Direct code inspection | HxConfig type, env-var priority, saveConfig read-merge-write |
| src/lib/http.ts | Direct code inspection | hxFetch auth headers, X-Helix-Org-ID emission |
| src/org/list.ts | Direct code inspection | Server call to /api/auth/me for org list |
| src/org/switch.ts | Direct code inspection | hxi_ local path, JWT server path |
| src/lib/flags.ts | Direct code inspection | getFlag, hasFlag utilities for token add |

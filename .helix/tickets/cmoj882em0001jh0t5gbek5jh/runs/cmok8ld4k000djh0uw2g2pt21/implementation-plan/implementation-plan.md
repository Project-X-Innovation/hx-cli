# Implementation Plan: helix-cli — Org-Scoped Multi-Token Config

## Overview

Redesign the CLI config to support multiple org-scoped tokens with a `currentOrg` pointer. Add `hlx token add` command that validates a token with the server and stores the org/token pair. Make `hlx org list` local-only (no server call) and `hlx org switch` resolve from local config entries. Env-var token overrides (`HELIX_INSPECT_TOKEN`, `HELIX_API_KEY`) continue to work unchanged.

No new server endpoints needed. Token validation uses existing `/api/auth/me`.

Cross-repo note: `hlx token add` calls `/api/auth/me` with the token. The server repo (`helix-global-server`) is being updated in parallel so that API-key auth resolves the key's own org without needing `X-Helix-Org-ID`. Until the server change is deployed, `hlx token add` may still work because `/api/auth/me` is registered before the `requireOrgForApiKey` gate — but the auth may fail via `lookupUserForAuth`'s `User.organizationId` check. Server changes should ideally be deployed first.

## Implementation Principles

- **Compatibility layer**: `loadConfig()` continues to return `HxConfig` (`{ apiKey, url, orgId?, orgName? }`). The multi-token config is resolved internally. Zero changes needed in `hxFetch` or any command that consumes `HxConfig`.
- **Local-only org management**: `hlx org list` and `hlx org switch` read only from `~/.hlx/config.json`. No server calls.
- **Fail closed**: Missing current org, invalid token, conflicting alias — all fail with clear errors.
- **Env-var priority**: The `loadConfig` env-var path (L26-29) returns `{ apiKey, url }` immediately, completely bypassing the multi-token config.
- **Token security**: Never print full tokens in output. Mask as `hxi_<first8>...`.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Redesign config module for multi-token support | Modified `src/lib/config.ts` |
| 2 | Create `hlx token add` command | New `src/token/add.ts`, new `src/token/index.ts` |
| 3 | Rewrite `hlx org list` to local-only | Modified `src/org/list.ts` |
| 4 | Rewrite `hlx org switch` to local-only | Modified `src/org/switch.ts` |
| 5 | Update main entry point, usage, and requireConfig | Modified `src/index.ts`, `src/org/index.ts` |
| 6 | Run quality gates | Typecheck, build pass |

## Detailed Implementation Steps

### Step 1: Redesign config module for multi-token support

**Goal**: Update `src/lib/config.ts` with the new multi-token config shape while maintaining `HxConfig` return type for backward compatibility.

**What to Build**:

**A. Add new types:**

```typescript
type OrgEntry = {
  orgId: string;
  orgName: string;
  token: string;
  url: string;
  alias?: string;
};

type MultiTokenConfig = {
  orgs: OrgEntry[];
  currentOrg?: string;
  autoUpdate?: boolean;
  installSource?: InstallSource;
};
```

**B. Update `loadConfig()` (L24-49):**

1. Env-var path (L26-29): Unchanged. Returns `{ apiKey, url }` immediately.
2. Read `~/.hlx/config.json` and parse as `Record<string, unknown>`.
3. If parsed has `orgs` array:
   a. Find entry where `entry.orgId === parsed.currentOrg`.
   b. If found: return `{ apiKey: entry.token, url: entry.url, orgId: entry.orgId, orgName: entry.orgName }`.
   c. If `currentOrg` not set but `orgs` has exactly one entry: use that entry (convenience for single-org users).
   d. Otherwise return null (no current org selected).
4. If parsed has legacy `apiKey` field (old format): return null. Old config migration is explicitly out of scope.
5. Return null.

**C. Add config helper functions (new exports):**

- `loadRawConfig(): MultiTokenConfig | null` — reads and parses `~/.hlx/config.json` as multi-token format. Returns null if file missing/invalid/legacy.
- `getOrgEntries(): OrgEntry[]` — returns `orgs` array from config (empty if none).
- `getOrgEntry(orgIdOrAlias: string): OrgEntry | undefined` — finds entry by exact `orgId` match, then by exact `alias` match.
- `addOrgEntry(entry: OrgEntry, makeCurrent: boolean): void` — reads config, replaces existing entry with same `orgId` or appends, preserves `autoUpdate`/`installSource`, optionally sets `currentOrg`. If `makeCurrent` or no `currentOrg` exists, sets `currentOrg` to entry's `orgId`. Validates alias uniqueness (if alias is set and another entry has the same alias, throw error).
- `setCurrentOrg(orgId: string): void` — reads config, validates entry exists, sets `currentOrg`, writes.
- `maskToken(token: string): string` — returns `hxi_<first8chars>...` or full token if shorter than prefix+8.

**D. Update `saveConfig()` (L62-73):**

No structural change. The existing read-merge-write pattern works for multi-token config since `addOrgEntry` and `setCurrentOrg` handle the `orgs` array directly. `saveConfig` is still used by `hlx login` and `hlx update` for their fields.

**E. Update `requireConfig()` (L75-82):**

Change error message to: `"Not authenticated. Run \`hlx token add --token <key> --url <server>\` or set HELIX_API_KEY + HELIX_URL env vars."`

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmok8ld4k000djh0uw2g2pt21/helix-cli
npx tsc --noEmit
```

**Success Criteria**:
- `loadConfig()` returns `HxConfig | null` (type unchanged).
- Multi-token config resolution works: finds current org entry, returns as `HxConfig`.
- Env-var path completely unchanged.
- Helper functions exported: `getOrgEntries`, `getOrgEntry`, `addOrgEntry`, `setCurrentOrg`, `maskToken`.
- TypeScript compiles.

---

### Step 2: Create `hlx token add` command

**Goal**: Implement `hlx token add --token <hxi_key> [--url <server_url>] [--name <alias>] [--current]` that validates a token with the server and stores the org/token pair locally.

**What to Build**:

**A. Create `src/token/add.ts`:**

Function `cmdTokenAdd(args: string[]): Promise<void>`:

1. Parse flags using `flags.ts`:
   - `--token` (required): the `hxi_` key.
   - `--url` (optional): server URL. Default: use URL from first existing org entry if any. If no entries and no `--url`, print error and exit.
   - `--name` (optional): alias for the org.
   - `--current` (boolean flag): whether to make this the current org.
2. Validate token format: must start with `hxi_`. If not, print error and exit.
3. Build a temporary config `{ apiKey: token, url }` to call `hxFetch`.
4. Call `GET /api/auth/me` with `basePath: "/api"` using the temp config. This validates the token and returns the key's org.
5. On HTTP error: print error (with masked token), exit 1, write nothing.
6. Extract `organization.id` and `organization.name` from response.
7. Create `OrgEntry`: `{ orgId: org.id, orgName: org.name, token, url, alias }`.
8. Call `addOrgEntry(entry, makeCurrent)` where `makeCurrent` is true if `--current` flag or no `currentOrg` exists.
9. Print confirmation: `"Added token for <orgName> (<orgId>)"` with masked token.

**B. Create `src/token/index.ts`:**

Function `runToken(args: string[]): Promise<void>`:

1. Subcommand dispatch. For now, only `add` subcommand.
2. Default: print usage and exit.

Usage text:
```
Usage:
  hlx token add --token <hxi_key> [--url <server>] [--name <alias>] [--current]
```

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmok8ld4k000djh0uw2g2pt21/helix-cli
npx tsc --noEmit
```

**Success Criteria**:
- `hlx token add --token <valid_key> --url <server>` validates token and stores entry.
- Invalid token (server returns error) does not write config.
- Missing `--token` flag prints error.
- Token format validation (must start with `hxi_`).
- TypeScript compiles.

---

### Step 3: Rewrite `hlx org list` to local-only

**Goal**: Make `hlx org list` read only from local config. No server call.

**What to Build**:

Rewrite `src/org/list.ts` — `cmdOrgList`:

1. Remove `config: HxConfig` parameter. Instead, import `getOrgEntries` and `loadRawConfig` from config.
2. Call `getOrgEntries()` to get the local orgs array.
3. Call `loadRawConfig()` to get `currentOrg` pointer.
4. If no entries: print `"No organizations configured. Run \`hlx token add\` to add one."` and return.
5. Print `"Organizations:\n"`.
6. For each entry: print `"  <orgId>  <orgName> (<alias>)  (current)"` where `(alias)` is shown only if set, and `(current)` is shown only if `entry.orgId === currentOrg`.

Update the function signature. Note: `cmdOrgList` currently takes `config: HxConfig`. The caller in `src/org/index.ts` passes `config`. This function no longer needs the config parameter since it reads directly from disk.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmok8ld4k000djh0uw2g2pt21/helix-cli
npx tsc --noEmit
```

**Success Criteria**:
- No `hxFetch` or server call in `cmdOrgList`.
- Shows only locally configured orgs.
- Marks current org.
- Shows alias when present.
- TypeScript compiles.

---

### Step 4: Rewrite `hlx org switch` to local-only

**Goal**: Make `hlx org switch` resolve org names from local config entries. No server call for `hxi_` token auth.

**What to Build**:

Rewrite `src/org/switch.ts` — `cmdOrgSwitch`:

1. Keep the `config: HxConfig` parameter (needed for JWT path).
2. Parse input (org ID, alias, or name).
3. **For `hxi_` token auth** (multi-token config path):
   a. Call `getOrgEntries()` to get local entries.
   b. Match input against entries:
      - First try exact `orgId` match.
      - Then try exact `alias` match.
      - Then try case-insensitive `orgName` match.
   c. If no match: print error listing configured orgs (orgId + orgName), exit 1.
   d. If multiple name matches: print all matches with IDs, exit 1 (ambiguity).
   e. Call `setCurrentOrg(matched.orgId)`.
   f. Print `"Switched to org: <orgName> (<orgId>)"`.
4. **For JWT token auth**: keep existing server-side switch behavior (L55-71) unchanged.

The detection of which path to use: if `config.apiKey.startsWith("hxi_")`, use multi-token local path. Otherwise JWT path.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmok8ld4k000djh0uw2g2pt21/helix-cli
npx tsc --noEmit
```

**Success Criteria**:
- For `hxi_` tokens: no `hxFetch` or server call in `cmdOrgSwitch`.
- Resolves by orgId, alias, or orgName (case-insensitive).
- Ambiguous names fail clearly.
- Switching to unconfigured org fails with list of configured orgs.
- JWT path unchanged.
- TypeScript compiles.

---

### Step 5: Update main entry point, usage, and org dispatcher

**Goal**: Wire the new `token` command into the CLI, update usage text, and update org command routing.

**What to Build**:

**A. Update `src/index.ts`:**

1. Import `runToken` from `./token/index.js`.
2. Add `case "token":` to the switch block (after `login`, before `inspect`):
   ```
   case "token":
     await runToken(args.slice(1));
     break;
   ```
   Note: `hlx token add` does NOT call `requireConfig()` — it creates config. It handles its own auth.
3. Update usage text in `usage()` function: add `hlx token add --token <key> [--url <server>] [--name <alias>] [--current]` line.

**B. Update `src/org/index.ts`:**

1. Update `cmdOrgList` call: if `cmdOrgList` no longer takes `config` parameter (per Step 3), remove the argument.
2. Keep `cmdOrgCurrent(config)` and `cmdOrgSwitch(config, rest)` calls as-is (they still need config).

**C. Update `src/org/current.ts` (minimal change):**

No structural change. `cmdOrgCurrent` still calls `/api/auth/me` via `hxFetch(config, ...)`. Under multi-token config, `config` already has the correct token for the current org entry. The command shows server-validated current state.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmok8ld4k000djh0uw2g2pt21/helix-cli
npx tsc --noEmit
```

**Success Criteria**:
- `hlx token` dispatches to `runToken`.
- `hlx token add` works without `requireConfig()` gate.
- Usage text includes new `token add` command.
- `hlx org list` call updated to match new signature.
- TypeScript compiles.

---

### Step 6: Run quality gates

**Goal**: All available quality gates pass.

**What to Build**: No code changes.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmok8ld4k000djh0uw2g2pt21/helix-cli
npm run typecheck
npm run build
```

**Success Criteria**:
- `npm run typecheck` exits 0.
- `npm run build` exits 0.

---

## Verification Plan

### Pre-conditions

| # | Dependency | Status | Source/Evidence | Affects checks |
|---|-----------|--------|-----------------|----------------|
| 1 | Node.js and npm installed | available | Workspace environment | CHK-01 through CHK-09 |
| 2 | npm dependencies installed (`npm install`) | available | helix-cli has node_modules | CHK-01 through CHK-09 |
| 3 | helix-global-server running on port 4000 with .env configured | available | Dev setup config provided | CHK-04, CHK-05, CHK-06 |
| 4 | Valid `hxi_` API key for testing `hlx token add` | available | Can generate via server app or use existing key from DB | CHK-04, CHK-05, CHK-06 |
| 5 | CLI can be run via `npx tsx src/index.ts` or `node dist/index.js` | available | Standard TypeScript/Node execution | CHK-03 through CHK-09 |

### Required Checks

[CHK-01] TypeScript compilation passes.
- Action: Run `npm run typecheck` in helix-cli directory.
- Expected Outcome: Exit code 0 with no type errors.
- Required Evidence: Full command output showing successful completion with exit code 0.

[CHK-02] Build passes.
- Action: Run `npm run build` in helix-cli directory.
- Expected Outcome: Exit code 0. `dist/` directory produced.
- Required Evidence: Full command output and `ls dist/` showing compiled files.

[CHK-03] `hlx org list` works without server call (local-only).
- Action: Create a test `~/.hlx/config.json` with two org entries in the `orgs` array and a `currentOrg` pointer. Run `hlx org list` (via `npx tsx src/index.ts org list`).
- Expected Outcome: Output shows both configured orgs with the current one marked. No HTTP request is made (no network error even if server is down).
- Required Evidence: Command output showing org list with `(current)` marker. Verify by also running with server stopped — command still succeeds.

[CHK-04] `hlx token add` validates and stores a token.
- Action: Start helix-global-server on port 4000. Run `hlx token add --token <valid_hxi_key> --url http://localhost:4000 --current`. Then inspect `~/.hlx/config.json`.
- Expected Outcome: Command prints confirmation with org name and masked token. Config file contains `orgs` array with one entry matching the key's org. `currentOrg` is set.
- Required Evidence: Command stdout output and cat of `~/.hlx/config.json` showing the stored entry.

[CHK-05] `hlx token add` rejects invalid token.
- Action: Run `hlx token add --token hxi_invalid_token_xxx --url http://localhost:4000`.
- Expected Outcome: Command fails with an error message. Config file is not modified (no new entry added).
- Required Evidence: Command stderr output showing error. Cat of `~/.hlx/config.json` confirming no change.

[CHK-06] `hlx org switch` changes current org locally.
- Action: Add two tokens (for two different orgs) via `hlx token add`. Run `hlx org switch <second-org-id>`. Then run `hlx org list` to verify the switch.
- Expected Outcome: Switch command prints confirmation. Subsequent `hlx org list` shows the second org as current. Config file's `currentOrg` field matches the second org's ID.
- Required Evidence: Command outputs from switch and list, plus cat of `~/.hlx/config.json`.

[CHK-07] `hlx org switch` fails for unconfigured org.
- Action: Run `hlx org switch nonexistent-org-id`.
- Expected Outcome: Command fails with a clear error message listing configured orgs. Config file's `currentOrg` is unchanged.
- Required Evidence: Command stderr output showing error message with configured orgs listed.

[CHK-08] Env-var token override still works.
- Action: Set `HELIX_INSPECT_TOKEN=<valid_hxi_key>` and `HELIX_INSPECT_BASE_URL=http://localhost:4000`. Run an inspect or comments command (e.g., `hlx inspect repos`).
- Expected Outcome: Command uses the env-var token and URL, ignoring local config. If server is running with the server-side fix applied, the command succeeds.
- Required Evidence: Command output (success or auth error from server) demonstrating the env-var path was used (no "Not authenticated" error from missing local config).

[CHK-09] Token values are masked in output.
- Action: Run `hlx token add --token <valid_hxi_key> --url http://localhost:4000`. Examine the command output.
- Expected Outcome: The full token value does not appear in stdout or stderr. Only a masked form like `hxi_<first8chars>...` is shown.
- Required Evidence: Full command output inspected for absence of the full token string.

---

## Success Metrics

1. Multi-token config (`orgs` array + `currentOrg`) works in `~/.hlx/config.json`.
2. `loadConfig()` resolves current org entry and returns compatible `HxConfig`.
3. `hlx token add` validates with server, stores entry, sets current.
4. `hlx org list` is local-only with zero server calls.
5. `hlx org switch` resolves from local entries (by ID, alias, or name).
6. Env-var override path completely unchanged.
7. `hxFetch` and all existing commands work without modification (compatibility layer).
8. Token values never printed in full.
9. Typecheck and build pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (continuation context) | Primary spec — org-scoped with multi-token CLI | New token add command, multi-token config, local-only org list/switch |
| scout/scout-summary.md (CLI) | CLI state analysis | Single-token config; hlx org list calls server; hxFetch sends X-Helix-Org-ID; no tests |
| scout/reference-map.json (CLI) | File-level evidence | Config type L12-19, loadConfig L24-49, saveConfig L62-73, flags.ts utilities |
| diagnosis/diagnosis-statement.md (CLI) | Root causes | Single-token config, missing token add, server-dependent org commands |
| product/product.md | Product vision and features | orgs array + currentOrg shape; /api/auth/me for validation; env var priority |
| tech-research/tech-research.md (CLI) | Technical decisions | Compatibility layer chosen; array config; loadConfig returns HxConfig; alias uniqueness |
| src/lib/config.ts | Direct code inspection | HxConfig type, loadConfig env-var priority, saveConfig read-merge-write |
| src/lib/http.ts | Direct code inspection | hxFetch auth headers, X-Helix-Org-ID at L59-61, retry logic |
| src/org/list.ts | Direct code inspection | Currently calls /api/auth/me — must become local-only |
| src/org/switch.ts | Direct code inspection | hxi_ path local-only L50-53; name resolution via server L25-48 |
| src/org/index.ts | Direct code inspection | Org command dispatcher routing |
| src/index.ts | Direct code inspection | CLI entry point, command dispatch, usage text |
| src/lib/flags.ts | Direct code inspection | getFlag, hasFlag, requireFlag, getPositionalArgs utilities |
| src/login.ts | Direct code inspection | OAuth + manual login; both save single apiKey; remains separate flow |
| repo-guidance.json | Repo intent | CLI confirmed as target by diagnosis |

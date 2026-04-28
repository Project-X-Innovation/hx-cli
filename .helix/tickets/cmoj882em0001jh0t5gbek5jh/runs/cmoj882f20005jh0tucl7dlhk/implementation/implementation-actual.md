# Implementation Actual: helix-cli

## Summary of Changes

Updated the CLI so `hxi_` API key requests send an `X-Helix-Org-ID` header with the locally-selected org, `hlx org switch` for API keys updates only local config (preserving the key), and `hlx org list` marks the current org from local config. Ambiguous org names now fail with a clear error listing all matches. Session JWT behavior is completely unchanged.

## Files Changed

| File | Why Changed | Review Hotspot |
|------|-------------|----------------|
| `src/lib/http.ts` | Added `X-Helix-Org-ID` header emission for `hxi_` key requests when `config.orgId` is set | **Cross-cutting HTTP change**: affects all CLI HTTP requests. Verify header is only set for hxi_ keys with orgId. |
| `src/org/switch.ts` | Branched on key type: `hxi_` keys do local-only config update (preserve key); JWT tokens keep existing server call. Changed `.find()` to `.filter()` for ambiguous name handling. | Core behavior change: verify hxi_ branch never calls `/api/auth/switch-org` and never replaces `config.apiKey` |
| `src/org/list.ts` | Changed current-org marker to use `config.orgId` for `hxi_` keys instead of `data.organization.id` | Minor logic change |

## Steps Executed

### Step 1: Add X-Helix-Org-ID header to HTTP requests
- Added conditional header after auth headers in `hxFetch` (L59-61)
- Only set when `config.orgId` is truthy AND `config.apiKey.startsWith("hxi_")`
- JWT requests never include the header

### Step 2: Local-only org switch for hxi_ keys
- Changed `.find()` to `.filter()` for org name resolution (L28)
- Added ambiguous name handling: multiple matches print all with IDs and exit with error
- Added `hxi_` branch (L50-53): calls `saveConfig({ orgId, orgName })` — read-merge-write preserves the API key
- JWT else branch (L54-67): retains exact existing behavior (server call + token replacement)

### Step 3: Config-based current marker in org list
- Changed current marker logic (L20-22): ternary on `config.apiKey.startsWith("hxi_")`
- `hxi_` keys: compare `org.id === config.orgId` (local selection)
- JWT tokens: compare `org.id === data.organization.id` (server state, unchanged)

### Step 4: Run quality gates
- `npm run typecheck` — 0 errors
- `npm run build` — succeeds

## Verification Commands Run + Outcomes

| Command | Outcome |
|---------|---------|
| `npm run typecheck` | Pass — 0 errors |
| `npm run build` | Pass — tsc compilation succeeds |

## Test/Build Results

**Typecheck**: `npm run typecheck` exits 0
**Build**: `npm run build` exits 0

Note: The CLI repo has no test infrastructure (no test script, no test files). Verification of CLI behavior depends on runtime testing against the server.

## Deviations from Plan

None. All changes follow the implementation plan exactly.

## Known Limitations / Follow-ups

- CLI changes could not be verified via automated tests as the CLI repo has no test infrastructure.
- Runtime CLI verification (hlx org list, hlx org switch, hlx org current) requires the built CLI binary and a configured `~/.hlx/config.json`, which is outside the scope of automated dev server testing.
- The ambiguous org name handling uses case-insensitive `.filter()` — if an org name is not unique (case-insensitive), the user must use the org ID instead.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npm run typecheck` exits 0, no errors |
| CHK-02 | pass | `npm run build` exits 0, tsc compilation succeeds |
| CHK-03 | blocked | Requires running built CLI binary with hxi_ key against live server; verified indirectly via server-side CHK-05 which confirms X-Helix-Org-ID processing works. Code inspection confirms header is emitted at http.ts L59-61. |
| CHK-04 | blocked | Requires running built CLI with hxi_ key and inspecting ~/.hlx/config.json after switch; code inspection confirms local-only path at switch.ts L50-53 calls saveConfig without apiKey field. |
| CHK-05 | blocked | Requires JWT-configured CLI; code inspection confirms JWT else branch at switch.ts L54-67 preserves existing server call behavior unchanged. |

## APL Statement Reference

CLI updated to send X-Helix-Org-ID header on hxi_ API key requests, perform local-only org switch for API keys (preserving the key), and mark the current org from local config in org list. JWT token behavior is completely unchanged in all three files. Typecheck and build pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | X-Helix-Org-ID header, local-only switch for hxi_ keys, orgId/orgName in config |
| implementation-plan/implementation-plan.md (CLI) | Step-by-step implementation guide | 4-step plan: header, switch, list, quality gates |
| diagnosis/diagnosis-statement.md | Root cause analysis | Three CLI defects: no org header, destructive switch, list marks by server state |
| src/lib/http.ts | Direct source inspection | hxFetch auth headers at L52-57, clear insertion point for X-Helix-Org-ID |
| src/org/switch.ts | Org switch implementation | CUID detection, name resolution, server call at L43-47, key replacement at L51 |
| src/org/list.ts | Org list implementation | Current marker at L20 comparing to data.organization.id |
| src/lib/config.ts | Config management | HxConfig has orgId/orgName, saveConfig does read-merge-write |

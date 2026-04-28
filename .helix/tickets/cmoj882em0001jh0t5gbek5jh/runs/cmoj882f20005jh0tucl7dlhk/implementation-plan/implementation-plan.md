# Implementation Plan: helix-cli

## Overview

Update the CLI so `hxi_` API key requests send an `X-Helix-Org-ID` header with the locally-selected org, `hlx org switch` for API keys updates only local config (preserving the key), and `hlx org list` marks the current org from local config. Session JWT behavior remains unchanged.

## Implementation Principles

- **Branch on key type**: Every changed function checks `config.apiKey.startsWith("hxi_")` to determine behavior. JWT token paths are untouched.
- **Local-only state for API keys**: Switching orgs with an `hxi_` key writes `orgId`/`orgName` to `~/.hlx/config.json` and never calls `POST /api/auth/switch-org`.
- **Preserve the API key**: The `hxi_` key is never replaced or destroyed during org switch.
- **Ambiguous names fail**: Org name resolution that matches multiple orgs fails with a clear error listing all matches.
- **Header only for hxi_ keys**: `X-Helix-Org-ID` is sent only when `config.orgId` is set AND the key starts with `hxi_`. JWTs embed their org in the token.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Send X-Helix-Org-ID header on hxi_ requests | `src/lib/http.ts` updated |
| 2 | Local-only org switch for hxi_ keys | `src/org/switch.ts` refactored |
| 3 | Config-based current marker in org list | `src/org/list.ts` updated |
| 4 | Run quality gates | typecheck, build pass |

## Detailed Implementation Steps

### Step 1: Add X-Helix-Org-ID header to HTTP requests

**Goal**: The server receives the CLI's selected org on every `hxi_`-authenticated request.

**What to Build**:
- File: `src/lib/http.ts`
- After the auth header block (L52-57), add:
  ```
  if (config.orgId && config.apiKey.startsWith("hxi_")) {
    headers["X-Helix-Org-ID"] = config.orgId;
  }
  ```
- This is placed between the auth headers (L52-57) and the Content-Type header (L60-62)
- Only set when BOTH conditions are true: orgId exists in config AND key is an hxi_ key
- When orgId is not set (bootstrap case), the header is omitted. The server allows `/api/auth/me` without the header for API key auth (bootstrap exemption), but rejects org-scoped routes

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm run build` passes

**Success Criteria**:
- `hxi_` key requests with `config.orgId` set include `X-Helix-Org-ID` header
- `hxi_` key requests without `config.orgId` do not include the header
- JWT token requests never include the header regardless of `config.orgId`
- No change to existing retry, timeout, or error handling logic

### Step 2: Local-only org switch for hxi_ keys

**Goal**: `hlx org switch` for `hxi_` keys updates only local config, preserves the API key, and never calls the server's switch-org endpoint.

**What to Build**:
- File: `src/org/switch.ts`
- Add a branch after the org name/ID resolution block (after L41) and before the server call (L43):

  **For `hxi_` keys** (`config.apiKey.startsWith("hxi_")`):
  1. Resolve org input (name or ID) — keep existing CUID detection and name resolution via `/api/auth/me`
  2. **Ambiguous name handling**: Change the name lookup from `.find()` (L28-29) to `.filter()`. If multiple matches: print all matches with IDs and exit with error: `"Error: Multiple organizations match '<input>'. Use the org ID instead:"`. If zero matches: keep existing error message.
  3. Save to config: `saveConfig({ orgId: organizationId, orgName: orgName })` — preserves existing `apiKey` and all other config fields via read-merge-write
  4. Print: `Switched to org: ${orgName} (${organizationId})`
  5. Do NOT call `POST /api/auth/switch-org`
  6. Do NOT replace `config.apiKey`

  **For JWT tokens** (else branch):
  - Keep the entire existing behavior unchanged (L43-57): call `/api/auth/switch-org`, save `accessToken` as new `apiKey`, save `orgId`/`orgName`

- The MeResponse type at top of file is already correct for the `/api/auth/me` call used in name resolution

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm run build` passes

**Success Criteria**:
- `hlx org switch <org-name>` with `hxi_` key: updates config.orgId/orgName, preserves config.apiKey (still `hxi_...`)
- `hlx org switch <org-id>` with `hxi_` key: same behavior using CUID directly
- `hlx org switch <ambiguous-name>` with `hxi_` key: prints all matches, exits with error
- `hlx org switch <org>` with JWT token: existing server-call behavior unchanged
- After switch, `~/.hlx/config.json` has correct orgId, orgName, and original apiKey

### Step 3: Config-based current marker in org list

**Goal**: `hlx org list` marks the currently selected org using local config for `hxi_` keys.

**What to Build**:
- File: `src/org/list.ts`
- In `cmdOrgList` (L19-22), change the current-org marker logic:
  ```
  for (const org of data.availableOrganizations) {
    const isCurrent = config.apiKey.startsWith("hxi_")
      ? org.id === config.orgId
      : org.id === data.organization.id;
    const marker = isCurrent ? " (current)" : "";
    console.log(`  ${org.id}  ${org.name}${marker}`);
  }
  ```
- For `hxi_` keys: compare `org.id === config.orgId` (local selection)
- For JWT tokens: keep existing `org.id === data.organization.id` (server state)
- If no orgId is set in config (bootstrap), no org gets the "(current)" marker — this is correct and helps the user see they need to run `hlx org switch`

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm run build` passes

**Success Criteria**:
- `hlx org list` with `hxi_` key: marks the org matching `config.orgId`
- `hlx org list` with `hxi_` key and no orgId set: no org marked as current
- `hlx org list` with JWT token: marks the org from server response (existing behavior)

### Step 4: Run quality gates

**Goal**: All CLI quality checks pass.

**What to Build**: No code changes. Run validation commands.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — zero errors
- `npm run build` — succeeds

**Success Criteria**:
- Both commands exit with code 0
- No TypeScript errors, no build errors

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|-----------------|----------------|
| `npm install` completed in helix-cli | available | Standard setup step | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| helix-global-server changes deployed/running (port 4000) | available | Server dev setup config; server changes must be implemented first | CHK-03, CHK-04, CHK-05 |
| `.env` file written to helix-global-server | available | Dev setup config provided | CHK-03, CHK-04, CHK-05 |
| `hxi_` API key available for CLI testing | unknown | Requires either existing key or creating one via server | CHK-03, CHK-04, CHK-05 |
| User with multiple org memberships accessible via the API key | unknown | Required for cross-org switch verification | CHK-04 |
| Login credentials: support@projectxinnovation.com / =(ohR58-w | available | Dev setup config | CHK-05 |

### Required Checks

[CHK-01] CLI TypeScript typecheck passes.
- Action: Run `npm run typecheck` in helix-cli root.
- Expected Outcome: Command exits with code 0 and zero TypeScript errors.
- Required Evidence: Full command output showing no errors.

[CHK-02] CLI build succeeds.
- Action: Run `npm run build` in helix-cli root.
- Expected Outcome: Command exits with code 0. TypeScript compilation completes without error.
- Required Evidence: Full command output showing successful build.

[CHK-03] X-Helix-Org-ID header is emitted for hxi_ key requests.
- Action: Start helix-global-server dev server (`npm run dev`, port 4000). Configure helix-cli with an `hxi_` API key and a valid `orgId`. Run `hlx org current` (which calls `GET /api/auth/me`). Observe the server response reflects the selected org.
- Expected Outcome: The server returns HTTP 200 with `organization.id` matching the configured `orgId`, confirming the header was sent and processed.
- Required Evidence: Command output from `hlx org current` showing the org name and ID matching the configured orgId. If available, server-side request log or curl equivalent showing the header.

[CHK-04] hlx org switch with hxi_ key preserves API key and updates local config.
- Action: With an `hxi_` key configured, run `hlx org switch <valid-org-name-or-id>` for an org the user has access to. Then inspect `~/.hlx/config.json`.
- Expected Outcome: Config file contains the original `hxi_` API key (not replaced by a JWT), plus updated `orgId` and `orgName` matching the target org. No server call to `/api/auth/switch-org` was made (observable by the API key not being replaced).
- Required Evidence: Contents of `~/.hlx/config.json` after the switch command, showing `apiKey` still starts with `hxi_` and `orgId`/`orgName` are updated.

[CHK-05] Session JWT org switch behavior is unchanged.
- Action: Login via browser flow or `POST /api/auth/login` to obtain a JWT. Configure CLI with the JWT. Run `hlx org switch <org>`.
- Expected Outcome: The switch calls `POST /api/auth/switch-org`, the JWT is replaced with a new one, and `orgId`/`orgName` are updated in config. Existing JWT switch behavior is preserved.
- Required Evidence: Contents of `~/.hlx/config.json` showing `apiKey` is a JWT (not `hxi_`), and `orgId`/`orgName` are updated.

## Success Metrics

1. CLI typecheck and build pass with zero errors
2. `X-Helix-Org-ID` header sent on all `hxi_`-authenticated requests when orgId is set
3. `hlx org switch` for `hxi_` keys is local-only: preserves API key, no server call
4. `hlx org switch` for JWT tokens unchanged: calls server, replaces token
5. `hlx org list` marks current org from local config for `hxi_` keys
6. Ambiguous org names produce clear error with all matches listed
7. `hlx org current` reflects the selected org (via server response with X-Helix-Org-ID)

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | X-Helix-Org-ID header, local-only switch for hxi_ keys, orgId/orgName in config, ambiguous name handling, allowed files |
| scout/reference-map.json (CLI) | Code mapping with line-level evidence | hxFetch auth headers at L52-57, switch.ts server call at L43-47, list.ts marker at L20, config.ts orgId/orgName fields |
| scout/scout-summary.md (CLI) | CLI analysis summary | No org header sent, destructive switch replaces key, config already has orgId/orgName, no test infrastructure |
| diagnosis/diagnosis-statement.md (CLI) | Root cause analysis | Three defects: no org header, destructive key replacement, list marks by server state |
| diagnosis/apl.json (CLI) | Evidence chain | hxFetch L52-57, switch.ts L49-51, list.ts L20, config orgId fields unused |
| product/product.md | Product requirements | Core workflow: login → org list → org switch → commands. Header only for hxi_ keys. Local-only switch. |
| tech-research/tech-research.md | Technical decisions | Header emission after auth headers, branch on key type for switch/list, ambiguous name handling with .filter() |
| tech-research/apl.json | Technical Q&A | CLI sends header only for hxi_ keys, org switch is local config update, list marks by config.orgId |
| src/lib/http.ts | Direct source inspection | hxFetch L37-130, auth headers at L52-57, clear insertion point for X-Helix-Org-ID |
| src/lib/config.ts | Config management | HxConfig has orgId/orgName, saveConfig does read-merge-write, loadConfig reads from file |
| src/org/switch.ts | Org switch implementation | CUID detection L25, name resolution L27-40, server call L43-47, key replacement L51 |
| src/org/list.ts | Org list implementation | /auth/me call L11, current marker L20 comparing to data.organization.id |
| src/org/current.ts | Current org display | Calls /auth/me L18, displays org from response — no code change needed |

# Diagnosis Statement

## Problem Summary

The CLI cannot use a single `hxi_` API key across multiple organizations because: (1) `hxFetch` sends no org-selection header, (2) `hlx org switch` destructively replaces the API key with a session JWT, and (3) org list marking uses the server response org instead of local config.

## Root Cause Analysis

### Defect 1: No org header in HTTP requests
`hxFetch` (`http.ts:52-57`) only sets `X-API-Key` or `Authorization: Bearer` headers. Despite `HxConfig` having `orgId` and `orgName` fields (`config.ts:15-16`) and `loadConfig` reading them from `~/.hlx/config.json` (`config.ts:40-41`), these values are never sent to the server. The server has no way to know which org the CLI user has selected.

### Defect 2: Destructive org switch
`cmdOrgSwitch` (`switch.ts:43-56`) unconditionally calls `POST /api/auth/switch-org`, which returns a JWT `accessToken`. The CLI then sets `config.apiKey = data.accessToken` (`switch.ts:51`), permanently replacing the `hxi_` key. For API key auth, the switch should only update local `orgId`/`orgName` in config without any server call.

### Defect 3: Org list current marker uses server state
`cmdOrgList` (`list.ts:20`) marks the current org by comparing `org.id === data.organization.id` — using the server's response org. For API key auth with local org selection, the current marker should use `config.orgId` to reflect the locally selected org.

## Evidence Summary

| Evidence | Location | Finding |
|----------|----------|---------|
| No org header | `http.ts:52-57` | Only X-API-Key and Authorization headers set |
| Config has org fields | `config.ts:15-16` | HxConfig defines optional orgId, orgName |
| Config loads org fields | `config.ts:40-41` | loadConfig reads orgId/orgName from file |
| Env-var gap | `config.ts:29` | Env-var config path returns without orgId |
| Destructive switch | `switch.ts:49-51` | apiKey replaced with JWT accessToken |
| Server call on switch | `switch.ts:43-47` | POST /api/auth/switch-org called unconditionally |
| List marker | `list.ts:20` | Current org matched by data.organization.id |
| No CLI tests | Glob search | No .test.ts or .spec.ts files exist in CLI repo |

## Success Criteria

1. `hxFetch` sends `X-Helix-Org-ID: <orgId>` when `config.orgId` is set and key starts with `hxi_`.
2. `hlx org switch` for `hxi_` keys updates only local config `orgId`/`orgName`, preserving the API key.
3. `hlx org switch` for JWT tokens keeps existing server-call behavior.
4. `hlx org list` marks current org by `config.orgId` for `hxi_` key auth.
5. `hlx org current` shows the selected org (reflected in server response via X-Helix-Org-ID).
6. CLI typecheck passes.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/reference-map.json (CLI) | Primary code mapping | hxFetch sends no org header; cmdOrgSwitch replaces key with JWT; orgId exists in config but unused |
| scout/scout-summary.md (CLI) | CLI analysis summary | Config already has orgId/orgName; env-var path omits orgId; no tests exist |
| src/lib/http.ts | Direct source inspection | Confirmed auth-only headers at L52-57 |
| src/lib/config.ts | Config type and IO | HxConfig has orgId/orgName; loadConfig reads from file; saveConfig does read-merge-write |
| src/org/switch.ts | Org switch implementation | Calls POST /api/auth/switch-org, replaces apiKey with JWT |
| src/org/list.ts | Org list implementation | Marks current by data.organization.id |
| src/org/current.ts | Current org display | Calls /auth/me, displays server response |

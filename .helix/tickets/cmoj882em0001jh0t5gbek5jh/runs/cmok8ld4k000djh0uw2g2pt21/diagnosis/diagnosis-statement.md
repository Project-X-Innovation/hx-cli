# Diagnosis Statement: helix-cli

## Problem Summary

The CLI currently stores a single `apiKey` in `~/.hlx/config.json` and makes server calls for `hlx org list` and org name resolution in `hlx org switch`. The continuation context (takes priority) requires org-scoped multi-token support: the config must store multiple org token entries with a current-org pointer, a new `hlx token add` command must validate and store tokens, and `hlx org list`/`hlx org switch` must be local-only. The prior run already implemented partial user-scoped features (X-Helix-Org-ID header in hxFetch, local-only switch for hxi_ keys) which partially align with the new direction but the config shape and command structure need redesign.

## Root Cause Analysis

### Root Cause 1: Single-token config shape (config.ts L12-19)

`HxConfig` type: `{ apiKey: string, url: string, orgId?: string, orgName?: string, autoUpdate?, installSource? }`. This stores exactly one token. Under multi-token model, the config must support an array of org entries: `{ orgs: [{ orgId, orgName, token, url, alias? }, ...], currentOrg?: string }` plus preserved metadata fields.

`loadConfig()` (L24-49) returns a flat config with one `apiKey`. Under multi-token model, it must resolve the current org entry from the `orgs` array and return the corresponding token and url. The env-var override path (L26-29) must remain unchanged — it returns `{ apiKey, url }` directly.

### Root Cause 2: No `hlx token add` command

No token management command exists. Token entry is via `hlx login` (OAuth browser flow or `--manual` paste), both of which save a single `apiKey` without org context. Under org-scoped model, `hlx token add --token <hxi_key> [--url <server_url>] [--name <alias>] [--current]` must:
1. Call `/api/auth/me` with the token to validate and learn the key's org
2. Store the entry under the returned `organization.id` in the `orgs` array
3. Optionally set `currentOrg` to this entry

### Root Cause 3: Server-dependent org commands

`hlx org list` (list.ts L10-26) calls `/api/auth/me` to get `availableOrganizations` from the server. Continuation context requires: "hlx org list must read local config only." It must show only locally configured org entries.

`hlx org switch` (switch.ts L25-48) resolves org names via `/api/auth/me` `availableOrganizations`. Under local-only model, name resolution must use local config entries. The hxi_ path (L50-53) already does local-only `saveConfig({ orgId, orgName })`, which partially aligns — but under multi-token model, switching must change which stored token entry is current.

### Partial alignment from prior run

The prior run already implemented:
- `hxFetch` sends `X-Helix-Org-ID` header (http.ts L59-61) — retain for server-side validation (continuation context: "if header present, must match key's org exactly or fail closed")
- `hlx org switch` hxi_ path does local-only save (switch.ts L50-53) — pattern to follow, but must switch token entries not just orgId

## Evidence Summary

| Evidence | Location | Finding |
|----------|----------|---------|
| Single-token config type | config.ts L12-19 | HxConfig has one apiKey, one url, optional orgId/orgName |
| loadConfig env-var priority | config.ts L26-29 | HELIX_API_KEY > HELIX_INSPECT_TOKEN > HELIX_INSPECT_API_KEY; returns { apiKey, url } only |
| No token add command | index.ts L49-90 | Command dispatch has login, inspect, comments, org, tickets, update — no token command |
| Org list calls server | list.ts L10-26 | Calls /api/auth/me, reads availableOrganizations |
| Org switch resolves via server | switch.ts L25-48 | Non-CUID names resolved via /api/auth/me availableOrganizations |
| hxi_ local switch exists | switch.ts L50-53 | saveConfig({ orgId, orgName }) — partial alignment |
| X-Helix-Org-ID header sent | http.ts L59-61 | Already sends header when config.orgId set and key is hxi_ — retain |
| saveConfig preserves fields | config.ts L62-73 | Read-merge-write pattern supports incremental config evolution |
| No CLI tests | package.json | No test script or test runner configured |

## Success Criteria

1. Config supports multiple org token entries with `{ orgs: [...], currentOrg }` shape
2. `hlx token add` validates token via `/api/auth/me`, stores entry under key's org
3. `hlx org list` reads local config only, shows configured orgs, marks current
4. `hlx org switch` switches `currentOrg` pointer using local config entries only
5. `hxFetch` resolves correct token from current org entry
6. X-Helix-Org-ID header continues to be sent (http.ts L59-61)
7. Env var overrides (HELIX_INSPECT_TOKEN, HELIX_API_KEY) continue to take priority
8. `hlx org current` shows the current local org (can still call /api/auth/me for user info)
9. Adding invalid/expired/revoked tokens fails and writes no config entry
10. Switching to unconfigured org fails with clear message
11. Token values masked in diagnostics and output
12. CLI typecheck passes

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (with continuation context) | Primary spec — continuation context requires org-scoped multi-token model | New token add command, multi-token config, local-only org list, token-per-org switching |
| scout/reference-map.json (CLI) | File-level evidence map from scout | Identified single-token config, server-dependent org commands, partial prior-run alignment |
| scout/scout-summary.md (CLI) | CLI analysis summary | Config has orgId/orgName from prior run; hxFetch sends X-Helix-Org-ID; no tests exist |
| src/lib/config.ts (L1-83) | Config type, load, save, requireConfig | Single apiKey; env var priority; saveConfig does read-merge-write |
| src/lib/http.ts (L1-134) | HTTP client | X-API-Key header for hxi_; X-Helix-Org-ID already sent; retry logic |
| src/org/list.ts (L1-26) | Org list implementation | Calls /api/auth/me — must become local-only |
| src/org/switch.ts (L1-72) | Org switch implementation | hxi_ path local-only; name resolution via server; JWT path calls switch-org |
| src/org/current.ts (L1-24) | Current org display | Calls /api/auth/me for org info |
| src/org/index.ts (L1-35) | Org command dispatcher | Routes current/list/switch subcommands |
| src/index.ts (L1-94) | CLI entry point | Command dispatch — needs new 'token' command |

# Scout Summary: helix-cli

## Problem

The continuation context (takes priority) requires making CLI tokens org-scoped with local multi-token storage. The current CLI stores a single `apiKey` + optional `orgId`/`orgName` in `~/.hlx/config.json`. The prior run already implemented user-scoped features: `hxFetch` sends `X-Helix-Org-ID` header (http.ts:59-61), `hlx org switch` does local-only updates for `hxi_` tokens (switch.ts:50-53), and `hlx org list` marks current by `config.orgId` for `hxi_` tokens (list.ts:20-22). The continuation context now requires: (1) a new `hlx token add` command, (2) multi-org token entries in config with a current-org pointer, (3) `hlx org list` must be local-only (currently calls server), (4) `hlx org switch` must switch which stored token entry is current, and (5) env var token override must continue working.

## Analysis Summary

### Config State (Current)
- `HxConfig` type: `{ apiKey: string, url: string, orgId?: string, orgName?: string, autoUpdate?: boolean, installSource?: InstallSource }`
- Single token stored in `config.apiKey`
- `loadConfig()` env var priority: `HELIX_API_KEY` > `HELIX_INSPECT_TOKEN` > `HELIX_INSPECT_API_KEY` for token; `HELIX_URL` > `HELIX_INSPECT_BASE_URL` > `HELIX_INSPECT_URL` for URL
- When env vars are used, `orgId`/`orgName` are NOT loaded (returns `{ apiKey, url }` only)
- `saveConfig()` does read-merge-write preserving unrelated fields

### HTTP Client (Current)
- `hxFetch` already sends `X-API-Key` header for `hxi_` tokens, `Authorization: Bearer` for others
- Already sends `X-Helix-Org-ID` when `config.orgId` is set AND token starts with `hxi_`
- Under org-scoped model, each token already represents one org; the header may still be sent for server-side validation

### Org Commands (Current)
- `hlx org list`: calls `/api/auth/me` to get `availableOrganizations` from server. Must change to local-only.
- `hlx org switch`: for `hxi_` tokens, already does local-only switch (`saveConfig({ orgId, orgName })`). For JWT tokens, calls server `/api/auth/switch-org`. Under multi-token model, switch must change which stored token entry is current.
- `hlx org current`: calls `/api/auth/me` and displays org info.

### What Must Change (Per Continuation Context)
- **Config shape**: Must support multiple org token entries. Each entry stores `orgId`, `orgName`, `token`, `url` (and optional `alias`). Plus a `currentOrg` pointer.
- **New command**: `hlx token add --token <hxi_key> [--url <server_url>] [--name <alias>] [--current]` — validates token with server, learns org, stores entry.
- **hlx org list**: Must read local config entries only. No server call.
- **hlx org switch**: Must switch `currentOrg` pointer to a locally configured entry. Name resolution from local entries, not server.
- **hxFetch**: Must resolve the correct token from the current org entry, not from a single `config.apiKey`.
- **Env var override**: When `HELIX_API_KEY`/`HELIX_INSPECT_TOKEN` + URL env vars are set, they must continue to take priority over local config.

### Login Flow Interaction
- `hlx login --manual` saves `apiKey` + `url` — no org info. Under multi-token model, manual login with `hxi_` key could redirect to `token add` flow.
- `hlx login` OAuth flow returns a JWT — not org-scoped. May remain separate.

## Relevant Files

| File | Role | Key Lines |
|------|------|-----------|
| `src/lib/config.ts` | Config type, load, save — single token, optional orgId/orgName | L12-19 (type), L24-49 (loadConfig), L62-73 (saveConfig), L75-82 (requireConfig) |
| `src/lib/http.ts` | HTTP client — already sends X-Helix-Org-ID for hxi_ tokens | L53-61 (auth + org headers), L37-134 (full hxFetch) |
| `src/org/current.ts` | Show current org from /api/auth/me | L17-24 |
| `src/org/list.ts` | List orgs from /api/auth/me — NOT local-only | L10-26 |
| `src/org/switch.ts` | Org switch — local-only for hxi_, server-side for JWT | L50-53 (hxi_ path), L55-71 (JWT path), L25-48 (name resolution via server) |
| `src/org/index.ts` | Org command dispatcher | L14-35 |
| `src/index.ts` | Main CLI entry, command wiring | L49-90 |
| `src/login.ts` | OAuth + manual login flows | L27-108 |
| `src/lib/flags.ts` | CLI flag parsing utilities | Full file |

## Execution Signals

| Command | Script |
|---------|--------|
| Typecheck | `npm run typecheck` (tsc --noEmit) |
| Build | `npm run build` (tsc) |

No test runner, lint, or CI configuration exists in this repo.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (with continuation context) | Primary spec — continuation context requires org-scoped multi-token model | New token add command, multi-token config, local-only org list, token-per-org switching |
| src/lib/config.ts | Config management code (read in full) | Single-token HxConfig type; env var priority; saveConfig preserves unrelated fields |
| src/lib/http.ts | HTTP client code (read in full) | Already sends X-Helix-Org-ID for hxi_ tokens when config.orgId set; needs token resolution from multi-token config |
| src/org/switch.ts | Org switch implementation (read in full) | hxi_ path already local-only; name resolution via server must become local |
| src/org/list.ts | Org list implementation (read in full) | Currently calls /api/auth/me; must change to local-only |
| src/org/current.ts | Current org display (read in full) | Calls /api/auth/me; may need to show local config info |
| src/index.ts | CLI entry point (read in full) | Command dispatch; needs new 'token' command case |
| src/login.ts | Login flows (read in full) | OAuth returns JWT; manual saves apiKey without org; interaction with multi-token model TBD |
| package.json | Build config | TypeScript build only; no test/lint scripts |

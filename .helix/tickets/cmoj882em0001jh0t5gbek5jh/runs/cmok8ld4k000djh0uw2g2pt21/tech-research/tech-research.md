# Tech Research: helix-cli -- Org-Scoped Multi-Token Config

## Technology Foundation

- **Runtime**: Node.js, TypeScript strict mode, ES2022 target, Node16 module resolution
- **HTTP**: Native `fetch` API via `hxFetch` wrapper (src/lib/http.ts) with retry/backoff
- **Config**: File-based `~/.hlx/config.json`, read-merge-write pattern via `saveConfig`
- **CLI framework**: Custom dispatch via switch statement in `src/index.ts`
- **Flag parsing**: Custom helpers in `src/lib/flags.ts` (`getFlag`, `hasFlag`, `requireFlag`)
- **Build**: `tsc` only; no test runner, no linter, no CI

## Architecture Decision

### Context

The continuation context (takes priority) reverses the prior user-scoped direction. Each `hxi_` token is bound to exactly one org. The CLI must:
1. Support storing multiple org tokens in `~/.hlx/config.json`
2. Provide `hlx token add` to validate and store tokens
3. Make `hlx org list` local-only (currently calls server)
4. Make `hlx org switch` resolve from local config (currently resolves via server)
5. Resolve the correct token from the current org entry for all requests

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. New config shape with compatibility layer** | New `orgs` array + `currentOrg` pointer. `loadConfig` resolves current entry and returns existing `HxConfig` shape. | Minimal consumer changes; all existing code sees `apiKey`/`url`/`orgId`/`orgName` as before | Config file format changes; old configs won't load |
| B. Parallel config system | New `loadMultiOrgConfig()` alongside `loadConfig()` | Old code untouched | Two config paths to maintain; every consumer must choose |
| C. Strategy pattern | `OrgStrategy` interface with `ApiKeyOrgStrategy` / `JwtOrgStrategy` | Clean separation | Over-engineered for this scope; adds files and abstractions for simple branching |

### Chosen: Option A -- New config shape with HxConfig compatibility layer

**Rationale**: All CLI commands and `hxFetch` already consume `HxConfig` with `{ apiKey, url, orgId?, orgName? }`. By having `loadConfig()` internally resolve the current org entry and return the same shape, zero consumer changes are needed. The `orgs` array is only parsed inside `loadConfig` / `saveConfig` / the new commands. Old config migration is explicitly out of scope per continuation context.

## Core API/Methods

### Config shape -- `~/.hlx/config.json`

New format:
```json
{
  "orgs": [
    {
      "orgId": "cuid...",
      "orgName": "Acme Corp",
      "token": "hxi_...",
      "url": "https://helix.example.com",
      "alias": "acme"
    },
    {
      "orgId": "cuid...",
      "orgName": "Beta Inc",
      "token": "hxi_...",
      "url": "https://helix.example.com"
    }
  ],
  "currentOrg": "cuid...",
  "autoUpdate": true,
  "installSource": { "mode": "github", "repo": "...", "branch": "main" }
}
```

Each entry in `orgs` represents one org-scoped token. `currentOrg` is the `orgId` of the active entry. `autoUpdate` and `installSource` are preserved metadata from the update system.

### loadConfig() -- Resolution logic

```
1. Env var path (unchanged): HELIX_API_KEY/HELIX_INSPECT_TOKEN + HELIX_URL/HELIX_INSPECT_BASE_URL
   -> return { apiKey, url } immediately (no orgId, no orgName)
2. Read ~/.hlx/config.json
3. If file has `orgs` array:
   a. Find entry where orgId === currentOrg
   b. If found: return { apiKey: entry.token, url: entry.url, orgId: entry.orgId, orgName: entry.orgName }
   c. If not found (currentOrg not set or points to removed entry): return null
4. If file has legacy `apiKey` field (old format): return null (migration out of scope)
5. Return null
```

The key insight: `loadConfig()` continues to return `HxConfig | null`. The new config shape is internal. `hxFetch` and all commands see the same `{ apiKey, url, orgId, orgName }` they always have.

### saveConfig() -- Preserving orgs array

The existing `saveConfig` does read-merge-write. For the new config commands (`token add`, `org switch`), new helper functions handle the `orgs` array:
- `addOrgEntry(entry)`: read config, append or replace entry by orgId, write
- `setCurrentOrg(orgId)`: read config, set `currentOrg`, write
- `getOrgEntries()`: read config, return `orgs` array
- `getOrgEntry(orgIdOrAlias)`: find by orgId or alias

The existing `saveConfig({ autoUpdate, installSource })` continues to work for update metadata.

### hlx token add -- New command

```
hlx token add --token <hxi_key> [--url <server_url>] [--name <alias>] [--current]
```

Flow:
1. Parse flags: `--token` (required), `--url` (optional, default from existing config or required), `--name` (optional alias), `--current` (optional boolean)
2. Call `/api/auth/me` with the token to validate and learn the key's org
3. On HTTP error: print error (masked token), exit 1, write nothing
4. Extract `organization.id` and `organization.name` from response
5. Store entry `{ orgId, orgName, token, url, alias }` in `orgs` array via `addOrgEntry`
6. If `--current` flag OR no `currentOrg` exists: set `currentOrg` to this entry's `orgId`
7. Print confirmation: "Added token for <orgName> (<orgId>)" with masked token prefix

The `--url` default: if other entries exist, use the URL from the first entry. If no entries exist, `--url` is required.

### hlx org list -- Local-only

Reads local `orgs` array. No server call.

```
Organizations:

  cuid123  Acme Corp (acme)  (current)
  cuid456  Beta Inc
```

Shows orgId, orgName, alias (if set), and "(current)" marker for `currentOrg` entry.

### hlx org switch -- Local-only resolution

```
hlx org switch <org-id-or-alias-or-name>
```

For `hxi_` token auth (multi-org config):
1. Read local `orgs` array
2. Match input against: orgId (exact), alias (exact), orgName (case-insensitive)
3. If no match: print error listing configured orgs, exit 1
4. If multiple name matches: print all matches with IDs, exit 1 (fail on ambiguity)
5. Set `currentOrg` to matched orgId
6. Print: "Switched to org: <orgName> (<orgId>)"

For JWT auth (legacy single-token): keep existing server-side switch behavior unchanged.

### hlx org current -- Keep server call

`hlx org current` continues to call `/api/auth/me` to show user info (name, email) and validate the token is still active. Under org-scoped model, the current org's token authenticates into the correct org, so `getMe` returns the right data.

### hxFetch -- X-Helix-Org-ID header

The existing code (http.ts L59-61) already sends `X-Helix-Org-ID` when `config.orgId` is set and the key starts with `hxi_`. This is retained.

Under the new config, `config.orgId` comes from the current org entry (which always matches the token's org). The server validates match-or-fail-closed. This provides defense-in-depth: if the wrong token were somehow used, the header mismatch causes a clear 403 rather than silent success.

## Technical Decisions

### Decision 1: Config format -- Array vs. object map

**Chosen**: Array of entries (`orgs: [...]`) with `currentOrg` pointer.

**Rejected alternative**: Object map keyed by orgId (`orgs: { "cuid...": { ... } }`). Array is natural for iteration in `hlx org list`. The list is small (typically 1-5 entries), so O(n) lookup is negligible. Array preserves insertion order for display.

### Decision 2: loadConfig returns HxConfig (compatibility layer)

**Chosen**: `loadConfig()` returns the same `HxConfig` type. Resolves current org entry internally.

**Rationale**: Zero changes to `hxFetch`, `cmdOrgCurrent`, `cmdOrgSwitch` (JWT path), `runInspect`, `runComments`, `runTickets`. All these pass `config` to `hxFetch` which reads `config.apiKey` and `config.orgId`. The compatibility layer means only config-management code and the new commands deal with the `orgs` array.

### Decision 3: hlx login --manual -- Keep as separate flow

**Chosen**: `hlx login --manual` continues saving a single `apiKey` (old format). Not redirected to `hlx token add`.

**Rationale**: `hlx login --manual` also accepts JWT tokens. Old config migration is out of scope. Users who want multi-token use `hlx token add`. The old format just won't be read by the new `loadConfig` (returns null), prompting the user to use `hlx token add`.

### Decision 4: Token masking in output

**Chosen**: Mask tokens in all CLI output. Show only prefix: `hxi_abc1...` (first 8 chars after `hxi_`).

Where applied:
- `hlx token add` success message
- Error messages that reference a token
- `hlx org list` does NOT show tokens (only org info)
- Never log full tokens

### Decision 5: --url flag behavior for hlx token add

**Chosen**: If `--url` not provided, use URL from existing config entries (if any). If no entries exist, `--url` is required.

**Rationale**: Most users have one server. Requiring `--url` on every `hlx token add` when adding a second token for the same server is poor UX. But the first token must establish the server URL.

**Edge case**: Multiple servers. Each entry stores its own `url`, so tokens for different servers coexist. `hxFetch` uses the current entry's URL.

### Decision 6: Org alias uniqueness

**Chosen**: Aliases must be unique across all configured orgs. `hlx token add --name <alias>` fails if the alias is already in use by another entry.

**Rationale**: Continuation context says "Switching to an unconfigured org must fail with a clear message." Ambiguous aliases would violate this.

### Decision 7: requireConfig behavior

**Chosen**: `requireConfig()` calls `loadConfig()`. If null (no current org or no env vars), print: "Not authenticated. Run `hlx token add --token <key> --url <server>` or set HELIX_API_KEY + HELIX_URL env vars." and exit 1.

Updated message reflects the new onboarding command.

### Decision 8: Adding a token for an already-configured org

**Chosen**: `hlx token add` replaces the existing entry for that orgId (by matching `organization.id` from the server response). This supports token rotation without explicit removal.

If the org already has an entry, the new token replaces it. The alias is updated if `--name` is provided, or preserved if not.

## Cross-Platform Considerations

Not applicable. CLI is a Node.js application. `~/.hlx/config.json` uses `homedir()` which is cross-platform.

## Performance Expectations

- **Config resolution**: Reading and parsing a small JSON file (~500 bytes). Sub-millisecond.
- **hlx org list**: Pure local read. No network. Instant.
- **hlx org switch**: Pure local read + write. No network. Instant.
- **hlx token add**: One `GET /api/auth/me` call + local file write. ~200ms typical.
- **hxFetch overhead**: Unchanged. Adding `X-Helix-Org-ID` header is ~30 bytes.

## Dependencies

No new dependencies. All changes use existing Node.js built-ins (`fs`, `path`, `os`) and custom CLI utilities (`flags.ts`).

## Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Old config format becomes unusable | Low | Intentional per continuation context: "Backward compatibility with old local single-token config is not required." Updated `requireConfig` error message guides to `hlx token add`. |
| 2 | No CLI test infrastructure | Medium | CLI has no test runner. Changes must be verified manually or via typecheck. Future work to add tests noted in product doc. |
| 3 | Ambiguous org names in local config | Low | `hlx org switch` matches by orgId (exact) first, then alias (exact), then name (case-insensitive). Multiple name matches fail with clear error. |
| 4 | Token validation fails due to server-side bug | Low | `hlx token add` shows the HTTP error message. Token is not stored on failure. |

## Deferred to Round 2

| Item | Reason |
|------|--------|
| CLI test infrastructure | No test runner exists; all changes verified via typecheck + manual testing |
| `HELIX_ORG_ID` env var for selecting a local org entry | Product doc marks as future consideration |
| Config migration tool (`hlx config migrate`) | Product doc marks as future; old format not supported by design |
| Token rotation UX (`hlx token replace`) | Product doc marks as future; `hlx token add` replaces existing entry as workaround |
| `hlx token remove` command | Useful but not in scope for MVP |

## Summary Table

| Area | Decision | Rationale |
|------|----------|-----------|
| Config shape | `orgs` array + `currentOrg` pointer | Natural for iteration; supports multi-server; small list |
| loadConfig | Returns HxConfig; resolves internally | Zero consumer changes |
| hlx token add | Validates via /api/auth/me; stores org/token pair | Fail-safe onboarding; server is source of truth for org |
| hlx org list | Local-only; reads orgs array | Continuation context requirement; works offline |
| hlx org switch | Local-only; matches by ID/alias/name | Continuation context requirement; no server call |
| hlx org current | Keeps server call | Shows user info; validates token still active |
| X-Helix-Org-ID header | Retained (http.ts L59-61) | Defense-in-depth; server validates match |
| hlx login --manual | Kept as separate flow | Also handles JWTs; migration out of scope |
| Token masking | Show only hxi_ + first 8 chars | Security; never expose full token |
| Duplicate org handling | Replace existing entry | Supports token rotation |

## APL Statement Reference

See `tech-research/apl.json`. Key finding: the CLI changes are a config restructure + three new/modified commands. The compatibility layer in `loadConfig` means `hxFetch` and all existing commands work without modification. Env-var override path is completely unchanged.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (continuation context) | Primary spec -- reverses to org-scoped with multi-token CLI | New token add command, multi-token config, local-only org list/switch |
| diagnosis/diagnosis-statement.md (CLI) | Root cause analysis | Three root causes: single-token config, missing token add command, server-dependent org commands |
| diagnosis/apl.json (CLI) | Investigation evidence | Confirmed env-var override path; multi-token config shape; hxFetch token resolution |
| product/product.md | Product vision and features | orgs array + currentOrg shape; /api/auth/me for validation; env var priority; out of scope items |
| scout/reference-map.json (CLI) | File-level evidence | Line-level mapping of config, HTTP client, org commands, login flows |
| scout/scout-summary.md (CLI) | Analysis summary | Single-token config; hlx org list calls server; hxFetch sends X-Helix-Org-ID; no tests |
| repo-guidance.json | Repo intent | Both repos confirmed as change targets |
| src/lib/config.ts (L1-83) | Direct code inspection | HxConfig type; loadConfig env-var priority; saveConfig read-merge-write; requireConfig error message |
| src/lib/http.ts (L1-134) | Direct code inspection | hxFetch auth headers; X-Helix-Org-ID already sent at L59-61; retry logic |
| src/org/list.ts (L1-26) | Direct code inspection | Calls /api/auth/me for availableOrganizations; marks current by server state |
| src/org/switch.ts (L1-72) | Direct code inspection | hxi_ path local-only (L50-53); name resolution via server (L25-48); JWT path calls switch-org |
| src/org/current.ts (L1-24) | Direct code inspection | Calls /api/auth/me; displays org info |
| src/org/index.ts (L1-35) | Direct code inspection | Org command dispatcher; routes current/list/switch |
| src/index.ts (L1-94) | Direct code inspection | CLI entry point; command dispatch switch; needs new token command |
| src/login.ts (L1-109) | Direct code inspection | OAuth + manual login; both save single apiKey |
| src/lib/flags.ts (L1-31) | Direct code inspection | getFlag, hasFlag, requireFlag, getPositionalArgs utilities |
| Server tech-research (this run) | Cross-repo coordination | Server resolves key's org; /api/auth/me returns org; 403 for header mismatch |

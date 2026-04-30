# Tech Research: Make CLI API Keys User-Scoped With Explicit Org Selection

## Technology Foundation

- **CLI**: TypeScript strict mode, ES2022 target, Node16 module resolution
- **HTTP**: Native `fetch` API via `hxFetch` wrapper with retry/backoff
- **Config**: File-based `~/.hlx/config.json` with read-merge-write via `saveConfig`
- **Build**: `tsc` only; no test runner, no linter, no CI

## Architecture Decision

### Problem

The CLI sends no org context with API requests, `hlx org switch` destroys `hxi_` API keys by replacing them with JWTs, and `hlx org list` marks current org using server state instead of local config. Three files need changes.

### Options Considered

#### Option A: Conditional branching on key type in existing functions (Chosen)

- `hxFetch`: Add `X-Helix-Org-ID` header when `config.orgId` is set AND `config.apiKey.startsWith("hxi_")`
- `cmdOrgSwitch`: Branch on `config.apiKey.startsWith("hxi_")` — local-only for `hxi_`, existing server call for JWT
- `cmdOrgList`: Branch on key type for current-org marker — `config.orgId` for `hxi_`, `data.organization.id` for JWT

**Rationale**: Minimal change. Each function gains a simple `if (isApiKey)` branch. No new files, no architectural change. JWT behavior remains untouched in the `else` path.

#### Option B: Extract auth-type-aware strategy pattern

- Create `OrgStrategy` interface with `ApiKeyOrgStrategy` and `JwtOrgStrategy` implementations
- Route switch/list/header logic through strategy

**Rejected**: Over-engineered for three simple branches in three functions. Adds new files and abstractions without clear benefit. The CLI has no test infrastructure to validate strategy correctness.

### Chosen: Option A

## Core API/Methods

### `http.ts` — `hxFetch` header addition

After the existing auth header block (L52-57), add the org header:

```
if (config.orgId && config.apiKey.startsWith("hxi_")) {
  headers["X-Helix-Org-ID"] = config.orgId;
}
```

This ensures:
- Header is only sent for `hxi_` API keys (not JWTs)
- Header is only sent when `orgId` is configured (not before first `hlx org switch`)
- No change to JWT-authenticated requests

### `switch.ts` — `cmdOrgSwitch` branching

For `hxi_` keys:
1. Call `GET /api/auth/me` to get `availableOrganizations` (name resolution)
2. Match input against available orgs (by ID or case-insensitive name)
3. If ambiguous (multiple name matches), print all matches and exit with error
4. Save `{ orgId, orgName }` to config via `saveConfig`; do NOT modify `apiKey`
5. Print confirmation

For JWT tokens:
- Keep existing behavior: call `POST /api/auth/switch-org`, save new `accessToken` as `apiKey`

### `list.ts` — `cmdOrgList` marker branching

For `hxi_` keys:
- Mark current org by `org.id === config.orgId`

For JWT tokens:
- Keep existing behavior: mark by `org.id === data.organization.id`

### `current.ts` — No change needed

The server response from `GET /api/auth/me` already reflects the selected org (via `X-Helix-Org-ID` header processed by server middleware). Display code works as-is.

## Technical Decisions

### 1. Header emission scope: `hxi_` keys only

**Chosen**: Only send `X-Helix-Org-ID` when `config.apiKey.startsWith("hxi_")`.
**Rationale**: JWT tokens embed their org in the token payload. The server resolves JWT org from the token, not from a header. Sending the header for JWTs would be ignored by the server and could cause confusion.

### 2. Config persistence: read-merge-write via `saveConfig`

**Chosen**: Use existing `saveConfig` which does read-merge-write (config.ts:62-73).
**Rationale**: `saveConfig` already preserves unrelated fields (autoUpdate, installSource). Writing `{ orgId, orgName }` will merge into existing config without destroying other fields.

### 3. Ambiguous org names: fail with error, list matches

**Chosen**: If `input.toLowerCase()` matches multiple org names, print all matching orgs with IDs and exit with error.
**Rationale**: Ticket requires "fail with a clear error instead of selecting the first match." Current code uses `.find()` (returns first match); change to `.filter()` and check length.

### 4. Org name resolution for `hxi_` keys on first switch

**Analysis**: `cmdOrgSwitch` calls `GET /api/auth/me` to resolve org name to ID. With the server changes, this endpoint works for API key auth even without `X-Helix-Org-ID` (bootstrap exemption — see server tech-research). The CLI will get back `availableOrganizations` and can resolve the name.

**Decision**: No special handling needed in the CLI for the bootstrap case. The server's `/api/auth/me` endpoint handles it.

### 5. `hlx org list` before `orgId` is set

**Analysis**: If no `orgId` is in config, `config.orgId` is `undefined`. The marker comparison `org.id === config.orgId` will be `false` for all orgs. This is correct — no org is "current" yet.

**Decision**: No special handling. The list displays without any "(current)" marker when `orgId` is not set. This is good UX — it tells the user they need to run `hlx org switch`.

## Cross-Platform Considerations

Not applicable. CLI is a Node.js application running on the user's machine.

## Performance Expectations

- **Header addition**: ~30 bytes per request. Negligible.
- **`hlx org switch` for `hxi_`**: One `GET /api/auth/me` call + local file write. Currently does one GET + one POST. Net savings: one fewer network call.
- **`hlx org list`**: No change in network calls. Only the marker logic changes (local comparison vs server comparison).

## Dependencies

No new dependencies. All changes use existing `hxFetch`, `saveConfig`, and `loadConfig`.

## Deferred to Round 2

| Item | Reason |
|------|--------|
| `HELIX_ORG_ID` env-var support | Product doc marks as future; config.ts env-var path (L29) returns without orgId |
| CLI test infrastructure | No test runner exists; tests are manual for MVP |
| Org selection during `hlx login --manual` | UX improvement for first-use; MVP accepts fail-closed until `hlx org switch` |

## Summary Table

| Decision | Choice | Key Reason |
|----------|--------|------------|
| Architecture | Conditional branching on key type | Minimal change, three simple branches |
| Header | `X-Helix-Org-ID` for `hxi_` keys only | JWTs embed org in token |
| Switch behavior | Local-only for `hxi_`, server call for JWT | Preserves API key |
| List marker | `config.orgId` for `hxi_`, `data.organization.id` for JWT | Reflects local vs server state |
| Ambiguous names | Fail with error, list matches | Ticket requires explicit failure |
| Bootstrap | No CLI special handling; server /api/auth/me handles it | Clean separation of concerns |

## APL Statement Reference

See `tech-research/apl.json` for the question-answer-evidence chain.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (CLI) | Primary specification | X-Helix-Org-ID header, local-only switch for hxi_ keys, fail on ambiguous names |
| diagnosis/diagnosis-statement.md (CLI) | Root cause analysis | Three defects: no org header, destructive key replacement, wrong current marker |
| diagnosis/apl.json (CLI) | Evidence chain | Confirmed three files need changes; env-var gap; no tests |
| product/product.md (CLI) | Product requirements | Env-var org out of scope; bootstrap friction acceptable for MVP |
| scout/reference-map.json (CLI) | File mapping | Line-level evidence for config, HTTP client, org commands |
| scout/scout-summary.md (CLI) | CLI analysis | hxFetch sends no org header; switch replaces key; config has orgId/orgName |
| helix-cli/src/lib/http.ts | Direct source | Auth headers at L52-57; no org header; retry/backoff wrapper |
| helix-cli/src/lib/config.ts | Direct source | HxConfig with orgId/orgName; saveConfig read-merge-write; env-var path omits orgId |
| helix-cli/src/org/switch.ts | Direct source | POST /api/auth/switch-org at L43; replaces apiKey with JWT at L51; name resolution via /auth/me |
| helix-cli/src/org/list.ts | Direct source | Marks current by data.organization.id at L20 |
| helix-cli/src/org/current.ts | Direct source | Calls /auth/me; displays org from response |
| Server tech-research.md | Cross-repo coordination | Bootstrap exemption for /api/auth/me; X-Helix-Org-ID handling; 401 vs 403 semantics |

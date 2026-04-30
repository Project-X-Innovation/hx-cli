# Product: Make CLI Tokens Org-Scoped and Switchable Locally

## Problem Statement

The Helix CLI auth model was recently changed toward a user-scoped direction where one `hxi_` token could access any org the user belongs to via an `X-Helix-Org-ID` header. That direction is being reversed. Tokens must be org-scoped again: each `hxi_` token grants access to exactly one organization (determined by `InspectionApiKey.organizationId`).

Today's partially-implemented user-scoped code creates two problems:
1. **Server**: The auth middleware (`resolveApiKeyAuth`) has a dual-path design that lets a single token select any org the user belongs to — the opposite of the intended org-scoped boundary.
2. **CLI**: The config stores a single token with no support for managing multiple org tokens locally. `hlx org list` fetches from the server rather than showing locally configured orgs.

Multi-org CLI users need a way to store separate tokens per org and switch between them locally, while the server enforces that each token only authenticates into its own org.

## Product Vision

Each `hxi_` token is permanently bound to one organization. A CLI user who works across multiple orgs stores one token per org locally. The CLI tracks which org is currently active and uses the corresponding token for requests. Org switching is entirely local — no server-side state mutation, no token destruction. The server remains the authority on token-to-org binding and ignores any attempt to override it.

## Users

| User | Need |
|------|------|
| **Multi-org CLI user** | Store tokens for multiple orgs and switch between them without re-authenticating |
| **Helix sandbox agent** | Continue using `HELIX_INSPECT_TOKEN` and `HELIX_INSPECT_BASE_URL` env vars without needing local config |
| **Single-org CLI user** | Add one token and use the CLI without extra steps |
| **Browser / session user** | No change; JWT-based auth and org switching remain unaffected |

## Use Cases

1. **Token onboarding**: A user receives an org-scoped `hxi_` token, runs `hlx token add --token <key>`, and the CLI validates it with the server, learns the org, and stores the org/token pair locally.
2. **Multi-org switching**: A user with tokens for Org A and Org B runs `hlx org switch <org-b>` to change which stored token the CLI uses. Subsequent commands operate against Org B.
3. **Local org discovery**: A user runs `hlx org list` and sees only the orgs for which they have locally configured tokens, with the current org marked.
4. **Agent operation**: A Helix sandbox agent runs with `HELIX_INSPECT_TOKEN` and `HELIX_INSPECT_BASE_URL` env vars. The token's org is resolved server-side from the key record. No local config needed.
5. **Security boundary**: A user tries to send an `X-Helix-Org-ID` header that doesn't match their token's org. The server rejects the request.

## Core Workflow

1. User receives an org-scoped `hxi_` token for an organization.
2. User runs `hlx token add --token <hxi_key> [--url <server_url>] [--name <alias>] [--current]`.
3. CLI validates the token with the server (via `/api/auth/me`), learns the token's actual org.
4. CLI stores the org/token pair in `~/.hlx/config.json` under an `orgs` array; optionally sets it as current.
5. User repeats steps 1-4 for additional orgs.
6. `hlx org list` shows locally configured orgs. `hlx org switch <org>` changes which stored token is active.
7. Normal CLI commands use the token for the current local org. Server resolves org from the key record.
8. If env vars (`HELIX_INSPECT_TOKEN`, etc.) are set, they override local config — agents work without any local setup.

## Essential Features (MVP)

| # | Feature | User Benefit |
|---|---------|-------------|
| 1 | `hlx token add` command validates a token with the server and stores it under the key's actual org | Safe onboarding — invalid/expired/revoked tokens are rejected before writing config |
| 2 | Multi-token local config (`orgs` array + `currentOrg` pointer in `~/.hlx/config.json`) | Users can store and manage tokens for multiple orgs in one place |
| 3 | `hlx org list` reads local config only | Works offline; shows only orgs with configured tokens; no server call |
| 4 | `hlx org switch <org-id-or-alias>` changes the current local org pointer | Switches which token is used without server-side state changes |
| 5 | Server API-key auth resolves org from `InspectionApiKey.organizationId` (not from header or user's active org) | Each token is strictly bound to one org; no cross-org access |
| 6 | If `X-Helix-Org-ID` header is present, it must match the key's org or fail closed | Security boundary — cannot override token's org binding |
| 7 | Env var token override (`HELIX_INSPECT_TOKEN`, `HELIX_API_KEY`) continues to work | Helix sandbox agents operate without local config |
| 8 | Token values masked in CLI output and diagnostics | Tokens are not leaked in logs or error messages |
| 9 | JWT/browser auth behavior unchanged | No regression for browser users |

## Features Explicitly Out of Scope (MVP)

- Browser UI changes of any kind.
- New dedicated CLI-only API routes (`/api/cli/*`).
- Automatic migration of old single-token `~/.hlx/config.json` format.
- Server-side org switching for API-key auth.
- Showing orgs that do not already have a local token configured in `hlx org list`.
- One token that can access all user orgs (explicitly reversed).
- Database schema changes (existing models are sufficient).
- CLI self-update or packaging changes.

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | A valid org-scoped token can be added locally and becomes usable by normal CLI commands | `hlx token add` + subsequent command succeeds |
| 2 | Two tokens for two different orgs can be stored simultaneously | Config file inspection shows two entries in `orgs` array |
| 3 | `hlx org switch` changes which token subsequent commands use | CLI commands after switch use the switched org's token |
| 4 | `hlx org list` works without a server call | Operates offline; shows locally configured orgs only |
| 5 | API-key auth succeeds even when the user's active browser org differs from the token's org | Automated server test |
| 6 | API-key auth cannot access another org by sending a different `X-Helix-Org-ID` | Automated server test — conflicting header returns 403 |
| 7 | Helix sandbox usage with `HELIX_INSPECT_TOKEN` + `HELIX_INSPECT_BASE_URL` still works for inspect and comments commands | Automated or manual verification |
| 8 | JWT auth and browser login behavior remain unchanged | Existing server tests pass |
| 9 | Adding an invalid/revoked/expired token fails and writes no config entry | CLI test or manual verification |
| 10 | Switching to an unconfigured org fails with a clear message | CLI test or manual verification |
| 11 | Server and CLI typecheck pass | `npm run typecheck` in both repos |

## Key Design Principles

- **Org-scoped tokens**: Each `hxi_` token belongs to exactly one org. `InspectionApiKey.organizationId` is the server's source of truth.
- **Local-only CLI org management**: Switching orgs changes only which locally stored token is active. No server-side state mutation.
- **Fail closed**: Missing current org, invalid token, conflicting org header — all result in clear errors, never degraded access or silent fallback.
- **Env var priority**: When `HELIX_INSPECT_TOKEN`/`HELIX_API_KEY` env vars are set, they override local config unconditionally.
- **Preserve existing behavior**: JWT session auth, browser flows, `POST /api/auth/switch-org`, inspection routes — all unchanged.
- **Token security**: Never print full tokens in output or errors. Mask values in diagnostics.

## Scope & Constraints

- **Two repos changed**: `helix-global-server` (auth middleware simplification, removal of user-scoped dual-path, test updates) and `helix-cli` (multi-token config, new `token add` command, local-only org commands).
- **No schema changes**: `InspectionApiKey.organizationId`, `UserOrganization`, `User.isAdmin` already exist and are sufficient.
- **No new server endpoints**: Token validation uses existing `/api/auth/me`. No `/api/cli/*` routes.
- **Server simplification**: The prior dual-path `resolveApiKeyAuth` (header-selected org vs. bootstrap path) collapses to a single path that always uses the key's own org. The `apiKeyMissingOrgHeader` flag and `requireOrgForApiKey` middleware become unnecessary.
- **Backward compatibility**: Old single-token config migration is explicitly out of scope.

## Future Considerations

- **Config migration tool**: A future `hlx config migrate` could convert old single-token configs to the new multi-token format.
- **CLI test infrastructure**: The CLI repo has no test runner. Future work should add tests for config persistence, token resolution, and local-only org commands.
- **Token rotation UX**: A command to replace a token for an already-configured org without removing and re-adding.
- **Env-var org override**: A `HELIX_ORG_ID` env var for CI/automation pipelines that need to select a specific local token entry.

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|-----------------|--------|
| 1 | **`lookupUserForAuth` org check**: The function at middleware.ts L136 compares `User.organizationId` (user's active browser org) against the passed org. Under org-scoped model, the user's active browser org may differ from the key's org. This check must be bypassed for API-key auth paths. | Server implementation must inline user loading for API-key auth without this check. Diagnosis confirmed the pattern already exists in the selected-org path (L249-262). |
| 2 | **`/api/auth/me` accessibility for token validation**: `hlx token add` needs to call `/api/auth/me` with a token that has no local org context yet. Under org-scoped model, the key resolves its own org server-side, so this should work — but the route must remain accessible before any org-gating middleware. | Diagnosis confirmed `/api/auth/me` is registered at routes/api.ts L168, before the `requireOrgForApiKey` gate at L240. Works as-is after `apiKeyMissingOrgHeader` logic is removed. |
| 3 | **Env-var inspection flows and `X-Helix-Org-ID` header**: If Helix agent flows using env-var tokens also send an `X-Helix-Org-ID` header, the new match-or-fail-closed rule could break them. | Need to verify whether inspection/comment flows send this header. Scout evidence shows CLI sends it only when `config.orgId` is set — env-var paths don't load orgId, so header is not sent. Low risk. |
| 4 | **`hlx login --manual` interaction with multi-token model**: Currently saves a single `apiKey`. Under multi-token model, manual login with an `hxi_` key may need to redirect to the `token add` flow. | UX decision for implementation. Could remain a separate JWT-oriented flow or be adapted. |
| 5 | **Ambiguous org aliases**: If two locally configured orgs have the same alias, `hlx org switch <alias>` must fail clearly rather than picking one silently. | CLI implementation must enforce unique aliases or fail on ambiguity. |
| 6 | **Production keys span multiple orgs per user**: Scout found the same user has active keys for 3 different orgs in production — confirming multi-key-per-user is already the real-world pattern. The new model formalizes CLI support for this. | Validates the product direction. No risk, but important context. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (both repos) | Primary spec — but continuation context (org-scoped) takes priority over original description (user-scoped) | Org-scoped tokens, multi-token CLI config, local-only org list/switch, `hlx token add`, env var override preserved |
| scout/scout-summary.md (helix-global-server) | Server auth flow analysis | Dual-path `resolveApiKeyAuth` exists from prior user-scoped run; `lookupUserForAuth` has problematic `User.organizationId` check; production has 5 active keys across 3 orgs |
| scout/scout-summary.md (helix-cli) | CLI state analysis | Single-token config; `hlx org list` calls server; `hxFetch` already sends `X-Helix-Org-ID` when `config.orgId` set; no CLI tests exist |
| scout/reference-map.json (helix-global-server) | Detailed file-level code evidence | Line-level mapping of middleware dual paths, flag enforcement points, route ordering, test suite structure |
| scout/reference-map.json (helix-cli) | Detailed file-level code evidence | Line-level mapping of config shape, HTTP client, org commands, login flows |
| diagnosis/diagnosis-statement.md (helix-global-server) | Server root cause analysis | Three root causes: dual-path org resolution, `lookupUserForAuth` org check, dead `apiKeyMissingOrgHeader` flag |
| diagnosis/diagnosis-statement.md (helix-cli) | CLI root cause analysis | Three root causes: single-token config, missing `token add` command, server-dependent org commands |
| diagnosis/apl.json (helix-global-server) | Diagnosis evidence and answered questions | Confirmed `/api/auth/me` accessible for validation; inspection routes unaffected; no schema changes needed |
| diagnosis/apl.json (helix-cli) | Diagnosis evidence and answered questions | Confirmed env-var override path; multi-token config shape proposal; `hxFetch` token resolution approach |
| repo-guidance.json (helix-global-server) | Repo intent metadata | Both repos confirmed as change targets by diagnosis |
| /tmp/helix-inspect/manifest.json | Runtime inspection availability | DATABASE and LOGS available for helix-global-server; production state verified via scout |

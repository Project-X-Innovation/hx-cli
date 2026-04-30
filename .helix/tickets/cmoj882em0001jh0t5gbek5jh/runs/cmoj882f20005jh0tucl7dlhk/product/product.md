# Product: Make CLI API Keys User-Scoped With Explicit Org Selection

## Problem Statement

A Helix CLI user with access to multiple organizations is forced to create a separate `hxi_` API key per org. The current system hard-binds each API key to the organization where it was created and has no mechanism for the user to select a different org at request time. Worse, running `hlx org switch` destroys the API key by replacing it with a short-lived session JWT, leaving the user locked out of CLI API-key auth entirely.

This means multi-org users cannot operate across their organizations from the CLI without juggling multiple keys and re-authenticating after every org switch.

## Product Vision

A single `hxi_` API key authenticates the user, not one fixed organization. The user explicitly selects their working org locally in the CLI, and the server validates per-request that the user can access the selected org. The experience mirrors the browser multi-org model: one identity, explicit org switching, server-enforced boundaries.

## Users

| User | Need |
|------|------|
| **Multi-org CLI user** | Use one API key across all their orgs, switch org context without losing the key |
| **Admin / support user** | Access any organization's data from the CLI for investigation or support |
| **Single-org CLI user** | No regression; existing auth continues to work once org is set |
| **Browser / session users** | No change; existing JWT-based org switching is unaffected |

## Use Cases

1. **Cross-org development**: A developer runs `hlx org switch <org>` then `hlx inspect repos` and `hlx tickets list`, repeating for each org they contribute to, all with one API key.
2. **Admin support triage**: An admin runs `hlx org switch <customer-org>` to inspect a customer's repos and tickets without needing an explicit membership in that org.
3. **Initial setup**: A new CLI user runs `hlx login --manual`, enters their `hxi_` key, then runs `hlx org switch <org>` to set their working context before any org-scoped command.
4. **Org discovery**: A user runs `hlx org list` to see every organization they can access, with the currently selected org clearly marked.

## Core Workflow

1. User authenticates the CLI with an `hxi_` API key (`hlx login --manual`).
2. User runs `hlx org list` to see available organizations.
3. User runs `hlx org switch <org-name-or-id>` to set their working org locally.
4. CLI persists `orgId` and `orgName` in `~/.hlx/config.json`.
5. On every subsequent request, CLI sends `X-Helix-Org-ID` header with the selected org.
6. Server validates key, resolves user, checks user can access the selected org, and builds auth context for that org.
7. User runs org-scoped commands (`hlx inspect repos`, `hlx tickets list`, `hlx org current`) using the selected org.
8. User can switch orgs at any time by repeating step 3; the API key is never replaced or destroyed.

## Essential Features (MVP)

| # | Feature | User Benefit |
|---|---------|-------------|
| 1 | CLI sends `X-Helix-Org-ID` header on `hxi_`-authenticated requests | Server knows which org the user intends |
| 2 | Server reads `X-Helix-Org-ID`, validates org access (membership or admin), builds AuthContext from selected org | Correct org-scoped data is returned; unauthorized access is blocked |
| 3 | `hlx org switch` updates local config only for `hxi_` keys (no server call, no key replacement) | API key is preserved across org switches |
| 4 | `hlx org list` shows all accessible orgs, marks the locally selected one | User can discover and confirm their org context |
| 5 | `hlx org current` reflects the selected org | User can verify active org before running commands |
| 6 | `/api/auth/me` returns selected org as `organization` and all available orgs | CLI org commands have the data they need |
| 7 | Admin users can access any org without explicit `UserOrganization` membership | Support/admin workflows are unblocked |
| 8 | Missing `X-Helix-Org-ID` on API-key auth fails closed | No silent fallback to wrong org |
| 9 | Non-admin users get 403 for orgs they lack membership in | Clear, secure boundary enforcement |

## Features Explicitly Out of Scope (MVP)

- UI changes of any kind.
- New API key scope or permission model.
- Database schema changes (existing models are sufficient).
- New CLI-exclusive API endpoints (`/api/cli/*`).
- CLI self-update or packaging changes.
- Password or browser login flow changes.
- Caching of selected org on the server.
- Environment-variable-based org selection (config file only for MVP).

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | A single `hxi_` key works for two different orgs the user belongs to | Automated server test |
| 2 | `hlx org list` shows all orgs available to the token user | Manual CLI verification |
| 3 | `hlx org switch <org>` updates `~/.hlx/config.json` with `orgId`/`orgName` and preserves the API key | Config file inspection + CLI verification |
| 4 | After switching, `hlx org current`, `hlx inspect repos`, and `hlx tickets list` use the selected org | Manual CLI verification |
| 5 | Non-admin users cannot select orgs where they lack membership (403) | Automated server test |
| 6 | Admin users can select any org | Automated server test |
| 7 | API-key auth fails when `X-Helix-Org-ID` is missing (401/400) | Automated server test |
| 8 | API-key auth never mutates `User.organizationId` | Automated server test |
| 9 | Session JWT auth and `POST /api/auth/switch-org` still work unchanged | Existing tests pass |
| 10 | Inspection repo-scope enforcement still applies within the selected org | Existing tests pass |
| 11 | Server and CLI typecheck pass | `npm run typecheck` in both repos |

## Key Design Principles

- **User-scoped, not org-scoped**: The API key identifies the user. The org is a per-request parameter.
- **Explicit selection, no fallback**: The CLI must send a selected org; the server must not silently fall back to the key's creation org, the user's active org, or any default.
- **Fail closed**: Missing, invalid, or unauthorized org selections result in clear error responses, not degraded access.
- **Local-only org state for CLI**: Switching orgs in the CLI updates only the local config file. No server-side mutation of `User.organizationId`.
- **Preserve existing behavior**: Session JWT auth, browser flows, and the existing `POST /api/auth/switch-org` endpoint remain unchanged.

## Scope & Constraints

- **Two repos changed**: `helix-global-server` (auth middleware, auth controller, org switch service, tests) and `helix-cli` (HTTP client, org commands, config).
- **No schema changes**: `UserOrganization` junction table, `InspectionApiKey.createdByUserId`, and `User.isAdmin` already exist.
- **No new endpoints**: All changes use existing routes; the only new concept is the `X-Helix-Org-ID` request header.
- **Allowed files are explicitly listed** in the ticket; changes outside that set are forbidden.
- **Forbidden patterns**: No `/api/cli/*` routes, no auth inside controllers, no `requireAuth` removal, no silent org fallback.

## Future Considerations

- **Env-var org selection**: `HELIX_ORG_ID` env var for CI/automation pipelines (config.ts env-var path currently omits orgId).
- **Initial login org setup**: Prompt user to select org during `hlx login` so they don't hit a fail-closed error on their first command.
- **CLI test infrastructure**: The CLI repo has no test runner; future work should add tests for config persistence, header emission, and local-only switch behavior.

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|-----------------|--------|
| 1 | How should admin users discover all orgs? `getAvailableOrganizations` currently queries only `UserOrganization`. Adding an "all orgs" query for admins is a new code path that needs careful scoping (could return a large set). | Server implementation must add admin bypass to org listing; may need pagination if org count is large. |
| 2 | How should `AuthContext` carry the selected org's full data (name, platform, githubConfigured, etc.)? Currently `lookupUserForAuth` loads org via User FK join. For a different selected org, the org must be loaded separately. | Server implementation detail; record as technical question for tech-research. |
| 3 | How should inspection routes handle `X-Helix-Org-ID`? They use both `attachAuthContext` and `attachInspectionAuth`, which has a short-circuit for pre-resolved auth. | Org validation must fire consistently across both auth paths; needs implementation-level verification. |
| 4 | After `hlx login --manual` with an `hxi_` key, the user has no `orgId` set. Every org-scoped request will fail closed until they run `hlx org switch`. | UX friction on first use; acceptable for MVP per ticket invariants (fail closed when org missing). Consider a helpful error message. |
| 5 | Ambiguous org names: the ticket requires failing with a clear error instead of selecting the first match. | Org name resolution logic in the CLI switch command must handle duplicates. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Primary specification with decisions, invariants, acceptance criteria, and allowed files | Comprehensive behavioral contract: fail-closed semantics, admin bypass, local-only org switch for CLI, explicit header protocol |
| scout/scout-summary.md (helix-global-server) | Server auth flow analysis | `resolveApiKeyAuth` uses `keyData.organizationId`; `lookupUserForAuth` checks FK match not membership; no `X-Helix-Org-ID` handling; `UserOrganization` junction exists |
| scout/scout-summary.md (helix-cli) | CLI behavior analysis | `hxFetch` sends no org header; `cmdOrgSwitch` replaces `hxi_` key with JWT; `HxConfig` already has `orgId`/`orgName` fields |
| diagnosis/diagnosis-statement.md (helix-global-server) | Root cause analysis for server | Five defects identified: creation-org-as-auth-org, wrong org validation model, no header handling, destructive switch, no admin bypass |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis for CLI | Three defects: no org header emission, destructive key replacement on switch, org list marks by server state not local config |
| diagnosis/apl.json (helix-global-server) | Diagnosis evidence and unknowns | Confirmed no schema changes needed; all data models exist; admin bypass is a new code path |
| diagnosis/apl.json (helix-cli) | Diagnosis evidence and unknowns | Confirmed env-var config gap; no CLI tests exist; three files need changes |
| scout/reference-map.json (helix-global-server) | Detailed file-level code mapping | Line-level evidence for middleware, session types, routes, tests, schema |
| scout/reference-map.json (helix-cli) | Detailed file-level code mapping | Line-level evidence for config, HTTP client, org commands |
| repo-guidance.json | Repo intent metadata | Both repos confirmed as change targets by diagnosis step |

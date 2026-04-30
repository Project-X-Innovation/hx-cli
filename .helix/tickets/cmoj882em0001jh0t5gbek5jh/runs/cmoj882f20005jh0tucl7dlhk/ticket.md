# Ticket Context

- ticket_id: cmoj882em0001jh0t5gbek5jh
- short_id: BLD-333
- run_id: cmoj882f20005jh0tucl7dlhk
- run_branch: helix/build/BLD-333-make-cli-api-keys-user-scoped-with-explicit-org
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Make CLI API Keys User-Scoped With Explicit Org Selection

## Description
Change `hxi_` API key auth so the token authenticates the user, not one fixed organization. The same token must work across all organizations the user can access. The CLI-selected organization lives in `~/.hlx/config.json` as `orgId` and is sent with API requests. The server must validate that the API key’s user can access the requested org before building `AuthContext`.

## Why

The current API key auth treats `InspectionApiKey.organizationId` as the auth organization. That is too restrictive. A Helix user may belong to multiple organizations and should be able to use one CLI token across all of them, switching org context locally in the CLI. `InspectionApiKey.organizationId` should remain metadata for where the key was created, not the access boundary.

## Decisions Already Made

- `hxi_` API keys authenticate as the user who created the key.

- One API key may be used across all organizations the user has access to.

- CLI org selection must be stored locally in `~/.hlx/config.json` as `orgId`.

- CLI requests must send the selected org to the server.

- `InspectionApiKey.organizationId` is metadata only for this flow.

- The server is the source of truth for whether the token user can access the requested org.

- Users still switch orgs explicitly with `hlx org switch`.

- Do not add CLI-only endpoints.

## Do Not Re-Decide

- Do not make API keys permanently org-bound.

- Do not use `InspectionApiKey.organizationId` as the request org.

- Do not require one token per org.

- Do not mutate `User.organizationId` when the CLI switches orgs.

- Do not add `/api/cli/*` routes.

- Do not store plaintext API keys.

- Do not change the `hxi_` token format.

## Non-Negotiable Invariants

- A valid `hxi_` API key must authenticate the creator user.

- The selected request org must come from the CLI config and be sent with the request.

- The server must validate selected org access on every API-key-authenticated request.

- Non-admin users may only access orgs where they have a `UserOrganization` membership.

- Admin users may access all orgs unless existing admin semantics explicitly say otherwise.

- If no selected org is sent, API-key auth must fail closed for org-scoped API routes.

- Session JWT auth behavior must remain unchanged.

- API key auth must not update `User.organizationId`.

- Existing inspection repo scoping must still apply within the selected org when `repos` is non-empty.

- Invalid, revoked, expired, or malformed API keys must fail closed.

## In Scope

- Update CLI config handling to persist `orgId` and `orgName`.

- Update CLI HTTP requests to send selected org, e.g. `X-Helix-Org-ID: <orgId>`, when `config.orgId` is present.

- Update `hlx org current` to show the selected/current org for API-key auth.

- Update `hlx org list` to list all orgs the token user can access.

- Update `hlx org switch <org>` to update local config only for `hxi_` API-key auth.

- Update server auth middleware so API-key auth resolves user first, then selected org.

- Treat `InspectionApiKey.organizationId` as creation/audit metadata only for API-key auth.

- Add server validation for selected org membership/admin access.

- Add tests for API-key auth across multiple orgs.

- Preserve existing session JWT org switch behavior.

## Out of Scope

- UI changes.

- New API key scope model.

- Database schema changes unless implementation is blocked.

- CLI self-update packaging.

- Password login changes.

- Browser login changes.

- New CLI-exclusive endpoints.

## Allowed Files To Change

- `helix-cli/src/lib/config.ts`

- `helix-cli/src/lib/http.ts`

- `helix-cli/src/org/current.ts`

- `helix-cli/src/org/list.ts`

- `helix-cli/src/org/switch.ts`

- `helix-cli/src/index.ts` only if command wiring needs small updates

- `helix-global-server/src/auth/middleware.ts`

- `helix-global-server/src/controllers/auth-controller.ts`

- `helix-global-server/src/services/org-switch-service.ts` only if reusable org-list logic is needed

- Relevant tests in both repos

## Forbidden Changes

- Do not add `/api/cli/*`.

- Do not add duplicate ticket, org, or auth endpoints exclusively for CLI.

- Do not remove `requireAuth`.

- Do not bypass middleware by authenticating inside controllers.

- Do not update `User.organizationId` during API-key CLI org switching.

- Do not make auth failure a warning.

- Do not fall back to `InspectionApiKey.organizationId` silently when the selected org is missing.

- Do not broaden unrelated UI, deployment, or settings behavior.

## Required Behavior

1. CLI must load `orgId` and `orgName` from `~/.hlx/config.json`.

2. CLI must send selected org on API requests when authenticated with an `hxi_` key.

3. Use one explicit request header for selected org, preferably `X-Helix-Org-ID`.

4. Server API-key auth must verify the key first.

5. Server API-key auth must load the creator user.

6. Server API-key auth must reject inactive users.

7. Server API-key auth must read selected org from `X-Helix-Org-ID`.

8. Server API-key auth must validate selected org:

   - admin user: allowed

   - non-admin user: allowed only if `UserOrganization(userId, selectedOrgId)` exists

9. Server API-key auth must build `AuthContext` using the selected org, not `InspectionApiKey.organizationId`.

10. `/api/auth/me` must return the selected org as `organization`.

11. `/api/auth/me` must return all available orgs the user can access.

12. `hlx org list` must show all available orgs and mark the locally selected org.

13. `hlx org switch <org-name-or-id>` with an `hxi_` key must update local `~/.hlx/config.json` only.

14. `hlx org switch` must not call `/api/auth/switch-org` for `hxi_` keys.

15. Existing session JWT behavior may continue calling `/api/auth/switch-org`.

## Failure Behavior

- Missing selected org for API-key auth: `401 Unauthorized` or `400 Bad Request`; choose one and test it.

- Selected org does not exist: fail closed.

- Non-admin user is not a member of selected org: `403 Forbidden`.

- Invalid API key: `401 Unauthorized`.

- Revoked API key: `401 Unauthorized`.

- Expired API key: `401 Unauthorized`.

- Inactive user: `401 Unauthorized`.

- Malformed `X-Helix-Org-ID`: fail closed.

- Do not use the key creation org as fallback.

- Do not use the user’s active session org as fallback.

## Batch / Cardinality Rules

- Org access validation is per request.

- Do not cache selected org globally on the server.

- Do not use the first membership as the selected org.

- Do not use `InspectionApiKey.organizationId` as a proxy for selected org.

- For users with multiple orgs, every org listed by `hlx org list` must be individually switchable by ID or exact name.

- For ambiguous org names, fail with a clear error instead of selecting the first match.

## Persistence / Artifact Rules

- CLI persists selected org only in `~/.hlx/config.json`.

- Server must not persist selected CLI org to `User.organizationId`.

- Existing API key `lastUsedAt` updates may remain.

- `InspectionApiKey.organizationId` remains stored as creation/audit metadata.

- Do not store plaintext API keys.

## Acceptance Criteria

1. A single valid `hxi_` key works for two different orgs the user belongs to.

2. `hlx org list` shows all organizations available to the token user.

3. `hlx org switch <org>` updates `~/.hlx/config.json` with `orgId` and `orgName`.

4. After switching orgs, `hlx org current` shows the selected org.

5. After switching orgs, `hlx inspect repos` uses the selected org.

6. After switching orgs, `hlx tickets list` uses the selected org.

7. Non-admin users cannot select orgs where they lack membership.

8. Admin users can select any org.

9. API-key auth fails when `X-Helix-Org-ID` is missing.

10. API-key auth does not mutate `User.organizationId`.

11. Existing browser/session auth still works.

12. Existing session `POST /api/auth/switch-org` still works.

13. Existing inspection repo-scope enforcement still works within the selected org.

## Verification

- Add server tests for API-key auth with:

  - selected org where user is member

  - selected org where user is not member

  - admin user selecting org without membership

  - missing selected org

  - inactive user

  - revoked key

  - expired key

- Add CLI tests or focused manual checks for:

  - config persistence of `orgId` / `orgName`

  - `X-Helix-Org-ID` header emission

  - local-only org switch for `hxi_` keys

- Run server `npm run typecheck`.

- Run server auth tests.

- Run CLI `npm run typecheck`.

- Manual post-deploy verification:

  - `hlx org list`

  - `hlx org switch <org>`

  - `hlx org current`

  - `hlx inspect repos`

  - `hlx tickets list`

## Attachments
- (none)

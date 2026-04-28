# Ticket Context

- ticket_id: cmoj548dw000vmm0t6meppd8q
- short_id: BLD-332
- run_id: cmoj548ec000zmm0t20n6asbu
- run_branch: helix/build/BLD-332-make-helix-api-keys-first-class-auth-for-cli
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Make Helix API Keys First-Class Auth For CLI Workbench Commands

## Description
Make `hxi_` Helix API keys authenticate against the existing Helix API surface used by the CLI, without adding CLI-exclusive endpoints. The CLI must be able to use the same existing `/api/auth/me`, `/api/tickets`, `/api/organization/members`, comments, and inspection endpoints with an API key. For now, API keys are allowed to perform every action exposed by the CLI.

## Why

The latest CLI sends `hxi_` keys as `X-API-Key`. The server currently accepts `X-API-Key` only through `attachInspectionAuth`, which is wired for inspection and comment routes. Existing app/workbench routes like `/api/auth/me`, `/api/tickets`, and `/api/organization/members` are behind `requireAuth`, which only sees session JWT auth. This makes `hlx inspect repos` work but `hlx org current` fail with `401 Unauthorized`.

## Decisions Already Made

- Do not add endpoints exclusively for the CLI.

- `hxi_` API keys must be valid credentials for the same API endpoints the CLI already calls.

- For now, API keys may perform every action exposed by the CLI.

- Existing endpoint paths should remain the source of truth.

- The CLI should remain a normal API client, not a special server-side integration.

- API keys are still `hxi_` tokens and may continue to be sent as `X-API-Key`.

- API key auth must resolve to the same `AuthContext` shape as session auth.

## Do Not Re-Decide

- Do not invent `/api/cli/*` routes.

- Do not add `/api/inspect/me` or other CLI-only identity endpoints.

- Do not limit API keys to inspection-only behavior for this ticket.

- Do not redesign the CLI command model.

- Do not replace existing session JWT auth.

- Do not change the public CLI command names.

## Non-Negotiable Invariants

- `hxi_` API keys must authenticate through the existing auth middleware path so `requireAuth` works.

- Existing session JWT behavior must remain unchanged.

- Existing inspection routes must continue to work with `X-API-Key`, bearer `hxi_`, scoped inspection JWTs, and session JWTs.

- Existing comment routes must continue to work with API keys.

- API key verification must remain hash-based; plaintext API keys must never be stored.

- Invalid, revoked, expired, or malformed API keys must fail closed with `401`.

- Repo scoping must still be enforced for inspection proxy routes.

- For non-inspection workbench routes, repo scoping must not accidentally hide or partially apply behavior. For now, authenticated API keys have full CLI-level access in their resolved auth context.

- Do not silently downgrade failed auth to anonymous behavior.

## In Scope

- Refactor server auth middleware so `attachAuthContext` can authenticate:

  - `Authorization: Bearer <session-jwt>`

  - `Authorization: Bearer <inspection-jwt>`

  - `Authorization: Bearer hxi_...`

  - `X-API-Key: hxi_...`

- Reuse existing API key verification logic from `inspection-api-key-service`.

- Populate `req.auth` for valid API keys before `requireAuth` runs.

- Preserve `req.inspectionApiKeyId`, `req.inspectionRepos`, and related metadata for audit and inspection enforcement.

- Make `/api/auth/me` work with valid `hxi_` API keys.

- Make CLI ticket commands work with valid `hxi_` API keys against existing `/api/tickets` endpoints.

- Make `/api/organization/members` work with valid `hxi_` API keys.

- Add tests covering API-key auth on normal `requireAuth` routes.

- Fix server-side support for the CLI `hlx tickets list --user` query behavior if missing.

## Out of Scope

- Creating CLI-only endpoints.

- Redesigning API key management UI.

- Adding granular API key scopes.

- Changing the `hxi_` key format.

- Reworking password login or browser login.

- Replacing JWT session auth.

- Fixing CLI self-update packaging in this ticket.

## Allowed Files To Change

- `helix-global-server/src/auth/middleware.ts`

- `helix-global-server/src/auth/session.ts` only if needed for shared auth helpers

- `helix-global-server/src/routes/api.ts` only if route middleware ordering must be adjusted

- `helix-global-server/src/controllers/auth-controller.ts` only if response handling needs metadata already available in `AuthContext`

- `helix-global-server/src/controllers/ticket-controller.ts` only for `reporterUserId` / CLI query compatibility

- `helix-global-server/src/services/ticket-service.ts` only for ticket list filtering required by the CLI

- `helix-global-server/src/services/inspection-api-key-service.ts` only for exported helper shape changes

- Existing relevant server tests or new colocated tests

## Forbidden Changes

- Do not add `/api/cli/*`.

- Do not add duplicate identity endpoints.

- Do not store plaintext API keys.

- Do not remove `requireAuth` from existing workbench routes.

- Do not bypass `requireAuth` by manually checking tokens inside controllers.

- Do not make auth failures warnings.

- Do not broaden unrelated route behavior.

- Do not modify unrelated UI code.

- Do not change database schema unless implementation is blocked without it.

## Required Behavior

1. A valid `hxi_` API key sent as `X-API-Key` must populate `req.auth` before `requireAuth`.

2. A valid `hxi_` API key sent as `Authorization: Bearer hxi_...` must behave the same as `X-API-Key`.

3. `/api/auth/me` must return the same shape for API-key auth as it does for session JWT auth.

4. `/api/tickets` list/get/create/rerun/artifact endpoints used by the CLI must accept API-key auth through normal `requireAuth`.

5. `/api/organization/members` must accept API-key auth through normal `requireAuth`.

6. Existing `/api/inspect/*` routes must continue enforcing repository restrictions from API keys or inspection JWTs.

7. Existing comment routes must continue accepting API keys.

8. `req.inspectionApiKeyId` must be preserved when API-key auth is used so existing audit logging still works.

9. If the CLI sends `reporterUserId` to `/api/tickets`, the server must either implement that filter correctly or the CLI/server contract must be aligned without breaking existing UI calls.

## Failure Behavior

- Invalid API key: return `401 Unauthorized`.

- Revoked API key: return `401 Unauthorized`.

- Expired API key: return `401 Unauthorized`.

- API key whose creator no longer exists or is inactive: return `401 Unauthorized`.

- API key whose organization no longer exists: return `401 Unauthorized`.

- Inspection route with repo-scoped key that targets a disallowed repo: return `403`.

- Do not fall back to anonymous access.

- Do not continue with partial auth context.

- Do not swallow auth errors and continue.

## Batch / Cardinality Rules

- API key auth resolution is per request.

- Do not cache one request’s API key auth context globally.

- Do not use the first organization, first membership, first ticket, or first repository as a proxy for the authenticated context.

- For ticket list filters, apply filters across the full result set; do not use `items[0]` or latest-ticket shortcuts.

- For repo-scoped inspection keys, evaluate each requested repository independently.

## Persistence / Artifact Rules

- Do not persist plaintext API keys.

- Do not mutate API key records during auth except existing `lastUsedAt` behavior.

- Do not change the user’s active organization as a side effect of normal API-key-authenticated requests.

- If `auth/switch-org` is used with API-key auth, it must use existing switch semantics deliberately and must not silently mint or persist a new API key.

## Acceptance Criteria

1. `GET /api/auth/me` succeeds with `X-API-Key: hxi_...` for a valid active API key.

2. `GET /api/auth/me` fails with `401` for invalid, revoked, or expired API keys.

3. `GET /api/tickets` succeeds with a valid `hxi_` API key.

4. `POST /api/tickets` succeeds with a valid `hxi_` API key using the authenticated API key creator as the reporter.

5. `GET /api/organization/members` succeeds with a valid `hxi_` API key.

6. `GET /api/inspect/repositories` still succeeds with valid API-key auth.

7. Repo-scoped API keys still cannot inspect repositories outside their `repos` list.

8. Session JWT auth continues to pass all existing tests.

9. Scoped inspection JWT auth continues to pass existing inspect/comment behavior.

10. No new CLI-only endpoint paths are introduced.

11. `hlx org current` works with an `hxi_` key.

12. `hlx tickets list` works with an `hxi_` key.

13. `hlx inspect repos` still works with an `hxi_` key.

## Verification

- Add or update server tests for `attachAuthContext` API-key auth.

- Add route tests for `/api/auth/me` with:

  - valid session JWT

  - valid `X-API-Key`

  - valid bearer `hxi_`

  - invalid API key

  - revoked API key

- Add route tests for `/api/tickets` with API-key auth.

- Add route tests proving inspect repo-scope enforcement still works.

- Run `npm run typecheck`.

- Run relevant auth, inspection, comment, and ticket tests.

- Manually verify with the CLI:

  - `hlx inspect repos`

  - `hlx org current`

  - `hlx tickets list`

## Attachments
- (none)

# Scout Summary — BLD-332: helix-cli (Context-Only)

## Problem

The CLI sends `hxi_` API keys correctly as `X-API-Key` headers. The server fails to resolve these on workbench routes (`/api/auth/me`, `/api/tickets`, `/api/organization/members`), returning 401. This is a server-side auth middleware gap — no CLI changes are needed.

## Analysis Summary

The CLI's auth header logic (http.ts L52-57) correctly sends `hxi_` tokens as `X-API-Key` and JWT tokens as `Authorization: Bearer`. This matches the server's `loadInspectionAuthFromRequest` priority order. The failing commands (`hlx org current`, `hlx tickets list`) call the correct server endpoints with the correct headers — the server simply does not resolve API keys on those routes.

### CLI Endpoints That Require Server Fix

| CLI Command | Endpoint | Currently Works |
|---|---|---|
| `hlx org current` | GET /api/auth/me | No (401) |
| `hlx org list` | GET /api/auth/me | No (401) |
| `hlx org switch` | GET /api/auth/me + POST /api/auth/switch-org | No (401) |
| `hlx tickets list` | GET /api/tickets | No (401) |
| `hlx tickets list --user` | GET /api/organization/members + GET /api/tickets | No (401) |
| `hlx tickets create` | POST /api/tickets | No (401) |
| `hlx tickets rerun` | POST /api/tickets/:id/rerun | No (401) |
| `hlx inspect repos` | GET /api/inspect/repositories | Yes (uses attachInspectionAuth) |
| `hlx inspect db` | POST /api/inspect/:id/database | Yes |
| `hlx comments list` | GET /api/tickets/:id/comments | Yes (uses attachInspectionAuth) |

### Conclusion

This repo is context-only for this ticket. No code changes are expected in helix-cli.

## Relevant Files

| File | Role |
|---|---|
| `src/lib/http.ts` | Auth header construction — correctly handles hxi_ vs JWT |
| `src/lib/config.ts` | Config/credential loading |
| `src/org/current.ts` | Calls /api/auth/me — broken endpoint |
| `src/tickets/list.ts` | Calls /api/tickets with reporterUserId — broken endpoint |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md | Ticket scope and constraints | Server-side changes only; CLI is a normal API client |
| src/lib/http.ts | Verify CLI auth header construction | Correctly sends X-API-Key for hxi_ tokens |
| src/org/current.ts | Identify broken CLI command | Calls GET /api/auth/me which returns 401 with API keys |
| src/tickets/list.ts | Identify broken CLI command and --user flow | Calls /api/organization/members then /api/tickets — both return 401 |

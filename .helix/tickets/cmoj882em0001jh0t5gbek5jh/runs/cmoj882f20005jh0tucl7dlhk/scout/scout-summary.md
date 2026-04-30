# Scout Summary: helix-cli

## Problem

The CLI org switch command (`hlx org switch`) calls `POST /api/auth/switch-org`, which mutates `User.organizationId` on the server and issues a new JWT — replacing the `hxi_` API key in config with a session token. This means the API key is permanently lost after one org switch. Additionally, `hxFetch` sends no org context header, so the server has no way to know which org the CLI user has selected. The CLI already persists `orgId`/`orgName` in config but does not use them in HTTP requests.

## Analysis Summary

### Config State
- `HxConfig` already defines optional `orgId` and `orgName` fields (config.ts:15-16)
- `loadConfig()` reads these from `~/.hlx/config.json` (config.ts:40-41) but the env-var path (config.ts:29) does not include them
- `saveConfig()` does read-merge-write preserving unrelated fields (config.ts:62-73)
- `requireConfig()` enforces `apiKey` and `url` but not `orgId`

### HTTP Client Gap
- `hxFetch` (http.ts:52-57) sends `X-API-Key` for `hxi_` tokens and `Authorization: Bearer` for JWTs
- No `X-Helix-Org-ID` or any org context header is sent
- This is the central place where the header must be added when `config.orgId` is present and `config.apiKey.startsWith("hxi_")`

### Org Switch Behavior (Current)
- `cmdOrgSwitch` (switch.ts:43-47) calls `POST /api/auth/switch-org` with `{ organizationId }`
- Response includes `accessToken` which **replaces** `config.apiKey` (switch.ts:51)
- After switch, the `hxi_` key is gone — replaced by a session JWT
- For `hxi_` key auth, the switch must be local-only: update `config.orgId`/`config.orgName` without calling the server endpoint

### Org Name Resolution
- `cmdOrgSwitch` resolves org name to ID via `GET /api/auth/me` → `availableOrganizations` (switch.ts:27-40)
- This resolution still needs to work for `hxi_` keys, but the server must support it via the new header-based auth

### Org List/Current
- `cmdOrgList` (list.ts:20) marks current org by `org.id === data.organization.id` — comparing against server response
- For `hxi_` key auth with local org selection, the "current" marker should use `config.orgId` instead
- `cmdOrgCurrent` (current.ts:18) calls `/auth/me` — with the new header, server response should reflect the selected org

### Login Flow
- Manual login (`hlx login --manual`, login.ts:38) saves only `apiKey` and `url` — no `orgId`
- Browser OAuth login (login.ts:49-108) also saves only `apiKey` and `url`
- After initial login with `hxi_` key, user must run `hlx org switch` before org-scoped commands work (since server will fail closed without `X-Helix-Org-ID`)

## Relevant Files

| File | Role | Key Lines |
|------|------|-----------|
| `src/lib/config.ts` | Config type, load, save, require — orgId/orgName fields exist but are optional | L12-82 |
| `src/lib/http.ts` | HTTP client with auth headers — no org header sent | L37-63 |
| `src/org/switch.ts` | Org switch — calls server endpoint, replaces apiKey with JWT | L14-58 |
| `src/org/current.ts` | Show current org from /auth/me response | L17-24 |
| `src/org/list.ts` | List orgs from /auth/me, mark current | L10-23 |
| `src/org/index.ts` | Org command dispatcher | L1-36 |
| `src/index.ts` | Main CLI entry point and command wiring | L49-90 |
| `src/login.ts` | Login flow — saves apiKey/url without orgId | L31-41, L49-108 |

## Execution Signals

| Command | Script |
|---------|--------|
| Typecheck | `npm run typecheck` (tsc --noEmit) |
| Build | `npm run build` (tsc) |

No test runner, lint, or CI configuration exists in this repo.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Ticket specification with allowed file changes and required behavior | CLI must send X-Helix-Org-ID header; org switch for hxi_ keys must be local-only; orgId/orgName must persist in config |
| src/lib/config.ts | Config management code | HxConfig already has orgId/orgName; env-var path omits orgId; saveConfig preserves existing fields |
| src/lib/http.ts | HTTP request code | No org header sent; auth headers set for hxi_ vs JWT tokens; central point for adding X-Helix-Org-ID |
| src/org/switch.ts | Org switch implementation | Calls POST /api/auth/switch-org; replaces hxi_ key with JWT; must change to local-only for hxi_ keys |
| src/org/current.ts | Current org display | Calls /auth/me; shows server-side org |
| src/org/list.ts | Org list display | Calls /auth/me; marks current by server response org id |
| src/login.ts | Login flow | Saves apiKey + url only; no orgId on initial login |
| src/index.ts | CLI entry point | Command wiring for org at L67-70 |
| package.json | Build config | TypeScript build only; no test/lint scripts |

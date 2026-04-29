# Code Review: helix-cli

## Review Scope

Reviewed the CLI config redesign for multi-token org-scoped storage: new `OrgEntry`/`MultiTokenConfig` types, `hlx token add` command, local-only `hlx org list` and `hlx org switch`, env-var override path, token masking, and command dispatch wiring.

## Files Reviewed

| File | Lines | Focus |
|------|-------|-------|
| `src/lib/config.ts` | 1-221 | Core config module: multi-token types, `loadConfig()` multi-token resolution, `loadRawConfig()`, `getOrgEntries()`, `getOrgEntry()`, `addOrgEntry()`, `setCurrentOrg()`, `maskToken()`, `requireConfig()` |
| `src/token/add.ts` | 1-77 | New `cmdTokenAdd`: token format validation, server validation via `/api/auth/me`, org entry storage, token masking |
| `src/token/index.ts` | 1-21 | Token subcommand dispatcher |
| `src/org/list.ts` | 1-20 | Rewritten `cmdOrgList`: local-only, reads from `getOrgEntries()` and `loadRawConfig()` |
| `src/org/switch.ts` | 1-108 | Rewritten `cmdOrgSwitch`: hxi_ local-only path (orgId, alias, orgName matching), JWT path unchanged |
| `src/org/index.ts` | 1-39 | Org subcommand dispatcher: updated signature and `cmdOrgList()` call |
| `src/index.ts` | 1-100 | Entry point: `token` command wired, `org` command dispatch updated |
| `src/lib/http.ts` | 1-134 | `hxFetch`: X-Helix-Org-ID header emission for hxi_ tokens with orgId |
| `src/org/current.ts` | 1-24 | `cmdOrgCurrent`: uses `hxFetch` with `/api/auth/me` (unchanged behavior) |
| `src/lib/flags.ts` | 1-31 | Flag parsing utilities (unchanged, verified for token add usage) |

## Missed Requirements & Issues Found

### Requirements Gaps

**ISSUE-1 (Fixed)**: `hlx org list` was gated behind `requireConfig()` in `src/index.ts`.

The ticket requires (Req #4): "hlx org list must read local config only." Acceptance criteria #4: "hlx org list works without a server call."

The `org` command dispatch in `index.ts` called `requireConfig()` before `runOrg()`. Since `cmdOrgList()` reads only from local disk via `getOrgEntries()`, it should not be blocked by `requireConfig()` failing. If `loadConfig()` returns null (e.g., multiple orgs configured but `currentOrg` pointer missing/cleared), `hlx org list` would fail with an auth error instead of listing the configured orgs.

**Root cause**: The `org` command family was treated as a single block requiring auth, but `list` is a local-only operation that never needs auth.

### Correctness / Behavior Issues

None beyond ISSUE-1.

### Regression Risks

- `hxFetch` sends `X-Helix-Org-ID` when `config.orgId` is set for hxi_ tokens (http.ts L59-61). Since `loadConfig()` returns `orgId: entry.orgId`, the header always matches the key's org. Server validates this match. No regression risk.
- `cmdOrgCurrent` still works: takes `HxConfig` with the current org's token, calls `/api/auth/me`. Compatible with multi-token config.
- JWT `org switch` path unchanged (switch.ts L62-107).

### Code Quality / Robustness

- `loadConfig()` casts `parsed.orgs` as `OrgEntry[]` without runtime validation (config.ts L54). This is typical for CLI tools reading their own config. Not a correctness issue.
- `maskToken()` returns the full token if it's shorter than `hxi_` + 8 chars (config.ts L193). In practice, real tokens are always longer. Acceptable edge case.

### Verification / Test Gaps

- CLI repo has no automated test suite. All behavioral verification was done via runtime testing during implementation.

## Changes Made by Code Review

| File | Line(s) | Description |
|------|---------|-------------|
| `src/org/index.ts` | 1-39 | Moved `requireConfig()` from `index.ts` into `runOrg()`, called lazily per subcommand. `cmdOrgList()` executes without requiring auth. `cmdOrgCurrent()` and `cmdOrgSwitch()` still call `requireConfig()` individually. Changed `runOrg` signature from `(config: HxConfig, args: string[])` to `(args: string[])`. Replaced `import type { HxConfig }` with `import { requireConfig }`. |
| `src/index.ts` | 72-74 | Changed `org` command dispatch from `const config = requireConfig(); await runOrg(config, args.slice(1));` to `await runOrg(args.slice(1));`. Removes the `requireConfig()` gate that blocked `hlx org list`. |

## Remaining Risks / Deferred Items

- `hlx org switch` with hxi_ tokens still requires `requireConfig()` to succeed (needs a current org to determine the token type via `config.apiKey.startsWith("hxi_")`). In an edge case where `currentOrg` is cleared but orgs exist, `hlx org switch` would fail. This is very unlikely in practice since `addOrgEntry` always sets `currentOrg` for the first added token.
- No automated test coverage for CLI commands. Behavioral testing is runtime-only.

## Verification Impact Notes

CLI verification checks affected:
- **CHK-03** (`hlx org list` local-only): Now more robust. Before this fix, the check could pass only because `currentOrg` was already set. After the fix, `hlx org list` truly works regardless of `loadConfig()` state. Check remains **valid**.
- **CHK-04, CHK-05, CHK-07, CHK-08, CHK-09**: Unchanged. These checks remain **valid**.
- **CHK-06** (`hlx org switch`): Unchanged behavior. Check remains **valid** (blocked due to single test org, per implementation-actual.md).

## APL Statement Reference

CLI reviewed. One issue found and fixed: `hlx org list` was incorrectly gated behind `requireConfig()` in index.ts, violating ticket Req #4 (local-only). Fix: moved `requireConfig()` into `runOrg()` per-subcommand so `cmdOrgList()` executes without auth. All other CLI changes correct: multi-token config, token add, org switch, env-var override, token masking. TypeScript and build pass after fix.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (continuation context) | Primary spec | Org-scoped tokens, multi-token config, local-only org list/switch, env-var override |
| implementation/implementation-actual.md (CLI) | Scope map of changed files | 7 files changed: config.ts, token/add.ts, token/index.ts, org/list.ts, org/switch.ts, org/index.ts, index.ts |
| implementation-plan/implementation-plan.md (CLI) | Expected behavior and step plan | 6-step plan verified against actual code |
| product/product.md | Product requirements | Local-only org discovery, token masking, env-var priority |
| src/lib/config.ts | Direct code review | Multi-token resolution, addOrgEntry auto-sets currentOrg, loadConfig env-var path |
| src/token/add.ts | Direct code review | Token validation flow, masked output, error handling |
| src/org/list.ts | Direct code review | Local-only, no hxFetch or server calls |
| src/org/switch.ts | Direct code review | hxi_ local path vs JWT server path, matching logic |
| src/org/index.ts | Direct code review + edit | Identified and fixed requireConfig gate on org list |
| src/index.ts | Direct code review + edit | Identified and fixed requireConfig gate on org command |
| src/lib/http.ts | Direct code review | X-Helix-Org-ID header emission for hxi_ tokens, compatible with org-scoped model |
| src/org/current.ts | Direct code review | cmdOrgCurrent unchanged, compatible with multi-token config |

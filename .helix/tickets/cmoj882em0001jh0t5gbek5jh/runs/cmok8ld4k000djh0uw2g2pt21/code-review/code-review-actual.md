# Code Review: helix-cli

## Review Scope

Reviewed all CLI implementation changes for making CLI API keys user-scoped with explicit org selection. Covers the `X-Helix-Org-ID` header emission in `http.ts`, the local-only org switch for `hxi_` keys in `switch.ts`, the config-based current marker in `list.ts`, and contextual files `config.ts` and `current.ts`.

## Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `src/lib/http.ts` | Reviewed | Added `X-Helix-Org-ID` header for `hxi_` key requests when `config.orgId` is set. Correctly placed after auth headers, only for hxi_ keys. |
| `src/org/switch.ts` | Reviewed | Branched on key type: `hxi_` keys do local-only config update via `saveConfig`; JWT tokens keep existing server call. Ambiguous name handling with `.filter()` and clear error. |
| `src/org/list.ts` | Reviewed | Changed current-org marker to use `config.orgId` for `hxi_` keys, server state for JWT tokens. Correct ternary logic. |
| `src/lib/config.ts` | Reviewed (context) | `HxConfig` type has `orgId`/`orgName`. `saveConfig` does read-merge-write. `loadConfig` reads orgId/orgName from file. No changes needed. |
| `src/org/current.ts` | Reviewed (context) | Unchanged. Calls `/api/auth/me` and displays server response. Correct: server response reflects the selected org via the `X-Helix-Org-ID` header. |

## Missed Requirements & Issues Found

### Requirements Gaps

No requirements gaps found. All ticket requirements for the CLI are addressed:
- `X-Helix-Org-ID` header sent for `hxi_` key requests with `orgId` set
- Local-only org switch for `hxi_` keys (no server call, preserves key)
- JWT org switch behavior completely unchanged
- Ambiguous org names fail with clear error listing all matches
- Config-based current org marker for `hxi_` keys in `hlx org list`

### Correctness/Behavior Issues

None found.

### Regression Risks

None. JWT token paths are untouched in all three files.

### Code Quality/Robustness

1. **CLI CUID path doesn't resolve org name (minor, NOT FIXED)**: When `hlx org switch <cuid>` is used with an `hxi_` key, `orgName` in config is saved as the CUID string (not the actual org name), because the CUID path at `switch.ts` L25 skips name resolution via `/api/auth/me`. The JWT path compensates via the server response (`data.organization.name`). The `hxi_` path has no equivalent. This is a minor UX issue: the `console.log` would print `Switched to org: cm1234... (cm1234...)`. Does not affect correctness since `orgId` is what matters for the `X-Helix-Org-ID` header and `orgName` is display-only.

2. **CLI CUID path has no server-side validation before save (minor, NOT FIXED)**: When `hlx org switch <cuid>` is used with an `hxi_` key, the CUID is saved to config without validating it exists on the server. Validation happens on the next API request. For JWT keys, the same CUID is sent to the server's switch-org endpoint which validates immediately. This is acceptable because the server enforces validation per request.

### Verification/Test Gaps

1. **No CLI tests exist**: The CLI repo has no test infrastructure. All CLI verification depends on runtime testing against the server. This is a pre-existing gap, not introduced by this ticket.

## Changes Made by Code Review

No code changes made to the CLI repo. All CLI implementation changes are correct.

## Remaining Risks / Deferred Items

1. **No CLI test infrastructure**: Cannot verify CLI behavior via automated tests. Runtime verification required.
2. **CUID org name resolution**: Minor UX issue where CUID input saves CUID as orgName. Non-critical, display-only.
3. **Env-var config path doesn't include orgId**: `loadConfig` from env vars (L26-29) does not support `HELIX_ORG_ID`. Documented as future consideration in the product spec.

## Verification Impact Notes

No CLI verification checks are affected by code review findings. All CLI CHK IDs remain valid.

## APL Statement Reference

CLI-side code review complete. No issues requiring fixes. The `X-Helix-Org-ID` header emission, local-only org switch for `hxi_` keys, and config-based org list marker are all correctly implemented. JWT token paths are completely unchanged. Two minor UX observations noted as remaining risks (CUID org name, no pre-validation for CUID input) but neither affects correctness. Typecheck and build pass.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | X-Helix-Org-ID header, local-only switch for hxi_ keys, ambiguous name handling |
| implementation/implementation-actual.md (CLI) | Scope map: 3 changed files, steps, known limitations | All 3 files reviewed, no test infrastructure noted |
| implementation-plan/implementation-plan.md (CLI) | Design intent: header placement, branch-on-key-type pattern | Confirmed implementation matches plan |
| product/product.md | Core workflow, success criteria | Confirmed bootstrap flow, fail-closed semantics |
| diagnosis/diagnosis-statement.md | Root cause: no org header, destructive switch, list marks by server state | Verified all 3 CLI defects are addressed |
| src/lib/http.ts | Direct source inspection | Verified header emission at L59-61, correct conditions |
| src/org/switch.ts | Direct source inspection | Verified dual-branch logic, ambiguous name handling |
| src/org/list.ts | Direct source inspection | Verified config-based marker for hxi_ keys |
| src/lib/config.ts | Context: config type, saveConfig read-merge-write | Confirmed orgId/orgName fields exist, saveConfig preserves other fields |
| src/org/current.ts | Context: unchanged, relies on server response | Confirmed no changes needed |

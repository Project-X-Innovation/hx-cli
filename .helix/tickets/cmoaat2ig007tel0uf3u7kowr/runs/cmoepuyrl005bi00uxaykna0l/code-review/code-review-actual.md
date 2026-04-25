# Code Review Actual — HLX-299: helix-cli packaging, documentation, and artifact retrieval

## Review Scope

Reviewed all implementation changes in the `helix-cli` repository against the ticket requirements, continuation context, product spec, implementation plan, and diagnosis. The review covered:

- New artifact commands module (`src/artifacts/`)
- CLI entry point changes (`src/index.ts`)
- GitHub Actions publish workflow (`.github/workflows/publish.yml`)
- README documentation (`README.md`)
- Package manifest changes (`package.json`)

No changes were made or expected in `helix-global-server` (context-only repo).

## Files Reviewed

| File | Status | Findings |
|---|---|---|
| `package.json` | OK | `prepublishOnly` script added correctly. Version 1.2.0, zero runtime deps, files/engines/bin all correct. |
| `src/index.ts` | Fixed | Dynamic version via `createRequire` is correct. `artifacts` case wired correctly. Usage text was missing `--run` filter for ticket command (fixed). |
| `src/artifacts/index.ts` | Fixed | Router follows `src/comments/index.ts` pattern correctly. `resolveTicketId`, `getFlag`, subcommand routing all match existing conventions. Usage text was missing `--run` filter (fixed). |
| `src/artifacts/ticket.ts` | OK | Calls correct endpoint (`GET /api/tickets/:ticketId/artifacts`). Optional `--run` filter implemented. Response type matches backend contract. Empty state handled. Human-readable output. |
| `src/artifacts/run.ts` | OK | Calls correct endpoint. Required flags `--step` and `--repo-key` validated with clear error messages. Positional run-id parsing correct. Empty state handled. |
| `.github/workflows/publish.yml` | OK | Trigger on push to main, build/typecheck steps, dist/index.js verification, version-change detection comparing local vs published, conditional npm publish with NPM_TOKEN secret. All structurally correct. |
| `README.md` | OK | Comprehensive: install instructions, Node >=18, auth (OAuth, manual, env vars, config file), full command reference, artifact retrieval with examples, maintainer publish setup with step-by-step npm token creation (Automation type) and GitHub secret configuration. |

## Missed Requirements & Issues Found

### Requirements gaps

None. All ticket requirements and continuation context acceptance criteria are met:
1. README sufficient for new engineer onboarding
2. Artifact retrieval commands for ticket/run using Helix backend
3. Clear errors for missing credentials and no-result cases
4. `hlx --version` matches `package.json` (1.2.0)
5. GitHub Actions workflow publishes on version change only
6. Workflow fails when build output is missing
7. No direct GitHub/Vercel API dependency
8. Diff scoped to helix-cli only

### Correctness/behavior issues

None. All command routing, flag parsing, endpoint URLs, and error handling are correct.

### Regression risks

None. The changes are purely additive:
- New `src/artifacts/` module with no changes to existing modules
- New `case "artifacts"` in CLI switch with no impact on other cases
- New `createRequire` import and version reading replaces a constant (no behavioral change elsewhere)
- `prepublishOnly` script adds build safety without affecting existing scripts

### Code quality/robustness

**Minor: CLI usage text missing `--run` filter (fixed)** — The `cmdTicketArtifacts` function supports an optional `--run <run-id>` filter, and the README documents it, but the CLI's own usage text in both `src/index.ts` and `src/artifacts/index.ts` did not show this flag. Fixed for consistency with the comments module pattern which shows all optional flags in usage text.

### Verification/test gaps

None beyond what was already documented:
- Live artifact retrieval (CHK-04) was blocked by server schema drift (pre-existing issue, not a CLI bug)
- No test infrastructure exists in the repo (out of scope per plan)

## Changes Made by Code Review

| File | Line | Description |
|---|---|---|
| `src/index.ts` | 28 | Added `[--run <run-id>]` to artifacts ticket usage text for discoverability of the optional run filter |
| `src/artifacts/index.ts` | 24 | Added `[--run <run-id>]` to artifacts subcommand usage text, consistent with main usage |

## Remaining Risks / Deferred Items

1. **Live artifact retrieval untested** — Blocked by server schema drift (User.avatarUrl missing). The CLI code follows the same `hxFetch` + `basePath: '/api'` pattern proven in the comments module. Risk is low.
2. **No test infrastructure** — Out of scope per ticket and plan. Risk is mitigated by typecheck and manual verification.
3. **First real npm publish via workflow untested** — Requires NPM_TOKEN secret to be configured (documented in README). The workflow structure follows GitHub Actions best practices.
4. **`id-token: write` permission unused** — The workflow requests this permission (needed for npm provenance) but doesn't pass `--provenance` to `npm publish`. Not harmful, but the permission is currently unused. Can be activated later if provenance is desired.

## Verification Impact Notes

No verification plan checks are affected by the code review changes:
- **CHK-01 through CHK-09**: All remain valid. The usage text change is cosmetic and doesn't affect build, typecheck, version output, command routing, or flag validation behavior.
- **CHK-09** (usage text includes artifact commands): Still passes — the artifact command lines are now more complete with the `--run` filter shown.

## APL Statement Reference

Code review complete for helix-cli. All 7 changed files reviewed against ticket requirements, continuation context, product spec, and implementation plan. One minor usability fix applied: added `[--run <run-id>]` to CLI usage text in `src/index.ts` and `src/artifacts/index.ts` to document the optional run filter that was implemented but not shown in help output. Build and typecheck pass after fix. No correctness issues, no regressions, no missed requirements found. Implementation is well-structured, follows existing module patterns, and meets all acceptance criteria.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `implementation/implementation-actual.md` (helix-cli) | Scope map for review — listed all 7 changed files and 9 implementation steps | Used as starting point; verified each claim by reading actual code |
| `implementation/apl.json` (helix-cli) | Implementation evidence summary | Confirmed all steps completed, CHK-04 blocked by server drift |
| `ticket.md` (helix-cli) | Primary requirements specification | Three deliverables: README, publish workflow, artifact commands. Cross-checked all acceptance criteria. |
| `implementation-plan/implementation-plan.md` (helix-cli) | Detailed implementation blueprint | 9-step plan with verification checks; used to verify implementation followed plan |
| `product/product.md` (helix-cli) | Product scope and design principles | Thin client, zero deps, ESM-only, existing patterns. Confirmed implementation adheres. |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause analysis | 5 root causes all addressed: CI/CD, docs, artifact commands, version drift, prepublishOnly |
| `repo-guidance.json` (helix-cli) | Repo intent classification | helix-cli=target, helix-global-server=context. Confirmed no server changes needed. |
| `src/comments/index.ts` (helix-cli) | Pattern reference for artifact router | Verified artifacts module follows same resolveTicketId, getFlag, subcommand routing pattern |
| `src/comments/list.ts` (helix-cli) | Pattern reference for subcommand | Verified artifacts module follows same hxFetch, typed response, human-readable output pattern |
| `src/lib/http.ts` (helix-cli) | HTTP client contract | Verified hxFetch usage with basePath '/api' and queryParams is correct |
| `src/lib/config.ts` (helix-cli) | Auth/config contract | Verified requireConfig() provides correct auth for artifact commands |
| `tsconfig.json` (helix-cli) | Build configuration | Confirmed ES2022 target, Node16 module, rootDir/outDir alignment |
| Continuation context (prompt) | Detailed requirements and constraints | Non-negotiable invariants, acceptance criteria, forbidden changes — all verified met |

# Code Review Actual -- HLX-316: Add GitHub main self-update and auto-update to helix-cli

## Review Scope

Reviewed all 7 files changed in the implementation of HLX-316. The implementation adds a complete GitHub-main-sourced self-update mechanism to helix-cli, including: config system fix (read-merge-write), version drift fix, GitHub SHA check, self-update execution, update command with autoUpdate toggle, pre-command auto-update hook, and a prepare script for git-based npm install.

All changes are scoped to helix-cli. helix-global-server is confirmed context-only with no changes needed or made.

## Files Reviewed

| File | Review Depth | Notes |
|------|-------------|-------|
| `src/lib/config.ts` | Full read + backward-compat analysis | Extended HxConfig type, new loadFullConfig(), saveConfig changed to read-merge-write with Partial<HxConfig>. Verified login.ts callers remain compatible. |
| `src/update/version.ts` | Full read + path resolution verification | getPackageVersion() resolves package.json correctly from dist/update/version.js via `../../package.json`. Fallback to 'unknown' on failure. |
| `src/update/check.ts` | Full read + correctness analysis | fetchRemoteSha() uses git ls-remote with 10s timeout, validates 40-char hex SHA. isUpdateAvailable() compares case-insensitively. Returns null on any failure. |
| `src/update/perform.ts` | Full read + error handling analysis | performUpdate() uses npm install -g from GitHub with 120s timeout. Sets HLX_SKIP_UPDATE_CHECK=1 in subprocess env. Never throws; returns structured result. |
| `src/update/index.ts` | Full read + flow analysis | runUpdate() handles --enable-auto/--disable-auto and update flow. checkAutoUpdate() has all required guards (env var, autoUpdate setting, canonical source, network failure). |
| `src/index.ts` | Full read + wiring verification | SKIP_AUTO_UPDATE set correctly includes --version, -v, update, --help, -h. Auto-update runs before switch. Update command case added. Version reads from getPackageVersion(). |
| `package.json` | Full read | prepare script added correctly. No new runtime dependencies. |
| `src/login.ts` (unchanged, caller verification) | Full read | Confirmed saveConfig({apiKey, url}) satisfies Partial<HxConfig>. No changes needed in this file. |
| `tsconfig.json` (unchanged, build config) | Full read | module=Node16, strict=true, outDir=dist, rootDir=src. Confirmed new files under src/ are auto-included. |

## Missed Requirements & Issues Found

### Requirements Gaps
None. All ticket requirements and acceptance criteria are addressed:
- `hlx update` command exists and checks GitHub main HEAD SHA (AC-1)
- `autoUpdate` persisted in ~/.hlx/config.json with enable/disable toggle (AC-2)
- Pre-command auto-update check with one GitHub main HEAD check (AC-3)
- Update decision based on commit SHA comparison (AC-4)
- `hlx --version` reads from package.json (AC-5)
- Auto-update only for canonical GitHub main install (AC-6)
- Unsupported install modes fail clearly (AC-7)
- Loop prevention via SKIP_AUTO_UPDATE set + HLX_SKIP_UPDATE_CHECK env var + no re-exec architecture (AC-8)
- Network failure produces clear error, no config/install corruption (AC-9)

### Correctness/Behavior Issues
None found. The implementation behavior was verified at runtime:
- `node dist/index.js --version` outputs `1.2.0` (not hardcoded `0.1.0`)
- `node dist/index.js -v` outputs `1.2.0`
- Config round-trip preserves apiKey, url when toggling autoUpdate
- Auto-update correctly warns when installSource is missing and autoUpdate is enabled
- HLX_SKIP_UPDATE_CHECK=1 correctly suppresses auto-update check
- SKIP_AUTO_UPDATE set correctly bypasses auto-update for --version, -v, update, --help, -h
- Usage text includes update command documentation

### Regression Risks
None. The key regression risk was the `saveConfig` signature change from `HxConfig` to `Partial<HxConfig>`. This was verified as backward-compatible: `src/login.ts` calls `saveConfig({apiKey, url})` at lines 38 and 107, and `{apiKey: string, url: string}` satisfies `Partial<HxConfig>`. The read-merge-write pattern ensures existing fields are preserved.

### Code Quality/Robustness
The implementation is well-structured:
- Clean separation of concerns across 4 new modules (version, check, perform, index)
- Consistent error handling: check returns null on failure, perform returns structured result, orchestration handles both
- Type safety maintained throughout (strict mode, proper typing)
- No unnecessary dependencies added

### Verification/Test Gaps
- No automated tests (noted as pre-existing: the project has no test framework)
- CHK-05 (git ls-remote direct execution) is blocked by sandbox restrictions but was functionally verified through Node runtime

## Changes Made by Code Review

No code changes were made. The implementation is correct and complete.

## Remaining Risks / Deferred Items

1. **No update cooldown/cache**: Every CLI invocation with autoUpdate=true performs a git ls-remote network call (1-3s latency). Acknowledged as out-of-scope for MVP.
2. **No automated test suite**: The project has no test runner or test files. Verification relies on manual CLI invocation. Noted as a follow-up.
3. **git binary dependency**: fetchRemoteSha requires git to be installed. Returns null if git is not found, which triggers fail-closed behavior (auto-update skips, explicit update fails with clear message).
4. **npm -g permissions**: npm install -g may require elevated permissions on some systems. The npm error message is passed through to the user.

## Verification Impact Notes

No code review changes were made, so the verification plan is fully unaffected. All Required Check IDs (CHK-01 through CHK-09) remain valid as specified in the implementation plan.

## APL Statement Reference

Code review of HLX-316 implementation is complete. All 7 changed files were reviewed against ticket requirements, product spec, and implementation plan. The implementation correctly addresses all acceptance criteria: hlx update command with GitHub main SHA check, autoUpdate toggle with config round-trip safety, pre-command auto-update hook with proper guards, version fix from hardcoded string to package.json reader, and prepare script for git-based install. No issues found; no code changes made by code review. TypeScript typecheck and build pass cleanly. Config backward compatibility with login.ts callers verified. The implementation is ready for verification.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Primary specification with requirements and acceptance criteria | All 9 acceptance criteria mapped to implementation; verified each is addressed |
| implementation/implementation-actual.md (helix-cli) | Scope map for review — lists files changed, steps executed, verification results | Used as starting point to identify all 7 changed files for direct review |
| implementation/apl.json (helix-cli) | Implementation agent's self-assessment | Cross-referenced claims against direct code inspection |
| implementation-plan/implementation-plan.md (helix-cli) | Architecture decisions and verification plan (CHK-01 through CHK-09) | Verified implementation matches planned architecture; confirmed verification checks remain valid |
| product/product.md (helix-cli) | Product vision, use cases, success criteria | Validated fail-closed behavior, config safety, one-shot update principles |
| tech-research/tech-research.md (helix-cli) | Technical decisions: git ls-remote, npm install -g, read-merge-write, no re-exec | Confirmed implementation uses all specified technical approaches |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis: version drift, lossy config, greenfield update, HTTP client | Verified all 4 root causes addressed by implementation |
| repo-guidance.json | Repo intent classification | Confirmed helix-cli is target, helix-global-server is context-only |
| src/login.ts (helix-cli) | Backward compatibility check for saveConfig callers | Confirmed saveConfig({apiKey, url}) at lines 38 and 107 satisfies Partial<HxConfig> |
| tsconfig.json (helix-cli) | Build configuration verification | Confirmed strict mode, module=Node16, new src/update/* files auto-included |

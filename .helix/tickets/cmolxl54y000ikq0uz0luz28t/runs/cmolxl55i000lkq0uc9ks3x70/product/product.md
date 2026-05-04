# Product Specification — FIX-347: Make hlx update Validate Installed Package And Recover From Broken Installs

## Problem Statement

`hlx update` can report success while leaving the global `hlx` command broken. The update flow equates npm's exit code 0 with a valid installation, but npm can exit cleanly even when the installed package is missing its compiled JavaScript entrypoint (`dist/index.js`). This happens when the in-install build step (`tsc`) partially fails, producing `.d.ts` declaration files but no runnable `.js` output. The user sees "Update complete," but every subsequent `hlx` command fails with `MODULE_NOT_FOUND`. Recovery today requires manually cloning the repo, building, and relinking — a process that is undocumented and requires elevated permissions on some platforms.

Additionally, once a broken install occurs, the update flow persists the new commit SHA as metadata. Future `hlx update` calls see "Already up to date" and refuse to retry, trapping users on a broken install with no automated repair path.

## Product Vision

`hlx update` should be a trustworthy, fail-closed operation. When it says the update succeeded, the CLI works. When the installed package is broken, the user knows immediately, sees what went wrong, and gets a concrete recovery path — all before the command exits.

## Users

- **CLI end users** who run `hlx update` manually to get the latest version.
- **CLI end users** whose `hlx` auto-updates silently before other commands.
- Both user groups need the same protection: a broken install must never be reported as a success.

## Use Cases

1. **Happy path**: User runs `hlx update`, npm installs correctly, validation confirms `dist/index.js` exists and `hlx --version` runs. Success is reported as today.
2. **Broken install (manual)**: User runs `hlx update`, npm exits 0 but the installed package is incomplete. Validation detects the missing entrypoint, prints the missing path and recovery steps, and exits non-zero.
3. **Broken install (auto-update)**: Auto-update triggers before a user command, npm exits 0 but the package is broken. Validation warns the user but does not block the current command. Metadata is not saved, so the next invocation will retry.
4. **Retry after failure**: User re-runs `hlx update` after a prior validation failure. Because metadata was not saved for the broken install, the update re-attempts installation rather than reporting "Already up to date."

## Core Workflow

1. Run the existing `npm install -g` process (no changes).
2. After npm completes, validate the installed package:
   - Check that the bin target file (`dist/index.js`) exists on disk at the global install location.
   - Invoke the installed CLI with a safe probe (e.g., `--version`) to confirm it can start.
3. If validation passes: save install metadata and report success (current behavior).
4. If validation fails:
   - Do NOT save install metadata (preserve retry ability).
   - Print a clear error with the specific missing file or failed command.
   - Surface any relevant npm warnings/stderr from the install step.
   - Print a recovery hint (rebuild/relink from local checkout).
   - Exit non-zero.

## Essential Features (MVP)

1. **Post-install file check**: Verify the bin target (`dist/index.js`) exists at the resolved global npm prefix path after installation.
2. **Post-install execution check**: Run the installed CLI with `--version` (or equivalent safe command) and confirm it exits successfully.
3. **Gated metadata save**: Only persist the new commit SHA to config after both validation checks pass.
4. **npm stderr capture**: Capture npm install stderr on all code paths (not just failures) so it can be surfaced when validation fails.
5. **Failure messaging**: On validation failure, print the missing path or failed subprocess output, plus a recovery hint pointing to rebuild/relink from a local checkout.
6. **Non-blocking auto-update handling**: When auto-update validation fails, warn to stderr and continue without blocking the user's current command. Do not save metadata.

## Features Explicitly Out of Scope (MVP)

- Server-side changes of any kind.
- Changes to ticket lookup, JSON output, help, or artifact commands.
- Replacing npm as the install mechanism.
- Changes to the CLI command name, package `bin` contract, or build configuration.
- Changes to authentication, org selection, or non-update commands.
- Automated repair (e.g., auto-rebuild from local checkout) — the MVP provides guidance, not auto-fix.
- New test framework introduction (validation can be verified via existing build tooling and manual confirmation).

## Success Criteria

1. When the installed package is valid (`dist/index.js` present, `hlx --version` succeeds), `hlx update` reports success exactly as today.
2. When `dist/index.js` is missing after npm install, `hlx update` exits non-zero and names the missing path.
3. When npm exits 0 but emits tar warnings and validation fails, the user sees enough install output to diagnose the package problem.
4. A declaration-only `dist/` install (`.d.ts` without `.js`) is not reported as successful.
5. The recovery message includes a concrete repair path (rebuild/relink from local checkout).
6. Install metadata is not persisted for broken installs, allowing `hlx update` retry.
7. Auto-update validation failure warns but does not block the user's current command.
8. No behavioral changes for valid installs beyond the added validation step.

## Key Design Principles

- **Fail closed**: If there is any doubt about the install's integrity, fail the update. Never report success for a broken install.
- **Validate the actual artifact**: Check the real installed package at the global prefix, not the currently running CLI or a local checkout.
- **Preserve retry path**: Do not persist metadata that would prevent the user from re-running `hlx update` after a failure.
- **Minimal change surface**: Confine changes to the update subsystem (`src/update/`). Do not touch other commands or the CLI entrypoint.
- **User-actionable errors**: Every failure message must include what is wrong and what the user can do about it.

## Scope & Constraints

- **Repository**: `helix-cli` only. No cross-repo changes.
- **Change surface**: `src/update/` directory — primarily `perform.ts` and `index.ts`, plus a new validation function.
- **Read-only context**: `package.json` (bin contract), `tsconfig.json` (build config), `src/index.ts` (entrypoint routing) inform the solution but are not change targets.
- **No test framework**: The repo has no test runner, test files, or test dependencies. Validation correctness relies on the existing build gate (`tsc`) and manual/acceptance testing.
- **Cross-platform**: Validation must work on Windows (observed failure platform) and Unix. Path resolution for the global npm prefix differs across platforms and Node version managers.

## Future Considerations

- **Automated repair**: A future version could attempt `npm run build` + `npm link` from a local checkout automatically on validation failure, rather than just printing instructions.
- **Test infrastructure**: Adding a test framework (e.g., vitest) would enable automated regression tests for validation failure scenarios.
- **Package integrity checks**: Beyond file existence, future versions could verify file checksums or source maps.
- **Telemetry**: Reporting validation failures to a central service could help detect broken publishes early.

## Open Questions / Risks

| Question | Impact |
|----------|--------|
| How should the installed package path be resolved across platforms and Node version managers (system Node, nvm, volta)? | `npm prefix -g` is the likely approach, but portability across Windows/Unix and version managers is a technical unknown. |
| Should `hlx --version` validation run as a subprocess? If so, the recursion guard (`HLX_SKIP_UPDATE_CHECK=1`) must be set to prevent the new CLI from triggering its own auto-update. | Running `--version` is the strongest validation but introduces subprocess management concerns. The existing recursion guard pattern exists and can likely be reused. |
| What happens if `npm prefix -g` itself fails or returns an unexpected path? | Validation must have a fallback or clear error for this edge case rather than crashing. |
| No test framework exists in the repository. How will validation logic be verified during development? | The ticket mentions "focused tests or equivalent local verification." Without a test runner, verification may be limited to build checks and manual acceptance criteria. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and requirements | Defines bin target contract, fail-closed requirement, two-step validation (file + version), recovery messaging, and acceptance criteria |
| scout/scout-summary.md | Detailed analysis of update flow architecture and gap | Confirms the zero-validation gap between npm success and "Update complete" message; identifies two update paths (manual/auto) with different failure behavior |
| scout/reference-map.json | Code-level evidence with line references | Documents that performUpdate returns success on npm exit 0 alone; stderr is lost on success path; metadata save is not gated on validation; no test framework exists |
| diagnosis/diagnosis-statement.md | Root cause analysis and contributing factors | Root cause: npm exit code equated with valid install. Contributing: partial tsc builds leave .d.ts without .js; stderr lost on success; metadata poisoning blocks retry |
| diagnosis/apl.json | Diagnostic answers to key questions | Specifies validation insertion points, global prefix resolution approach, stderr capture strategy, metadata gating requirement, and auto-update behavior on failure |
| repo-guidance.json | Repository intent classification | Confirms helix-cli is the sole target repository; all changes confined to src/update/ |

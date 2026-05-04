# Ticket Context

- ticket_id: cmolxl54y000ikq0uz0luz28t
- short_id: FIX-347
- run_id: cmolxl55i000lkq0uc9ks3x70
- run_branch: helix/fix/FIX-347-make-hlx-update-validate-installed-package-and
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Make hlx update Validate Installed Package And Recover From Broken Installs

## Description
# Ticket: Make hlx update Validate Installed Package And Recover From Broken Installs

## Summary
`hlx update` must not report success if the installed CLI package is unusable. After installing or updating, it must verify that the configured bin target exists and can run, and it must provide a clear recovery path when installation leaves the global CLI broken.

## Why
On 2026-04-30, `hlx update` exited successfully but left global `hlx` broken. The installed package had a `dist/` tree containing declaration files (`.d.ts`) but no compiled JavaScript entrypoint. Subsequent commands failed with `MODULE_NOT_FOUND` for `dist/index.js`. Recovery required manually pulling the local `helix-cli` checkout, running `npm run build`, and running `npm link` with elevated permissions.

Observed failure after update:

```text
Cannot find module 'C:\Program Files\nodejs\node_modules\@projectxinnovation\helix-cli\dist\index.js'
```

Observed install warning during update:

```text
npm warn tar TAR_ENTRY_ERROR ENOENT: no such file or directory, open '...\@projectxinnovation\helix-cli\dist\tickets\continue.d.ts'
```

## Decisions Already Made
- This is a CLI update/install reliability fix.
- The update command must fail closed when the installed CLI cannot run.
- A package missing `dist/index.js` is invalid for the current `bin` contract.
- npm warnings that indicate missing package entries must not be hidden behind a successful update message.
- Do not redesign the whole update mechanism unless needed to implement validation safely.

## Do Not Re-Decide
- Do not change the CLI command name `hlx`.
- Do not change the package `bin` contract unless the package metadata and build output are updated together.
- Do not silently accept declaration-only `dist` output as a valid install.
- Do not treat post-install validation as best-effort.

## Non-Negotiable Invariants
- `hlx update` must not print a plain success result if `dist/index.js` is missing after installation.
- The update flow must validate the actual installed package, not just the npm command exit code.
- The validation must check the configured bin target from package metadata or the known `hlx` bin target.
- A failed validation must produce a clear error that explains what file is missing and how to recover.
- Existing successful update behavior must continue to work when the installed package is valid.

## In Scope
- Update `hlx update` implementation in `helix-cli`.
- Add post-install validation that verifies the installed executable entrypoint exists and can start enough to report `--version` or equivalent.
- Surface npm install warnings or stderr when validation fails.
- Add focused tests or equivalent local verification around validation failure and success behavior.
- Improve recovery messaging for broken global installs.

## Out of Scope
- Server changes.
- Ticket lookup/json/help changes.
- Artifact command changes.
- Replacing npm as the installer unless existing code already supports that path.
- Changing authentication, org selection, or normal ticket commands.

## Required Behavior
1. Run the existing update/install process.
2. After installation, verify that the installed package's `hlx` bin target exists on disk.
3. Verify that invoking the updated CLI with a safe command such as `--version` succeeds.
4. If validation passes, print success as today.
5. If validation fails, print a clear failure message and include the missing path or failed command.
6. If npm emitted warnings relevant to missing package files, include or preserve them in the failure output.
7. Include a recovery hint that points users to rebuild/relink from a local checkout when applicable.

## Failure Behavior
- Missing `dist/index.js` after update must fail the update command.
- A post-install `hlx --version` failure must fail the update command.
- Validation failure must not leave the user believing the update succeeded.
- The command must exit non-zero on validation failure.

## Batch / Cardinality Rules
- Each `hlx update` invocation validates exactly the package it just installed.
- Do not validate a different global prefix or stale local checkout as a proxy for the installed CLI.

## Persistence / Artifact Rules
- Do not write new repo artifacts for normal update usage.
- Any temporary validation files or logs must stay in existing temp/cache locations and must not be committed.

## Acceptance Criteria
1. When the installed package contains `dist/index.js` and `hlx --version` works, `hlx update` reports success.
2. When the installed package is missing `dist/index.js`, `hlx update` exits non-zero and reports the missing path.
3. When npm exits zero but emits tar warnings and validation fails, the user sees enough install output to diagnose the package problem.
4. A broken declaration-only `dist/` install is not reported as successful.
5. The recovery message mentions rebuilding/relinking from a local checkout or another concrete repair path.
6. Existing update behavior remains unchanged for valid installs except for the added validation.

## Attachments
- (none)

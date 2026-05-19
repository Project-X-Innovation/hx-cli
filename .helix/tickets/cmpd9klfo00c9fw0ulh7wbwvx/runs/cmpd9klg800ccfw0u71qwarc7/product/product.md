# Product — BLD-517: Install and update hlx from GitHub main instead of npm

## Problem Statement

The `hlx` CLI currently depends on the npm registry for both install and self-update. This creates a fragile release pipeline: every change must be version-bumped, CI-tagged, and published to npm before users can receive it. The auto-tag CI step has broken in the past, leaving the npm package pinned behind `main`. Since every merge to `main` is already treated as shippable, the npm round-trip adds friction and delay with no user benefit. Users on stale versions have no way to get the latest code until the publishing pipeline catches up.

## Product Vision

Users get the exact code on `main` every time they install or update `hlx` — no intermediate registry, no version-bump ceremony, no stale packages. The update mechanism becomes a direct line from `main` HEAD to the user's machine.

## Users

- **hlx CLI users**: Internal developers who install and use `hlx` for their workflows. They have GitHub HTTPS or SSH credentials already configured.
- **Existing npm-sourced users**: A subset of the above who originally installed from the npm registry and must be migrated transparently.

## Use Cases

1. **Fresh install**: A new user runs a single documented command and gets a working `hlx` from the latest `main` commit, with version output that identifies the exact commit.
2. **Explicit update**: A user runs `hlx update` and is brought to `main` HEAD. If already current, told so. If not, the new code is installed, validated, and recorded.
3. **Auto-update check**: Before any command, `hlx` silently checks whether a newer commit exists on `main`. If so, it updates in the background (quiet mode). If the check fails, it warns and proceeds — never blocks the user's command.
4. **Migration from npm**: A user who originally installed from npm runs `hlx update` and is seamlessly switched to the GitHub-based install source with no manual steps.
5. **Offline resilience**: When the network is down, `hlx update` fails clearly (non-zero exit, actionable error). All other `hlx` commands continue to work normally.

## Core Workflow

```
[User runs hlx update]
  → Fetch remote main HEAD SHA (git ls-remote)
  → Read locally-recorded SHA from config
  → If equal → "Already up to date" (exit 0)
  → If different or absent → Run install from GitHub main
    → Validate install (bin target present and functional)
    → Record new SHA in config
    → If any step fails → exit non-zero with error + recovery command
```

For auto-update: same comparison, same install path, but runs quietly before command dispatch. Failures emit a stderr warning and do not block the user.

For migration: if the recorded install source is missing or marked as npm, print a one-line notice, run the install, and record the source as GitHub with the new SHA.

## Essential Features (MVP)

1. **SHA-based update check**: Compare locally-recorded commit SHA against remote `main` HEAD SHA. No npm registry queries.
2. **GitHub-direct install**: Install via `npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main`. npm is the installer (runs `prepare`/`tsc`, links `bin`); the registry is never contacted.
3. **Commit-aware version output**: `hlx --version` shows `<semver> (<short-sha>)` (e.g., `1.3.4 (c8620a5)`). Falls back to semver-only for legacy installs with a note to run `hlx update`.
4. **Transparent npm migration**: First `hlx update` on an npm-sourced install detects the old source, prints a one-line notice, re-installs from GitHub, and records the new source.
5. **Fail-closed update**: `hlx update` exits non-zero on any failure (SHA fetch, install, validation) with a clear error message and a copy-paste recovery command. Success is never silently assumed.
6. **Non-blocking auto-update**: Pre-command update check warns on failure but never blocks command dispatch.
7. **Updated documentation**: All in-repo install/update documentation and error messages reference the GitHub URL. No remaining npm registry references in user-facing text.

## Features Explicitly Out of Scope (MVP)

- **Other CLI commands**: No changes to any command behavior beyond `update` and `--version`.
- **CI pipeline changes**: The auto-tag and npm-publish CI workflows become dead weight but are not removed or modified in this ticket.
- **Config storage location**: Continue using the existing `~/.hlx/config.json` file and `InstallSource` schema. No new config files or paths.
- **Alternative install transports**: No homebrew, GitHub Releases tarballs, curl-pipe-bash, or prebuilt binaries.
- **SSH as canonical URL**: SSH remains valid but the single canonical documented form is HTTPS.

## Success Criteria

1. Fresh install on a machine with GitHub HTTPS credentials produces a working `hlx` whose `--version` includes both semver and short SHA.
2. Immediately after install, `hlx update` reports "Already up to date" until a new commit lands on `main`.
3. After a new commit on `main`, `hlx update` installs it and the recorded config SHA matches `git ls-remote` output.
4. An existing npm-sourced user runs `hlx update` and is migrated transparently — recorded source becomes GitHub `main` with SHA, binary continues working.
5. With no network, `hlx update` fails non-zero with a clear error; all other `hlx` commands are unaffected.
6. With no network, the pre-command auto-update check emits a stderr warning but does not block command dispatch.
7. In-repo documentation contains exactly one canonical install command (HTTPS git URL) and one canonical update command (`hlx update`). No remaining `npm install -g @projectxinnovation/helix-cli` references.
8. Neither the install path nor the update path queries the npm registry at any point.

## Key Design Principles

- **Fail closed on update, fail open on auto-check**: Explicit updates must never silently succeed when something went wrong. Background checks must never block the user.
- **Exact code delivery**: The user always gets exactly what is on `main` HEAD. No version skipping, no "too new" gating.
- **Minimal user disruption**: Migration is automatic. Existing invocation surface is unchanged. `PATH` availability is preserved.
- **Single source of truth**: The recorded SHA in config is the authoritative indicator of what's installed — not package.json metadata, not npm resolved fields.

## Scope & Constraints

- **Single repo**: All changes are within `helix-cli`. No cross-repo impact.
- **Private repo**: Users must have GitHub authentication (HTTPS credential helper or SSH key) pre-configured. The install command assumes this.
- **npm as installer only**: npm is used as the tool that clones, builds (`prepare` → `tsc`), and links the binary. The npm *registry* is not used.
- **Existing git primitives**: `fetchRemoteSha()`, `isUpdateAvailable()`, and the `InstallSource.commit` config field already exist in the codebase but are unused by the current update flow. This change wires them in.
- **No existing update tests**: The update module has no tests today. Test coverage is a consideration for implementation but not a product-level gate for this ticket.

## Future Considerations

- **Removing dead CI workflows**: The auto-tag and npm-publish workflows will be orphaned. A follow-up ticket could clean them up.
- **Removing npm publishConfig**: The `publishConfig` in `package.json` references the npm registry and could be cleaned up.
- **Update frequency throttling**: If SHA checks become too chatty, a cooldown mechanism could be added.
- **Offline-first caching**: Future work could cache the last-known remote SHA to reduce network calls.

## Open Questions / Risks

| # | Question / Risk | Status |
|---|----------------|--------|
| 1 | When npm installs from a git+https URL, does the package land at the same global path (`@projectxinnovation/helix-cli/`) as registry installs? Diagnosis concludes yes (npm uses the `name` field), but this should be verified during implementation. | Diagnosed as likely safe; verify at implementation |
| 2 | How does the initial install record the SHA in config? The install command (`npm install -g git+https://...`) does not run `hlx update`, so the first `hlx` invocation must handle a missing SHA gracefully. | Ticket specifies fallback: `--version` shows semver-only with a note to run `hlx update` |
| 3 | No update-module tests exist. Changes to the update flow have no test safety net. | Risk accepted for this ticket; test addition is an implementation consideration |
| 4 | Runtime inspection not available for this run. No production behavior or error-rate data was consulted. | Informational only — all evidence is from static analysis and ticket specification |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification with decisions, invariants, and acceptance criteria | SHA-based comparison, git+https install URL, transparent npm migration, fail-closed semantics, --version with SHA |
| scout/scout-summary.md | Synthesized analysis of codebase state | Git primitives already exist but are unused; 12 npm-referencing locations across 7 files; no README.md; no update tests; `prepare` script handles build for git installs |
| scout/reference-map.json | Detailed file map, facts, and unknowns | Confirmed all code paths and config schema; identified validateInstall() path question; confirmed InstallSource.commit field exists but is unpopulated |
| diagnosis/diagnosis-statement.md | Root cause analysis and change plan | npm registry dependency is the core issue; git primitives are ready to wire in; validateInstall() likely unchanged; 12 doc/error locations catalogued with line numbers |
| diagnosis/apl.json | Answered diagnostic questions with evidence | Confirmed fetchRemoteSha/isUpdateAvailable exist; confirmed npm places git installs by package name; detailed migration and --version approach |
| repo-guidance.json | Repo intent classification | Confirmed helix-cli is the sole target repo; no cross-repo impact |

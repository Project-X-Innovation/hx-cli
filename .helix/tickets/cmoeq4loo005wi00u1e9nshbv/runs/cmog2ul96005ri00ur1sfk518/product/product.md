# Product: Add GitHub main self-update and auto-update to helix-cli

## Problem Statement

helix-cli users have no way to update the CLI to the latest version. The project does not use npm publishing, so the only source of truth for the latest CLI is the `main` branch of `Project-X-Innovation/helix-cli` on GitHub. Today, users must manually re-clone or reinstall to get updates, with no feedback about whether they are running a stale version. Additionally, `hlx --version` displays `"0.1.0"` (hardcoded) while the actual package version is `"1.2.0"`, making version identity untrustworthy.

## Product Vision

Give helix-cli users a reliable, safe, and transparent way to stay on the latest `main` commit. Updates happen either on-demand (`hlx update`) or automatically (when `autoUpdate` is enabled), with clear feedback at every step: current, updated, or unable to update.

## Users

- **CLI end-users** who install helix-cli from the canonical GitHub repository and use it daily. They need confidence they are running the latest version without manual effort.
- **CLI contributors** who may install via git clone + npm link. They should not be auto-updated, and must receive clear messaging that their install mode is unsupported for self-update.

## Use Cases

1. **Manual update**: A user runs `hlx update` to check for and apply updates from GitHub `main`.
2. **Automatic update**: A user enables `autoUpdate`, and every subsequent CLI invocation silently checks GitHub `main` and updates if behind, before running the requested command.
3. **Update preference management**: A user enables or disables `autoUpdate` via a command, and the preference persists across invocations without affecting other settings.
4. **Version check**: A user runs `hlx --version` and sees the real installed package version.
5. **Unsupported install mode**: A user who installed via a non-canonical method runs `hlx update` and receives a clear explanation that their install mode does not support self-update, with no risky mutation attempted.
6. **Network failure**: A user runs `hlx update` or has `autoUpdate` enabled while offline. The CLI reports the failure clearly and does not corrupt the install or config.

## Core Workflow

1. User invokes any `hlx` command.
2. If `autoUpdate` is enabled, the CLI makes one lightweight check of the GitHub `main` HEAD commit SHA.
3. If the local commit SHA matches remote, proceed directly to the requested command.
4. If behind, perform one self-update attempt, then proceed to the requested command on success.
5. If update fails or install mode is unsupported, report clearly and continue (for auto-update) or exit non-zero (for explicit `hlx update`).

For `hlx update` specifically: the same check-and-update flow runs regardless of the `autoUpdate` setting.

## Essential Features (MVP)

1. **`hlx update` command** -- Checks GitHub `main` HEAD commit SHA, compares with local installed SHA, and performs self-update if behind. Reports "already current", "updated successfully", or a clear failure reason.

2. **`autoUpdate` persisted setting** -- Stored in `~/.hlx/config.json`. Disabled by default. A command surface to enable and disable it. Saving must not destroy existing config fields (`apiKey`, `url`).

3. **Pre-command auto-update check** -- When `autoUpdate` is enabled, every CLI invocation performs one GitHub `main` HEAD check before executing the requested command. At most one update attempt per invocation.

4. **Install-source metadata** -- Persisted in `~/.hlx/config.json`: install mode, canonical repo URL, tracked branch, and installed commit SHA. Used to determine whether the local install is eligible for self-update.

5. **Canonical install guard** -- Self-update only proceeds when the install is recognized as a canonical GitHub-based install of `Project-X-Innovation/helix-cli#main`. All other install modes fail clearly.

6. **Loop prevention** -- The CLI must not re-enter the update check after performing an update within the same invocation.

7. **Accurate `hlx --version`** -- Reads version from package metadata at runtime instead of the current hardcoded string.

8. **Safe failure modes** -- Network/API failure does not corrupt install or config. Missing or inconsistent metadata fails closed with a clear report.

## Features Explicitly Out of Scope (MVP)

- npm publish automation or npm-registry-based updates.
- Server-driven version checks or server-side CLI update endpoints.
- GitHub releases or tags as update source.
- Support for arbitrary forks, branches, or custom install sources.
- Broader CLI redesign or unrelated command changes.
- Comprehensive test suite or CI pipeline (only targeted tests for update/config/version behavior).

## Success Criteria

1. `hlx --version` outputs the version from `package.json` (currently `"1.2.0"`), not a hardcoded value.
2. `hlx update` compares local commit SHA against GitHub `main` HEAD and updates or reports "already current".
3. `autoUpdate` can be toggled and persists in `~/.hlx/config.json` without losing `apiKey` or `url`.
4. With `autoUpdate` enabled, a normal CLI command performs exactly one GitHub `main` HEAD check before execution.
5. With `autoUpdate` disabled, no automatic update check occurs.
6. Non-canonical install modes (e.g., git clone + npm link) produce a clear failure message and no mutation.
7. At most one update check and one update attempt per invocation (no recursive loops).
8. Network or API failure during update produces a clear error; install and config remain intact.
9. All changes are confined to `helix-cli`; `helix-global-server` is unchanged.

## Key Design Principles

- **Fail closed**: When update eligibility is uncertain, do not update. Report what is missing.
- **Config safety**: Never overwrite unrelated config fields when persisting update settings or metadata.
- **One-shot**: Each invocation performs at most one update check and one update attempt.
- **Transparency**: Always tell the user what happened -- current, updated, failed, or unsupported.
- **Minimal footprint**: No new runtime dependencies; no server participation; no changes outside the allowed file list.

## Scope & Constraints

- **Update source**: GitHub `Project-X-Innovation/helix-cli` branch `main` only. Commit SHA is the update identity, not semver.
- **Persistence**: All settings and update metadata live in `~/.hlx/config.json`. No state written to the repo.
- **Allowed changes**: `src/index.ts`, `src/lib/config.ts`, `src/lib/http.ts` (if minimal helpers needed), new `src/update/*` files, `package.json`, `README.md` (minimal), targeted tests.
- **Forbidden**: npm-registry polling, server version endpoints, arbitrary fork/branch support, broad dependency additions, committed secrets.
- **Existing bug**: Version drift (`0.1.0` hardcoded vs `1.2.0` in package.json) must be fixed as part of this work.
- **Config system**: Current `saveConfig` is lossy (writes only `{apiKey, url}`). Must be fixed to preserve additional fields before new settings can be safely persisted.

## Future Considerations

- When npm publishing is established, the update mechanism may shift from GitHub-direct to npm-registry-based checks.
- A more structured config migration system may be needed as config fields grow.
- Rate-limiting (GitHub unauthenticated API: 60 requests/hour) may become a concern for teams with frequent CLI invocations; a cooldown or cache mechanism could be added later.
- CI/CD integration and a comprehensive test suite are out of scope here but will be needed as the CLI matures.

## Open Questions / Risks

| Question / Risk | Impact | Status |
|-----------------|--------|--------|
| How will the CLI detect its install mode at runtime (npm global from GitHub URL vs git clone + npm link vs other)? | Determines whether self-update is safe to attempt. The detection mechanism is not yet defined. | Technical unknown -- defer to tech-research/implementation |
| Which GitHub API approach: REST API (`api.github.com`) vs `git ls-remote`? | REST API is simple but rate-limited (60/hr unauthenticated). `git ls-remote` requires git binary. | Technical unknown -- defer to tech-research |
| Exact self-update shell command (`npm install -g github:...` or other)? | Must reinstall from GitHub, not npm registry. The precise command and its error handling need definition. | Technical unknown -- defer to tech-research |
| How does the CLI read package.json version in ES module context? | `require()` not available with `"type": "module"`. Approach must be ES-module-compatible. | Technical unknown -- defer to tech-research |
| What happens to the running process after self-update replaces `dist/` files? | The current process may behave unpredictably if update replaces the files it is executing from. May require process re-exec. | Technical unknown -- defer to tech-research |
| GitHub API rate-limiting at scale | 60 unauthenticated requests/hour could be exhausted by a team. Not blocking for MVP but a known limit. | Accepted risk for MVP |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `helix-cli/.../ticket.md` | Primary specification with requirements, acceptance criteria, and constraints | All changes scoped to helix-cli; update source is GitHub main commit SHA; autoUpdate in ~/.hlx/config.json; no npm/server checks |
| `helix-cli/.../scout/scout-summary.md` | Current state analysis and key boundaries | Version drift confirmed (0.1.0 vs 1.2.0); config system is lossy; no update infrastructure exists; HTTP client not reusable for GitHub; ES module context affects runtime introspection |
| `helix-cli/.../scout/reference-map.json` | Detailed file-level analysis, confirmed facts, and cataloged unknowns | 12 facts confirmed including lossy saveConfig, hardcoded version, ES module context, Node >=18 engine; 6 unknowns documented including install-mode detection and update mechanism |
| `helix-cli/.../diagnosis/diagnosis-statement.md` | Root cause analysis of 4 issues | Version drift is a pre-existing bug; config system blocks new features; update is entirely greenfield; hxFetch not reusable for GitHub |
| `helix-cli/.../diagnosis/apl.json` | Diagnosis Q&A with evidence-backed answers | Confirmed saveConfig field loss; confirmed no existing update code; identified viable update mechanism (npm install -g github:...); identified ES module version-reading approaches |
| `helix-global-server/.../repo-guidance.json` | Repo intent classification | helix-cli is the target repo; helix-global-server is context-only with no changes needed |

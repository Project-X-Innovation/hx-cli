# Product Spec — BLD-527: Replace hlx self-update with GitHub release assets

## Problem Statement

`hlx update` and the pre-command auto-update rely on `npm install -g git+https://...#main`, which triggers a TypeScript build (`tsc`) on the user's machine. This fails when the build toolchain is unavailable — particularly on Windows — and `npm install -g` destructively removes the existing CLI before the new version is confirmed working. A failed update therefore bricks the CLI. Separately, an `auto-tag.yml` workflow pushes a git tag on every merge to `main`, chaining to npm publish and requiring a custom `RELEASE_TOKEN`, creating unwanted release coupling and friction.

**Observed impact:** Users who run `hlx update` on machines without TypeScript lose their working CLI installation with no automatic recovery path. The only fix is a manual reinstall.

## Product Vision

The `hlx` CLI updates itself from prebuilt artifacts served by GitHub, with no build tools required on user machines. Updates are safe: the running CLI is never replaced until a new version is fully downloaded and validated. The CI pipeline publishes a ready-to-use artifact on every `main` merge, while npm publishing remains an intentional, manual action for tagged releases.

## Users

| User | Context |
|------|---------|
| **hlx end-users** | Developers using `hlx` day-to-day on macOS, Linux, and Windows. They expect `hlx update` to work without installing Node/TypeScript tooling. |
| **hlx auto-update** | The pre-command auto-update hook that runs silently before every CLI dispatch. Must never block or break the CLI. |
| **Maintainers** | Team members who merge PRs to `main` and occasionally cut intentional npm releases via manual tags. |

## Use Cases

1. **Routine update:** A user runs `hlx update`. The CLI checks for a newer `main` build, downloads it, validates it, and swaps it in. The user sees the new version on the next invocation.
2. **Already current:** A user runs `hlx update` when already on the latest build. The CLI reports "Already up to date" and exits cleanly.
3. **Failed update (manual):** Download or validation fails. The CLI exits with a non-zero code, a clear error message, and the previously installed version remains fully functional.
4. **Failed update (auto):** The pre-command auto-update encounters a network or auth error. It logs a warning and continues dispatching the user's intended command.
5. **Auth missing for private repo:** The updater cannot access GitHub assets. The CLI tells the user exactly what authentication is needed instead of showing a generic download error.
6. **Maintainer npm release:** A maintainer pushes a `v*` tag. The existing `publish.yml` workflow publishes to npm as before. No workflow changes needed for this path.
7. **Version identification:** A user or support engineer runs `hlx --version` and sees the semantic version plus the installed commit SHA, sufficient to identify the exact build.

## Core Workflow

```
main merge -> CI builds & publishes prebuilt artifact (GitHub Release)
                                   |
     hlx update / auto-update -> query latest artifact metadata + commit SHA
                                   |
                          compare to local installed SHA
                                   |
                     (same) -> "Already up to date"
                     (different) -> download to staging area
                                   |
                          unpack & validate staged candidate
                                   |
                     (pass) -> swap staged -> live, record metadata
                     (fail) -> abort, keep current install, report error
```

## Essential Features (MVP)

1. **CI build artifact on main merge:** Every push to `main` produces a prebuilt, runnable artifact published as a GitHub Release asset. The release tag must not match `v*` (to avoid triggering npm publish).

2. **Staged download-validate-swap updater:** `hlx update` downloads the artifact to a staging location, validates it (entrypoint exists, `--version` runs), and only then replaces the live install. The old install is never modified until the candidate passes validation.

3. **Shared mechanism for manual and auto-update:** Both `hlx update` (fail-closed) and pre-command auto-update (fail-open) use the identical staged install path.

4. **SHA-based version comparison:** The updater compares the remote artifact's commit SHA against the locally recorded SHA to determine whether an update is needed.

5. **Explicit auth failure messaging:** When the GitHub artifact is inaccessible due to missing authentication, the CLI reports the specific auth requirement rather than a generic error.

6. **Remove auto-tag workflow:** Delete `.github/workflows/auto-tag.yml`. No tag is pushed on `main` merge.

7. **Preserve manual npm publish path:** The existing `publish.yml` workflow continues to work unchanged when a maintainer manually pushes a `v*` tag.

8. **Install metadata persistence:** After a successful update, record `source=github`, `channel=main`, and the installed commit SHA in the user's config (`~/.hlx/config.json`).

9. **Version display with commit SHA:** `hlx --version` continues to show the version and commit SHA (e.g., `1.3.4 (c8620a5)`).

10. **Updated documentation and error messages:** Replace all hardcoded `npm install -g git+https://...` references (6 known locations) with instructions reflecting the new GitHub artifact install path.

## Features Explicitly Out of Scope (MVP)

- Reworking unrelated CLI commands or features.
- Removing the manual npm publish workflow (`publish.yml`).
- Package manager integrations (Homebrew, winget, MSI, etc.).
- General repo cleanup beyond files directly touched by this change.
- Multi-platform or OS-specific binary builds (the artifact is a Node.js package, not a compiled binary).

## Success Criteria

| # | Criterion | Verification Method |
|---|-----------|---------------------|
| 1 | A merge to `main` produces a prebuilt GitHub Release asset without creating a `v*` tag | Inspect CI workflow output after a main merge |
| 2 | `auto-tag.yml` is deleted | File no longer exists in the repo |
| 3 | Manual `v*` tag push still triggers npm publish via `publish.yml` | Push a test tag and observe publish workflow |
| 4 | `hlx update` installs the latest `main` artifact without requiring `tsc` or any build tools | Run `hlx update` on a machine without TypeScript installed |
| 5 | A failed artifact download/validation leaves the previous CLI fully functional | Simulate download failure; confirm `hlx` still runs afterward |
| 6 | Auto-update failure logs a warning and does not block command dispatch | Simulate auto-update failure; confirm the user's command still executes |
| 7 | Missing GitHub auth produces explicit auth guidance, not a generic error | Attempt update without GitHub credentials against a private repo |
| 8 | Install/update docs no longer reference `npm install -g git+https://...` as the primary path | Grep the codebase for the old install string |
| 9 | `hlx --version` shows commit SHA after a GitHub-sourced update | Run `hlx --version` after a successful update |
| 10 | A previously failing update scenario (e.g., no `tsc` on Windows) now succeeds | Reproduce the original failure condition and verify the fix |

## Key Design Principles

- **Never brick the CLI:** The live install is immutable until a fully validated candidate is ready to replace it.
- **Fail-open for auto-update, fail-closed for manual update:** Auto-update must never block the user's command. Manual update must give a clear non-zero exit on failure.
- **No user-side build tools:** The artifact must be prebuilt and runnable as-is. Users should not need `tsc`, `npm`, or `git` to update.
- **Single canonical update channel:** One source of truth for the latest build (the newest GitHub Release asset from `main`).
- **Explicit over silent:** Auth failures, download failures, and validation failures all produce specific, actionable error messages.

## Scope & Constraints

- **Repository:** `helix-cli` only. No cross-repo impact identified.
- **Affected areas:** CI workflows (new build-release, remove auto-tag), update module (`src/update/` — 5 files), documentation/error messages (6 files), and potentially config types (`src/lib/config.ts`).
- **Preserve:** `publish.yml` must remain unchanged. The `--version` output format must be preserved. The fail-open/fail-closed behavioral split between auto-update and manual update must be preserved.
- **Constraint:** The CI workflow must use the standard `GITHUB_TOKEN` with `contents: write`. No new custom secrets are required for the normal update path.
- **Constraint:** Zero production dependencies in the project. The prebuilt artifact does not need `node_modules/`.

## Future Considerations

- **Platform-specific optimized builds:** If performance demands it, the artifact could evolve into per-OS compiled binaries (e.g., via `pkg` or `bun compile`), but Node.js tarball is sufficient for MVP.
- **Delta/incremental updates:** Currently, every update downloads the full artifact. If artifact size becomes a concern, diff-based updates could be explored.
- **Rollback capability:** MVP ensures the old install survives a failed update, but does not provide an explicit `hlx rollback` command. This could be added later.
- **Update channels:** MVP supports only the `main` channel. Named channels (e.g., `beta`, `canary`) could be added by publishing additional release tags.
- **Telemetry:** Update success/failure rates could be tracked to monitor the health of the new update mechanism.

## Open Questions / Risks

| # | Question / Risk | Impact | Status |
|---|----------------|--------|--------|
| 1 | **Private repo auth model:** Is the `helix-cli` GitHub repo private or public? This determines whether artifact downloads require a GitHub token and the shape of the auth error messaging. | Directly affects whether auth guidance is needed for all users or only some. | Unknown — record for tech-research |
| 2 | **GitHub Release vs. Actions artifact:** GitHub Releases have permanent assets with stable URLs. Actions artifacts expire (default 90 days) and require API auth. Diagnosis recommends Releases with a rolling `latest` tag. | Fundamental to the download URL scheme and whether `GITHUB_TOKEN` is needed for downloads. | Recommended: GitHub Releases; confirm in tech-research |
| 3 | **Atomic file swap on Windows:** Windows locks running executables, complicating the staged-swap step. The swap mechanism must account for OS-specific file-locking behavior. | Could cause update failures on Windows if not handled. | Unknown — requires tech-research |
| 4 | **Install location discovery:** The running CLI needs to know its own install root to replace files. `import.meta.url` is available, but the exact strategy depends on how the CLI was originally installed (npm global, direct download, etc.). | Affects the swap logic in the updater. | Partially answered — `import.meta.url` is used in existing code; needs tech-research for edge cases |
| 5 | **Replacing `git ls-remote` with GitHub API:** Currently the SHA comparison uses `git ls-remote`, which requires `git` on the user's machine. If the updater already hits the GitHub API for release metadata, consolidating removes the `git` dependency. | Removes a user-machine dependency but changes the SHA-check mechanism. | Recommended by diagnosis; confirm in tech-research |
| 6 | **No existing update module tests:** The `src/update/` module has zero test coverage. Changes to this critical path should include tests. | Risk of regressions in the update mechanism without tests. | Known gap — implementation should add tests |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements, acceptance criteria, and non-negotiable invariants | Detailed behavioral specs for staged update, failure modes, and workflow changes |
| `scout/scout-summary.md` | Codebase architecture analysis | 5-file update module structure, 2 CI workflows, 6 hardcoded npm-install references, zero tests |
| `scout/reference-map.json` | File-level evidence inventory and open unknowns | 19 facts confirming root causes; 8 unknowns including artifact mechanism, auth model, and Windows atomicity |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and proposed change scope | 4 root causes identified; recommends rolling `latest` tag, staged download-validate-swap, GitHub API for SHA check |
| `diagnosis/apl.json` | Structured Q&A with evidence citations | Confirmed zero production deps (tarball needs no node_modules), `v*`-avoidance for tag naming, GITHUB_TOKEN sufficiency |
| `repo-guidance.json` | Repo intent classification | Single repo (`helix-cli`) confirmed as the sole change target with no cross-repo impact |

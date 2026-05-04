# Product — BLD-375: Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Problem Statement

The `@projectxinnovation/helix-cli` CLI tool has no npm release path. The `hlx update` command installs directly from GitHub main via `npm install -g github:...`, which is brittle on Windows and has already produced a broken install where `dist/index.js` was missing. There is no CI/CD infrastructure in the repo, no publish workflow, and `package.json` lacks the `repository` metadata required by npm Trusted Publishing. Users cannot install from a stable, validated npm release.

## Product Vision

Establish a reliable npm release pipeline for helix-cli so that every published version is built, tested, and validated before reaching users. The CLI's self-update mechanism should pull from npm releases rather than GitHub main, giving users a consistent and cross-platform install experience.

## Users

- **CLI end-users**: Developers who install and update `hlx` globally via npm. They need reliable installs that always include the correct runtime files.
- **Release operators**: Team members who trigger a release. They need a clear, secure publish flow that does not depend on managing long-lived tokens.

## Use Cases

1. **Publish a new CLI version**: A release operator triggers the publish workflow. The workflow builds, tests, validates the tarball contents, and publishes to npm — all without a stored `NPM_TOKEN`.
2. **Update the CLI**: A user runs `hlx update` (or receives an auto-update prompt). The CLI checks the npm registry for a newer version and installs from npm rather than from GitHub main.
3. **Prevent broken publishes**: If the build output is missing `dist/index.js` or other required runtime files, the workflow blocks the publish. Users never receive an incomplete package.

## Core Workflow

1. Developer merges changes and triggers a release (exact trigger to be defined — tag push, GitHub Release, or manual dispatch).
2. The publish workflow installs dependencies, builds from source, and runs the full test suite.
3. A pack-validation step inspects the actual tarball to confirm `dist/index.js` and required `dist/**` runtime files are present.
4. If all checks pass, the workflow publishes to npm using OIDC-based Trusted Publishing (no token).
5. Users can then `hlx update` to fetch the new version from npm.

## Essential Features (MVP)

| # | Feature | User Benefit |
|---|---------|-------------|
| 1 | GitHub Actions publish workflow (`.github/workflows/publish.yml`) with OIDC permissions | Secure, tokenless publishing from the repo |
| 2 | `package.json` repository metadata matching the GitHub repo URL | Enables npm Trusted Publishing identity verification |
| 3 | Pre-publish tarball validation that fails closed on missing `dist/index.js` or required runtime files | Prevents broken installs from ever reaching users |
| 4 | Update mechanism migrated to npm registry (version check + install) | Reliable cross-platform updates; no dependency on git or GitHub availability |
| 5 | `InstallSource.mode` extended with `"npm"` variant | Correct metadata tracking for npm-sourced installations |
| 6 | Published tarball limited to runtime files only (no test artifacts) | Lean, intentional package contents |

## Features Explicitly Out of Scope (MVP)

- Unrelated CLI command changes or new features
- Repo-wide code cleanup or refactoring
- GitHub Packages support
- Token-based npm publishing as the primary design
- New CI systems beyond GitHub Actions
- Automated changelog generation or release notes tooling
- Multi-package or monorepo publishing

## Success Criteria

1. `.github/workflows/publish.yml` exists with `id-token: write` permissions and a build/test/validate/publish pipeline.
2. `package.json` includes `repository` field matching `https://github.com/Project-X-Innovation/helix-cli.git`.
3. The publish workflow fails before publish if the packed tarball is missing `dist/index.js` or other required runtime files.
4. The workflow does not require an `NPM_TOKEN` secret.
5. `hlx update` checks the npm registry for the latest version and installs from npm (not GitHub main).
6. The release trigger is documented clearly enough for npm Trusted Publisher UI configuration.
7. Published package excludes test files (`*.test.js`, `*.test.d.ts`).

## Key Design Principles

- **Fail closed**: Every stage (build, test, pack validation, OIDC auth) must block publish on failure. No fallbacks to token-based publishing.
- **Validate the artifact, not the tree**: Pack validation must inspect the actual tarball, not the working directory.
- **Minimal published surface**: Only runtime-necessary files ship in the tarball.
- **Preserve existing contracts**: The `hlx` binary name, `dist/index.js` entrypoint, and `package.json` version reading via relative path must remain unchanged.

## Scope & Constraints

- **Single repo**: All changes are within `helix-cli`. No cross-repo impact identified.
- **Files in scope**: `package.json`, `.github/workflows/publish.yml`, `src/update/check.ts`, `src/update/perform.ts`, `src/update/index.ts`, `src/lib/config.ts`, `src/index.ts`, and supporting validation scripts if needed.
- **GitHub-hosted runners only**: The workflow must not depend on self-hosted runners.
- **One package per workflow run**: No multiplexed publishes.
- **No new `.helix` artifacts**: Tarball or pack manifest files stay ephemeral (workflow artifacts or runner-local).

## Future Considerations

- Automated version bumping and changelog generation.
- CI pipeline expansion beyond the publish workflow (e.g., PR checks, lint).
- Canary or pre-release channel publishing.
- Migration of existing GitHub-sourced installations to npm-sourced on next update.

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|----------------|--------|
| 1 | Whether the `@projectxinnovation` npm scope exists and is controlled by the organization | Blocks publishing entirely if the scope is unowned or misconfigured |
| 2 | Whether `@projectxinnovation/helix-cli` has ever been published (version conflict risk) | Could cause version 1.2.0 publish to fail if already claimed |
| 3 | Intended publish trigger (tag push, GitHub Release, manual dispatch) | Affects workflow `on:` configuration and operator documentation |
| 4 | Whether npm Trusted Publishing is already configured in the npm UI for this package/repo | UI-side setup is a prerequisite that is outside code scope |
| 5 | Semver comparison strategy for npm-based update checks (e.g., latest tag vs. explicit version query) | Affects update check implementation |
| 6 | Transition path for users whose `installSource.mode` is currently `"github"` | First npm-based update must work for users who originally installed from GitHub |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement, acceptance criteria, and constraint definitions | Defined OIDC publish, pack validation, repository metadata, update migration, and fail-closed requirements |
| `scout/scout-summary.md` | Codebase analysis and gap identification | Confirmed no CI/CD exists, missing repository field, GitHub-direct update mechanism, test files in tarball |
| `scout/reference-map.json` | Structured file inventory with evidence and unknowns | Provided detailed per-file state, confirmed version.ts npm compatibility, identified all boundary files |
| `diagnosis/diagnosis-statement.md` | Root cause analysis of four distinct gaps | Mapped each gap (metadata, workflow, update mechanism, tarball cleanup) to specific files and lines |
| `diagnosis/apl.json` | Diagnosis Q&A with evidence chains | Confirmed npm Trusted Publishing OIDC requirements, validated version.ts path resolution, scoped update migration |
| `repo-guidance.json` | Repo intent classification | Confirmed helix-cli is the sole target repo with no cross-repo dependencies |

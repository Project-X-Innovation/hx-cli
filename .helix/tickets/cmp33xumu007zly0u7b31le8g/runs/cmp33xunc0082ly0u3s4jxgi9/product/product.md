# Product — BLD-435: Bump helix-cli package version to 1.3.3

## Problem Statement

The `@projectxinnovation/helix-cli` npm package is at version `1.3.2`. The repo's GitHub Actions publish workflow triggers on `v*` tag pushes and validates that the pushed tag matches the version in `package.json`. Until `package.json` is bumped to `1.3.3`, pushing a `v1.3.3` tag will fail the publish workflow. The repo must be prepared for the next patch release.

## Product Vision

Keep the `helix-cli` package version in lockstep with the release tagging convention so that the automated npm publish pipeline works without manual intervention when the team is ready to ship `v1.3.3`.

## Users

| User | Impact |
|------|--------|
| **Helix CLI maintainers** | Cannot trigger a `v1.3.3` npm publish until the version is bumped. |
| **Helix CLI consumers (npm)** | No direct impact until the tag is pushed and the package is published; this ticket is preparatory. |

## Use Cases

1. **Release preparation** — A maintainer bumps the version so the repo is ready for the next tag-triggered publish.
2. **Publish validation** — The publish workflow compares the tag to `package.json` version; they must match for the workflow to proceed.

## Core Workflow

1. Update `package.json` version from `1.3.2` to `1.3.3`.
2. Update `package-lock.json` to stay in sync.
3. Verify the repo still typechecks and builds.
4. Merge. A later `v1.3.3` Git tag triggers npm publish automatically.

## Essential Features (MVP)

- **Version bump in `package.json`** — change `"version": "1.3.2"` to `"version": "1.3.3"` (line 3).
- **Lockfile sync in `package-lock.json`** — update version on lines 3 and 9 to `1.3.3`.
- **Build/typecheck validation** — confirm `npm run typecheck` and `npm run build` still pass after the change.

## Features Explicitly Out of Scope (MVP)

- New CLI features, bug fixes, or behavioral changes.
- Release workflow redesign or modification of `.github/workflows/publish.yml`.
- Git tag creation or actual npm publication.
- CHANGELOG or README creation (none exist in the repo today).
- Cross-repo changes outside `helix-cli`.
- Choosing a different semver level — the target is exactly `1.3.3`.

## Success Criteria

1. `package.json` declares `"version": "1.3.3"`.
2. `package-lock.json` declares `"version": "1.3.3"` in both locations (lines 3 and 9).
3. No source files outside `package.json` and `package-lock.json` are modified.
4. `npm run typecheck` passes.
5. `npm run build` passes.
6. The repo is ready for a `v1.3.3` Git tag to trigger the existing publish workflow without errors.

## Key Design Principles

- **Minimal diff** — only version metadata files change; no source code touched.
- **Convention-following** — use the same version update pattern already established in the repo.
- **No side effects** — the version bump must not alter runtime behavior or build output beyond the version identifier.

## Scope & Constraints

| Constraint | Detail |
|-----------|--------|
| Files to change | `package.json`, `package-lock.json` only |
| Version target | Exactly `1.3.3` — non-negotiable |
| Release metadata | No CHANGELOG/README exists; none required |
| Runtime version | Read dynamically from `package.json` via `src/update/version.ts` — no hardcoded update needed |
| Workflow | `.github/workflows/publish.yml` reads version dynamically — no changes needed |

## Future Considerations

- If the team introduces a CHANGELOG or release-notes convention, future version bumps may need to touch additional files.
- Downstream consumers pinning to specific versions may need notification — outside this ticket's scope.

## Open Questions / Risks

| Item | Type | Notes |
|------|------|-------|
| Lockfile update method | Question | Whether to use `npm version 1.3.3 --no-git-tag-version` (which updates both files atomically) vs. manual edits. Both produce valid results; implementation can decide. |
| Downstream pinning | Risk (low) | Unknown whether consumers pin to `1.3.2`. Out of scope but noted for awareness. |
| No runtime inspection available | Warning | No `/tmp/helix-inspect/manifest.json` present; runtime checks were not performed. Not material for a metadata-only change. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Ticket requirements, acceptance criteria, and constraints | Target version is `1.3.3`; only version-related files should change; must typecheck and build. |
| `scout/scout-summary.md` | Scout's file analysis and version reference search | Version in exactly two files; no hardcoded version in source; no release metadata files exist. |
| `scout/reference-map.json` | Detailed file-level findings and unknowns | Confirmed `package.json` and `package-lock.json` are the only change targets; build/test scripts identified. |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and evidence summary | Change is self-contained to two files; publish workflow reads version dynamically; disconfirming grep verified no hidden references. |
| `diagnosis/apl.json` | Structured diagnosis answers and follow-ups | All diagnostic questions answered with evidence; no follow-ups remaining. |
| `repo-guidance.json` | Repo intent classification | `helix-cli` is the sole target repo; no cross-repo changes needed. |

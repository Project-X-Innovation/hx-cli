# Tech Research — BLD-501

## Technology Foundation

- **Runtime**: Node.js >= 18 (package.json `engines` field)
- **Language**: TypeScript 6.x (devDependency), compiled to ESM (`"type": "module"`)
- **Build**: `tsc` via `prepare` script; output to `dist/`
- **Package manager**: npm (lockfileVersion 3)
- **CI/CD**: GitHub Actions — two-stage pipeline (auto-tag.yml + publish.yml)
- **Registry**: npm public registry with provenance via OIDC Trusted Publishing (Node 24 / npm 11.x)
- **No runtime dependencies** — only devDependencies (`@types/node`, `typescript`)

## Architecture Decision

### Options Considered

| # | Option | Description |
|---|--------|-------------|
| 1 | **Direct file edit** — manually update version in `package.json` and `package-lock.json` | Edit the version string in both files directly. Simple, deterministic, no tool dependencies. |
| 2 | **`npm version patch --no-git-tag-version`** — use npm CLI to bump | npm updates both `package.json` and `package-lock.json` atomically. Requires npm to be available in the environment. |
| 3 | **`npm version patch`** (with git tag) — use npm CLI with auto-tagging | npm bumps version and creates a local git tag. Conflicts with the existing auto-tag.yml workflow which manages tags centrally. |

### Chosen Option: Option 1 — Direct file edit

**Rationale**: The change is a single string replacement (`"1.3.3"` to `"1.3.4"`) in exactly two files at known locations. Direct editing is the simplest approach, avoids tool dependencies, and avoids any risk of npm creating an unwanted git tag (Option 3) or altering other lockfile contents. The auto-tag.yml workflow is the designated tag creator — version tagging must not happen at edit time.

## Core API/Methods

Not applicable. This change is metadata-only — no APIs, methods, or code paths are modified.

The runtime version reader (`src/update/version.ts:getPackageVersion()`) reads the version field from `package.json` dynamically at runtime via `readFileSync`. It requires no changes and will automatically reflect the bumped version.

## Technical Decisions

### Decision 1: Patch bump (1.3.3 → 1.3.4)

**Chosen**: Patch increment.
**Rejected alternatives**:
- Minor bump (1.4.0): No new features are introduced by this change.
- Major bump (2.0.0): No breaking changes are introduced.
- Pre-release (1.3.4-rc.1): Unnecessary complexity; the pipeline does not have pre-release support and this is a routine version advance.

**Rationale**: The ticket requests a version bump solely to unblock the deploy pipeline. No functional changes accompany this bump. Semver convention dictates a patch increment for non-breaking, non-feature changes.

### Decision 2: Files to modify — package.json and package-lock.json only

**Chosen**: Edit exactly 2 files.
**Rejected alternatives**:
- Modifying workflow files: The pipeline is correctly configured (confirmed by diagnosis) and must not be changed (per product spec).
- Modifying source code: No hardcoded version strings exist in `src/` (confirmed by grep in diagnosis).

**Rationale**: Diagnosis confirmed via grep that `1.3.3` appears only in `package.json` (line 3) and `package-lock.json` (lines 3, 9). `src/update/version.ts` reads version dynamically. No other files reference the version.

### Decision 3: Lockfile update strategy — direct edit, not npm install

**Chosen**: Directly edit `package-lock.json` version fields.
**Rejected alternatives**:
- Running `npm install` after editing `package.json`: This could update dependency resolutions or lockfile format beyond the version field, introducing unnecessary diff noise.
- Running `npm version patch`: See Architecture Decision above — risks unwanted side effects.

**Rationale**: The lockfile contains the version string in exactly 2 locations (line 3: root `"version"`, line 9: `packages[""].version`). A direct replacement is deterministic and produces the minimal diff. The `npm ci` step in the publish workflow will validate lockfile integrity.

## Cross-Platform Considerations

Not applicable. The change is metadata-only and does not affect platform-specific behavior. The CI pipeline runs on `ubuntu-latest`.

## Performance Expectations

- **Build time**: No change — the TypeScript compilation is unaffected by version metadata.
- **Runtime**: No change — `getPackageVersion()` reads one small JSON file once.
- **Pipeline execution**: The auto-tag.yml workflow will detect that `v1.3.4` does not exist and create the tag (~seconds). The publish.yml workflow will then run the full build/test/validate/publish cycle (~minutes, dependent on npm registry latency).

## Dependencies

### Existing (unchanged)

| Dependency | Type | Purpose |
|-----------|------|---------|
| `@types/node` ^25.5.0 | devDependency | Node.js type definitions |
| `typescript` ^6.0.2 | devDependency | TypeScript compiler |

### New dependencies

None. This change introduces no new dependencies.

### Infrastructure prerequisites (not part of this ticket)

| Prerequisite | Purpose | Risk if missing |
|-------------|---------|-----------------|
| `RELEASE_TOKEN` GitHub secret | Used by auto-tag.yml for tag push authentication | Tag creation will fail silently or error |
| npm OIDC Trusted Publishing config | Used by publish.yml for provenance-signed publish | Publish step will fail with 404 or auth error |

## Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | `RELEASE_TOKEN` secret not configured or expired | Medium | Cannot verify without repo admin access. If missing, auto-tag.yml will fail — monitor GitHub Actions after merge. |
| 2 | npm OIDC trust not configured for this package | Medium | Cannot verify without npm admin access. If missing, publish.yml will fail at the publish step. |
| 3 | Version 1.3.3 was never published — 1.3.4 would be the first real publish | Low | The pipeline has validation steps (tarball check, version match) that will catch structural issues. |
| 4 | Lockfile inconsistency after direct edit | Low | The publish.yml workflow runs `npm ci` which validates lockfile integrity; any mismatch will fail the build. |

## Deferred to Round 2

Nothing is deferred. The change is complete in a single patch bump.

## Summary Table

| Aspect | Decision |
|--------|----------|
| **Change scope** | `package.json` + `package-lock.json` only |
| **Version** | 1.3.3 → 1.3.4 (patch) |
| **Source code changes** | None |
| **Workflow changes** | None |
| **New dependencies** | None |
| **Pipeline** | Existing auto-tag + publish, no modifications |
| **Risk level** | Low — metadata-only change with existing CI validation |

## APL Statement Reference

The technical direction is a minimal metadata-only change: bump the version field from `1.3.3` to `1.3.4` in `package.json` and `package-lock.json` (2 locations). No source code, workflow, or configuration changes are needed. The existing two-stage pipeline (auto-tag + publish) is fully parameterized and will handle the new version automatically. The runtime version reader in `src/update/version.ts` reads dynamically from `package.json`, so no code paths are affected by the bump.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement | Bump version to trigger auto-deploy to NPMJS |
| `scout/reference-map.json` | File-level evidence and facts | Version in exactly 2 files; two-stage pipeline; previous ticket created v1.3.3 tag |
| `scout/scout-summary.md` | Scout analysis summary | Confirmed version source of truth, pipeline mechanics, no hardcoded version in source |
| `diagnosis/apl.json` | Structured root cause analysis | v1.3.3 tag already exists; pipeline is correct; patch bump is minimal fix |
| `diagnosis/diagnosis-statement.md` | Root cause statement and success criteria | Confirmed patch bump 1.3.3→1.3.4; only package.json and package-lock.json need changes |
| `product/product.md` | Product specification and constraints | MVP is version bump only; workflows out of scope; no functional changes |
| `repo-guidance.json` | Repo intent classification | helix-cli is the sole target repo |
| `package.json` (direct) | Verified current version and structure | Version 1.3.3 at line 3; publishConfig with provenance; no runtime deps |
| `package-lock.json` (direct) | Verified lockfile version locations | Version at lines 3 and 9; lockfileVersion 3 |
| `.github/workflows/auto-tag.yml` (direct) | Verified pipeline stage 1 mechanics | Reads version via jq; checks tag via git ls-remote; creates tag if absent |
| `.github/workflows/publish.yml` (direct) | Verified pipeline stage 2 mechanics | Validates tag/version match; validates tarball; publishes with provenance |
| `src/update/version.ts` (direct) | Verified runtime version reader | Reads from ../../package.json dynamically; no hardcoded version |

# Tech Research — BLD-435: Bump helix-cli package version to 1.3.3

## Technology Foundation

- **Runtime:** Node.js >= 18 (ESM, `"type": "module"`)
- **Language:** TypeScript 6.x (`tsc` for build and typecheck)
- **Package manager:** npm with lockfileVersion 3
- **Package:** `@projectxinnovation/helix-cli` published to npm with provenance
- **CI/CD:** GitHub Actions publish workflow triggered by `v*` tag push

No new technologies or dependencies are introduced by this change.

## Architecture Decision

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: `npm version` command** | Run `npm version 1.3.3 --no-git-tag-version` | Atomic update of both files; idiomatic npm workflow; guarantees lockfile format consistency | Requires npm to be available in the environment |
| **B: Direct text edits** | Manually edit `package.json` line 3 and `package-lock.json` lines 3, 9 | No npm execution needed; fully deterministic | Risk of lockfile format inconsistency if edits are imprecise; two files must be edited separately |

### Chosen Option: A — `npm version` command

**Rationale:** `npm version 1.3.3 --no-git-tag-version` is the idiomatic method for version bumps. It atomically updates both `package.json` and `package-lock.json` in a single operation, eliminating the risk of the two files falling out of sync. The `--no-git-tag-version` flag prevents npm from creating a git tag or commit, which is appropriate since git operations are managed externally.

**Fallback:** If `npm version` is unavailable or impractical in the implementation environment, direct edits to both files are acceptable. The edits are trivial string replacements (`"1.3.2"` → `"1.3.3"`) at known line positions.

## Core API/Methods

Not applicable — this is a metadata-only change with no API or method modifications.

The CLI's runtime version reader (`src/update/version.ts:getPackageVersion()`) reads from `package.json` dynamically and will automatically reflect `1.3.3` after the bump.

## Technical Decisions

### 1. No lockfile regeneration needed

**Decision:** Do not run `npm install` or `npm ci` to regenerate the lockfile.

**Rationale:** The version field in `package-lock.json` is a plain string with no integrity hash dependency. No dependencies are being added, removed, or updated. A full lockfile regeneration would produce unnecessary diff noise and risk picking up transitive dependency updates unrelated to this ticket.

**Rejected alternative:** Running `npm install` after editing `package.json` — this would regenerate the entire lockfile and could introduce unrelated dependency resolution changes.

### 2. No source code changes

**Decision:** Touch only `package.json` and `package-lock.json`.

**Rationale:** The version string `1.3.2` does not appear in any `.ts` source file (confirmed by repo-wide grep in diagnosis). The runtime version reader (`src/update/version.ts`) reads from `package.json` dynamically. The `skill-content/` documentation references `--version` as a CLI flag but does not embed a specific version number.

**Rejected alternative:** Updating a hardcoded version constant in source — no such constant exists.

### 3. No release metadata files to update

**Decision:** Do not create CHANGELOG, README, or release notes.

**Rationale:** No such files exist in the repo (confirmed by glob in scout phase). The ticket explicitly scopes out creating new release metadata. If the team introduces these conventions later, future version bumps will address them.

**Rejected alternative:** Creating a CHANGELOG entry for 1.3.3 — explicitly out of scope per ticket constraints.

### 4. No workflow changes

**Decision:** Do not modify `.github/workflows/publish.yml`.

**Rationale:** The workflow reads the version dynamically from `package.json` via `node -p "require('./package.json').version"` (lines 32-38). It compares this to the tag version at runtime. No changes are needed for it to work with version `1.3.3`.

## Cross-Platform Considerations

Not applicable — the version bump is a JSON metadata change that is platform-independent.

## Performance Expectations

No performance impact. The change modifies only package metadata. Build time, runtime performance, and bundle size are unaffected.

## Dependencies

No new dependencies are introduced. Existing dependencies remain unchanged:
- `@types/node` ^25.5.0 (devDependency)
- `typescript` ^6.0.2 (devDependency)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lockfile format corruption from manual edits | Low | Medium | Use `npm version` command instead of manual edits |
| Build/typecheck failure after bump | Very Low | Medium | Run `npm run typecheck` and `npm run build` as validation |
| Downstream consumers pinned to 1.3.2 | Low | Low | Out of scope; this is a new patch version, not a breaking change |

## Deferred to Round 2

Nothing deferred — this change is self-contained and complete.

## Summary Table

| Aspect | Decision |
|--------|----------|
| **Files changed** | `package.json`, `package-lock.json` |
| **Version target** | `1.3.3` (exact, non-negotiable) |
| **Update method** | `npm version 1.3.3 --no-git-tag-version` (preferred) or direct edits (fallback) |
| **Source code changes** | None |
| **Workflow changes** | None |
| **New dependencies** | None |
| **Release metadata** | None (no CHANGELOG/README exists) |
| **Validation** | `npm run typecheck`, `npm run build` |
| **Risk level** | Minimal — metadata-only change |

## APL Statement Reference

The version bump from 1.3.2 to 1.3.3 is a two-file metadata change with no architectural risk. The preferred approach is `npm version 1.3.3 --no-git-tag-version` which atomically updates both `package.json` and `package-lock.json`. No source code, workflow, or documentation changes are needed. Validation via `npm run typecheck` and `npm run build` confirms the bump does not break the build.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Ticket requirements, scope constraints, and acceptance criteria | Target version is exactly `1.3.3`; only version-related files should change; must typecheck and build. |
| `scout/scout-summary.md` | Scout's analysis of version references and file inventory | Version declared in exactly two files; no hardcoded version in source; no release metadata files exist. |
| `scout/reference-map.json` | Detailed file-level findings and repo unknowns | Confirmed `package.json` and `package-lock.json` are the only change targets; build scripts identified. |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and evidence summary | Change is self-contained to two files; publish workflow reads version dynamically; disconfirming grep verified no hidden references. |
| `diagnosis/apl.json` | Structured diagnosis conclusions | All diagnostic questions answered with evidence; no follow-ups remaining; scope confirmed. |
| `product/product.md` | Product requirements and success criteria | Version bump is preparatory for tag-triggered publish; minimal diff principle; both update methods noted as valid. |
| `repo-guidance.json` | Repo intent classification | `helix-cli` is the sole target repo; no cross-repo changes needed. |
| `package.json` (direct read) | Verify current version field | Line 3: `"version": "1.3.2"` confirmed. |
| `package-lock.json` (direct read) | Verify lockfile version fields | Lines 3 and 9: `"version": "1.3.2"` confirmed. |

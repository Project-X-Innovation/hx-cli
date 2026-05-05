# Tech Research — BLD-375: Publish helix-cli to npm with Trusted Publishing via GitHub OIDC

## Technology Foundation

- **Runtime**: Node.js >=18, ESM (`type: "module"`)
- **Language**: TypeScript 6.x compiled with `tsc` to `dist/` (ES2022, Node16 module resolution)
- **Package manager**: npm (lockfileVersion 3)
- **CI/CD**: GitHub Actions (new — no existing infrastructure)
- **Publish mechanism**: npm Trusted Publishing via OIDC (no long-lived tokens)
- **Runtime dependencies**: None (zero-dependency CLI; only devDependencies)

The repo is a self-contained TypeScript CLI (`@projectxinnovation/helix-cli`) with a `bin.hlx` → `dist/index.js` entrypoint. Build produces `dist/` from `src/`, dist is gitignored, and `files: ["dist"]` scopes the published package. The `prepare` script runs `npm run build` automatically after `npm ci`.

---

## Architecture Decision 1: Workflow Trigger Mechanism

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Tag push (`v*`) | Trigger on `git tag v1.3.0 && git push --tags` | Simple, well-documented for npm trusted publishing; npm docs use this pattern; version is controlled by package.json + tag | Requires coordination between package.json version and tag |
| B. GitHub Release (`release: published`) | Trigger on GitHub Release creation | UI-friendly for release operators; release notes built-in | Adds indirection; release notes not in scope |
| C. Manual dispatch (`workflow_dispatch`) | Trigger manually from Actions UI | Maximum control; no accidental publishes | Operator must remember to trigger; harder to automate |
| D. Tag push + manual dispatch | Both triggers available | Flexibility for both automated and manual flows | More complex `on:` block |

### Chosen: Option A — Tag push (`on: push: tags: ['v*']`)

**Rationale**: Tag-based triggering is the canonical pattern in npm's own trusted publishing documentation. It provides a clear, auditable release trigger: the version is encoded in the tag, and the workflow validates it matches `package.json`. The npm UI trusted publisher configuration only needs the workflow filename (`publish.yml`), and tag-based triggers are the simplest for that setup. No additional GitHub Release infrastructure is needed.

The workflow should validate that the tag version matches `package.json` version as a precondition. This prevents accidental mismatches.

---

## Architecture Decision 2: Pack Validation Approach

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Check working tree (`ls dist/`) | Verify dist/ files exist before publish | Simple | Does NOT validate the actual tarball — violates ticket requirement |
| B. `npm pack` + `tar -tzf` inspection | Create tarball, list contents, grep for required files | Validates the exact artifact being published; deterministic | Adds a step; tarball filename must be captured |
| C. `npm pack --json` + publish tarball | Pack with JSON output, inspect contents list from JSON, publish the tarball file | Most precise; JSON output includes file list without needing `tar`; publishes the exact validated artifact | Slightly more complex scripting |

### Chosen: Option B — `npm pack` + tarball inspection + publish tarball

**Rationale**: The ticket explicitly requires "inspect the artifact that would actually be published, not just the working tree." Option B creates the actual tarball, inspects its contents with `tar -tzf`, verifies required files are present, and then publishes that exact tarball via `npm publish <tarball>`. This fail-closed approach ensures the published artifact is identical to the validated one.

**Required files to validate in tarball**:
- `package/dist/index.js` (CLI entrypoint — non-negotiable)
- `package/package.json` (always included by npm, but verify)

The `package/` prefix is npm's standard tarball structure. The validation step should use `tar -tzf` and grep for these paths.

---

## Architecture Decision 3: Update Mechanism Migration Strategy

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. npm registry via `npm view` | Replace `git ls-remote` with `npm view @projectxinnovation/helix-cli version` | Uses existing npm CLI; no new deps; simple | Requires npm on PATH (already required for install) |
| B. npm registry HTTP API | Fetch `https://registry.npmjs.org/@projectxinnovation/helix-cli/latest` directly | No npm CLI dependency for check | Requires HTTP client code; more complex; npm is already required |
| C. Keep git check + add npm fallback | Try git first, fall back to npm | Backward compatible | Complexity; git check is the problem we're solving |

### Chosen: Option A — `npm view` for version checking

**Rationale**: The CLI already requires `npm` to be installed (it's installed via npm). Using `npm view <pkg> version` is the simplest way to query the registry for the latest version. It returns just the version string, requires no additional dependencies, and follows the same pattern as the current `git ls-remote` approach (exec a subprocess, parse output).

**Migration map** (per diagnosis findings):

| File | Current | Target |
|------|---------|--------|
| `src/update/check.ts` | `fetchRemoteSha()` via `git ls-remote` + SHA comparison | `fetchLatestVersion()` via `npm view` + semver comparison |
| `src/update/perform.ts` | `github:${CANONICAL_REPO}#${CANONICAL_BRANCH}` | `@projectxinnovation/helix-cli@latest` |
| `src/update/index.ts` | Compares SHAs; saves `mode: "github"` with `commit` | Compares versions; saves `mode: "npm"` with `version` |
| `src/lib/config.ts` | `mode: "github" \| "unknown"` | `mode: "github" \| "npm" \| "unknown"`; add `version?: string` |
| `src/index.ts` | Help text: "updates from GitHub main" | Help text: "updates from npm" |

**Canonical source check**: `isCanonicalSource()` in `src/update/index.ts` currently requires `mode === "github"`. It must be extended to also accept `mode === "npm"` so that auto-update works for npm-sourced installs. The check simplifies to: mode is either `"github"` (legacy) or `"npm"`.

**Transition path**: Existing users with `installSource.mode === "github"` will run `hlx update` and the new code will:
1. Check npm registry (not git)
2. Compare local `package.json` version against npm latest
3. Install from npm
4. Save `installSource` with `mode: "npm"` and `version`

After the first npm-based update, the user's config transitions from GitHub mode to npm mode permanently.

---

## Architecture Decision 4: Semver Comparison (no new dependency)

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Add `semver` npm package | Use the standard semver library | Full spec compliance; handles pre-release, ranges | Breaks zero-dependency design; overkill for this use case |
| B. Minimal numeric comparison | Split `x.y.z`, compare major/minor/patch numerically | No dependency; sufficient for simple versioning | Does not handle pre-release tags |
| C. String comparison | Simple `!==` check (any difference = update) | Simplest | Cannot tell if remote is newer vs older (downgrade risk) |

### Chosen: Option B — Minimal numeric semver comparison

**Rationale**: The project uses simple `major.minor.patch` versioning (currently `1.2.0`, no pre-release tags). A minimal function that splits on `.` and compares numerically is sufficient and preserves the zero-dependency design. If pre-release channels are needed later (see "Deferred to Round 2"), the `semver` package can be added then.

The comparison function should return whether the remote version is strictly newer than the local version, preventing accidental downgrades.

---

## Architecture Decision 5: Test File Exclusion from Published Tarball

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. `.npmignore` with test patterns | Add `.npmignore` excluding `dist/**/*.test.js` and `dist/**/*.test.d.ts` | No build changes; works with existing `files` field; minimal | Adds a new file; must be kept in sync if test patterns change |
| B. Separate `tsconfig.build.json` | Exclude `**/*.test.ts` from build output | Clean dist/ has no test files at all | Changes build process; test script relies on compiled test files in dist/ |
| C. Post-build cleanup script | Delete test files from dist/ after build, before pack | Works with any build config | Fragile; easy to forget; script maintenance |

### Chosen: Option A — `.npmignore` with test exclusion patterns

**Rationale**: The current test runner (`node --test dist/**/*.test.js`) requires test files to exist in `dist/`. A `.npmignore` file excludes test artifacts from the tarball without changing the build or test workflow. The `files: ["dist"]` field in `package.json` acts as the whitelist; `.npmignore` further excludes within that whitelist. This is the smallest correct change.

**.npmignore contents**:
```
dist/**/*.test.js
dist/**/*.test.d.ts
```

---

## Core API/Methods

### npm Trusted Publishing OIDC Flow (GitHub Actions)

Per npm documentation (verified via Context7):

1. **Permissions**: Workflow requires `id-token: write` (OIDC token generation) and `contents: read`.
2. **Setup**: `actions/setup-node` with `registry-url: 'https://registry.npmjs.org'` configures the npm registry.
3. **Authentication**: The npm CLI automatically detects the GitHub Actions OIDC environment and uses it for authentication. No `NODE_AUTH_TOKEN` or `NPM_TOKEN` is needed when trusted publishing is configured.
4. **Provenance**: `--provenance` flag (or `publishConfig.provenance: true`) attaches a signed provenance attestation to the published package. Requires the same `id-token: write` permission.
5. **Scoped packages**: First publish of a scoped package requires `--access public` (or `publishConfig.access: "public"` in `package.json`).

### npm Registry Version Check

```
npm view @projectxinnovation/helix-cli version
```
Returns the latest published version string (e.g., `1.2.0`). Fails with non-zero exit code if the package doesn't exist yet, which the update check should handle gracefully (return null / no update available).

### npm Install from Registry

```
npm install -g @projectxinnovation/helix-cli@latest
```
Replaces the current `npm install -g github:Project-X-Innovation/helix-cli#main`.

---

## Technical Decisions

### package.json Additions

Add the following fields to `package.json`:

1. **`repository`** (required for Trusted Publishing identity verification):
   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/Project-X-Innovation/helix-cli.git"
   }
   ```

2. **`publishConfig`** (sets provenance and public access as defaults):
   ```json
   "publishConfig": {
     "access": "public",
     "provenance": true,
     "registry": "https://registry.npmjs.org"
   }
   ```

These are additive changes that do not affect existing behavior.

### Workflow Structure

The publish workflow should be a single job (not multi-job) because:
- The build, test, validation, and publish steps are sequential and tightly coupled.
- A single job avoids artifact transfer overhead between jobs.
- The tarball validated in the pack step must be the exact file published.

**Workflow sequence**:
1. Checkout code
2. Setup Node.js with registry-url
3. `npm ci` (installs deps; `prepare` runs build)
4. `npm test` (runs full test suite)
5. Version tag match check (verify `v<tag>` matches `package.json` version)
6. `npm pack` (create tarball)
7. Validate tarball contents (check for `package/dist/index.js`)
8. `npm publish <tarball>.tgz --provenance` (publish the validated artifact)

### Rejected: `NODE_AUTH_TOKEN` / `NPM_TOKEN`

The ticket explicitly requires no long-lived npm tokens. npm Trusted Publishing with OIDC eliminates the need for stored secrets. The npm CLI auto-detects the OIDC environment in GitHub Actions.

### Rejected: Multi-job workflow with artifact handoff

A multi-job approach (build job → test job → publish job) would require uploading/downloading the tarball as a GitHub Actions artifact. This adds complexity without benefit for a simple single-package publish.

### Node Version in Workflow

Use Node.js 22 (current LTS). The project requires `>=18` per `engines`, and the devDependencies (`@types/node: ^25.5.0`, `typescript: ^6.0.2`) are compatible with Node 22. Node 18 is approaching EOL; Node 22 is the safe choice for CI.

---

## Cross-Platform Considerations

- **Workflow runs on `ubuntu-latest`** (GitHub-hosted runner) per ticket requirement. No cross-platform CI needed for the publish workflow.
- **Update mechanism**: The migrated `npm view` and `npm install -g` commands work identically on Linux, macOS, and Windows. The current `git ls-remote` approach requires git on PATH, which is problematic on some Windows environments. The npm-based approach is an improvement since npm is guaranteed to be available (the CLI is installed via npm).
- **`version.ts` path resolution**: Uses `import.meta.url` and `path.join()` — works correctly across platforms. Already verified to resolve `../../package.json` from `dist/update/version.js` correctly whether installed from GitHub or npm.

---

## Performance Expectations

- **Publish workflow**: Expected to complete in 1-3 minutes (install deps, build, test, pack, publish). No heavy dependencies or long-running processes.
- **Update check (`npm view`)**: Single npm CLI subprocess, typically completes in 1-3 seconds. Comparable to the current `git ls-remote` approach. The 10-second timeout from the current implementation is appropriate to carry forward.
- **No runtime performance impact**: These changes affect CI/CD infrastructure and the update subsystem only. Core CLI command performance is unchanged.

---

## Dependencies

### New External Dependencies

**None.** The zero-runtime-dependency design is preserved. No new npm packages are added.

### GitHub Actions Dependencies

| Action | Version | Purpose |
|--------|---------|---------|
| `actions/checkout` | v4 | Checkout repository code |
| `actions/setup-node` | v4 | Setup Node.js with npm registry-url for OIDC |

### npm UI Configuration (outside code scope)

npm Trusted Publishing requires a one-time UI-side configuration on npmjs.com:
- Navigate to the package settings → Trusted Publishers
- Add GitHub as a trusted publisher
- Specify: owner=`Project-X-Innovation`, repo=`helix-cli`, workflow=`publish.yml`
- This is a prerequisite that must be completed before the first publish

### Prerequisite Unknowns

| Unknown | Risk | Mitigation |
|---------|------|------------|
| Whether `@projectxinnovation` npm scope exists and is org-controlled | Blocks publishing entirely | Must verify/create before first publish; outside code scope |
| Whether `@projectxinnovation/helix-cli` has ever been published (version conflict) | Version 1.2.0 publish could fail | Check npm registry; bump version if needed |
| npm Trusted Publisher UI configuration status | First publish will fail without it | Document the setup steps clearly in the workflow file |

---

## Deferred to Round 2

- **Automated changelog generation**: Release notes and changelogs are out of scope for this ticket.
- **PR-level CI checks**: A test/lint workflow for pull requests would be valuable but is not part of the publish scope.
- **Pre-release/canary channels**: Publishing beta or canary versions requires additional workflow logic and is not needed for the initial publish flow.
- **Automated version bumping**: Version management is manual (edit `package.json`, tag, push). Automation can be added later.
- **Migration prompts for GitHub-sourced users**: The transition is silent (first `hlx update` switches to npm mode). A one-time migration notice could improve UX but is not essential.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| npm scope `@projectxinnovation` not configured | Medium | Blocks all publishing | Verify scope ownership before merging; document in workflow |
| First publish requires `--access public` for scoped package | High (first time only) | Publish fails without it | Set `publishConfig.access: "public"` in `package.json` |
| `npm view` fails for unpublished package (first update check) | High (first time only) | Update check shows error for users before first publish | Handle non-zero exit gracefully (return null, "no update available") |
| Tag version / package.json version mismatch | Medium | Publish proceeds with wrong version | Add version-match validation step in workflow |
| `prepare` script runs during `npm ci`, adding build time | Low | Negligible — build is fast (~2s) | Acceptable; no mitigation needed |

---

## Summary Table

| Area | Decision | Key Files |
|------|----------|-----------|
| Workflow trigger | Tag push `v*` | `.github/workflows/publish.yml` (new) |
| OIDC auth | `id-token: write`, no NPM_TOKEN | `.github/workflows/publish.yml` |
| Pack validation | `npm pack` → `tar -tzf` → check `dist/index.js` → publish tarball | `.github/workflows/publish.yml` |
| Package metadata | Add `repository` + `publishConfig` | `package.json` |
| Test exclusion | `.npmignore` with test patterns | `.npmignore` (new) |
| Version check | `npm view <pkg> version` | `src/update/check.ts` |
| Install command | `npm install -g @projectxinnovation/helix-cli@latest` | `src/update/perform.ts` |
| Semver comparison | Minimal numeric `x.y.z` comparison (no dependency) | `src/update/check.ts` |
| Config type | Add `"npm"` to `InstallSource.mode`, add `version` field | `src/lib/config.ts` |
| Canonical source | Accept both `"github"` and `"npm"` modes | `src/update/index.ts` |
| Help text | Update to reference npm | `src/index.ts` |
| Node version (CI) | Node 22 (current LTS) | `.github/workflows/publish.yml` |
| Provenance | `publishConfig.provenance: true` | `package.json` |

---

## APL Statement Reference

See `tech-research/apl.json` for the full question-answer-evidence chain supporting these decisions. The APL is complete with `followups: []`.

---

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements, acceptance criteria, constraints | OIDC publish, pack validation, no NPM_TOKEN, fail-closed behavior, update path migration |
| `scout/reference-map.json` | File inventory with evidence and unknowns | Confirmed all gap areas; identified 77-file tarball with test artifacts; version 1.2.0 |
| `scout/scout-summary.md` | Narrative codebase analysis | Confirmed no CI/CD exists; validated boundary file list; identified reusable validation pattern |
| `diagnosis/apl.json` | Structured Q&A with evidence chains | Confirmed OIDC requirements, version.ts compatibility, update migration scope, test file inclusion |
| `diagnosis/diagnosis-statement.md` | Root cause analysis of four gaps | Mapped each gap (metadata, workflow, update, tarball) to specific files and lines; provided fix direction |
| `product/product.md` | Product vision, use cases, success criteria | Confirmed MVP scope, fail-closed principle, minimal published surface, open questions on scope/trigger |
| `repo-guidance.json` | Repo intent classification | Confirmed helix-cli is sole target repo; no cross-repo impact |
| `package.json` (direct read) | Current package configuration | Missing `repository`, no `publishConfig`; `files: ["dist"]`; `bin.hlx`; version 1.2.0; `prepare` builds |
| `src/update/check.ts` (direct read) | Current version-check implementation | `fetchRemoteSha()` uses `git ls-remote`; defines canonical repo constants |
| `src/update/perform.ts` (direct read) | Current install implementation | `github:${CANONICAL_REPO}#${CANONICAL_BRANCH}` install spec |
| `src/update/index.ts` (direct read) | Update orchestration logic | SHA comparison; `mode: "github"` metadata; `isCanonicalSource()` gating auto-update |
| `src/update/validate.ts` (direct read) | Post-install validation pattern | Checks `dist/index.js` existence + version smoke test; reusable for workflow |
| `src/update/version.ts` (direct read) | Runtime version reading | `../../package.json` relative path works from npm install |
| `src/lib/config.ts` (direct read) | InstallSource type and config persistence | `mode: "github" \| "unknown"`; `saveConfig()` is read-merge-write |
| `src/index.ts` (direct read) | CLI entrypoint and help text | Line 52 references "GitHub main"; `checkAutoUpdate()` called before dispatch |
| `tsconfig.json` (direct read) | Build configuration | Compiles all `src/` to `dist/`; no test exclusion mechanism |
| npm Trusted Publishing docs (Context7) | OIDC workflow requirements | `id-token: write`; `setup-node` with `registry-url`; no `NODE_AUTH_TOKEN` needed; `--provenance` for attestation |

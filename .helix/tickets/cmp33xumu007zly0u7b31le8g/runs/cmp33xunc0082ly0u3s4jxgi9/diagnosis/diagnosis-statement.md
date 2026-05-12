# Diagnosis Statement — BLD-435: Bump helix-cli package version to 1.3.3

## Problem Summary

The `@projectxinnovation/helix-cli` package currently declares version `1.3.2` in `package.json` and `package-lock.json`. The repo's GitHub Actions publish workflow triggers on `v*` tag pushes and validates that the tag version matches `package.json` version. To enable a `v1.3.3` tag-triggered npm publish, the version must be bumped to `1.3.3` in both files.

## Root Cause Analysis

This is not a bug fix — it is a planned version bump for the next patch release. The "root cause" is simply that the version field has not yet been incremented to the target `1.3.3`.

**Scope of change:** Exactly two files require modification:

1. **`package.json` line 3** — change `"version": "1.3.2"` to `"version": "1.3.3"`.
2. **`package-lock.json` lines 3 and 9** — change `"version": "1.3.2"` to `"version": "1.3.3"` in both locations.

**No other files need changes** because:
- The publish workflow (`.github/workflows/publish.yml`) reads the version dynamically from `package.json` at build time (lines 32-38).
- The CLI runtime reads its version dynamically from `package.json` via `src/update/version.ts:getPackageVersion()`.
- No CHANGELOG, README, or other release metadata files exist in the repo.
- No hardcoded version string `1.3.2` appears in any `.ts` source file.
- The `skill-content/` documentation references `--version` as a CLI flag but does not embed a specific version number.

**Disconfirming check:** A repo-wide grep for `1.3.2` confirmed the string only appears in `package.json`, `package-lock.json`, and `.helix/` ticket artifacts (which are not part of the publishable codebase).

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| Current version | `package.json` line 3 | `"version": "1.3.2"` |
| Lockfile version | `package-lock.json` lines 3, 9 | `"version": "1.3.2"` in both locations |
| Publish workflow validation | `.github/workflows/publish.yml` lines 30-38 | Dynamically reads `package.json` version; compares to tag; no changes needed |
| Runtime version reader | `src/update/version.ts` lines 10-19 | Reads from `package.json` at runtime; no hardcoded version |
| Repo-wide version grep | `grep 1.3.2` across repo | Only in `package.json`, `package-lock.json`, and `.helix/` artifacts |
| CHANGELOG/README existence | Glob for `**/CHANGELOG*`, `**/README*` | No files found |
| Build/test scripts | `package.json` lines 15-19 | `build: tsc`, `typecheck: tsc --noEmit`, `test: tsc && node --test dist/**/*.test.js` |

## Success Criteria

1. `package.json` shows `"version": "1.3.3"`.
2. `package-lock.json` shows `"version": "1.3.3"` in both locations (lines 3 and 9).
3. No other source files are modified.
4. `npm run typecheck` passes after the bump.
5. `npm run build` passes after the bump.
6. The repo is ready for a `v1.3.3` Git tag to trigger the existing publish workflow.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Ticket requirements and acceptance criteria | Target version is exactly `1.3.3`; only version-related files should change; must typecheck and build. |
| `scout/reference-map.json` | Scout's file-level analysis of version references | Confirmed two files need changes; no hardcoded version in source; no release metadata files exist. |
| `scout/scout-summary.md` | Scout's analysis summary | Validated file list, build scripts, and version validation logic in publish workflow. |
| `package.json` (direct read) | Verify current version and scripts | Version is `1.3.2` on line 3; build/test scripts confirmed. |
| `package-lock.json` (direct read) | Verify lockfile version references | Version `1.3.2` on lines 3 and 9. |
| `.github/workflows/publish.yml` (direct read) | Understand publish workflow version validation | Strips `v` prefix from tag, compares to `package.json` version dynamically. |
| `src/update/version.ts` (direct read) | Check for hardcoded version in runtime code | Version read dynamically via `getPackageVersion()`; no hardcoded string. |
| Repo-wide grep for `1.3.2` | Disconfirming check for hidden version references | No version references outside `package.json`, `package-lock.json`, and `.helix/` artifacts. |

# Scout Summary — BLD-435: Bump helix-cli package version to 1.3.3

## Problem

The `helix-cli` package (`@projectxinnovation/helix-cli`) currently declares version `1.3.2` in `package.json` and `package-lock.json`. The repo's GitHub Actions publish workflow (`.github/workflows/publish.yml`) triggers on `v*` tag pushes and validates that the tag version matches `package.json` version. To prepare for the next npm release under tag `v1.3.3`, the version in `package.json` (and its lockfile counterpart) must be bumped to `1.3.3`.

## Analysis Summary

**Version is declared in exactly two files:**
- `package.json` line 3: `"version": "1.3.2"`
- `package-lock.json` lines 3 and 9: `"version": "1.3.2"`

**No other files contain a hardcoded version string.** The CLI reads its version dynamically from `package.json` at runtime via `src/update/version.ts` using `getPackageVersion()`. The `skill-content/` documentation references `--version` as a command but does not embed a specific version number.

**No release metadata files exist.** There is no CHANGELOG, README, or release notes file in the repo. No additional metadata synchronization is required.

**Publish workflow validates version coherence.** The workflow at `.github/workflows/publish.yml` (lines 30-38) strips the `v` prefix from the Git tag and compares it to `package.json` version. A mismatch causes the workflow to fail. This confirms the version bump is the only prerequisite for a `v1.3.3` tag-triggered publish.

**Quality gates available for validation:**
- `npm run typecheck` → `tsc --noEmit`
- `npm run build` → `tsc`
- `npm test` → `tsc && node --test dist/**/*.test.js`

## Relevant Files

| File | Relevance |
|------|-----------|
| `package.json` | Primary version declaration (line 3). Must change from `1.3.2` to `1.3.3`. |
| `package-lock.json` | Lockfile version (lines 3, 9). Must stay in sync with `package.json`. |
| `.github/workflows/publish.yml` | Publish workflow — validates tag/version match. Read-only context; no changes needed. |
| `src/update/version.ts` | Runtime version reader — reads from `package.json` dynamically. No changes needed. |
| `tsconfig.json` | TypeScript build config. Needed for build/typecheck validation. No changes needed. |
| `.npmignore` | Tarball exclusion rules. No version reference. No changes needed. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Ticket requirements and acceptance criteria | Version must be exactly `1.3.3`; only version-related files should change; repo must still typecheck and build. |
| `package.json` | Direct inspection of current version and scripts | Version is `1.3.2`; build/test scripts use `tsc`; package name is `@projectxinnovation/helix-cli`. |
| `package-lock.json` | Check for version references in lockfile | Version `1.3.2` appears on lines 3 and 9; must be updated in sync. |
| `.github/workflows/publish.yml` | Understand publish workflow and version validation | Workflow validates tag version matches `package.json` version before publishing. |
| `src/update/version.ts` | Check for hardcoded version in source | Version is read dynamically from `package.json` at runtime; no hardcoded value. |
| `src/**/*.ts` (grep) | Search for any hardcoded `1.3.2` references | No hardcoded version string found in any source file. |
| `skill-content/` (grep) | Check for version references in bundled docs | References `--version` command but no hardcoded version number. |

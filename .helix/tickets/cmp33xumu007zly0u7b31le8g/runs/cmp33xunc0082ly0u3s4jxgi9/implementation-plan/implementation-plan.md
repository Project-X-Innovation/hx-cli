# Implementation Plan — BLD-435: Bump helix-cli package version to 1.3.3

## Overview

Bump the `@projectxinnovation/helix-cli` package version from `1.3.2` to `1.3.3` in `package.json` and `package-lock.json`. This is a metadata-only change with no source code, workflow, or documentation modifications. The preferred method is `npm version 1.3.3 --no-git-tag-version`, which atomically updates both files.

## Implementation Principles

- **Minimal diff**: Only `package.json` and `package-lock.json` are modified.
- **Atomic update**: Use `npm version` to update both files in a single operation.
- **No side effects**: No source code, workflow, or documentation changes.
- **Validate after change**: Run typecheck and build to confirm the bump does not break anything.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Install dependencies | `node_modules/` populated, ready for build |
| 2 | Bump version to 1.3.3 | `package.json` and `package-lock.json` updated |
| 3 | Validate typecheck | `npm run typecheck` passes |
| 4 | Validate build | `npm run build` passes |

## Detailed Implementation Steps

### Step 1: Install dependencies

**Goal:** Ensure the repo has all dependencies installed so that typecheck and build can run.

**What to Build:**
- Run `npm ci` in the `helix-cli` repo root to install dependencies from the lockfile.

**Verification (AI Agent Runs):**
- Run `npm ci` and confirm it exits with code 0.
- Confirm `node_modules/` directory exists.

**Success Criteria:**
- Dependencies installed without errors.

---

### Step 2: Bump version to 1.3.3

**Goal:** Update the version field in both `package.json` and `package-lock.json` from `1.3.2` to `1.3.3`.

**What to Build:**
- Run `npm version 1.3.3 --no-git-tag-version` in the `helix-cli` repo root.
- This atomically updates:
  - `package.json` line 3: `"version": "1.3.2"` → `"version": "1.3.3"`
  - `package-lock.json` lines 3 and 9: `"version": "1.3.2"` → `"version": "1.3.3"`
- The `--no-git-tag-version` flag prevents npm from creating a git tag or commit.
- **Fallback:** If `npm version` fails for any reason, directly edit both files to replace `"1.3.2"` with `"1.3.3"` at the known positions.

**Verification (AI Agent Runs):**
- Run `node -p "require('./package.json').version"` and confirm output is `1.3.3`.
- Read `package-lock.json` lines 1-10 and confirm version is `1.3.3` on lines 3 and 9.
- Confirm no other files were modified (only `package.json` and `package-lock.json` should differ from the base branch).

**Success Criteria:**
- `package.json` version is `1.3.3`.
- `package-lock.json` version is `1.3.3` in both locations.
- No unrelated files were changed.

---

### Step 3: Validate typecheck

**Goal:** Confirm the repo still typechecks after the version bump.

**What to Build:**
- Run `npm run typecheck` (which executes `tsc --noEmit`).

**Verification (AI Agent Runs):**
- Run `npm run typecheck` and confirm it exits with code 0.

**Success Criteria:**
- Typecheck passes with no errors.

---

### Step 4: Validate build

**Goal:** Confirm the repo still builds after the version bump.

**What to Build:**
- Run `npm run build` (which executes `tsc`).

**Verification (AI Agent Runs):**
- Run `npm run build` and confirm it exits with code 0.
- Confirm `dist/` directory is populated.

**Success Criteria:**
- Build passes with no errors.
- `dist/` output is generated.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|-----------------|----------------|
| Node.js >= 18 | available | `package.json` engines field requires `>=18`; sandbox environment provides Node.js | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| npm | available | Required for `npm ci`, `npm version`, `npm run` commands; included with Node.js | CHK-01, CHK-02, CHK-03, CHK-04, CHK-05 |
| Network access for npm ci | available | Required to fetch dependencies from npm registry | CHK-01 |

### Required Checks

**[CHK-01] Verify `package.json` version is 1.3.3**
- Action: Run `node -p "require('./package.json').version"` in the helix-cli repo root.
- Expected Outcome: Output is exactly `1.3.3`.
- Required Evidence: Command output showing `1.3.3`.

**[CHK-02] Verify `package-lock.json` version is 1.3.3 in both locations**
- Action: Read `package-lock.json` lines 1-12 and inspect the `"version"` fields on lines 3 and 9.
- Expected Outcome: Both lines show `"version": "1.3.3"`.
- Required Evidence: File content excerpt showing `"version": "1.3.3"` on lines 3 and 9.

**[CHK-03] Verify no unrelated files were changed**
- Action: Inspect the diff of all changed files relative to the base branch.
- Expected Outcome: Only `package.json` and `package-lock.json` appear as modified. No source files (`.ts`), workflow files, or documentation files are changed.
- Required Evidence: Diff output or file listing showing exactly two modified files: `package.json` and `package-lock.json`.

**[CHK-04] Typecheck passes**
- Action: Run `npm run typecheck` in the helix-cli repo root.
- Expected Outcome: Command exits with code 0 and produces no type errors.
- Required Evidence: Command output and exit code confirming successful typecheck.

**[CHK-05] Build passes**
- Action: Run `npm run build` in the helix-cli repo root.
- Expected Outcome: Command exits with code 0 and `dist/` directory is populated.
- Required Evidence: Command output and exit code confirming successful build, plus `ls dist/` showing output files.

## Success Metrics

1. `package.json` declares `"version": "1.3.3"`.
2. `package-lock.json` declares `"version": "1.3.3"` in both locations.
3. No source files outside `package.json` and `package-lock.json` are modified.
4. `npm run typecheck` passes.
5. `npm run build` passes.
6. The repo is ready for a `v1.3.3` Git tag to trigger the existing publish workflow.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Ticket requirements, acceptance criteria, and constraints | Target version is exactly `1.3.3`; only version-related files should change; must typecheck and build. |
| `scout/scout-summary.md` | Scout's analysis of version references and build scripts | Version in exactly two files; no hardcoded version in source; build scripts: `tsc`, `tsc --noEmit`. |
| `scout/reference-map.json` | Detailed file-level findings | Confirmed `package.json` and `package-lock.json` are the only change targets; no release metadata files exist. |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and evidence summary | Change is self-contained to two files; publish workflow reads version dynamically; no hidden references. |
| `diagnosis/apl.json` | Structured diagnosis conclusions | All diagnostic questions answered; no follow-ups remaining. |
| `product/product.md` | Product requirements and success criteria | Minimal diff principle; `npm version` vs direct edits both valid; no CHANGELOG needed. |
| `tech-research/tech-research.md` | Technology decisions and method selection | `npm version 1.3.3 --no-git-tag-version` chosen as preferred approach; no lockfile regeneration needed. |
| `tech-research/apl.json` | Structured tech research conclusions | Preferred approach confirmed; fallback to direct edits acceptable. |
| `repo-guidance.json` | Repo intent classification | `helix-cli` is the sole target repo; no cross-repo changes needed. |
| `package.json` (direct read) | Verify current version | Line 3: `"version": "1.3.2"` confirmed. |
| `package-lock.json` (direct read) | Verify lockfile version | Lines 3 and 9: `"version": "1.3.2"` confirmed. |

# Implementation Plan — BLD-501

## Overview

Bump the `@projectxinnovation/helix-cli` package version from `1.3.3` to `1.3.4` in `package.json` and `package-lock.json` so that, on merge to `main`, the existing two-stage GitHub Actions pipeline (`auto-tag.yml` → `publish.yml`) creates a new `v1.3.4` tag and publishes the package to npm.

The change is metadata-only: two files, three string replacements, zero source code or workflow modifications.

## Implementation Principles

- **Minimal change**: Touch only `package.json` and `package-lock.json`. No source code, workflow, or config changes.
- **Direct edit**: Replace the version string directly in both files rather than running `npm version` (avoids unwanted side effects like git tags or lockfile churn).
- **Lockfile consistency**: Both version locations in `package-lock.json` (root level and `packages[""]`) must match `package.json`.
- **Preserve pipeline**: The `auto-tag.yml` and `publish.yml` workflows are correctly configured and must not be modified.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Bump version in `package.json` | `package.json` with `"version": "1.3.4"` |
| 2 | Bump version in `package-lock.json` | `package-lock.json` with `"version": "1.3.4"` in both locations |
| 3 | Run quality gates | Passing typecheck and test output |

## Detailed Implementation Steps

### Step 1: Bump version in `package.json`

**Goal**: Update the version field from `1.3.3` to `1.3.4`.

**What to Build**:
- Edit `package.json` line 3: change `"version": "1.3.3"` to `"version": "1.3.4"`.
- No other fields or lines should change.

**Verification (AI Agent Runs)**:
```bash
# Confirm version field is 1.3.4
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); if(p.version !== '1.3.4') { console.error('FAIL: version is ' + p.version); process.exit(1); } console.log('OK: version is 1.3.4');"
```

**Success Criteria**:
- `package.json` contains `"version": "1.3.4"` and no other lines are changed.

---

### Step 2: Bump version in `package-lock.json`

**Goal**: Update the version field in both locations to `1.3.4`.

**What to Build**:
- Edit `package-lock.json` line 3: change `"version": "1.3.3"` to `"version": "1.3.4"` (root-level version).
- Edit `package-lock.json` line 9: change `"version": "1.3.3"` to `"version": "1.3.4"` (inside `packages[""]`).
- No other fields or lines should change.

**Verification (AI Agent Runs)**:
```bash
# Confirm both locations are 1.3.4
node -e "
const lock = JSON.parse(require('fs').readFileSync('package-lock.json','utf8'));
const rootV = lock.version;
const pkgV = lock.packages[''].version;
if(rootV !== '1.3.4') { console.error('FAIL: root version is ' + rootV); process.exit(1); }
if(pkgV !== '1.3.4') { console.error('FAIL: packages version is ' + pkgV); process.exit(1); }
console.log('OK: both lockfile versions are 1.3.4');
"
```

**Success Criteria**:
- `package-lock.json` root `"version"` is `"1.3.4"`.
- `package-lock.json` `packages[""].version` is `"1.3.4"`.
- No other lines are changed.

---

### Step 3: Run quality gates

**Goal**: Confirm the version bump does not break typecheck or tests.

**What to Build**:
- Nothing to build — this is a verification-only step.

**Verification (AI Agent Runs)**:
```bash
# Typecheck
npx tsc --noEmit

# Build + test
npm test
```

**Success Criteria**:
- `tsc --noEmit` exits with code 0.
- `npm test` (which runs `tsc && node --test dist/**/*.test.js`) exits with code 0.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 available in environment | available | `package.json` engines field; dev setup provides npm environment | CHK-01, CHK-02, CHK-03, CHK-04 |
| TypeScript compiler (`tsc`) available via devDependencies | available | `typescript` ^6.0.2 in devDependencies; `npm install` installs it | CHK-03, CHK-04 |
| `npm install` has been run to install devDependencies | available | Standard dev setup; implementation agent runs `npm install` before quality gates | CHK-03, CHK-04 |

### Required Checks

**[CHK-01] Verify `package.json` version is `1.3.4`**
- Action: Read `package.json` and parse the `version` field.
- Expected Outcome: The `version` field is exactly `"1.3.4"`.
- Required Evidence: Output of `node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)"` showing `1.3.4`.

**[CHK-02] Verify `package-lock.json` version is `1.3.4` in both locations**
- Action: Read `package-lock.json` and parse the root `version` field and the `packages[""].version` field.
- Expected Outcome: Both fields are exactly `"1.3.4"`.
- Required Evidence: Output of `node -e "const l=JSON.parse(require('fs').readFileSync('package-lock.json','utf8'));console.log('root:',l.version,'pkg:',l.packages[''].version)"` showing `root: 1.3.4 pkg: 1.3.4`.

**[CHK-03] Typecheck passes**
- Action: Run `npx tsc --noEmit` from the repository root.
- Expected Outcome: Command exits with code 0 and produces no type errors.
- Required Evidence: Command output and exit code 0.

**[CHK-04] Tests pass**
- Action: Run `npm test` from the repository root (which executes `tsc && node --test dist/**/*.test.js`).
- Expected Outcome: Command exits with code 0, all tests pass.
- Required Evidence: Command output showing test results and exit code 0.

**[CHK-05] No unintended file changes**
- Action: Run `git diff --stat` to inspect the full set of changed files.
- Expected Outcome: Only `package.json` and `package-lock.json` appear in the diff. No other files are modified, added, or deleted.
- Required Evidence: Output of `git diff --stat` showing exactly two files changed.

**[CHK-06] No stale version references remain**
- Action: Run `grep -r "1\.3\.3" --include="*.json" .` from the repository root (excluding `node_modules`).
- Expected Outcome: No matches are returned (the old version `1.3.3` does not appear in any JSON file in the repo).
- Required Evidence: Command output showing zero matches (empty output or explicit "no matches" message).

## Success Metrics

| Metric | Target |
|--------|--------|
| Files changed | Exactly 2 (`package.json`, `package-lock.json`) |
| Version in `package.json` | `1.3.4` |
| Version in `package-lock.json` (both locations) | `1.3.4` |
| Typecheck (`tsc --noEmit`) | Passes (exit 0) |
| Tests (`npm test`) | Pass (exit 0) |
| Source code changes | None |
| Workflow changes | None |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement | Bump CLI version to trigger auto-deploy to NPMJS |
| `scout/scout-summary.md` | Codebase and pipeline analysis | Version in 2 files only; two-stage pipeline; no hardcoded version in source |
| `scout/reference-map.json` | Structured file-level evidence | Exact line numbers for version locations; pipeline flow; prior ticket created v1.3.3 tag |
| `diagnosis/diagnosis-statement.md` | Root cause and success criteria | v1.3.3 tag exists; patch bump to 1.3.4 is the fix; pipeline is correct |
| `diagnosis/apl.json` | Structured diagnosis with evidence | Confirmed pipeline correctness; version bump is the only needed change |
| `product/product.md` | Product spec and constraints | MVP is version bump only; workflows out of scope; no functional changes |
| `tech-research/tech-research.md` | Technical approach decision | Direct file edit chosen over npm version command; patch bump rationale |
| `tech-research/apl.json` | Technical answers with evidence | Confirmed no version-dependent code paths; no pipeline changes needed |
| `repo-guidance.json` | Repo intent classification | helix-cli is the sole target repo |
| `package.json` (direct) | Verified current version | Version `1.3.3` at line 3 confirmed |
| `package-lock.json` (direct) | Verified lockfile version locations | Version at lines 3 and 9 confirmed |

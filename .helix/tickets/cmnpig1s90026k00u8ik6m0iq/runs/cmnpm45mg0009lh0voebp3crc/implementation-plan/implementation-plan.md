# Implementation Plan: hx-cli — Rebuild CLI Package with Existing Retry Logic

## Overview

The hx-cli source code already contains complete retry/timeout/error-handling logic (3 attempts, 30s timeout, exponential backoff, HTML detection, error classification). However, the deployed npm package `@projectxinnovation/helix-cli@1.2.0` still has the pre-hardening code (single fetch, no retry, no timeout, `process.exit(1)` on any error). The only action needed is to bump the version and rebuild so the `dist/` output matches the source.

No source code changes. One file modified (package.json version bump). The built artifacts serve as the deliverable.

## Implementation Principles

- **Ship what's already built**: All retry/timeout/error-handling code exists in source and is correct.
- **Zero source changes**: Do not modify any `.ts` files. The prior run's plan prescribed extensive rewrites that were already done.
- **Version clarity**: Bump from 1.2.0 to 1.2.1 so the rebuilt package is distinguishable from the unpublished 1.2.0.
- **Cross-repo dependency**: The server fix (helix-global-server) must land first or concurrently for retry logic to be useful. Without JSON error responses from the server, CLI retries just repeat the same HTML 502/504.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Bump package version | Updated `package.json` (1.2.0 -> 1.2.1) |
| 2 | Build the CLI | Compiled `dist/` with retry logic |
| 3 | Verify built output contains retry logic | Confirmed `dist/lib/http.js` has MAX_ATTEMPTS, RETRYABLE_STATUS_CODES |

## Detailed Implementation Steps

### Step 1: Bump package version

**Goal**: Distinguish the rebuilt package from the unpublished 1.2.0.

**What to Build**:
- In `package.json`, change `"version": "1.2.0"` to `"version": "1.2.1"`.

**Verification (AI Agent Runs)**:
- `grep '"version"' /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli/package.json` — shows `1.2.1`.

**Success Criteria**:
- Version is 1.2.1 in package.json.
- No other changes to package.json.

---

### Step 2: Build the CLI

**Goal**: Compile TypeScript source to dist/ so the built output matches source.

**What to Build**:
- Run `npm run build` (which runs `tsc`).

**Verification (AI Agent Runs)**:
- `cd /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli && npm run build` — exit code 0.
- `ls /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli/dist/lib/http.js` — file exists.
- `ls /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli/dist/index.js` — file exists.

**Success Criteria**:
- Build succeeds with zero errors.
- `dist/lib/http.js` and `dist/index.js` exist.

---

### Step 3: Verify built output contains retry logic

**Goal**: Confirm the compiled JavaScript in dist/ contains the retry, timeout, and error-handling code that was missing from the deployed package.

**What to Build**: No code changes. Verify the built output.

**Verification (AI Agent Runs)**:
- `grep 'MAX_ATTEMPTS' /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli/dist/lib/http.js` — should match.
- `grep 'RETRYABLE_STATUS_CODES' /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli/dist/lib/http.js` — should match.
- `grep 'AbortSignal.timeout' /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli/dist/lib/http.js` — should match.
- `grep 'process.exit' /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli/dist/lib/http.js` — should NOT match (process.exit removed from http.ts in prior run).

**Success Criteria**:
- `dist/lib/http.js` contains `MAX_ATTEMPTS`, `RETRYABLE_STATUS_CODES`, `AbortSignal.timeout`.
- `dist/lib/http.js` does NOT contain `process.exit`.
- The built CLI is ready for npm publish (publishing itself requires npm credentials/CI and is outside this ticket's code changes).

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >=18 available | available | hx-cli package.json `engines: ">=18"` | CHK-01, CHK-02, CHK-03 |
| npm dependencies installed | available | node_modules exists in hx-cli | CHK-01, CHK-02, CHK-03 |
| TypeScript compiler (tsc) | available | devDependency in package.json | CHK-01, CHK-02 |

### Required Checks

[CHK-01] TypeScript compilation passes with zero errors.
- Action: Run `cd /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli && npx tsc --noEmit`.
- Expected Outcome: Exit code 0 with no error output.
- Required Evidence: Command output showing successful compilation (no errors printed).

[CHK-02] Build produces dist/ output successfully.
- Action: Run `cd /vercel/sandbox/workspaces/cmnpm45mg0009lh0voebp3crc/hx-cli && npm run build`.
- Expected Outcome: Exit code 0. The `dist/` directory contains compiled JS files including `dist/lib/http.js` and `dist/index.js`.
- Required Evidence: Command output (no errors) plus file listing of `dist/lib/http.js` and `dist/index.js`.

[CHK-03] Built dist/lib/http.js contains retry logic and does not contain process.exit.
- Action: Search the built `dist/lib/http.js` for `MAX_ATTEMPTS`, `RETRYABLE_STATUS_CODES`, `AbortSignal.timeout`, and verify `process.exit` is absent.
- Expected Outcome: `MAX_ATTEMPTS`, `RETRYABLE_STATUS_CODES`, and `AbortSignal.timeout` are all present in the built file. `process.exit` is NOT present in `dist/lib/http.js`.
- Required Evidence: grep output showing the presence of retry constants and the absence of process.exit.

## Success Metrics

1. Package version bumped to 1.2.1 in package.json.
2. `npm run build` succeeds with zero errors.
3. `dist/lib/http.js` contains retry loop (MAX_ATTEMPTS=3), timeout (AbortSignal.timeout), and error classification (RETRYABLE_STATUS_CODES).
4. `dist/lib/http.js` does NOT contain `process.exit`.
5. Built package is ready for npm publish.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (hx-cli) | Problem statement | Runtime logs flaky; CLI or server could be the problem |
| diagnosis/diagnosis-statement.md (hx-cli) | CLI root cause | Deployed package has old pre-hardening code; source is correct; never published |
| diagnosis/apl.json (hx-cli) | CLI evidence | Deployed http.js: single fetch, process.exit(1), 310ms = no retry |
| product/product.md (hx-cli) | Product scope | Rebuild and republish only; no source changes |
| tech-research/tech-research.md (hx-cli) | Technical direction | All source changes already made; only rebuild needed; version bump recommended |
| tech-research/apl.json (hx-cli) | Decision rationale | RETRYABLE_STATUS_CODES already excludes 422 (server's new deterministic error code) |
| hx-cli/package.json | Build configuration | version 1.2.0, build script is tsc, zero runtime deps |
| hx-cli/src/lib/http.ts | Source code verification (via tech-research) | Full retry logic present: MAX_ATTEMPTS=3, 30s timeout, HTML detection |
| repo-guidance.json | Repo intent | hx-cli=target (rebuild only), no source changes needed |

# Implementation Plan: helix-cli

## Overview

Create a canonical CLI documentation content module (`src/docs/cli-content.ts`) and expose it via a `package.json` exports map entry at `"./docs"`. This provides the canonical content source that `helix-global-client` consumes as an npm dependency. No existing CLI source files, build scripts, or behavior are changed.

## Implementation Principles

- **Pure data module**: The content file exports only string/number/array literals. Zero imports. This is mandatory for Vite browser bundling compatibility.
- **Minimal package.json change**: Only add the `exports` field. No changes to `files`, `scripts`, or `tsconfig.json`.
- **Accuracy from source**: All documented commands and flags must match what is verified in CLI source code. Do not document unreleased flags.
- **No CLI behavior changes**: This ticket adds a data file only.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Create canonical documentation content module | `src/docs/cli-content.ts` |
| 2 | Expose content via exports map | Updated `package.json` with `exports` field |
| 3 | Verify build and output | Passing `npm run build`, compiled files in `dist/docs/` |

## Detailed Implementation Steps

### Step 1: Create `src/docs/cli-content.ts`

**Goal**: Create the canonical documentation content module that helix-global-client will import.

**What to Build**:

Create `src/docs/cli-content.ts` exporting a single `cliDocsContent` constant with this shape:

```typescript
export const cliDocsContent: {
  id: string;        // "helix-cli"
  title: string;     // "Helix CLI"
  content: string;   // Full markdown documentation
  order: number;     // 2 (after NetSuite Integration at order 1)
  keywords: string[];
}
```

The `content` field is a markdown string with these sections (use `##` headings):

1. **Installation** — Primary instruction: `npm install -g @projectxinnovation/helix-cli@latest`
2. **Setup & Authentication** — `hlx login <server-url>` (OAuth browser flow), `hlx login --manual` (API key), `hlx token add`, config stored at `~/.hlx/config.json`
3. **Common Commands** grouped by area:
   - **Tickets**: `list`, `get`, `create`, `artifacts`, `continue`, `update-description`
   - **Inspect**: `repos`, `db`, `logs`, `api`
   - **Comments**: `list`, `post`
   - **Update**: `hlx update`
4. **Worked Examples** (at least one per required command):
   - `hlx tickets list --status IN_PROGRESS --json` (with filters)
   - `hlx tickets get BLD-339 --json` (with `--json` flag)
   - `hlx tickets create --title "..." --description-file ./desc.md --repos my-repo --mode BUILD` (with `--description-file`)
   - `hlx tickets artifacts BLD-339 --run <run-id>` (with `--run`)
   - `hlx inspect repos`
   - `hlx comments post --ticket BLD-339 "message"`
   - Additional: `hlx tickets update-description BLD-339 --file ./updated.md`, `hlx tickets continue BLD-339 "context" --dry-run`
5. **Updating** — Primary instruction: `hlx update`. Mention `--enable-auto` / `--disable-auto`.
6. **Troubleshooting** — Stale-link symptoms, clean-reinstall via `npm install -g @projectxinnovation/helix-cli@latest`, config location `~/.hlx/config.json`

**Critical constraints**:
- Zero `import` statements in the file. Pure `export const` declaration only.
- Package name must be `@projectxinnovation/helix-cli` exactly. Binary name must be `hlx` exactly.
- The `audience` field is intentionally omitted — the consumer assigns it.
- Keywords should include: "cli", "hlx", "command line", "install", "terminal", "tickets", "inspect", "comments", relevant command names.

**Source files to reference for accurate flags** (read, do not modify):
- `src/index.ts` lines 35-55 — usage string / command tree
- `src/tickets/list.ts` — `--search`, `--user`, `--status`, `--status-not-in`, `--archived`, `--sprint`, `--json`
- `src/tickets/get.ts` — `--json`; accepts internal ID, short ID (BLD-339), or number (339)
- `src/tickets/create.ts` — `--title`, `--description`/`--description-file`, `--repos`, `--mode` (AUTO|BUILD|FIX|RESEARCH|EXECUTE)
- `src/tickets/artifacts.ts` — `--run`
- `src/tickets/continue.ts` — `--dry-run`
- `src/tickets/update-description.ts` — `--file`/`--text`
- `src/inspect/repos.ts` — no flags
- `src/comments/post.ts` — `--ticket`
- `src/login.ts` — `--manual`
- `src/update/index.ts` — `--enable-auto`, `--disable-auto`

**Verification (AI Agent Runs)**:
```bash
# File exists
ls src/docs/cli-content.ts

# No import statements
! grep -q '^import ' src/docs/cli-content.ts

# Exports cliDocsContent
grep -q 'export const cliDocsContent' src/docs/cli-content.ts

# Contains required content markers
grep -q 'npm install -g @projectxinnovation/helix-cli@latest' src/docs/cli-content.ts
grep -q 'hlx update' src/docs/cli-content.ts
grep -q 'hlx tickets list' src/docs/cli-content.ts
grep -q 'hlx tickets get' src/docs/cli-content.ts
grep -q 'hlx tickets create' src/docs/cli-content.ts
grep -q 'hlx tickets artifacts' src/docs/cli-content.ts
grep -q 'hlx inspect repos' src/docs/cli-content.ts
grep -q 'hlx comments post' src/docs/cli-content.ts
```

**Success Criteria**:
- File exists at `src/docs/cli-content.ts`
- Contains zero `import` statements
- Exports `cliDocsContent` with all required fields
- Markdown content includes all required sections and worked examples
- All documented flags match source code

---

### Step 2: Add exports map to `package.json`

**Goal**: Expose the compiled content module via a subpath export so consumers can `import { cliDocsContent } from "@projectxinnovation/helix-cli/docs"`.

**What to Build**:

Add an `exports` field to `package.json`:

```json
{
  "exports": {
    "./docs": {
      "types": "./dist/docs/cli-content.d.ts",
      "import": "./dist/docs/cli-content.js"
    }
  }
}
```

Place this field after `bin` and before `scripts` (or wherever logically fits in the file). Key details:
- `"types"` condition first (TypeScript convention)
- `"import"` condition only (package is `"type": "module"`, both repos are ESM, no CJS consumers)
- No `"."` entry — the `bin` field works independently of `exports`
- No changes to `files`, `scripts`, or any other field

**Verification (AI Agent Runs)**:
```bash
# exports field exists
node -e "const p = require('./package.json'); if (!p.exports || !p.exports['./docs']) process.exit(1);"

# Points to correct files
node -e "const p = require('./package.json'); const e = p.exports['./docs']; if (e.types !== './dist/docs/cli-content.d.ts' || e.import !== './dist/docs/cli-content.js') process.exit(1);"
```

**Success Criteria**:
- `package.json` has `exports["./docs"]` with `types` and `import` conditions
- No other package.json fields changed (verify with diff)

---

### Step 3: Build and verify compiled output

**Goal**: Confirm the content module compiles successfully and produces the expected output files.

**What to Build**: Nothing — this is a verification-only step.

**Verification (AI Agent Runs)**:
```bash
# Build
npm run build

# Typecheck
npm run typecheck

# Compiled JS exists
ls dist/docs/cli-content.js

# Declaration file exists
ls dist/docs/cli-content.d.ts

# Compiled module exports cliDocsContent
node -e "import('./dist/docs/cli-content.js').then(m => { if (!m.cliDocsContent || !m.cliDocsContent.content) process.exit(1); console.log('OK: cliDocsContent exported'); })"

# No Node-specific imports in compiled output
! grep -qE "require\(|from ['\"]node:|from ['\"]fs|from ['\"]path" dist/docs/cli-content.js
```

**Success Criteria**:
- `npm run build` exits 0
- `npm run typecheck` exits 0
- `dist/docs/cli-content.js` and `dist/docs/cli-content.d.ts` exist
- The compiled module can be imported and contains the expected export
- No Node.js built-in references in compiled output

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|----------------|----------------|
| Node.js >= 18 | available | helix-cli `package.json` engines field | CHK-01, CHK-02, CHK-03, CHK-04 |
| npm | available | Standard Node.js toolchain | CHK-01, CHK-02 |
| helix-cli dependencies installed (`npm install`) | available | Dev setup | CHK-01, CHK-02, CHK-03, CHK-04 |
| TypeScript 6.0 compiler | available | Installed via devDependencies | CHK-01, CHK-02, CHK-03 |

### Required Checks

[CHK-01] TypeScript build succeeds with content module
- Action: Run `npm run build` in the helix-cli repo root after creating `src/docs/cli-content.ts` and updating `package.json`.
- Expected Outcome: Build exits with code 0. `dist/docs/cli-content.js` and `dist/docs/cli-content.d.ts` are created.
- Required Evidence: `npm run build` exit code and `ls -la dist/docs/cli-content.*` output showing both files.

[CHK-02] TypeScript typecheck passes
- Action: Run `npm run typecheck` in the helix-cli repo root.
- Expected Outcome: Typecheck exits with code 0 and no errors.
- Required Evidence: `npm run typecheck` exit code and output.

[CHK-03] Content module is browser-safe (no Node imports)
- Action: Inspect `src/docs/cli-content.ts` for any `import` statements and inspect `dist/docs/cli-content.js` for any `require()` calls or Node built-in module references.
- Expected Outcome: Zero import statements in source. Zero `require()` or Node built-in references in compiled output.
- Required Evidence: Output of `grep -n 'import ' src/docs/cli-content.ts` (should be empty) and `grep -nE "require\(|from ['\"]node:|from ['\"]fs|from ['\"]path" dist/docs/cli-content.js` (should be empty).

[CHK-04] Content includes all required documentation sections
- Action: Load the compiled module and verify the content string includes the required install command, update command, and worked examples for all six required commands.
- Expected Outcome: The `cliDocsContent.content` string contains: `npm install -g @projectxinnovation/helix-cli@latest`, `hlx update`, and at least one worked example each for `hlx tickets list`, `hlx tickets get`, `hlx tickets create`, `hlx tickets artifacts`, `hlx inspect repos`, `hlx comments post`.
- Required Evidence: Output of running `node -e` that imports the module and checks for each required string, printing found/not-found for each.

---

## Success Metrics

- `src/docs/cli-content.ts` is a zero-import, pure-data TypeScript module
- `package.json` exports `"./docs"` with correct `types` and `import` conditions
- `npm run build` and `npm run typecheck` pass
- Compiled `dist/docs/cli-content.js` + `.d.ts` exist and are browser-safe
- Content covers all ticket-required sections and worked examples

## Cross-Repo Coordination

This repo's changes must be **built and linked locally** before helix-global-client can verify its integration. The implementation sequence is:
1. Complete Steps 1-3 in this repo
2. Run `npm link` in this repo root to make the local build available
3. In helix-global-client, run `npm link @projectxinnovation/helix-cli` to consume the local build
4. For production deployment: this repo's changes must be published to npm before helix-global-client's build can succeed in CI

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary requirements and acceptance criteria | Canonical content in helix-cli; documented commands must match published CLI |
| `scout/reference-map.json` (helix-cli) | Package structure and command inventory | Only dist/ published; no exports map; all required flags verified against source |
| `diagnosis/diagnosis-statement.md` (helix-cli) | Root cause and approach | Create src/docs/cli-content.ts; add exports map; pure data module requirement |
| `diagnosis/apl.json` (helix-cli) | Content structure and exports decisions | Export shape, package.json exports syntax, verified command inventory |
| `tech-research/tech-research.md` (helix-cli) | Technical decisions | TypeScript module in src/docs/; exports with types+import; no changes to files/scripts/tsconfig |
| `product/product.md` (helix-global-client) | Content sections specification | Required sections: install, auth, commands, worked examples, update, troubleshooting |
| `repo-guidance.json` | Shared repo intent | helix-cli is a target repo — content source and exports map |
| `package.json` (helix-cli) | Direct inspection | type: module; files: [dist]; no exports field; version 1.3.2 |
| `tsconfig.json` (helix-cli) | Build config | declaration: true; module: Node16; outDir: dist; rootDir: src |

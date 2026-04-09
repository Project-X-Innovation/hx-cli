# Implementation Plan: Walkthrough Feature Overhaul — helix-cli

## Overview

This is Prong 2: the CLI walkthrough that lets developers review AI-generated changes from their coding agent (e.g., Claude Code) or terminal. A new `hlx walkthrough` command fetches pre-computed walkthrough data from the server GET endpoint and renders it as human-readable text (default) or structured JSON for coding agent consumption. This replaces the generic "Continue with Claude Code" clipboard feature for developers working in their terminal.

**Cross-repo dependency**: The server GET endpoint (helix-global-server Steps S1-S4) MUST be available before the CLI can fetch walkthrough data. The CLI depends on `GET /tickets/:ticketId/runs/:runId/walkthrough` with `latest` resolution.

## Implementation Principles

- Follow established CLI patterns (comments module) for command structure, flag parsing, and HTTP calls.
- TypeScript strict mode, no `any`.
- No new external dependencies.
- Text output is optimized for a 2-minute scan to answer: "Did this change respect the codebase's major arteries?"
- JSON output is the full WalkthroughResult for coding agent consumption.
- No ANSI escape codes in MVP — ensures universal compatibility.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| L1 | Create categorizeFile utility | `src/lib/categorize-file.ts` (~30 lines) |
| L2 | Create walkthrough show command | `src/walkthrough/show.ts` — fetch + render |
| L3 | Create walkthrough router | `src/walkthrough/index.ts` — flag parsing + delegation |
| L4 | Register walkthrough command in main router | Update `src/index.ts` |
| L5 | Quality gates | typecheck, build pass |

## Detailed Implementation Steps

### Step L1: Create categorizeFile utility

**Goal**: Shared utility for labeling walkthrough steps by architectural area in text output.

**What to Build**:
- New file `src/lib/categorize-file.ts`:
  - Export `categorizeFile(filename: string): string`
  - Same pattern matching as the server's `merge-analysis-service.ts` (lines 71-126) and the client's version:
    - "Schema / Migration": prisma/schema, prisma/migrations, /migrations/
    - "Config / Environment": .env files
    - "Infrastructure": Dockerfile, docker-compose, .github/workflows/, terraform, vercel.json
    - "Tests": *.test.ts, *.test.tsx, *.spec.ts, __tests__/
    - "API Surface": /api/, /controllers/, /routes/, /endpoints/
    - "UI Components": /components/, *.tsx, *.jsx
    - "Other": everything else
  - ~30 lines, pure function

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes

**Success Criteria**:
- Function correctly categorizes file paths

### Step L2: Create walkthrough show command

**Goal**: Core logic to fetch walkthrough data and render in text or JSON format.

**What to Build**:
- New file `src/walkthrough/show.ts`:
  - Export `cmdShow(config: HxConfig, ticketId: string, runId: string, format: "text" | "json"): Promise<void>`
  - Fetch data:
    ```
    const data = await hxFetch(config, `/tickets/${ticketId}/runs/${runId}/walkthrough`, { basePath: "/api" });
    ```
    - Follow the pattern from `src/comments/list.ts` line 25
  - Handle null/404: print "No walkthrough available for this ticket." and return
  - **JSON format** (`format === "json"`):
    - `console.log(JSON.stringify({ ticket: ticketId, run: runId, walkthrough: data.walkthrough }, null, 2))`
  - **Text format** (`format === "text"`):
    - Summary header:
      ```
      Walkthrough: <title>
      Generated: <timestamp>
      <totalStops> stops across <filesCovered> files in <reposIncluded> repos
      Areas touched: <unique categories from all steps>
      ```
    - Per-repo section:
      ```
      ━━━ <repoKey> ━━━
      ```
    - Per-step:
      ```
      [1/N] <step.title>  [<category>]
        File: <step.file>:<step.line>
        <step.description>
        
        Diff:
        <first ~20 lines of fileDiffs[step.file] if available>
      ```
    - Import `categorizeFile` from `../lib/categorize-file.js` for category labels
    - Diff excerpts: show first ~20 lines of `fileDiffs[step.file]` when available, skip the diff section when not

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes

**Success Criteria**:
- Text format is scannable, high-density, includes categories and diff excerpts
- JSON format outputs complete walkthrough data structure
- Graceful handling of missing walkthrough data

### Step L3: Create walkthrough router

**Goal**: Parse flags and delegate to the show command.

**What to Build**:
- New file `src/walkthrough/index.ts`:
  - Export `runWalkthrough(config: HxConfig, args: string[]): Promise<void>`
  - Resolve `--ticket` from flag or `HELIX_TICKET_ID` env var (reuse the pattern from `src/comments/index.ts` lines 11-19 — implement the same `getFlag` + `resolveTicketId` logic)
  - Resolve `--run` from flag, default to `"latest"` if not provided
  - Resolve `--format` from flag, default to `"text"`, validate against `"text"` | `"json"`
  - Delegate to `cmdShow(config, ticketId, runId, format)`
  - Print usage on invalid input:
    ```
    Usage:
      hlx walkthrough [--ticket <id>] [--run <id>] [--format json|text]
    ```
  - Import `cmdShow` from `./show.js`

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes

**Success Criteria**:
- Flags parsed correctly
- Defaults to latest run and text format
- HELIX_TICKET_ID env var fallback works

### Step L4: Register walkthrough command in main router

**Goal**: Wire the walkthrough command into the CLI.

**What to Build**:
- In `src/index.ts`:
  - Add import: `import { runWalkthrough } from "./walkthrough/index.js";`
  - Add case in the switch statement (after `comments`, before `--version`):
    ```
    case "walkthrough": {
      const config = requireConfig();
      await runWalkthrough(config, args.slice(1));
      break;
    }
    ```
  - Add usage line:
    ```
    hlx walkthrough [--ticket <id>] [--run <id>] [--format json|text]
    ```

**Verification (AI Agent Runs)**:
- `npm run typecheck` passes
- `npm run build` passes
- Run `node dist/index.js walkthrough --help` or `node dist/index.js walkthrough` — verify usage message appears

**Success Criteria**:
- `hlx walkthrough` is recognized as a valid command
- Produces usage message when run without required flags

### Step L5: Quality gates

**Goal**: All quality gates pass after all changes.

**What to Build**: No new code — run validations.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — zero errors
- `npm run build` — succeeds (tsc compilation)

**Success Criteria**:
- Both quality gates pass cleanly (CLI has no lint or test scripts)

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js + npm installed | available | Dev setup config | CHK-01 through CHK-04 |
| `npm install` completed in helix-cli | available | Dev setup config | CHK-01 through CHK-04 |
| Server running on port 4000 with GET /walkthrough endpoint deployed | available | helix-global-server implementation (Steps S1-S4) | CHK-03, CHK-04 |
| Server .env configured with DATABASE_URL | available | Dev setup config | CHK-03, CHK-04 |
| CLI config with API key (from `hlx login`) | available | Dev setup config provides server URL + credentials | CHK-03, CHK-04 |
| At least one ticket with walkthrough data in the database | available | Production DB: 164/357 runs have walkthrough data | CHK-03, CHK-04 |

### Required Checks

[CHK-01] TypeScript compilation passes.
- Action: Run `npm run typecheck` in the helix-cli directory.
- Expected Outcome: Exit code 0 with no type errors.
- Required Evidence: Command output showing successful completion with zero errors.

[CHK-02] Build succeeds.
- Action: Run `npm run build` in the helix-cli directory.
- Expected Outcome: Exit code 0 — TypeScript compilation completes, `dist/index.js` produced.
- Required Evidence: Command output showing successful tsc completion and existence of `dist/index.js`.

[CHK-03] `hlx walkthrough` text output renders walkthrough data for a valid ticket.
- Action: Start the server on port 4000 with the GET /walkthrough endpoint available. Configure CLI auth (login or manual API key). Run `node dist/index.js walkthrough --ticket <ticketId>` using a ticket ID known to have walkthrough data.
- Expected Outcome: Text output showing: walkthrough title, generation timestamp, summary stats (stops/files/repos), areas touched, and per-step entries with file:line, description, category label, and optional diff excerpts.
- Required Evidence: Command stdout showing the full formatted walkthrough text output with at least one step rendered.

[CHK-04] `hlx walkthrough --format json` outputs valid JSON with walkthrough structure.
- Action: Run `node dist/index.js walkthrough --ticket <ticketId> --format json` using the same ticket ID.
- Expected Outcome: Valid JSON output containing `{ ticket, run, walkthrough: { title, generatedAt, repos: [...], summary: { totalStops, filesCovered, reposIncluded } } }` with `totalStops > 0`.
- Required Evidence: Command stdout showing valid JSON (parseable by `| node -e "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))"`) with the expected walkthrough structure.

## Success Metrics

- `hlx walkthrough` command registered and functional
- Text format scannable in under 2 minutes
- JSON format parseable by coding agents
- Architectural labels on every step
- Diff excerpts included when fileDiffs available
- Both quality gates (typecheck, build) pass

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| tech-research/tech-research.md (CLI) | Architecture decisions | Single command structure, dual format, module directory pattern, text/JSON design |
| tech-research/apl.json (CLI) | Evidence trail | comments pattern reusable, GET endpoint required, categorizeFile shared |
| diagnosis/diagnosis-statement.md (CLI) | Feasibility assessment | Zero walkthrough capability, comments as template, server dependency |
| product/product.md | Requirements | hlx walkthrough command, --format text/json, replace Claude Code handoff |
| scout/reference-map.json (CLI) | File inventory | src/index.ts router, comments pattern, hxFetch HTTP client |
| repo-guidance.json | Repo intent | CLI target for new walkthrough command |
| src/index.ts (source) | Router structure | Switch-based, 57 lines, trivial to extend |
| src/comments/index.ts (source) | Template pattern | resolveTicketId with --ticket + HELIX_TICKET_ID env var |
| src/comments/list.ts (source) | Data-fetching pattern | hxFetch with basePath '/api', formatted console output |
| src/lib/http.ts (source) | HTTP client | hxFetch with retry, basePath, auth headers |
| merge-analysis-service.ts (source, lines 71-126) | categorizeFile pattern | File-path categorization logic to replicate in CLI |

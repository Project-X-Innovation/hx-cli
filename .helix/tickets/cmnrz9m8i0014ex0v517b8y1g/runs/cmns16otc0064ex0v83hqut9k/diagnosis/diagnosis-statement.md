# Diagnosis Statement — helix-cli

## Problem Summary

The CLI has zero walkthrough capability. The user wants a second prong where developers can review AI-generated changes from their coding agent (e.g., Claude Code) or terminal. The CLI needs a new `hlx walkthrough` command that fetches and displays pre-computed walkthrough data, replacing or enhancing the current "Continue with Claude Code" clipboard feature in the UI which passes zero walkthrough context.

## Root Cause Analysis

### RC-1: No Walkthrough Command Exists (Critical — Greenfield Gap)
The CLI (`src/index.ts`) has only three commands: `login`, `inspect`, and `comments`. No walkthrough, review, or change-inspection capability exists. This is a greenfield gap, not a bug — the original walkthrough design was web-only. The ticket author recognizes that meeting developers where they work (CLI/coding agent) is more effective.

### RC-2: Server Dependency — No GET Endpoint (Blocking Cross-Repo)
The server currently only has POST endpoints for walkthrough (which trigger expensive ~60s regeneration). The CLI needs a cheap, fast way to read pre-computed walkthrough data. Either a new GET endpoint, using the ticket detail API's embedded walkthrough data, or a new lightweight read endpoint is needed. The `findRunOrThrow` bug on the server also blocks access to historical runs.

### RC-3: "Continue with Claude Code" Passes Zero Walkthrough Context (High — Client-Side)
The current `buildClaudeCodeCommand()` in the client UI (`ticket-detail.tsx:582-628`) generates a generic prompt: "find repos, checkout branches, analyze changes." It passes zero walkthrough data, step descriptions, or architectural framing. The CLI walkthrough command with `--format json` could replace this with rich, structured walkthrough context that a coding agent can consume programmatically.

## Evidence Summary

| Evidence | Finding |
|----------|---------|
| src/index.ts | 57-line router; only login, inspect, comments, --version |
| src/comments/index.ts | Established pattern: resolveTicketId() with --ticket flag + HELIX_TICKET_ID env var |
| src/comments/list.ts | Data fetching pattern: hxFetch with formatted output, flags |
| src/lib/http.ts | hxFetch with retry, exponential backoff, basePath '/api' — ready for new API calls |
| Server routes/api.ts:189-190 | Only POST endpoints; no GET for pre-computed data |
| walkthrough-service.ts:68-76 | findRunOrThrow blocks historical run access |
| ticket-detail.tsx:582-628 | buildClaudeCodeCommand: generic prompt, zero walkthrough data |
| package.json | v1.2.0, Node 18+, build: tsc, typecheck: tsc --noEmit, no test scripts |

## Success Criteria

1. **`hlx walkthrough` command**: Registered in main router (`src/index.ts`), following `comments` module pattern with subcommand routing
2. **Ticket resolution**: `--ticket <id>` flag with `HELIX_TICKET_ID` env var fallback (reuse `resolveTicketId`)
3. **Run resolution**: `--run <id>` flag defaulting to latest completed run
4. **Dual output**: `--format text` (default, human-readable terminal output) and `--format json` (structured data for coding agents)
5. **Text format**: Step-by-step with numbered steps, file:line, descriptions, and summary — high-density, scannable in terminal
6. **JSON format**: Full walkthrough data structure passable to Claude Code or other agents for interactive review
7. **Server dependency resolved**: A GET-based read path for walkthrough data is available on the server

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement | CLI alternative to in-browser walkthrough; extend Helix CLI for coding agent integration |
| User continuation context | Direction | CLI prong "maybe replacing Continue with Claude Code"; needs to be easy, impactful, smooth |
| scout/reference-map.json (CLI) | CLI file inventory | No walkthrough; comments pattern as template; hxFetch ready |
| scout/scout-summary.md (CLI) | CLI analysis | Zero walkthrough capability; established patterns for ticket-scoped commands |
| scout/reference-map.json (server) | Cross-repo dependency | No GET endpoint; findRunOrThrow blocks historical access |
| repo-guidance.json (tech-research) | Prior assessment | CLI identified as target; hlx walkthrough proposed with --ticket, --run, --format flags |
| Prior diagnosis apl.json (CLI) | Prior round findings | Feasibility confirmed; same structural patterns identified |
| src/index.ts (source) | Router structure | switch/case with login, inspect, comments — pattern for adding walkthrough |
| src/comments/index.ts (source) | Template pattern | resolveTicketId with --ticket + env var fallback |
| src/lib/http.ts (source) | HTTP client | hxFetch with retry, basePath — ready for walkthrough API calls |
| ticket-detail.tsx (source, lines 582-628) | Current Claude Code handoff | Generic prompt, zero walkthrough data — the gap CLI must fill |

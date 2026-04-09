# Scout Summary — helix-cli

## Problem

The CLI is the second prong of the dual-pronged approach: letting developers review AI-generated changes from their coding agent (e.g., Claude Code) or terminal. The user envisions this potentially replacing the current "Continue with Claude Code" clipboard feature in the UI. The CLI currently has NO walkthrough command — only login, inspect, and comments. Existing patterns provide a template for the new command, but server-side API changes (GET endpoint) would also be needed.

## Analysis Summary

helix-cli is a lightweight Node.js CLI (v1.2.0, 57-line router) with three top-level commands: `login`, `inspect`, and `comments`. It has no walkthrough capability today.

**Existing patterns directly relevant**:
- The `comments` subcommand (src/comments/index.ts) provides the closest structural analog: `resolveTicketId()` supports `--ticket` flag with `HELIX_TICKET_ID` env var fallback, subcommand routing (list/post), authenticated server API calls, formatted terminal output.
- The `inspect` subcommand demonstrates read-only data fetching with multiple output modes (JSON for structured data).
- The HTTP client (src/lib/http.ts) supports retry with exponential backoff, basePath '/api', and 30s timeout.

**What the CLI would need to consume from the server**:
- Pre-computed walkthrough data (currently stored in `SandboxRun.walkthroughData`). No GET endpoint exists — only POST (which triggers expensive re-generation). Either a new GET endpoint or using the ticket detail API's embedded walkthroughData would work.
- The ability to identify the latest completed run for a ticket (for `--run latest` default).

**What does not exist today**:
- No CLI command for listing/viewing walkthrough data
- No CodeTour parsing or terminal rendering
- No auto-pull mechanism for recently finished tickets
- No interactive TUI capabilities
- No test infrastructure

**Integration with Claude Code**: The user envisions the CLI working inside Claude Code. The `--format json` output would let coding agents consume walkthrough data programmatically. The text format would let developers read walkthroughs directly in terminal. Both could replace the current "Continue with Claude Code" clipboard command which passes no walkthrough context at all.

## Relevant Files

| File | Role | Lines |
|------|------|-------|
| `src/index.ts` | Main CLI router: login, inspect, comments, --version | 57 |
| `src/comments/index.ts` | Template: resolveTicketId, subcommand router | 50 |
| `src/comments/list.ts` | Template: data-fetching with flags, formatted output | — |
| `src/comments/post.ts` | Template: POST request pattern | — |
| `src/inspect/index.ts` | Alternative template: read-only multi-subcommand | — |
| `src/lib/http.ts` | HTTP client with retry, exponential backoff, basePath | 130 |
| `src/lib/config.ts` | Config: ~/.hlx/config.json or env vars | 47 |
| `package.json` | v1.2.0, Node 18+. build (tsc), typecheck (tsc --noEmit). No lint/test. | — |
| `tsconfig.json` | ES2022 target, Node16 modules, dist/ output, strict | 15 |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | CLI alternative proposal | Extend Helix line to auto-pull finished tickets, walk devs through changes in coding agent |
| User continuation context | Direction and priorities | CLI prong "maybe replacing the current Continue with Claude Code"; needs to be easy, impactful, smooth |
| src/index.ts (source) | Map CLI structure | Three commands: login, inspect, comments. No walkthrough. |
| src/comments/ (source) | Closest structural pattern | resolveTicketId with --ticket flag + HELIX_TICKET_ID env var; subcommand routing |
| src/lib/http.ts (source) | HTTP client capabilities | Retry, exponential backoff, basePath '/api' — ready for new API calls |
| package.json (source) | Quality gates | build (tsc), typecheck (tsc --noEmit). No lint or test scripts. |
| Server routes/api.ts (cross-repo) | API endpoint inventory | Only POST endpoints for walkthrough; no GET for pre-computed data — gap for CLI |
| Existing tech-research artifacts | Prior design proposals | hlx walkthrough [--ticket <id>] [--run <id>] [--format json\|text] proposed |

# Implementation Plan: helix-cli

## Overview

Add comment commands (`hlx comments list` and `hlx comments post`) to the Helix CLI, enabling sandbox agents and external CLI users to read and write ticket comments. This requires generalizing the HTTP client to support non-inspect API paths, adding a new `comments` command group, and supporting `HELIX_TICKET_ID` env var for automatic ticket resolution.

## Implementation Principles

- Zero new runtime dependencies — maintain the CLI's zero-dep philosophy.
- Follow the existing `inspect` subcommand dispatch pattern for consistency.
- Minimal HTTP client change: add optional `basePath` parameter, backward-compatible default.
- Support both sandbox (env var) and external (flag) ticket ID resolution.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| C1 | Generalize `hxFetch` with `basePath` parameter | Modified `src/lib/http.ts` |
| C2 | Create comments command dispatcher | New `src/comments/index.ts` |
| C3 | Implement `hlx comments list` | New `src/comments/list.ts` |
| C4 | Implement `hlx comments post` | New `src/comments/post.ts` |
| C5 | Register `comments` command in CLI entry point | Modified `src/index.ts` |
| C6 | Quality gates | Pass typecheck and build |

## Detailed Implementation Steps

### Step C1: Generalize `hxFetch` with `basePath` parameter

**Goal**: Allow the HTTP client to target both `/api/inspect` and `/api` base paths.

**What to Build**:
- In `src/lib/http.ts`, add `basePath?: string` to the options parameter of `hxFetch` (line 40).
- Default value: `'/api/inspect'` (backward-compatible).
- Update URL construction (line 43) to use the provided basePath:
  ```typescript
  const base = options.basePath ?? "/api/inspect";
  const url = new URL(`${config.url}${base}${path}`);
  ```
- All existing callers continue working unchanged since the default is `/api/inspect`.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — no type errors.
- Grep `http.ts` for `basePath` to confirm the parameter exists.

**Success Criteria**:
- `hxFetch` accepts optional `basePath` parameter.
- Default behavior unchanged for existing callers.

---

### Step C2: Create comments command dispatcher

**Goal**: Create the `comments` subcommand entry point with ticket ID resolution.

**What to Build**:
- Create `src/comments/index.ts` following the pattern from `src/inspect/index.ts`.
- Export `runComments(config: HxConfig, args: string[])` function.
- Implement `resolveTicketId(args)`: check `--ticket` flag first, then `HELIX_TICKET_ID` env var, then exit with clear error.
- Implement `getFlag` and `getPositionalArgs` helpers (replicate from inspect/index.ts or import if extracted).
- Route subcommands: `list` to `cmdList`, `post` to `cmdPost`, default to usage message.
- Usage message: display `hlx comments list [--ticket <id>] [--helix-only] [--since <iso-date>]` and `hlx comments post [--ticket <id>] <message>`.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — no type errors.
- Confirm file `src/comments/index.ts` exists with `runComments` export.

**Success Criteria**:
- `runComments` dispatches `list` and `post` subcommands.
- Ticket ID resolved from `--ticket` flag or `HELIX_TICKET_ID` env var.
- Clear error message if no ticket ID available.

---

### Step C3: Implement `hlx comments list`

**Goal**: Read and display comments for a ticket.

**What to Build**:
- Create `src/comments/list.ts` with `cmdList(config: HxConfig, ticketId: string, args: string[])`.
- Make GET request via `hxFetch(config, `/tickets/${ticketId}/comments`, { basePath: '/api' })`.
- Parse response as `{ comments: Array<{ id, author: { name, email }, content, isHelixTagged, isAgentAuthored, createdAt }> }`.
- Optional `--helix-only` flag: client-side filter to show only `isHelixTagged === true` comments.
- Optional `--since <iso-date>` flag: client-side filter to show only comments after the given date.
- Output format per comment: `[timestamp] Author [markers]: content` where markers include `Helix` for isHelixTagged and `Agent` for isAgentAuthored.
- Example: `[2026-04-08T10:30:00Z] Jane Doe [Helix]: Can you check the migration?`
- Example: `[2026-04-08T10:35:00Z] Helix [Agent]: I'll review the migration file.`

**Verification (AI Agent Runs)**:
- `npm run typecheck` — no type errors.
- Confirm file `src/comments/list.ts` exists with `cmdList` export.

**Success Criteria**:
- Comments retrieved and displayed in human-readable, agent-parseable format.
- Optional filtering by `--helix-only` and `--since`.

---

### Step C4: Implement `hlx comments post`

**Goal**: Post a comment to a ticket.

**What to Build**:
- Create `src/comments/post.ts` with `cmdPost(config: HxConfig, ticketId: string, args: string[])`.
- Extract message from positional args (join remaining args after flags).
- If no message provided, exit with error: `Error: Message content is required.`
- Make POST request via `hxFetch(config, `/tickets/${ticketId}/comments`, { method: 'POST', body: { content: message, isHelixTagged: true }, basePath: '/api' })`.
- Agent comments always set `isHelixTagged: true` (they are always directed at Helix context).
- On success: print `Comment posted (id: <id>)`.
- On error: print the error message and exit with code 1.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — no type errors.
- Confirm file `src/comments/post.ts` exists with `cmdPost` export.

**Success Criteria**:
- Comment posted with `isHelixTagged: true`.
- Clear success/error output.

---

### Step C5: Register `comments` command in CLI entry point

**Goal**: Wire the `comments` command group into the CLI switch router.

**What to Build**:
- In `src/index.ts`:
  - Import `runComments` from `./comments/index.js`.
  - Add a `case "comments":` to the switch statement (after `case "inspect"`):
    ```typescript
    case "comments": {
      const config = requireConfig();
      await runComments(config, args.slice(1));
      break;
    }
    ```
  - Update the `usage()` function to include comment commands in the help text.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — no type errors.
- Grep `index.ts` for `comments` case to confirm it exists.

**Success Criteria**:
- `hlx comments` routes to the comments dispatcher.
- Usage text includes comment commands.

---

### Step C6: Quality gates

**Goal**: Verify all changes pass typecheck and build.

**What to Build**: No code changes — verification only.

**Verification (AI Agent Runs)**:
- `npm run typecheck` — must pass with 0 errors.
- `npm run build` — must complete successfully.

**Success Criteria**:
- All quality gates pass.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js and npm installed | available | Dev environment | CHK-01 through CHK-04 |
| Server comment routes accept inspection tokens | unknown | Cross-repo dependency on helix-global-server changes | CHK-03, CHK-04 |
| Server running on port 4000 with .env configured | available | Dev setup config for helix-global-server | CHK-03, CHK-04 |
| `HELIX_TICKET_ID` env var injected by server | unknown | Cross-repo dependency on server orchestrator change | CHK-04 |
| A valid ticket ID exists in the database | unknown | Depends on database state | CHK-03, CHK-04 |
| Login credentials for web auth | available | Dev setup config: support@projectxinnovation.com / =(ohR58-w | CHK-03 |

### Required Checks

[CHK-01] Quality gates pass (typecheck, build).
- Action: Run `npm run typecheck && npm run build` from the helix-cli root.
- Expected Outcome: Both commands exit with code 0 and no errors.
- Required Evidence: Terminal output showing successful completion of typecheck and build.

[CHK-02] HTTP client supports basePath parameter.
- Action: Read `src/lib/http.ts` and verify that `hxFetch` accepts a `basePath` option and defaults to `'/api/inspect'`.
- Expected Outcome: The `basePath` parameter exists in the options type. URL construction uses `basePath` instead of hardcoded `/api/inspect`.
- Required Evidence: File content of `http.ts` showing the updated function signature and URL construction.

[CHK-03] `hlx comments list` retrieves comments from server.
- Action: Start the helix-global-server with `npm run dev` (port 4000) with .env configured. Log in via `hlx login` or set env vars. Run `hlx comments list --ticket <valid-ticket-id>` against the running server.
- Expected Outcome: The command outputs a list of comments (or an empty list if none exist) in the `[timestamp] Author [markers]: content` format. No error messages.
- Required Evidence: Terminal output showing the command execution and response.

[CHK-04] `hlx comments post` creates a comment on the server.
- Action: With the server running, run `hlx comments post --ticket <valid-ticket-id> "Test comment from CLI"`. Then run `hlx comments list --ticket <valid-ticket-id>` to verify the comment appears.
- Expected Outcome: Post command prints `Comment posted (id: <some-id>)`. List command shows the new comment in the output.
- Required Evidence: Terminal output of both the post and subsequent list commands.

## Success Metrics

1. `hxFetch` supports `basePath` parameter with backward-compatible default.
2. `hlx comments list` retrieves and displays comments.
3. `hlx comments post` creates comments with `isHelixTagged: true`.
4. Ticket ID resolved from `--ticket` flag or `HELIX_TICKET_ID` env var.
5. All quality gates pass (typecheck, build).
6. Zero new runtime dependencies.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand feature requirements | CLI as communication mechanism; agents and external users both use it |
| scout/scout-summary.md (CLI) | Map CLI current state | No comment commands; hxFetch hardcodes /api/inspect; zero deps |
| scout/reference-map.json (CLI) | Identify relevant files | index.ts, http.ts, config.ts, inspect/index.ts |
| diagnosis/diagnosis-statement.md (CLI) | Identify three CLI gaps | No comment commands, HTTP path limitation, ticket ID not available |
| diagnosis/apl.json (CLI) | Detailed Q&A evidence | hxFetch hardcoded path; subcommand pattern reusable; HELIX_TICKET_ID needed |
| product/product.md | Product requirements | hlx comments list and hlx comments post; HELIX_TICKET_ID env var |
| tech-research/tech-research.md (CLI) | Architecture decisions | Option A for HTTP (basePath param); Option A for commands (top-level group); Option A for ticket ID (flag + env var) |
| src/index.ts (lines 1-48) | CLI entry point | Switch router pattern; import and case structure |
| src/lib/http.ts (lines 37-129) | HTTP client implementation | Hardcoded /api/inspect at line 43; retry/backoff logic reusable |
| src/lib/config.ts (lines 1-47) | Config loading | Env var priority chain; HxConfig type |
| src/inspect/index.ts (lines 1-72) | Subcommand pattern | getFlag, getPositionalArgs helpers; switch dispatch |

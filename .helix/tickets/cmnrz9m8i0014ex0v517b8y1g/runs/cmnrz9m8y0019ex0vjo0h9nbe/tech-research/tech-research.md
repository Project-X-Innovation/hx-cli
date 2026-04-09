# Tech Research: Walkthrough Feature Rework — helix-cli

## Technology Foundation

- **Runtime**: Node.js 18+ with TypeScript
- **CLI Framework**: Manual switch-based routing (no framework dependency)
- **HTTP Client**: Custom `hxFetch` with retry/backoff (src/lib/http.ts)
- **Auth**: `X-API-Key` header for hxi_ keys, `Authorization: Bearer` for others
- **Package**: v1.2.0, binary at `dist/index.js`
- **Quality gates**: `npm run build` (tsc), `npm run typecheck` (tsc --noEmit). No lint or test scripts.

## Architecture Decisions

### AD-1: Single `hlx walkthrough` command (no subcommands)

**Options considered**:
1. **Subcommand pattern like comments**: `hlx walkthrough show`, `hlx walkthrough list`. The comments command has list/post because it's bidirectional (read + write). Walkthrough is read-only.
2. **Single command**: `hlx walkthrough [--ticket <id>] [--run <id>] [--format json|text]`. Simpler, matches the read-only nature. Default shows the latest completed run's walkthrough.
3. **Inspect-style nesting**: `hlx inspect walkthrough`. Breaks semantic expectations — walkthrough isn't a production inspection tool.

**Chosen**: Option 2 — Single command.

**Rationale**: Walkthrough consumption is a single action (fetch and display). There's no creation, deletion, or listing operation that justifies subcommands. The `--run` flag provides run selection when needed, and `--format` provides output control. This minimizes the CLI surface and learning curve.

### AD-2: Dual output format — text (default) and JSON

**Options considered**:
1. **JSON only** — Machine-readable for coding agents but poor terminal experience for humans.
2. **Text only** — Human-readable but not consumable by coding agents (Claude Code, Cursor, etc.).
3. **Both via `--format` flag** — Default `text` for terminal use; `--format json` for coding agents. The comments list command already outputs text by default.

**Chosen**: Option 3 — Dual format with `--format` flag.

**Rationale**: The product spec requires output "readable both as terminal text and as structured data pipeable to coding agents." A `--format json` flag outputs the raw `WalkthroughResult` JSON. The default text format renders a human-readable step-by-step walkthrough with file paths, line numbers, and descriptions. This directly serves both use cases (UC1: terminal reading, UC2: coding agent piping).

### AD-3: Use new GET endpoint, not existing POST endpoint

**Options considered**:
1. **Call existing POST /walkthrough** — Triggers Claude API generation (expensive, ~60s). Semantically wrong for a read operation.
2. **Call new GET /walkthrough** — Reads pre-computed data from DB. Fast (< 50ms). Semantically correct.
3. **Fetch .tour files directly from GitHub** — Requires GitHub token management in CLI; tour files are optionally committed (org flag-gated); adds coupling to GitHub.

**Chosen**: Option 2 — New GET endpoint.

**Rationale**: Walkthrough data is already pre-computed and stored in the DB (45.7% of completed runs). The CLI should read this data, not regenerate it. The GET endpoint (designed in server tech-research) returns `{ walkthrough: WalkthroughResult | null }` with `latest` run resolution. One HTTP call, fast response.

### AD-4: Follow the comments module pattern for code structure

**Options considered**:
1. **Single file**: `src/walkthrough.ts` containing all logic. Simple but may grow if subcommands are added later.
2. **Module directory**: `src/walkthrough/index.ts` (router) + `src/walkthrough/show.ts` (display logic). Matches comments and inspect patterns. Easy to extend.

**Chosen**: Option 2 — Module directory.

**Rationale**: Consistency with existing CLI code structure (comments has index.ts + list.ts + post.ts; inspect has index.ts + subcommand files). Even though MVP has no subcommands, the router file is a natural extension point. The actual display/fetch logic lives in a separate file for clarity.

## Core API/Methods

### New: `src/walkthrough/index.ts`
- Router function `runWalkthrough(config: HxConfig, args: string[])`
- Resolves `--ticket` from flag or `HELIX_TICKET_ID` env (existing pattern from comments/index.ts)
- Resolves `--run` from flag or defaults to `"latest"`
- Resolves `--format` from flag or defaults to `"text"`
- Delegates to `cmdShow(config, ticketId, runId, format)`

### New: `src/walkthrough/show.ts`
- `cmdShow(config, ticketId, runId, format)` — Fetches walkthrough via GET, outputs formatted result
- Calls `hxFetch(config, /tickets/${ticketId}/runs/${runId}/walkthrough, { basePath: "/api" })`
- If `format === "json"`: `console.log(JSON.stringify(walkthrough, null, 2))`
- If `format === "text"`: Renders step-by-step text output (title, summary, then each stop with file:line and description)

### Modified: `src/index.ts`
- Add `case "walkthrough":` to the switch (import `runWalkthrough`, call with args)
- Add usage line: `hlx walkthrough [--ticket <id>] [--run <id>] [--format json|text]`

## Technical Decisions

### TD-1: Text output format for terminal display

The text format renders walkthroughs as readable terminal output:
```
Walkthrough: <title>
Generated: <timestamp>
<summary.totalStops> stops across <summary.filesCovered> files in <summary.reposIncluded> repos

--- <repoKey> ---

[1/N] <step.title or "Step 1">
  File: <step.file>:<step.line>
  <step.description>

[2/N] ...
```

**Rejected alternative**: Interactive TUI with arrow-key navigation and syntax highlighting. Product spec explicitly defers this: "Interactive terminal step-through navigation: A rich TUI is a nice-to-have. MVP can output formatted markdown or JSON."

### TD-2: Error handling for missing walkthroughs

When the GET endpoint returns `{ walkthrough: null }`:
- Text format: Print "No walkthrough available for this run." and exit 0.
- JSON format: Print `{ "walkthrough": null }` and exit 0.

When the endpoint returns a non-200 status (ticket not found, auth failure):
- The existing `hxFetch` error handling (http.ts) throws with a clear message. The top-level catch in index.ts prints it and exits 1.

No special error handling needed beyond existing patterns.

### TD-3: No HELIX_RUN_ID environment variable

The CLI resolves `HELIX_TICKET_ID` from env for ticket context. We considered adding `HELIX_RUN_ID` for run context but decided against it because:
- The `latest` default is the right behavior for 90% of CLI usage
- When a specific run is needed, `--run <id>` is explicit and clear
- Adding env vars increases the implicit configuration surface without clear benefit

## Cross-Platform Considerations

The CLI runs on macOS, Linux, and Windows (Node.js). The text output format uses no ANSI escape codes or terminal-specific features in the MVP, ensuring compatibility across all platforms. Future enhancements (color, interactive TUI) can be gated behind TTY detection.

## Performance Expectations

- **Network**: Single GET request to server. Expected < 50ms server-side (DB read). Total with network varies by deployment.
- **Rendering**: Text formatting is synchronous string concatenation over the tour steps array. Negligible CPU cost.
- **CLI startup**: Node.js cold start (~100-200ms). Consistent with existing commands.

## Dependencies

| Dependency | Version | Purpose | Risk |
|------------|---------|---------|------|
| Node.js | 18+ | Runtime | None — existing requirement |
| TypeScript | existing | Build toolchain | None |
| hxFetch (internal) | existing | HTTP client with retry | None — proven for comments/inspect |

No new external dependencies required.

## Deferred to Round 2

- **Interactive terminal step-through**: Arrow-key navigation, syntax highlighting via Shiki in terminal. Requires TUI library (e.g., ink, blessed). Product explicitly defers this.
- **Auto-pull of finished tickets**: Automatically surfacing walkthrough data when a dev opens their coding agent. Requires deeper integration with third-party tools.
- **`hlx walkthrough --regenerate` flag**: Trigger re-generation via POST endpoint when stored data is stale or missing. MVP only reads pre-computed data.
- **Lint and test scripts**: The CLI has no lint or test configuration. Adding these is valuable but orthogonal to the walkthrough feature.

## Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Command structure | Single `hlx walkthrough` command | Read-only; no need for subcommands |
| Output format | `--format json\|text`, default text | Serves both terminal users and coding agents |
| Server endpoint | New GET /walkthrough (not existing POST) | Reads pre-computed data; avoids expensive re-generation |
| Code structure | Module directory (walkthrough/index.ts + show.ts) | Consistent with comments/inspect patterns |
| Run resolution | `--run <id>` flag; default `latest` | Server resolves `latest` to most recent completed run |
| Error handling | Existing hxFetch patterns | No special error handling needed |

## APL Statement Reference

See `tech-research/apl.json` for the investigation trail. Key findings from diagnosis APL carried forward:
- helix-cli has zero walkthrough capability today (src/index.ts: 3 commands only)
- Comments command pattern (--ticket flag, HELIX_TICKET_ID env, hxFetch) is directly reusable
- Existing POST endpoints are semantically wrong for CLI read operations

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| diagnosis/diagnosis-statement.md (CLI) | Feasibility assessment for CLI walkthrough | CLI has right patterns; needs new subcommand + minor server additions |
| diagnosis/apl.json (CLI) | CLI evidence | Existing patterns reusable; server endpoints partially sufficient |
| product/product.md (client) | Product requirements for CLI walkthrough | MVP: fetch and display, structured JSON output, --format flag |
| scout/reference-map.json (CLI) | Map CLI structure and patterns | 3 commands, HTTP client, HELIX_TICKET_ID env pattern |
| scout/scout-summary.md (CLI) | CLI extension surface analysis | comments is closest analog; HTTP client ready |
| src/index.ts (source) | Verify command routing structure | Switch-based routing, 57 lines, easy to extend |
| src/comments/index.ts (source) | Verify subcommand router pattern | resolveTicketId, router function, delegates to subcommands |
| src/comments/list.ts (source) | Verify data-fetching CLI pattern | hxFetch with basePath '/api', formatted console output |
| src/lib/http.ts (source) | Verify HTTP client capabilities | Retry, backoff, auth headers, 30s timeout |
| tech-research/tech-research.md (server) | Server-side GET endpoint design | GET /walkthrough with 'latest' resolution, attachInspectionAuth |
| repo-guidance.json | Repo intent from product step | CLI is target for new walkthrough command |

# Tech Research: Walkthrough Feature Overhaul — helix-cli

## Technology Foundation

- **Runtime**: Node.js 18+ with TypeScript (strict mode)
- **CLI Framework**: Manual switch-based routing (no framework dependency)
- **HTTP Client**: Custom `hxFetch` with retry/backoff (src/lib/http.ts, 130 lines)
- **Auth**: `X-API-Key` header for hxi_ keys, `Authorization: Bearer` for others (http.ts:53-54)
- **Package**: v1.2.0, binary at `dist/index.js`
- **Quality gates**: `npm run build` (tsc), `npm run typecheck` (tsc --noEmit). No lint or test scripts.

This is Prong 2: the CLI walkthrough that lets developers review AI-generated changes from their coding agent (e.g., Claude Code) or terminal. It replaces/enhances the current generic "Continue with Claude Code" clipboard feature.

## Architecture Decision 1: Single `hlx walkthrough` Command (No Subcommands)

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Subcommands like comments** | `hlx walkthrough show`, `hlx walkthrough list` | Consistent with comments pattern; extensible | Over-engineered — walkthrough is read-only, single action |
| **B: Single command** | `hlx walkthrough [--ticket <id>] [--run <id>] [--format json\|text]` | Simple; matches read-only nature; minimal learning curve | Less extensible if write operations added later |
| **C: Inspect-style nesting** | `hlx inspect walkthrough` | Groups with inspection | Breaks semantics — walkthrough isn't production inspection |

### Chosen: Option B — Single command

**Rationale**: Walkthrough consumption is a single read action: fetch and display. No creation, deletion, or listing operation justifies subcommands. The `--run` flag provides run selection, `--format` provides output control. Minimizes CLI surface area and learning curve. Can add subcommands later without breaking changes if needed.

## Architecture Decision 2: Dual Output Format — Text (Default) and JSON

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: JSON only** | Machine-readable for coding agents | Single format | Poor terminal experience for humans |
| **B: Text only** | Human-readable terminal output | Simple | Not consumable by coding agents |
| **C: Both via `--format` flag** | Default `text` for terminal; `--format json` for coding agents | Serves both use cases | Two rendering paths |

### Chosen: Option C — Dual format

**Rationale**: The product spec requires "output readable both as terminal text and as structured data pipeable to coding agents." The `--format json` flag outputs the full `WalkthroughResult` JSON. The default text format renders a high-density step-by-step walkthrough.

### Text output format

```
Walkthrough: <title>
Generated: <timestamp>
<totalStops> stops across <filesCovered> files in <reposIncluded> repos
Areas touched: API Surface, UI Components, Tests

━━━ <repoKey> ━━━

[1/N] <step.title>  [API Surface]
  File: <step.file>:<step.line>
  <step.description>
  
  Diff:
  + added line
  - removed line
    context line

[2/N] <step.title>  [UI Components]
  File: <step.file>:<step.line>
  <step.description>
  ...
```

**Key design decisions for text format**:
- **Architectural category labels** per step (`[API Surface]`, `[Tests]`, etc.) — uses the same `categorizeFile()` pattern matching as the client (merge-analysis-service.ts:71-126)
- **Diff excerpts** inline when `fileDiffs` data is available — shows the first ~20 lines of each file's diff per step
- **Summary header** with areas touched — gives immediate high-level framing
- **No ANSI escape codes** in MVP — ensures compatibility across all terminals and piped output
- **Falls back gracefully** when diffs unavailable (older walkthroughs)

### JSON output format

```json
{
  "ticket": "<ticketId>",
  "run": "<runId>",
  "walkthrough": {
    "title": "...",
    "generatedAt": "...",
    "repos": [
      {
        "repoKey": "...",
        "repoUrl": "...",
        "branch": "...",
        "tour": { "title": "...", "steps": [...] },
        "fileDiffs": { "path/to/file.ts": "unified diff..." }
      }
    ],
    "summary": { "totalStops": 10, "filesCovered": 8, "reposIncluded": 2 }
  }
}
```

The JSON format is the full `WalkthroughResult` wrapped with ticket/run metadata. Claude Code or other agents can consume this programmatically for interactive review — e.g., navigating steps, asking questions about specific changes, suggesting improvements.

## Architecture Decision 3: Use New GET Endpoint (Not Existing POST)

### Chosen: New GET `/tickets/:ticketId/runs/:runId/walkthrough`

**Rationale**: The existing POST endpoint triggers expensive Claude API regeneration (~60s, costs money). The CLI needs to READ pre-computed walkthrough data. The new GET endpoint (see server tech-research) returns stored `walkthroughData` JSONB with `latest` run resolution. One HTTP call, fast response (< 200ms).

The CLI calls `hxFetch(config, /tickets/${ticketId}/runs/${runId}/walkthrough, { basePath: "/api" })` following the exact pattern of `comments/list.ts`.

## Architecture Decision 4: Module Directory Structure

### Chosen: `src/walkthrough/index.ts` + `src/walkthrough/show.ts`

**Rationale**: Consistent with comments (`src/comments/index.ts` + `list.ts` + `post.ts`) and inspect (`src/inspect/index.ts` + subcommand files`) patterns. Even though MVP has no subcommands, the module directory provides a natural extension point. Router logic in `index.ts`, display/fetch logic in `show.ts`.

## Core API/Methods

### New: `src/walkthrough/index.ts`

```typescript
// Router function registered in main src/index.ts
export async function runWalkthrough(config: HxConfig, args: string[]): Promise<void>
```

- Resolves `--ticket` from flag or `HELIX_TICKET_ID` env (reuses `resolveTicketId` pattern from comments/index.ts:11-19)
- Resolves `--run` from flag or defaults to `"latest"`
- Resolves `--format` from flag or defaults to `"text"`
- Delegates to `cmdShow(config, ticketId, runId, format)`
- Prints usage if no valid flags found

### New: `src/walkthrough/show.ts`

```typescript
export async function cmdShow(
  config: HxConfig,
  ticketId: string,
  runId: string,
  format: "text" | "json"
): Promise<void>
```

- Calls `hxFetch(config, /tickets/${ticketId}/runs/${runId}/walkthrough, { basePath: "/api" })`
- Handles null walkthrough: prints "No walkthrough available" (text) or `{ "walkthrough": null }` (json)
- Text format: renders step-by-step with file:line, descriptions, categories, diff excerpts
- JSON format: `console.log(JSON.stringify({ ticket: ticketId, run: runId, walkthrough }, null, 2))`

### New: `src/lib/categorize-file.ts`

- ~30 lines of file-path pattern matching (same logic as client version)
- Returns category string for architectural labeling in text output
- Shared with text formatter

### Modified: `src/index.ts`

- Add `case "walkthrough":` to the switch router
- Import `runWalkthrough` from `./walkthrough/index.js`
- Add usage line: `hlx walkthrough [--ticket <id>] [--run <id>] [--format json|text]`

## Technical Decisions

### TD-1: Text output optimized for "scan in 2 minutes"
The text format is designed for a developer to scan in under 2 minutes and answer: "Did this change respect the codebase's major arteries?" The summary header shows which architectural areas are touched. Each step shows the category label, file path, description, and diff excerpt. A developer can quickly identify if major areas (API Surface, Schema) are affected and drill into those steps.

### TD-2: Diff excerpts in text format limited to ~20 lines per step
For long diffs, the text format shows the first ~20 lines of the relevant file's diff (from `fileDiffs`). This keeps output scannable. The JSON format includes the full diff for coding agent consumption.

### TD-3: No HELIX_RUN_ID environment variable
The `latest` default is correct for ~90% of CLI usage. When a specific run is needed, `--run <id>` is explicit. Adding env vars increases implicit configuration surface without clear benefit.

### TD-4: Error handling follows existing patterns
- **Null walkthrough**: Print clear message and exit 0 (not an error — data may not be generated yet)
- **Non-200 response**: `hxFetch` throws with clear error message → top-level catch in index.ts prints and exits 1
- **Network failure**: `hxFetch` retries 3 times with exponential backoff (existing behavior)

### TD-5: No ANSI escape codes in MVP
Ensures output works in all contexts: terminals, piped output, CI logs, coding agent input. Future enhancement can add color gated behind TTY detection (`process.stdout.isTTY`).

### TD-6: Replaces generic "Continue with Claude Code" for CLI users
The `hlx walkthrough --format json` output gives Claude Code (or any coding agent) the complete walkthrough context: step descriptions, file paths, architectural rationale, and diff data. This replaces the generic "find repos, checkout branches, analyze changes" prompt that the current clipboard feature provides. The client-side `buildClaudeCodeCommand()` will also be enhanced to include the `hlx walkthrough` command (see client tech-research).

## Cross-Platform Considerations

- **macOS, Linux, Windows**: Node.js CLI. No ANSI codes in MVP ensures compatibility.
- **Coding agents**: JSON output is universally parseable by Claude Code, Cursor, Windsurf, etc.
- **CI/CD**: Text output works in CI logs for automated review pipelines.
- **Pipe-friendly**: Both formats work with shell pipes (`hlx walkthrough --format json | jq '.walkthrough.summary'`).

## Performance Expectations

| Concern | Expected | Notes |
|---------|----------|-------|
| Network latency | < 500ms total | Single GET request; server < 200ms; network varies |
| Text rendering | < 10ms | Synchronous string concatenation |
| JSON rendering | < 5ms | Single JSON.stringify call |
| CLI startup | ~100-200ms | Node.js cold start; consistent with existing commands |

## Dependencies

| Dependency | Type | Status | Risk |
|------------|------|--------|------|
| Node.js 18+ | Runtime | Existing | None |
| TypeScript | Build | Existing | None |
| hxFetch (internal) | HTTP client | Existing | None — proven for comments/inspect |

No new external dependencies required.

## Deferred to Round 2

- **Interactive terminal TUI**: Arrow-key navigation between steps, syntax-highlighted diffs, scrollable panes. Requires TUI library (e.g., ink). Product explicitly defers this.
- **Auto-pull of finished tickets**: Automatically surfacing walkthroughs when a dev opens their coding agent session. Requires deeper third-party integration.
- **`hlx walkthrough --regenerate`**: Trigger re-generation via POST endpoint when stored data is stale or missing. MVP only reads pre-computed data.
- **ANSI color output**: Color-coded diffs (green/red) and category badges in terminal. Gated behind TTY detection. Enhancement, not MVP.
- **Lint and test scripts**: CLI has no lint or test configuration. Valuable but orthogonal.

## Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Command structure | Single `hlx walkthrough` command | Read-only; single action; minimal learning curve |
| Output format | `--format json\|text`, default text | Serves both terminal users and coding agents |
| Server endpoint | New GET /walkthrough (not POST) | Reads pre-computed data; avoids expensive re-generation |
| Code structure | Module directory (walkthrough/index.ts + show.ts) | Consistent with comments/inspect patterns |
| Run resolution | `--run <id>` flag; default `latest` | Server resolves `latest` — avoids double round-trip |
| Diff excerpts | First ~20 lines per step in text; full in JSON | Scannable text; complete data for agents |
| Architectural labels | Per-step category from file-path matching | Instant artery identification; same pattern as client |

## APL Statement Reference

See `tech-research/apl.json` for the investigation trail. Diagnosis APL findings carried forward:
- CLI has zero walkthrough capability (src/index.ts: only login, inspect, comments)
- Comments command pattern is directly reusable
- Server POST endpoint is semantically wrong for CLI reads
- buildClaudeCodeCommand in client passes zero walkthrough context

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| diagnosis/diagnosis-statement.md (CLI) | Feasibility assessment | CLI has right patterns; needs new command + server GET endpoint |
| diagnosis/apl.json (CLI) | CLI evidence | Existing patterns reusable; server dependency confirmed |
| product/product.md (client) | Product requirements | `hlx walkthrough`; dual format; replace Claude Code handoff |
| scout/reference-map.json (CLI) | CLI file inventory | 3 commands, HTTP client with retry, HELIX_TICKET_ID pattern |
| scout/scout-summary.md (CLI) | CLI analysis | comments is closest analog; HTTP client ready |
| repo-guidance.json | Repo intent | CLI is target for new walkthrough command |
| src/index.ts (source) | Command routing structure | Switch-based; 57 lines; trivial to extend |
| src/comments/index.ts (source) | Template pattern | resolveTicketId with --ticket + HELIX_TICKET_ID env var |
| src/comments/list.ts (source) | Data-fetching pattern | hxFetch with basePath '/api'; formatted console output |
| src/lib/http.ts (source) | HTTP client capabilities | Retry 3x, exponential backoff, basePath, auth headers |
| ticket-detail.tsx (source, lines 582-628) | Current Claude Code handoff | Generic prompt, zero walkthrough data — the gap CLI fills |
| Server tech-research | Server-side GET endpoint design | GET /walkthrough with 'latest' resolution; attachInspectionAuth |
| merge-analysis-service.ts (source, lines 71-126) | categorizeFile() pattern | File-path categorization for architectural labels |

# Tech Research — Bug In Chaining (helix-cli)

## Technology Foundation

- **Runtime**: Node.js with TypeScript
- **Build**: `tsc` (npm run build)
- **Test runner**: Node's built-in `node --test` on compiled JS (`tsc && node --test dist/**/*.test.js`)
- **Package**: `@projectxinnovation/helix-cli` with `hlx` bin entry
- **Quality gates**: `npm run typecheck` (tsc --noEmit), `npm test`

## Architecture Decision

### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: New `hlx tickets report` subcommand** | Add `src/tickets/report.ts` following the `artifact.ts` pattern, wrapping `GET /tickets/:ticketId/report` | Straightforward; follows existing patterns; wraps existing server endpoint; independent access path | Does not directly help sandbox agents (CLI may not be available in sandbox) |
| B: Extend `hlx tickets get` to include report content | Add report output to the existing get command | No new subcommand | Mixes metadata with content; get is for ticket metadata, not document content |
| C: No CLI change | Rely solely on server-side auto-populate fix | Fewer changes | User explicitly expects CLI as a report access path |

### Chosen Option: A — New `hlx tickets report` subcommand

**Rationale**: The user explicitly expects CLI as one of multiple independent report access paths. The server already has `GET /tickets/:ticketId/report` (routes/api.ts line 299) returning `{ report: { content, filename, generatedAt } | null }`. The CLI has `hxFetch` for authenticated API calls and `resolveTicketRef` for flexible ticket resolution. Following the `artifact.ts` pattern makes this a straightforward ~40-line implementation. The value is immediate for users and positions the CLI for potential future agent use.

## Core API/Methods

### New File: `src/tickets/report.ts`

**Pattern**: Follow `src/tickets/artifact.ts` structure.

1. Resolve ticket ref via `extractTicketRef` + `resolveTicket` (existing utilities)
2. Call `hxFetch(config, `/tickets/${ticketId}/report`, { basePath: "/api" })` 
3. Type the response as `{ report: { content: string; filename: string; generatedAt: string } | null }`
4. If `report` is non-null, output `report.content` to stdout
5. If `report` is null, output `"No research report found for this ticket."` and return (no error exit)

### Registration: `src/tickets/index.ts`

Add to the switch-case block:

```
case "report": {
  if (isHelpRequested(rest)) {
    console.log("Usage: hlx tickets report <ticket-ref>\n\n...");
    process.exit(0);
  }
  const rawRef = extractTicketRef(rest);
  const resolved = await resolveTicket(config, rawRef);
  await cmdTicketsReport(config, resolved.id);
  break;
}
```

Add to the usage help string:
```
hlx tickets report <ticket-ref>
```

Add import:
```
import { cmdTicketsReport } from "./report.js";
```

### Server Endpoint (no changes needed)

The endpoint `GET /tickets/:ticketId/report` in helix-global-server already:
- Returns `{ report: { content, filename, generatedAt } | null }` when report exists
- Returns `{ report: null }` when no report exists
- Handles authorization via the existing auth middleware
- Is registered at routes/api.ts line 299

## Technical Decisions

### Decision: Output raw markdown content to stdout

**Chosen**: Output `report.content` directly, no formatting.

**Rationale**: Follows the `artifact.ts` pattern which outputs raw file content. This allows piping (`hlx tickets report RSH-443 > report.md`) and programmatic use. Users who want formatted output can pipe through a markdown renderer.

**Rejected alternative**: Rendering markdown with ANSI colors. This adds complexity, a dependency (e.g., `marked-terminal`), and interferes with piping.

### Decision: Non-error exit when no report exists

**Chosen**: Output a human-readable message and return normally when no report exists (rather than `process.exit(1)`).

**Rationale**: "No report" is not an error condition — many ticket types (BUILD, FIX) don't produce reports. An error exit would make scripting harder. The `artifact.ts` command uses a similar pattern: "No artifact files found for this step/repo." with a normal return (line 57).

### Decision: No `--json` flag in MVP

**Chosen**: Defer structured JSON output.

**Rationale**: The primary use case is reading the report content. A `--json` flag that outputs `{ content, filename, generatedAt }` is useful but can be added later without breaking changes.

## Cross-Platform Considerations

The CLI report command works for all users with CLI access. Whether agents in sandbox environments can use it depends on sandbox configuration (CLI installation, auth credentials, network access) — this is unknown and out of scope for this fix. The server-side auto-populate fix in helix-global-server is the primary fix; the CLI command is an independent access path.

## Performance Expectations

**Minimal**: Single API call per invocation. Report content is fetched from blob storage server-side (the same path used by the orchestrator and web UI). No caching needed for a CLI tool.

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| `hxFetch` | Existing (src/lib/http.ts) | Authenticated API calls |
| `extractTicketRef` | Existing (src/lib/resolve-ticket.ts) | Ticket ref parsing |
| `resolveTicket` | Existing (src/lib/resolve-ticket.ts) | Ticket ref resolution |
| `HxConfig` | Existing (src/lib/config.ts) | Config type |

No new dependencies are required.

## Test Strategy

**New test file**: `src/tickets/report.test.ts`

**Test cases**:
1. Report exists — outputs content to stdout
2. Report is null — outputs "no report" message
3. API error — outputs error message and exits with error

**Test pattern**: Follow the existing test pattern. The CLI tests compile to JS first, then run with `node --test dist/**/*.test.js`. Mock the `hxFetch` call to return test data.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Server endpoint returns unexpected format | Very Low — endpoint is already used by the web UI | Type the response and handle null gracefully |
| CLI not available in agent sandboxes | Unknown — depends on sandbox config | CLI command has immediate value for users regardless |
| Auth token missing or expired | Low — same risk as all other CLI commands | hxFetch already handles auth errors consistently |

## Deferred to Round 2

- `--json` flag for structured output
- Adding report content to `hlx tickets get` output
- Exposing relationship fields (afterTicketId, implementFromTicketId) in `hlx tickets get`
- Verifying and enabling CLI access in agent sandbox environments

## Summary Table

| Aspect | Decision |
|--------|----------|
| New file | `src/tickets/report.ts` (~40 lines) |
| Registration | `src/tickets/index.ts` switch-case + usage string + import |
| Server endpoint | `GET /tickets/:ticketId/report` (existing, no changes) |
| Output | Raw markdown content to stdout |
| No-report behavior | Human-readable message, normal exit |
| Pattern | Follows `artifact.ts` structure |
| New dependencies | None |
| Lines changed | ~40 lines new file + ~15 lines index.ts additions |

## APL Statement Reference

The CLI report command is a straightforward new file (src/tickets/report.ts) following the artifact.ts pattern. It resolves a ticket ref, calls GET /tickets/:ticketId/report via hxFetch, and outputs report.content to stdout or a clear "no report" message. Registration in index.ts follows the existing switch-case pattern.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Scope and context | User expects CLI as one of multiple independent report access paths |
| scout/reference-map.json (helix-cli) | Key files and CLI architecture | No report command exists; hxFetch and resolveTicketRef available |
| scout/scout-summary.md (helix-cli) | CLI analysis and server endpoint | Server endpoint wrappable; existing command patterns documented |
| diagnosis/apl.json (helix-cli) | Validated diagnosis answers | Confirmed no report command; server endpoint returns { report: { content, filename, generatedAt } } |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause and proposed fix | CLI gap confirmed; hxFetch available |
| product/product.md (helix-cli) | Product requirements and scope | hlx tickets report subcommand following artifact.ts pattern |
| repo-guidance.json | Repo intent | helix-cli is tertiary change target |
| src/tickets/artifact.ts | Direct code inspection | Pattern to follow: resolveTicket + hxFetch + stdout output |
| src/tickets/index.ts | Direct code inspection | Switch-case registration pattern, usage help string |
| src/lib/http.ts | Direct code inspection (via scout) | hxFetch utility for authenticated API calls |
| src/lib/resolve-ticket.ts | Direct code inspection (via scout) | extractTicketRef + resolveTicket for flexible ticket refs |

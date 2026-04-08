# Tech Research: helix-cli

## Technology Foundation

- **Runtime**: Node.js + TypeScript (ES2022, Node16 modules)
- **Dependencies**: Zero runtime dependencies (only devDependencies: typescript, @types/node)
- **CLI framework**: None — manual `process.argv` switch routing
- **HTTP client**: Custom `hxFetch` with retry (3 attempts), timeout (30s), exponential backoff
- **Auth**: Env vars (HELIX_API_KEY, HELIX_INSPECT_TOKEN) > file config (~/.hlx/config.json); hxi_ keys use X-API-Key header, others use Bearer
- **Quality gates**: `npm run build` (tsc), `npm run typecheck` (tsc --noEmit); no test or lint scripts
- **Package**: `@projectxinnovation/helix-cli`, binary name `hlx`

## Architecture Decision

### Decision 1: HTTP Client Generalization

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Add basePath parameter to hxFetch | Optional parameter defaulting to '/api/inspect' | Single HTTP function; backward-compatible; minimal change | Slightly broader function signature |
| B. Create parallel hxApiFetch function | New function with '/api' base path | Zero impact on existing code | Code duplication; two functions doing the same thing |
| C. Remove base path entirely | Callers provide full path including /api/inspect or /api | Most flexible | Breaking change to all existing callers |

**Chosen: Option A** — Add optional `basePath` parameter to `hxFetch`.

**Rationale**: The existing `hxFetch` is well-implemented with retry, timeout, and backoff logic. Duplicating it (Option B) wastes code and creates maintenance burden. Option C is a breaking change. Adding `basePath?: string` (defaulting to `'/api/inspect'`) is a one-line URL construction change. All existing callers (inspect commands) continue working unchanged. Comment commands pass `basePath: '/api'` and construct paths like `/tickets/${ticketId}/comments`. The auth header logic already works generically.

### Decision 2: Command Structure

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Top-level 'comments' command group | `hlx comments list` / `hlx comments post` | Matches inspect pattern; clear namespace | New top-level command |
| B. Subcommands under 'inspect' | `hlx inspect comments list` | Groups with existing inspect commands | Comments are not "inspection"; confusing semantics |
| C. Flat commands | `hlx list-comments` / `hlx post-comment` | Simple | Doesn't scale; inconsistent with inspect subcommand pattern |

**Chosen: Option A** — Top-level 'comments' command group.

**Rationale**: Comments are a distinct capability from inspection. The ticket explicitly describes "the Helix CLI through which sandbox agents communicate" — comments are a communication mechanism, not an inspection tool. The top-level command group mirrors the `inspect` pattern: `hlx comments list` parallels `hlx inspect repos`. The subcommand dispatch pattern from inspect/index.ts (getFlag, getPositionalArgs) is directly replicable.

### Decision 3: Ticket ID Resolution

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. --ticket flag + HELIX_TICKET_ID env var | Flag takes priority; env var as fallback | Works for both sandbox and external CLI | Needs server-side env var injection |
| B. Parse from ticket.md path | Extract ticket ID from artifact directory structure | No new env var needed | Fragile; depends on path structure; not available to external users |
| C. --ticket flag only | Always require explicit flag | Simple | Agents must always pass the flag; can't leverage env auto-detection |

**Chosen: Option A** — `--ticket` flag with `HELIX_TICKET_ID` env var fallback.

**Rationale**: In sandboxes, agents should get the ticket ID automatically without parsing paths. The HELIX_TICKET_ID env var follows the established pattern (HELIX_INSPECT_TOKEN, HELIX_INSPECT_BASE_URL). External CLI users always specify `--ticket`. The resolution order is: `--ticket` flag > `HELIX_TICKET_ID` env var > error message.

## Core API/Methods

### Modified: hxFetch (src/lib/http.ts)

Add optional `basePath` parameter:

```typescript
export async function hxFetch(
  config: HxConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown>; queryParams?: Record<string, string>; basePath?: string } = {},
): Promise<unknown> {
  const method = options.method ?? "GET";
  const base = options.basePath ?? "/api/inspect";
  const url = new URL(`${config.url}${base}${path}`);
  // ... rest unchanged
}
```

### New: src/comments/index.ts

Dispatch function following inspect/index.ts pattern:

- Parse subcommand from args[0]
- Route 'list' to cmdList, 'post' to cmdPost
- Resolve ticketId from --ticket flag or HELIX_TICKET_ID env var
- Print usage on unknown subcommand

### New: src/comments/list.ts

`hlx comments list [--ticket <id>] [--helix-only] [--since <iso-date>]`

- GET /api/tickets/:ticketId/comments via hxFetch with basePath='/api'
- Optional --helix-only: filter comments where isHelixTagged=true (client-side filter)
- Optional --since: filter comments after given ISO date (client-side filter)
- Output format: `[timestamp] author (helix-tagged|agent): content` — human-readable and agent-parseable

### New: src/comments/post.ts

`hlx comments post [--ticket <id>] <message>`

- POST /api/tickets/:ticketId/comments via hxFetch with basePath='/api'
- Body: `{ content: message, isHelixTagged: true }` (agent comments are always Helix-tagged)
- Print confirmation with comment ID on success
- Print clear error on failure

### Modified: src/index.ts

Add 'comments' case to the switch router:

```typescript
case "comments": {
  const config = requireConfig();
  await runComments(config, args.slice(1));
  break;
}
```

Update usage() to include comment commands.

## Technical Decisions

### Ticket ID from Environment

The CLI will read `HELIX_TICKET_ID` from `process.env` directly in the comments dispatch function, not through the config system. This keeps it separate from the existing config loading (which is auth-focused) and avoids adding ticket context to HxConfig (which is a server connection config type).

```typescript
function resolveTicketId(args: string[]): string {
  const flagValue = getFlag(args, "--ticket");
  if (flagValue) return flagValue;
  const envValue = process.env.HELIX_TICKET_ID;
  if (envValue) return envValue;
  console.error("Error: --ticket <id> flag or HELIX_TICKET_ID env var is required.");
  process.exit(1);
}
```

### Rejected Alternative: Commander.js / Yargs

The CLI has zero runtime dependencies by design. Adding a CLI framework would break this constraint. The manual argv routing is simple and sufficient for the small command set.

### Output Format

Comment list output is designed for dual consumption (human terminal + agent parsing):

```
[2026-04-08T10:30:00Z] Jane Doe [Helix]: Can you also check the migration file?
[2026-04-08T10:35:00Z] Helix [Agent]: I'll review the migration file as part of my analysis.
```

The `[Agent]` marker on agent-authored comments helps agents identify their own prior responses.

## Cross-Platform Considerations

Not applicable — CLI runs in Node.js environments (sandbox and developer terminals).

## Performance Expectations

| Operation | Expected Latency | Notes |
|-----------|-----------------|-------|
| `hlx comments list` | <200ms | Single HTTP GET with retry logic |
| `hlx comments post` | <200ms | Single HTTP POST with retry logic |
| Ticket ID resolution | <1ms | Env var read or flag parse |

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Server comment auth changes | Cross-repo | Must be deployed first — comment routes must accept inspection tokens |
| HELIX_TICKET_ID env var | Cross-repo | Server orchestrator must inject into env.sh |
| hxFetch retry/timeout logic | Internal | Exists, reusable with basePath parameter |
| getFlag/getPositionalArgs helpers | Internal | Exist in inspect/index.ts; can be duplicated or extracted |

## Deferred to Round 2

- **Comment streaming/watching**: A `hlx comments watch` that polls for new comments (not needed for MVP — agents check at step boundaries)
- **Rich formatting in CLI output**: Markdown rendering in terminal (MVP uses plain text)
- **Comment deletion via CLI**: Only list and post needed for MVP
- **Shared arg parsing utilities**: Extracting getFlag/getPositionalArgs to lib/args.ts (fine to duplicate for now given small codebase)

## Summary Table

| Area | Decision | Key File(s) |
|------|----------|-------------|
| HTTP client | Add basePath parameter to hxFetch (default '/api/inspect') | src/lib/http.ts |
| Command structure | Top-level 'comments' group with list/post subcommands | src/index.ts, src/comments/index.ts |
| List command | GET comments with optional --helix-only and --since filters | src/comments/list.ts |
| Post command | POST comment with auto isHelixTagged=true | src/comments/post.ts |
| Ticket ID | --ticket flag > HELIX_TICKET_ID env var > error | src/comments/index.ts |
| Output format | Human-readable + agent-parseable timestamp-author-content lines | src/comments/list.ts |

## APL Statement Reference

The CLI needs three changes: (1) Generalize hxFetch with an optional basePath parameter (default '/api/inspect') so comment commands can target /api/tickets/:id/comments. (2) Add hlx comments list and hlx comments post subcommands following the existing inspect command pattern. (3) Support HELIX_TICKET_ID env var for automatic ticket resolution in sandboxes, with --ticket flag as override. Zero new runtime dependencies; existing zero-dep philosophy preserved.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| diagnosis/diagnosis-statement.md (CLI) | Identify three CLI gaps | No comment commands, HTTP path limitation, ticket ID not available |
| diagnosis/apl.json (CLI) | Detailed Q&A for each gap | hxFetch hardcodes /api/inspect; subcommand pattern reusable; HELIX_TICKET_ID needed |
| product/product.md (client) | CLI feature requirements | hlx comments list and hlx comments post as MVP features; HELIX_TICKET_ID env var |
| scout/reference-map.json (CLI) | File inventory | index.ts, http.ts, config.ts, inspect/index.ts as key files |
| scout/scout-summary.md (CLI) | CLI current state | Zero deps, argv routing, hxFetch hardcoded path, auth priority chain |
| src/index.ts (lines 1-48) | CLI entry point | Switch router with login, inspect, --version; pattern for adding comments |
| src/lib/http.ts (lines 37-44) | HTTP client implementation | Hardcoded /api/inspect base path; auth header logic generic |
| src/lib/config.ts (lines 1-47) | Config loading | Env var priority; HxConfig type (apiKey + url) |
| src/inspect/index.ts (all) | Subcommand dispatch pattern | getFlag, getPositionalArgs helpers; switch-based routing |
| repo-guidance.json | Repo intent classification | CLI is target for net-new comment commands |

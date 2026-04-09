# Scout Summary — helix-cli

## Problem

helix-cli (`hlx`) is the production inspection CLI used by agents and engineers to query databases, fetch logs, inspect APIs, and manage ticket comments. For the "Monitoring with Auto Solve" feature, helix-cli is the primary tool through which the monitoring agent probes Helix Global production environments and communicates monitoring status.

## Analysis Summary

### Current Capabilities Relevant to Monitoring

1. **Database Inspection** (`hlx inspect db`) — Execute read-only SQL against production databases. The monitoring agent can check record counts, verify data integrity, query for error conditions, or validate business logic outcomes.

2. **Log Fetching** (`hlx inspect logs`) — Query production logs via BetterStack ClickHouse backend. The monitoring agent can search for expected success log patterns or error signatures.

3. **API Inspection** (`hlx inspect api`) — Probe production API endpoints. The monitoring agent can verify health checks, response correctness, and endpoint availability.

4. **Comment Management** (`hlx comments post/list`) — Post agent-authored status updates to tickets and read existing comments. The monitoring agent communicates its findings (check passed, check failed, waiting for data) via ticket comments.

5. **Repository Discovery** (`hlx inspect repos`) — List repositories and their available inspection types. The monitoring agent can dynamically discover what's inspectable.

### Integration With Helix Workflow

helix-cli is already integrated into the Helix workflow pipeline:
- Sandbox runs inject `HELIX_TICKET_ID` and `HELIX_INSPECT_TOKEN` as environment variables
- The CLI resolves ticket context from these env vars
- Workflow step agents can use `hlx` commands during execution

The monitoring agent would use the same authentication and environment patterns.

### Resilience

The HTTP client (`src/lib/http.ts`) provides production-grade resilience:
- 3 retry attempts with exponential backoff (2s base)
- Retry on transient errors (429, 500, 502, 503, 504)
- 30-second timeout per request
- Retry-After header support for rate limiting

## Relevant Files

| File | Role |
|------|------|
| `src/inspect/db.ts` | Database inspection command |
| `src/inspect/logs.ts` | Log fetching command |
| `src/inspect/api.ts` | API inspection command |
| `src/inspect/repos.ts` | Repository discovery |
| `src/comments/post.ts` | Agent comment posting |
| `src/comments/list.ts` | Comment listing with filters |
| `src/lib/http.ts` | Resilient HTTP client |
| `src/lib/config.ts` | Auth configuration |
| `src/lib/resolve-repo.ts` | Repository resolution |
| `src/index.ts` | CLI entry point |
| `package.json` | Package metadata |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Feature requirements | Monitoring agent needs runtime inspection and ticket communication. hlx provides both. |
| src/index.ts | Map all CLI commands | 6 command groups: login, inspect (db/logs/api/repos), comments (list/post). |
| src/lib/http.ts | Understand resilience patterns | 3 retries, exponential backoff, rate-limit aware. Production-grade. |
| src/lib/config.ts | Understand auth patterns | Supports env vars (HELIX_API_KEY, HELIX_INSPECT_TOKEN) and config file (~/.hlx/config.json). |
| package.json | Verify tech stack and quality gates | TypeScript 6, Node 25+, zero runtime deps. Build: tsc. Typecheck: tsc --noEmit. |

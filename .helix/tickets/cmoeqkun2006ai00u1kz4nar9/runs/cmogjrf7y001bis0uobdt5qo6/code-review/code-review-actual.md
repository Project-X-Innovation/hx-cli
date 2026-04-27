# Code Review: helix-cli

## Review Scope

Reviewed all source files in the helix-cli implementation: the 3 files changed by the implementation agent (`get.ts`, `artifact.ts`, `bundle.ts`) plus all 13 new source files across `src/org/` (4 files) and `src/tickets/` (10 files), the shared library modules (`config.ts`, `http.ts`, `flags.ts`), the CLI entry point (`index.ts`), and `package.json`/`tsconfig.json`. Cross-referenced against ticket requirements, product spec, implementation plan, and diagnosis.

## Files Reviewed

| File | Review Focus |
|---|---|
| `src/tickets/get.ts` | Implementation fix: TicketResponse wrapper unwrap |
| `src/tickets/artifact.ts` | Implementation fix: TicketResponse wrapper unwrap |
| `src/tickets/bundle.ts` | Implementation fix: TicketResponse wrapper unwrap |
| `src/tickets/continue.ts` | Continuation context extraction from args |
| `src/tickets/create.ts` | Flag parsing and API body |
| `src/tickets/rerun.ts` | Rerun endpoint call |
| `src/tickets/list.ts` | Filters, user resolution, client-side status filter |
| `src/tickets/latest.ts` | Latest ticket resolution via printTicketDetail |
| `src/tickets/artifacts.ts` | Artifact listing and step artifact summary |
| `src/tickets/index.ts` | Subcommand routing and ticket ID resolution |
| `src/org/current.ts` | MeResponse handling |
| `src/org/list.ts` | Org listing with current marker |
| `src/org/switch.ts` | Org resolution, switch-org API, config persistence |
| `src/org/index.ts` | Org subcommand routing |
| `src/lib/config.ts` | Config model, load/save, env var priority |
| `src/lib/http.ts` | hxFetch retry logic, auth dispatch, error handling |
| `src/lib/flags.ts` | Flag parsing utilities |
| `src/index.ts` | CLI entry point, command routing, version |
| `package.json` | Version 1.2.0, zero prod deps, build scripts |
| `tsconfig.json` | ES2022 target, strict mode, Node16 module |

## Missed Requirements & Issues Found

### Correctness / Behavior Issues

**CR-01: `continue` command includes ticket ID in continuation context (Bug - Fixed)**

When a user runs `hlx tickets continue <ticket-id> "context text"` with a positional ticket ID, the continuation context sent to the backend includes the ticket ID prepended to the actual context text.

**Root cause**: In `src/tickets/index.ts`, the `continue` case calls `resolveTicketId(rest)` to extract the ticket ID from the first positional argument, but then passes the full `rest` array (still containing the ticket ID) to `cmdTicketsContinue`. Inside `continue.ts`, `getPositionalArgs(args, ["--ticket"])` returns all non-flag args including the ticket ID, which gets joined into `continuationContext`.

**Trace**:
- User: `hlx tickets continue cmxxxx "hello world"`
- `rest = ["cmxxxx", "hello world"]`
- `resolveTicketId(rest)` returns `"cmxxxx"` (first positional)
- `cmdTicketsContinue(config, "cmxxxx", ["cmxxxx", "hello world"])`
- `getPositionalArgs(...)` returns `["cmxxxx", "hello world"]`
- `continuationContext = "cmxxxx hello world"` -- **WRONG**, should be `"hello world"`

**Severity**: Medium. This affects the primary documented usage pattern for `continue`. The `--ticket` flag and `HELIX_TICKET_ID` env var paths were unaffected.

**Fix applied**: Skip the first positional arg if it matches the already-resolved ticket ID.

### Requirements Gaps

None. All ticket acceptance criteria are addressed:
- Org commands (current/list/switch): Implemented and verified at runtime
- Ticket discovery (list/latest/get): Implemented with filters
- Ticket filters (--user, --status, --status-not-in, --archived, --sprint): All present
- Artifact inspection: List and raw content read implemented
- Bundle: Deterministic local context with ticket.json, manifest.json, artifacts/
- Ticket actions (create, rerun, continue): All implemented
- Continue uses rerun endpoint with continuationContext: Correct
- Thin client: No client-side data invention

### Regression Risks

None identified. The implementation fix (`TicketResponse` unwrap in 3 files) was correct and necessary. The `printTicketDetail` function exported from `get.ts` is shared with `latest.ts`, and the fix cascades correctly since `latest.ts` calls `printTicketDetail(config, latest.id)` which internally fetches and unwraps its own data.

### Code Quality / Robustness

- **Hardcoded version**: `"1.2.0"` is hardcoded in both `src/index.ts` (line 66) and `src/tickets/bundle.ts` (line 78: `cliVersion`). If `package.json` version changes, these become stale. This is a pre-existing design choice (zero deps means no package.json reader). Low risk for now.
- **Config env var priority**: When `HELIX_API_KEY` + `HELIX_URL` env vars are set, `loadConfig()` always returns them, ignoring the config file. This means `org switch` (which saves a new token to the config file) is ineffective when env vars are present. This is a pre-existing design choice, not introduced by this implementation.

### Verification / Test Gaps

- CHK-10 (step artifact raw content read) was blocked by test database lacking step artifacts. The code path exercises correctly up to the API call.
- `continue`, `create`, and `rerun` commands were not live-tested to avoid creating real tickets/runs.

## Changes Made by Code Review

| File | Line(s) | Description |
|---|---|---|
| `src/tickets/continue.ts` | 12-15 | Fixed bug where positional ticket ID leaked into continuation context. Added check to skip first positional arg when it matches the resolved `ticketId`. |

## Remaining Risks / Deferred Items

1. **CHK-10 unverifiable**: Step artifact raw content read cannot be verified without test data containing step artifacts. Code path is correct by inspection.
2. **`continue`/`create`/`rerun` not live-tested**: These commands were not executed against the live API to avoid creating real resources. Error handling was verified. Code paths reviewed.
3. **Hardcoded version strings**: Version "1.2.0" is duplicated in 3 places (`package.json`, `index.ts`, `bundle.ts`). Future version bumps must update all three.

## Verification Impact Notes

- **CHK-06 (tickets list)**: Still valid. No changes to list flow.
- **CHK-07 (status-not-in filter)**: Still valid. No changes to filter flow.
- **CHK-08 (tickets get)**: Still valid. The get.ts fix was implementation-step work, not code-review.
- **CHK-10 (artifact read)**: Still blocked by test data. No change.
- **CHK-12 (error handling)**: The `continue` fix does not change error handling behavior -- the "Continuation context is required" error still fires correctly when no context is provided.

No verification checks are invalidated by code review changes. The `continue.ts` fix only affects the content of the `continuationContext` payload, not the command structure or error paths.

## APL Statement Reference

Found and fixed 1 bug in `src/tickets/continue.ts`: positional ticket ID was included in the continuation context sent to the rerun API. All other code reviewed and confirmed correct. TypeScript typecheck and build pass after fix. No verification checks invalidated.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md (helix-cli) | Primary specification | Full command surface, acceptance criteria, required behavior |
| implementation/implementation-actual.md (helix-cli) | Scope map of changed files | 3 files changed; used as starting point for review |
| implementation/apl.json (helix-cli) | Implementation evidence | 3 files fixed for wrapper unwrap; 14/15 checks pass |
| implementation-plan/implementation-plan.md (helix-cli) | Planned verification checks | 12 required checks mapped; identified which were and weren't live-tested |
| product/product.md | Product vision and feature spec | Confirmed all features covered; verified continue uses rerun endpoint |
| diagnosis/diagnosis-statement.md (helix-cli run root) | Gap analysis | No blocking gaps identified; thin client confirmed |
| repo-guidance.json | Cross-repo intent | helix-cli = primary target |
| src/tickets/continue.ts (direct inspection) | Bug identification | Traced positional arg flow: ticket ID leaks into continuation context |
| src/tickets/index.ts (direct inspection) | Routing and arg passing | Confirmed rest array passes unmodified ticket ID to continue handler |
| src/lib/flags.ts (direct inspection) | getPositionalArgs behavior | Confirmed function doesn't exclude unresolved positional ticket ID |

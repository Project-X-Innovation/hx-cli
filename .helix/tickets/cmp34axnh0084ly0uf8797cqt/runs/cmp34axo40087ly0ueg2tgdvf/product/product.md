# Product: Resolve archived ticket references in hlx CLI

## Problem Statement

The `hlx` CLI fails to find archived tickets when a user passes an archived ticket reference to any command that targets a specific ticket. The shared resolver (`resolveTicket()`) only searches active tickets, so it reports "ticket not found" for archived tickets — even though the server already supports returning archived ticket data by ID. This affects 9 commands across the CLI: `tickets get`, `update-description`, `rerun`, `continue`, `artifacts`, `artifact`, `bundle`, `comments list`, and `comments post`.

## Product Vision

Ticket reference resolution must be transparent to archive state. A user who knows a ticket ref should be able to use it with any single-ticket command regardless of whether that ticket is active or archived, without needing to declare or know the ticket's archive status up front.

## Users

- **Helix CLI users** who interact with tickets by reference (internal ID, short ID, or numeric ticket number).
- Primary scenario: a user wants to inspect, re-run, or comment on a ticket that has since been archived.

## Use Cases

1. **Retrieve an archived ticket's details** — a user runs `hlx tickets get <ref>` with a ref that points to an archived ticket and expects to see its details.
2. **Comment on an archived ticket** — a user runs `hlx comments list --ticket <ref>` or `hlx comments post --ticket <ref>` with an archived ticket ref and expects the command to reach the server.
3. **Re-run or continue an archived ticket** — a user runs `hlx tickets rerun <ref>` or `hlx tickets continue <ref>` and expects the CLI to resolve the ticket. If the server then rejects the operation for business reasons, the real server error should surface.
4. **View artifacts of an archived ticket** — a user runs `hlx tickets artifacts <ref>` or `hlx tickets artifact <ref>` and expects resolution to succeed.
5. **Genuinely missing ticket** — a user runs any command with a ref that does not exist in either active or archived tickets and still gets a clear "not found" error.

## Core Workflow

1. User runs a single-ticket command with a ticket reference.
2. The CLI resolver searches active tickets for a match.
3. If no active match is found, the resolver searches archived tickets.
4. If a match is found (active or archived), the resolved ticket ID is passed to the downstream command endpoint.
5. The downstream endpoint executes and returns results or a server error (which is surfaced as-is).
6. If no match exists in either set, the CLI reports "ticket not found."

## Essential Features (MVP)

1. **Archived fallback in resolver** — when the active ticket list does not contain a match, the resolver must also search archived tickets before reporting "not found."
2. **Cross-set ambiguity detection** — numeric ticket references must be checked for ambiguity across both active and archived ticket sets. A numeric ref matching one active and one archived ticket is ambiguous.
3. **Active-first priority** — if a ref matches an active ticket, that match is returned immediately. Archived data does not override an active match.
4. **Transparent to callers** — the 9 commands that use the resolver must not need changes. The resolver's interface and return type remain the same.
5. **Error transparency** — if an archived ticket is resolved but the downstream server endpoint rejects the operation, the real server error must surface. The CLI must not convert it into a fake "not found" error.
6. **Clear failure on resolution errors** — if the archived lookup itself fails (network/server error), the CLI must report a resolution-stage error rather than silently falling through to "not found."

## Features Explicitly Out of Scope (MVP)

- **Server-side changes** — no modifications to the ticket archive model on the server.
- **List/latest behavior changes** — `hlx tickets list` and `hlx tickets latest` keep their existing `--archived` flag semantics. Their behavior must not change.
- **New CLI flags** — no `--archived` flag added to any single-ticket command (`get`, `rerun`, `continue`, `artifacts`, `artifact`, `bundle`, `update-description`, `comments list`, `comments post`).
- **Archive management commands** — no new commands for archiving or unarchiving tickets.
- **UI changes outside the CLI** — no web UI or other interface changes.
- **Redesigning list/search UX** — no changes to how ticket listing or search works.

## Success Criteria

1. `hlx tickets get <archived-internal-id>` succeeds and prints ticket details.
2. `hlx tickets get <archived-short-id>` succeeds and prints ticket details.
3. `hlx tickets get <archived-ticket-number>` succeeds when the numeric ref is unambiguous across active and archived tickets.
4. `hlx comments list --ticket <archived-ref>` resolves the archived ticket and reaches the comments endpoint.
5. `hlx tickets artifacts <archived-ref>` resolves the archived ticket and reaches the artifacts endpoint.
6. A command against a genuinely missing ref still reports "not found."
7. Existing active-ticket resolution tests pass unchanged.
8. Regression test: an archived-only ticket is resolvable by the shared resolver.
9. Regression test: numeric ambiguity is detected across active and archived results.
10. Negative: `hlx tickets list` without `--archived` does not start returning archived tickets.

## Key Design Principles

- **Smallest correct change** — fix is localized to the shared resolver; no caller changes needed.
- **Preserve working behavior** — active ticket resolution is unchanged; list/latest semantics are unchanged.
- **Fail closed** — a resolver miss means the ticket truly does not exist in either active or archived results for the current org.
- **Error honesty** — the CLI never fabricates "not found" when the real failure is elsewhere (network error, server rejection, etc.).

## Scope & Constraints

- **Repo:** `helix-cli` only. No server-side changes.
- **Files affected:** `src/lib/resolve-ticket.ts` (fix) and `src/lib/resolve-ticket.test.ts` (tests). No other files need modification.
- **Test infrastructure:** Node's built-in test runner (`node:test`). No external mocking libraries. Tests must use `node:test` mock support.
- **Reference forms:** Internal ID, short ID (case-insensitive), and numeric ticket number must all continue to work.
- **API pattern:** Archived tickets are fetched via `GET /api/tickets?archived=true`, an established pattern already used by `list.ts` and `latest.ts`.

## Future Considerations

- If the API later supports a single call returning both active and archived tickets, the resolver could be simplified to a single fetch.
- If more ticket states are added beyond active/archived, the resolver pattern may need generalization.
- Performance: two API calls (active + archived) are needed today. If resolution latency becomes a concern, the API could be extended to support a combined query.

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|-----------------|--------|
| 1 | Does `GET /api/tickets?archived=true` return only archived tickets, or both active and archived? List.ts uses it as a toggle, suggesting archived-only. Must be confirmed during implementation. | Affects whether the resolver needs to deduplicate results or can treat the two sets as disjoint. |
| 2 | Is there a performance concern with making two parallel API calls (active + archived) during resolution? | Could increase resolution latency. Mitigated by parallelizing the two fetches. |
| 3 | Does `node:test`'s `mock.method`/`mock.fn` work reliably in the project's minimum Node 18 target? | Affects test implementation strategy for mocking `hxFetch` in `resolveTicket()` tests. |
| 4 | What are the exact server error shapes when downstream endpoints reject operations on archived tickets (e.g., rerun, continue)? | The CLI must surface these errors as-is; their exact format is unknown but does not block the resolver fix. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary problem statement, acceptance criteria, and decisions | Fix scoped to `resolveTicket()` in resolve-ticket.ts; must search both active and archived; must not change list/latest behavior; must detect cross-set ambiguity; no new flags. |
| `scout/scout-summary.md` | Consolidated analysis of resolver behavior and file roles | Confirmed matchTicket is pure and needs no change; downstream commands work with archived IDs; list/latest use separate code paths; test gap for resolveTicket(). |
| `scout/reference-map.json` | Detailed file-level evidence and unknowns | Confirmed resolve-ticket.ts:89 as exact defect location; all 9 call sites identified; API pattern from list.ts/latest.ts cataloged; hxFetch queryParams support verified. |
| `diagnosis/diagnosis-statement.md` | Root cause analysis and fix scope | Single root cause: active-only fetch at line 89. Secondary defect: active-only ambiguity check. Fix localized to resolveTicket() and its test file. No caller changes needed. |
| `diagnosis/apl.json` | Structured Q&A confirming diagnosis details | Confirmed matchTicket needs no changes; hxFetch needs no changes; node:test is the test runner; zero external mocking libraries. |
| `repo-guidance.json` | Repository intent classification | helix-cli is the sole target repo; no other repos involved. |

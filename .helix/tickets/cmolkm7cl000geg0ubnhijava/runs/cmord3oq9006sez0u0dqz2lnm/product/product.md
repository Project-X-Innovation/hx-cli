# Product: Improve Helix CLI Ticket Lookup, Help, JSON Output, and Inspection Ergonomics

## Problem Statement

Agents and operators using the Helix CLI cannot reliably look up tickets using the identifiers they see on screen. Running `hlx tickets get 339` or `hlx tickets get BLD-339` returns HTTP 404, even though those same tickets appear in `hlx tickets list`. The only workaround is to query the production database with `hlx inspect db` to obtain the internal CUID, then pass that CUID to `tickets get`. This defeats the CLI's purpose as an agent workbench and forces an unnecessary database dependency for routine ticket inspection.

Five additional defects compound the core lookup failure:
- **Help flags broken:** `--help` on ticket subcommands either errors out or executes normal command behavior instead of printing usage.
- **No machine-readable output:** Agents must parse formatted text tables because no `--json` flag exists on `tickets list` or `tickets get`.
- **Invalid timestamps:** `hlx tickets get` prints `Invalid Date` for run timestamps when the underlying data is valid.
- **Missing internal IDs in list output:** `tickets list` text output omits the internal ID field, hiding the only identifier the API actually accepts.
- **PowerShell quoting pain:** `hlx inspect db` accepts SQL only as positional arguments, making Postgres double-quoted identifiers (`"Tickets"`) nearly impossible to use from PowerShell.

These defects were discovered during live ticket inspection of tickets 339 and 340, as documented in the ticket source notes.

## Product Vision

The Helix CLI accepts any ticket reference an operator or agent can see -- internal ID, short ID (e.g., `BLD-339`), or plain ticket number (e.g., `339`) -- and resolves it consistently across all ticket commands. Machine-readable JSON output is available for agent workflows. Help flags work correctly everywhere. Timestamps render properly. The CLI is a self-sufficient workbench that does not require database access for standard ticket operations.

## Users

| User | Need |
|------|------|
| **Helix agents (automated)** | Programmatically look up, inspect, and act on tickets using short IDs or ticket numbers found in context; consume structured JSON output without fragile text parsing. |
| **Operators / developers** | Quickly inspect ticket status, runs, and artifacts from the terminal using the ticket identifiers visible in the UI or other tools. |
| **PowerShell users** | Run `inspect db` queries containing Postgres double-quoted identifiers without shell quoting failures. |

## Use Cases

1. **Agent inspects a ticket by number:** An agent has ticket number `339` from a workflow context. It runs `hlx tickets get 339 --json` and receives structured ticket details including status, runs, and full description.
2. **Operator checks ticket status by short ID:** An operator sees `BLD-339` in the Helix UI. They run `hlx tickets get BLD-339` and get the same detail view as if they had used the internal ID.
3. **Agent lists tickets for processing:** An agent runs `hlx tickets list --json` and receives a JSON array with all displayed fields plus internal IDs, enabling downstream lookups without extra resolution steps.
4. **Operator views artifacts:** An operator runs `hlx tickets artifacts 339` to see available artifacts, then `hlx tickets artifact 339 --step implementation --repo helix-global-server` to read one.
5. **Operator gets help on a command:** Running `hlx tickets get --help` prints usage information and exits without making any API calls or requiring a ticket ID.
6. **Operator reruns or continues a ticket:** `hlx tickets rerun 339` and `hlx tickets continue 339` accept the same reference formats and resolve them before executing.
7. **PowerShell user queries database:** An operator on PowerShell runs an `inspect db` query with Postgres quoted identifiers without shell quoting conflicts.

## Core Workflow

1. User provides a ticket reference (internal ID, short ID, or numeric ticket number) to any ticket subcommand.
2. The CLI resolves the reference to the internal ID using shared resolution logic.
3. If resolution fails, the CLI prints a clear error including the input reference and current org context, then exits.
4. If resolution succeeds, the command proceeds with the resolved internal ID.
5. Output renders in the requested format: human-readable text (default) or structured JSON (`--json`).

## Essential Features (MVP)

| # | Feature | User Impact |
|---|---------|-------------|
| F1 | **Shared ticket reference resolution** | All ticket commands (`get`, `artifacts`, `artifact`, `rerun`, `continue`, `bundle`) accept internal IDs, short IDs, and numeric ticket numbers interchangeably. |
| F2 | **JSON output for `tickets list`** | `--json` flag emits structured JSON including internal ID, short ID, status, title, reporter, and timestamps. |
| F3 | **JSON output for `tickets get`** | `--json` flag emits structured JSON with full (untruncated) description, repositories, runs, archived flag, and all standard fields. |
| F4 | **Subcommand help flags** | `--help` and `-h` on any ticket subcommand print usage and exit without validation or API calls. Top-level `hlx --help` also works correctly. |
| F5 | **Run timestamp fix** | Valid `createdAt` and `completedAt` values render as readable dates. Null `completedAt` shows "in progress" only when the run is actually incomplete. No more `Invalid Date`. |
| F6 | **Clear error messages on lookup failure** | Unresolved references produce an error that names the input reference, the current org, and suggests valid formats. No silent fallback to latest, first, or partial matches. |
| F7 | **PowerShell-safe inspect db** | Either a `--query` flag or documented PowerShell-safe examples for `inspect db` with Postgres quoted identifiers. |
| F8 | **Tests for new behavior** | Focused tests covering ID resolution (all formats + failure), JSON output, and help behavior. |

## Features Explicitly Out of Scope (MVP)

| Feature | Reason |
|---------|--------|
| CLI authentication rework | Decided out of scope; current auth works. |
| Org selection changes | Decided out of scope; current org semantics are unchanged. |
| API client layer replacement | Decided out of scope; existing client is adequate. |
| Backend ticket status / workflow changes | Scope is CLI-only; backend behavior is not changing. |
| Broad CLI redesign | Scope is limited to ticket and inspect commands. |
| Helix skill as primary fix | Decision already made to fix the CLI itself. |
| Ticket resolution caching | Not needed unless performance evidence warrants it. |
| Multi-reference batch resolution | Future consideration; current scope is single-reference per command. |
| Removing human-readable text output | Existing text output must remain; JSON is additive. |

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC1 | `hlx tickets get 339`, `hlx tickets get BLD-339`, and `hlx tickets get <internal-id>` all resolve and display the same ticket. | Run all three and compare output. |
| SC2 | `hlx tickets artifacts 339` lists the same artifacts as using the internal ID. | Run both and compare. |
| SC3 | `hlx tickets artifact 339 --step implementation --repo helix-global-server` resolves correctly. | Run with numeric ref and verify output matches internal-ID version. |
| SC4 | `hlx tickets rerun 339` and `hlx tickets continue 339` resolve the ticket before executing. | Run with numeric ref and verify the correct ticket is targeted. |
| SC5 | `hlx tickets list --json` emits valid JSON with internal IDs and all currently displayed fields. | Pipe output through a JSON validator. |
| SC6 | `hlx tickets get 339 --json` emits valid JSON with full description and structured runs/repositories. | Validate JSON structure and check description is not truncated. |
| SC7 | `hlx tickets get --help`, `hlx tickets list --help`, and `hlx tickets latest --help` print usage and make no API call. | Run each and verify no network requests occur. |
| SC8 | `hlx tickets get` displays valid dates for runs; no `Invalid Date` when timestamps exist. | Inspect output for a ticket with completed runs. |
| SC9 | Unresolved references fail with a clear error naming the input and org. | Run `hlx tickets get 999999` and verify error message. |
| SC10 | Tests cover internal ID, short ID, numeric number, unresolved lookup, JSON output, and help behavior. | Run test suite and verify all pass. |
| SC11 | `hlx inspect db` has PowerShell-safe documentation or a `--query` flag. | Verify help text or flag exists. |

## Key Design Principles

- **One resolver, many commands:** Ticket reference resolution is shared, not reimplemented per subcommand. This prevents drift and ensures consistent behavior.
- **Additive, not destructive:** JSON output is a new option. Existing text output remains the default and stays backwards-compatible.
- **Fail clearly, never silently:** Ambiguous or unresolved references produce explicit errors. No silent fallback to latest, first, or partial matches.
- **Help before work:** `--help` / `-h` must be intercepted before any validation, API calls, or side effects.
- **Minimal surface:** Fix the identified defects without redesigning unrelated CLI subsystems.

## Scope & Constraints

- **Repository:** helix-cli only. No backend API changes needed; the existing list endpoint already returns internal IDs and short IDs (confirmed by `latest.ts:44-45` and `TicketItem` type in `list.ts:5-12`).
- **Resolution approach:** Client-side matching against the list endpoint, following the proven pattern in `resolve-repo.ts`.
- **Test framework:** No test runner exists today. Node.js built-in `node:test` (available at Node >= 18) is a zero-dependency option.
- **TypeScript strict mode:** All new code must be type-safe under `strict: true`.
- **No persistence:** Ticket resolution does not cache results or write local files.
- **Duplicate code:** `resolveTicketId()` exists in both `src/tickets/index.ts` and `src/comments/index.ts`. The shared resolver should eliminate this duplication.

## Future Considerations

- **Backend search endpoint:** If ticket lists grow large enough that client-side resolution becomes slow, a backend endpoint accepting short IDs or ticket numbers directly would be more efficient. This is not needed now but would eliminate pagination concerns.
- **Multi-reference commands:** If commands later need to accept multiple ticket references, the resolver should handle each independently and report per-reference success/failure.
- **JSON output for other commands:** The `--json` pattern established here could extend to other CLI commands (e.g., `inspect`, `org`) in future work.
- **Pagination awareness:** If the list endpoint paginates and an org has many tickets, resolution might miss tickets beyond the first page. This is an unknown risk (see below).

## Open Questions / Risks

| # | Question / Risk | Impact | Mitigation |
|---|----------------|--------|------------|
| Q1 | Does the `/api/tickets` list endpoint paginate, and if so, can resolution miss tickets beyond the first page? | A numeric ticket number for an old ticket might fail to resolve if it's not in the first page of results. | Unknown until API response shape is confirmed. If paginated, resolution may need to fetch additional pages or the backend may need a lookup endpoint. Record as a risk and validate during implementation. |
| Q2 | What exact timestamp formats does the API return for `createdAt` / `completedAt`? | The fix for `Invalid Date` depends on knowing which inputs cause the failure. | Diagnosis confirms `new Date()` is the issue; implementation should add date-validity checking regardless of format. |
| Q3 | Does the `run` object in ticket detail include a `status` field that should be cross-referenced with `completedAt` for the "in progress" display? | Without cross-referencing, a run with `completedAt: null` but `status: "failed"` would still show "in progress". | Implementation should check whether the run object includes a status field and use it when available. |
| Q4 | What test framework does the team prefer? | No test infrastructure exists today. | `node:test` (zero dependencies, Node >= 18) is the simplest option. Confirm during implementation. |
| Q5 | Runtime inspection credentials were not available for this analysis. | Could not verify actual API response shapes, pagination behavior, or timestamp formats against live data. | Implementation should probe or document actual API responses. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `ticket.md` | Primary specification with acceptance criteria, scope, and decisions | Defined all 11 acceptance criteria, required behaviors, failure modes, and non-negotiable invariants. |
| `scout/scout-summary.md` | Synthesized codebase analysis | Confirmed 5 problem categories, identified `resolve-repo.ts` as existing pattern template, validated list endpoint returns internal IDs. |
| `scout/reference-map.json` | Detailed file map with line-level facts and unknowns | Identified all 20 relevant source files, confirmed `resolveTicketId()` raw passthrough as root cause, catalogued all defects, noted absence of test infrastructure. |
| `diagnosis/diagnosis-statement.md` | Root cause analysis with evidence citations | Established 5 root causes (RC-1 through RC-5) with line-level evidence, confirmed client-side resolution is viable, confirmed no backend changes needed. |
| `diagnosis/apl.json` | Structured diagnosis Q&A | Provided evidence-backed answers to all 6 diagnostic questions with source citations confirming each defect and its fix viability. |
| `repo-guidance.json` | Repo intent metadata | Confirmed helix-cli is the sole target repository; no backend changes needed. |

# Product Definition — HLX-343: Add Explicit Mode Selection To `hlx tickets create`

## Problem Statement

The `hlx tickets create` CLI command always creates tickets in the backend's default mode (AUTO) because it never sends the `mode` field to `POST /api/tickets`, even though the backend already accepts it. CLI users who intend to create Build, Fix, Research, or Execute tickets must use the web UI or raw API calls instead. This makes the CLI less capable than other interfaces and leads to accidental Auto-mode tickets that require manual correction.

A secondary issue: the create success output unconditionally prints the `shortId` field, which displays "Short ID: undefined" when the backend response omits it.

## Product Vision

Give CLI users the same ticket-mode control available through other interfaces by exposing the backend's existing `mode` parameter as an optional `--mode` flag, while preserving full backward compatibility for existing workflows.

## Users

- **Helix CLI operators** who create tickets from the command line and need to specify the ticket type (Build, Fix, Research, Execute) at creation time rather than relying on Auto-mode defaults.

## Use Cases

1. **Intentional mode selection**: An operator creates a ticket with `hlx tickets create --mode BUILD ...` and expects a Build-mode ticket with the correct short-id prefix.
2. **Default behavior preserved**: An operator runs `hlx tickets create` without `--mode` and gets the same behavior as today.
3. **Typo prevention**: An operator mistypes `--mode banana` and receives a clear error listing valid modes before any API call is made.
4. **Platform-restricted modes**: An operator passes `--mode EXECUTE` and the CLI forwards it to the backend, which enforces platform eligibility. If rejected, the backend error is surfaced clearly.

## Core Workflow

1. User runs `hlx tickets create` with existing required flags (`--title`, `--description`, `--repos`) and optionally `--mode <MODE>`.
2. CLI validates mode (if provided) against the allowed set: `AUTO`, `BUILD`, `FIX`, `RESEARCH`, `EXECUTE`. Invalid values fail immediately with a clear message.
3. CLI sends the POST request with `mode` included only when the flag is provided.
4. Success output displays the created ticket's ID, short ID (with a safe fallback if absent), status, and mode (when returned by the API).

## Essential Features (MVP)

1. **Optional `--mode` flag** on `hlx tickets create` accepting `AUTO | BUILD | FIX | RESEARCH | EXECUTE`.
2. **Case-insensitive input** normalized to uppercase before sending, consistent with existing CLI style.
3. **Client-side validation** that rejects invalid mode values with a clear error listing allowed values, before any API call.
4. **Conditional body inclusion** — `mode` is added to the POST body only when the flag is provided; omitted entirely otherwise.
5. **Mode in success output** — display the mode when present in the API response.
6. **Safe `shortId` output** — guard against undefined `shortId` instead of printing "Short ID: undefined".
7. **Updated usage text** — `tickets create` help documents the `--mode` flag and its allowed values.

## Features Explicitly Out of Scope (MVP)

- Changing ticket mode semantics, short-id prefix mapping, or branch naming in the backend.
- Adding mode selection to the web UI.
- Adding ticket lookup by short ID or numeric ID.
- Adding JSON output format or general help system improvements.
- Persisting the selected mode in local CLI config or state.
- Bootstrapping a test framework (no test infrastructure exists; coverage relies on typecheck).

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `hlx tickets create --mode BUILD ...` sends `mode: BUILD` in the POST body | Typecheck + code inspection of body construction |
| 2 | `hlx tickets create --mode FIX ...` sends `mode: FIX` | Same |
| 3 | `hlx tickets create --mode RESEARCH ...` sends `mode: RESEARCH` | Same |
| 4 | `hlx tickets create --mode AUTO ...` sends `mode: AUTO` | Same |
| 5 | `hlx tickets create --mode EXECUTE ...` sends `mode: EXECUTE`; no local platform enforcement | Same |
| 6 | `hlx tickets create` without `--mode` sends no `mode` field (backward-compatible) | Code inspection of conditional body construction |
| 7 | `hlx tickets create --mode banana ...` fails locally with allowed-values message, no API call | Code inspection of validation logic |
| 8 | Success output includes mode when the API response provides it | Code inspection of output logic |
| 9 | Success output never prints "Short ID: undefined" | Code inspection of shortId guard |
| 10 | Usage text documents `--mode` and allowed values | Code inspection of usage function |

## Key Design Principles

- **Backward compatibility**: Omitting `--mode` must produce identical behavior to today.
- **Fail fast**: Invalid modes are caught before the API call, not after.
- **Transparency**: Backend errors (e.g., EXECUTE rejection on non-NetSuite orgs) are surfaced to the user without CLI-side suppression.
- **Convention alignment**: Follow existing CLI patterns for optional flags (`getFlag`), case handling (`.toLowerCase()`), and error reporting (`console.error` + `process.exit(1)`).
- **Minimal surface**: No new utilities, config files, or infrastructure beyond what the feature requires.

## Scope & Constraints

- **Single repo**: All changes are in `helix-cli`. No backend or cross-repo changes.
- **Two files**: Primary changes in `src/tickets/create.ts`; usage text update in `src/tickets/index.ts`.
- **No HTTP layer changes**: `hxFetch` body type (`Record<string, unknown>`) already supports arbitrary fields.
- **No test framework**: The repo has no test runner or test dependencies. Quality gate is `npm run typecheck` (tsc --noEmit).
- **Per-invocation only**: Mode is not persisted, cached, or inherited between commands.

## Future Considerations

- If a test framework is added to the repo later, mode validation and body construction logic would be natural candidates for unit tests.
- If the backend adds new modes in the future, the CLI's allowed-values list will need a corresponding update.

## Open Questions / Risks

| # | Question / Risk | Impact |
|---|----------------|--------|
| 1 | Exact shape of backend response when `mode` is included — does the response `ticket` object include a `mode` field? | Affects whether mode can be displayed in success output. Implementation should handle its absence gracefully. |
| 2 | Whether `shortId` is ever actually absent from the create response in practice | Determines if the shortId guard is fixing a real production issue or a defensive measure. Either way, the guard is warranted. |
| 3 | Backend error format when EXECUTE is rejected for non-NetSuite orgs | Existing `buildErrorMessage()` surfaces HTTP status + response text, which should be sufficient, but the exact user-facing message is unknown. |
| 4 | No runtime inspection available to verify backend API contract | Cannot confirm response shapes at this stage; implementation should be defensive about optional response fields. |
| 5 | No test infrastructure exists in the repo | "Focused CLI tests" requested by the ticket cannot be delivered without bootstrapping a test framework, which is out of scope for this ticket. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | Defines allowed modes, validation rules, shortId fix, acceptance criteria, and explicit out-of-scope boundaries |
| scout/scout-summary.md | Scout analysis of change surface and patterns | Identified primary (create.ts) and secondary (index.ts) files; confirmed no HTTP/flags changes needed; documented CLI patterns |
| scout/reference-map.json | File-level evidence with line references | Confirmed POST body at L21-24, shortId at L29, response type at L5-8, usage text at L33; documented unknowns |
| diagnosis/diagnosis-statement.md | Root cause analysis | Confirmed feature gap (not a bug); two distinct issues (missing flag + shortId guard); scoped change to 2 files |
| diagnosis/apl.json | Structured diagnosis Q&A | Validated all seven diagnostic questions with line-level evidence; confirmed no test infrastructure |
| repo-guidance.json | Repo intent metadata | Confirmed helix-cli is the sole target repo with no cross-repo impact |

# Scout Summary — BLD-427

## Problem

The `hlx tickets artifacts <ticket-ref>` command prints only "No artifacts found." and "No step artifacts found." when the API returns empty results. Users need the run ID to fall back to `hlx tickets artifact --run <runId> --step <stepId> --repo <repoKey>`, but the empty-result output never surfaces it. This ticket adds the run ID and a follow-up command suggestion to the empty-result branch without changing the success path.

## Analysis Summary

### Primary change target

`src/tickets/artifacts.ts` — the `cmdTicketsArtifacts()` function (47 lines). The empty-result condition is when both `data.items.length === 0` and `data.stepArtifactSummary.length === 0`. Currently these two branches are handled independently (lines 25-36 and 38-46), each printing their own "no X found" message with no run ID context.

### Run ID resolution pattern

The codebase already has a well-established pattern for resolving run IDs in two sibling commands:

- **`artifact.ts` (lines 29-40):** `let runId = getFlag(args, "--run")` → if absent, fetch `GET /api/tickets/${ticketId}` → `ticket.currentRun?.id ?? ticket.runs[0]?.id`
- **`bundle.ts` (lines 33-39):** Same pattern duplicated.

Both define a local `TicketDetail` type: `{ currentRun?: { id: string }; runs: Array<{ id: string }> }`.

### Routing boundary

`src/tickets/index.ts` dispatches `cmdTicketsArtifacts(config, resolved.id, rest)` at line 119. The `ticketId` is the resolved internal ID. The `rawRef` (user's original reference) is available in the router scope but NOT passed to the command function — unlike `cmdTicketsContinue` which receives it as a 4th parameter.

### Error handling constraint

`hxFetch` throws on network/server errors after retrying. The ticket requires that if the extra run-ID-resolution request fails, the command still exits 0 with "No artifacts found." and a note that the run ID could not be resolved. This means a try/catch around the ticket-detail fetch is necessary.

### Success path invariant

The success path (when `items` or `stepArtifactSummary` is non-empty) must remain unchanged. The existing follow-up suggestion on line 43 (`Use: hlx tickets artifact <ticket-id> --step <stepId> --repo <repoKey>`) is only shown when `stepArtifactSummary` is non-empty and is NOT in scope for this ticket.

### Quality gates

- **typecheck:** `tsc --noEmit` — passes clean
- **test:** `tsc && node --test dist/**/*.test.js` — 30/30 pass
- **lint:** none configured
- **CI:** publish.yml runs `npm test` on tag push

### Test coverage gap

No tests exist under `src/tickets/`. Existing tests are in `src/lib/` only (`flags.test.ts`, `resolve-ticket.test.ts`). Both use Node.js built-in test runner (`describe`/`it`/`assert`).

## Relevant Files

| File | Role | Key Lines |
|------|------|-----------|
| `src/tickets/artifacts.ts` | **Primary change target** — empty-result branch | L25-36 (items), L38-46 (stepArtifactSummary) |
| `src/tickets/artifact.ts` | Reference pattern for run ID resolution | L5-10 (types), L29-40 (resolve logic) |
| `src/tickets/bundle.ts` | Second reference for run ID resolution | L7-11 (types), L33-39 (resolve logic) |
| `src/tickets/index.ts` | Command router — passes ticketId, not rawRef | L112-121 (artifacts dispatch) |
| `src/lib/http.ts` | HTTP client — throws on failure | L37-134 (hxFetch) |
| `src/lib/flags.ts` | CLI flag extraction utility | L5-9 (getFlag) |
| `src/lib/config.ts` | HxConfig type | L13-20 |
| `src/tickets/get.ts` | Full TicketDetail type reference | L5-22 |
| `src/lib/resolve-ticket.test.ts` | Test pattern reference | entire file |
| `src/lib/flags.test.ts` | Test pattern reference | entire file |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | Defines the 5 acceptance criteria, non-negotiable invariants (user-supplied --run must be echoed exactly), failure behavior (exit 0 on resolution error), and scope boundaries (empty-result branch only, CLI-only). |
| package.json | Build/test/quality gate signals | Quality gates: `tsc --noEmit` (typecheck), `tsc && node --test` (test). No ORM/migrations. TypeScript 6.x, Node >=18. |
| .github/workflows/publish.yml | CI pipeline | Tests run in CI on tag push. No additional lint/format gates. |

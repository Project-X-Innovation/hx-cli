# Diagnosis Statement — HLX-343: Add Explicit Mode Selection To `hlx tickets create`

## Problem Summary

The `hlx tickets create` command does not expose a `--mode` option, causing all CLI-created tickets to default to AUTO mode. The backend `POST /api/tickets` already accepts an optional `mode` field, but the CLI never sends it. Additionally, the create success output unconditionally prints `data.ticket.shortId`, which would display "Short ID: undefined" if the backend response omits that field.

## Root Cause Analysis

The root cause is a **feature gap** in `src/tickets/create.ts`, not a bug in existing logic. The command handler was implemented with only three required fields (`--title`, `--description`, `--repos`) and has no awareness of the backend's optional `mode` parameter. There are two distinct issues:

### Issue 1: Missing `--mode` flag (feature gap)

`cmdTicketsCreate` (src/tickets/create.ts L10-34) constructs the POST body at L21-24 with exactly `{ title, description, repositoryIds }`. The `getFlag` utility is already imported (L3) but unused — no optional `--mode` parsing exists. The `CreateTicketResponse` type (L5-8) does not include a `mode` field on the ticket object, so mode cannot be displayed in the success output.

### Issue 2: Unconditional `shortId` printing (latent bug)

Line 29 prints `data.ticket.shortId` unconditionally. The TypeScript type declares `shortId` as a required `string`, but the response is cast via `as CreateTicketResponse` (L25) with no runtime validation. If the backend ever returns a response without `shortId`, the output would display "Short ID: undefined".

### No cross-file or cross-repo impact

- `src/lib/http.ts`: The `hxFetch` body parameter is `Record<string, unknown>` (L40) — no HTTP layer changes needed.
- `src/lib/flags.ts`: The existing `getFlag` utility is sufficient for optional flag parsing — no new parsing infrastructure needed.
- Backend error surfacing already works via `buildErrorMessage()` (http.ts L28-35) — rejection of EXECUTE mode on non-NetSuite orgs will already be visible to the user.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| POST body construction | src/tickets/create.ts L21-24 | Body is `{ title, description, repositoryIds }` — no `mode` |
| Response type | src/tickets/create.ts L5-8 | `CreateTicketResponse` lacks `mode` field |
| shortId output | src/tickets/create.ts L29 | Unconditional print of `data.ticket.shortId` |
| Optional flag pattern | src/tickets/list.ts L47-60 | `getFlag(args, '--flag')` returns `string \| undefined` |
| Case-insensitive pattern | src/tickets/list.ts L77 | `.toLowerCase()` comparison for status filter |
| Error pattern | src/tickets/create.ts L17-19 | `console.error()` + `process.exit(1)` |
| HTTP body type | src/lib/http.ts L40 | `body?: Record<string, unknown>` — accepts any fields |
| Error surfacing | src/lib/http.ts L28-35 | `buildErrorMessage()` includes HTTP status and response text |
| Usage text | src/tickets/index.ts L33 | No `--mode` in create usage text |
| Test infrastructure | package.json L9-12, L22-25 | No test framework, no test runner |

## Scope of Change

### Files requiring changes

| File | Change |
|------|--------|
| `src/tickets/create.ts` | Parse `--mode`, validate against allowed values, conditionally include in body, update response type, fix shortId guard, add mode to output |
| `src/tickets/index.ts` | Update `ticketsUsage()` L33 to document `--mode` flag |

### Files not requiring changes

| File | Reason |
|------|--------|
| `src/lib/flags.ts` | Existing `getFlag` is sufficient for optional flags |
| `src/lib/http.ts` | Body type already accepts arbitrary fields; error surfacing already works |
| `src/index.ts` | Top-level usage text is terse by design and references `tickets create` generically |
| All other ticket handlers | No cross-command impact |

## Success Criteria

1. `--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>` parsed as optional flag
2. Mode values accepted case-insensitively, normalized to uppercase before sending
3. Invalid values rejected with clear error listing allowed values, before API call
4. `mode` included in POST body only when `--mode` is provided
5. `mode` omitted from POST body when `--mode` is not provided (preserves current behavior)
6. Success output includes mode when present in API response
7. Success output never prints "Short ID: undefined" — uses guard or fallback
8. Usage text documents `--mode` with allowed values
9. Typecheck (`npm run typecheck`) passes clean after changes

### Warning: No test infrastructure

The ticket requests "focused CLI tests or equivalent coverage" but the repo has no test framework, no test runner, and no existing tests. Test coverage would require bootstrapping a test framework (e.g., vitest) or the acceptance criteria must be verified via typecheck + manual testing.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary spec for required behavior and constraints | Defines allowed modes, validation rules, shortId fix requirement, and explicit out-of-scope items |
| scout/reference-map.json | File map with line-level evidence | Confirmed primary target (create.ts), patterns (list.ts, continue.ts), and absence of test infra |
| scout/scout-summary.md | Consolidated scout analysis | Validated change surface, quality gates, and implementation patterns |
| src/tickets/create.ts | Direct source inspection | Confirmed POST body at L21-24 sends no mode; shortId printed unconditionally at L29 |
| src/tickets/index.ts | Usage text inspection | Confirmed L33 lacks --mode documentation |
| src/lib/flags.ts | Flag utility inspection | Confirmed getFlag returns string \| undefined; no enum validator |
| src/lib/http.ts | HTTP layer inspection | Confirmed body type is Record<string, unknown>; error surfacing already works |
| src/tickets/list.ts | Pattern reference | Confirmed case-insensitive comparison at L77 and optional flag usage |
| package.json | Quality gate check | Confirmed no test framework or test runner available |

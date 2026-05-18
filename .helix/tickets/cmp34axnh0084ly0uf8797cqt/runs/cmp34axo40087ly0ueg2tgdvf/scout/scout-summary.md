# Scout Summary

## Problem

The `resolveTicket()` function in `src/lib/resolve-ticket.ts` only fetches active tickets from `GET /api/tickets` (no query parameters). It never requests archived tickets. Nine commands route through this shared resolver: `tickets get`, `update-description`, `rerun`, `continue`, `artifacts`, `artifact`, `bundle`, `comments list`, and `comments post`. All of these fail with "not found" when given an archived ticket reference, even though the server can return archived ticket details when accessed directly by ID.

## Analysis Summary

**Resolver behavior (lines 83-127):** `resolveTicket()` makes a single `hxFetch(config, "/tickets", { basePath: "/api" })` call at line 89, which returns only active tickets. The returned items are passed to the pure `matchTicket()` function, and if no match is found, the ambiguity check at lines 102-121 re-scans the same active-only list. There is no code path that fetches or considers archived tickets.

**Established archived API pattern:** Both `list.ts` (line 43-44) and `latest.ts` (line 24-25) already demonstrate the API pattern for fetching archived tickets: passing `queryParams: { archived: "true" }` to the same `/tickets` endpoint. The `hxFetch()` utility already supports the `queryParams` option.

**Downstream readiness:** The server already models archived state on ticket details (`isArchived: boolean` in the `TicketDetail` type at `get.ts:22`). Downstream commands that receive a resolved ticket ID call endpoints like `/api/tickets/${ticketId}` directly and would work with archived ticket IDs without modification.

**Boundary preservation:** `tickets list` and `tickets latest` call the `/tickets` endpoint directly (not through `resolveTicket`) and manage their own `--archived` flag independently. The fix to `resolveTicket()` will not affect their behavior.

**Test gap:** Existing tests cover `matchTicket()` and `extractTicketRef()` only. There are no tests for `resolveTicket()` itself. The test runner is Node's built-in (`node --test`), with no external mocking library.

## Relevant Files

| File | Role |
|------|------|
| `src/lib/resolve-ticket.ts` | Primary fix target. Contains `resolveTicket()` and `matchTicket()`. |
| `src/lib/resolve-ticket.test.ts` | Existing tests for `matchTicket()` and `extractTicketRef()`. New tests needed. |
| `src/lib/http.ts` | `hxFetch()` utility with `queryParams` support. No changes expected. |
| `src/tickets/index.ts` | Tickets command router. 7 call sites for `resolveTicket()`. No changes expected. |
| `src/comments/index.ts` | Comments command router. 2 call sites for `resolveTicket()`. No changes expected. |
| `src/tickets/list.ts` | Boundary: shows archived API pattern. Must remain unchanged. |
| `src/tickets/latest.ts` | Boundary: shows archived API pattern. Must remain unchanged. |
| `src/tickets/get.ts` | Downstream command. Confirms server returns `isArchived` field. |
| `src/lib/config.ts` | `HxConfig` type definition. |
| `src/lib/flags.ts` | Flag parsing utilities. |
| `package.json` | Quality gates: `build` (tsc), `typecheck` (tsc --noEmit), `test` (tsc + node --test). |
| `tsconfig.json` | Strict mode, ES2022, Node16 modules. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement and acceptance criteria | Fix is scoped to `resolveTicket()` in resolve-ticket.ts; must search both active and archived tickets; must detect ambiguity across both sets; must not change list/latest behavior. |
| src/lib/resolve-ticket.ts | Direct source inspection of fix target | `resolveTicket()` calls `/tickets` without archived param; `matchTicket()` is pure and works on any items array; ambiguity check also only considers active items. |
| src/lib/resolve-ticket.test.ts | Existing test coverage assessment | Tests exist for `matchTicket()` and `extractTicketRef()` only. No `resolveTicket()` tests. No mocking library available. |
| src/lib/http.ts | API call infrastructure | `hxFetch()` already supports `queryParams` option; no http-layer changes needed for the fix. |
| src/tickets/list.ts | Archived API pattern reference | Confirms `queryParams.archived = "true"` is the established way to fetch archived tickets from the same endpoint. |
| src/tickets/index.ts | Usage surface of resolveTicket | 7 commands call resolveTicket(); all are affected by the active-only limitation. |
| src/comments/index.ts | Usage surface of resolveTicket | 2 commands call resolveTicket(); both are affected. |
| src/tickets/get.ts | Server-side archived model evidence | `TicketDetail` type includes `isArchived: boolean`; server already returns archived ticket data by ID. |
| package.json | Build and quality gate commands | `tsc` for build, `tsc --noEmit` for typecheck, `tsc && node --test` for tests. Zero runtime deps. |

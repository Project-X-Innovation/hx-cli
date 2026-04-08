# Implementation Actual: helix-cli

## Summary of Changes

Added `hlx comments list` and `hlx comments post` commands to the Helix CLI, enabling sandbox agents and external CLI users to read and write ticket comments. Generalized the HTTP client to support non-inspect API paths and added HELIX_TICKET_ID env var support.

## Files Changed

| File | Why Changed | Shared/Review Hotspot |
|------|-------------|----------------------|
| `src/lib/http.ts` | Added `basePath?: string` option to `hxFetch` (defaults to `/api/inspect` for backward compatibility) | HTTP client: all existing callers unaffected by default |
| `src/comments/index.ts` | New file: comments command dispatcher with `resolveTicketId` (--ticket flag or HELIX_TICKET_ID env var) | New command group entry point |
| `src/comments/list.ts` | New file: `hlx comments list` with --helix-only and --since filtering | New command |
| `src/comments/post.ts` | New file: `hlx comments post` with isHelixTagged=true | New command |
| `src/index.ts` | Added `comments` case to switch router, imported `runComments`, updated usage text | CLI entry point: command dispatch |

## Steps Executed

| Plan Step | Status | Notes |
|-----------|--------|-------|
| C1: Generalize `hxFetch` with `basePath` parameter | Done | Default `/api/inspect` preserves backward compatibility |
| C2: Create comments command dispatcher | Done | Ticket ID from --ticket flag or HELIX_TICKET_ID env var |
| C3: Implement `hlx comments list` | Done | GET with basePath=/api; filters for --helix-only and --since |
| C4: Implement `hlx comments post` | Done | POST with basePath=/api; always sets isHelixTagged=true |
| C5: Register `comments` command in CLI entry point | Done | Switch case + usage text updated |
| C6: Quality gates | Done | typecheck + build pass |

## Verification Commands Run + Outcomes

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass: 0 errors |
| `npm run build` | Pass: compiled successfully |

## Test/Build Results

- TypeScript compilation: 0 errors
- Build: successful
- Zero new runtime dependencies maintained

## Deviations from Plan

None. Implementation follows the plan exactly.

## Known Limitations / Follow-ups

- End-to-end testing of `hlx comments list` and `hlx comments post` against the running server requires CLI login or env var configuration, which was not performed in this pass. The server API was verified via curl independently.

## Verification Plan Results

| Check ID | Outcome | Evidence |
|----------|---------|----------|
| CHK-01 | pass | `npm run typecheck` and `npm run build` both exit 0 |
| CHK-02 | pass | Code inspection: `hxFetch` accepts `basePath` option with default `/api/inspect`; URL uses `${config.url}${base}${path}` |
| CHK-03 | blocked | Requires running server + CLI login; server API verified via curl separately |
| CHK-04 | blocked | Requires running server + CLI login; server API verified via curl separately |

## APL Statement Reference

See implementation/apl.json.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Feature requirements | CLI as comment mechanism; agents and external users both use it |
| implementation-plan/implementation-plan.md (CLI) | Step-by-step plan | 6 steps: http basePath, dispatcher, list, post, register, gates |
| scout/reference-map.json (CLI) | File locations | index.ts, http.ts, config.ts, inspect/index.ts |
| repo-guidance.json | Repo classification | CLI is target for new comment commands |

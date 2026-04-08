# Code Review: helix-cli

## Review Scope

Reviewed all CLI changes for the bidirectional mid-run discussion feature: HTTP client generalization with `basePath` parameter, `comments list` and `comments post` commands, ticket ID resolution, and CLI entry point registration.

## Files Reviewed

| File | Review Focus |
|------|-------------|
| `src/lib/http.ts` (line 40-44) | `basePath` option with `/api/inspect` default; URL construction |
| `src/comments/index.ts` | `runComments` dispatcher; `resolveTicketId` (--ticket flag or HELIX_TICKET_ID env) |
| `src/comments/list.ts` | GET request, --helix-only and --since client-side filtering, output formatting |
| `src/comments/post.ts` | POST request with isHelixTagged=true, positional arg extraction |
| `src/index.ts` | `comments` case in switch router, usage text update |

## Missed Requirements & Issues Found

### Requirements Gaps

None. All product spec MVP features targeted at the CLI are implemented: `hlx comments list` and `hlx comments post` with ticket ID from flag or env var.

### Correctness/Behavior Issues

None found. The implementation is correct:
- `basePath` parameter in `hxFetch` defaults to `/api/inspect` for backward compatibility.
- `resolveTicketId` correctly prioritizes --ticket flag, then HELIX_TICKET_ID env var, then exits with error.
- `cmdList` correctly fetches, filters, and formats comments.
- `cmdPost` correctly extracts the message from positional args, skipping known flags.
- CLI entry point routes `comments` subcommand correctly.

### Regression Risks

None. The `basePath` parameter is additive with a backward-compatible default. Existing `inspect` commands are unaffected.

### Code Quality/Robustness

- `post.ts` skips `--since` flag in its positional arg parser (line 13) even though `--since` is a `list`-only flag. This is harmless — it prevents a hypothetical misuse from breaking the message, but it's an unnecessary guard. Not worth changing.
- Zero new runtime dependencies maintained. Good.

### Verification/Test Gaps

- End-to-end testing of `hlx comments list` and `hlx comments post` against the running server was blocked (requires CLI login). Documented as known limitation. The server API was verified via curl independently.

## Changes Made by Code Review

None. No issues requiring fixes were found in the CLI code.

## Remaining Risks / Deferred Items

1. `hlx comments post` always sets `isHelixTagged: true`. External CLI users cannot post non-Helix-tagged comments via CLI. Acceptable for MVP since the primary CLI use case is agent responses.

## Verification Impact Notes

No verification checks are affected. CHK-01 through CHK-04 from the CLI verification plan remain valid.

## APL Statement Reference

See code-review/apl.json.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Feature requirements | CLI as two-for-one mechanism for agents and external users |
| product/product.md | Product scope | hlx comments list and hlx comments post; HELIX_TICKET_ID env var |
| implementation-plan/implementation-plan.md (CLI) | Plan reference | 6 steps: http, dispatcher, list, post, register, gates |
| implementation/implementation-actual.md (CLI) | Scope map | 5 files changed; all steps completed |
| implementation/apl.json (CLI) | Implementation evidence | Confirmed basePath backward compatibility |
| src/lib/http.ts | HTTP client review | basePath default correct; URL construction correct |
| src/comments/index.ts | Dispatcher review | Ticket ID resolution correct |
| src/comments/list.ts | List command review | Filtering and formatting correct |
| src/comments/post.ts | Post command review | Message extraction and API call correct |
| src/index.ts | Entry point review | Command routing correct |

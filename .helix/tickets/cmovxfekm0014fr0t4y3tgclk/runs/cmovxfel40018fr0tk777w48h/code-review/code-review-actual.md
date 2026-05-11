# Code Review — BLD-401

## Review Scope

Reviewed all changes in helix-cli for ticket BLD-401: three usability defects in `hlx tickets create` (--repos resolution, --description-file, update-description subcommand). The helix-global-server has no changes (confirmed by repo-guidance.json and implementation-actual.md).

Files reviewed: 4 changed files in `helix-cli/src/`, plus supporting library code (`flags.ts`, `http.ts`, `resolve-ticket.ts`, `config.ts`, `get.ts`, `index.ts` entrypoint) and all prior artifacts.

## Files Reviewed

| File | Lines | Verdict |
|------|-------|---------|
| `src/lib/resolve-repo.ts` | 1-80 | Correct. `resolveAllRepos()` (lines 44-80) is additive, makes one `listRepos` call, matches existing `resolveRepo` logic, throws Error (not process.exit), reports all unknown entries at once. Existing `resolveRepo()` untouched. |
| `src/tickets/create.ts` | 1-105 | Correct. Dual-flag logic (lines 22-34), file reading (lines 38-45), file-path detection (lines 47-57), repo resolution via `resolveAllRepos` (lines 60-76), help text updated (line 16). All validation runs before any API call. |
| `src/tickets/update-description.ts` | 1-40 | Correct. New file, clean pattern. `--file`/`--text` mutual exclusivity (lines 10-18), file reading with try-catch (lines 22-28), PATCH call (lines 33-37), success message (line 39). |
| `src/tickets/index.ts` | 1-149 | Correct. Import added (line 13), `update-description` case (lines 79-88) follows `extractTicketRef + resolveTicket + handler` pattern, usage text updated (lines 17-31), create help text updated (line 73). |

Supporting files also reviewed:
- `src/lib/flags.ts` — `getFlag` uses `indexOf` (exact match), so `--description` and `--description-file` do not collide.
- `src/lib/http.ts` — `hxFetch` supports PATCH method; errors from non-OK responses propagate as thrown Errors caught by `src/index.ts:118-121`.
- `src/lib/resolve-ticket.ts` — `extractTicketRef + resolveTicket` pattern reused correctly in `update-description` case.
- `src/lib/config.ts` — `HxConfig` type confirmed compatible.
- `src/tickets/get.ts` — `TicketDetail` includes `description` field; `printTicketDetail` displays it, confirming AC4 verifiability.
- `src/index.ts` — Top-level try-catch (lines 118-121) handles uncaught errors from subcommands with `console.error` + `process.exit(1)`.

## Missed Requirements & Issues Found

### Requirements Gaps

None. All five acceptance criteria from ticket.md are covered:

| AC | Requirement | Implementation |
|----|------------|----------------|
| AC1 | `--description-file <existing-md>` produces ticket with file contents | `create.ts:38-45` reads file via `readFileSync` |
| AC2 | `--description <existing-file-path>` does NOT silently use path string | `create.ts:47-56` detects readable files and exits with error |
| AC3 | `--repos <unknown>` fails before creation with `hlx inspect repos` reference | `create.ts:69-76` catches `resolveAllRepos` error, prints reference |
| AC4 | `update-description <ticket-ref>` updates description | `update-description.ts:33-39` PATCHes then prints success |
| AC5 | Help text matches actual `--repos` contract | `index.ts:21,29,73` show names/keys/IDs accepted |

Non-negotiables verified:
- Unknown repo key/name fails before ticket creation (validation at `create.ts:70-71` runs before the POST at `create.ts:89`).
- Unreadable file in `--description-file` fails with non-zero exit code (`create.ts:42-45` try-catch with `process.exit(1)`).

### Correctness / Behavior Issues

None found.

### Regression Risks

None. Existing `resolveRepo()` function is untouched (new `resolveAllRepos` is additive). The `create.ts` behavior changes are intentional breaking changes per the ticket requirements (description handling and repo resolution). No other subcommands are affected. All 30 existing tests pass.

### Code Quality / Robustness

No material issues. Minor observations (not requiring fixes):

1. **Double help-check in create.ts**: `isHelpRequested` is checked both in `index.ts:72` and `create.ts:15`. This is a pre-existing pattern (also present in `latest.ts:17` and `continue.ts:10`), not introduced by this change. Harmless redundancy.

2. **Non-null assertions** (`!`) at `create.ts:49,50,57`: Safe because the code is in the `else` branch of `if (descriptionFile !== undefined)` and both earlier guards (lines 26-34) ensure `descriptionRaw` is defined. TypeScript's narrowing doesn't track this across the branch structure.

3. **Empty catch at create.ts:54**: Intentional — if `accessSync`/`statSync` throws, the value is not a readable file and should be used as a literal description. Comment documents the intent.

4. **Empty file via --description-file**: `readFileSync` returns `""` for empty files. Server validates with `z.string().trim().min(1).max(10_000)` and returns 400. Product spec (product.md line 75) says "The CLI should pass through the server's validation error." Current behavior is correct.

5. **Duplicate repos in --repos**: Passing `--repos app,app` would send duplicate IDs. Server handles deduplication or rejection. Not in scope per ticket.

### Verification / Test Gaps

No gaps. Implementation was verified against all 10 CHK checks via staging server integration tests. All quality gates (typecheck, build, test) pass. No new unit tests were added, which is acceptable — `resolveAllRepos` is primarily I/O-bound and was verified through integration testing, and the flag-parsing and ticket-resolution utilities are already covered by existing tests.

## Changes Made by Code Review

None. No code fixes were necessary — the implementation is correct, complete, and follows established patterns.

## Remaining Risks / Deferred Items

1. **File-path false positive on --description**: If a user's intended literal description happens to match a readable file path on the system (e.g., `--description "README.md"` when README.md exists), the CLI will reject it and direct to `--description-file`. This is by design per product.md (OQ2: "fail-with-error directing to --description-file for explicitness") and the ticket requirement ("Either load the file or fail closed with a clear error").

2. **Inspect auth availability** (product.md OQ1): `resolveAllRepos` calls `listRepos` which uses `GET /api/inspect/repositories`. If a token lacks inspect auth, repo resolution will fail. This is a pre-existing limitation of `resolveRepo` and is documented in product.md as an open question.

## Verification Impact Notes

No changes were made by code review, so all verification checks remain valid as-is:

| Check ID | Status | Notes |
|----------|--------|-------|
| CHK-01 | Valid | Typecheck confirmed passing |
| CHK-02 | Valid | Build confirmed passing |
| CHK-03 | Valid | Tests confirmed passing (30/30) |
| CHK-04 | Valid | No changes to --description-file logic |
| CHK-05 | Valid | No changes to file-path detection logic |
| CHK-06 | Valid | No changes to mutual exclusivity logic |
| CHK-07 | Valid | No changes to repo resolution logic |
| CHK-08 | Valid | No changes to error messaging |
| CHK-09 | Valid | No changes to update-description logic |
| CHK-10 | Valid | No changes to help text |

## APL Statement Reference

Code review of BLD-401 is complete. All 4 changed files in helix-cli reviewed against ticket requirements, product spec, and implementation plan. No issues found requiring code fixes. Implementation correctly addresses all three usability defects (--repos resolution, --description-file, update-description subcommand) and meets all 5 acceptance criteria. Quality gates verified: typecheck, build, and 30/30 tests pass. No changes to helix-global-server. Zero code-review edits made.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Requirements and acceptance criteria | Three defects with 5 acceptance criteria and 2 non-negotiables |
| implementation/implementation-actual.md (helix-cli) | Scope map for review: files changed and verification results | 4 files changed; all 10 CHK checks passed |
| implementation/apl.json (helix-cli) | Implementation answers and evidence | All three defects fixed; quality gates passed |
| implementation-plan/implementation-plan.md (helix-cli) | Expected implementation approach and verification plan | 5-step plan with 10 required checks |
| product/product.md (helix-cli) | Product features and design decisions | Fail-with-error for file-path detection; mutual exclusivity for all flag pairs |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis | Three root causes confirmed at specific file:line locations |
| repo-guidance.json (shared) | Repo intent | helix-cli = target; helix-global-server = context only |
| src/lib/resolve-repo.ts | Direct code review | resolveAllRepos correctly implements batch resolution |
| src/tickets/create.ts | Direct code review | Description handling and repo resolution correctly implemented |
| src/tickets/update-description.ts | Direct code review | New subcommand follows established patterns |
| src/tickets/index.ts | Direct code review | Subcommand registration and help text correct |
| src/lib/flags.ts | API verification | getFlag uses indexOf (exact match); no --description/--description-file collision |
| src/lib/http.ts | API verification | hxFetch supports PATCH; errors propagate correctly |
| src/lib/resolve-ticket.ts | Pattern verification | extractTicketRef + resolveTicket pattern reused correctly |
| src/lib/config.ts | Type verification | HxConfig type compatible with all new usages |
| src/tickets/get.ts | Verification of AC4 | TicketDetail includes description field; displayed by printTicketDetail |
| src/index.ts | Error handling verification | Top-level try-catch handles uncaught subcommand errors |
| src/lib/flags.test.ts | Test coverage verification | 14 existing tests for flag utilities; no regressions |

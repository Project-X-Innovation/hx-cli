# Scout Summary — HLX-343: Add Explicit Mode Selection To `hlx tickets create`

## Problem

The `hlx tickets create` command does not expose a `--mode` option. The backend `POST /api/tickets` endpoint already accepts an optional `mode` field, but the CLI always sends only `{ title, description, repositoryIds }`. This causes all CLI-created tickets to default to AUTO mode. The ticket also identifies that the create response output prints `Short ID: undefined` when the response omits `shortId`.

## Analysis Summary

### Primary change surface: `src/tickets/create.ts`

This is the sole command handler for `hlx tickets create`. The function is 34 lines. The changes needed are:

1. **Parse `--mode`**: Add an optional `getFlag(args, "--mode")` call alongside existing required flags (L11-13).
2. **Validate mode**: Check the value against allowed set `[AUTO, BUILD, FIX, RESEARCH, EXECUTE]` before the API call. No existing enum validator in `flags.ts` — validation must be added inline or as a new utility.
3. **Conditionally include in body**: Only add `mode` to the POST body when the flag is provided (L22-23).
4. **Update response type**: The `CreateTicketResponse` type (L6-8) needs a `mode` field (likely optional) on the `ticket` object.
5. **Fix shortId output**: L29 prints `data.ticket.shortId` unconditionally. Needs a guard or fallback for when `shortId` is absent.
6. **Print mode in output**: Add mode to success output when present in the API response.

### Secondary change surface: `src/tickets/index.ts`

The `ticketsUsage()` function (L28-39) contains the help text for `tickets create` on L33. Needs `--mode` documented.

### Optional change surface: `src/index.ts`

Top-level usage text (L25-26) references `tickets create` but is terse. May or may not need update depending on design choice.

### Patterns observed

- **Optional flags**: Other commands use `getFlag(args, "--flag")` returning `string | undefined` (see `list.ts` L47, L52, L60).
- **Case insensitivity**: `list.ts` L76 uses `.toLowerCase()` comparison for status filter, establishing a precedent for case-insensitive CLI input.
- **Error handling**: `process.exit(1)` with `console.error()` is the standard pattern for validation failures (see `create.ts` L17-19, `continue.ts` L19-21).
- **POST body construction**: Inline in command handlers (see `continue.ts` L24-27, `rerun.ts` L9-12).

### Quality gates

| Gate | Command | Status |
|------|---------|--------|
| Typecheck | `npm run typecheck` | Passes clean |
| Build | `npm run build` (tsc) | Available |
| Lint | None configured | N/A |
| Tests | None configured | N/A |

No test framework is installed (no jest/vitest/mocha in deps, no test script in package.json). The ticket requests "focused CLI tests or equivalent coverage" but there is no existing test infrastructure to build on.

### Boundaries

- **No HTTP layer changes needed**: `hxFetch` accepts `Record<string, unknown>` as body, so adding `mode` requires no changes to `http.ts`.
- **No config changes needed**: Mode is per-invocation, not persisted.
- **Backend error surfacing already works**: `buildErrorMessage()` in `http.ts` includes HTTP status and response text, so backend rejection of EXECUTE mode would already appear to the user.
- **No ORM/migrations**: Pure CLI tool.

## Relevant Files

| File | Role |
|------|------|
| `src/tickets/create.ts` | Primary target — command handler, body construction, response output |
| `src/tickets/index.ts` | Usage text, command routing |
| `src/lib/flags.ts` | Flag parsing utilities (getFlag, requireFlag, hasFlag) |
| `src/lib/http.ts` | API client — body and error handling |
| `src/index.ts` | Top-level CLI entry and usage text |
| `src/tickets/list.ts` | Pattern reference — optional flags, case-insensitive comparison |
| `src/tickets/get.ts` | Pattern reference — ticket detail type and display |
| `src/tickets/continue.ts` | Pattern reference — POST body with optional fields |
| `package.json` | Scripts: build, typecheck. No test framework. |
| `tsconfig.json` | Strict mode, ES2022 target, Node16 module |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary spec for the feature | Defines allowed modes (AUTO, BUILD, FIX, RESEARCH, EXECUTE), validation rules, shortId fix requirement, and explicit non-goals |
| src/tickets/create.ts | Core file to modify | Sends `{ title, description, repositoryIds }` — no mode. Response type lacks mode. ShortId printed unconditionally. |
| src/tickets/index.ts | Usage text and routing | L33 usage text needs `--mode` added. |
| src/lib/flags.ts | Flag parsing patterns | `getFlag` for optional, `requireFlag` for mandatory. No enum validator exists. |
| src/lib/http.ts | API call mechanism | Body accepts `Record<string, unknown>` — no HTTP layer changes needed. Error messages already surface backend rejections. |
| src/tickets/list.ts | Pattern reference | Case-insensitive comparison for status filter establishes CLI style precedent. |
| package.json | Quality gate discovery | Only typecheck available. No test infrastructure exists. |

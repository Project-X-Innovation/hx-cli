# Scout Summary

## Problem

Two issues in `hlx tickets` CLI:

1. **`hlx tickets artifacts` ignores `--run`**: The function `cmdTicketsArtifacts` in `src/tickets/artifacts.ts` accepts only `(config, ticketId)` — it has no `args` parameter and calls `/tickets/${ticketId}/artifacts` with no query params. The subcommand router at `src/tickets/index.ts:79` also does not pass args. The server already accepts a `runId` query parameter, but the CLI never sends it.

2. **`hlx tickets artifact` 404 triggers Node assertion failure**: When fetching a missing step artifact, the 404 response flows through `hxFetch` → `buildErrorMessage` → `throw Error`, which propagates to the top-level catch. The ticket reports a Node assertion failure after the HTTP 404 error message, but static analysis shows the code path appears clean — the exact assertion failure mechanism is not determinable from source alone.

## Analysis Summary

### Surfaces requiring change

- **`src/tickets/artifacts.ts`** — Must accept an `args` parameter, read `--run` via `getFlag`, and pass `runId` as a query param to `hxFetch`. The established pattern exists in sibling `artifact.ts` (lines 29-40).
- **`src/tickets/index.ts`** — Line 79 must pass `rest` to `cmdTicketsArtifacts`, matching the pattern used at line 85 for `cmdTicketsArtifact`. Usage text at line 36 needs `[--run <runId>]` added.
- **Error handling surface** — The 404 handling needs hardening. The `artifact.ts` command has no try-catch around its `hxFetch` call (lines 42-45), whereas the sibling `bundle.ts` wraps artifact fetches in try-catch (lines 68-71). The hxFetch utility treats all non-2xx, non-retryable responses identically with `throw Error`.

### Established patterns (reference)

| Pattern | File | Lines | Notes |
|---------|------|-------|-------|
| --run flag reading + fallback | src/tickets/artifact.ts | 29-40 | getFlag → fetch ticket → currentRun?.id |
| Query param passing | src/lib/http.ts | 46-49 | `queryParams: { key: value }` on hxFetch options |
| Graceful error handling | src/tickets/bundle.ts | 68-71 | try-catch with console.error warning |
| Args forwarding | src/tickets/index.ts | 85 | `cmdTicketsArtifact(config, ticketId, rest)` |
| Flag parsing | src/lib/flags.ts | 5-9 | `getFlag(args, "--run")` returns value or undefined |

### Build / quality gates

- **Build**: `npm run build` → `tsc`
- **Typecheck**: `npm run typecheck` → `tsc --noEmit`
- **Tests**: None exist (no test files found)
- **CI**: No CI workflow files found
- **Lint**: No lint script or config found

### Boundaries

- No runtime dependencies — only `@types/node` and `typescript` as devDependencies
- No ORM / database / migrations
- ESM module system (type: "module", module: Node16)
- Target: ES2022, strict mode enabled
- Runtime inspection manifest unavailable — no runtime evidence collected

## Relevant Files

| File | Role | Key lines |
|------|------|-----------|
| `src/tickets/artifacts.ts` | Primary change target — needs --run support | L17-18: function signature and hxFetch call |
| `src/tickets/index.ts` | Subcommand router — needs to pass args, update usage | L36, L79 |
| `src/tickets/artifact.ts` | Reference pattern for --run; 404 error surface | L29-40 (--run), L42-45 (hxFetch call) |
| `src/lib/http.ts` | HTTP utility — error handling for non-2xx responses | L28-35 (buildErrorMessage), L80-103 (response handling) |
| `src/lib/flags.ts` | Flag parsing API | L5-9 (getFlag) |
| `src/tickets/bundle.ts` | Reference for graceful error handling pattern | L68-71 (try-catch) |
| `src/index.ts` | Global error handler | L95-97 |
| `package.json` | Build scripts, no runtime deps | scripts.build, scripts.typecheck |
| `tsconfig.json` | Compiler config — strict, ES2022, Node16 | All |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary problem statement | Two changes needed: --run on artifacts, 404 hardening on artifact |
| package.json | Identify build/quality gates and dependencies | Build via tsc, no runtime deps, no ORM |
| tsconfig.json | Compiler constraints | Strict mode, ES2022 target, Node16 modules |
| src/tickets/artifacts.ts | Primary change target inspection | No args parameter, no queryParams — root of issue 1 |
| src/tickets/artifact.ts | Reference pattern and error surface | Already implements --run; 404 propagates as uncaught throw |
| src/tickets/index.ts | Router and usage text | artifacts case doesn't pass args; usage missing --run |
| src/lib/http.ts | Error handling mechanism | 404 → buildErrorMessage → throw; no special handling for expected errors |
| src/lib/flags.ts | Flag parsing API | getFlag reads named flags from args array |
| src/tickets/bundle.ts | Graceful error handling reference | try-catch pattern for skipping failed artifact fetches |
| src/index.ts | Global catch handler | Catches and logs error.message, exits 1 |

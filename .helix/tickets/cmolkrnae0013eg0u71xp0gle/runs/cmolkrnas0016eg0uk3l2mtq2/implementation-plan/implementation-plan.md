# Implementation Plan — HLX-343: Add Explicit Mode Selection To `hlx tickets create`

## Overview

Add an optional `--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>` flag to `hlx tickets create` so CLI users can explicitly choose the ticket mode. The backend already accepts `mode` on `POST /api/tickets`; this change makes the CLI expose it. Also fix the unconditional `shortId` print that would display "Short ID: undefined" when the backend omits the field.

All changes are in two files within `helix-cli`:
- `src/tickets/create.ts` — flag parsing, validation, body construction, response type, output
- `src/tickets/index.ts` — usage text update

No new files, no new dependencies, no HTTP layer changes.

## Implementation Principles

1. **Inline validation**: Follow the existing codebase pattern of inline validation (e.g., `repositoryIds.length` check at create.ts L16-19). Define `VALID_MODES` as a module-level const array in `create.ts`.
2. **Existing utilities**: Use `getFlag(args, "--mode")` — already imported in create.ts L3 but unused.
3. **Case normalization**: `.toUpperCase()` on user input, validate against uppercase array, send uppercase to API.
4. **Conditional inclusion**: Only add `mode` to POST body when `--mode` is provided; never send `mode: undefined`.
5. **Defensive typing**: Make `shortId` and `mode` optional in `CreateTicketResponse` to handle backend response variations.
6. **Existing error pattern**: `console.error()` + `process.exit(1)` for validation failures.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Update `CreateTicketResponse` type | Modified type with `mode?: string` and `shortId?: string` |
| 2 | Add `VALID_MODES` constant and parse `--mode` flag | Module-level const array + `getFlag` call |
| 3 | Add mode validation with error handling | Validation block after flag parsing |
| 4 | Update POST body to conditionally include `mode` | Modified body construction |
| 5 | Fix `shortId` output guard | Nullish coalescing fallback in console output |
| 6 | Add `mode` to success output | Conditional mode display line |
| 7 | Update usage text | `--mode` documented in `ticketsUsage()` |
| 8 | Run quality gate | Typecheck passes clean |

## Detailed Implementation Steps

### Step 1: Update `CreateTicketResponse` type

**Goal**: Make the response type defensive for optional fields.

**What to Build**:
In `src/tickets/create.ts`, modify the `CreateTicketResponse` type (currently L5-8):
- Change `shortId: string` to `shortId?: string` (optional)
- Add `mode?: string` to the `ticket` object

Current:
```typescript
type CreateTicketResponse = {
  ticket: { id: string; shortId: string; status: string };
  run?: { id: string };
};
```

Target shape:
```typescript
type CreateTicketResponse = {
  ticket: { id: string; shortId?: string; mode?: string; status: string };
  run?: { id: string };
};
```

**Verification (AI Agent Runs)**:
- `npm run typecheck` in `helix-cli/` — should pass (existing code that reads `data.ticket.shortId` will now get `string | undefined`, which will cause a type error until Step 5 fixes the output guard, so Steps 1 and 5 should be applied together or in quick sequence)

**Success Criteria**:
- `shortId` is optional in the type
- `mode` is optional in the type

---

### Step 2: Add `VALID_MODES` constant and parse `--mode` flag

**Goal**: Define allowed modes and parse the optional flag.

**What to Build**:
In `src/tickets/create.ts`:
1. Add a module-level constant after the type definition:
   ```typescript
   const VALID_MODES = ["AUTO", "BUILD", "FIX", "RESEARCH", "EXECUTE"] as const;
   ```
2. Inside `cmdTicketsCreate`, after the `repositoryIds` validation block (after L19), add:
   ```typescript
   const modeRaw = getFlag(args, "--mode");
   ```

**Verification (AI Agent Runs)**:
- `npm run typecheck` — should pass

**Success Criteria**:
- `VALID_MODES` array defined with all 5 modes
- `modeRaw` parsed via `getFlag` returning `string | undefined`

---

### Step 3: Add mode validation with error handling

**Goal**: Validate mode input case-insensitively and reject invalid values before API call.

**What to Build**:
In `src/tickets/create.ts`, after parsing `modeRaw`:
1. Declare `mode` as `string | undefined`
2. If `modeRaw` is provided, normalize to uppercase via `.toUpperCase()`
3. Check if the normalized value is in `VALID_MODES` using `.includes()`
4. If not valid, print error listing allowed values and exit:
   ```typescript
   console.error(`Error: Invalid mode "${modeRaw}". Allowed values: ${VALID_MODES.join(", ")}`);
   process.exit(1);
   ```
5. If valid, assign the normalized uppercase value to `mode`

Follow the existing error pattern from L17-19 (repositoryIds validation).

**Verification (AI Agent Runs)**:
- `npm run typecheck` — should pass

**Success Criteria**:
- Invalid modes (e.g., "banana") cause `console.error` + `process.exit(1)` before API call
- Valid modes in any case (e.g., "build", "Build", "BUILD") normalize to uppercase
- When `--mode` is omitted, `mode` is `undefined`

---

### Step 4: Update POST body to conditionally include `mode`

**Goal**: Send `mode` in the request body only when the flag is provided.

**What to Build**:
In `src/tickets/create.ts`, modify the `hxFetch` call body (currently L23):
- Conditionally include `mode` using spread syntax or explicit conditional
- When `mode` is `undefined`, the body must be exactly `{ title, description, repositoryIds }` (no `mode` key at all)
- When `mode` is defined, the body must be `{ title, description, repositoryIds, mode }`

**Verification (AI Agent Runs)**:
- `npm run typecheck` — should pass

**Success Criteria**:
- `mode` included in body when provided
- `mode` absent from body when omitted
- Body always includes `title`, `description`, `repositoryIds`

---

### Step 5: Fix `shortId` output guard

**Goal**: Never print "Short ID: undefined".

**What to Build**:
In `src/tickets/create.ts`, modify the `shortId` console.log line (currently L29):
- Use nullish coalescing to provide a fallback:
  ```typescript
  console.log(`  Short ID: ${data.ticket.shortId ?? "(pending)"}`);
  ```

**Verification (AI Agent Runs)**:
- `npm run typecheck` — should pass (now that `shortId` is optional from Step 1, the coalescing handles `undefined`)

**Success Criteria**:
- When `shortId` is present, it prints normally
- When `shortId` is absent/undefined, it prints "(pending)" instead of "undefined"

---

### Step 6: Add `mode` to success output

**Goal**: Display the mode in create output when the API response includes it.

**What to Build**:
In `src/tickets/create.ts`, add a conditional mode display after the status line (after current L30):
```typescript
if (data.ticket.mode) {
  console.log(`  Mode:     ${data.ticket.mode}`);
}
```

Follow the same conditional display pattern used for `data.run` (L31-33) and `ticket.mergeQueueStatus` in get.ts (L36-38).

**Verification (AI Agent Runs)**:
- `npm run typecheck` — should pass

**Success Criteria**:
- Mode displayed when present in API response
- No "Mode: undefined" line when mode is absent

---

### Step 7: Update usage text

**Goal**: Document the `--mode` flag in CLI help.

**What to Build**:
In `src/tickets/index.ts`, update the `ticketsUsage()` function's create line (currently L33):
- Change from:
  ```
  hlx tickets create --title <title> --description <desc> --repos <repo1,repo2>
  ```
- To:
  ```
  hlx tickets create --title <title> --description <desc> --repos <repo1,repo2> [--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>]
  ```

**Verification (AI Agent Runs)**:
- `npm run typecheck` — should pass

**Success Criteria**:
- Usage text shows `--mode` as optional with all 5 allowed values
- Existing flags still documented

---

### Step 8: Run quality gate

**Goal**: Verify all changes pass the typecheck quality gate.

**What to Build**: Nothing — this is verification only.

**Verification (AI Agent Runs)**:
- Run `npm run typecheck` in the `helix-cli/` directory
- Run `npm run build` in the `helix-cli/` directory to confirm compilation succeeds

**Success Criteria**:
- `npm run typecheck` exits with code 0
- `npm run build` exits with code 0

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js >= 18 | available | package.json L14-16 engines field | CHK-01, CHK-02, CHK-03 |
| npm install completed | available | Can be run in helix-cli/ directory | CHK-01, CHK-02, CHK-03 |
| TypeScript compiler (tsc) | available | devDependency in package.json L23 | CHK-01, CHK-02 |
| No test framework | available | package.json has no test script or test dependencies | CHK-03 |

### Required Checks

**[CHK-01] Typecheck passes clean**

- Action: Run `npm run typecheck` in the `helix-cli/` directory.
- Expected Outcome: Command exits with code 0 and produces no type errors.
- Required Evidence: Terminal output of `npm run typecheck` showing successful completion with exit code 0.

**[CHK-02] Build succeeds**

- Action: Run `npm run build` in the `helix-cli/` directory.
- Expected Outcome: Command exits with code 0, producing compiled JavaScript in `dist/`.
- Required Evidence: Terminal output of `npm run build` showing successful completion with exit code 0.

**[CHK-03] Code inspection of `src/tickets/create.ts` confirms all behavioral requirements**

- Action: Read the final `src/tickets/create.ts` and verify each of the following sub-checks by inspecting the source code:
  - (a) A `VALID_MODES` constant array contains exactly `["AUTO", "BUILD", "FIX", "RESEARCH", "EXECUTE"]`.
  - (b) `getFlag(args, "--mode")` is called to parse the optional flag.
  - (c) Mode validation normalizes input to uppercase via `.toUpperCase()` and checks against `VALID_MODES`.
  - (d) Invalid mode values trigger `console.error` with an error listing allowed values followed by `process.exit(1)`, before the `hxFetch` call.
  - (e) The POST body includes `mode` only when the flag is provided; when omitted, `mode` is absent from the body object.
  - (f) `CreateTicketResponse` type has `shortId?: string` (optional) and `mode?: string` (optional) on the `ticket` object.
  - (g) The `shortId` output line uses a guard (e.g., `?? "(pending)"`) that prevents printing "undefined".
  - (h) The `mode` output line is conditional — only prints when `data.ticket.mode` is truthy.
- Expected Outcome: All eight sub-checks (a) through (h) are satisfied.
- Required Evidence: The full content of `src/tickets/create.ts` showing each sub-check met, with specific line references.

**[CHK-04] Code inspection of `src/tickets/index.ts` confirms usage text update**

- Action: Read the final `src/tickets/index.ts` and verify the `ticketsUsage()` function's create line includes `--mode` with all five allowed values.
- Expected Outcome: The usage text for `tickets create` includes `[--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>]` or equivalent showing all five modes as optional.
- Required Evidence: The content of the `ticketsUsage()` function showing the updated create usage line.

**[CHK-05] No unintended file changes**

- Action: List all files modified relative to the base branch.
- Expected Outcome: Only `src/tickets/create.ts` and `src/tickets/index.ts` are modified. No other source files are changed.
- Required Evidence: Output of the file diff listing showing exactly these two files changed.

## Success Metrics

1. `--mode` flag is parsed, validated, and conditionally included in the POST body
2. All 5 valid modes accepted case-insensitively and normalized to uppercase
3. Invalid modes rejected with clear error before API call
4. Omitting `--mode` preserves exact current behavior (no `mode` field sent)
5. `shortId` output never shows "undefined"
6. Mode displayed in success output when present in API response
7. Usage text documents the new flag with all allowed values
8. Typecheck and build pass clean
9. Only two files modified: `src/tickets/create.ts` and `src/tickets/index.ts`

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Primary specification | Defines 5 allowed modes, case-insensitive input, conditional body inclusion, shortId fix, acceptance criteria with 10 specific items |
| scout/scout-summary.md | Change surface and pattern analysis | Confirmed primary file (create.ts L21-24 body, L29 shortId), secondary file (index.ts L33 usage), patterns for optional flags and error handling |
| scout/reference-map.json | File evidence with line numbers | Verified POST body construction at L21-24, response type at L5-8, shortId output at L29; confirmed no test infrastructure |
| diagnosis/diagnosis-statement.md | Root cause analysis | Confirmed feature gap (not bug), two distinct issues (missing --mode + shortId guard), change scoped to 2 files |
| diagnosis/apl.json | Structured Q&A with evidence | Validated all 7 diagnostic questions; confirmed getFlag import exists but unused, body sends 3 fields, no enum validator |
| product/product.md | Product definition and scope | Defined backward compatibility requirement, fail-fast validation, no test framework bootstrapping, single-repo scope |
| tech-research/tech-research.md | Architecture and technical decisions | Chose inline validation (Option A), .toUpperCase() normalization, conditional spread for body, optional shortId with nullish coalescing, no index.ts change |
| tech-research/apl.json | Technical Q&A | Confirmed 7 technical decisions with evidence: inline validation, uppercase normalization, conditional body, shortId guard, string type, no index.ts top-level change, no test framework |
| repo-guidance.json | Repo intent | Confirmed helix-cli is sole target repo with intent "target" |
| src/tickets/create.ts | Direct source inspection | Verified 34-line function: body at L21-24, type at L5-8, shortId at L29, getFlag imported at L3 but unused |
| src/tickets/index.ts | Direct source inspection | Verified ticketsUsage() at L28-39 with create usage at L33 lacking --mode |
| src/lib/flags.ts | Direct source inspection | Verified getFlag returns `string \| undefined` (L5-8); no enum validator exists |
| src/tickets/list.ts | Pattern reference | Verified getFlag usage (L47, 52, 59, 66) and toLowerCase comparison (L77) for CLI style precedent |
| src/tickets/get.ts | Pattern reference | Verified conditional display pattern for mergeQueueStatus (L36-38) — same pattern for mode output |
| package.json | Build config and quality gates | Confirmed ESM, scripts (build, typecheck, prepare), no test framework, devDeps only @types/node and typescript |

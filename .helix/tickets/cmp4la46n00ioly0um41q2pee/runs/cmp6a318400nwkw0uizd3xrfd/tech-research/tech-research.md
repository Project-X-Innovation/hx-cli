# Tech Research: helix-cli — Library Commands (Run 3 Targeted Fix)

## Technology Foundation

| Technology | Version | Purpose |
|-----------|---------|---------|
| TypeScript | tsc (ES2022) | Compilation; strict mode |
| Flag parsing | src/lib/flags.ts | `getFlag` (optional) vs `requireFlag` (mandatory) |

No new dependencies. Build is TypeScript-only (`tsc`).

## Architecture Decision

### Fix: Rating Optional for Replies — Conditional Flag Requirement

**Options Considered:**

| Option | Description | Verdict |
|--------|-------------|---------|
| **A: Conditional getFlag/requireFlag (chosen)** | Check --reply-to first; if present, use getFlag (optional) for --rating | Minimal change; follows flag utility semantics |
| B: Always getFlag with manual validation | Use getFlag for --rating always, then manually check/error when top-level | Loses the `requireFlag` error message; more code |
| C: New flag utility | Create `conditionalRequireFlag` | Over-engineering for one use case |

**Chosen: A** — The existing flag utilities provide the exact semantics needed. `requireFlag` prints an error and exits if the flag is missing. `getFlag` returns `undefined` if missing. The fix reads `--reply-to` first (already at line 36), then branches:
- If `--reply-to` is present (reply mode): use `getFlag` for `--rating` — returns the value or `undefined`
- If `--reply-to` is absent (top-level mode): use `requireFlag` for `--rating` — enforces presence

**Evidence:**
- `comments-post.ts:29` — `requireFlag(args, "--rating", "...")` currently always requires
- `comments-post.ts:36` — `const replyTo = getFlag(args, "--reply-to")` already reads the flag
- `src/lib/flags.ts` — `getFlag` returns `string | undefined`; `requireFlag` returns `string` or exits

## Core API/Methods

### Change in comments-post.ts

**Current flow (broken for replies):**
```
1. requireFlag(args, "--section", ...)  // always required ✓
2. requireFlag(args, "--rating", ...)   // always required ✗ (should be optional for replies)
3. getFlag(args, "--reply-to")          // optional ✓
4. Build body with { anchor, rating, content?, parentCommentId? }
5. POST to /library/items/:id/comments
```

**Fixed flow:**
```
1. requireFlag(args, "--section", ...)           // always required ✓
2. getFlag(args, "--reply-to")                   // read FIRST to determine mode
3. IF reply mode: getFlag(args, "--rating")      // optional for replies
   ELSE: requireFlag(args, "--rating", ...)      // required for top-level
4. Build body:
   - Always include: { anchor: section }
   - Include rating ONLY if non-null
   - Include content if present
   - Include parentCommentId if reply mode
5. POST to /library/items/:id/comments
```

**Body construction update:**
The body object currently always includes `rating` (line 44). When rating is `undefined` (reply without rating), it must be omitted from the body. The fix:
- Build body starting with `{ anchor: section }`
- Conditionally add `rating` only when it has a value
- Server handles missing rating field correctly for replies (stores null)

### Validation of RATING_MAP when rating is provided

When `--rating` IS provided (even for replies), it must still be validated against the RATING_MAP (lines 5-11). The validation logic (`if (!rating) { console.error(...); process.exit(1); }`) only runs when a raw rating string was provided. When rating is `undefined` (no flag), the validation is skipped entirely.

## Technical Decisions

### 1. Section Still Required for Replies

**Chosen:** Keep `--section` as required even for replies.
**Rationale:** Replies are always in the context of a section — they respond to a comment on a specific section. The server requires the `anchor` field for all comments. Removing the requirement would break the API contract.

### 2. No Changes to SKILL.md

**Chosen:** SKILL.md remains as-is.
**Rationale:** The existing documentation at lines 146-172 correctly describes the commands. The `--reply-to` flag is already documented. The change to make `--rating` optional for replies is a behavior refinement that doesn't require new documentation — agents using `--reply-to` will naturally omit `--rating` when posting conversational replies.

### 3. No Changes for LOVE Icon/Naming

**Chosen:** No CLI changes for the LOVE icon update.
**Rationale:** The CLI uses `love` as a flag value mapped to `LOVE` stored value (comments-post.ts:5-11). This is a data mapping, not a display concern. The icon change from heart to double thumbs up is a UI-only change in helix-global-client. The CLI's `love` flag value remains intuitive and correct.

## Cross-Platform Considerations

- **Server compatibility:** When `--reply-to` is present and `--rating` is absent, the POST body omits the `rating` field entirely. The server's Zod schema (`ratingSchema.optional()`) accepts this. The server's validation logic (`library-comment-service.ts:69-73`) only enforces rating for top-level comments (no `parentCommentId`).
- **Client compatibility:** No interaction between CLI and client for this fix.

## Performance Expectations

| Operation | Expected | Notes |
|-----------|----------|-------|
| `hlx library comments post --reply-to <id>` without `--rating` | <500ms | Same single POST request; no validation overhead |

## Dependencies

| Dependency | Type | Risk |
|-----------|------|------|
| Server nullable rating support | API contract | None — server accepts missing rating for replies |
| getFlag utility | Existing utility | None — already used at line 36 |
| requireFlag utility | Existing utility | None — already used at line 29 |

## Deferred to Round 2

| Feature | Why Deferred |
|---------|-------------|
| `--json` output flag | Output formatting layer; future pass |
| Error message clarity for reply mode | Current getFlag returns undefined silently; could add "posting reply without rating" info message |

## Summary Table

| Fix | Files Modified | Approach |
|-----|---------------|----------|
| Rating optional for replies | comments-post.ts (1 file) | Read --reply-to first; conditionally use getFlag vs requireFlag for --rating |
| **Total** | **1 existing file** | **Minimal targeted fix** |

## APL Statement

CLI needs 1 targeted fix: make --rating conditional in comments-post.ts. Read --reply-to first, then use getFlag (optional) instead of requireFlag (mandatory) for --rating when replying. When no --reply-to, keep requireFlag. No other CLI changes needed for the icon or nullable rating updates.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|-------------|
| ticket.md (Research Report) | Primary specification | Rating optional for replies when parentCommentId present |
| ticket.md (Discussion) | User feedback | Known gaps including rating optionality |
| diagnosis/apl.json (CLI) | Investigation context | One deviation: requireFlag for --rating when --reply-to present |
| diagnosis/diagnosis-statement.md (CLI) | Root cause | requireFlag at line 29; getFlag at line 36; conditional logic needed |
| product/product.md (CLI) | Product requirements | Reply without rating is essential for conversational thread replies |
| scout/reference-map.json (CLI) | File inventory | Exact line numbers for flag usage |
| repo-guidance.json | Repo intent | CLI is target with 1 fix |
| comments-post.ts:1-58 | Direct inspection | Full file: RATING_MAP, requireFlag at 29, getFlag --reply-to at 36, body construction at 42-47 |
| src/lib/flags.ts | Utility reference | getFlag returns string \| undefined; requireFlag exits on missing |
| Server library-comment-service.ts:69-73 | Cross-repo validation | Rating required for top-level only (validation correct) |

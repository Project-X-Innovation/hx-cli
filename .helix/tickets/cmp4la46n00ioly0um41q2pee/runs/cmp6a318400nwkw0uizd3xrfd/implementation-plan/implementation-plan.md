# Implementation Plan — helix-cli (Run 3 Targeted Fix)

## Overview

Run 3 targeted fix for the CLI library commands. All 7 new files and 2 modified files exist from prior runs and are structurally complete. One spec deviation needs fixing: `--rating` is required for all `comments post` invocations via `requireFlag`, but should be optional when `--reply-to` is present (reply comments are conversational, not ratings).

## Implementation Principles

- **Single targeted fix**: Modify only `comments-post.ts` — one file, ~10 lines changed.
- **Follow existing flag utility semantics**: Use `getFlag` (optional) for reply mode, `requireFlag` (mandatory) for top-level mode.
- **No new dependencies**: TypeScript-only build.
- **Preserve all working functionality**: list, show, comments list, comments post (top-level) continue unchanged.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| L1 | Make --rating conditional in comments-post.ts | `src/library/comments-post.ts` updated |
| L2 | Build verification | `tsc` passes |

## Detailed Implementation Steps

### Step L1: Make --rating conditional based on --reply-to

**Goal**: When `--reply-to` is present, `--rating` becomes optional. When absent (top-level post), `--rating` remains required.

**What to Build**:
- Edit `src/library/comments-post.ts`:
  1. Move the `--reply-to` flag read (currently line 36) BEFORE the `--rating` flag read (currently line 29)
  2. Conditionally use `getFlag` vs `requireFlag` for `--rating`:
     - If `replyTo` is truthy: `const ratingRaw = getFlag(args, "--rating");`
     - If `replyTo` is falsy: `const ratingRaw = requireFlag(args, "--rating", "...");`
  3. When `ratingRaw` exists, validate against RATING_MAP (existing logic, lines 30-34)
  4. When `ratingRaw` is undefined (reply without rating), skip validation
  5. Update body construction (lines 42-47):
     - Only include `rating` in the body when it has a value
     - Change from always setting `rating` to conditionally setting it:
       ```
       const body: Record<string, unknown> = { anchor: section };
       if (rating) body.rating = rating;
       if (content) body.content = content;
       if (replyTo) body.parentCommentId = replyTo;
       ```
  6. Update the output message (line 55-57) to handle missing rating:
     - Show `[reply]` instead of `[${ratingLabel}]` when no rating

**Verification (AI Agent Runs)**:
- Read file to confirm changes
- Run `npx tsc --noEmit` to verify TypeScript compilation
- Test by examining the logic flow for both modes

**Success Criteria**:
- `hlx library comments post <ref> --section <slug> --reply-to <id> "message"` works without `--rating`
- `hlx library comments post <ref> --section <slug> --rating thumbs-up` still requires `--rating` for top-level
- TypeScript compiles

---

### Step L2: Build verification

**Goal**: Confirm the CLI builds cleanly.

**What to Build**: No new code.

**Verification (AI Agent Runs)**:
- Write the .env file from dev setup config
- Run `npm install && npx tsc --noEmit` (or `npm run build` if configured)
- Verify zero TypeScript errors

**Success Criteria**:
- Build passes with zero errors
- No regressions

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|-----------------|----------------|
| Node.js + npm installed | available | Dev environment | CHK-01 through CHK-05 |
| CLI .env written with HELIX_API_KEY and HELIX_URL | available | Dev setup config | CHK-02 through CHK-05 |
| `npm install` completed | available | Standard setup | CHK-01 through CHK-05 |
| Server running (staging or local) accessible via HELIX_URL | available | HELIX_URL points to staging server | CHK-02 through CHK-05 |
| At least one library item exists for the configured organization | unknown | Depends on org data | CHK-02 through CHK-05 |
| A comment ID to reply to (from comments list) | unknown | Need to create or find a comment | CHK-04, CHK-05 |

### Required Checks

[CHK-01] TypeScript build passes with zero errors.
- Action: Run `npx tsc --noEmit` in the helix-cli directory.
- Expected Outcome: Command exits with code 0, zero TypeScript errors.
- Required Evidence: Terminal output showing successful compilation.

[CHK-02] `hlx library list` still works correctly.
- Action: Run `npx ts-node src/index.ts library list` (or the equivalent compiled command).
- Expected Outcome: Command outputs a table of library items with ID, Title, Status, and Date columns.
- Required Evidence: Command output showing the library items table.

[CHK-03] `hlx library comments post` with --rating (top-level) still works.
- Action: Run `npx ts-node src/index.ts library comments post <ref> --section <slug> --rating thumbs-up "Test comment from CLI"` using a valid library item reference.
- Expected Outcome: Command posts the comment and prints confirmation: `Posted: [thumbs-up] on <slug>: "Test comment from CLI"`.
- Required Evidence: Command output showing the successful post confirmation.

[CHK-04] `hlx library comments post` without --rating fails for top-level.
- Action: Run `npx ts-node src/index.ts library comments post <ref> --section <slug> "No rating"` — no `--rating` flag, no `--reply-to` flag.
- Expected Outcome: Command prints an error message about `--rating` being required and exits with non-zero code.
- Required Evidence: Error output showing the rating requirement message.

[CHK-05] `hlx library comments post` with --reply-to works WITHOUT --rating.
- Action: Run `npx ts-node src/index.ts library comments post <ref> --section <slug> --reply-to <comment-id> "Reply without rating"` — no `--rating` flag but `--reply-to` present.
- Expected Outcome: Command posts the reply and prints confirmation. The reply is created on the server with `rating: null`.
- Required Evidence: Command output showing successful post, AND a follow-up `hlx library comments list <ref>` showing the reply exists with no rating.

## Success Metrics

1. `tsc` / build passes with zero errors
2. Reply posts without `--rating` when `--reply-to` is present
3. Top-level posts still require `--rating`
4. All existing commands (list, show, comments list, comments post with rating) continue working
5. SKILL.md documentation remains accurate (no changes needed)

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (Research Report) | Primary specification for Phase 2b CLI | Rating optional for replies when parentCommentId present |
| ticket.md (Discussion) | User feedback from prior runs | Known gaps including rating optionality |
| scout/scout-summary.md (CLI) | Current implementation state | All files complete; rating optionality is the only gap |
| scout/reference-map.json (CLI) | File-level details | requireFlag at line 29, getFlag at line 36 |
| diagnosis/diagnosis-statement.md (CLI) | Root cause | Single fix: conditional flag requirement |
| product/product.md (CLI) | Product requirements | Reply without rating is essential for conversational replies |
| tech-research/tech-research.md (CLI) | Architecture decision | Conditional getFlag/requireFlag; read --reply-to first |
| repo-guidance.json | Repo roles | CLI is target with 1 fix |
| comments-post.ts (full file) | Direct code inspection | requireFlag at line 29, getFlag at line 36, body at lines 42-47 |
| src/lib/flags.ts | Utility reference | getFlag returns string or undefined; requireFlag exits on missing |

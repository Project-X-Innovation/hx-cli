# Implementation Plan — helix-cli (Run 4: Hardening & Polish)

## Overview

Run 4 hardening pass for the CLI library commands. All 7 new files and 2 modified files are feature-complete. Prior fix (--rating optionality for replies) is working. This run applies 2 discoverability fixes and 1 error handling improvement across 3 files. Total: ~20 lines.

User directive: "Make sure everything that is intuitive is intuitive."

## Implementation Principles

- **Discoverability first**: Users must find the feature via `hlx --help` before they can use it.
- **Self-contained workflows**: Output from `comments list` must provide everything needed for `comments post --reply-to`.
- **Graceful errors**: Network failures produce user-friendly messages, not stack traces.
- **No new dependencies**: TypeScript-only build.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Add library commands to main help text | Modified `src/index.ts` |
| 2 | Show comment IDs in `comments list` output | Modified `src/library/comments-list.ts` |
| 3 | Add error handling to comments commands | Modified `src/library/comments-list.ts` and `comments-post.ts` |
| 4 | Quality gates: build | Pass TypeScript build |
| 5 | CLI verification | Test all commands end-to-end |

## Detailed Implementation Steps

### Step 1: Add Library Commands to Main Help Text

**Goal:** Make `hlx library` discoverable from `hlx --help`.

**What to Build:**
- In `src/index.ts`, add 4 lines to the `usage()` function (between `hlx comments` block and `hlx skill` block, around line 53):
  ```
    hlx library list                List library items
    hlx library show <ref>          Show report with section annotations
    hlx library comments list <ref> List section-grouped comments
    hlx library comments post <ref> Post a section rating
  ```
- Follow existing formatting: 2-space indent, left-aligned command, right-padded description

**Verification (AI Agent Runs):**
```bash
cd /vercel/sandbox/workspaces/cmpad35bm002ufd0umr00rrkz/helix-cli && npx tsc --noEmit
```

**Success Criteria:**
- `hlx --help` includes library commands
- Formatting matches existing help entries

### Step 2: Show Comment IDs in `comments list` Output

**Goal:** Make comment IDs visible so `--reply-to` is usable.

**What to Build:**
- In `src/library/comments-list.ts`, modify the output format at line 68:
  - Change top-level format from:
    `  [${ratingLabel}] ${author} (${formatDate(comment.createdAt)})${text}`
    to:
    `  (${comment.id}) [${ratingLabel}] ${author} (${formatDate(comment.createdAt)})${text}`
  - Change reply format at line 75 from:
    `    -> [reply] ${replyAuthor} (${formatDate(reply.createdAt)})${replyText}`
    to:
    `    -> (${reply.id}) [reply] ${replyAuthor} (${formatDate(reply.createdAt)})${replyText}`
- Full comment ID shown (not truncated) — `--reply-to` needs the full ID for the API

**Verification (AI Agent Runs):**
```bash
cd /vercel/sandbox/workspaces/cmpad35bm002ufd0umr00rrkz/helix-cli && npx tsc --noEmit
```

**Success Criteria:**
- Comment IDs visible in `comments list` output
- IDs copy-paste-friendly for `--reply-to` usage

### Step 3: Add Error Handling to Comments Commands

**Goal:** Network failures produce user-friendly messages instead of stack traces.

**What to Build:**
- In `src/library/comments-list.ts`, wrap the `hxFetch` call (line 41) in try-catch:
  ```typescript
  try {
    const data = (await hxFetch(config, `/library/items/${resolvedId}/comments`, { ... })) as CommentsResponse;
    // ... existing formatting logic
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error fetching comments: ${message}`);
    process.exit(1);
  }
  ```
- In `src/library/comments-post.ts`, wrap the `hxFetch` call (line 62) in try-catch:
  ```typescript
  try {
    await hxFetch(config, `/library/items/${resolvedId}/comments`, { ... });
    // ... existing success output
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error posting comment: ${message}`);
    process.exit(1);
  }
  ```

**Verification (AI Agent Runs):**
```bash
cd /vercel/sandbox/workspaces/cmpad35bm002ufd0umr00rrkz/helix-cli && npx tsc --noEmit
```

**Success Criteria:**
- Network errors show `Error: <message>` instead of raw stack trace
- Build passes

### Step 4: Quality Gates

**Goal:** Pass TypeScript build with zero errors.

**What to Build:** No new code — run quality checks.

**Verification (AI Agent Runs):**
```bash
cd /vercel/sandbox/workspaces/cmpad35bm002ufd0umr00rrkz/helix-cli && npx tsc --noEmit
```

**Success Criteria:**
- TypeScript compiles with zero errors

### Step 5: CLI Verification

**Goal:** Verify all commands work end-to-end against the staging server.

**What to Build:** No code — test commands.

**Verification (AI Agent Runs):**
1. Write `.env` file with `HELIX_API_KEY` and `HELIX_URL` from dev setup config
2. Run `npm install`
3. Test `hlx --help` — verify library commands appear
4. Test `hlx library list` — verify table output
5. Test `hlx library show <ref>` — verify section annotations
6. Test `hlx library comments list <ref>` — verify comment IDs in output
7. Test `hlx library comments post <ref> --section <slug> --rating up "Test"` — verify success
8. Verify the `--reply-to` workflow using an ID from step 6

**Success Criteria:**
- All commands produce expected output
- Comment IDs visible and copy-paste-friendly
- Help text includes library commands

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|------------|--------|-----------------|----------------|
| Node.js and npm installed | available | Dev environment | CHK-01 through CHK-06 |
| CLI `.env` file with HELIX_API_KEY and HELIX_URL | available | Dev setup config: `HELIX_API_KEY=hxi_8cc66fe2...`, `HELIX_URL=https://helix-global-server-staging-3tl6o.ondigitalocean.app` | CHK-03 through CHK-06 |
| `npm install` completed | available | Standard setup step | CHK-01 through CHK-06 |
| Staging server accessible at HELIX_URL | available | Dev setup config provides staging URL | CHK-03 through CHK-06 |
| At least one library item exists for the configured organization | unknown | Depends on staging org data | CHK-04 through CHK-06 |
| A comment exists to test `--reply-to` | unknown | May need to create one via `comments post` first | CHK-06 |

### Required Checks

**[CHK-01] TypeScript build passes with zero errors**
- Action: Run `npx tsc --noEmit` in helix-cli.
- Expected Outcome: Exit code 0, zero TypeScript errors.
- Required Evidence: Command output showing successful compilation.

**[CHK-02] `hlx --help` shows library commands**
- Action: Run `npx tsx src/index.ts --help` (or equivalent) in helix-cli.
- Expected Outcome: Output includes `hlx library list`, `hlx library show`, `hlx library comments list`, `hlx library comments post` entries.
- Required Evidence: Command output showing the help text with library entries.

**[CHK-03] `hlx library list` returns library items**
- Action: Write `.env` file, run `npx tsx src/index.ts library list`.
- Expected Outcome: Output shows a table of library items with ID, Title, Status, Date columns. If no items exist, shows an appropriate message.
- Required Evidence: Command output showing the library items table or empty-state message.

**[CHK-04] `hlx library comments list <ref>` shows comment IDs**
- Action: Run `npx tsx src/index.ts library comments list <library-item-ref>` using a valid reference from CHK-03.
- Expected Outcome: Each comment line includes the comment ID in parentheses, e.g., `(clx1abc...) [thumbs-up] Alice (2026-05-10): "Great"`.
- Required Evidence: Command output showing comments with visible IDs.

**[CHK-05] `hlx library comments post` top-level with rating succeeds**
- Action: Run `npx tsx src/index.ts library comments post <ref> --section <slug> --rating up "Test from CLI"`.
- Expected Outcome: Output: `Posted: [up] on <slug>: "Test from CLI"`.
- Required Evidence: Command output showing successful post confirmation.

**[CHK-06] Network error produces user-friendly message**
- Action: Temporarily set `HELIX_URL` to an unreachable endpoint (e.g., `http://localhost:9999`) and run `npx tsx src/index.ts library comments list <ref>`.
- Expected Outcome: Output shows `Error fetching comments: <message>` — not a raw stack trace. Process exits with non-zero code.
- Required Evidence: Command output showing the formatted error message.

## Success Metrics

1. 2 discoverability fixes + 1 error handling fix across 3 files (~20 lines)
2. `tsc --noEmit` exits 0
3. All 6 Required Checks pass
4. All existing commands continue working (list, show, comments list, comments post)
5. SKILL.md documentation remains accurate (no changes needed — already complete)

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (research report) | Primary specification | CLI commands, resolution strategies, SKILL.md critical for agent discoverability |
| ticket.md (continuation context) | User directive | "Make sure everything intuitive is intuitive" |
| diagnosis/diagnosis-statement.md (CLI) | Root cause | 2 discoverability gaps: usage() missing library, IDs not in output; 1 error handling gap |
| diagnosis/apl.json (CLI) | 5-question audit | Rating aliases good, IDs needed for --reply-to, no try-catch on hxFetch |
| tech-research/tech-research.md (CLI) | Technical approach | Full ID in parentheses, help text between comments and skill blocks, try-catch pattern |
| scout/scout-summary.md (CLI) | Implementation state | All 7+2 files complete, prior fix confirmed |
| repo-guidance.json | Repo roles | CLI = 2 discoverability fixes + 1 error handling |
| src/index.ts (source, lines 35-59) | Direct inspection | usage() does not mention library |
| src/library/comments-list.ts (source, line 68) | Direct inspection | Format omits comment.id |
| src/library/comments-post.ts (source, line 62) | Direct inspection | hxFetch without try-catch |

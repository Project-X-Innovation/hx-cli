# Diagnosis Statement — helix-cli

## Problem Summary

The CLI library commands (Phase 2b) are structurally complete from prior runs — all 7 new files and 2 modified files exist and work correctly. One spec deviation needs fixing: `--rating` is required for all `comments post` commands via `requireFlag`, but should be optional when `--reply-to` is present (replies are conversational discussion, not section ratings).

## Root Cause Analysis

`comments-post.ts:29` uses `requireFlag(args, "--rating", ...)` which unconditionally requires the `--rating` flag. The spec says "when parentCommentId is present, rating becomes optional." The CLI `--reply-to` flag maps to `parentCommentId`. The fix is to check for `--reply-to` first, then conditionally use `getFlag` (optional) instead of `requireFlag` (mandatory) for `--rating`.

## Evidence Summary

| Finding | Source | Lines |
|---------|--------|-------|
| --rating always required via requireFlag | src/library/comments-post.ts | 29 |
| RATING_MAP correctly maps love -> LOVE | src/library/comments-post.ts | 5-11 |
| SKILL.md documents all commands correctly | skill-content/SKILL.md | 146-172 |
| Library case registered in dispatcher | src/index.ts | 94-97 |
| Server accepts optional rating for replies | helix-global-server library-comment-service.ts | 69-73 |
| Spec: rating optional for replies | ticket.md research report Zod note | N/A |

## Success Criteria

1. `hlx library comments post <ref> --section <slug> --reply-to <id> "message"` works without `--rating`
2. `hlx library comments post <ref> --section <slug> --rating thumbs-up` continues to require `--rating` for top-level posts
3. `tsc` (build) passes with zero TypeScript errors
4. All other CLI commands (library list, show, comments list) continue working

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (research report) | Phase 2b spec: commands, flags, rating optionality | Rating optional for replies when parentCommentId present |
| ticket.md (discussion) | User feedback and change requests | Known gaps including rating optionality |
| scout/reference-map.json (CLI) | File inventory and flag behavior | --rating required via requireFlag for all posts |
| scout/scout-summary.md (CLI) | Analysis summary | All files complete, rating optionality is the only gap |
| comments-post.ts | Direct code inspection | requireFlag at line 29, RATING_MAP at lines 5-11 |
| SKILL.md | Documentation state | Library section with all commands documented correctly |

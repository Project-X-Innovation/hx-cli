# Diagnosis Statement — helix-cli (Run 4: Hardening & Polish)

## Problem Summary

Run 4 continuation focus: discoverability and intuitiveness polish. The CLI library module is feature-complete — all 7 new files and 2 modified files exist, and the prior --rating optionality fix is working. Two discoverability gaps prevent the feature from being intuitive to use.

## Root Cause Analysis

1. **`hlx library` not in main help** — `src/index.ts` `usage()` function (lines 37-59) does not list `hlx library` or any library subcommands. The switch dispatcher (lines 94-97) routes `library` correctly, but users running `hlx --help` won't discover it. This is a simple omission — add library entries to the usage output.

2. **Comment IDs not shown in `comments list`** — `comments-list.ts` line 68 formats output as `[rating] author (date): "content"` but omits the comment ID. The `--reply-to` flag in `comments-post.ts` requires a comment ID, but users have no way to discover IDs from CLI output. The `id` field exists in the response type (line 6) but is never printed.

3. **Missing error handling in commands** — `comments-list.ts` (line 41) and `comments-post.ts` (line 62) call `hxFetch` without try-catch. Network failures produce raw stack traces instead of user-friendly error messages.

## Evidence Summary

| Finding | Source | Lines |
|---------|--------|-------|
| Missing from usage() | src/index.ts | 37-59 (no library entry) |
| Library case in switch | src/index.ts | 94-97 (exists, works) |
| Comment ID not printed | src/library/comments-list.ts | 68 (format omits id) |
| ID available in type | src/library/comments-list.ts | 6 (id: string in type) |
| --reply-to needs ID | src/library/comments-post.ts | 39 (getFlag for --reply-to) |
| No try-catch on hxFetch | src/library/comments-list.ts, comments-post.ts | 41, 62 |
| Rating optionality working | src/library/comments-post.ts | 29-51 (conditional logic) |
| SKILL.md complete | skill-content/SKILL.md | 48-51, 146-174 |

## Success Criteria

1. `hlx --help` shows library commands in the usage output
2. `hlx library comments list` shows comment IDs (needed for `--reply-to`)
3. Network errors produce user-friendly messages instead of stack traces
4. All existing CLI commands continue working
5. `tsc` (build) passes with zero TypeScript errors

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (research report) | CLI command spec and discoverability requirements | SKILL.md critical for agent discoverability |
| ticket.md (continuation context) | User directive | "Make sure everything intuitive is intuitive" |
| scout/reference-map.json (CLI) | File inventory | All files present, prior fix confirmed |
| scout/scout-summary.md (CLI) | Intuitiveness analysis | Rating aliases good, discoverability gaps identified |
| src/index.ts | Main help text inspection | library missing from usage() |
| comments-list.ts | Output format inspection | ID omitted from printed format |
| comments-post.ts | Reply workflow inspection | --reply-to needs ID user can't discover |

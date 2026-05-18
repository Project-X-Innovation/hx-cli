# Tech Research: Library Comments CLI Hardening (Run 4)

## Technology Foundation

| Technology | Version | Role |
|-----------|---------|------|
| TypeScript | tsc (ES2022, strict mode) | Compilation, no bundler |
| `src/lib/flags.ts` | N/A | Flag parsing (`getFlag`, `hasFlag`, `getPositionalArgs`) |
| `src/lib/http.ts` | N/A | `hxFetch` HTTP client with auth |
| `skill-content/SKILL.md` | N/A | Agent discoverability documentation |

No new dependencies. Build is TypeScript-only (`tsc`).

## Architecture Decision

### Option A: 2 targeted discoverability fixes + 1 error handling improvement (Chosen)

The CLI library module is feature-complete — all 7 new files and 2 modified files exist and work correctly. The prior `--rating` optionality fix is confirmed working. Two discoverability gaps prevent the feature from being intuitive, and one error handling gap produces poor UX on network failures.

**Rationale:**
- Rating aliases (`up`/`down`/`love`) are ergonomic and intuitive
- Auto-slugification (`--section "Key Findings"` -> `key-findings`) works correctly
- 3-format item resolution (cuid, short ID, title match) with disambiguation is well-implemented
- SKILL.md has complete Library section (lines 48-51, 146-174) for agent discoverability
- The gaps are output formatting and help text omissions, not structural defects

### Option B: Add a `--json` output flag for machine-readable output (Rejected for this run)

**Why rejected:** While useful for scripts and automation, JSON output is a formatting layer that doesn't affect intuitiveness of the current CLI commands. Deferred to future pass.

## Core Changes (3 Fixes)

### Fix 1: Add Library Commands to Main Help Text

**What:** Add `hlx library` entries to the `usage()` function in `src/index.ts`.

**Why:** The switch dispatcher at lines 94-97 correctly routes the `library` command, but the `usage()` function at lines 35-59 does not mention library commands anywhere. Users running `hlx` or `hlx --help` see no indication that library commands exist. This is the #1 discoverability gap — if users don't know the feature exists, they won't use it.

**Technical approach:**
- Add library command entries to the `usage()` output string, between the `hlx comments` and `hlx skill` blocks (logical grouping by domain):

```
  hlx library list                List library items
  hlx library show <ref>          Show report with section annotations
  hlx library comments list <ref> List section-grouped comments
  hlx library comments post <ref> Post a section rating
```

- Follow the existing formatting pattern: 2-space indent, left-aligned command, right-padded description
- The `<ref>` notation matches the existing `<id>` notation used elsewhere in the help text

### Fix 2: Show Comment IDs in `comments list` Output

**What:** Include the comment ID in the formatted output of `hlx library comments list`.

**Why:** The `--reply-to` flag in `comments-post.ts` line 39 requires a comment ID, but users have no way to discover IDs from CLI output. The `comments-list.ts` response type (line 6) includes `id: string`, but line 68's format string omits it: `console.log(\`  [${ratingLabel}] ${author} (${formatDate(comment.createdAt)})${text}\`)`.

**Technical approach:**
- Prepend the comment ID to each comment line, truncated for readability:
```
// Before:
  [thumbs-up] Alice (2026-05-10): "Great framing"

// After:
  [clx1abc] [thumbs-up] Alice (2026-05-10): "Great framing"
```

- Use `comment.id.slice(0, 7)` for a short, copy-paste-friendly prefix (similar to git short hashes)
- For replies, show the ID similarly:
```
    -> [clx1def] [reply] Bob (2026-05-11): "I disagree"
```

- This makes the `--reply-to` workflow discoverable:
```bash
hlx library comments list RSH-439    # See [clx1abc] in output
hlx library comments post RSH-439 --section key-findings --reply-to clx1abc --rating up "Agreed"
```

**Note:** The full cuid is typically 25 characters (e.g., `clx1abc2def3ghi4jkl5mno6p`). Showing the full ID would clutter the output. However, `--reply-to` needs the full ID for the API call. Two options:

- **Option A (recommended):** Show 7-char prefix in formatted output, but also document that `hlx library comments list --section <slug>` with fewer comments makes full IDs manageable
- **Option B:** Show full ID but indent it on a separate line. Clutters output.

Going with Option A: short ID prefix plus adding a note that full IDs are shown with `--verbose` or when piped (future enhancement).

Actually, the simpler approach: show the full ID since CLI users are comfortable with long strings and terminal selection. The truncated version creates confusion about what to pass to `--reply-to`.

**Revised approach:** Show full comment ID in parentheses after the author:
```
  [thumbs-up] Alice (2026-05-10) [clx1abc2def3ghi4jkl5mno6p]: "Great framing"
```

Or prefix format:
```
  clx1abc2def3ghi4jkl5mno6p [thumbs-up] Alice (2026-05-10): "Great framing"
```

**Final decision:** Show the full ID as a clearly-labeled prefix. Users can copy-paste it for `--reply-to`. The format becomes:
```
  (clx1abc...) [thumbs-up] Alice (2026-05-10): "Great framing"
```

This is clear, copy-paste-friendly, and self-documenting.

### Fix 3: Error Handling for Network Failures (Optional Hardening)

**What:** Wrap `hxFetch` calls in try-catch blocks in `comments-list.ts` and `comments-post.ts`.

**Why:** Both files call `hxFetch` without error handling. Network failures, 404 responses, or auth errors produce raw stack traces instead of user-friendly messages.

**Technical approach:**
- Wrap the `hxFetch` call in a try-catch:
```typescript
try {
  const data = await hxFetch(config, `/library/items/${resolvedId}/comments`, { ... });
  // ... existing formatting logic
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
}
```

- Apply to both `comments-list.ts` (line 41) and `comments-post.ts` (line 62)
- The `resolve-library-item.ts` file already has its own error handling for resolution failures, so that's covered

## Technical Decisions

### Decision 1: Full ID vs Truncated ID in Output

**Chosen:** Full comment ID displayed in parentheses.
**Rejected:** 7-character truncated prefix.
**Rationale:** `--reply-to` requires the full ID. Truncating creates a discovery problem — users see a short ID but need to find the full one somewhere. Showing the full ID makes the `comments list` -> `comments post --reply-to` workflow self-contained.

### Decision 2: Help Text Position

**Chosen:** Place library commands between `hlx comments` and `hlx skill` blocks.
**Rejected:** (a) At the top (too prominent for a new feature), (b) At the bottom (easy to miss).
**Rationale:** Logical domain grouping: `comments` (ticket comments) -> `library` (library commands including library comments) -> `skill` (tooling). The flow from ticket operations to library operations to utility commands is natural.

### Decision 3: Error Message Format

**Chosen:** Simple `Error: <message>` with `process.exit(1)`.
**Rejected:** (a) Detailed HTTP status codes in output (too technical), (b) Retry prompts (not appropriate for CLI one-shot commands).
**Rationale:** Matches the error reporting pattern in other CLI commands. The `hxFetch` wrapper already formats HTTP errors into readable messages. The try-catch just prevents raw stack traces from leaking to the user.

## Cross-Platform Considerations

- **Server compatibility:** No server changes needed. The CLI consumes existing endpoints unchanged.
- **Client compatibility:** No interaction between CLI and client for these changes.
- **Agent discoverability:** SKILL.md is already complete and documents all library commands. The `usage()` fix targets human CLI users, not agents (agents read SKILL.md).

## Performance Expectations

| Operation | Expected | Notes |
|-----------|----------|-------|
| `hlx --help` | Instant | String output, no network call |
| `hlx library comments list` | <500ms | Single GET request + formatting |
| Error handling overhead | <0.1ms | Try-catch is zero-cost in happy path |

## Dependencies

| Dependency | Type | Risk |
|-----------|------|------|
| usage() function | Internal | Existing function at lines 35-59; adding 4 lines is trivial |
| comments-list.ts format | Internal | Existing formatting at line 68; prepending ID is additive |
| hxFetch | Internal | Existing HTTP client; try-catch wrapping is standard |

## Deferred to Round 2

| Item | Why Deferred |
|------|-------------|
| `--json` output flag | Formatting layer; not a discoverability issue |
| `--verbose` flag for detailed output | Not in MVP scope |
| Interactive section selection (fzf-style) | Nice-to-have; terminal UI library dependency |
| Color-coded rating output (ANSI colors) | Polish; not all terminals support colors |

## Summary Table

| Change | File | Lines Changed | Risk |
|--------|------|--------------|------|
| Library in usage() help | src/index.ts | +4 | Trivial |
| Comment IDs in output | src/library/comments-list.ts | +4 | Trivial |
| Error handling (optional) | src/library/comments-list.ts, comments-post.ts | +12 | Low |
| **Total** | **3 files** | **~20 lines** | **Trivial-Low** |

## APL Statement Reference

See `tech-research/apl.json`. All questions resolved. No unresolved followups.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (research report) | Primary spec for Phase 2b | CLI commands, resolution strategies, SKILL.md requirements |
| ticket.md (continuation context) | User directive | "Make sure everything intuitive is intuitive" |
| diagnosis/diagnosis-statement.md (CLI) | Root cause analysis | 2 discoverability gaps: missing from usage(), IDs not in output; 1 error handling gap |
| diagnosis/apl.json (CLI) | 5-question audit | Rating aliases good, --reply-to needs discoverable IDs, no try-catch on hxFetch |
| product/product.md | Product requirements | P9: library in main help, P10: comment IDs in output |
| scout/scout-summary.md (CLI) | Implementation state | All 7 new + 2 modified files complete; rating aliases, auto-slugification confirmed |
| repo-guidance.json | Repo roles | CLI = 2 discoverability fixes + optional error handling |
| src/index.ts (source, lines 35-59) | Direct inspection | usage() does not mention library — confirmed gap |
| src/index.ts (source, lines 94-97) | Direct inspection | library case in switch — routing works correctly |
| src/library/comments-list.ts (source, line 68) | Direct inspection | Format string omits comment.id despite id being in type at line 6 |
| src/library/comments-post.ts (source, line 39) | Direct inspection | getFlag for --reply-to requires ID users can't discover |

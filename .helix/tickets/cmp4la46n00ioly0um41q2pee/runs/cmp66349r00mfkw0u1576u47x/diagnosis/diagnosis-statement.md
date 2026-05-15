# Diagnosis Statement: helix-cli (Phase 2b)

## Problem Summary

The CLI has no library-related commands. Agents and CLI users cannot discover, view, or interact with library reports and their section-level feedback. Need to add `hlx library list|show|comments list|comments post` commands with item resolution, section targeting, and SKILL.md documentation for agent discoverability. This is Phase 2b, consuming the server API contract established in Phase 1.

## Root Cause Analysis

This is a greenfield feature implementation. The CLI currently has no library module:

1. **No library dispatcher**: The main command dispatcher (src/index.ts:72-124) has no `library` case. Commands include: login, token, inspect, comments, org, tickets, skill, update.
2. **No library module**: No `src/library/` directory exists. All 7 new files are created fresh.
3. **No item resolution**: No utility exists for resolving library items by cuid, ticket shortId, or title. The existing resolve-ticket.ts (128 lines) provides the adaptation pattern.
4. **No SKILL.md library section**: The SKILL.md Available Commands table has no library entries, making the feature invisible to agents.

## Evidence Summary

### Integration Points (Static Analysis)
- **Main dispatcher** (src/index.ts:72-124): Switch statement pattern. Add `library` case following the `comments` pattern (lines 87-91) with `configOrHelp` for auth.
- **Module router** (src/comments/index.ts, 52 lines): Dispatch to subcommands via switch on args[0]. Library router follows the same pattern with list/show/comments subcommands.
- **HTTP client** (src/lib/http.ts): `hxFetch` with auth headers, retry, basePath. Library commands use `basePath: '/api'`.
- **Flag parsing** (src/lib/flags.ts): getFlag, hasFlag, getPositionalArgs, requireFlag functions. Library needs --section, --rating flags.
- **Item resolution** (src/lib/resolve-ticket.ts, 128 lines): 3-strategy resolution pattern. Library adapts for cuid, shortId, title match.
- **SKILL.md** (skill-content/SKILL.md): Available Commands table format. Add library entries.

### Implementation Scope

| Category | New Files | Modified Files |
|----------|-----------|----------------|
| Module router | src/library/index.ts | - |
| Commands | src/library/list.ts, show.ts | - |
| Comment commands | src/library/comments.ts, comments-list.ts, comments-post.ts | - |
| Resolution | src/lib/resolve-library-item.ts | - |
| Dispatch | - | src/index.ts |
| Documentation | - | skill-content/SKILL.md |
| **Total** | **7 new files** | **2 modified files** |

## Success Criteria

1. `hlx library list` lists library items with ID, title, status, and date
2. `hlx library show <ref>` shows report with section heading slugs and comment summaries
3. `hlx library comments list <ref>` lists comments grouped by section with ratings and text
4. `hlx library comments post <ref> --section <slug> --rating <value> [message]` posts a section rating
5. Item resolution supports cuid, ticket shortId, and title match strategies
6. Section targeting accepts both raw slugs and heading text (auto-slugified)
7. SKILL.md documents all library commands for agent discoverability
8. `npm run build` (tsc) passes with zero TypeScript errors

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|-------------|
| ticket.md Research Report | Primary specification | 9 CLI implementation steps, command format, resolution strategies, section targeting, SKILL.md update |
| scout/reference-map.json (cli) | Identify key files and patterns | 11 files mapped; no library code exists; flag and HTTP patterns confirmed |
| scout/scout-summary.md (cli) | Analysis of codebase patterns | Router, resolution, flag, output formatting patterns all established |
| src/index.ts:72-124 | Verify command dispatcher | Switch statement, no library case; comments pattern at lines 87-91 |
| src/comments/index.ts | Verify module router pattern | 52-line dispatch to subcommands |
| src/lib/flags.ts | Verify flag parsing | getFlag, hasFlag, getPositionalArgs, requireFlag available |
| src/lib/resolve-ticket.ts | Verify resolution pattern | 3-strategy resolution, adaptable for library items |

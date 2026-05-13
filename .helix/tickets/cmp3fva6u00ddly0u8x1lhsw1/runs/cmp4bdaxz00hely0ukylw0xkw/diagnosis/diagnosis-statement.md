# Diagnosis Statement: helix-cli

## Problem Summary

The CLI has no library commands. Users and agents cannot list library items, view reports with section annotations, or post/list section-level comments from the terminal. A new `src/library/` module with four commands is needed, plus a resolve-library-item utility and SKILL.md documentation for agent discoverability.

## Root Cause Analysis

This is a net-new CLI module. No library command infrastructure exists:

1. **Command router gap**: src/index.ts switch statement (lines 72-124) has 8 command cases but no 'library' case.

2. **Module gap**: No src/library/ directory exists. The CLI has modules for comments, tickets, inspect, org, etc., but not library.

3. **Resolution utility gap**: src/lib/resolve-ticket.ts handles ticket ID resolution. No analogous resolve-library-item.ts exists for library item references.

4. **Agent documentation gap**: skill-content/SKILL.md documents all CLI commands (lines 31-50) but has no library section.

**Pattern templates are clear**: The existing comments module (index.ts, list.ts, post.ts) provides the exact structural template. The resolve-ticket.ts utility provides the resolution pattern. The flags.ts module already supports the parsing primitives needed for --section and --rating flags.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| No 'library' case in switch | src/index.ts lines 72-124 | Must add command routing |
| Comments module pattern | src/comments/index.ts (53 lines) | Subcommand switch, configOrHelp, resolveTicket template |
| Ticket resolution pattern | src/lib/resolve-ticket.ts | extractRef + matchItem + resolveItem approach |
| Flag parsing utilities | src/lib/flags.ts | getFlag, hasFlag, requireFlag already support new flags |
| No src/library/ directory | index.ts imports analysis | Entire module is greenfield |
| SKILL.md command table | skill-content/SKILL.md lines 31-50 | Extension point for library commands |

## Success Criteria

1. **Module router**: src/library/index.ts with runLibrary function handling list, show, comments subcommands.
2. **Four commands**: hlx library list, hlx library show \<ref\>, hlx library comments list \<ref\>, hlx library comments post \<ref\>.
3. **Resolution utility**: src/lib/resolve-library-item.ts with extractLibraryRef + matchLibraryItem + resolveLibraryItem.
4. **CLI routing**: 'library' case added to src/index.ts switch statement.
5. **Flags**: --section \<slug\>, --rating \<thumbs-up|love|thumbs-down\> parsed via existing flag utilities.
6. **SKILL.md**: Library section added with all four commands and agent workflow example.
7. **Build passes**: `tsc` succeeds.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement | Implementation ticket for RSH-443 research |
| scout/reference-map.json (cli) | File inventory and facts | 10 files; switch-based routing; no src/library/ exists; --section/--rating flags |
| scout/scout-summary.md (cli) | Analysis synthesis | Comments module as pattern template; resolve-ticket.ts as resolution template; SKILL.md update needed |
| src/index.ts | Command router | Switch at lines 72-124; comments case at lines 87-90 as template |
| src/comments/index.ts | Module router pattern | 53-line subcommand dispatch template |
| src/lib/resolve-ticket.ts | Resolution pattern | extractTicketRef + matchTicket for library item adaptation |
| src/lib/flags.ts | Flag utilities | getFlag, requireFlag, isHelpRequested primitives |
| skill-content/SKILL.md | Agent docs | Command table at lines 31-50 to extend |

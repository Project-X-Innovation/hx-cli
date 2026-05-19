# Diagnosis Statement: helix-cli

## Problem Summary

The CLI's ticket creation command does not recognize GOAL as a valid mode. The VALID_MODES array and help text need GOAL added.

## Root Cause Analysis

This is a minimal feature gap. create.ts line 12 defines VALID_MODES as ['AUTO', 'BUILD', 'FIX', 'RESEARCH', 'EXECUTE']. The mode is validated case-insensitively (line 81) and passed directly to the API (line 91). Adding 'GOAL' to the array and updating help text is sufficient. The CLI has no mode-specific logic beyond validation and passthrough.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| VALID_MODES has 5 values (no GOAL) | create.ts line 12 | Confirmed by scout |
| Help text lists 5 modes | create.ts line 16 | --mode <AUTO\|BUILD\|FIX\|RESEARCH\|EXECUTE> |
| Case-insensitive validation | create.ts line 81 | mode.toUpperCase() |
| Mode passthrough to API | create.ts line 91 | No CLI-side mode-specific logic |
| Subcommand help | index.ts lines 15-31 | Lists mode options in create usage |

## Success Criteria

1. 'GOAL' added to VALID_MODES array in create.ts.
2. GOAL added to --mode help text in create.ts.
3. GOAL added to mode options in index.ts help text.
4. `npm run typecheck` passes.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (RSH-488 Research Report, Section 8.3) | CLI-specific impact map | 'Add GOAL to VALID_MODES array and --mode help text' |
| scout/reference-map.json (helix-cli) | Locate exact files and line numbers | create.ts line 12, line 16, lines 78-87; index.ts lines 15-31 |
| scout/scout-summary.md (helix-cli) | Confirm minimal scope | 2-file change, no new commands for MVP |

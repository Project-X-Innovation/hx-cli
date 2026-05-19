# Diagnosis Statement — helix-cli

## Problem Summary

The CLI's ticket creation command does not include GOAL in its list of valid modes, preventing users from creating GOAL tickets via `hlx tickets create --mode GOAL`.

## Root Cause Analysis

The VALID_MODES array at create.ts line 12 is a static tuple with 5 values: AUTO, BUILD, FIX, RESEARCH, EXECUTE. GOAL is not present. The usage text at line 16 does not mention GOAL. The validation logic at lines 78-87 normalizes input to uppercase and checks against VALID_MODES — this pattern means adding GOAL to the array is sufficient.

## Evidence Summary

- create.ts line 12: `const VALID_MODES = ['AUTO','BUILD','FIX','RESEARCH','EXECUTE'] as const` — no GOAL
- create.ts line 16: usage text lists `--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>` — no GOAL
- create.ts lines 78-87: validation normalizes to uppercase, checks includes(), errors with VALID_MODES.join() — pattern handles additions automatically
- No existing goal-related code in CLI source (grep confirmed)

## Success Criteria

1. VALID_MODES includes 'GOAL'
2. Usage text shows GOAL as a mode option
3. `hlx tickets create --mode GOAL --title "..." --description "..."` successfully creates a GOAL ticket
4. No regressions in other mode creation

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (RSH-488 Research Report) | Primary specification — Section 8.3 defines CLI changes | Only VALID_MODES addition needed; goal-specific commands deferred |
| scout/reference-map.json (CLI) | Identified file and line numbers | create.ts line 12 (VALID_MODES), line 16 (usage text), lines 78-87 (validation) |
| scout/scout-summary.md (CLI) | Confirmed minimal scope | 2-line change, no new logic needed |

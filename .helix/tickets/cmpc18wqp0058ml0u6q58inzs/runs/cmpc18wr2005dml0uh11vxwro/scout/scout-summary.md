# Scout Summary: helix-cli

## Problem

Add GOAL to the CLI's ticket creation mode options. This is a minimal, mechanical change: add "GOAL" to the VALID_MODES array and update help text strings in create.ts and index.ts.

## Analysis Summary

The helix-cli has a simple, well-defined pattern for mode support:

**Mode Validation (src/tickets/create.ts):**
- VALID_MODES array at line 12: `["AUTO", "BUILD", "FIX", "RESEARCH", "EXECUTE"]`. Adding "GOAL" extends to 6 values.
- Help text at line 16 shows `--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>`. Needs GOAL added.
- Mode validation at lines 78-87 is case-insensitive (.toUpperCase() at line 81) and validates against VALID_MODES.
- The mode parameter is optional; when provided, it's passed directly to the API in the request body (line 91).

**Help Text (src/tickets/index.ts):**
- Tickets subcommand help text (lines 15-31) lists create command usage with mode options. Needs GOAL in the mode list.

**No additional CLI infrastructure needed for MVP:**
- No Goal-specific commands (hlx goals ...) needed in MVP.
- Existing `hlx tickets get` and `hlx tickets list` will show GOAL tickets without modification since mode is a display field.
- Build is pure TypeScript compilation. No ORM, no migrations, no database.

## Relevant Files

| File | Lines | Relevance |
|------|-------|-----------|
| src/tickets/create.ts | 12, 16, 78-87 | VALID_MODES array, help text, mode validation |
| src/tickets/index.ts | 15-31 | Subcommand help text with mode options |
| package.json | - | Build: tsc, Typecheck: tsc --noEmit, Test: tsc && node --test |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (RSH-488 Research Report, Section 8.3) | CLI-specific impact map | Add GOAL to VALID_MODES array and help text. Future Goal-specific commands deferred. |
| src/tickets/create.ts | Verify VALID_MODES location and pattern | Line 12 VALID_MODES array, case-insensitive validation, optional --mode flag |
| src/tickets/index.ts | Verify help text location | Lines 15-31 list create usage with mode options |

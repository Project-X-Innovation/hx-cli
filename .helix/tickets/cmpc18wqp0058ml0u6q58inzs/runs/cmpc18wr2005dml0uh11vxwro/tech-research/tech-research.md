# Tech Research: GOAL TicketMode & Ralph Loop -- helix-cli

## Technology Foundation

- **Language**: TypeScript, compiled to JS (`tsc`).
- **Build**: Pure TypeScript compilation. No ORM, no migrations, no bundler.
- **Mode handling**: `VALID_MODES` array in `create.ts` line 12. Case-insensitive validation (line 81). Mode passed directly to API (line 91). No CLI-side mode-specific logic beyond validation.
- **Pattern**: The CLI is a thin passthrough for ticket creation modes. It validates the mode string and sends it to the server API.

## Architecture Decision

### Decision 1: Scope of CLI Changes

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A) Minimal: add GOAL to VALID_MODES + help text | Add "GOAL" to the array, update help text in create.ts and index.ts | Minimal, sufficient for MVP, consistent with product scope | No Goal-specific CLI commands |
| B) Add GOAL + new `hlx goals` subcommand | New commands for goal status, proposal review, approve/reject | Full CLI experience for Goals | Significant new code; product scope explicitly defers Goal-specific CLI commands |

**Chosen: Option A -- Minimal VALID_MODES + help text update.**

**Rationale:** The product spec (product.md, Out of Scope #9) explicitly defers Goal-specific CLI commands: "`hlx goals ...` commands deferred; `hlx tickets create --mode GOAL` suffices for MVP." The CLI has no mode-specific logic beyond validation -- the mode value is passed through to the API. Adding "GOAL" to `VALID_MODES` and updating help text is the complete change.

Existing `hlx tickets get` and `hlx tickets list` will display GOAL tickets without modification since mode is a display field returned by the server.

## Core API/Methods

### Modified Files

| File | Change | Lines Affected |
|------|--------|----------------|
| `src/tickets/create.ts` | Add `"GOAL"` to `VALID_MODES` array | Line 12 |
| `src/tickets/create.ts` | Add `GOAL` to `--mode` help text | Line 16 |
| `src/tickets/index.ts` | Add `GOAL` to mode options in subcommand help text | Lines 15-31 |

### No New Files

No new files, commands, or validation logic needed for MVP.

## Technical Decisions

### Rejected: Goal-Specific CLI Commands

New `hlx goals create`, `hlx goals status`, `hlx goals approve` commands were rejected because:
1. Product scope explicitly defers them (product.md, Out of Scope #9).
2. `hlx tickets create --mode GOAL` provides creation capability.
3. Goal proposal review is a visual, interactive task better suited to the web UI.
4. The CLI has no mode-specific logic today; Goals don't need to be the first exception.

## Cross-Platform Considerations

CLI changes are independent of server and client changes. The VALID_MODES array is client-side validation only; the server performs its own mode validation against platform config. The CLI change can be made and tested independently.

## Performance Expectations

Zero performance impact. Adding one string to an array.

## Dependencies

| Dependency | Type | Status | Risk |
|------------|------|--------|------|
| TypeScript compiler | Existing | In use | None |
| Server API GOAL mode support | Required for runtime | Not yet implemented | CLI change is safe to deploy first; server rejects unknown modes gracefully |

## Deferred to Round 2

| Item | Why Deferred |
|------|-------------|
| `hlx goals` subcommand | Product scope explicitly defers (Out of Scope #9) |
| Goal progress display in `hlx tickets get` | Existing output includes mode and status; sufficient for MVP |
| Proposal review CLI flow | Better suited to web UI; interactive review with approve/modify/reject |

## Summary Table

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Scope | Minimal: VALID_MODES + help text | Product scope defers Goal-specific CLI commands; CLI is a thin passthrough |
| Files changed | 2 files (create.ts, index.ts) | Minimal, mechanical change following existing pattern |
| New commands | None | Deferred per product.md Out of Scope #9 |

## APL Statement Reference

See `tech-research/apl.json` for the investigation trail.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (RSH-488 Research Report, Section 8.3) | CLI-specific impact map | Add GOAL to VALID_MODES and help text; future commands deferred |
| diagnosis/diagnosis-statement.md (CLI) | Root cause and scope | VALID_MODES at line 12, help text at line 16; no mode-specific logic beyond validation |
| product/product.md (CLI) | MVP scope and out-of-scope items | Out of Scope #9: Goal-specific CLI commands deferred |
| scout/reference-map.json (CLI) | File locations | create.ts and index.ts with exact line numbers |
| scout/scout-summary.md (CLI) | Pattern confirmation | Case-insensitive validation, passthrough to API, 2-file change scope |

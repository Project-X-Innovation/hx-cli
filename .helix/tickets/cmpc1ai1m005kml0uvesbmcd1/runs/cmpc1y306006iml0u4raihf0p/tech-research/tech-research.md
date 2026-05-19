# Tech Research — helix-cli (Goals: GOAL Mode in Create Command)

## Technology Foundation

- **Runtime**: Node.js + TypeScript. Build: `tsc`. Test: `tsc && node --test dist/**/*.test.js`.
- **Pattern**: VALID_MODES const tuple at create.ts line 12. Validation normalizes input to uppercase and checks against the array. Error messages auto-generate from VALID_MODES.join().

## Architecture Decision

### Decision 1: GOAL Mode Addition

**Options considered:**
1. **Add GOAL to VALID_MODES array** (chosen): One-line addition to the tuple plus usage text update.
2. **Goal-specific CLI commands**: New `hlx goals` subcommand group.

**Chosen: VALID_MODES addition only.** The research report (Section 8.3) explicitly defers Goal-specific CLI commands to future work. For MVP, operators create GOAL tickets via the existing `hlx tickets create --mode GOAL` command. The validation logic at lines 78-87 handles the addition automatically — it normalizes input to uppercase, checks includes(), and generates error messages from VALID_MODES.join().

**Rationale**: 2-line change. Zero new logic. Validation pattern handles additions automatically. Goal-specific commands deferred per research report.

## Core API/Methods

### Changes

| File | Line | Change |
|------|------|--------|
| `src/tickets/create.ts` | 12 | Add `'GOAL'` to VALID_MODES tuple: `const VALID_MODES = ['AUTO', 'BUILD', 'FIX', 'RESEARCH', 'EXECUTE', 'GOAL'] as const` |
| `src/tickets/create.ts` | 16 | Update usage text: `--mode <AUTO\|BUILD\|FIX\|RESEARCH\|EXECUTE\|GOAL>` |

No other files need changes. The validation logic (lines 78-87) and API body construction (line 91: `...(mode && { mode })`) handle GOAL automatically.

## Technical Decisions

### Rejected: Goal-Specific CLI Commands (Deferred)

`hlx goals status`, `hlx goals proposals` etc. are valuable but not MVP. The research report Section 8.3 marks `src/goals/` as "New (deferred)." Operators interact with Goals primarily through the web UI (checker proposal review, approval). CLI is for creation only at MVP.

## Performance Expectations

Zero impact. Adding one string to a const array.

## Dependencies

| Dependency | Details |
|------------|---------|
| Server GOAL mode acceptance | Server must accept `mode: GOAL` in POST /tickets. Depends on server adding GOAL to ticketModeEnum in ticket-controller.ts. |

## Deferred to Round 2

| Item | Why Deferred |
|------|-------------|
| `hlx goals status` | Goal progress checking via CLI |
| `hlx goals proposals` | Proposal review via CLI |
| `hlx goals approve/reject` | Proposal approval via CLI |

## Risks

None. The change is a 2-line addition to a const array and usage text string.

## Summary Table

| Decision | Choice | Key Reason |
|----------|--------|------------|
| GOAL mode | Add to VALID_MODES array | 2-line change; validation handles additions automatically |
| Goal-specific commands | Deferred | Research report explicitly defers; web UI is primary interaction |

## APL Statement Reference

See tech-research/apl.json. All questions resolved. No remaining followups.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (RSH-488 Research Report) | Section 8.3 defines CLI scope | Only VALID_MODES addition; goal-specific commands deferred |
| diagnosis/diagnosis-statement.md (CLI) | Confirmed VALID_MODES has 5 values, no GOAL | Validation pattern handles additions automatically |
| scout/reference-map.json (CLI) | Identified file and line numbers | create.ts line 12 (VALID_MODES), line 16 (usage text) |
| src/tickets/create.ts (direct read) | Verified current VALID_MODES and validation pattern | 5 values, uppercase normalization, includes check, auto error messages |

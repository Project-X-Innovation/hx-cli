# Tech Research: Conflict Resolution — Library Comments Feature (BLD-448) — helix-cli

## Technology Foundation

This is a **conflict resolution run** triggered by a staging refresh merge. The CLI Library module is fully implemented with all 9 Phase 2b steps complete: 6 command files in `src/library/`, resolution utility, main dispatcher registration, and SKILL.md update. No new feature work is required.

| Technology | Version | Role |
|-----------|---------|------|
| TypeScript (tsc) | strict | Compilation |
| hxFetch HTTP client | src/lib/http.ts | API communication |
| Flag parsing | src/lib/flags.ts | CLI argument handling |

No new dependencies required.

## Architecture Decision

### Problem: Staging Refresh Merge Conflict

`merge-conflicts.json` lists `src/tickets/index.ts` as the sole conflicted file:
- **Ticket side**: 4 commits (5cfbd79, ca6c51b, 210d9fc, 758fce3) — ticket command improvements
- **Staging side**: 1 commit (6a4215c) — changes from another ticket

### Chosen: No-op — Build Verification Only

The resolved `src/tickets/index.ts` (150 lines) correctly preserves:
- **Ticket intent**: All 10 ticket subcommand imports and handler functions (list, latest, get, create, update-description, rerun, continue, artifacts, artifact, bundle)
- **Staging intent**: Standard dispatcher logic from the staging commit

This file is the **ticket subcommand dispatcher**, not the library module. The library module lives separately in `src/library/` and was not part of the conflict.

Zero conflict markers found. Build gate: `npm run build` (tsc).

## Core API/Methods

No changes needed. The fully implemented CLI surface:

### Library Commands (all in `src/library/`)
| Command | File | Purpose |
|---------|------|---------|
| `hlx library list` | `list.ts` | List library items |
| `hlx library show <ref>` | `show.ts` | Show report with section annotations |
| `hlx library comments list <ref>` | `comments-list.ts` | List comments grouped by anchor |
| `hlx library comments post <ref>` | `comments-post.ts` | Post rating + optional text |
| Module router | `index.ts` | Dispatch to subcommands |
| Comments router | `comments.ts` | Nested dispatch for comments |

### Supporting Infrastructure
| File | Purpose |
|------|---------|
| `src/lib/resolve-library-item.ts` | Multi-format item resolution (cuid, ticket short ID, title) |
| `src/index.ts` (lines 98-102) | Library case in main dispatcher |
| `skill-content/SKILL.md` (lines 146-179) | Agent discoverability documentation |

## Technical Decisions

### TD-1: No Source Code Changes Needed

| Chosen | Verify auto-merge, run build, no modifications |
|--------|------------------------------------------------|
| Rejected | Manual conflict resolution |
| Rationale | Zero markers in tickets/index.ts. File is ticket dispatcher (unrelated to library module). All library files separate and intact. |

### TD-2: Build Verification as Primary Gate

| Chosen | `npm run build` (tsc) |
|--------|----------------------|
| Rejected | Only checking for markers |
| Rationale | TypeScript compilation catches import mismatches or type changes introduced by the staging merge. |

## Cross-Platform Considerations

Not applicable — CLI-only conflict resolution.

## Performance Expectations

No performance changes from conflict resolution.

## Dependencies

No changes. Existing: TypeScript (tsc), hxFetch HTTP client, flag parsing utilities.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Auto-merge broke ticket command imports | Low | TypeScript build catches this |
| Library module affected by merge | None | Library module is in `src/library/`, separate from the conflicted `src/tickets/index.ts` |

## Deferred to Round 2

Not applicable — conflict resolution run.

## Summary Table

| Aspect | Detail |
|--------|--------|
| Conflicted file | `src/tickets/index.ts` (150 lines) |
| Relation to feature | None — ticket subcommand dispatcher |
| Markers found | 0 |
| Code changes needed | None |
| Validation gate | `npm run build` (tsc) |
| Feature status | Fully implemented: 6 library commands, resolution utility, SKILL.md |

## APL Statement Reference

See `tech-research/apl.json`. CLI conflict is pre-resolved. Zero markers. Build verification only.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (Research Report) | Phase 2b CLI spec | 9 steps; all complete |
| diagnosis/diagnosis-statement.md | Conflict analysis | tickets/index.ts clean; library module unaffected |
| diagnosis/apl.json | Diagnosis Q&A | Zero markers; both intents preserved |
| scout/scout-summary.md | CLI feature status | All 9 steps complete |
| scout/reference-map.json | File inventory | All 6 library files + resolve utility present |
| repo-guidance.json | Repo intent | CLI = target (conflict resolution context) |
| merge-conflicts.json | Conflict declaration | 1 file: tickets/index.ts (4 ticket + 1 staging commits) |
| tickets/index.ts (150 lines) | Direct source inspection | All 10 subcommand imports and handlers present |

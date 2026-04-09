# Product Specification — Side Quests (helix-cli)

## Problem Statement

The Helix CLI currently has no ticket lifecycle commands (only login, inspect, comments). The core side quest mechanism is orchestrator-driven — agents include side quest requests in their step output, and the server creates child tickets. The CLI is **not on the critical path** for side quests.

## Product Vision

The CLI remains unchanged for the side quests MVP. The core mechanism does not require CLI involvement. A future `hlx tickets create` command could enable advanced programmatic use cases from within the sandbox, but this is deferred pending evidence that server-side creation alone is insufficient.

## Users

| User | Relationship to Feature |
|------|------------------------|
| **Workflow agents in sandbox** | Could theoretically use CLI to create tickets, but the server-side step output mechanism handles this instead |

## Use Cases

No MVP use cases. Future: an agent wants to create a side quest outside the normal step output flow (e.g., mid-script ad-hoc ticket creation).

## Essential Features (MVP)

None. The CLI requires no changes for the side quests MVP.

## Features Explicitly Out of Scope (MVP)

1. **`hlx tickets create`** — Programmatic ticket creation from sandbox (deferred).
2. **`hlx tickets status`** — Side quest status checking from sandbox (deferred).

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | Core side quest mechanism works without CLI changes | End-to-end side quest flow operates via server-side orchestrator only |

## Scope & Constraints

- CLI has no test or lint quality gates (build only: `tsc`).
- `HELIX_INSPECT_TOKEN` is scoped for read-only inspection; ticket creation would require elevated auth — another reason to defer.

## Open Questions / Risks

| # | Question / Risk | Category |
|---|----------------|----------|
| 1 | Will server-side creation via step output be sufficient for all use cases, or will agents eventually need ad-hoc CLI-based ticket creation? | Product decision (post-MVP) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/scout-summary.md (CLI) | Evaluate CLI role | Two paths: CLI-based vs server-side; server-side recommended |
| diagnosis/diagnosis-statement.md (CLI) | Confirm CLI is not critical path | Core mechanism works without CLI changes |
| diagnosis/apl.json (CLI) | Scope decision | CLI is optional enhancement; deferred |
| repo-guidance.json | Repo intent | CLI is undecided/optional per diagnosis |

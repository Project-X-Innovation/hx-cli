# Product Specification — Goals: The PM Agent x Ralph Loop

## Problem Statement

Helix is a ticket-in, result-out system. Each ticket executes independently with no mechanism to coordinate multiple tickets toward a larger business objective, iterate toward polish, or bridge the gap between a high-level business intent ("automate our RMA process") and the individual tickets that make it happen. Once a ticket completes its MVP-scoped output, Helix moves on. There is no way to say "keep going until this objective is fully met."

Users who need polished, complete outcomes — not just MVPs — must manually create follow-up tickets, track progress across them, and decide when the objective is satisfied. This gap means Helix can execute tasks but cannot manage projects.

## Product Vision

Introduce the **Goal** abstraction and the **Ralph Loop** evaluation mechanism to transform Helix from a ticket executor into a project-manager agent. A Goal takes a high-level business objective and drives it to completion through iterative, evidence-based evaluation: after each child ticket completes, a goal-met checker evaluates whether the objective is met and proposes the single most valuable next action. The operator approves (or modifies or rejects) each proposal. This one-ticket-at-a-time, check-act-repeat loop replaces speculative upfront decomposition with real-time evaluation of concrete results.

## Users

| User | Relationship to Goals |
|------|-----------------------|
| **Helix operators** (primary) | Create Goals with business objectives and success criteria. Review checker proposals after each child ticket. Approve, modify, or reject proposed next tickets. Override the checker to mark Goals complete or failed at any time. |
| **Helix workflow agents** (system) | Execute child tickets spawned from Goals through standard pipelines (BUILD, FIX, RESEARCH). Provide concrete artifacts, code changes, and outcomes that the checker evaluates. |
| **Goal-met checker agent** (system) | Evaluates whether a Goal's objective is met after each child completes. Proposes the next ticket with rationale. The intelligence layer of the Ralph Loop. |

## Use Cases

1. **Multi-ticket project execution**: An operator creates a Goal "Automate RMA approval process." The checker proposes a first BUILD ticket for the core approval flow. After it completes, the checker evaluates: error handling is missing. It proposes a FIX ticket. After that, it proposes a polish ticket for UX improvements. After 4 children, the checker determines the objective is fully met. The Goal completes.

2. **Iterative refinement**: An operator creates a Goal "Add reporting dashboard." The first child builds the basic dashboard. The checker sees missing chart types, proposes a breadth ticket. Then it sees performance issues, proposes a depth ticket. The operator decides after 3 children that it's good enough and manually marks the Goal complete.

3. **Course correction**: A Goal's first child reveals the chosen approach won't work. The checker proposes a different approach in the next ticket instead of continuing down a dead-end path. No replanning needed — the system adapts naturally.

## Core Workflow

```
Operator creates GOAL ticket (title + description with success criteria)
    |
    v
Initial setup pipeline runs (scout -> diagnosis -> product)
    |
    v
Goal-met checker proposes first child ticket
    |
    v
Operator approves / modifies / rejects proposal
    |
    v
Child ticket executes through standard pipeline
    |
    v
Child completes -> Goal enters EVALUATING state
    |
    v
Checker evaluates: objective met?
    |
    +-- YES -> Goal completes (REPORT_READY)
    |
    +-- NO -> Checker proposes next ticket (with rationale + evaluation facet)
              -> Operator reviews -> loop back to child execution
```

The cycle repeats (SIDE_QUEST_PENDING -> EVALUATING -> proposal -> approval -> SIDE_QUEST_PENDING) until the objective is met, the operator terminates the Goal, or the max children bound is reached.

## Essential Features (MVP)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **GOAL TicketMode** | New ticket mode that inherits all existing ticket lifecycle infrastructure (statuses, assignment, discussion, artifacts, sprint association, notifications). Goals are tickets that behave differently — proven by RESEARCH mode precedent. |
| 2 | **EVALUATING status** | New TicketStatus representing the state where a child has completed and the goal-met checker is evaluating whether the objective is met. |
| 3 | **SIDE_QUEST_PENDING status** | Status representing "waiting for a child ticket to complete." Shared infrastructure with the future SideQuests feature (RSH-193). |
| 4 | **Parent-child ticket hierarchy** | `parentTicketId` self-relation on Ticket with `childTickets` reverse relation. Shared primitive with SideQuests. Enables Goal -> child ticket tree. |
| 5 | **Goal-specific pipeline** | GOAL tickets run only scout/diagnosis/product steps (3 of 9). No tech-research, implementation, code-review, verification, or preview-config. |
| 6 | **Per-ticket evaluation trigger** | When a child ticket with a GOAL parent completes, the Goal automatically transitions to EVALUATING and the checker runs. Fires after each child, not after all children batch-complete. |
| 7 | **Goal-met checker agent** | LLM-powered agent that evaluates Goal completion using a 7-question protocol: (1) Is it matching? (2) Is there more to do? (3) Does it need polish? (4) Are all boxes checked? (5) Can something be added? (6) Can something be fixed? (7) Can something be verified? Outputs either "Goal complete" or "Proposed next ticket." |
| 8 | **Human approval gate** | Every checker proposal requires operator approval before any child ticket spawns. Operator can approve, modify, or reject. The system proposes; the human decides. |
| 9 | **Safety bounds** | Max 20 total children per Goal. Max nesting depth of 1 (Goal -> children only). Human approval on every proposal prevents runaway. |
| 10 | **Advisory decomposition** | Optional, non-binding roadmap produced at setup or provided by the operator. Informs the checker but does not drive orchestration. |
| 11 | **Goal creation UI** | GOAL available in mode selector for all platform types. |
| 12 | **Goal detail UI** | Goal-specific layout showing child progress, checker proposal review (approve/modify/reject), and evaluation status. |
| 13 | **Status infrastructure** | EVALUATING status badge with distinct OKLCH color, display labels, filter group entries across all status-aware components. |
| 14 | **CLI GOAL mode** | GOAL added to CLI create command valid modes. |

## Features Explicitly Out of Scope (MVP)

| # | Feature | Why Deferred |
|---|---------|-------------|
| 1 | **Nested Goals** (Goal -> sub-Goal -> tickets) | Adds complexity to evaluation semantics and depth limits. MVP is one level: Goal -> child tickets. |
| 2 | **Multi-ticket proposals** | Checker proposes one ticket at a time in MVP. Parallel proposals are a V2 feature once confidence in the checker is established. |
| 3 | **Auto-approve mode** | All proposals require human approval in MVP. Autonomous operation is V2. |
| 4 | **Reduced human checkpoints** | Every proposal reviewed in MVP. Configurable checkpoint intervals are V2. |
| 5 | **Playbook-enhanced checking** | Core Goals are Playbook-independent. Playbook-aware evaluation requires RSH-411 Phase 1. |
| 6 | **Goal templates** | Pre-defined patterns for common objectives. Valuable for repeatability but not needed for core. |
| 7 | **Goal analytics** | Completion rates, average child counts, time-to-completion. Requires usage data. |
| 8 | **Retroactive Goal assignment** | Attaching existing tickets to a Goal after the fact. UX implications need exploration. |
| 9 | **Goal-specific CLI commands** | `hlx goals` subcommands for progress, proposal review. Only create mode addition is MVP. |
| 10 | **Goal progress dashboard** | Aggregate view of all active Goals. Per-Goal detail view is MVP. |

## Success Criteria

1. A user can create a GOAL ticket via UI, CLI, or API with a title, description, and success criteria.
2. The GOAL ticket's initial pipeline runs scout -> diagnosis -> product (only 3 steps, not the full 9).
3. After initial setup, the goal-met checker proposes the first child ticket with title, description, mode, and rationale.
4. The operator can approve, modify, or reject the checker's proposal through the UI.
5. Approved proposals spawn a child ticket with `parentTicketId` pointing to the Goal.
6. When a child ticket completes, the Goal automatically transitions to EVALUATING.
7. The checker evaluates using the 7-question protocol and either declares the Goal complete or proposes the next ticket.
8. The operator can override the checker at any point — marking the Goal complete or failed regardless of the checker's assessment.
9. The system enforces a maximum of 20 total children per Goal and refuses to spawn beyond the limit.
10. Existing ticket modes and workflows are unaffected — no regressions.

## Key Design Principles

1. **Checking over planning**: The goal-met checker evaluating concrete results after each ticket is the primary mechanism. Upfront decomposition is advisory, not the driver. "You don't need to predict all the work ahead of time — you just need to answer 'is there more to do?' after each step."

2. **One ticket at a time**: Each decision is maximally informed because the checker sees all completed work before proposing the next ticket. No wasted effort from speculative parallelization.

3. **Human authority, agent intelligence**: The checker proposes; the operator decides. The system cannot spawn tickets without human consent. This makes agent-driven evaluation safe from day one.

4. **Goals are tickets**: GOAL as a TicketMode (not a separate entity) inherits all existing lifecycle infrastructure. The conceptual separation comes from behavior (different pipeline, evaluation loop), not from entity type. This is the same pattern as RESEARCH mode.

5. **Shared primitives**: `parentTicketId` and related fields serve both Goals and future SideQuests (RSH-193). Build once, use twice.

## Scope & Constraints

- **Three repos impacted**: helix-global-server (primary: schema, services, orchestrator, API), helix-global-client (secondary: types, UI components, status infrastructure), helix-cli (tertiary: one array addition).
- **No new database tables**: Goals use the existing Ticket table with a new mode value. One migration adds the GOAL enum, EVALUATING/SIDE_QUEST_PENDING statuses, and parent-child columns.
- **Playbook-independent**: Core Goals do not require RSH-411 Playbook infrastructure. Can proceed immediately.
- **SideQuest-compatible**: Parent-child infrastructure is shared with RSH-193. Implementing it here enables future SideQuests without rework.
- **Max 20 children per Goal**: Consistent with RSH-193's SIDE_QUEST_MAX_TREE_TOTAL. Prevents unbounded spawning.
- **Nesting depth 1 for MVP**: Goal -> children only. No Goal -> sub-Goal -> children chains.

## Future Considerations

- **V2 Ralph Loop**: Reduced human gates (auto-approve, multi-ticket proposals, configurable checkpoint intervals) once the checker proves reliable.
- **Playbook-enhanced Goals (Tier 2)**: Checker receives Playbook rules as additional evaluation context after RSH-411 Phase 1.
- **Nested Goals**: Goals spawning sub-Goals for large initiatives.
- **Goal graph visualization**: Interactive DAG showing Goal -> children with status and evaluation facets.
- **Checker evaluation history**: Track what the checker assessed at each cycle for debugging and improvement.
- **Goal completion reports**: Structured summary of what a Goal accomplished across all children.

## Open Questions / Risks

| # | Question / Risk | Category | Current Status |
|---|----------------|----------|----------------|
| 1 | How will the goal-met checker agent be invoked — sandbox run, inline LLM call, or separate worker? | Technical | Unresolved. Execution mechanism not specified in research report or existing code. |
| 2 | Where is the checker proposal stored before operator approval? | Technical | Unresolved. Data model for pending proposals not specified. Could be a JSON field on the Goal ticket, a separate model, or an artifact. |
| 3 | How does the checker avoid being overly conservative (always finding more to do) or overly permissive (declaring done prematurely)? | Agent Design | Active design question. Checker should bias toward completion for subjective facets and only propose polish when specific improvements can be articulated. |
| 4 | How does per-ticket evaluation interact with `afterTicketId` sequential dependencies on Goal children? | Architecture | MVP assumes Goal children are independent. Integration with `/after` chains deferred. |
| 5 | What happens if the operator never responds to a checker proposal? | Product | No timeout defined. Goal stays in EVALUATING until operator acts. May need a notification/reminder mechanism. |
| 6 | How does failure propagation work when a child fails? | Product | Research report specifies softer propagation: child failure -> evaluation with failure context (retry, different approach, or fail Goal). Operator ultimately decides. |
| 7 | SIDE_QUEST_PENDING status does not yet exist in production | Technical | Confirmed via runtime database inspection. Must be added alongside EVALUATING in the same migration. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (RSH-488 Research Report) | Primary specification for the entire feature | Defines GOAL as TicketMode, Ralph Loop with per-ticket evaluation, 7-question checker protocol, advisory decomposition, cross-repo impact map, phasing, and safety bounds |
| scout/scout-summary.md (server) | Identified server extension points and current state | createTicketForOrganization (line 644), resolveDependentTickets (line 1718), RESEARCH mode filtering (lines 1600-1616) are direct templates; 57 existing migrations |
| diagnosis/diagnosis-statement.md (server) | Confirmed 4 root cause gaps with runtime evidence | No GOAL mode, no parent-child hierarchy, no evaluation mechanism, no checker agent. Production DB confirms clean baseline (0 EXECUTE tickets, no parentTicketId column) |
| scout/scout-summary.md (client) | Identified client extension points | Types at api.ts, mode selection via platform configs, status infrastructure across 5 coordinated files, RESEARCH lifecycle derivation as template |
| diagnosis/diagnosis-statement.md (client) | Confirmed client gaps | No GOAL in TicketMode (5 values), no EVALUATING in TicketStatus (15 values), no parent-child types, no GOAL in platform configs |
| scout/scout-summary.md (CLI) | Confirmed minimal CLI scope | VALID_MODES array + usage text — 2-line change |
| diagnosis/diagnosis-statement.md (CLI) | Confirmed CLI gap | VALID_MODES has 5 values, no GOAL. Validation pattern handles additions automatically. |
| scout/reference-map.json (server) | Exact file paths and line numbers for all server changes | 11 files identified with specific lines of interest |
| repo-guidance.json | Repo intent classification | server=target (primary), client=target (secondary), CLI=target (tertiary), library=context |
| Runtime inspection manifest | Available inspection types | DATABASE and LOGS for helix-global-server; diagnosis used DB inspection to confirm clean baseline |

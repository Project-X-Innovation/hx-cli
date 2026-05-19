# Product: GOAL TicketMode & Ralph Loop

## Problem Statement

Helix is a ticket-in, result-out system. Each ticket is an independent MVP unit -- scoped, executed, and completed in isolation. There is no mechanism to:

- **Coordinate multiple tickets toward a larger business objective.** A user who wants to "automate the RMA process" must manually create, sequence, and evaluate individual tickets. There is no system-level awareness of the broader goal.
- **Iterate toward polished completion.** Tickets are MVPs by definition. Real business objectives need refinement, polish, and verification beyond a single ticket's scope. Today the user must mentally track what's done, what's missing, and what needs improvement.
- **Bridge declarative intent and imperative execution.** The gap between "automate our RMA process" (what the user wants) and the individual BUILD/FIX tickets (what Helix executes) is entirely manual.

The result: users who want polished, multi-step outcomes must act as their own project manager -- decomposing, sequencing, evaluating, and iterating across tickets manually.

## Product Vision

Transform Helix from a ticket executor into a project-manager agent by introducing **Goals** -- a new ticket mode that takes a high-level business objective and uses iterative, evidence-based evaluation to drive it to completion through a sequence of child tickets. After each child ticket completes, an AI-powered checker evaluates whether the objective is met and proposes the single most valuable next action. The human operator approves, modifies, or rejects each proposal. This one-ticket-at-a-time, human-in-the-loop loop is the central mechanism.

## Users

| User | Role | Need |
|------|------|------|
| **Helix operator** | Primary user creating and managing Goals | Express a business objective declaratively and have Helix iteratively drive it to polished completion, with control over each step |
| **Helix workflow agents** | System actors executing child tickets | Receive well-scoped child tickets with parent Goal context to produce higher-quality results |

## Use Cases

1. **Multi-ticket business objective**: Operator creates a Goal ("Automate RMA approval process"). Helix runs initial setup, then proposes the first child ticket. After it completes, the checker evaluates progress and proposes the next step. The operator approves each proposal until the objective is fully met.

2. **Iterative polish**: A Goal's first child produces an MVP feature. The checker identifies missing error handling, proposes a polish ticket. After that completes, the checker identifies missing tests, proposes a verification ticket. Each cycle refines the result until the operator is satisfied.

3. **Course correction**: A Goal's first child builds an approach that turns out to be wrong. The checker evaluates the result, identifies the misalignment, and proposes a different approach. The operator reviews and approves the corrective ticket. No upfront plan needs replanning.

4. **Operator override**: The checker proposes more work, but the operator judges the objective is sufficiently met. The operator marks the Goal complete, overriding the checker.

## Core Workflow

```
Operator creates GOAL ticket (title + description with success criteria)
    |
    v
Initial setup: scout -> diagnosis -> product (3-step pipeline)
    |
    v
Goal-met checker proposes first child ticket
    |
    v
Operator approves / modifies / rejects proposal
    |
    v
Child ticket executes (standard BUILD/FIX/RESEARCH pipeline)
    |
    v
Child completes --> Checker evaluates (7-question protocol):
  1. Is it matching the objective?
  2. Is there anything more to do?
  3. Does it need polish?
  4. Are all success criteria checked?
  5. Can something be added?
  6. Can something be fixed?
  7. Can something be verified?
    |
    +-- Objective MET --> Goal complete (REPORT_READY)
    |
    +-- Objective NOT MET --> Propose next ticket --> Operator approves --> loop
```

Key principle: one ticket at a time, each decision maximally informed by concrete results so far.

## Essential Features (MVP)

| # | Feature | User Value |
|---|---------|------------|
| 1 | **GOAL ticket mode** | Operators can create Goals using existing ticket creation flows (web UI, CLI, MCP) |
| 2 | **3-step initial setup** (scout/diagnosis/product) | Goal objective is analyzed and success criteria defined before any child work begins |
| 3 | **Goal-met checker** (LLM agent, 7-question evaluation) | After each child completes, the system evaluates progress and proposes the most valuable next action |
| 4 | **Per-ticket evaluation trigger** | Evaluation fires after each child ticket, not after all children batch-complete -- enables real-time course correction |
| 5 | **Human approval gate** | Every checker proposal is reviewed by the operator before spawning -- no autonomous ticket creation |
| 6 | **Parent-child ticket relationship** (`parentTicketId`) | Goals and their child tickets are linked, enabling progress tracking and context passing |
| 7 | **EVALUATING status** | Distinct status visible in UI indicating the checker is evaluating Goal progress |
| 8 | **Safety bounds** (max 20 children, per-ticket approval) | Prevents runaway loops and resource exhaustion |
| 9 | **Checker proposal review UI** | Operator can see the proposed ticket, its rationale, and which evaluation facet it addresses, then approve/modify/reject |
| 10 | **Goal progress tracking** | Operator sees child ticket count, completion status, and current evaluation state |
| 11 | **Advisory roadmap** (optional, non-binding) | Operator or setup can provide a rough plan as context for the checker, without binding the orchestration |

## Features Explicitly Out of Scope (MVP)

| # | Feature | Why Deferred |
|---|---------|-------------|
| 1 | Nested Goals (Goal -> sub-Goal -> tickets) | Adds complexity; MVP is one level of nesting (Goal -> children) |
| 2 | Multi-ticket proposals | MVP spawns one ticket at a time; multi-ticket batches are V2 once checker trust is established |
| 3 | Auto-approve mode | MVP requires human approval on every proposal; autonomy is a V2 relaxation |
| 4 | Reduced checkpoints | MVP requires per-ticket approval; configurable intervals are V2 |
| 5 | Playbook-enhanced checking (Tier 2) | Core Goals are Playbook-independent; Playbook integration requires RSH-411 Phase 1 |
| 6 | Goal templates | Pre-defined patterns for common objectives are valuable but not needed for core functionality |
| 7 | Goal analytics/dashboard | Aggregate views and metrics require usage data that doesn't exist yet |
| 8 | Retroactive Goal assignment | Attaching existing tickets to a Goal post-hoc has UX implications deferred for now |
| 9 | Goal-specific CLI commands | `hlx goals ...` commands deferred; `hlx tickets create --mode GOAL` suffices for MVP |
| 10 | Checker evaluation history | Tracking historical evaluations for debugging is useful but not MVP-critical |

## Success Criteria

| # | Criterion | How Measured |
|---|-----------|-------------|
| 1 | Operator can create a GOAL ticket via web UI, CLI, and MCP | Functional: GOAL appears in mode selection; ticket creates successfully |
| 2 | Goal runs 3-step initial setup (scout/diagnosis/product) then enters evaluation loop | Functional: Goal skips tech-research through preview-config; enters EVALUATING after first child completes |
| 3 | Goal-met checker evaluates after each child ticket completes and produces either "Goal complete" or a single next-ticket proposal | Functional: EVALUATING status triggers checker; output is structured proposal or completion signal |
| 4 | Operator can approve, modify, or reject each checker proposal | Functional: proposal review UI shows title, description, mode, rationale, evaluation facet; three actions available |
| 5 | Approved proposals spawn a child ticket linked to the Goal | Functional: child ticket created with `parentTicketId` pointing to Goal; visible in Goal's child list |
| 6 | Goal transitions to REPORT_READY when checker determines objective is met | Functional: operator sees Goal marked complete with rationale summary |
| 7 | Safety bounds prevent more than 20 child tickets per Goal | Functional: 21st child proposal is blocked; operator sees limit notification |
| 8 | Operator can manually terminate a Goal at any point (complete or fail) | Functional: override actions available regardless of checker state |
| 9 | Goal progress (child count, statuses, evaluation state) visible in ticket detail | Functional: GoalProgressSection and GoalChildList render correctly |
| 10 | All existing ticket functionality unaffected | Regression: BUILD, FIX, RESEARCH, EXECUTE modes work identically |

## Key Design Principles

1. **Checking-first, not decomposition-first.** The goal-met checker evaluating concrete results is the primary mechanism. Decomposition is an optional advisory roadmap, not the orchestration driver.

2. **One ticket at a time.** Each decision is maximally informed by all completed work. No speculative parallelization in MVP.

3. **Human authority, AI intelligence.** The checker proposes; the operator decides. The checker doesn't need to be perfect -- it needs to be helpful. The human approval gate makes this safe from day one.

4. **Goals are tickets with different behavior.** GOAL is a TicketMode (like RESEARCH), not a separate entity. This reuses all existing infrastructure (statuses, assignment, discussion, artifacts, sprints, notifications, approvals) with mode-specific lifecycle behavior.

5. **Shared primitives with SideQuests.** The `parentTicketId` parent-child relationship is infrastructure shared with RSH-193 SideQuests. Different lifecycle semantics, same data model.

## Scope & Constraints

- **Cross-repo scope**: Server (primary -- schema, services, orchestrator, API), Client (secondary -- types, UI components, mode selection), CLI (tertiary -- mode validation only).
- **Schema constraint**: Single Prisma migration adds GOAL to TicketMode, EVALUATING to TicketStatus, and parentTicketId/childTickets/spawnedAtStep/sideQuestType to Ticket. This migration is shared infrastructure that also enables RSH-193 SideQuests.
- **Playbook independence**: Core Goals (Tier 1) work without the Playbook. Playbook-enhanced checking (Tier 2) depends on RSH-411 Phase 1 and is explicitly out of MVP scope.
- **Existing behavior preservation**: All existing ticket modes (AUTO, BUILD, FIX, RESEARCH, EXECUTE), statuses, and workflows must remain unaffected.
- **Sprint.goal field**: The existing `Sprint.goal` text field is a sprint theme description -- a separate concept from GOAL tickets. No collision or change needed.

## Future Considerations

- **Playbook-enhanced checking (Tier 2)**: Checker receives Playbook rules as additional evaluation context once RSH-411 Phase 1 is complete.
- **Reduced human gates (V2)**: Auto-approve mode, multi-ticket proposals, configurable checkpoint intervals once checker trust is established.
- **Nested Goals**: Goals spawning sub-Goals for large initiatives.
- **Goal progress dashboard**: Aggregate view of all active Goals with progress indicators.
- **Goal-to-Goal dependency**: Sequencing Goals using `afterTicketId` (already supported since Goals are tickets).
- **Goal graph visualization**: Interactive DAG showing Goal -> children with status and evaluation facets.
- **Learning from completed Goals**: Using completed Goal histories to improve checker evaluation quality.

## Open Questions / Risks

| # | Question / Risk | Category | Mitigation |
|---|----------------|----------|------------|
| 1 | Checker prompt calibration: how to avoid being overly conservative (always finding more to do) or overly permissive (declaring done prematurely)? | Agent design | Bias toward completion for subjective facets; require concrete improvements for polish proposals. Iterate on prompt based on early usage. |
| 2 | Subjective polish judgments ("can I polish it?") are inherently open-ended. When does the checker stop? | Agent design | Checker should propose polish only when specific, concrete improvements can be articulated. Diminishing returns bias. |
| 3 | How does per-ticket evaluation interact with `afterTicketId` chains if a Goal child depends on an external ticket? | Architecture | MVP assumes Goal children are independent of external tickets. Cross-dependency explored in future work. |
| 4 | Migration coordination: if RSH-193 SideQuests implementation is in progress, the shared `parentTicketId` migration may conflict. | Coordination | Coordinate migration timing; the shared primitives should be implemented once for both features. |
| 5 | Cross-repo Goals: how does a Goal coordinate child tickets that span different repos? | Architecture | Existing multi-repo ticket assignment handles this. Checker observes cross-repo changes naturally. No additional infrastructure for MVP. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (RSH-488 Research Report, 1029 lines) | Primary specification for GOAL implementation | 12-section report: GOAL as TicketMode (Option C hybrid), Ralph Loop per-ticket evaluation, 7-question protocol, EVALUATING status, parentTicketId shared with SideQuests, 3-step pipeline, max 20 children, 2-tier Playbook integration, cross-repo impact map |
| scout/scout-summary.md (helix-global-server) | Server codebase patterns and file locations | RESEARCH mode step filtering pattern, resolveDependentTickets completion hook pattern, Prisma file-based migration strategy, 9-step pipeline confirmed |
| scout/scout-summary.md (helix-global-client) | Client codebase patterns and file locations | RESEARCH lifecycle rendering pattern, OKLCH status color tokens, mode icon/label patterns, TicketMode/TicketStatus const locations |
| scout/scout-summary.md (helix-cli) | CLI codebase patterns and scope | VALID_MODES array pattern, minimal 2-file change scope, no Goal-specific CLI commands needed |
| scout/scout-summary.md (library) | Context repository with predecessor research | RSH-411 report recommended Goals as TicketMode; library has no code changes |
| diagnosis/diagnosis-statement.md (helix-global-server) | Root cause and success criteria for server | 4 gaps identified (schema, service, orchestrator, platform config); all have established extension patterns |
| diagnosis/diagnosis-statement.md (helix-global-client) | Root cause and success criteria for client | 4 gaps identified (types, mode selection, ticket detail, design system); RESEARCH mode provides exact pattern |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause and success criteria for CLI | Minimal gap: VALID_MODES array and help text; no mode-specific logic beyond validation |
| repo-guidance.json | Repo intent classification | library=context, server=primary target, client=secondary target, CLI=tertiary target |

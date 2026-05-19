# Ticket Context

- ticket_id: cmpc1ai1m005kml0uvesbmcd1
- short_id: RSH-498
- run_id: cmpc1y306006iml0u4raihf0p
- run_branch: helix/research/RSH-498-implement-goals-the-pm-agent-x-ralph-loop
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Implement: Goals: The pm agent x Ralph Loop

## Description
#RSH-369 



How do goals come in as taking this AI Research as a functor and looking at the natural transformations? Where exactly do goals come in? Can we extend the categorical understanding?

## Referenced Tickets

1 ticket(s) referenced. Full artifacts materialized at `.helix-refs/`:

### RSH-369: AI Research As A Functor On the Category Of Business Processes
- Mode: RESEARCH | Status: REPORT_READY
- Completed runs: 4 (run-1, run-2, run-3, run-4)
- Materialized files: 86 artifacts
- Path: `.helix-refs/RSH-369/`
- Manifest: `.helix-refs/RSH-369/_manifest.json`

Read the manifest file for a complete file listing, or browse the directory directly.

## Research Report

# Goals: The PM Agent x Ralph Loop

**Research Report -- RSH-488**
**Date**: May 18, 2026
**Status**: Revised
**Revision**: Checking-first architecture (continuation context applied)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Predecessor Synthesis](#2-predecessor-synthesis)
3. [Design Tension Resolution](#3-design-tension-resolution)
4. [Goals Architecture](#4-goals-architecture)
5. [The Ralph Loop](#5-the-ralph-loop)
6. [Parent-Child Relationship](#6-parent-child-relationship)
7. [Advisory Decomposition](#7-advisory-decomposition)
8. [Cross-Repo Impact Map](#8-cross-repo-impact-map)
9. [Safety Mechanisms & Guardrails](#9-safety-mechanisms--guardrails)
10. [Playbook Integration Path](#10-playbook-integration-path)
11. [Phasing Recommendation](#11-phasing-recommendation)
12. [Open Questions & Future Work](#12-open-questions--future-work)

---

## 1. Executive Summary

Helix today is a ticket-in, result-out system. Each ticket is an independent MVP unit -- scoped, executed, and completed in isolation. There is no mechanism to coordinate multiple tickets toward a larger business objective, iterate toward polish, or bridge the gap between declarative business intent ("automate our RMA process") and imperative execution (the individual tickets that make it happen). This report defines the **Goal** abstraction and the **Ralph Loop** evaluation mechanism that together transform Helix from a ticket executor into a project-manager agent.

A Goal is the while-loop around tickets. It takes a high-level business objective and uses **iterative goal-met checking** to drive it to completion. After each child ticket completes, a goal-met checker agent evaluates whether the objective is met and proposes the single most valuable next action. The operator approves (or modifies or rejects) the proposal, and the next ticket spawns. This one-ticket-at-a-time, evidence-driven loop is the central mechanism. You don't need to predict all the work ahead of time -- you just need to answer "is there more to do?" after each step and propose the next one.

Decomposition -- breaking a goal into a plan of child tickets upfront -- remains useful as an **advisory roadmap**: thinking ahead about what might be needed. But it is not the definitive orchestration driver. The real-time evaluation of what concretely exists drives what actually happens. As a compass, decomposition helps orient; as a GPS with turn-by-turn directions, it is too brittle. The goal-met checker, evaluating concrete results after each ticket, is the primary mechanism.

This report synthesizes two predecessor research efforts: **RSH-411** (Business Rules & Playbook, 1,464 lines, 26 sections) which recommended Goals as a GOAL TicketMode in Phase 2 of the Playbook rollout, and **RSH-193** (Side Quests, 823 lines, 14 sections) which designed the `parentTicketId` parent-child hierarchy and child-ticket spawning primitives that Goals directly build upon.

The central design tension -- whether Goals should be a ticket type (RSH-411/Nate recommendation) or a separate entity that spawns tickets (ticket author preference) -- is resolved in favor of a **hybrid GOAL TicketMode**: Goals are tickets that inherit all existing lifecycle infrastructure (statuses, assignment, discussion, artifacts, sprint association, notifications, approvals) but with mode-specific behavior. GOAL tickets do not go through implementation and deployment steps -- they go through initial setup (scout/diagnosis/product) and then enter the evaluation-driven Ralph Loop. This is exactly how RESEARCH mode already works: different pipeline, same entity.

**Key decisions summarized:**

| # | Decision | Recommendation |
|---|----------|---------------|
| 1 | Goal abstraction model | **GOAL as TicketMode** (hybrid approach -- mode-specific behavior on shared infrastructure) |
| 2 | Parent-child relationship | **RSH-193's `parentTicketId` self-relation** (shared primitive for both SideQuests and Goals) |
| 3 | Primary orchestration mechanism | **Goal-met checking**: agent-driven evaluation after each child ticket completes; proposes next ticket one at a time |
| 4 | Ralph Loop V2 | **Reduced human gates**: multi-ticket proposals, autonomous operation for high-confidence goals |
| 5 | Playbook dependency | **Core Goals are Playbook-independent**; Playbook-enhanced Goals require RSH-411 Phase 1 |
| 6 | New statuses | **EVALUATING** (Goal-specific); reuse **SIDE_QUEST_PENDING** from RSH-193 |
| 7 | Safety bounds | Max **20 total children** (consistent with RSH-193), **human approval gate** on every proposed ticket |
| 8 | Decomposition role | **Advisory roadmap** (non-binding estimate that informs the checker, not the orchestration driver) |
| 9 | Spawning model | **One ticket at a time**, checker-proposed, operator-approved |
| 10 | SideQuest convergence | **Shared `parentTicketId` infrastructure**, different spawning lifecycle and evaluation semantics |
| 11 | Sprint.goal field | **Unchanged** (text description field, separate concept from GOAL tickets) |
| 12 | Report structure | **12-section synthesis** following RSH-411 format, synthesizing rather than duplicating predecessor findings |

---

## 2. Predecessor Synthesis

This report builds on two substantial research efforts. Rather than re-derive their findings, this section summarizes what each contributed and identifies what remains unaddressed.

### 2.1 RSH-411: Business Rules & Playbook

RSH-411 (1,464 lines, 26 sections) proposed the Playbook -- a persistent, org-owned layer of business rules (Constraints, Workflows, Monitors) that Helix understands, enforces, and monitors. Goals appeared in Section 7 ("Goals: Tickets, Not Rules") with a clear recommendation:

> "Goals do not belong in the Playbook. They should become a new ticket mode: GOAL." (RSH-411, Section 7, line 300)

**Key contributions relevant to Goals:**

- **Section 7 (lines 297-340)**: Four arguments for Goals as a ticket type: (1) the Playbook stays clean because Goals are transient while rules are perpetual, (2) Goals trace to outcomes through the tickets and rules they create, (3) tickets already have lifecycle machinery (statuses, assignment, discussion, artifacts), (4) the ticket model gains purpose as a traceable link from business intent to implementation.
- **Section 7 (lines 308-316)**: Goal lifecycle definition -- Helix infers required Playbook rules, compares against the existing Playbook, auto-spawns missing work as child tickets, and the Goal completes when its children resolve.
- **Section 11 (lines 541-608)**: Proposed PlaybookRule data model with PlaybookRuleTicket junction table using `linkType` (IMPLEMENTS, MONITORS, SPAWNED). This junction is the mechanism that connects Goals (as GOAL tickets) to the Playbook rules they create.
- **Section 13 (lines 782-800)**: Auto-ticket spawning guardrails -- deduplication (no duplicate tickets for the same rule), cooldown (configurable minimum spawn interval), severity threshold (only HIGH/MEDIUM monitors auto-spawn), rate limiting (max auto-spawned tickets per org per day), and human confirmation for Goals.
- **Section 25 (line 1393)**: Goals placed in Phase 2 alongside enhanced monitoring, auto-ticket spawning, and the conversational interface. This phasing assumes Goals require the Playbook to function.

**What RSH-411 did not define:**
- The Ralph Loop evaluation mechanism (how the system determines whether a Goal's objective is met beyond "all children complete")
- Detailed Goal lifecycle states and transitions
- How Goals decompose into child tickets independent of the Playbook
- Termination bounds for iterative re-evaluation
- The relationship between Goals and RSH-193's SideQuest architecture

### 2.2 RSH-193: Side Quests

RSH-193 (823 lines, 14 sections) designed a mechanism for workflow agents to autonomously spawn child tickets during pipeline execution. While conceptually different from Goals (SideQuests are agent-spawned mid-pipeline; Goals are user-created top-level objectives), the architectural primitives are directly shared.

**Key contributions relevant to Goals:**

- **Section 2 (lines 73-94)**: Five existing primitives reusable for child-ticket relationships: `afterTicketId` self-relation (template for `parentTicketId`), `WAITING` status with `resolveDependentTickets()` (pattern for completion resolution), `parentRunId` + `continuationContext` (child result passing), `stepsToRun` (partial pipeline runs), RESEARCH mode step filtering (mode-specific pipeline precedent).
- **Section 2 (lines 86-94)**: Six identified architectural gaps: no agent spawn signal, no mid-run pause/resume, no parent-child relationship, no side-quest-aware statuses, no programmatic ticket creation from sandbox, single-sandbox lifecycle.
- **Section 3 (lines 163-179)**: Schema design for `parentTicketId` self-relation on Ticket, `childTickets` reverse relation, `spawnedAtStep` tracking, `sideQuestType` classification, `SIDE_QUEST_PENDING` status, and `@@index([parentTicketId])`.
- **Section 5 (lines 334-343)**: `validateSideQuestLimits()` function enforcing three safety constraints: nesting depth (max 3), fan-out (max 5 children per spawn), tree total (max 20 descendants per root).
- **Section 8 (lines 539-545)**: Safety limit constants: `SIDE_QUEST_MAX_NESTING_DEPTH = 3`, `SIDE_QUEST_MAX_FAN_OUT = 5`, `SIDE_QUEST_MAX_TREE_TOTAL = 20`.
- **Section 9 (lines 574-630)**: Three execution topologies: parallel independent, sequential chain (via `afterTicketId` between siblings), and nested (depth-limited recursive spawning).
- **Appendix (lines 767-803)**: File impact map across all three repos (12 server files, 10 client files, 0 CLI files).

**What RSH-193 did not define:**
- User-initiated Goal creation (SideQuests are agent-spawned only)
- Iterative re-evaluation after children complete (SideQuests are one-shot: children complete, parent resumes)
- Success criteria evaluation (SideQuests use all-children-complete as the only criterion)
- Goal-met checking as a continuous evaluation mechanism

### 2.3 Unaddressed Territory

The intersection of RSH-411 and RSH-193 leaves four architectural questions that this report must resolve:

1. **The Ralph Loop**: How does the system iteratively evaluate whether a Goal's broader objective is met after each child ticket, using an agent-driven checker rather than waiting for all children to batch-complete?
2. **Goal Lifecycle**: What states does a Goal pass through from creation to completion, and how do those states map to the existing 15 TicketStatuses?
3. **Goal-Met Checker**: What does the evaluation agent receive as input, what questions does it ask, and what does it produce as output?
4. **Convergence**: How do Goals and SideQuests share infrastructure while maintaining distinct semantics?

---

## 3. Design Tension Resolution

The ticket description surfaces a central design tension:

> "Nate, in his report, felt that goals should be a kind of ticket. To me it is a kind of a glue between the business Bible or playbook and tickets. I don't know if I would make the goal a ticket in itself or just have the goal in a different section and let it spawn tickets." (ticket.md, line 46)

This section presents three options, evaluates them across multiple dimensions, and makes a recommendation.

### 3.1 Option A: GOAL as New TicketMode

Goals become a sixth value in the `TicketMode` enum (alongside AUTO, BUILD, FIX, RESEARCH, EXECUTE). They inherit all ticket lifecycle infrastructure. Goal-specific behavior is achieved through mode-specific step filtering, exactly as RESEARCH mode already works.

**Pros:**
- Minimal new infrastructure -- one enum value addition plus mode-specific step logic
- Reuses proven patterns: 15 statuses, assignment, discussion, artifacts, sprint association, notifications, approvals, MCP tools, CLI creation, full client UI
- Consistent with RSH-193's `parentTicketId` design, which assumes Ticket self-relation
- All existing API endpoints, React Query hooks, status badges, and filters work with minimal extension
- The `createTicketForOrganization()` function (ticket-service.ts, line 642) already handles mode-specific logic

**Cons:**
- Semantic concern: Goals feel conceptually "above" tickets -- a coordination layer, not an execution unit
- Some existing statuses (MERGING, DEPLOYING, STAGING_MERGED, SANDBOX_READY, VERIFYING) don't apply to Goals
- Could blur the line between coordination and execution in the UI

### 3.2 Option B: Separate Goal Entity

Goals become a new Prisma model (separate database table) with its own lifecycle, statuses, and relationships. Goals spawn tickets but are not tickets themselves.

**Pros:**
- Clean conceptual separation -- Goals and tickets are different things, and the data model reflects this
- Goal-specific fields and lifecycle without overloading the Ticket model
- No confusion about what a "ticket" is in the system

**Cons:**
- Massive new infrastructure required:
  - New Prisma model with its own migration
  - New service (`goal-service.ts`) duplicating much of ticket-service.ts
  - New controller (`goal-controller.ts`) and HTTP routes
  - New MCP tools for goal creation, listing, evaluation
  - New client TypeScript types, React Query hooks, API modules
  - New client routes (goal list, goal detail, goal creation)
  - New client components (goal progress, goal evaluation, goal child list)
  - New CLI commands (`hlx goals create`, `hlx goals list`, etc.)
- Duplicates most of what tickets already provide: status tracking, assignment, discussion threads, artifact storage, sprint association, notification infrastructure, approval flows
- Breaks RSH-193's `parentTicketId` design, which assumes Ticket self-relation -- a separate Goal entity would need a different relationship model (e.g., `goalId` on Ticket instead of `parentTicketId`)
- Doubles the maintenance surface for lifecycle management
- Estimated implementation effort: 3-5x larger than Option A

### 3.3 Option C: Hybrid -- GOAL TicketMode with Mode-Specific Extensions (Recommended)

Goals are `TicketMode.GOAL` (inheriting all ticket infrastructure) but with explicit mode-specific behavior: a different workflow step pipeline, Goal-specific status transitions, and parent-child relationship semantics distinct from `afterTicketId`. The conceptual separation the ticket author wants is achieved through *behavior*, not *entity type*.

**Pros:**
- All benefits of Option A (minimal infrastructure, full reuse)
- The conceptual separation is real: GOAL tickets don't go through implementation/code-review/verification/preview-config steps -- they go through initial setup and then enter the evaluation-driven Ralph Loop. A GOAL ticket *behaves* differently from a BUILD ticket, even though both are Ticket records.
- This is exactly how RESEARCH mode already works in `helix-workflow-step-catalog.ts`: RESEARCH tickets use the same 9-step pipeline but skip implementation-focused steps and produce a report instead. The pattern is proven.
- RSH-193's `parentTicketId` self-relation works directly -- Goals spawn child tickets using the same mechanism SideQuests use
- Mode-specific UI can make Goals *look* different (different detail layout, progress visualization, checker proposal review) while sharing the underlying data model

**Cons:**
- Same minor semantic concern as Option A, but mitigated by clear mode-specific behavior and UI differentiation

### 3.4 Tradeoff Matrix

| Dimension | Option A: TicketMode | Option B: Separate Entity | Option C: Hybrid (Recommended) |
|-----------|---------------------|--------------------------|-------------------------------|
| **Implementation effort** | Low (1 enum value + step filtering) | Very High (new model, service, controller, routes, MCP, client types, client routes, CLI) | Low (same as A + mode-specific UI/workflow) |
| **Infrastructure reuse** | Full (15 statuses, assignment, discussion, artifacts, sprints, notifications, approvals) | None (must rebuild all lifecycle machinery) | Full (same as A) |
| **Conceptual clarity** | Moderate (Goals are "just tickets" in the data model) | High (Goals are a distinct entity) | High (Goals are tickets that *behave* differently -- proven by RESEARCH mode precedent) |
| **RSH-193 compatibility** | Full (`parentTicketId` self-relation works directly) | Broken (needs `goalId` instead of `parentTicketId`) | Full (same as A) |
| **Cross-repo impact** | Minimal (enum addition + mode filter in each repo) | Massive (new entity in every layer of every repo) | Minimal (same as A + mode-specific components) |
| **Migration complexity** | Low (one enum value addition) | High (new table, new relations, data migration if Goals already exist) | Low (same as A) |
| **UI differentiation** | Limited without extra work | Natural (different routes, different components) | Natural (mode-specific detail layout, same as RESEARCH mode having its own report view) |
| **Maintenance burden** | Low (shared lifecycle code) | High (parallel lifecycle code for Goals and Tickets) | Low (shared lifecycle code with mode branches) |

### 3.5 Recommendation: Option C (Hybrid GOAL TicketMode)

The evidence overwhelmingly supports Goals as a TicketMode with mode-specific extensions:

1. **RSH-411 Section 7** (lines 297-340) provides four concrete arguments for ticket-type Goals, concluding: "Tickets already have lifecycle machinery. Status states, assignment, discussion, artifacts -- all built. Goals-as-tickets inherit all of it."

2. **RESEARCH mode precedent** (`helix-workflow-step-catalog.ts`) proves that mode-specific pipeline filtering works. RESEARCH tickets skip implementation steps and produce a report instead of code. GOAL tickets would skip implementation/deployment steps and enter the evaluation-driven Ralph Loop. The pattern is identical.

3. **RSH-193 design** specifies `parentTicketId` as a Ticket self-relation (Section 3, lines 163-179). The entire spawning hierarchy is designed to work with tickets. A separate Goal entity would break this design and require a different relationship model.

4. **Infrastructure reuse**: Tickets already have 15 statuses (schema.prisma, lines 22-38), assignment, discussion, artifacts, sprint association (line 354), notifications, approvals, MCP tools for creation, CLI creation command (create.ts, lines 12-87), and full client UI (create-ticket.tsx, ticket-detail.tsx). All of this would need to be rebuilt for a separate entity.

5. **The ticket author's concern addressed**: The author wants Goals to "spawn tickets" from "somewhere else" (ticket.md, line 46). A GOAL TicketMode achieves exactly this -- the Goal IS a ticket that spawns other tickets. The "somewhere else" is the Goal's own lifecycle, which is different from a BUILD ticket's lifecycle. The conceptual separation comes from what the Goal *does* (evaluate, propose, iterate), not from where it *lives* (a separate table). This is no different from how a RESEARCH ticket is conceptually distinct from a BUILD ticket even though both are rows in the same Ticket table.

---

## 4. Goals Architecture

### 4.1 TicketMode.GOAL Definition

GOAL is added as the sixth value in the `TicketMode` enum (schema.prisma, lines 110-116):

```
enum TicketMode {
  AUTO
  BUILD
  FIX
  RESEARCH
  EXECUTE
  GOAL        // New: top-level business objective driven by iterative goal-met checking
}
```

This single enum addition makes Goals available across the entire system: server API, client types (api.ts, line 256-264), CLI mode parameter (create.ts, line 12), and the mode selection UI (create-ticket.tsx, line 76-87).

### 4.2 Goal Lifecycle

A Goal's lifecycle is distinct from a BUILD/FIX ticket's lifecycle. Where a standard ticket moves through implementation and deployment, a Goal moves through initial setup and then enters a per-ticket evaluation loop:

```
DRAFT --> QUEUED --> RUNNING (initial setup: scout/diagnosis/product)
                        |
                        v
             Spawn first ticket (checker-proposed or from advisory roadmap)
                        |
                        v
             SIDE_QUEST_PENDING (one child executing)
                        |
                   child completes
                        |
                        v
                   EVALUATING (goal-met checker runs)
                        |
                   +----+----+
                   |         |
              objective   objective
              NOT met     MET
                   |         |
                   v         v
         Propose next   REPORT_READY
         ticket         (Goal complete)
                   |
                   v
         Operator approves / modifies / rejects
                   |
                   v
         Spawn next ticket --> SIDE_QUEST_PENDING
                                    |
                               (loop back to child completes)
```

**Key lifecycle transitions:**

1. **Creation**: Goal starts as DRAFT (user is composing) or QUEUED (ready to process).
2. **Initial Setup**: Goal transitions to RUNNING. The setup pipeline (scout -> diagnosis -> product) analyzes the Goal's objective, identifies success criteria, and optionally produces an advisory roadmap.
3. **First Ticket**: After setup completes, the goal-met checker proposes the first child ticket. The operator approves, and the child is created with `parentTicketId` pointing to the Goal. Goal transitions to SIDE_QUEST_PENDING.
4. **Child Execution**: The child executes through the standard pipeline (BUILD, FIX, RESEARCH, etc.) independently.
5. **Evaluation Trigger**: When the child completes, the Goal transitions to EVALUATING. This happens after **each** child ticket, not after all children batch-complete.
6. **Goal-Met Checking**: The checker agent evaluates: is the objective met? If yes, Goal transitions to REPORT_READY. If not, the checker proposes the next ticket.
7. **Operator Approval**: The operator reviews the proposed ticket and approves, modifies, or rejects it. On approval, the ticket spawns and the Goal returns to SIDE_QUEST_PENDING.

The critical difference from a batch model: the Goal cycles between SIDE_QUEST_PENDING and EVALUATING after **each** child ticket. There is no waiting for all children to finish. Each evaluation is based on the concrete state of what was actually built so far.

### 4.3 Goal-Specific Status Mapping

Not all 15 existing TicketStatuses apply to Goals. The following table maps each status:

| Status | Applies to Goals? | Meaning for Goals |
|--------|-------------------|-------------------|
| `QUEUED` | Yes | Goal waiting to be processed by the setup pipeline |
| `RUNNING` | Yes | Goal's initial setup pipeline is executing (scout/diagnosis/product) |
| `SIDE_QUEST_PENDING` | Yes (from RSH-193) | Goal waiting for a child ticket to complete |
| `DRAFT` | Yes | Goal created but not yet submitted for processing |
| `WAITING` | Yes | Goal waiting for `afterTicketId` predecessor (if Goal is sequenced after another ticket) |
| `FAILED` | Yes | Goal failed -- child failure beyond recovery, safety bound exceeded, or operator terminated |
| **`EVALUATING`** | **Yes (new)** | Child completed; goal-met checker agent is evaluating whether the objective is met |
| `REPORT_READY` | Yes | Goal complete -- objective met, results available |
| `IN_PROGRESS` | No | Implementation-specific; Goals don't have "in progress" implementation work |
| `MERGING` | No | Code merge state; Goals don't produce code directly |
| `SANDBOX_READY` | No | Sandbox preview state; not applicable to Goals |
| `VERIFYING` | No | Code verification state; not applicable to Goals |
| `DEPLOYING` | No | Deployment state; Goals don't deploy directly |
| `PREVIEW_READY` | No | Preview state; not applicable to Goals |
| `STAGING_MERGED` | No | Staging merge state; not applicable to Goals |
| `DEPLOYED` | No | Post-deployment state; not applicable to Goals |
| `UNVERIFIED` | No | Verification failure state; not applicable to Goals |

The `EVALUATING` status is the only new addition to the TicketStatus enum. It represents the state where a child ticket has completed and the Goal's checker agent is evaluating whether the broader objective is met.

### 4.4 Goal-Specific Workflow Pipeline

Goals use a minimal initial setup pipeline followed by an event-driven evaluation loop. This follows the RESEARCH mode precedent in `helix-workflow-step-catalog.ts` for pipeline filtering:

**Initial Setup Pipeline (runs once on Goal creation):**

| Pipeline Step | Standard Ticket | RESEARCH Ticket | GOAL Ticket |
|---------------|----------------|-----------------|-------------|
| scout | Yes | Yes | Yes -- scan for relevant context, existing work, related tickets |
| diagnosis | Yes | Yes | Yes -- analyze the Goal's scope, identify success criteria |
| product | Yes | Yes | Yes -- define what the Goal's outcome should look like |
| tech-research | Yes | Yes | No -- Goals don't need technology research |
| implementation-plan | Yes | No (RESEARCH) | No -- replaced by evaluation-driven loop |
| implementation | Yes | No (RESEARCH) | No -- Goals don't produce code directly |
| code-review | Yes | No (RESEARCH) | No -- Goals don't produce code |
| verification | Yes | Yes | No -- verification happens per-child, not on the Goal itself |
| preview-config | Yes | No (RESEARCH) | No -- Goals don't have preview configurations |

The Goal's initial pipeline is: **scout -> diagnosis -> product**. After this 3-step setup completes, the Goal spawns its first child ticket and enters the evaluation-driven loop.

**Evaluation-Driven Loop (event-triggered after each child completes):**

The evaluation loop is not a pipeline step -- it is event-driven. When a child ticket with a GOAL parent completes, the completion hook triggers the Goal's transition to EVALUATING, which runs the goal-met checker agent. This extends the existing `resolveDependentTickets()` pattern (ticket-service.ts, line 1716).

```
Child ticket completes
    --> Goal transitions to EVALUATING
    --> Goal-met checker agent evaluates
    --> Either "Goal complete" (REPORT_READY)
        or "Proposed next ticket" (operator reviews, spawns, SIDE_QUEST_PENDING)
```

### 4.5 Goal Fields

A GOAL ticket uses the existing Ticket model fields with Goal-specific semantics:

| Ticket Field | Goal Usage |
|-------------|-----------|
| `title` | The Goal's objective statement (e.g., "Automate RMA approval process") |
| `description` | Detailed objective description including success criteria |
| `mode` | `GOAL` |
| `status` | Goal-specific status transitions (see Section 4.3) |
| `afterTicketId` | Optional: sequence Goals or make a Goal depend on another ticket |
| `sprintId` | Optional: assign Goal to a sprint for tracking |

Additionally, Goal-specific metadata can be stored as structured JSON in the ticket's artifact system or as fields on the Ticket model:

| Metadata | Type | Purpose | Default |
|----------|------|---------|---------|
| `maxChildren` | Int | Maximum total child tickets | 20 |
| `advisoryRoadmap` | JSON (optional) | Non-binding decomposition estimate produced at setup or provided by operator | null |

Whether these are new database columns or stored as JSON metadata is an implementation decision. The MVP recommendation is JSON metadata (no schema change beyond the GOAL enum value and EVALUATING status), with promotion to dedicated columns later if query patterns demand it.

---

## 5. The Ralph Loop

### 5.1 Concept

The Ralph Loop is the check-act-repeat mechanism that distinguishes Goals from simple ticket decomposition. The ticket description defines it:

> "It's some kind of mechanism that lets you check to see if something is accomplished and then lets you do some set of actions if it is not." (ticket.md, lines 22-23)

> "The idea is that a goal is more than one ticket and it contains a mechanism for perfecting something. Tickets are MVPs by definition. They're meant to be MVP. Most of the time when I actually do something, it needs to be a polished finished project." (ticket.md, lines 34-35)

The Ralph Loop transforms Helix's ticket execution from a one-shot model (create ticket, execute, done) into an iterative refinement model where the goal-met checker evaluates after **each** child ticket completes and decides what to do next. The key question is not "did all children succeed?" but "is there more to do?" Each evaluation sees the full picture -- all completed work, current codebase state, the Goal's success criteria -- and makes a maximally informed decision about the single most valuable next action.

The user's key insight: *"you don't need to predict all the work ahead of time -- you just need to answer 'is there more to do?' after each step and propose the next one."*

### 5.2 The Goal-Met Checker

The goal-met checker is an LLM-powered agent that runs each time the Goal enters EVALUATING status (i.e., after each child ticket completes). It is the primary orchestration mechanism from MVP -- not deferred to a future phase. The human approval gate (Section 5.7) provides safety; the agent checker is the intelligence.

#### Checker Inputs

The checker receives structured context to make an informed evaluation:

| Input | Source | Purpose |
|-------|--------|---------|
| **Goal objective** | GOAL ticket `title` + `description` | What the Goal is trying to accomplish |
| **Success criteria** | Parsed from GOAL ticket `description` (natural language) | Specific conditions for "done" |
| **Completed child outcomes** | All child tickets' status, artifacts, discussion, code changes | Concrete evidence of what was built across all completed children |
| **Current codebase state** | Scout-like context gathering on relevant repos | What actually exists in the code now |
| **Advisory roadmap** (optional) | Decomposition estimate produced at Goal creation (Section 7) | Context for what areas might still need work |

The checker evaluates the cumulative result of ALL completed children against the Goal's objective -- not just the most recently completed child. Each evaluation has full visibility into everything built so far.

#### Evaluation Protocol

The checker asks a structured sequence of questions, derived from the user's enumerated evaluation facets. These questions are answered against the concrete evidence of what was actually built:

1. **Is it matching?** -- Does what was built align with the stated objective? Are we heading in the right direction?
2. **Is there anything more to do?** -- Are there success criteria not yet addressed? Is something obviously missing?
3. **Does it need polish?** -- Quality gaps: error handling, loading states, input validation, UX, performance, edge cases?
4. **Are all boxes checked?** -- Every explicit criterion from the Goal description accounted for?
5. **Can something be added?** -- Missing breadth: new capabilities or features the objective implies but no ticket has addressed?
6. **Can something be fixed?** -- Defects or issues in what was already built? Something that's not working correctly?
7. **Can something be verified?** -- Untested assumptions or behaviors? Something that should be validated before declaring the Goal complete?

These seven questions form the evaluation protocol. The checker works through them systematically, referencing the concrete artifacts and code changes from completed children.

#### Checker Outputs

The checker produces exactly one of two outputs:

1. **"Goal complete"** -- All evaluation questions answered satisfactorily. The objective is met. Includes a rationale summary explaining why. Goal transitions to REPORT_READY.

2. **"Proposed next ticket"** -- The objective is not yet fully met. The proposal includes:
   - **Title**: concise description of the work
   - **Description**: detailed scope with acceptance criteria
   - **Mode**: BUILD, FIX, RESEARCH, or AUTO
   - **Evaluation facet**: which of the 7 questions this ticket addresses (e.g., "Does it need polish?" -> "Add error handling for edge cases")
   - **Rationale**: why this is the single most valuable next action given the current state

#### Why One Ticket at a Time

The single-ticket-at-a-time model is deliberately chosen:

- **Each decision is maximally informed.** The checker sees ALL completed work before proposing the next ticket. No wasted effort from speculative parallelization.
- **Simpler approval flow.** The operator reviews one concrete proposal at a time, not a batch plan of abstract tickets.
- **Naturally adaptive.** If the first ticket reveals the approach is wrong, the next proposal adapts immediately. No replanning required.
- **LLM-aligned.** Current LLMs are strong at evaluating concrete state and making contextual next-step decisions. They are weaker at comprehensive upfront planning for novel, complex projects.
- **Relaxable later.** Once confidence in the checker is established, multi-ticket proposals can be introduced (see Section 5.8).

### 5.3 Per-Ticket Evaluation Trigger

Evaluation fires after **each** child ticket completes, not after all children batch-complete. This is the fundamental architectural choice.

**Technical mechanism:** The per-ticket evaluation trigger extends the existing `resolveDependentTickets()` pattern (ticket-service.ts, line 1716). When a child ticket with a `parentTicketId` completes, a new `resolveGoalParent()` function checks if the parent is a GOAL ticket. If so, the Goal transitions to EVALUATING, and the goal-met checker agent runs.

**Hook points:** The evaluation trigger fires at the same post-success hook points where `resolveDependentTickets()` is called (orchestrator.ts, lines 1504 and 2338). This means the Goal evaluation naturally piggybacks on existing completion infrastructure.

**Goal state cycling:**

```
SIDE_QUEST_PENDING (waiting for child)
        |
   child completes
        |
        v
   EVALUATING (goal-met checker runs)
        |
   +----+----+
   |         |
   v         v
Propose   REPORT_READY
next      (Goal complete)
ticket
   |
   v
Operator approves
   |
   v
SIDE_QUEST_PENDING (next child executing)
```

The Goal cycles between SIDE_QUEST_PENDING and EVALUATING after each child ticket. There is no "wait for all children" gate. Each evaluation operates on full evidence of what exists now.

**Why per-ticket, not batch?**

- **Real-time feedback.** The system sees results as they happen and can course-correct immediately.
- **Adaptive planning.** If the first ticket reveals an unexpected issue, the checker adapts the next proposal instead of continuing to execute a stale plan.
- **Simpler to reason about.** One child completes -> one evaluation -> one proposal. Clean, deterministic flow.
- **Consistent with the user's direction:** *"Adding another ticket one ticket at a time [...] seems like a more fruitful way to do things with the LLMs of today."*

### 5.4 Termination Bounds

The per-ticket evaluation model requires adapted safety bounds:

| Bound | Value | Purpose |
|-------|-------|---------|
| **Max total children** | 20 (configurable per Goal) | Consistent with RSH-193's `SIDE_QUEST_MAX_TREE_TOTAL` (Section 8, line 545); prevents unbounded ticket spawning regardless of how many evaluation cycles run |
| **Human approval gate** | Every proposed ticket | Operator must approve, modify, or reject each checker proposal before any ticket spawns. This is the primary runaway prevention mechanism. |
| **Max nesting depth** | 1 for MVP | Goal -> child tickets only. Nested Goals (Goal -> sub-Goal -> tickets) deferred to future. |

**Comparison: Original bounds vs. revised bounds:**

| Bound | Original Report (Batch Model) | Revised (Per-Ticket Model) | Rationale |
|-------|-------------------------------|---------------------------|-----------|
| Max iterations | 5 (batch evaluation cycles) | Removed -- each child IS an iteration | In per-ticket model, "iteration" = "child ticket". Max total children (20) is the effective iteration cap. |
| Max total children | 20 | 20 (unchanged) | Still appropriate. Consistent with RSH-193. |
| Human checkpoint | Every 3 iterations (V2 only) | Every proposed ticket (MVP and V2) | Human-in-the-loop per ticket is simpler and safer. |
| Evaluation cooldown | 1 hour minimum between evaluations | Removed | Per-ticket evaluation should happen promptly when a child completes. Cooldown was appropriate for batch re-evaluation, not for per-ticket flow. |
| Max children per iteration | 5 (per batch cycle) | 1 (single ticket at a time, MVP) | One-at-a-time is the defined model. Multi-ticket proposals are a V2 feature. |

When the max total children bound is reached, the Goal transitions to EVALUATING with a `MAX_CHILDREN_REACHED` flag. The operator decides whether to extend the limit or mark the Goal as complete/failed.

### 5.5 Evaluation Criteria

The goal-met checker always runs the full evaluation protocol (the 7 questions from Section 5.2). There is no tiered hierarchy of evaluation modes -- the checker is agent-driven from MVP.

The operator always has the ability to override the checker's judgment:
- If the checker says "Goal complete" but the operator disagrees, the operator can request further work
- If the checker proposes a ticket but the operator thinks the Goal is done, the operator can mark it complete
- The checker is the intelligence; the human is the authority

### 5.6 Ralph Loop Flow

```
                    +-------------------------------------+
                    |          GOAL CREATED                |
                    |   (title + description +             |
                    |    success criteria)                  |
                    +----------------+--------------------+
                                     |
                                     v
                    +-------------------------------------+
                    |      INITIAL SETUP                   |
                    |   (scout -> diagnosis -> product)    |
                    |   [Optional: advisory roadmap]       |
                    +----------------+--------------------+
                                     |
                                     v
                    +-------------------------------------+
                    |   GOAL-MET CHECKER: First Proposal   |
                    |   (Evaluates objective, proposes     |
                    |    first MVP-scoped ticket)           |
                    +----------------+--------------------+
                                     |
                                     v
                    +-------------------------------------+
                    |      OPERATOR APPROVAL               |
                    |   (approve / modify / reject)        |
                    +----------------+--------------------+
                                     |
                                     v
                    +-------------------------------------+
                    |      CHILD TICKET EXECUTES           |
                    |   (standard pipeline: BUILD, FIX,    |
                    |    RESEARCH, etc.)                    |
                    +----------------+--------------------+
                                     |
                                child completes
                                     |
                                     v
                    +-------------------------------------+
                    |      GOAL-MET CHECKER EVALUATES      |
                    |                                      |
                    |   1. Is it matching?                  |
                    |   2. Is there more to do?             |
                    |   3. Does it need polish?             |
                    |   4. Are all boxes checked?           |
                    |   5. Can something be added?          |
                    |   6. Can something be fixed?          |
                    |   7. Can something be verified?       |
                    +----------------+--------------------+
                                     |
                            +--------+--------+
                            |                 |
                       Objective          Objective
                       NOT met            MET
                            |                 |
                            v                 v
                    +--------------+  +--------------+
                    | Propose next |  |    GOAL      |
                    | ticket with  |  |   COMPLETE   |
                    | rationale    |  | (REPORT_READY)|
                    +------+-------+  +--------------+
                           |
                           v
                    +--------------+
                    |   Check      |
                    |   bounds     |
                    | (max 20      |
                    |  children)   |
                    +------+-------+
                           |
                      within bounds?
                      +----+----+
                      |         |
                     Yes       No
                      |         |
                      v         v
              Operator       Force human
              approves       review / fail
              proposal
                  |
                  v
           Spawn ticket --> SIDE_QUEST_PENDING
                                    |
                               (loop back to "child completes")
```

### 5.7 Human Approval Gate

The human approval gate is the primary safety mechanism for MVP Goals. It operates as follows:

1. **Every checker proposal is presented to the operator.** The operator sees: the proposed ticket (title, description, mode), the evaluation facet it addresses, and the checker's rationale for why this is the most valuable next action.
2. **The operator can approve, modify, or reject.** Approve creates the ticket as proposed. Modify lets the operator adjust the title, description, or mode before creation. Reject cancels the proposal without creating a ticket.
3. **No ticket spawns without human approval.** This makes autonomous runaway impossible in MVP. The system proposes; the human decides.
4. **The operator can also terminate the Goal.** At any point, the operator can mark the Goal as complete (REPORT_READY) or failed (FAILED), overriding the checker's assessment.

This gate is not overhead -- it is the mechanism that makes agent-driven evaluation safe from MVP. Because the operator reviews each proposal, the checker doesn't need to be perfect. It needs to be helpful: propose reasonable next steps that the operator can quickly approve or adjust.

### 5.8 V2: Reduced Human Gates

V2 of the Ralph Loop is **not** about introducing agent-driven evaluation -- that is MVP. V2 is about reducing the human approval overhead once confidence in the checker is established:

**V2 features:**

1. **Auto-approve mode**: For high-confidence goals (e.g., goals with well-defined success criteria, goals matching a known pattern), the operator can enable auto-approve. The checker's proposals spawn tickets without human review, up to a configurable limit.
2. **Multi-ticket proposals**: The checker can propose multiple tickets at once when it is confident about parallel work. For example, if the objective clearly needs both a server and client change, the checker can propose both simultaneously.
3. **Batch evaluation**: After a multi-ticket batch completes, the checker evaluates the combined result. This is the original report's batch model, but it emerges naturally from the multi-ticket proposal -- not as the primary mechanism.
4. **Reduced checkpoints**: Instead of approving every ticket, the operator can set checkpoint intervals (e.g., review every 3rd proposal).

V2 is about relaxing safety constraints once the system has earned trust. MVP is about establishing that trust through transparent, human-approved operation.

---

## 6. Parent-Child Relationship

### 6.1 Shared Infrastructure with SideQuests

Both Goals and SideQuests need a parent-child ticket hierarchy. RSH-193 designed `parentTicketId` as a self-relation on the Ticket model (Section 3, lines 163-179). This report recommends adopting RSH-193's design as a **shared primitive** that serves both use cases:

```
// On Ticket model (from RSH-193 Section 3)
parentTicketId   String?
parentTicket     Ticket?    @relation("TicketParentChild", fields: [parentTicketId], references: [id])
childTickets     Ticket[]   @relation("TicketParentChild")
spawnedAtStep    String?    // Which workflow step triggered the spawn
sideQuestType    String?    // Classification of the child ticket's purpose

@@index([parentTicketId])
```

This design adds 3 new columns and 1 index to the Ticket table. It is additive-only -- existing tickets are unaffected (all new fields are optional/nullable). The implementation should be a single Prisma migration shared with the GOAL enum value and EVALUATING status.

### 6.2 How Goals Differ from SideQuests

Although Goals and SideQuests share `parentTicketId` infrastructure, they differ in fundamental ways:

| Dimension | SideQuests (RSH-193) | Goals (RSH-488) |
|-----------|---------------------|-----------------|
| **Initiated by** | Workflow agent mid-pipeline | User (or system from Playbook) at top level |
| **Parent type** | Any ticket mode (BUILD, FIX, etc.) | GOAL ticket mode specifically |
| **Spawning trigger** | `sideQuests` field in step output JSON | Goal-met checker proposes ticket; operator approves |
| **Parent behavior after spawn** | Pauses at current step, resumes from that step when children complete | Enters Ralph Loop -- waits for child, evaluates when child completes, potentially proposes more |
| **Evaluation after child completes** | None -- parent simply resumes its pipeline from the paused step | Ralph Loop evaluation: is the objective met? What should happen next? |
| **Iteration** | One-shot: children complete, parent resumes, done | Iterative: child completes, evaluate, possibly propose another child |
| **Scope** | Tactical: "I need this sub-task done before I can continue" | Strategic: "Accomplish this business objective to polished completion" |
| **Typical depth** | 1-3 levels (depth-limited by SIDE_QUEST_MAX_NESTING_DEPTH) | 1 level for MVP (Goal -> children), nested Goals deferred |

### 6.3 Resolution Pattern

RSH-193 defines `resolveSideQuestParent()` (Section 5, lines 354-365): when a child completes, query all siblings; if all are done, resume the parent. For Goals, the resolution pattern differs fundamentally -- it uses per-ticket evaluation instead of batch completion:

**SideQuest resolution** (RSH-193 pattern):
All children complete -> parent transitions to QUEUED -> continuation run resumes from `spawnedAtStep`

**Goal resolution** (RSH-488 pattern):
**Each** child completes -> Goal transitions to EVALUATING -> goal-met checker agent evaluates -> either REPORT_READY (complete) or propose next ticket (operator approves -> SIDE_QUEST_PENDING)

The implementation extends the resolution logic with a mode check: when a child ticket completes, if the parent is a GOAL ticket, **immediately** transition the Goal to EVALUATING and run the checker. This does not wait for all siblings to complete. If the parent is a SideQuest parent, the existing batch-resolution logic applies (wait for all siblings).

This keeps the resolution logic centralized while supporting both per-ticket (Goals) and batch (SideQuests) completion models.

---

## 7. Advisory Decomposition

### 7.1 Decomposition as Roadmap, Not Driver

Decomposition -- breaking a Goal into a plan of child tickets upfront -- is useful. The user explicitly acknowledges this: *"you can do a decomposition as an estimate, kinda thinking ahead what needs to get here. That would be helpful."* But: *"as the definitive decider [...] just focusing on the measuring is much simpler."*

The advisory decomposition is an **optional, non-binding roadmap** produced once at Goal creation. It helps "think ahead" about what areas of work the Goal might involve, but it does not drive ticket creation decisions. The goal-met checker drives decisions based on concrete evidence of what was actually built.

**What advisory decomposition IS:**
- An estimate of work areas, categories, and rough sequencing
- A contextual input the checker can reference when proposing the next ticket
- A way for the operator to communicate expectations about the Goal's scope
- A compass that helps orient but does not dictate the path

**What advisory decomposition is NOT:**
- A pipeline step that creates tickets
- The definitive plan that the system executes
- A binding contract for what work will be done
- The orchestration driver

### 7.2 Relationship to the Checker

The advisory roadmap is one of the checker's inputs (listed in Section 5.2). When the checker evaluates "is there more to do?" or "can something be added?", it can reference the roadmap for context about what areas were anticipated. But the checker's real-time assessment of concrete results -- what code exists, what tests pass, what the UX looks like now -- is the definitive driver of what happens next.

The roadmap might say "we'll need email notifications eventually." The checker looks at the current state and might decide error handling is more urgent. The roadmap informs; the checker decides.

### 7.3 When Produced

The advisory roadmap can come from two sources:

1. **Operator-provided**: The operator includes a rough plan in the Goal description itself. ("I think we'll need: approval flow, email notifications, admin dashboard, reporting.")
2. **Setup-generated**: The initial setup steps (scout/diagnosis/product) can optionally produce a roadmap as an artifact. This happens naturally -- the product step already defines what the Goal's outcome should look like, and that framing serves as an implicit roadmap.

Either way, the roadmap is a document artifact. It does not create tickets. It does not appear as a pipeline step.

### 7.4 Child Type Classification

Child tickets spawned from a Goal can serve three purposes, corresponding to the ticket author's description of how MVPs stack:

| Type | Purpose | Example |
|------|---------|---------|
| **Breadth** | Add new capabilities or features | "Add email notification for approval requests" |
| **Depth** | Refine or extend existing work | "Add error handling for edge cases in the approval flow" |
| **Polish** | Improve quality, UX, performance | "Optimize approval query performance for large datasets" |

This classification is stored in the `sideQuestType` field (reusing RSH-193's field) with extended values: `BREADTH`, `DEPTH`, `POLISH` (in addition to RSH-193's `RESEARCH`, `SUB_TASK`, `BUG_FIX`, `PREREQUISITE`). The checker uses this vocabulary when proposing tickets, and the operator can see which evaluation facet each child addresses.

### 7.5 Ordering Strategies

Child tickets can be ordered in three ways, using RSH-193's execution topologies (Section 9, lines 574-630):

1. **Sequential** (default for one-at-a-time): In the MVP per-ticket model, children execute sequentially by default because only one ticket is active at a time.
2. **Parallel** (V2): When multi-ticket proposals are enabled, independent children can execute concurrently.
3. **Sequential chain** (explicit): Children linked via `afterTicketId` execute in a defined order. Useful for depth work where each ticket builds on the previous one.

---

## 8. Cross-Repo Impact Map

This section maps the concrete changes needed across all three repos for future implementation tickets. No code is included -- this is architecture-level specification.

### 8.1 helix-global-server (Primary)

The server is the primary implementation target. All core Goal infrastructure lives here.

#### Schema Changes (prisma/schema.prisma)

| Change | Type | Details |
|--------|------|---------|
| `TicketMode.GOAL` | Enum addition | Add `GOAL` to TicketMode enum (line 110-116) |
| `TicketStatus.EVALUATING` | Enum addition | Add `EVALUATING` to TicketStatus enum (line 22-38) |
| `parentTicketId` | New column on Ticket | `String?` self-relation (shared with SideQuests per RSH-193) |
| `parentTicket` / `childTickets` | New relations | `@relation("TicketParentChild")` |
| `spawnedAtStep` | New column on Ticket | `String?` tracking which step triggered spawning |
| `sideQuestType` | New column on Ticket | `String?` classification (BREADTH, DEPTH, POLISH, etc.) |
| `@@index([parentTicketId])` | New index | Efficient child/parent lookups |

These should be a single Prisma migration. The parentTicketId addition is shared infrastructure with RSH-193 -- implementing it for Goals also enables SideQuests.

#### Service Layer (src/services/ticket-service.ts)

| Function | Type | Details |
|----------|------|---------|
| `createTicketForOrganization()` (line 642) | Modify | Accept `mode: GOAL`, validate Goal-specific fields, handle `parentTicketId` for child creation |
| `resolveGoalParent()` | New | When a child ticket completes, check if its parent is a GOAL ticket. If so, transition the Goal to EVALUATING. This is the per-ticket evaluation trigger. |
| `evaluateGoal()` | New | Run the goal-met checker agent: gather context (child outcomes, codebase state, advisory roadmap), invoke the evaluation prompt, process the output (Goal complete or proposed next ticket) |
| `spawnGoalChild()` | New | Create a single child ticket from a checker proposal with `parentTicketId` pointing to the Goal. Note: singular, not `spawnGoalChildren()` -- one ticket at a time. |
| `validateGoalLimits()` | New | Check total children count against `maxChildren`. No iteration count -- each child IS an iteration. |

#### Orchestrator (src/helix-workflow/)

| File | Change | Details |
|------|--------|---------|
| `helix-workflow-step-catalog.ts` | Modify | Add GOAL mode filter to exclude tech-research, implementation-plan, implementation, code-review, verification, preview-config. GOAL runs: scout, diagnosis, product only. |
| `orchestrator.ts` (line 309) | Modify | Extend `buildTicketArtifactMarkdown()` to include Goal context (parent Goal description, completed siblings, success criteria) when building artifacts for Goal children |
| `orchestrator.ts` (lines 1504, 2338) | Add | `resolveGoalParent()` call at post-success hook points, alongside existing `resolveDependentTickets()`. When a ticket succeeds, check if it has a GOAL parent and trigger evaluation. |

#### API (src/controllers/)

| Endpoint | Type | Details |
|----------|------|---------|
| `POST /tickets` | Existing | Already supports `mode` parameter; GOAL mode works through existing creation flow |
| `GET /tickets/:id` | Existing | Extend response to include `childTickets` array and `parentTicket` reference |
| `POST /tickets/:id/evaluate` | New | Endpoint for operator to approve/modify/reject checker proposal |
| `GET /tickets/:id/checker-proposal` | New | Retrieve the current checker proposal for a Goal in EVALUATING status |

#### MCP Tools (src/mcp/)

| Tool | Type | Details |
|------|------|---------|
| `create-ticket` | Existing | Already supports mode parameter; add GOAL to documentation |
| `goal-status` | New (optional) | Tool for agents to check Goal progress (child count, checker status) |

### 8.2 helix-global-client (Secondary)

The client needs type extensions, mode selection updates, and Goal-specific UI components.

#### Type Extensions (src/types/api.ts)

| Change | Details |
|--------|---------|
| `TicketMode.GOAL` | Add `GOAL: "GOAL"` to TicketMode const (line 256-264) |
| `TicketStatus.EVALUATING` | Add `EVALUATING: "EVALUATING"` to TicketStatus const (line 5-23) |
| `parentTicketId`, `parentTicket` | Add to TicketListItem and TicketDetailResponse types |
| `childTickets` | Add to TicketDetailResponse (array of child references with id, title, status, sideQuestType) |

#### Route Changes

| File | Change | Details |
|------|--------|---------|
| `src/routes/create-ticket.tsx` | Modify | Add GOAL to `getModeOptions()` (line 76-87); GOAL should be available for all org types, positioned as the top-level option |
| `src/routes/ticket-detail.tsx` | Modify | Add Goal-specific detail layout when `mode === GOAL`: show checker proposal review, child ticket progress, evaluation status |

#### New Components

| Component | Purpose |
|-----------|---------|
| `GoalProgressSection` | Shows Goal progress: X/Y children complete, current evaluation status, cumulative work summary |
| `GoalChildList` | Lists child tickets with status badges, type chips (breadth/depth/polish), evaluation facet addressed, and links |
| `GoalCheckerProposal` | Shows the checker's proposed next ticket with rationale and evaluation facet. Operator can approve, modify, or reject. Shown when Goal is in EVALUATING status. |
| `EvaluatingStatusBadge` | EVALUATING status display with distinct color token (new OKLCH value) |

#### Styling

| Change | Details |
|--------|---------|
| New OKLCH color token | `--color-status-evaluating` for the EVALUATING status badge |
| Status label mapping | Map "EVALUATING" to "Evaluating" in format.ts |
| Filter support | Add EVALUATING to status filter groups in ticket-filters.ts |

### 8.3 helix-cli (Tertiary)

The CLI needs minimal changes since GOAL is just another TicketMode value.

| File | Change | Details |
|------|--------|---------|
| `src/tickets/create.ts` (line 12-87) | Modify | Add `GOAL` to `VALID_MODES` array and `--mode` help text |
| Future: `src/goals/` | New (deferred) | Optional Goal-specific commands for checking progress, reviewing proposals |

---

## 9. Safety Mechanisms & Guardrails

Goals introduce iterative ticket spawning, which requires robust safety mechanisms to prevent runaway loops, resource exhaustion, and noise. This section consolidates guardrails from RSH-411 (Section 13, lines 792-800) and RSH-193 (Section 8, lines 539-545) and adapts them for the per-ticket evaluation model.

### 9.1 Spawning Limits

These limits are enforced at the application layer before any child ticket creation:

| Limit | Value | Source | Enforcement |
|-------|-------|--------|-------------|
| Max nesting depth | 1 (MVP), 3 (future) | RSH-193 `SIDE_QUEST_MAX_NESTING_DEPTH` | Walk `parentTicketId` chain upward; reject if depth exceeds limit |
| Max fan-out per spawn | 1 (MVP), 5 (V2) | RSH-193 `SIDE_QUEST_MAX_FAN_OUT` | MVP: one ticket at a time. V2: multi-ticket proposals up to 5. |
| Max tree total | 20 | RSH-193 `SIDE_QUEST_MAX_TREE_TOTAL` | Count all descendants of root parent; reject if total would exceed limit |

For MVP Goals, nesting depth is fixed at 1 (Goal -> children, no nested Goals). The depth limit becomes relevant when nested Goals are introduced in a future version.

### 9.2 Ralph Loop Limits (Per-Ticket Model)

These limits are adapted from the original batch model to the per-ticket evaluation model:

| Bound | Original (Batch) | Revised (Per-Ticket) | Rationale |
|-------|------------------|---------------------|-----------|
| Max iterations | 5 (batch eval cycles) | **Removed** -- each child IS an iteration | Max total children (20) is the effective cap |
| Max total children | 20 | **20 (unchanged)** | Consistent with RSH-193 SIDE_QUEST_MAX_TREE_TOTAL |
| Human checkpoint | Every 3 iterations (V2) | **Every proposed ticket** (MVP + V2) | Human approval gate is the primary safety mechanism |
| Evaluation cooldown | 1 hour | **Removed** | Per-ticket evaluation should be prompt |
| Max children per iteration | 5 (per batch) | **1 (MVP)** | One-at-a-time spawning model |

The human approval gate on every proposed ticket is the primary safety mechanism. The checker cannot spawn tickets without operator consent. This single mechanism prevents:
- Runaway loops (operator can stop approving at any time)
- Low-quality spawning (operator can modify or reject poor proposals)
- Resource exhaustion (operator controls the pace)
- Scope creep (operator sees each proposed ticket and can steer the Goal)

### 9.3 Anti-Spam Guardrails (from RSH-411)

| Guardrail | Mechanism | Source |
|-----------|-----------|--------|
| Deduplication | No new child ticket if an open ticket exists for the same work (title similarity check) | RSH-411 line 796 |
| Rate limit | Maximum auto-spawned tickets per org per day (configurable, default: 10) | RSH-411 line 799 |
| Human confirmation | Checker proposal reviewed by operator before any ticket creation | RSH-411 line 800 |

Note: The original RSH-411 "cooldown" guardrail (configurable minimum interval between spawn cycles, default 1 hour) is removed for the per-ticket model. Per-ticket evaluation and spawning should happen promptly. The human approval gate provides equivalent protection against rapid spawning.

### 9.4 Failure Propagation

Following RSH-193's fail-safe default (Section 8, lines 556-561), adapted for per-ticket evaluation:

| Scenario | Behavior |
|----------|----------|
| Child FAILED | Goal transitions to EVALUATING with failure context. The checker evaluates: should the failed work be retried (propose a new ticket for the same scope), should a different approach be tried, or should the Goal be marked as FAILED? Operator ultimately decides. |
| Child SUCCEEDED | Goal transitions to EVALUATING for normal evaluation. Checker assesses progress and proposes next action. |
| Operator terminates | At any point, the operator can mark the Goal as REPORT_READY (if satisfied) or FAILED (if not). This overrides the checker. |

Goals use a softer failure propagation than SideQuests. For SideQuests, child failure -> parent failure (RSH-193 MVP default). For Goals, child failure -> evaluation with failure context, because a Goal's broader objective may still be achievable despite individual child failures. The checker evaluates the failure in context and proposes the best next action.

---

## 10. Playbook Integration Path

### 10.1 Tier 1: Playbook-Independent Core

Tier 1 is the core Goal functionality that works without the Playbook. It can be implemented immediately, without waiting for RSH-411 Phase 1.

| Component | Description | Dependencies |
|-----------|-------------|-------------|
| `TicketMode.GOAL` | New enum value in schema | None |
| `TicketStatus.EVALUATING` | New status for evaluation state | None |
| `parentTicketId` self-relation | Parent-child hierarchy on Ticket (shared with SideQuests) | None (shared with RSH-193) |
| Goal workflow pipeline | Mode-specific step filtering: scout/diagnosis/product only | Existing RESEARCH mode pattern |
| Goal-met checker agent | Agent evaluates Goal completion after each child, proposes next ticket | Existing agent infrastructure (sandbox + prompt) |
| Per-ticket evaluation trigger | `resolveGoalParent()` at completion hook points | Existing `resolveDependentTickets()` pattern |
| Human approval gate | Operator reviews each checker proposal before ticket spawns | Existing approval patterns |
| Safety bounds | Max total children, per-ticket human approval | Application-layer validation |
| Basic progress tracking | Child completion counts (X/Y complete), current checker status | Query against `parentTicketId` |
| Goal detail UI | Child list, checker proposal review, progress view | Client component additions |
| CLI GOAL mode | Add GOAL to create command mode options | One-line change |

**Estimated implementation scope**: 2-3 tickets (server, client, CLI changes), comparable to RSH-193 SideQuests implementation.

### 10.2 Tier 2: Playbook-Enhanced Goals

Tier 2 adds Playbook awareness to Goal evaluation and decomposition. It requires RSH-411 Phase 1 (PlaybookRule model, CRUD service, basic inference) to be complete.

| Component | Description | Dependencies |
|-----------|-------------|-------------|
| Playbook-aware checking | Goal-met checker receives Playbook rules as additional evaluation context | PlaybookRule model (RSH-411) |
| Rule-aware advisory decomposition | Advisory roadmap can reference Playbook rules for richer context | PlaybookRule model (RSH-411) |
| PlaybookRuleTicket linking | Child tickets linked to Playbook rules via junction table with `linkType: SPAWNED` | PlaybookRuleTicket model (RSH-411 Section 11) |
| Rule status verification | Checker can assess whether spawned CANDIDATE rules have been promoted to ACTIVE | PlaybookRule lifecycle (RSH-411 Section 19) |
| Goal-to-Playbook traceability | "This Goal created these Playbook rules" audit trail | PlaybookRuleTicket junction |

**Dependency**: RSH-411 Phase 1 must be complete before Tier 2 implementation begins. Tier 2 is naturally Phase 2 work in RSH-411's phasing (line 1393).

---

## 11. Phasing Recommendation

### 11.1 Goals Can Proceed Independently of the Playbook

RSH-411 places Goals in Phase 2 (line 1393), after the Playbook MVP. However, this report demonstrates that the core Goal mechanism (Tier 1) is **Playbook-independent**:

- Goal-met checking works from natural language objectives and concrete child outcomes (no Playbook rules needed)
- The per-ticket evaluation trigger extends existing completion infrastructure (no Playbook dependency)
- `parentTicketId` is a shared primitive with RSH-193 SideQuests (no Playbook dependency)
- The GOAL TicketMode and EVALUATING status are pure schema additions (no Playbook schema dependency)

**Recommendation**: Implement Tier 1 Goals independently of or concurrently with Playbook Phase 1. Tier 2 Goals are naturally sequenced after Playbook Phase 1.

### 11.2 Recommended Implementation Sequence

| Phase | What | When | Dependencies |
|-------|------|------|-------------|
| **Goal Phase 1a** | Shared primitives: `parentTicketId`, `SIDE_QUEST_PENDING`, `childTickets` relation | Can start now | None (shared with RSH-193) |
| **Goal Phase 1b** | GOAL TicketMode + EVALUATING status + Goal pipeline (scout/diagnosis/product) + **per-ticket evaluation trigger + goal-met checker agent** | After or alongside 1a | Phase 1a |
| **Goal Phase 1c** | Human approval gate + safety bounds (max children, per-ticket approval) | After 1b | Phase 1b |
| **Goal Phase 1d** | Client UI: Goal creation, checker proposal review, child progress tracking | After 1b server work | Phase 1b (server API) |
| **Goal Phase 2** | Playbook-enhanced checking + reduced human gates + multi-ticket proposals + autonomous operation | After Playbook Phase 1 | RSH-411 Phase 1 |

**Critical phasing note:** The goal-met checker agent is **Phase 1b infrastructure**, not Phase 2. The original report deferred agent-driven evaluation to Phase 2, which contradicted the user's direction. Agent-driven checking is the simpler problem and should be the first thing built. Phase 2 is about relaxing safety constraints (reducing human gates, enabling multi-ticket proposals) -- not about introducing agent evaluation.

### 11.3 Relationship to RSH-193 SideQuests

Goals and SideQuests share foundational infrastructure (`parentTicketId`, child resolution logic, safety limits). The implementation sequence should be:

1. **Implement shared primitives first**: `parentTicketId`, `childTickets` relation, `SIDE_QUEST_PENDING` status, `validateSideQuestLimits()`. This serves both Goals and SideQuests.
2. **Implement Goals or SideQuests second** (either order works): They use the same primitives but have different lifecycle flows. Goals use per-ticket evaluation; SideQuests use batch resolution.
3. **If implementing both simultaneously**: Coordinate to avoid migration conflicts and ensure the shared resolution logic handles both Goal (per-ticket evaluation) and SideQuest (batch resolution) parents correctly via mode check.

---

## 12. Open Questions & Future Work

### 12.1 Open Questions

| # | Question | Category | Current Status |
|---|----------|----------|----------------|
| 1 | **Nested Goals** -- Should Goals be able to spawn sub-Goals (Goal -> Goal -> tickets)? | Architecture | Deferred to post-MVP. MVP is one level: Goal -> child tickets. Nested Goals would require extending the depth limit and defining nested evaluation semantics. |
| 2 | **Checker prompt architecture** -- What is the optimal prompt structure for the goal-met checker agent? How does it balance the 7 evaluation facets? How does it avoid being overly conservative (always finding more to do) or overly permissive (declaring done prematurely)? | Agent Design | Active design question for Phase 1b. The checker is the primary mechanism, not future work. Key question: how to calibrate the checker to match operator expectations for "done." |
| 3 | **Subjective polish judgments** -- How does the checker handle open-ended evaluation facets like "can I polish it?" or "can I add something?" These are inherently subjective. | Agent Design | Active design question. Approach: the checker should bias toward completion for subjective facets (diminishing returns on polish) and propose polish tickets only when concrete, specific improvements can be articulated. |
| 4 | **Per-ticket evaluation and `/after` chains** -- How does the Goal's per-ticket evaluation interact with existing `afterTicketId` sequential dependencies? If a Goal child has an `afterTicketId` pointing to a non-Goal ticket, evaluation may need to account for external dependencies. | Architecture | Open question. MVP assumes Goal children are independent (no `afterTicketId` to external tickets). Integration with `/after` chains should be explored in a future ticket. |
| 5 | **Cross-repo Goals** -- How does a Goal coordinate child tickets that span different repos (e.g., server + client + CLI changes)? | Architecture | Partially addressed: child tickets already support multiple repository assignment via `TicketRepository`. The checker can observe cross-repo changes and propose tickets targeting specific repos. No additional infrastructure needed for MVP. |
| 6 | **Retroactive Goal assignment** -- Can existing tickets be attached to a Goal after the fact? | Product | Deferred. Would require setting `parentTicketId` on existing tickets, which is technically simple but has UX implications (should the Goal's evaluation consider pre-existing work?). |
| 7 | **Skip/redo mechanisms** -- Can parts of a Goal tree be skipped or redone? | Product | Deferred. Individual child tickets can already be manually marked as FAILED or re-created. A formal skip/redo mechanism would need UI support and Goal evaluation awareness. |
| 8 | **Goal templates** -- Pre-defined Goal patterns for common business objectives (e.g., "Add approval workflow", "Implement reporting")? | Product | Deferred. Templates could pre-populate the Goal description and suggest an advisory roadmap. Valuable for repeatability but not needed for core functionality. |
| 9 | **Goal analytics** -- Tracking Goal completion rates, average child counts, time-to-completion, checker accuracy? | Product | Deferred. Analytics can be built once Goals are in use and there is sufficient data. The data model supports querying (parentTicketId, status transitions). |
| 10 | **Sprint.goal field collision** -- Does the existing `Sprint.goal` text field (schema.prisma, line 210) need to evolve? | Schema | Resolved: No. Sprint.goal describes a sprint's theme (a text string). A GOAL ticket is an actionable objective that can be assigned to a sprint via `sprintId`. These are different concepts, and the naming does not create a technical collision because Sprint.goal is a field name while GOAL is a TicketMode enum value. |

### 12.2 Future Work

**Near-term (post-Goal MVP):**
- Goal progress dashboard: aggregate view of all active Goals with progress indicators
- Goal-to-Goal dependency: sequence Goals using `afterTicketId` (already supported since Goals are tickets)
- Checker evaluation history: track what the checker assessed at each evaluation, for debugging and improvement
- Advisory decomposition tooling: optional UI for creating/editing the advisory roadmap at Goal creation

**Medium-term (post-Playbook Phase 1):**
- Playbook-enhanced checking (Tier 2): Checker receives Playbook rules as additional evaluation context
- Reduced human gates (V2): Auto-approve mode, multi-ticket proposals, configurable checkpoint intervals
- Goal completion reports: structured summary of what a Goal accomplished, what changed, how many iterations it took

**Long-term (vision):**
- Nested Goals: Goals spawning sub-Goals for large initiatives
- Goal graph visualization: interactive DAG showing Goal -> children with status and evaluation facets
- Cross-organization Goals: Goals spanning multiple Helix organizations
- Predictive iteration estimation: ML-based prediction of how many children a Goal will need based on historical data
- Learning from completed Goals: using completed Goal histories to improve checker evaluation quality

---

## Methodology & Data Sources

This report was compiled from analysis of the following sources:

| Source | Purpose |
|--------|---------|
| RSH-488 ticket description | Feature requirements, stakeholder vision, design tension |
| RSH-488 continuation context | Strategic redirection: checking-first over decomposition-first; enumerated evaluation facets; one-ticket-at-a-time model |
| RSH-411 report (library/reports/RSH-411/report.md) | Predecessor research: GOAL TicketMode recommendation, Playbook data model, auto-spawning guardrails, implementation phasing |
| RSH-193 report (.helix-refs/RSH-193/run-1/report.md) | Predecessor research: parentTicketId design, SideQuest primitives, safety limits, execution topologies |
| helix-global-server/prisma/schema.prisma | Current data model: TicketMode enum (5 values), TicketStatus enum (15 values), Ticket model (lines 325-374), Sprint.goal (line 210) |
| helix-global-server/src/services/ticket-service.ts | Existing patterns: resolveDependentTickets (line 1716), createTicketForOrganization (line 642) |
| helix-global-server/src/helix-workflow/helix-workflow-step-catalog.ts | Workflow pipeline: 9 steps, mode filtering precedent (RESEARCH mode) |
| helix-global-server/src/helix-workflow/orchestrator.ts | Completion hooks (lines 1504, 2338), buildTicketArtifactMarkdown (line 309), stepsToRun mechanism |
| helix-global-server/src/helix-workflow/orchestrator/workflow-step-chain.ts | Step chain execution, RESEARCH mode filtering (line 82-84), mode-specific pipeline proof |
| helix-global-client/src/types/api.ts | Client types: TicketMode (line 256-264), TicketStatus (line 5-23) |
| helix-global-client/src/routes/create-ticket.tsx | Mode selection UI: getModeOptions (line 76-87) |
| helix-cli/src/tickets/create.ts | CLI mode parameter: VALID_MODES, --mode flag (line 12-87) |
| Diagnosis, product, tech-research artifacts | Workflow step outputs providing scoping, analysis, architectural decisions, and revision map for the checking-first pivot |

---

*Report revised for Helix ticket RSH-488 "Goals: The PM Agent x Ralph Loop" -- May 2026*
*Revision: Checking-first architecture based on continuation context*

## Attachments
- (none)

## Discussion
- **Helix** (2026-05-19T03:01:46.076Z) [Agent]: I'm working on this, I'll get back to you when ready.

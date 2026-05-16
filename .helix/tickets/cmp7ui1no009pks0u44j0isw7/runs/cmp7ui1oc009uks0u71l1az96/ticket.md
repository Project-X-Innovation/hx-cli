# Ticket Context

- ticket_id: cmp7ui1no009pks0u44j0isw7
- short_id: RSH-473
- run_id: cmp7ui1oc009uks0u71l1az96
- run_branch: helix/research/RSH-473-verification-elephant-in-the-room
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Verification Elephant In The Room

## Description
Give me a build ticket 



Btw, we are going to implement visual UI testing for NetSuite, but it is coming soon

## Research Report

# The Verification Elephant In The Room: A Framework for Layered Verification Architecture

**Ticket**: RSH-445  
**Date**: May 2026  
**Type**: Conceptual Framework / Research Report  

---

## 1. Executive Summary

The Helix workflow pipeline currently treats verification as a monolithic, end-of-pipeline gate that conflates three fundamentally distinct responsibilities: quality assurance (re-running checks the implementation agent already performs), user-facing demonstration (capturing random screenshots as byproducts of check execution), and scenario-driven acceptance (unstructured browser interactions that do not systematically confirm the user's problem was solved). The result is redundant work, ineffective demos, and no mechanism to validate the implementation against the full planning stack.

This report proposes a **layered verification architecture** — the "sandwich model" — that restructures verification from a single terminal step into a distributed, per-layer quality process. In this model, every planning step (product, tech-research, implementation-plan) produces structured, checkable verification criteria upfront. After implementation, a **verification cascade** confirms those criteria were met in reverse order, from the most concrete (plan adherence) to the most abstract (user scenario acceptance). A separate **demo agent** — entirely distinct from verification — produces curated, scenario-organized presentation content for the ticket author.

Two critical principles underpin this framework:

1. **Verification is a contract, not a report.** When a verification layer flags a failure, Helix must route it to the responsible agent for resolution. UNVERIFIED must never be an acceptable terminal state — it becomes a human-review state with full context for guided retry.

2. **Demo is storytelling, verification is quality.** These are separate concerns with separate audiences, separate outputs, and separate agents. They must never be conflated.

This framework applies to all Helix platforms, including NetSuite, where code-level verification layers (Plan Adherence, Technical Validation) operate without UI access, and runtime inspection replaces browser-based scenario walks. The layered model provides *more* verification for NetSuite than the current bypass model, not less.

---

## 2. Problem Statement: The Verification Conflation

### 2.1 The Three Conflated Responsibilities

The current Helix pipeline executes 9 sequential steps: scout, diagnosis, product, tech-research, implementation-plan, implementation, code-review, **verification**, and preview-config. The verification step (step 8 of 9, defined in `verification/step-config.mjs` at 316 lines) is responsible for three distinct jobs that should never have been combined:

**Job 1: Quality Assurance**  
The verification step independently re-executes the Verification Plan — the same Pre-conditions and Required Checks (CHK-XX IDs) that the implementation step already ran during its own self-verification phase. The verification step explicitly does not trust implementation's self-assessment. This produces complete redundancy for mechanical checks (build passes, types compile, dev server starts) without adding creative or scenario-based value.

*Evidence*: Implementation self-verifies at `implementation/step-config.mjs` lines 174-185, recording per-check outcomes. Verification re-runs the same plan at `verification/step-config.mjs` lines 114-132, with an explicit distrust posture at line 115.

**Job 2: User-Facing Demo**  
Proof screenshots are captured *during* verification check execution — they are evidence artifacts, not intentional demonstrations. Screenshots are written to `/tmp/proof-*.png`, uploaded to Vercel Blob Storage, and displayed in the client's ProofViewer as an unstructured grid gallery. The orchestrator limits display to 5 screenshots in completion comments. There is no scenario organization, no narrative structure, no curation, and no video capability.

*Evidence*: Screenshot capture at `verification/step-config.mjs` lines 59, 129, 139-143. Client display at `proof-viewer.tsx` — responsive grid with lightbox, no scenario organization.

**Job 3: Scenario-Driven Acceptance**  
Browser interactions during verification incidentally explore the UI but do not systematically walk through user scenarios to confirm the requested functionality was actually built. The verification step has no access to product-defined user scenarios because product produces only unstructured "Success Criteria" (`product/step-config.mjs` line 79) — not formal, testable scenarios.

*Evidence*: No product scenario format exists. `product/step-config.mjs` produces Success Criteria as unstructured business outcomes. `tech-research/step-config.mjs` lines 66-77 produce Architecture Decisions as narrative text. Only `implementation-plan/step-config.mjs` lines 104-140 produce structured verification criteria.

### 2.2 The Single Verification Plan Problem

The entire verification flow derives from one specification: the **Verification Plan** created by the implementation-plan step. This plan contains Pre-conditions and Required Checks with CHK-XX identifiers. Implementation self-verifies against it, then verification independently re-runs it. But the two earlier planning steps — **product** and **tech-research** — contribute nothing to downstream verification:

| Planning Step | Current Verification Output | Gap |
|--------------|---------------------------|-----|
| **Product** | Success Criteria (unstructured prose) | No testable user scenarios |
| **Tech-Research** | Architecture Decisions (narrative) | No checkable technical requirements |
| **Implementation-Plan** | Required Checks (CHK-XX, structured) | This is the ONLY verification specification |

The result: verification checks whether the code builds and runs, but never checks whether the user's problem was solved (product concern) or whether the technical decisions were honored (tech-research concern).

### 2.3 The Forward-Only Pipeline

The 9-step pipeline executes strictly forward with one narrow feedback loop: when verification returns `implementation_wrong`, the pipeline loops back to the implementation step (max 2 retries, controlled by `MAX_VERIFICATION_RETRIES = 2` in `workflow-step-chain.ts` line 668). After retries are exhausted, the run becomes **UNVERIFIED** — a terminal state with no recovery path.

*Evidence*: `workflow-step-chain.ts` lines 938-1041 implement the retry loop. Lines 1044-1122 set UNVERIFIED as terminal. `orchestrator.ts` lines 2038-2119 handle UNVERIFIED as early exit. `run-store.ts` lines 364-389 sets both run and ticket to UNVERIFIED status — a final state with no re-entry mechanism.

There is no upward cascade where verification findings route back to tech-research, product, or implementation-plan for assessment at their respective levels of abstraction.

### 2.4 The UNVERIFIED Terminal State

When verification fails and retries are exhausted, the run enters an **UNVERIFIED** terminal state. This is effectively "reported but not fixed" — the pipeline flags that something is wrong but provides no resolution mechanism. For non-NetSuite platforms, the run halts without deployment. For NetSuite platforms, the run proceeds to deployment anyway, treating UNVERIFIED as a warning rather than an error (`orchestrator.ts` lines 2122-2124).

This means Helix's core product — NetSuite — has the *least* quality assurance of any platform. The pragmatic workaround masks the deeper issue: verification should drive resolution, not abandonment.

### 2.5 The Demo Quality Problem

The current "demo" is a collection of screenshots that happened to be captured during verification check execution. These screenshots are:

- **Random**: Captured as evidence of check execution, not as intentional demonstrations of features
- **Unorganized**: Displayed in a grid gallery without scenario grouping or narrative structure
- **Limited**: The orchestrator displays a maximum of 5 screenshots in completion comments
- **Static only**: The client has no video playback capability
- **Not curated**: No process selects, arranges, or captions screenshots for a user-facing walkthrough

The ticket author sees verification byproducts, not a purposeful demonstration of what was built.

---

## 3. The Sandwich Model: A Layered Verification Architecture

### 3.1 Core Concept

The sandwich model restructures verification from a single terminal gate into a four-layer architecture where quality assurance is distributed across the pipeline:

```
FORWARD PASS (Planning)         REVERSE PASS (Verification)
========================        ============================

    Product                         Scenario Acceptance
       |   defines SCN-XX               ^   validates SCN-XX
       v                                |
    Tech-Research                   Technical Validation
       |   defines TCK-XX               ^   validates TCK-XX
       v                                |
    Implementation-Plan             Plan Adherence
       |   defines CHK-XX               ^   validates CHK-XX
       v                                |
    Implementation ──────────────────────┘
       (builds + Inline Checks)

                                    ┌──────────┐
                                    │   Demo   │  (Presentation Pass)
                                    └──────────┘
                                    Separate from verification
                                    Non-blocking, user-facing
```

### 3.2 Layer 1: Criteria Production (Forward Pass)

Each planning step produces structured, ID-tagged verification criteria alongside its existing output. These criteria become the contract that the corresponding verification layer will check:

| Planning Step | Current Output | New Verification Output | ID Format |
|--------------|---------------|------------------------|-----------|
| **Product** | Success Criteria (unstructured) | **User Scenarios** | SCN-XX |
| **Tech-Research** | Technical Decisions (narrative) | **Technical Checks** | TCK-XX |
| **Implementation-Plan** | Required Checks (already structured) | **Required Checks** (unchanged) | CHK-XX |

**Design principle**: Criteria are specified at the planning step's level of abstraction. Product scenarios describe WHAT the user must be able to do ("User can create a new record and see it in the list view"), not HOW the system implements it. Technical checks reference specific decisions ("API uses pagination per TCK-03"). Required checks are implementation-level ("Build passes, dev server starts, form saves data per CHK-01").

**Key tradeoff**: Product scenarios must be abstract enough to verify regardless of implementation approach — product runs before tech-research and implementation-plan in the pipeline. This means scenarios describe user outcomes, not implementation paths. This is a feature, not a limitation: it ensures scenarios remain valid even if the implementation approach changes.

### 3.3 Layer 2: Inline Quality (Middle Pass)

The implementation step builds the solution while self-verifying against the implementation-plan's Required Checks (CHK-XX) in real time. This already partially exists: `implementation/step-config.mjs` lines 174-185 record per-check outcomes in `implementation-actual.md`.

**What changes**: Implementation self-verification becomes **enforced, not advisory**. The implementation step must record an explicit outcome (pass / fail / blocked) for every CHK-XX in its artifact. The verification cascade can then trust these results for Plan Adherence without redundant re-execution.

**What stays the same**: Implementation continues to be the step that builds the solution. The "inline" aspect means verification happens *during* building, not as a separate phase after it.

### 3.4 Layer 3: Verification Cascade (Reverse Pass)

After implementation and code-review complete, verification cascades backward through three layers, each checking a different level of abstraction:

#### Layer 3a: Plan Adherence

- **What it checks**: Were the implementation-plan's Required Checks (CHK-XX) fulfilled?
- **How it checks**: Reviews implementation's recorded Inline Check outcomes. Spot-checks critical behavioral checks via code inspection or build verification. Does NOT redundantly re-run all mechanical checks.
- **Trust model**: Trusts implementation's self-reported outcomes for deterministic checks (build passes, types compile). Independently verifies behavioral checks (feature works as described, UI renders correctly).
- **Failure routing**: Failures route to the **implementation agent** for correction.

#### Layer 3b: Technical Validation

- **What it checks**: Were the tech-research decisions and requirements (TCK-XX) implemented correctly?
- **How it checks**: Code inspection against technical checks. Verifies that architectural patterns, library choices, API designs, and performance approaches match what tech-research specified.
- **Trust model**: Cannot be self-verified by implementation — requires domain comparison between tech-research output and actual code. This is the first layer that adds genuinely new verification value beyond what implementation can self-assess.
- **Failure routing**: Failures route to **implementation** for technical remediation. If the tech-research decision itself was flawed (discovered during validation), escalate to **human review** with context.

#### Layer 3c: Scenario Acceptance

- **What it checks**: Can the user accomplish all product-defined User Scenarios (SCN-XX)?
- **How it checks**: Opens the preview or development environment and walks through each scenario. Uses browser automation or runtime inspection to confirm each scenario's Expected Outcome.
- **Trust model**: Highest-abstraction check — cannot be verified by implementation or earlier cascade layers. Requires live environment interaction or runtime inspection.
- **Failure routing**: Failures route to **implementation** for functional remediation. If the scenario itself was ill-specified (impossible to verify as written), escalate with revision context.

### 3.5 Layer 4: Demo (Presentation Pass)

A dedicated demo agent produces user-facing presentation content after all verification cascade layers pass. This is covered in detail in Section 6.

---

## 4. Per-Step Verification Criteria Specification

### 4.1 Product: User Scenarios (SCN-XX)

**Format**:

```
[SCN-01] Create a new inventory record
- Precondition: User is logged in and on the inventory page
- Action: User fills out the new record form and submits it
- Expected Outcome: The new record appears in the inventory list view
  with all entered field values displayed correctly
```

**Mandatory Fields**:
| Field | Description |
|-------|-------------|
| **ID** | Stable identifier (SCN-01, SCN-02, ...) |
| **Title** | Brief scenario name |
| **Precondition** | What must be true before the scenario starts |
| **Action** | What the user does (described at the user level, not the implementation level) |
| **Expected Outcome** | What the user observes when the scenario succeeds |

**Guidelines**:
- 5-15 scenarios per ticket (fewer for simple changes, more for complex features)
- Scenarios describe WHAT, not HOW — they must remain valid regardless of implementation approach
- Scenarios are abstract enough to verify on multiple platforms (web UI walkthrough for web, runtime inspection for NetSuite)
- Each scenario maps to a distinct user capability, not a technical checkpoint

### 4.2 Tech-Research: Technical Checks (TCK-XX)

**Format**:

```
[TCK-01] API pagination implementation
- Decision Reference: "Use cursor-based pagination for all list endpoints"
  (from Architecture Decision 3)
- Verification Method: code-inspection
- Expected Evidence: List endpoint handlers use cursor parameters,
  not offset/limit. Response includes nextCursor field.
```

**Mandatory Fields**:
| Field | Description |
|-------|-------------|
| **ID** | Stable identifier (TCK-01, TCK-02, ...) |
| **Title** | Brief check name |
| **Decision Reference** | Which architecture decision this check validates, with the decision text |
| **Verification Method** | `code-inspection` (static analysis of implementation) or `behavioral` (runtime observation) |
| **Expected Evidence** | What the verifier should observe if the decision was correctly implemented |

**Guidelines**:
- 3-8 checks per ticket (focused on the most impactful technical decisions)
- Each check references a specific decision from the tech-research output
- Verification method determines whether the check requires running code (`behavioral`) or just reading it (`code-inspection`)
- Not every tech-research decision needs a check — focus on decisions where incorrect implementation would cause quality or architectural problems

### 4.3 Implementation-Plan: Required Checks (CHK-XX) — Unchanged

The implementation-plan step already produces structured Required Checks in the correct format:

```
[CHK-01] Verify build succeeds after code changes
- Action: Run npm run build in the project root
- Expected Outcome: Build completes without errors
- Required Evidence: Build command output showing success
```

**Mandatory Fields** (existing, no changes):
| Field | Description |
|-------|-------------|
| **ID** | Stable identifier (CHK-01, CHK-02, ...) |
| **Action** | What to do to verify this check |
| **Expected Outcome** | What should happen if implementation is correct |
| **Required Evidence** | What evidence proves the check passed |

### 4.4 Current vs. Proposed Comparison

| Planning Step | Current Output | Current Verification Consumer | Proposed Output | Proposed Verification Consumer |
|--------------|---------------|------------------------------|-----------------|-------------------------------|
| **Product** | Success Criteria (unstructured prose) | None | User Scenarios (SCN-XX, structured) | Scenario Acceptance (Layer 3c) |
| **Tech-Research** | Architecture Decisions (narrative) | None | Technical Checks (TCK-XX, structured) | Technical Validation (Layer 3b) |
| **Implementation-Plan** | Required Checks (CHK-XX, structured) | Verification step (full re-run) | Required Checks (CHK-XX, unchanged) | Plan Adherence (Layer 3a, trust-but-verify) |

### 4.5 Consumption Model

The verification cascade consumes criteria in reverse order, from the most concrete to the most abstract:

1. **Plan Adherence** consumes CHK-XX from implementation-plan, cross-referencing implementation's recorded Inline Check outcomes
2. **Technical Validation** consumes TCK-XX from tech-research, inspecting the implemented code against each technical decision
3. **Scenario Acceptance** consumes SCN-XX from product, walking through each scenario in a live environment

This ordering ensures that mechanical issues are caught first (Plan Adherence), technical correctness is confirmed next (Technical Validation), and user-level functionality is verified last (Scenario Acceptance). A failure at an earlier layer means later layers do not need to run — if the build does not compile, there is no point testing user scenarios.

---

## 5. Verification as Contract: Failure Resolution Architecture

This section addresses the first discussion directive: **"Verification failures must be addressed by Helix. That's the whole point."** This is a necessary architectural requirement, not a future enhancement.

### 5.1 The Current Model: Report and Abandon

Today, verification operates as a reporting mechanism:

```
Verification Step
    |
    ├── pass → SUCCEEDED → deploy
    |
    ├── implementation_wrong → retry implementation (max 2 times)
    |       └── retries exhausted → UNVERIFIED (terminal)
    |
    └── verification_broken → UNVERIFIED (terminal)

UNVERIFIED = reported but not fixed. Pipeline stops. No resolution path.
```

The current `MAX_VERIFICATION_RETRIES = 2` (`workflow-step-chain.ts` line 668) applies a single retry budget to all failure types. After 2 retries, the run enters UNVERIFIED — a terminal state where `markRunUnverified` (`run-store.ts` lines 364-389) sets both run and ticket status to UNVERIFIED with no re-entry mechanism.

**What happens to the user**: The ticket author receives a notification that verification failed. No further action is taken by Helix. The problem is flagged but not solved.

### 5.2 The Proposed Model: Contract and Resolve

In the contract model, each verification layer's outcome is a binding obligation:

```
Plan Adherence
    ├── pass → proceed to Technical Validation
    └── fail → route to Implementation Agent (mechanical/plan fix)
              ├── fix applied → re-run Plan Adherence
              └── layer retries exhausted → escalate to Human Review

Technical Validation
    ├── pass → proceed to Scenario Acceptance
    └── fail → route to Implementation Agent (technical fix)
              ├── fix applied → re-run Technical Validation
              ├── tech decision was wrong → escalate to Human Review
              └── layer retries exhausted → escalate to Human Review

Scenario Acceptance
    ├── pass → proceed to Demo
    └── fail → route to Implementation Agent (functional fix)
              ├── fix applied → re-run Scenario Acceptance
              ├── scenario was ill-specified → escalate to Human Review
              └── layer retries exhausted → escalate to Human Review

All layers pass → Demo Agent → SUCCEEDED

Human Review = NOT terminal. Human provides guidance for guided retry.
```

### 5.3 Key Principles of the Contract Model

**Principle 1: Failures route to the responsible agent.**  
Plan Adherence failures go to implementation (the step that is supposed to follow the plan). Technical Validation failures go to implementation for technical remediation, but escalate to human review if the tech-research decision itself was flawed. Scenario Acceptance failures go to implementation for functional fixes, but escalate if the scenario was ill-specified.

**Principle 2: UNVERIFIED is eliminated as a terminal state.**  
The current UNVERIFIED state effectively means "we tried and gave up." In the contract model, exhausted retries at any layer escalate to **human review** — an active state where the human receives full context (which layer failed, which criteria, what was observed, what was expected) and can provide guidance for the next attempt. The existing continuation/retry mechanism with `continuationContext` can support this pattern.

**Principle 3: Per-layer retry budgets replace the global budget.**  
Different layers have different fix complexity. A Plan Adherence failure (the build does not compile) is typically a quick fix. A Scenario Acceptance failure (the user cannot accomplish a workflow) may require significant investigation. A single global retry count of 2 is insufficient and poorly calibrated:

| Cascade Layer | Typical Fix Complexity | Recommended Retry Budget |
|--------------|----------------------|-------------------------|
| Plan Adherence | Low (mechanical fixes) | 2-3 retries |
| Technical Validation | Medium (technical remediation) | 1-2 retries |
| Scenario Acceptance | High (functional redesign possible) | 1-2 retries |

**Principle 4: Escalation provides context, not silence.**  
When all retries are exhausted at a given layer, the escalation to human review includes:
- Which layer failed
- Which specific criteria (by ID) were not met
- What was observed vs. what was expected
- What remediation was attempted and why it did not succeed
- Full artifact stack for context

This replaces the current pattern where UNVERIFIED is the end of the conversation.

### 5.4 Before and After: Feedback Loop Comparison

**Before (Current)**:
```
verification ──fail──> implementation (2 global retries)
                                └──exhausted──> UNVERIFIED (terminal, no recovery)
```

**After (Proposed)**:
```
Plan Adherence ──fail──> implementation (2-3 retries per layer)
                                └──exhausted──> human review (with context)

Technical Validation ──fail──> implementation (1-2 retries)
                      ──tech decision wrong──> human review
                                └──exhausted──> human review (with context)

Scenario Acceptance ──fail──> implementation (1-2 retries)
                    ──scenario ill-specified──> human review
                                └──exhausted──> human review (with context)

Human review is not terminal. Human provides continuationContext for guided retry.
```

---

## 6. Separating Demo from Verification

### 6.1 The Fundamental Distinction

| Aspect | Verification | Demo |
|--------|-------------|------|
| **Purpose** | Internal quality assurance | External storytelling |
| **Audience** | The pipeline (automated agents) | The ticket author (human) |
| **Question answered** | "Did we meet our own criteria?" | "What did we build and how does it work?" |
| **Output format** | Pass/fail per criterion with evidence | Curated walkthrough with narrative |
| **Quality gate** | Yes — failures block the pipeline | No — cannot fail a run |
| **Agent** | Verification cascade (automated) | Demo agent (dedicated) |
| **When it runs** | After implementation, before deployment | After verification cascade passes |

### 6.2 What the Demo Agent Does

The demo agent's sole purpose is producing user-facing presentation content. It runs after the verification cascade completes successfully and the preview deployment exists.

**Inputs**:
- Full artifact stack (product scenarios, tech-research decisions, implementation plan, implementation actual)
- Access to the preview or development environment
- Product scenarios (SCN-XX) as the organizational template

**Output**:
- **Initial format**: Scenario-organized screenshot sequences. Each product scenario (SCN-XX) has one or more screenshots showing the scenario in action, with descriptive captions.
- **Future format**: Structured video walkthroughs with chapter markers organized by product scenarios.

**What the demo is NOT**:
- Not a quality gate — it cannot cause a run to fail
- Not evidence collection — it does not produce pass/fail outcomes
- Not random screenshots — every screenshot is intentional, captioned, and organized by scenario
- Not part of verification — it has its own step, its own config, its own outcome

### 6.3 Demo Organization

The demo is organized around the product's User Scenarios (SCN-XX), creating a natural narrative structure:

```
Demo for RSH-445
================

SCN-01: Create a new inventory record
  [Screenshot 1] Inventory page before action - showing the list view
  [Screenshot 2] Filled out form with test data
  [Screenshot 3] New record visible in the list view after submission

SCN-02: Edit an existing record
  [Screenshot 4] Record detail view before edit
  [Screenshot 5] Updated fields after save

SCN-03: Search for records by date range
  [Screenshot 6] Search form with date filter applied
  [Screenshot 7] Filtered results showing matching records
```

This scenario-organized structure tells the ticket author: "Here are the things you asked for, and here is each one working." This is fundamentally different from the current approach of showing random screenshots that happened to be captured during verification check execution.

### 6.4 Relationship to Existing Infrastructure

The client's existing ProofViewer component provides the foundation for demo display — it already supports responsive grids and lightbox viewing. The evolution path is:
- **Current**: ProofViewer displays verification evidence screenshots (unorganized, random)
- **Proposed**: ProofViewer evolves into a demo viewer displaying scenario-organized, captioned screenshots
- **Future**: A new component supports video playback with chapter navigation by scenario

---

## 7. Terminology Framework

### 7.1 The Overloading Problem

The word "verification" is currently used to mean at least five different things:
1. The verification pipeline step (step 8)
2. The Verification Plan (the artifact from implementation-plan)
3. Implementation self-verification (Inline Checks during building)
4. The verification outcome (pass/implementation_wrong/verification_broken)
5. The general concept of checking whether something works

This overloading makes it impossible to have precise conversations about which layer of quality assurance is being discussed.

### 7.2 Terminology Reference

| Term | Layer | Description | ID Format | Produced By | Consumed By |
|------|-------|-------------|-----------|-------------|-------------|
| **User Scenarios** | Product (Layer 1) | What the user must be able to accomplish after implementation | SCN-XX | Product step | Scenario Acceptance |
| **Technical Checks** | Tech-Research (Layer 1) | What technical decisions must be honored in the implementation | TCK-XX | Tech-Research step | Technical Validation |
| **Required Checks** | Implementation-Plan (Layer 1) | What implementation steps must verify while building | CHK-XX | Implementation-Plan step | Inline Checks, Plan Adherence |
| **Inline Checks** | Implementation (Layer 2) | Real-time self-assessment against Required Checks during building | References CHK-XX | Implementation step | Plan Adherence |
| **Plan Adherence** | Verification Cascade (Layer 3a) | Confirms the implementation followed the implementation plan | Validates CHK-XX | Cascade layer 3a | Pipeline decision |
| **Technical Validation** | Verification Cascade (Layer 3b) | Confirms tech-research decisions were correctly implemented | Validates TCK-XX | Cascade layer 3b | Pipeline decision |
| **Scenario Acceptance** | Verification Cascade (Layer 3c) | Confirms user scenarios are achievable in a live environment | Validates SCN-XX | Cascade layer 3c | Pipeline decision |
| **Verification Cascade** | Umbrella term | The complete post-implementation reverse pass (layers 3a-3c) | -- | -- | Pipeline orchestration |
| **Demo** | Presentation (Layer 4) | Curated user-facing walkthrough of implemented features | Organized by SCN-XX | Demo agent | Ticket author |

### 7.3 Usage Guidance

- **Deprecated**: Using "verification" alone without qualification. Always specify which layer: "Plan Adherence verification," "Technical Validation," "Scenario Acceptance," etc.
- **Acceptable**: "Verification Cascade" as the umbrella term for the reverse pass (layers 3a-3c collectively).
- **Wrong**: Calling the demo "verification." Demo is explicitly not verification.
- **Wrong**: Calling implementation self-checking "verification." It is "Inline Checks."

### 7.4 Mapping to Current Architecture

| Current Term | Proposed Replacement | Notes |
|-------------|---------------------|-------|
| "Verification step" (step 8) | Verification Cascade (layers 3a-3c) | The monolithic step is decomposed into three layers |
| "Verification Plan" | Required Checks specification | The plan itself is a collection of CHK-XX checks |
| "Proof screenshots" | Demo content | Screenshots are produced by the demo agent, not during verification |
| "Implementation self-verification" | Inline Checks | More precise — it happens during implementation, inline with building |
| "UNVERIFIED" (terminal state) | Human Review (active state) | Not a terminal state — requires human guidance for resolution |
| "verification_broken" | Layer-specific failure + escalation | Failure routing replaces a single undifferentiated outcome |

---

## 8. NetSuite and Non-UI Platform Strategy

### 8.1 The Current State

NetSuite is Helix's core product, yet it has the least verification coverage. The current verification step relies on browser-based UI interaction, which is not available for NetSuite platform runs. The pragmatic workaround: when verification returns UNVERIFIED for a NetSuite run, the pipeline treats it as a warning and proceeds to deployment anyway (`orchestrator.ts` lines 2122-2124).

This means NetSuite runs bypass all verification. The "workaround" has become the default — NetSuite implementations are deployed with no independent quality confirmation.

### 8.2 The Layered Model Provides More Coverage

The sandwich model reverses this situation. Two of the three cascade layers do not require UI access:

| Cascade Layer | Web Platform | NetSuite Platform | UI Required? |
|--------------|-------------|------------------|-------------|
| **Plan Adherence** | Full — code inspection + build verification | Full — code inspection + build verification | No |
| **Technical Validation** | Full — code + behavioral inspection | Full — code + SuiteScript pattern verification | No |
| **Scenario Acceptance** | Browser-based UI walkthrough | Runtime inspection: SuiteQL queries, log checks, API calls, script deployment | Partial (adapted) |
| **Demo** | Screenshot sequence from preview environment | Screenshot sequence from NS sandbox or annotated SuiteQL results | Adapted |

### 8.3 Scenario Acceptance for NetSuite

For NetSuite, Scenario Acceptance uses runtime inspection instead of browser-based UI walks:

- **SuiteQL queries**: Verify that records were created, fields have correct values, relationships are intact
- **Script deployment verification**: Confirm that scripts are deployed to the correct records, triggers are configured correctly
- **Log checks**: Verify that expected log entries appear (or problematic log entries do not appear) after scenario execution
- **API calls**: Test RESTlet or SuiteTalk endpoints for correct response shapes and data
- **Workflow verification**: Confirm that workflow states transition correctly for test records

### 8.4 Platform-Deferred Scenarios

Some product scenarios may be inherently visual — they depend on seeing the NetSuite UI (form layout, field placement, UI aesthetics). These scenarios are marked as **"platform-deferred"** rather than marking the entire run as UNVERIFIED:

```
[SCN-04] Verify the custom form layout matches the specification
- Platform status: PLATFORM-DEFERRED (NetSuite)
- Reason: Form layout verification requires visual UI access
- Alternative evidence: SuiteQL query confirms all custom fields are
  present on the record type and assigned to the correct subtab
```

**Key principle**: Platform-deferred means "this specific scenario cannot be fully verified on this platform" — not "the entire run is unverifiable." All non-visual scenarios are verified through runtime inspection, and the run outcome reflects the results of those checks.

### 8.5 The Net Improvement

| Verification Aspect | Before (Current) | After (Proposed) |
|---------------------|------------------|-----------------|
| Plan Adherence | None (verification step skipped) | Full code-level verification |
| Technical Validation | None | Full code-level + SuiteScript pattern verification |
| Scenario Acceptance | None | Runtime inspection for data-layer scenarios |
| Visual scenarios | None (entire verification skipped) | Platform-deferred (marked individually) |
| Run outcome | UNVERIFIED (terminal bypass) | Cascade result (per-layer pass/fail) |

The layered model transforms NetSuite from "no verification at all" to "full code-level verification plus data-layer scenario verification," with only inherently visual scenarios marked as platform-deferred.

---

## 9. Optimal Architecture Vision (Research Direction)

> **This section is research for potential expansion, not a near-term implementation target.** Per the ticket discussion: "The second is research for potential expansion."

### 9.1 Fully Bidirectional Agent Routing

In the optimal system, verification failures can route to **any** earlier step in the pipeline, not just implementation:

- **If Technical Validation reveals a flawed tech-research decision** (e.g., the chosen library does not support the needed feature): The failure routes back to the tech-research step to revise its guidance. The revised guidance cascades forward through implementation-plan and implementation, producing a corrected implementation.

- **If Scenario Acceptance reveals an ill-specified product scenario** (e.g., the user action described is ambiguous or impossible): The failure routes back to the product step to revise the scenario. The revised scenario cascades forward through the planning and implementation stack.

This requires the orchestrator to support **backward branching to any step with forward re-execution of all dependent steps** — a significant extension of the current forward-only pipeline with a single `verification -> implementation` loop.

**Implication**: The pipeline becomes a directed graph with feedback edges, not a simple sequential chain. Steps downstream of the revised step must re-execute to incorporate the changes. This is architecturally complex but produces the highest-quality output — decisions are never "locked in" after their step completes.

### 9.2 Per-Layer Verification Agents

In the optimal model, each cascade layer has a **specialized agent** rather than a single verification agent running all layers:

- **Plan Adherence Agent**: Specialized in build systems, test execution, and code-level compliance checking
- **Technical Validation Agent**: Specialized in architecture review, pattern matching, and technical decision compliance
- **Scenario Acceptance Agent**: Specialized in user-facing testing, browser automation, and runtime inspection
- **Demo Agent**: Specialized in presentation, storytelling, and visual communication

Each agent has its own step config, its own prompt engineering, and its own tool access. This allows each layer to be independently improved, debugged, and optimized.

### 9.3 Video Demo Agent

The optimal demo agent produces a **structured video walkthrough**:

- **Organized by scenario**: Each product scenario (SCN-XX) is a chapter in the video
- **Live interaction recording**: The agent navigates the preview environment while recording
- **Generated narrative**: Captions and narration are generated from the artifact stack — product scenarios describe what to show, implementation actual describes what was built
- **Chapter markers**: Video includes navigable chapter markers for each scenario
- **Storage and playback**: Video stored as a blob artifact, played back in the client with chapter navigation

This requires: video recording capability in the sandbox environment, video storage infrastructure (Vercel Blob or dedicated video storage), and a new video playback component in the client.

### 9.4 Per-Layer Verification Dashboard

The client displays a **hierarchical verification view** that replaces the current single-outcome badge:

```
Run #42: SUCCEEDED
├── Plan Adherence: PASSED (6/6 checks)
│   ├── CHK-01: Build succeeds ✓
│   ├── CHK-02: Types compile ✓
│   ├── CHK-03: Dev server starts ✓
│   ├── CHK-04: Form saves data ✓
│   ├── CHK-05: API returns correct shape ✓
│   └── CHK-06: Migration applies cleanly ✓
├── Technical Validation: PASSED (3/3 checks)
│   ├── TCK-01: Cursor-based pagination ✓
│   ├── TCK-02: Error handling middleware ✓
│   └── TCK-03: Database indexing strategy ✓
├── Scenario Acceptance: PASSED (4/4 scenarios)
│   ├── SCN-01: Create inventory record ✓
│   ├── SCN-02: Edit existing record ✓
│   ├── SCN-03: Search by date range ✓
│   └── SCN-04: Export filtered results ✓
└── Demo: Available (4 scenarios, 12 screenshots)
```

**Drill-down capability**: Click any check or scenario to see the evidence, the expected vs. observed outcome, and the timestamp. Click any failed item to see the remediation history (what feedback was provided, what was fixed).

### 9.5 Cross-Run Learning

Over time, verification outcomes feed back into the system's ability to produce better criteria:

- **Common failure patterns** inform criteria production prompts (e.g., "product scenarios frequently fail because they assume specific UI layouts" -> improve product step prompts to avoid layout assumptions)
- **Layer pass rates** inform retry budgets (e.g., "Technical Validation failures take an average of 1.5 retries to resolve" -> allocate 2 retries for that layer)
- **Demo quality ratings** from human feedback improve the demo agent's curation behavior
- **Criteria quality metrics** identify which steps produce criteria that are too vague, too numerous, or too tightly coupled to implementation details

---

## 10. Cross-Repo Impact Map

This section maps the conceptual framework to the current architecture surfaces that would be affected by eventual implementation. No code changes are prescribed — this provides a bridge from theory to future implementation tickets.

### 10.1 Server-Side Impacts (helix-global-server)

| Component | File(s) | Framework Element | Nature of Change |
|-----------|---------|------------------|-----------------|
| Product step config | `sandbox-runtime-assets/workflow-steps/product/step-config.mjs` | User Scenarios (SCN-XX) | Prompt change — add structured scenario output section |
| Tech-research step config | `sandbox-runtime-assets/workflow-steps/tech-research/step-config.mjs` | Technical Checks (TCK-XX) | Prompt change — add structured check output section |
| Implementation step config | `sandbox-runtime-assets/workflow-steps/implementation/step-config.mjs` | Enforced Inline Checks | Prompt change — mandate per-check outcome recording |
| Verification step config | `sandbox-runtime-assets/workflow-steps/verification/step-config.mjs` | Verification Cascade | Replace with per-layer cascade configs |
| New: Demo step config | New file | Demo agent | New step config for demo production |
| Step catalog | `src/helix-workflow/helix-workflow-step-catalog.ts` | Pipeline structure | Update step list (verification -> verification-cascade + demo) |
| Workflow step chain | `src/helix-workflow/orchestrator/workflow-step-chain.ts` | Cascade orchestration | Support per-layer verification flow and failure routing |
| Orchestrator | `src/helix-workflow/orchestrator.ts` | Run lifecycle | Handle per-layer outcomes, eliminate UNVERIFIED terminal state |
| Run store | `src/helix-workflow/orchestrator/run-store.ts` | State management | Support human-review state instead of UNVERIFIED terminal |
| Step executor types | `src/helix-workflow/step-executor/types.ts` | Result types | Add per-layer verification fields to step results |
| Database schema | `prisma/schema.prisma` | Per-layer storage | Evolve `verificationReport` JSON to support per-layer outcomes |

### 10.2 Client-Side Impacts (helix-global-client)

| Component | File(s) | Framework Element | Nature of Change |
|-----------|---------|------------------|-----------------|
| Workflow steps constant | `src/lib/format.ts` | Pipeline structure | Mirror updated step catalog |
| Verification report display | `src/components/run-history.tsx` | Per-layer verification | Show per-layer status instead of single outcome |
| Proof viewer | `src/components/proof-viewer.tsx` | Demo viewer | Evolve into scenario-organized demo display |
| Status badge | `src/components/status-badge.tsx` | New states | Add states for per-layer verification and human-review |
| Artifact overview | `src/components/ticket-artifacts-overview.tsx` | Per-step criteria | Display verification criteria per planning step |
| API types | `src/types/api.ts` | Type evolution | Add per-layer verification types, demo content types |
| New: Video player | New component | Video demo | Video playback with chapter navigation (future) |
| New: Verification dashboard | New component | Hierarchical view | Per-layer drill-down with check/scenario detail |

### 10.3 Database Impact

The current `SandboxRun.verificationReport` JSON field already provides flexibility for per-layer data. The evolution path:

| Field | Current Schema | Proposed Evolution |
|-------|---------------|-------------------|
| `verificationReport` | Single outcome + steps + details | Per-layer outcomes with criteria-level detail |
| `proofUrls` | Flat array of screenshot URLs | Demo-organized array with scenario tags and captions |
| `walkthroughData` | CodeTour JSON | Extended with scenario walkthrough data |
| New: `demoContent` | Does not exist | Structured demo artifact (scenario-organized) |

---

## 11. Future Considerations

The following topics are **deferred from this framework** and noted as future research or implementation scope:

| Topic | Why Deferred | Priority for Future |
|-------|-------------|-------------------|
| **Orchestrator implementation** | This ticket is conceptual; code changes are implementation scope | High — required for any deployment of the cascade model |
| **Step-config prompt engineering** | Specific prompt text for criteria production requires iteration | High — directly affects criteria quality |
| **Database migration design** | Per-layer verification field structure needs design based on cascade implementation | Medium — JSON fields provide interim flexibility |
| **Client component design** | UI mockups and component architecture for per-layer display | Medium — builds on existing ProofViewer and VerificationReportSection |
| **Video demo infrastructure** | Video recording, storage, and playback require new infrastructure | Low — organized screenshots are a sufficient initial format |
| **Automated scenario generation** | Auto-deriving product scenarios from ticket descriptions | Low — requires significant NLP/prompt engineering work |
| **Cross-run learning** | Verification outcomes feeding back into prompt quality | Low — requires accumulation of verification data first |
| **Full bidirectional routing** | Failures routing to any earlier step, not just implementation | Low — significant orchestrator redesign required |
| **Preview environment integration** | Scenario Acceptance running against preview deployment | Medium — preview-config step already exists as step 9 |
| **Enforcement of Inline Checks** | Mechanism to ensure implementation always records per-check outcomes | High — without enforcement, the trust model breaks down |

### 11.1 Risks

| # | Risk | Mitigation | Severity |
|---|------|-----------|----------|
| 1 | **Criteria bloat** — planning steps produce too many checks/scenarios, overwhelming the cascade | Guidelines: 5-15 product scenarios, 3-8 technical checks per ticket | Medium |
| 2 | **Pipeline latency** — three cascade layers + demo add time | Trust-but-verify reduces mechanical re-execution; demo can run in parallel with preview-config | Medium |
| 3 | **Product scenarios too abstract** — specified before implementation approach is known | Scenarios describe user outcomes, not implementation paths; this is a feature, but may require prompt tuning | Low |
| 4 | **Tech-research checks too vague** — narrative decisions don't translate to checkable criteria | TCK-XX format with explicit Verification Method field forces concreteness | Medium |
| 5 | **Feedback loop complexity** — per-layer routing requires significant orchestrator changes | Phased implementation: criteria production first (prompt-only), then cascade, then feedback loops | High |
| 6 | **NS scenarios limited** — runtime inspection may not cover all meaningful scenarios | Accept "platform-deferred" for visual scenarios; runtime inspection covers data and logic | Low |
| 7 | **Demo quality** — organized screenshots may not be substantially better than random | Demo agent uses product scenarios (SCN-XX) as organizational template; quality depends on prompt engineering | Medium |

---

## 12. Appendix: Current Architecture Evidence Summary

### 12.1 Pipeline Architecture

The Helix workflow pipeline consists of 9 sequential steps defined in `helix-workflow-step-catalog.ts`:

```
1. scout          → Codebase exploration and file mapping
2. diagnosis      → Root cause analysis
3. product        → Product specification
4. tech-research  → Technical framework and decisions
5. implementation-plan → Detailed implementation plan with Verification Plan
6. implementation → Code changes with Inline Checks
7. code-review    → Code quality review with Verification Impact Notes
8. verification   → Independent verification (quality + demo + walkthrough)
9. preview-config → Preview deployment configuration
```

### 12.2 Current Verification Data Flow

```
implementation-plan
    |
    | creates Verification Plan (CHK-XX)
    v
implementation
    |
    | self-verifies (Inline Checks)
    | records per-check outcomes
    v
code-review
    |
    | notes Verification Impact
    v
verification
    |
    | re-runs Verification Plan independently
    | captures proof screenshots as byproducts
    |
    ├── pass → SUCCEEDED
    ├── implementation_wrong → retry implementation (max 2)
    └── verification_broken → UNVERIFIED (terminal)
```

### 12.3 Key Files and Line References

| File | Key Lines | Relevance |
|------|-----------|-----------|
| `verification/step-config.mjs` | 114-132 | Verification Plan processing |
| `verification/step-config.mjs` | 59, 129, 139-143 | Proof screenshot capture |
| `verification/step-config.mjs` | 115 | Explicit distrust of implementation results |
| `verification/step-config.mjs` | 145-184 | Three outcomes (pass, implementation_wrong, verification_broken) |
| `implementation/step-config.mjs` | 174-185 | Self-verification against Verification Plan |
| `product/step-config.mjs` | 79 | Success Criteria output (unstructured) |
| `tech-research/step-config.mjs` | 66-77 | Architecture Decisions output (narrative) |
| `implementation-plan/step-config.mjs` | 104-140 | Verification Plan creation (CHK-XX) |
| `workflow-step-chain.ts` | 668 | MAX_VERIFICATION_RETRIES = 2 |
| `workflow-step-chain.ts` | 938-1041 | Implementation retry loop |
| `workflow-step-chain.ts` | 1044-1122 | UNVERIFIED terminal state |
| `orchestrator.ts` | 2038-2119 | UNVERIFIED outcome handling |
| `orchestrator.ts` | 2122-2124 | NS platform UNVERIFIED bypass |
| `run-store.ts` | 364-389 | markRunUnverified (terminal state setter) |
| `proof-viewer.tsx` | -- | Screenshot grid gallery |
| `run-history.tsx` | -- | VerificationReportSection (single outcome) |
| `format.ts` | -- | WORKFLOW_STEPS constant (mirrors server) |
| `prisma/schema.prisma` | -- | verificationReport, proofUrls, walkthroughData fields |

### 12.4 Evidence of Conflation

| Responsibility | Where It Happens | Evidence |
|---------------|-----------------|---------|
| Quality assurance | Verification step re-runs implementation's checks | `verification/step-config.mjs` lines 114-132 duplicate `implementation/step-config.mjs` lines 174-185 |
| Demo capture | Screenshots taken during check execution | `verification/step-config.mjs` lines 59, 129 — proof-*.png as side-effect |
| Scenario walkthrough | Browser interactions during verification | `verification/step-config.mjs` lines 81, 135 — agent-browser skill usage without scenario structure |
| Missing product input | No product scenarios consumed | No reference to product artifacts in verification step config |
| Missing tech-research input | No technical checks consumed | No reference to tech-research artifacts in verification step config |

---

## Methodology Note

This framework was developed by analyzing the current Helix pipeline architecture across four repositories (helix-global-server, helix-global-client, helix-cli, and the project-x-innovation-library), with direct code inspection of step configs, orchestrator logic, step execution types, client components, and database schema. Evidence citations reference specific files and line numbers from the helix-global-server codebase where the pipeline architecture is implemented.

The conceptual framework stays at the theoretical level per the ticket directive: "I don't need to talk about the implementation of how this is going to be done. Right now I'm working on the theory, I'm working on the concepts." Implementation details for the orchestrator, step configs, database migrations, and client components are deferred to subsequent implementation tickets.

## Attachments
- (none)

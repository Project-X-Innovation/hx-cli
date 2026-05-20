# Ticket Context

- ticket_id: cmpd9cj5v00bdfw0u18gdtun1
- short_id: HLX-513
- run_id: cmpd9cj6500bifw0un88zjz75
- run_branch: helix/auto/HLX-513-ticket-3d-orchestrator-needs-credentials
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Ticket 3D: Orchestrator — NEEDS_CREDENTIALS / IMPOSSIBLE_SPEC / NS Bypass Removal

## Description
Implement Ticket 3D from the RSH-473 Bill of Tickets (Phase 3, HIGH RISK). Edit src/helix-workflow/orchestrator.ts (~2100+ lines) and src/helix-workflow/orchestrator/ticket-service.ts. (1) NEEDS_CREDENTIALS handling: when chainOutcome === 'NEEDS_CREDENTIALS', post a comment to the ticket thread with a pre-filled credential form (repo name, env var names from justification, description); enter non-terminal pause; on Save and Resume, the requesting step restarts from the beginning (preserved via continuationContext). (2) IMPOSSIBLE_SPEC handling: when chainOutcome === 'IMPOSSIBLE_SPEC', call markRunImpossibleSpec with specDeviations and post completion comment with deviation summary; terminal for now. (3) Eliminate NS UNVERIFIED bypass at lines 2139-2141: remove the 'isNsPlatform && UNVERIFIED -> proceed to deploy' branch. NS runs now get Plan Adherence + Technical Validation + runtime-based Scenario Acceptance via the cascade. (4) Demo step nonBlocking: on demo failure log warning, set step status to FALLBACK, continue; run outcome unaffected. (5) Proof screenshot evolution: cascade captures evidence per layer; demo step captures curated, scenario-organized screenshots to demoContent. Prereqs: 3C, 1C. Success: typecheck passes; NS bypass code removed; NEEDS_CREDENTIALS form posted; IMPOSSIBLE_SPEC terminates with context; demo failure non-blocking. See RSH-473 'Ticket 3D'.

## Research Report

# Bill of Tickets: Layered Verification Architecture (The Sandwich Model)

**Ticket**: RSH-473 (Continuation)  
**Date**: 2026-05-18  
**Research Source**: RSH-445 (Conceptual Framework), RSH-473 (Build Specification)  
**Type**: Implementation Bill of Tickets  
**Repos**: helix-global-server (primary), helix-global-client (secondary)  

---

## 1. Executive Summary

The Helix workflow pipeline treats verification as a monolithic end-of-pipeline gate that conflates quality assurance, demo capture, and scenario acceptance into a single step with a single outcome. Production data proves this design wastes agent work at scale:

| Metric | Value | Source |
|--------|-------|--------|
| Total completed runs | 1,200 | Runtime inspection (2026-05-18) |
| SUCCEEDED | 757 (63.1%) | Runtime inspection |
| FAILED | 268 (22.3%) | Runtime inspection |
| **UNVERIFIED (terminal)** | **139 (11.6%)** | Runtime inspection |
| MERGED | 33 (2.8%) | Runtime inspection |
| verification_broken outcomes | 138 | Runtime inspection |
| implementation_wrong outcomes | 15 | Runtime inspection |
| verified outcomes | 670 | Runtime inspection |
| UNVERIFIED runs with verification_broken | 125 (89.9% of UNVERIFIED) | Runtime inspection |
| UNVERIFIED runs with implementation_wrong | 14 (10.1% of UNVERIFIED) | Runtime inspection |
| Tickets stuck in UNVERIFIED | 16 | Runtime inspection |
| Agent-resolvable UNVERIFIED (estimated) | ~82% (~114 of 139) | Failure category analysis |

**The core problem**: 89.9% of UNVERIFIED runs (125 of 139) are `verification_broken` -- infrastructure and tooling failures that receive **zero retries** before the pipeline permanently abandons them (`workflow-step-chain.ts` line 1044). The agent gives up on problems it could resolve.

**The fix**: Replace the monolithic verification gate with a **layered verification architecture** (the "sandwich model") built on three principles:

1. **The agent resolves failures -- diligently, not negligently.** Every failure the agent can address gets per-layer retries with a strategy catalog requiring demonstrably different approaches. ~82% of current UNVERIFIED runs (~114 of 139) are agent-resolvable.

2. **Four distinct outcomes, no ambiguity.** SUCCEEDED (agent resolved), FAILED (system error), NEEDS_CREDENTIALS (sole human-pause: missing credentials/env vars), and IMPOSSIBLE_SPEC (spec unachievable -- phased out later). No catch-all UNVERIFIED for new runs.

3. **Demo is storytelling, verification is quality.** Separate concerns, separate agents, separate outputs, separate steps.

This report defines **13 implementation tickets** across **4 dependency-ordered phases** spanning **~14 server files** and **~10 client files** to build this architecture.

---

## 2. Architecture Overview: The Sandwich Model

The sandwich model restructures verification from a single terminal gate into a four-layer architecture where quality is distributed across the pipeline:

```
FORWARD PASS (Planning)               REVERSE PASS (Verification)
========================               ============================

    Product                                Scenario Acceptance
       |   produces SCN-XX                     ^   validates SCN-XX
       v                                       |
    Tech-Research                          Technical Validation
       |   produces TCK-XX                     ^   validates TCK-XX
       v                                       |
    Implementation-Plan                    Plan Adherence
       |   produces CHK-XX                     ^   validates CHK-XX
       v                                       |
    Implementation ────────────────────────────┘
       (builds + records Inline Check outcomes)

                                           ┌──────────┐
                                           │   Demo   │  (Presentation Pass)
                                           └──────────┘
                                           Separate from verification
                                           Non-blocking, user-facing
```

### Layer 1: Criteria Production (Forward Pass)

Each planning step produces structured, ID-tagged verification criteria alongside its existing output:

| Planning Step | Current Output | New Verification Output | ID Format | Count Guideline |
|--------------|---------------|------------------------|-----------|----------------|
| **Product** | Success Criteria (unstructured prose) | User Scenarios | SCN-XX | 5-15 per ticket |
| **Tech-Research** | Technical Decisions (narrative) | Technical Checks | TCK-XX | 3-8 per ticket |
| **Implementation-Plan** | Required Checks (already structured) | Required Checks (unchanged) | CHK-XX | As needed |

### Layer 2: Inline Quality (Implementation)

Implementation self-verification becomes **enforced, not advisory**. The implementation step records an explicit outcome (pass / fail / blocked) for every CHK-XX. These outcomes become the trusted baseline for Plan Adherence.

### Layer 3: Verification Cascade (Reverse Pass)

After implementation and code-review, verification cascades through three layers within a single step:

| Layer | Validates | Trust Model | Retry Budget |
|-------|-----------|-------------|-------------|
| **Plan Adherence (3a)** | CHK-XX | Trust mechanical self-reports; independently verify behavioral | 3 retries |
| **Technical Validation (3b)** | TCK-XX | Cannot be self-verified; domain comparison against tech decisions | 2 retries |
| **Scenario Acceptance (3c)** | SCN-XX | Highest-abstraction; requires live environment or runtime inspection | 2 retries |

**Early-exit**: Failure at an earlier layer prevents later layers from running.

### Layer 4: Demo (Presentation Pass)

A dedicated demo agent runs as **step 10** (after preview-config). Non-blocking -- failure does not affect run outcome. Produces scenario-organized screenshots grouped by SCN-XX with captions.

---

## 3. The Four-Outcome Verification Model

This is the central design decision of the entire architecture. Every verification failure resolves to exactly one of four outcomes. No ambiguous intermediate states, no escape hatches.

| Outcome | When | Resolution | Terminal? |
|---------|------|------------|-----------|
| **Agent Resolves (SUCCEEDED)** | Env/infrastructure, tooling, code defects, model config, spec ambiguity, flawed tech decisions, ill-specified scenarios | Agent uses strategy catalog with per-layer retries; each retry uses a different strategy | No |
| **FAILED** (system error) | Billing/quota exhaustion, network-inaccessible dependency | Pipeline marks FAILED with actionable error | Yes |
| **NEEDS_CREDENTIALS** (human-pause) | Missing new env vars/credentials, missing test environment | Pause run; pre-filled form; requesting step restarts on resume | No -- resumes |
| **IMPOSSIBLE_SPEC** (phased out later) | Spec fundamentally unachievable even after best effort | Agent documents what's impossible and why; terminal with full context | Yes -- phased out when backward-branching implemented |

### Why Not NEEDS_REVIEW

The original research report (RSH-445) proposed `NEEDS_REVIEW` for billing, network, and spec conflicts. The user explicitly rejected this:

> *"In the first two cases, billing or network dependency, those are errors. Those are not needs review."* (ticket.md line 893)

> *"I wouldn't call it 'needs review'. I would just call it 'needs credentials'."* (ticket.md line 948)

### Why IMPOSSIBLE_SPEC Is a Distinct Status

The user's continuation context elevates impossible specs from a sub-case of Agent Resolves to a distinct fourth outcome:

> *"You can have a third status, 'impossible spec', for verification. If you get to the end and you see that it's actually impossible, you can throw in an 'impossible spec' verification at this point, which will be phased out later."*

IMPOSSIBLE_SPEC communicates a fundamentally different situation than FAILED (system error) or SUCCEEDED-with-deviations (agent mostly achieved intent). It enables the phased introduction of backward-branching routing.

### Exhaustive Failure-to-Outcome Mapping

Every production failure category is assigned to exactly one outcome:

| # | Failure Category | Production Count | Outcome | Resolution |
|---|-----------------|-----------------|---------|------------|
| 1 | Env/infrastructure (missing deps, ports, .env, migrations) | 55 (40.7%) | **Agent Resolves** | Fix env, create data, run migrations |
| 2 | Tooling/browser failures | 39 (28.9%) | **Agent Resolves** | Different tooling approach, CLI fallback |
| 3 | External DB unreachable | 15 (11.1%) | **FAILED** | System error |
| 4 | Code defects (implementation_wrong) | 14 (10.4%) | **Agent Resolves** | Route to implementation with details |
| 5 | Billing/quota exhausted | 7 (5.2%) | **FAILED** | System error |
| 6 | Model config errors | 5 (3.7%) | **Agent Resolves** | Auto-fallback to default model |
| 7 | Spec conflicts / ambiguity | N/A | **Agent Resolves** | Agent interprets from context |
| 8 | Flawed tech-research decisions | N/A | **Agent Resolves** | Agent re-evaluates |
| 9 | Ill-specified product scenarios | N/A | **Agent Resolves** | Agent re-interprets at correct abstraction |
| 10 | Impossible/wrong spec (fundamentally unachievable) | N/A | **IMPOSSIBLE_SPEC** | Best effort + document impossibility |
| 11 | Resources agent already has | N/A | **Agent Resolves** | Agent uses them -- never escalates |

**Bottom line**: Only categories 3 and 5 (~22 runs, ~16% of UNVERIFIED) produce FAILED. Category 10 produces IMPOSSIBLE_SPEC. All others (~82%) are agent-resolved. NEEDS_CREDENTIALS only triggers for genuinely missing new credentials or test environments -- none of the 11 categories above.

---

## 4. Scenario Acceptance Deep Dive

The user flagged Scenario Acceptance as "really important and also a little ambiguous." This section resolves all ambiguity through 7 concrete sub-topics.

### 4.1 What SA Does Per Scenario

For each product-defined User Scenario (SCN-XX), the verification agent:

1. **Sets up** or navigates to the Precondition state
2. **Performs** the Action as described in the scenario
3. **Observes** what actually happened
4. **Compares** the observation against the Expected Outcome
5. **Records** structured evidence:
```json
{
  "scenarioId": "SCN-01",
  "outcome": "pass",
  "observedBehavior": "POST /api/records returned 201 with { id: 42 }. New record visible in list view.",
  "evidence": ["screenshot-scn01-list.png", "api-response-201.json"]
}
```

### 4.2 Pass Criteria Rigor

A scenario passes when the Expected Outcome is observably met with **specific evidence**. Vague assessments are not acceptable.

| Acceptable Evidence | Unacceptable |
|---------------------|-------------|
| "SCN-01: POST /api/records returned 201 with `{ id: 42 }`. Screenshot shows record in list view." | "I looked at the page and it seemed fine." |
| Screenshot showing expected UI state with key elements annotated | "The feature appears to work." |
| API response matching expected shape and data values | "I verified the endpoint." |
| SuiteQL query result confirming data state (NetSuite) | "The record was created." |
| Log entry confirming expected behavior with timestamp | "Logs look clean." |

**Principle**: If you can't point to a specific observable artifact as evidence, the scenario is not verified. "It seemed fine" is never sufficient.

### 4.3 Environment Target

Scenario Acceptance runs within the **verification step (step 8)**, against the **dev server (localhost)**. This is a critical constraint:

- Preview deployment does not exist yet -- `preview-config` is step 9
- Demo (step 10) uses the preview URL
- SA operates within the single verification step, consistent with the cascade-within-step architecture (AD-1)

This means SA has access to the development environment started during verification, not a production-like preview. The dev server is sufficient for confirming user scenarios work end-to-end.

### 4.4 Platform-Deferred Counting

When some scenarios cannot be verified on a specific platform (e.g., visual-only scenarios on NetSuite):

- If 2 of 5 scenarios are platform-deferred, SA reports on **3 applicable scenarios only**
- Platform-deferred scenarios are **noted** for human awareness with reason and alternative evidence
- Platform-deferred scenarios **do not count** against pass/fail calculation
- The overall SA outcome is based on applicable scenarios only

Example:
```
Scenario Acceptance: PASSED (3/3 applicable; 2 platform-deferred)
  [SCN-01] Create record           -> PASSED (SuiteQL confirms record exists)
  [SCN-02] Edit record             -> PASSED (SuiteQL confirms updated values)
  [SCN-03] Search by date          -> PASSED (SuiteQL query returns expected results)
  [SCN-04] Verify form layout      -> PLATFORM-DEFERRED (requires visual UI access)
  [SCN-05] Confirm field placement -> PLATFORM-DEFERRED (requires visual UI access)
```

### 4.5 NetSuite Scenario Acceptance

For NetSuite, runtime inspection replaces browser-based UI walks:

| Method | What It Verifies | Example |
|--------|-----------------|---------|
| **SuiteQL queries** | Records created, fields have correct values, relationships intact | `SELECT id, name, status FROM customrecord_foo WHERE name = 'Test Record'` |
| **Script deployment verification** | Scripts deployed to correct records, triggers configured | Check deployment XML for record type bindings |
| **Log checks** | Expected log entries appear (or problematic entries do not) | Search execution logs for expected entries |
| **API calls** | RESTlet or SuiteTalk endpoints return correct response shapes | POST to RESTlet, verify JSON shape |
| **Workflow verification** | Workflow states transition correctly | SuiteQL on workflow instance records |

This provides **real verification** where currently there is **none** (NetSuite runs bypass verification entirely via `orchestrator.ts` lines 2139-2141).

### 4.6 SA vs IMPOSSIBLE_SPEC Boundary

When a scenario appears impossible as written, the agent follows this decision tree:

1. **Re-interpret first** (Agent Resolves): If the scenario's core intent can be achieved through an alternative approach, the agent re-interprets at the correct abstraction level and proceeds. Most scenarios that look impossible are actually achievable once the agent starts working.

2. **Individual platform-deferred** (PLATFORM-DEFERRED): If a scenario is impossible only because the current platform lacks visual UI access (e.g., NetSuite), it is marked platform-deferred -- not IMPOSSIBLE_SPEC. Visual UI testing is coming separately.

3. **IMPOSSIBLE_SPEC** (last resort): Only if the scenario's **core intent** is fundamentally unachievable in the target environment after best-effort attempt -- e.g., "Requested API does not exist in SuiteScript 2.1 and no equivalent exists."

**Key distinction**: A single impossible scenario does not necessarily make the entire run IMPOSSIBLE_SPEC. The cascade evaluates whether the impossible scenarios represent the core intent or peripheral requirements:
- Core intent unachievable -> IMPOSSIBLE_SPEC
- Peripheral scenarios impossible but core intent achieved -> SUCCEEDED with spec deviations documented

### 4.7 SA Evidence Specification

Each scenario produces a structured record:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scenarioId` | string | Yes | SCN-XX identifier |
| `outcome` | enum | Yes | `pass`, `fail`, `platform_deferred` |
| `observedBehavior` | string | Yes | What actually happened (specific, verifiable) |
| `evidence` | string[] | Yes for pass/fail | Artifact references: screenshot paths, API responses, query results |
| `platformDeferredReason` | string | If deferred | Why this scenario cannot be verified on this platform |
| `alternativeEvidence` | string | If deferred | Best available evidence short of full verification |

The verification output includes all scenario records in the `scenarioAcceptance.scenarios` array within `verificationCascade`.

---

## 5. NEEDS_CREDENTIALS: Exhaustive Specification

NEEDS_CREDENTIALS is the **sole human-pause state** in the four-outcome model. It has exactly two triggers and an exhaustive exclusion table.

### 5.1 The Two Triggers (Exhaustive)

Both triggers collapse to the same abstraction: **the agent needs an environment or resource it cannot self-provision.**

#### Trigger 1: Standard -- Missing New Credential/Env Var

**When**: Agent discovers a new external integration requires env vars/credentials not present in the repo's dev environment.

**Detection point**: Tech-research or early planning (credentials should surface early, not late).

**Agent action**: Pause the run and post a pre-filled form to the ticket thread.

**Human action**: Enter the dev credential value. Hit **Save and Resume**.

**Resume behavior**: The **requesting step restarts from the beginning** -- it needed those credentials to finish its own work.

> *"I think whoever asks for the credentials has to now finish the run so you would restart that step."* (ticket.md line 1058)

#### Trigger 2: Rare -- No Test Environment for Production-Only Integration

**When**: Production-only integration has no sandbox. Credentials will never exist.

**Detection**: Agent pauses and asks; human responds "we don't have a test environment." Agent never guesses.

**Agent action**: Complete all code work. Run Plan Adherence and Technical Validation fully (code-level, no credentials needed). Produce structured manual walkthrough.

**Human action**: Review walkthrough. Manually verify. Continue.

> *"In a rare case where we cannot get a test environment, that's the rare case."* (ticket.md line 941)

### 5.2 Credential Form Flow (Step-by-Step)

Per user direction (ticket.md lines 1038-1068):

1. Whichever step (typically tech-research) detects the missing credential **pauses** the run
2. Step posts a **pre-filled comment form** to the ticket thread
3. Form title: **"Needs Dev Credential"** -- never production credentials
4. **Repo name** is pre-filled (auto-populated from step context)
5. **Env var name** is pre-filled (agent knows what variable is needed)
6. **Description** explains what the variable is for
7. Human enters only the **dev credential value**
8. Human hits **Save and Resume** -> requesting step **restarts from the beginning**
9. Alternative: human saves credentials via normal flow and hits **Continue** manually for more review time

### 5.3 Early Detection Principle

> *"Where it's a new credential, it should be requested in either the product or tech research... If there's a new credential that's required, the tech research would already have experimented with it so it should be in that stage already."* (ticket.md line 1007)

Credentials should surface during **tech-research** (which experiments with integrations), not at verification. If credentials appear late:

| Discovery Point | Implication |
|----------------|-------------|
| Tech-research | Ideal -- human provisions before implementation starts |
| Implementation | Still early enough to pause and request |
| Verification | Late signal: tech-research didn't actually try it -> likely the "no test environment" sub-case |

**Late-appearing credentials at verification are a strong signal the credentials don't exist** and the agent should produce a manual walkthrough, not pause and wait.

### 5.4 What Is NOT NEEDS_CREDENTIALS (Exhaustive)

These 11 categories are **never** NEEDS_CREDENTIALS. Every one has a defined resolution path:

| # | Category | Production Count | User Quote | Correct Resolution |
|---|----------|-----------------|------------|-------------------|
| 1 | **Billing/quota exhaustion** | 7 (5.2%) | "Those are errors. Those are not needs review." (line 893) | **FAILED** with actionable error |
| 2 | **Network-inaccessible dependency** | 15 (11.1%) | "In the second one there's a network error." (line 893) | **FAILED** with diagnostic details |
| 3 | **Env/infrastructure agent can fix** | 55 (40.7%) | "It needs to know that it has a dev database." (line 926) | **Agent resolves**: fix deps, create .env, run migrations |
| 4 | **Tooling/browser failures** | 39 (28.9%) | Multiple approaches available | **Agent resolves**: agent-browser CLI, curl, simplified flow |
| 5 | **Code defects** | 14 (10.4%) | Standard implementation work | **Agent resolves**: route to implementation with details |
| 6 | **Model config errors** | 5 (3.7%) | Auto-fixable | **Agent auto-resolves**: fallback to default model |
| 7 | **Spec conflicts / ambiguity** | N/A | Agent interprets from context | **Agent resolves**: choose best interpretation |
| 8 | **Flawed tech-research decisions** | N/A | Agent re-evaluates | **Agent resolves**: provide revised guidance |
| 9 | **Ill-specified product scenarios** | N/A | Agent clarifies from context | **Agent resolves**: re-interpret at correct abstraction |
| 10 | **Impossible/wrong spec** | N/A | "Do your best case because you might find that it's actually possible once you start." (line 1034) | **IMPOSSIBLE_SPEC** (after best effort) |
| 11 | **Resources agent already has** | N/A | "It needs to know that it can do anything that it has access to in the system itself." (line 926) | **Agent uses them** -- never escalates |

### 5.5 Three-Layer Enforcement

NEEDS_CREDENTIALS is restricted to prevent misuse:

1. **Prompt-level** (primary): Verification step-config.mjs prompt embeds the exhaustive IS/IS NOT table. Agent sees exactly what qualifies.
2. **Type-level** (structural): `needsCredentialsJustification` requires structured `envVars` array (name, repo, description) and `subCase` enum (`missing_credential` | `no_test_environment`). Cannot produce vague justifications.
3. **Orchestrator-level** (validation): `workflow-step-chain.ts` validates justification structure before accepting NEEDS_CREDENTIALS.

---

## 6. IMPOSSIBLE_SPEC: Exhaustive Specification

IMPOSSIBLE_SPEC is a **distinct terminal status** indicating the specification from product or tech-research was fundamentally unachievable. It is designed to be **phased out** when backward-branching routing enables re-routing to earlier steps for spec revision.

### 6.1 When IMPOSSIBLE_SPEC Is Returned

The agent **always attempts best-effort first**:

> *"Let go, do your best case because you might find that it's actually possible once you start."* (ticket.md line 1034)

IMPOSSIBLE_SPEC is returned **only** when the verification cascade determines the best-effort result is so far from the specification that it cannot meaningfully be called "implemented." This is a high bar.

### 6.2 The Three-Way Boundary Distinction

| Outcome | Condition | Example |
|---------|-----------|---------|
| **SUCCEEDED** (with deviations) | Agent mostly achieved the intent but documented minor gaps | "Used alternative API method; same user outcome achieved" |
| **IMPOSSIBLE_SPEC** | Core intent fundamentally unachievable in the target environment | "Requested API does not exist in SuiteScript 2.1 and no equivalent exists" |
| **FAILED** | System error prevented any meaningful attempt | "Credit balance too low to run implementation" |

**Key distinction**: SUCCEEDED-with-deviations means the agent found a way. IMPOSSIBLE_SPEC means the way doesn't exist. FAILED means the system blocked any attempt.

### 6.3 Agent Behavior

1. Agent receives product scenarios and tech-research decisions
2. Agent implements as close to spec as possible
3. If something looks impossible, agent **tries anyway** -- many things become achievable during implementation
4. If best-effort result fundamentally misses core intent:
   - Agent documents what's impossible and why
   - Agent documents what best-effort was achieved
   - Cascade returns IMPOSSIBLE_SPEC with `specDeviations` output

### 6.4 specDeviations Output Structure

```json
{
  "specDeviations": {
    "impossibleItems": [
      {
        "criterion": "SCN-03",
        "reason": "SuiteScript 2.1 has no equivalent to requested browser API",
        "bestEffortResult": "Implemented closest alternative using N/record module"
      }
    ],
    "isFullyImpossible": false
  }
}
```

- `isFullyImpossible: true` = nothing meaningful achieved; entire spec was unachievable
- `isFullyImpossible: false` = partial achievement but core gap exists

### 6.5 IMPOSSIBLE_SPEC Is Terminal (For Now)

IMPOSSIBLE_SPEC is terminal -- the run ends with full context for the ticket author. When backward-branching routing is implemented (future ticket), IMPOSSIBLE_SPEC will re-route to tech-research or product for spec revision, making it non-terminal. This is the phase-out path.

### 6.6 Interaction with Cascade Layers

IMPOSSIBLE_SPEC can surface at any cascade layer:

| Layer | Impossible Condition | Outcome |
|-------|---------------------|---------|
| Plan Adherence | Required check fundamentally unachievable | Rare -- CHK-XX are implementation-level |
| Technical Validation | Tech decision references non-existent capability | Agent re-evaluates first; IMPOSSIBLE_SPEC if core |
| Scenario Acceptance | User scenario's core intent unachievable | Agent re-interprets first; IMPOSSIBLE_SPEC if core |

**Individual vs. run-level**: A single impossible item at SA does not necessarily make the run IMPOSSIBLE_SPEC. The cascade evaluates severity -- is this the core intent or a peripheral requirement?

### 6.7 Prisma and Code Requirements

- `SandboxRunStatus` enum: add `IMPOSSIBLE_SPEC`
- `TicketStatus` enum: add `IMPOSSIBLE_SPEC`
- `HelixWorkflowStepStatus` union: add `"IMPOSSIBLE_SPEC"`
- `chainOutcome` union: add `'IMPOSSIBLE_SPEC'`
- `verificationResult` enum: add `'impossible_spec'`
- New `markRunImpossibleSpec` function in `run-store.ts` (follows `markRunUnverified` atomic pattern)
- `specDeviations` field in verification output schema

---

## 7. Bill of Tickets

### Phase 1: Foundation (3 Tickets)

Foundation tickets establish the type system, database schema, and state management that all subsequent phases depend on.

---

#### Ticket 1A: Prisma Schema + Migration

**Scope**: Add NEEDS_CREDENTIALS and IMPOSSIBLE_SPEC to both Prisma enums; add `demoContent` column.

**Repo**: helix-global-server

**Files**:
- `prisma/schema.prisma` -- Add enum values
- `prisma/migrations/YYYYMMDD_add_verification_statuses_and_demo_content/` -- Generated migration

**Changes**:
1. `SandboxRunStatus` enum (line ~10): add `NEEDS_CREDENTIALS`, `IMPOSSIBLE_SPEC`
2. `TicketStatus` enum (line ~22): add `NEEDS_CREDENTIALS`, `IMPOSSIBLE_SPEC`
3. `SandboxRun` model: add `demoContent Json?` column

**Migration command**:
```bash
npx prisma migrate dev --name add_verification_statuses_and_demo_content
```

**SQL generated**: `ALTER TYPE "SandboxRunStatus" ADD VALUE 'NEEDS_CREDENTIALS'; ALTER TYPE "SandboxRunStatus" ADD VALUE 'IMPOSSIBLE_SPEC';` (and parallel for TicketStatus). `ALTER TYPE ADD VALUE` is non-destructive for PostgreSQL enums -- existing values are not affected.

**Prerequisites**: None -- this is the foundation.

**Success criteria**:
- Migration generated and applies cleanly
- `npx prisma migrate status` shows no pending migrations
- `npx prisma generate` regenerates client
- `npm run build` passes

---

#### Ticket 1B: TypeScript Type Foundation

**Scope**: Extend step-executor types with new statuses and cascade structures.

**Repo**: helix-global-server

**Files**:
- `src/helix-workflow/step-executor/types.ts` -- Extend status union, add cascade types

**Changes**:
1. `HelixWorkflowStepStatus` union (line ~5): add `"NEEDS_CREDENTIALS"` and `"IMPOSSIBLE_SPEC"` (5 -> 7 values)
2. New types:
   - `CascadeLayerResult`: `{ status: 'pass'|'fail'|'skipped', checks/scenarios: Array<{id, status, evidence}> }`
   - `VerificationCascade`: `{ planAdherence: CascadeLayerResult, technicalValidation: CascadeLayerResult, scenarioAcceptance: CascadeLayerResult }`
   - `NeedsCredentialsJustification`: `{ envVars: Array<{name, repo, description}>, subCase: 'missing_credential'|'no_test_environment', manualWalkthrough?: string }`
   - `SpecDeviations`: `{ impossibleItems: Array<{criterion, reason, bestEffortResult}>, isFullyImpossible: boolean }`
3. Optional cascade fields on `HelixWorkflowStepResult`:
   - `verificationCascade?: VerificationCascade`
   - `needsCredentialsJustification?: NeedsCredentialsJustification`
   - `specDeviations?: SpecDeviations`
   - `attemptedStrategies?: Array<{layer, strategy, outcome}>`

**Prerequisites**: 1A (Prisma client regeneration for enum alignment)

**Success criteria**:
- `npm run typecheck` passes
- New types importable from `types.ts`
- No breaking changes to existing HelixWorkflowStepResult consumers

---

#### Ticket 1C: Step Catalog + Run Store

**Scope**: Add demo step to pipeline catalog; add new state persistence functions.

**Repo**: helix-global-server

**Files**:
- `src/helix-workflow/helix-workflow-step-catalog.ts` -- Add demo step ID, nonBlocking field
- `src/helix-workflow/orchestrator/run-store.ts` -- Add markRunNeedsCredentials, markRunImpossibleSpec

**Changes**:

Step catalog:
1. `HelixWorkflowStepId` union: add `"demo"`
2. `HelixWorkflowStep` type: add optional `nonBlocking?: boolean` field
3. `HELIX_WORKFLOW_STEPS` array: new entry `{ id: "demo", title: "Demo", nonBlocking: true, producesRepoArtifacts: false }`

Run store:
1. `markRunNeedsCredentials()`: follows `markRunUnverified` atomic pattern (lines 364-389). Atomically sets both SandboxRun and Ticket status to `NEEDS_CREDENTIALS`. Stores `needsCredentialsJustification` in verificationReport JSON.
2. `markRunImpossibleSpec()`: follows same pattern. Sets both to `IMPOSSIBLE_SPEC`. Stores `specDeviations` in verificationReport JSON.

**Prerequisites**: 1A (enum values), 1B (types)

**Success criteria**:
- `npm run typecheck` passes
- New functions exist and reference correct Prisma enum values
- Demo step appears in `HELIX_WORKFLOW_STEPS`

---

### Phase 2: Criteria Production (3 Tickets)

Criteria production tickets are **prompt-only changes** (no TypeScript). They modify step-config.mjs files to produce structured verification criteria. These can **partially parallelize** with Phase 1 since step-config files have no TypeScript dependency.

---

#### Ticket 2A: Product Step -- User Scenarios (SCN-XX)

**Scope**: Add structured User Scenarios output to the product step-config prompt.

**Repo**: helix-global-server

**Files**:
- `sandbox-runtime-assets/workflow-steps/product/step-config.mjs` -- Prompt change

**Changes**:
Add a "User Scenarios" output section alongside existing "Success Criteria" (around line 79).

**Format specification**:
```
## User Scenarios

[SCN-01] Create a new inventory record
- Precondition: User is logged in and on the inventory page
- Action: User fills out the new record form and submits it
- Expected Outcome: The new record appears in the inventory list view
  with all entered field values displayed correctly
```

**Mandatory fields per scenario**:
| Field | Description |
|-------|-------------|
| **ID** | Stable identifier (SCN-01, SCN-02, ...) |
| **Title** | Brief scenario name |
| **Precondition** | What must be true before the scenario starts |
| **Action** | What the user does (user-level, not implementation-level) |
| **Expected Outcome** | What the user observes when the scenario succeeds |

**Guidelines embedded in prompt**:
- 5-15 scenarios per ticket (fewer for simple changes, more for complex features)
- Scenarios describe WHAT, not HOW -- must remain valid regardless of implementation approach
- Platform-agnostic: verifiable on web (browser), NetSuite (runtime inspection), or any future platform
- Each scenario maps to a distinct user capability, not a technical checkpoint

**Prerequisites**: None (prompt-only)

**Success criteria**: step-config.mjs contains SCN-XX format specification with all mandatory fields and guidelines.

---

#### Ticket 2B: Tech-Research Step -- Technical Checks (TCK-XX)

**Scope**: Add structured Technical Checks output to the tech-research step-config prompt.

**Repo**: helix-global-server

**Files**:
- `sandbox-runtime-assets/workflow-steps/tech-research/step-config.mjs` -- Prompt change

**Changes**:
Add a "Technical Checks" section alongside existing "Architecture Decisions" (around lines 66-77).

**Format specification**:
```
## Technical Checks

[TCK-01] API pagination implementation
- Decision Reference: "Use cursor-based pagination for all list endpoints"
  (from Architecture Decision 3)
- Verification Method: code-inspection
- Expected Evidence: List endpoint handlers use cursor parameters,
  not offset/limit. Response includes nextCursor field.
```

**Mandatory fields per check**:
| Field | Description |
|-------|-------------|
| **ID** | Stable identifier (TCK-01, TCK-02, ...) |
| **Title** | Brief check name |
| **Decision Reference** | Which architecture decision this validates, with decision text |
| **Verification Method** | `code-inspection` (static analysis) or `behavioral` (runtime observation) |
| **Expected Evidence** | What verifier should observe if decision correctly implemented |

**Guidelines embedded in prompt**:
- 3-8 checks per ticket (focus on most impactful decisions)
- Each check references a specific decision from tech-research output
- Not every decision needs a check -- focus on decisions where incorrect implementation causes quality/architectural problems

**Prerequisites**: None (prompt-only)

**Success criteria**: step-config.mjs contains TCK-XX format specification with all mandatory fields.

---

#### Ticket 2C: Implementation Step -- Enforced Inline Checks + specDeviation

**Scope**: Make per-check outcome recording mandatory; add spec deviation section.

**Repo**: helix-global-server

**Files**:
- `sandbox-runtime-assets/workflow-steps/implementation/step-config.mjs` -- Prompt change

**Changes**:
1. **Enforce Inline Check recording**: Currently advisory at lines 174-185. Change to mandate explicit `pass` / `fail` / `blocked` per CHK-XX in `implementation-actual.md`. Every CHK-XX must have a recorded outcome -- no silent omissions.

2. **Add specDeviation section**: For cases where the specification (product scenarios or tech-research decisions) couldn't be fully achieved. Agent always attempts best-effort first, then documents deviations:
   ```
   ## Spec Deviations
   - [SCN-03]: SuiteScript 2.1 lacks browser API equivalent. Implemented 
     closest alternative using N/record module. Core user workflow preserved.
   ```

**Prerequisites**: None (prompt-only)

**Success criteria**: step-config.mjs mandates per-check outcomes with no silent omissions and includes specDeviation instructions.

---

### Phase 3: Cascade + Demo + Orchestrator (4 Tickets)

Core system tickets implementing the verification cascade, demo step, and orchestrator routing. These are the highest-complexity changes.

---

#### Ticket 3A: Verification Step Config -- 3-Layer Internal Cascade

**Scope**: Restructure the verification step-config for Plan Adherence -> Technical Validation -> Scenario Acceptance cascade.

**Repo**: helix-global-server

**Files**:
- `sandbox-runtime-assets/workflow-steps/verification/step-config.mjs` (316 lines, major restructure)

**Changes**:

1. **Per-layer cascade execution logic**:
   - **Plan Adherence**: Read CHK-XX from implementation-plan.md. Cross-reference implementation-actual.md Inline Check outcomes. Trust self-reported mechanical checks (build, types). Independently verify behavioral checks. Exit early if failed.
   - **Technical Validation**: Read TCK-XX from tech-research.md. Code-inspect implementation against each technical decision. Exit early if failed.
   - **Scenario Acceptance**: Read SCN-XX from product.md. Walk through each scenario in dev environment (web: browser; NS: runtime inspection). Record per-scenario structured evidence per Section 4.7 spec.

2. **Strategy catalog** (embedded in prompt): Production-frequency-ordered table of failure types and strategies. Agent must consult `previousAttemptedStrategies` in continuationContext before choosing approach. Same strategy twice is not valid.

3. **Cascade output schema**:
   ```
   verificationResult: enum ["pass", "implementation_wrong", "verification_broken",
                             "needs_credentials", "impossible_spec"]
   verificationCascade: {
     planAdherence:       { status, checks: [{id, status, evidence}] }
     technicalValidation: { status, checks: [{id, status, evidence}] }
     scenarioAcceptance:  { status, scenarios: [{id, status, evidence, ...}] }
   }
   failedLayer: "plan_adherence"|"technical_validation"|"scenario_acceptance"|null
   attemptedStrategies: [{layer, strategy, outcome}]
   needsCredentialsJustification: { envVars, subCase } | null
   specDeviations: { impossibleItems, isFullyImpossible } | null
   ```

4. **NEEDS_CREDENTIALS boundary enforcement**: Full IS/IS NOT table embedded in prompt. Agent sees exactly what qualifies and what doesn't.

5. **IMPOSSIBLE_SPEC criteria**: Boundary between SUCCEEDED-with-deviations and IMPOSSIBLE_SPEC with three-way examples. Agent always attempts best-effort first.

6. **SA evidence requirements**: Per Section 4.2 -- specific, verifiable evidence. "It seemed fine" explicitly listed as unacceptable.

**Prerequisites**: 2A (SCN-XX format), 2B (TCK-XX format), 2C (enforced CHK-XX), 1B (types for output schema)

**Success criteria**:
- step-config.mjs executes 3 cascade layers in order with early-exit
- Output schema includes all cascade fields
- Strategy catalog present with production-frequency ordering
- NEEDS_CREDENTIALS IS/IS NOT table present
- IMPOSSIBLE_SPEC boundary criteria defined with examples
- SA evidence requirements specify acceptable vs. unacceptable evidence

---

#### Ticket 3B: Demo Step Config (New)

**Scope**: New demo agent step config for step 10.

**Repo**: helix-global-server

**Files**:
- `sandbox-runtime-assets/workflow-steps/demo/step-config.mjs` (NEW)
- `sandbox-runtime-assets/workflow-steps/index.mjs` (route demo step)

**Changes**:

1. **New step-config.mjs**: Demo agent reads SCN-XX from product.md as organizational template. For each scenario:
   - Navigate to scenario context in preview environment
   - Capture intentional screenshots showing the scenario in action
   - Write descriptive captions explaining what each screenshot shows

2. **Output schema**:
   ```json
   {
     "demoContent": {
       "scenarios": [
         {
           "id": "SCN-01",
           "title": "Create a new inventory record",
           "screenshots": [
             { "url": "blob-url", "caption": "List view before action" },
             { "url": "blob-url", "caption": "New record visible after submission" }
           ]
         }
       ]
     }
   }
   ```

3. **Non-blocking semantics**: Explicitly documented in step-config that demo failure does not affect run outcome.

4. **Index routing**: `index.mjs` gains demo step resolution.

**Prerequisites**: 1C (demo in step catalog), 2A (SCN-XX format)

**Success criteria**: New step-config.mjs file exists. Output schema defined. Non-blocking semantics documented.

---

#### Ticket 3C: Workflow Step Chain -- Per-Layer Retry + Four-Outcome Routing

**Scope**: Replace global retry counter with per-layer budgets; add NEEDS_CREDENTIALS and IMPOSSIBLE_SPEC routing.

**Repo**: helix-global-server

**Files**:
- `src/helix-workflow/orchestrator/workflow-step-chain.ts` (1449 lines, core logic)

**Changes**:

1. **chainOutcome union** (line 665): Extend from `'SUCCEEDED' | 'UNVERIFIED'` to:
   ```typescript
   let chainOutcome: 'SUCCEEDED' | 'UNVERIFIED' | 'NEEDS_CREDENTIALS' | 'IMPOSSIBLE_SPEC' | undefined;
   ```

2. **Per-layer retry counters** replace `MAX_VERIFICATION_RETRIES = 2` (line 668):
   ```typescript
   const CASCADE_RETRY_BUDGETS = {
     plan_adherence: 3,
     technical_validation: 2,
     scenario_acceptance: 2,
   };
   ```

3. **verification_broken gets retries**: Currently line 1044 goes directly to UNVERIFIED with ZERO retries -- the single biggest waste (125 of 139 UNVERIFIED runs). New behavior: verification_broken failures are decomposed into layer-specific failures that enter the per-layer retry loop with strategy variation.

4. **NEEDS_CREDENTIALS check**: After `executeHelixWorkflowStep` returns, check `stepResult.status === 'NEEDS_CREDENTIALS'` **before** existing step-specific handling. This applies to **any step** (per AD-2 -- universal return), not just verification. If detected: extract justification, set `chainOutcome = 'NEEDS_CREDENTIALS'`, persist with `markRunNeedsCredentials`, break step loop.

5. **IMPOSSIBLE_SPEC routing**: Read from cascade output. If verification returns `impossible_spec`, set `chainOutcome = 'IMPOSSIBLE_SPEC'`, persist with `markRunImpossibleSpec` including specDeviations, break.

6. **Strategy tracking**: Pass `attemptedStrategies` through `continuationContext`. Each retry includes full strategy history so the agent can choose a different approach.

7. **Retries exhausted -> FAILED**: When all retries for a layer are exhausted, set `chainOutcome = 'FAILED'` (not 'UNVERIFIED') with full context of all attempts.

8. **Non-blocking step handling**: For steps with `nonBlocking: true` (demo), step failure is logged but does not set chainOutcome to FAILED.

**Prerequisites**: 1A, 1B, 1C (types, run store); 3A (cascade output schema)

**Success criteria**:
- `npm run typecheck` passes
- No code path produces UNVERIFIED for new runs
- verification_broken enters retry loop (not zero-retry terminal)
- NEEDS_CREDENTIALS handled for any step (universal return)
- Per-layer retry counters replace global counter
- Retries exhausted -> FAILED with full context
- Non-blocking step handling for demo

---

#### Ticket 3D: Orchestrator -- NEEDS_CREDENTIALS / IMPOSSIBLE_SPEC / NS Bypass

**Scope**: Handle new outcomes in run lifecycle; eliminate NS bypass.

**Repo**: helix-global-server

**Files**:
- `src/helix-workflow/orchestrator.ts` (2100+ lines)
- `src/helix-workflow/orchestrator/ticket-service.ts` -- continuationContext for NEEDS_CREDENTIALS re-entry

**Changes**:

1. **NEEDS_CREDENTIALS handling**:
   - When chainOutcome is 'NEEDS_CREDENTIALS': post comment to ticket thread with pre-filled credential form (repo name, env var names from justification, description)
   - Run enters non-terminal pause state
   - On resume (Save and Resume): requesting step restarts from the beginning
   - `continuationContext` preserves state for re-entry

2. **IMPOSSIBLE_SPEC handling**:
   - When chainOutcome is 'IMPOSSIBLE_SPEC': call `markRunImpossibleSpec` with specDeviations
   - Terminal with full context: what's impossible, why, what best-effort was achieved
   - Post completion comment with spec deviation summary

3. **Eliminate NS UNVERIFIED bypass** (lines 2139-2141):
   - Remove: `isNsPlatform && UNVERIFIED -> proceed to deploy`
   - Replace: cascade provides real verification for NS. Only visual scenarios individually platform-deferred.
   - NS runs now get Plan Adherence + Technical Validation + runtime-based Scenario Acceptance

4. **Demo step nonBlocking handling**:
   - If demo step fails: log warning, set step status to FALLBACK, continue
   - Run outcome unaffected by demo failure

5. **Proof screenshot evolution**:
   - Verification cascade captures evidence screenshots per layer
   - Demo step captures curated, scenario-organized screenshots to demoContent

**Prerequisites**: 3C (chain outcome routing), 1C (run store functions)

**Success criteria**:
- `npm run typecheck` passes
- NS bypass code at lines 2139-2141 removed
- NEEDS_CREDENTIALS comment posted with credential form data
- IMPOSSIBLE_SPEC terminates with specDeviations context
- Demo failure does not affect run outcome

---

### Phase 4: Client Updates (3 Tickets)

Client tickets mirror server type changes and evolve the display. **Server Phases 1-3 must land before client Phase 4** to ensure type alignment.

---

#### Ticket 4A: Client Types + Constants + CSS

**Scope**: Mirror server types; add new status labels, colors, and workflow step.

**Repo**: helix-global-client

**Files**:
- `src/types/api.ts` -- Type additions
- `src/lib/format.ts` -- Labels and WORKFLOW_STEPS
- `src/index.css` -- Color variables

**Changes**:

Types (`api.ts`):
1. `SandboxRunStatus`: add `'NEEDS_CREDENTIALS'`, `'IMPOSSIBLE_SPEC'`
2. `TicketStatus`: add `'NEEDS_CREDENTIALS'`, `'IMPOSSIBLE_SPEC'`
3. `StepStatus.status`: add `'NEEDS_CREDENTIALS'`, `'IMPOSSIBLE_SPEC'`
4. `VerificationReport.outcome`: add `'needs_credentials'`, `'impossible_spec'`
5. New optional fields on `VerificationReport`:
   - `cascade?: { planAdherence: CascadeLayerResult, technicalValidation: CascadeLayerResult, scenarioAcceptance: CascadeLayerResult }`
   - `failedLayer?: string`
   - `attemptedStrategies?: Array<{layer: string, strategy: string, outcome: string}>`
   - `needsCredentialsJustification?: { envVars: Array<{name: string, repo: string, description: string}>, subCase: string }`
   - `specDeviations?: { impossibleItems: Array<{criterion: string, reason: string, bestEffortResult: string}>, isFullyImpossible: boolean }`
6. New types: `CascadeLayerResult`, `DemoContent`

Labels and steps (`format.ts`):
1. `statusDisplayLabels`: add `'NEEDS_CREDENTIALS': 'Needs Credentials'`, `'IMPOSSIBLE_SPEC': 'Impossible Spec'`
2. `WORKFLOW_STEPS`: add `{ id: 'demo', title: 'Demo' }` as step 10

CSS (`index.css`):
1. `--color-status-needs-credentials`: amber/warning palette
2. `--color-status-impossible-spec`: purple (distinct from red/FAILED, per user direction: "spec problem, not system error")

**Prerequisites**: Server Phase 1 complete (types must match)

**Success criteria**:
- `npm run typecheck` passes
- All new types defined with optional fields for backward compatibility
- Colors distinct: green (SUCCEEDED), red (FAILED), amber (NEEDS_CREDENTIALS), purple (IMPOSSIBLE_SPEC), gray (UNVERIFIED legacy)

---

#### Ticket 4B: Client Display Components

**Scope**: Update existing components for four-outcome model and cascade display.

**Repo**: helix-global-client

**Files**:
- `src/components/status-badge.tsx` -- Color mappings
- `src/components/run-history.tsx` -- Cascade/flat conditional rendering
- `src/components/ticket-summary.tsx` -- Outcome labels
- `src/components/ticket-artifacts-overview.tsx` -- Demo step description
- `src/routes/ticket-detail.tsx` -- UNVERIFIED conditional expansion
- `src/lib/ticket-filters.ts` -- Filter options

**Changes**:

StatusBadge (`status-badge.tsx`):
- Add NEEDS_CREDENTIALS -> amber color mapping
- Add IMPOSSIBLE_SPEC -> purple color mapping

VerificationReportSection (`run-history.tsx`):
- **CascadeView** (when `report.cascade` present): Three collapsible sections for Plan Adherence, Technical Validation, Scenario Acceptance. Each shows per-criterion pass/fail with evidence.
- **FlatView** (when `report.cascade` absent): Existing display, unchanged (backward compatible).
- NEEDS_CREDENTIALS: Justification panel showing missing env vars with repo and variable name
- IMPOSSIBLE_SPEC: Deviation panel showing what's impossible and why, with best-effort context

`isCompletedRun` (run-history.tsx line 264):
- Add `NEEDS_CREDENTIALS` and `IMPOSSIBLE_SPEC` alongside existing SUCCEEDED/UNVERIFIED checks

Ticket detail (`ticket-detail.tsx`):
- All 4 UNVERIFIED conditionals (lines 379, 411, 428, 436): handle NEEDS_CREDENTIALS and IMPOSSIBLE_SPEC alongside UNVERIFIED

Ticket summary (`ticket-summary.tsx`):
- `verificationLabel` switch: add `needs_credentials` and `impossible_spec` outcome labels

Ticket artifacts overview (`ticket-artifacts-overview.tsx`):
- Add demo step description
- Per-step criteria display (SCN-XX for product, TCK-XX for tech-research)

Ticket filters (`ticket-filters.ts`):
- New filter groups for NEEDS_CREDENTIALS and IMPOSSIBLE_SPEC statuses

**Prerequisites**: 4A (types)

**Success criteria**:
- `npm run build` passes
- All 4 UNVERIFIED conditionals expanded for both new statuses
- Cascade/flat conditional rendering works (cascade present -> CascadeView, absent -> FlatView)
- Backward compatible: old runs without cascade data render identically

---

#### Ticket 4C: DemoViewer Component (New)

**Scope**: New component for scenario-organized demo content.

**Repo**: helix-global-client

**Files**:
- `src/components/demo-viewer.tsx` (NEW)

**Changes**:

1. **Component structure**: Groups screenshots by SCN-XX scenario with section headers and captions. Each scenario group shows:
   - Scenario ID and title
   - Ordered screenshots with descriptive captions
   - Expandable/collapsible sections

2. **Lazy-loaded**: Following `walkthrough-viewer.tsx` pattern (519 lines), use `React.lazy` for code splitting.

3. **Empty state**: Graceful handling when `demoContent` is absent (old runs, demo step not yet run, demo step failed).

4. **Integration**: Mounted in run-history.tsx alongside (not replacing) ProofViewer. ProofViewer displays verification evidence; DemoViewer displays curated demo content.

**Prerequisites**: 4A (DemoContent type)

**Success criteria**:
- Component renders scenario-organized screenshots with section headers and captions
- Empty state gracefully handles absent demoContent
- Lazy-loaded via React.lazy
- ProofViewer unchanged and separate

---

## 8. Implementation Ordering and Cross-Repo Coordination

### 8.1 Phase Dependency Graph

```
Phase 1: Foundation          Phase 2: Criteria Production
┌─────────────────┐          ┌────────────────────────┐
│ 1A: Schema/Mig  │          │ 2A: Product SCN-XX     │
│      ↓          │          │ 2B: Tech-Research TCK  │  (prompt-only,
│ 1B: TS Types    │          │ 2C: Impl CHK enforce   │   can parallelize
│      ↓          │          └────────────────────────┘   with Phase 1)
│ 1C: Catalog+    │
│     RunStore    │
└────────┬────────┘
         │
         ├────────────────────┐
         ↓                    ↓
Phase 3: Cascade + Orchestrator
┌──────────────────────────────┐
│ 3A: Verification Cascade     │ ← depends on 2A, 2B, 2C, 1B
│ 3B: Demo Step Config         │ ← depends on 1C, 2A
│ 3C: Workflow Step Chain      │ ← depends on 1A, 1B, 1C, 3A
│ 3D: Orchestrator             │ ← depends on 3C, 1C
└──────────────┬───────────────┘
               ↓
Phase 4: Client
┌──────────────────────────────┐
│ 4A: Client Types + CSS       │ ← depends on Server Phase 1
│ 4B: Display Components       │ ← depends on 4A
│ 4C: DemoViewer               │ ← depends on 4A
└──────────────────────────────┘
```

### 8.2 Critical Path

The critical path (longest dependency chain) is:

```
1A (Schema) → 1B (Types) → 1C (Catalog) → 3C (Step Chain) → 3D (Orchestrator) → 4A (Client Types) → 4B (Display)
```

### 8.3 Parallel Opportunities

| Tickets | Can Run In Parallel | Reason |
|---------|-------------------|--------|
| 2A, 2B, 2C | All three | Prompt-only changes, no TypeScript dependency |
| 2A/2B/2C with 1A/1B/1C | Partially | Step-configs have no TypeScript compile dependency on types |
| 3A and 3B | Yes | Different step-config files, no code dependency |
| 4B and 4C | Yes | Different components, share only 4A types |

### 8.4 Cross-Repo Sequencing

**Server changes must land before client changes.** The client mirrors server types.

| Order | Repo | Phase | Rationale |
|-------|------|-------|-----------|
| First | helix-global-server | 1A (Schema) | Database foundation |
| Second | helix-global-server | 1B, 1C + 2A-2C (parallel) | Types + prompts |
| Third | helix-global-server | 3A-3D | Cascade + orchestrator |
| Last | helix-global-client | 4A-4C | Mirror server types and render |

### 8.5 Quality Gates Per Phase

| Phase | Gate | Command |
|-------|------|---------|
| Phase 1 complete | Server typecheck + build | `npm run typecheck && npm run build` |
| Phase 2 complete | Prompt review (no compile) | Manual inspection of step-config.mjs files |
| Phase 3 complete | Server typecheck + build + lint | `npm run typecheck && npm run build && npm run lint` |
| Phase 4 complete | Client typecheck + build + lint | `npm run typecheck && npm run build && npm run lint` |
| All phases | Both repos | `npm run build` on both helix-global-server and helix-global-client |

### 8.6 Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Migration safety | `ALTER TYPE ADD VALUE` is non-destructive for PostgreSQL enums. Existing values unaffected. |
| Backward compatibility | UNVERIFIED retained in enums. Client conditionally renders cascade (present) vs flat (absent). All new type fields optional. |
| NS bypass removal | Cascade provides real verification for NS. Only visual scenarios individually platform-deferred. |
| Prompt changes break outputs | Step-config changes are additive -- new sections alongside existing output. Existing sections unchanged. |
| Client-server type drift | Types defined once on server; client mirrors exactly. Phase 4 follows server completion. |

---

## 9. Production Data (Fresh, 2026-05-18)

### 9.1 Run Status Distribution

| Status | Count | Percentage |
|--------|-------|-----------|
| SUCCEEDED | 757 | 63.1% |
| FAILED | 268 | 22.3% |
| UNVERIFIED | 139 | 11.6% |
| MERGED | 33 | 2.8% |
| INTERRUPTED | 3 | 0.3% |
| RUNNING | 1 | <0.1% |
| QUEUED | 1 | <0.1% |
| **Total** | **1,202** | **100%** |

### 9.2 Verification Outcome Distribution

| Outcome | Count | % of Non-Null |
|---------|-------|--------------|
| verified | 670 | 77.0% |
| verification_broken | 138 | 15.9% |
| implementation_wrong | 15 | 1.7% |
| null (no verification data) | 42 | -- |

### 9.3 UNVERIFIED Breakdown

| Verification Outcome | Count | % of UNVERIFIED |
|---------------------|-------|----------------|
| verification_broken | 125 | 89.9% |
| implementation_wrong | 14 | 10.1% |
| **Total UNVERIFIED** | **139** | **100%** |

**Key finding**: 125 of 139 UNVERIFIED runs (89.9%) are `verification_broken` -- infrastructure/tooling failures that receive **zero retries** at `workflow-step-chain.ts` line 1044. These are specific, diagnosable issues (missing org config, PAT permissions, Git index corruption) that an agent should handle with strategy variation.

### 9.4 Ticket-Level Impact

**16 tickets** are currently stuck in UNVERIFIED status with no recovery path. These represent work that was implemented but never confirmed -- and the pipeline provides no mechanism to resolve them.

### 9.5 Failure Category Breakdown (Estimated from Prior Analysis)

| Category | Count | % of UNVERIFIED | Agent-Resolvable? | Proposed Outcome |
|----------|-------|----------------|-------------------|-----------------|
| Env/infrastructure | ~55 | ~40% | **Yes** | Agent Resolves |
| Tooling/browser | ~39 | ~28% | **Yes** | Agent Resolves |
| External DB unreachable | ~15 | ~11% | **No** | FAILED |
| Code defects | ~14 | ~10% | **Yes** | Agent Resolves |
| Billing/quota | ~7 | ~5% | **No** | FAILED |
| Model config | ~5 | ~4% | **Yes** | Agent Resolves |
| **Total** | **~135** | **100%** | **~82% Yes** | |

### 9.6 Expected Impact

| Metric | Current | Target After Implementation |
|--------|---------|---------------------------|
| UNVERIFIED rate | 11.6% (139 of 1,200) | <2% (billing + network only -> FAILED) |
| Agent-resolvable failures abandoned | ~114 runs | 0 (all get per-layer retries) |
| NS verification coverage | 0% (bypassed) | ~80%+ (PA + TV fully; SA via runtime inspection) |
| verification_broken retries | 0 (zero retries) | Up to 7 (3+2+2 per-layer) |

---

## 10. Success Criteria (Complete)

### Sandwich Model
1. Product step outputs structured SCN-XX with mandatory fields (ID, Precondition, Action, Expected Outcome)
2. Tech-research step outputs structured TCK-XX with mandatory fields (ID, Decision Reference, Verification Method, Expected Evidence)
3. Implementation step records explicit pass/fail/blocked per CHK-XX (enforced, not advisory)
4. Verification cascade executes Plan Adherence -> Technical Validation -> Scenario Acceptance in order
5. Failure at earlier layer prevents later layers from running
6. Demo step runs after cascade passes; scenario-organized screenshots grouped by SCN-XX
7. Step catalog updated: demo added to HelixWorkflowStepId and HELIX_WORKFLOW_STEPS

### Agent-First Failure Resolution
8. Per-layer retry budgets replace global MAX_VERIFICATION_RETRIES=2 (PA=3, TV=2, SA=2)
9. verification_broken failures (currently zero retries) get agent-driven resolution
10. Each retry uses a demonstrably different strategy
11. Strategy history tracked in attemptedStrategies and passed via continuationContext
12. Retries exhausted -> FAILED (not UNVERIFIED) with full context

### Four-Outcome Model
13. NEEDS_CREDENTIALS triggers ONLY for missing new env vars/credentials or missing test environment
14. Pre-filled credential form: repo name + env var name auto-populated; human enters dev value only
15. Requesting step restarts (not next step) when Save and Resume is hit
16. IMPOSSIBLE_SPEC returned only when best-effort is fundamentally far from spec intent
17. IMPOSSIBLE_SPEC is terminal with full context; phased out when backward-branching implemented
18. Billing/quota -> FAILED (NOT NEEDS_CREDENTIALS)
19. Network-inaccessible -> FAILED (NOT NEEDS_CREDENTIALS)
20. Spec ambiguity -> agent resolves first; IMPOSSIBLE_SPEC only after best-effort fails

### Scenario Acceptance
21. SA validates SCN-XX with structured evidence per scenario (not vague assessments)
22. SA runs against dev server within verification step (before preview-config)
23. Platform-deferred scenarios noted but do not count against pass/fail
24. SA evidence includes scenarioId, outcome, observedBehavior, and evidence fields

### NetSuite Coverage
25. Plan Adherence and Technical Validation run fully for NetSuite
26. Scenario Acceptance uses runtime inspection for NetSuite (SuiteQL, logs, API calls)
27. Visual-only scenarios individually platform-deferred (not whole-run UNVERIFIED)
28. NS UNVERIFIED bypass eliminated (orchestrator.ts lines 2139-2141 removed)

### Quality Gates
29. `npm run build` passes for helix-global-server
30. `npm run typecheck` passes for helix-global-server
31. `npm run lint` passes for helix-global-server
32. `npm run build` passes for helix-global-client
33. `npm run typecheck` passes for helix-global-client
34. `npm run lint` passes for helix-global-client

---

## 11. Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Criteria bloat** -- too many scenarios/checks | Medium | Guidelines: 5-15 product scenarios, 3-8 technical checks per ticket |
| 2 | **Pipeline latency** -- per-layer retries add time | Medium | Better outcomes justify time; zero-retry wastes the entire run |
| 3 | **Retry strategy exhaustion** -- all strategies tried, none work | Medium | Run becomes FAILED with full context. Agent-first does not mean agent-infinite. |
| 4 | **Migration safety** | Low | ALTER TYPE ADD VALUE non-destructive for both enums |
| 5 | **NEEDS_CREDENTIALS overuse** | Medium | Three-layer enforcement: prompt, typed justification, orchestrator validation |
| 6 | **Backward compatibility** | Low | UNVERIFIED retained; client conditional on cascade field presence |
| 7 | **Product scenarios too abstract** | Low | By design: scenarios describe user outcomes, not implementation paths |
| 8 | **IMPOSSIBLE_SPEC overuse** | Medium | High bar: only when best-effort result cannot meaningfully be called "implemented" |
| 9 | **IMPOSSIBLE_SPEC as dead end** (no backward routing yet) | Low | Terminal for now; phased out when bidirectional routing enables spec revision |
| 10 | **SA pass criteria subjectivity** | Medium | Structured evidence specification with acceptable/unacceptable examples |
| 11 | **Demo step failure at launch** | Low | Non-blocking; cannot fail a run; graceful empty state in client |

---

## 12. Terminology Reference

| Term | Layer | ID Format | Produced By | Consumed By |
|------|-------|-----------|-------------|-------------|
| User Scenarios | Product (Forward) | SCN-XX | Product step | Scenario Acceptance |
| Technical Checks | Tech-Research (Forward) | TCK-XX | Tech-Research step | Technical Validation |
| Required Checks | Implementation-Plan (Forward) | CHK-XX | Impl-Plan step | Inline Checks, Plan Adherence |
| Inline Checks | Implementation (Middle) | References CHK-XX | Implementation step | Plan Adherence |
| Plan Adherence | Verification Cascade (3a) | Validates CHK-XX | Cascade | Pipeline decision |
| Technical Validation | Verification Cascade (3b) | Validates TCK-XX | Cascade | Pipeline decision |
| Scenario Acceptance | Verification Cascade (3c) | Validates SCN-XX | Cascade | Pipeline decision |
| Verification Cascade | Umbrella (3a-3c) | -- | -- | Pipeline orchestration |
| Demo | Presentation (Layer 4) | Organized by SCN-XX | Demo agent | Ticket author |

### Deprecated Terminology

| Deprecated | Replacement | Reason |
|-----------|-------------|--------|
| NEEDS_REVIEW | NEEDS_CREDENTIALS | User direction: billing/network are errors, not human-review |
| "verification" (unqualified) | Specific layer name | Overloaded -- always qualify which layer |
| "proof screenshots" | Demo content | Screenshots are curated by demo agent, not verification byproducts |
| "implementation self-verification" | Inline Checks | More precise -- happens during implementation, inline with building |
| UNVERIFIED (terminal state) | FAILED, NEEDS_CREDENTIALS, or IMPOSSIBLE_SPEC | No new code path produces UNVERIFIED |

---

## 13. Future Considerations

| Topic | Priority | Dependency |
|-------|----------|------------|
| **Visual UI testing for NetSuite** | High | Separate initiative per ticket author ("coming soon") |
| **Backward-branching routing** (phases out IMPOSSIBLE_SPEC) | High | Enables failures to re-route to earlier steps for spec revision |
| **Per-layer verification dashboard** with evidence drill-down | Medium | Requires cascade data accumulation |
| **IMPOSSIBLE_SPEC phase-out** | Medium | Requires backward-branching routing first |
| **Video demo agent** with chapter navigation | Low | Organized screenshots sufficient initially |
| **Cross-run learning** from verification outcomes | Low | Requires data accumulation before patterns emerge |
| **Per-layer specialized verification agents** | Low | Single step with internal cascade sufficient for MVP |
| **NEEDS_CREDENTIALS guided response** (structured continuationContext input) | Low | Current form flow sufficient |

---

## 14. Ticket Summary Table

| Ticket | Phase | Repo | Scope | Prerequisites | Risk |
|--------|-------|------|-------|--------------|------|
| **1A** | 1: Foundation | server | Prisma schema + migration | None | Low |
| **1B** | 1: Foundation | server | TypeScript type foundation | 1A | Medium |
| **1C** | 1: Foundation | server | Step catalog + run store | 1A, 1B | Medium |
| **2A** | 2: Criteria | server | Product SCN-XX (prompt-only) | None | Low |
| **2B** | 2: Criteria | server | Tech-Research TCK-XX (prompt-only) | None | Low |
| **2C** | 2: Criteria | server | Implementation CHK-XX enforcement (prompt-only) | None | Low |
| **3A** | 3: Cascade | server | Verification cascade step-config | 2A, 2B, 2C, 1B | Medium |
| **3B** | 3: Cascade | server | Demo step config (new) | 1C, 2A | Medium |
| **3C** | 3: Cascade | server | Workflow step chain | 1A, 1B, 1C, 3A | **High** |
| **3D** | 3: Cascade | server | Orchestrator | 3C, 1C | **High** |
| **4A** | 4: Client | client | Types + constants + CSS | Server Phase 1 | Medium |
| **4B** | 4: Client | client | Display components | 4A | Medium |
| **4C** | 4: Client | client | DemoViewer (new component) | 4A | Medium |

**Total**: 13 tickets across 4 phases, ~14 server files, ~10 client files.

---

## Methodology

This report was developed through:

1. **Production runtime inspection** (2026-05-18): Fresh database queries against the helix-global-server production database for run status distribution, verification outcome breakdown, UNVERIFIED ticket count, and failure category analysis.

2. **Prior artifact synthesis**: RSH-445 conceptual framework (research report embedded in ticket.md), RSH-473 build specification (prior report at library/reports/RSH-473/report.md), and multi-repo product specifications, diagnosis statements, tech-research decisions, and implementation plans.

3. **User discussion integration**: 20+ exchanges in the ticket discussion thread (lines 893-1081) refining NEEDS_CREDENTIALS scope, credential flow UX, impossible spec handling, and the core principle that the agent handles everything diligently.

4. **User continuation context**: Two explicit callouts incorporated -- IMPOSSIBLE_SPEC as a distinct fourth verification status ("phased out later"), and scenario verification ambiguity resolution ("really important and also a little ambiguous").

5. **Direct code inspection**: Step configs, orchestrator logic, workflow-step-chain retry/terminal-state logic, run-store persistence patterns, step executor types, Prisma schema, and client components.

---

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md Research Report (RSH-445) | Primary conceptual specification | 4-layer sandwich model; per-layer verification; demo separation; terminology framework |
| ticket.md Discussion (lines 893-1081) | User's explicit design decisions | NEEDS_CREDENTIALS replaces NEEDS_REVIEW; billing/network are FAILED; pre-filled credential form; step restart; early detection |
| ticket.md Continuation Context | User's two explicit callouts | IMPOSSIBLE_SPEC as distinct status "phased out later"; scenario verification "really important and also a little ambiguous" |
| Prior run feedback | Agent behavior principle | Agent handles everything diligently, not negligently; no generic NEEDS_REVIEW escape hatch |
| library/reports/RSH-473/report.md (prior) | Build specification | 14 server files; AD-1 through AD-8; strategy catalog; three-outcome model (now four) |
| product/product.md (server) | Server product specification | F-1 through F-9; four-outcome model; NEEDS_CREDENTIALS exhaustive boundary table; SA detailed design |
| product/product.md (client) | Client product specification | F-1 through F-8; IMPOSSIBLE_SPEC display (purple, not red); DemoViewer; NEEDS_CREDENTIALS form UX |
| diagnosis/diagnosis-statement.md (server) | Root cause analysis | Zero retries for 89.9%; four-outcome model; SA evidence requirements; per-layer budgets |
| tech-research/tech-research.md (server) | Architecture decisions AD-1 through AD-10 | Cascade within single step; universal NEEDS_CREDENTIALS return; strategy catalog; IMPOSSIBLE_SPEC as distinct status |
| scout/scout-summary.md (server) | File analysis with production data | 14 server files; terminal state code paths; zero-retry code at line 1044 |
| scout/scout-summary.md (client) | Client component analysis | 10 client files; UNVERIFIED reference locations; quality gates |
| Runtime inspection (2026-05-18) | Fresh production data | 1,200 runs; 139 UNVERIFIED; 125 verification_broken; 16 stuck tickets |
| repo-guidance.json | Repo roles | server=primary, client=secondary, library/cli=context |

## Attachments
- (none)

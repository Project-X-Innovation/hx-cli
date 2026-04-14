# Ownership Framework for Helix

**Research Report | RSH-226 | First Draft**

---

## Executive Summary

Helix already owns outcomes in practice. Of 124 production deployments, 97.6% happened with no human owner assigned. The entire ticket lifecycle --- from DRAFT through DEPLOYED --- runs autonomously without a single human approval gate. But this ownership is implicit, unrecorded, and unaccountable.

The Helix Manifesto declares: *"If Helix touches it, Helix is responsible for it. Not partially. Not temporarily. Fully. And forever."* The product does not yet live up to this promise. There is no ownership assertion model, no decision log, no accountability trail for lifecycle events, no rollback capability, and no post-deployment monitoring. Nine production deployments have failed with no recorded remediation or accountability.

This report defines a concrete ownership framework across six design dimensions --- Assertion, Decisions, Verification, Accountability, Reversibility, and Continuity --- grounded in Helix's current production reality and mapped to the Reality Check roadmap milestones. The core design principle is:

> **Helix owns by default. Humans intervene by exception.**

This is not philosophy. It is an architectural commitment backed by production data, and it inverts the traditional model: instead of "approve before deploy," it is "review after deploy, intervene if wrong." Instead of "assign a human owner," it is "Helix is always the owner, humans are informed."

---

## Table of Contents

1. [The Problem: Implicit Ownership](#1-the-problem-implicit-ownership)
2. [The Structural Gap](#2-the-structural-gap)
3. [Design Principles](#3-design-principles)
4. [Dimension 1: Ownership Assertion Model](#4-dimension-1-ownership-assertion-model)
5. [Dimension 2: Decision Log Design](#5-dimension-2-decision-log-design)
6. [Dimension 3: Human Verification by Exception](#6-dimension-3-human-verification-by-exception)
7. [Dimension 4: Accountability Visibility](#7-dimension-4-accountability-visibility)
8. [Dimension 5: Reversibility Model](#8-dimension-5-reversibility-model)
9. [Dimension 6: Continuity Model](#9-dimension-6-continuity-model)
10. [Technical Architecture Direction](#10-technical-architecture-direction)
11. [UI Surface Requirements](#11-ui-surface-requirements)
12. [Roadmap Mapping](#12-roadmap-mapping)
13. [Open Questions and Risks](#13-open-questions-and-risks)
14. [Competitive Positioning](#14-competitive-positioning)
15. [Recommendations for Next Steps](#15-recommendations-for-next-steps)

---

## 1. The Problem: Implicit Ownership

### What Helix Does Today

Helix runs a fully automated ticket lifecycle with no human approval gates:

```
DRAFT -> QUEUED -> RUNNING -> MERGING -> SANDBOX_READY -> VERIFYING
     -> DEPLOYING -> PREVIEW_READY -> REPORT_READY -> STAGING_MERGED -> DEPLOYED
```

Every transition is system-driven. No status requires human sign-off.

### Production Reality (Live Data)

The following numbers come from the production database, queried in real time:

| Metric | Value | Implication |
|--------|-------|-------------|
| Total tickets | 265 | Across 6 organizations |
| Tickets with a director assigned | 18 (6.8%) | The optional human ownership field is almost unused |
| Deployed tickets | 124 | 46.8% reach production |
| Deployed tickets with a director | 3 (2.4%) | Virtually all deployments are unowned by a human |
| Successful deployments | 53 | 84.1% deployment success rate |
| Failed deployments | 9 | No remediation or accountability record exists for any failure |
| Sandbox runs | 612 | Active execution infrastructure |
| Runs with verification reports | 380 (62.1%) | Automated verification happens, but not universally |
| Verification retries recorded | 0 | The `verificationAttemptCount` field is never used |
| Audit log entries | 2,073 | 1,677 database queries + 396 log queries --- all data inspection, zero lifecycle events |
| Ticket statuses in failed state | 38 | 14.3% of all tickets end in FAILED |

### The Five Gaps

The gap between what Helix *does* and what it *claims* can be stated precisely:

| What is Missing | What it Means |
|-----------------|---------------|
| **No ownership assertion** | No entity records "Helix owns this outcome." 121 of 124 deployed tickets have no recorded owner of any kind. |
| **No decision log** | Helix makes dozens of automated decisions per ticket (proceed, verify, deploy) but records none of them with reasoning. Workflow logs go to stdout and are not queryable. |
| **No lifecycle audit trail** | 2,073 audit entries exist, but every single one is for data inspection queries (DATABASE or LOGS). Zero entries capture lifecycle events like status transitions, deployments, or verification outcomes. |
| **No rollback capability** | 9 failed deployments have no recorded remediation. No revert mechanism exists. |
| **No post-deployment monitoring** | Ticket lifecycle ends at DEPLOYED. No health check, breakage detection, or ongoing accountability exists beyond that point. |

### Why This Matters Now

The ticket creator framed the question perfectly: *"The simplest way to talk about ownership is whose neck is in the noose?"* --- and then immediately rejected that framing for humans: *"I don't want to put a human's head in the noose. That defeats the purpose of Helix."*

The answer is that Helix's neck is already in the noose. It deploys to production autonomously. It makes verification decisions autonomously. It proceeds through every lifecycle stage autonomously. The problem is not that nobody owns outcomes --- it is that the owner (Helix) does not record, explain, or account for its ownership.

---

## 2. The Structural Gap

The Helix Positioning document identifies a structural gap in the market that directly motivates the ownership framework:

### Three entities touch the custom operational layer. None of them own it.

**NetSuite (the ERP)** provides the platform, the template, and infinite customizability. But it does not step in and own each customer's business-specific operational layer. It never has, and structurally, it is not in the business of doing so. Even with NetSuite Next, Oracle's AI investments focus on in-product intelligence (conversational AI, natural-language search, agentic workflows) --- not persistent ownership of the custom layer.

**Consultants** implement the custom layer. They can advise on it, patch it, and extend it. But a year later, they are gone. Then another consultant comes in. Eventually you have fragmented logic, inconsistent documentation, and scripts running at midnight that no one fully understands.

**AI models** (Claude Code, Codex, ChatGPT) can generate into the custom layer --- code, workflows, suggestions. But they do not remember the account over time, do not test in sandbox, do not deploy safely, do not monitor outcomes, and do not carry accountability when something breaks. Generation is a different category from ownership.

### The shrinking human layer

Meanwhile, the human operating teams around ERP systems are shrinking. Business complexity stays the same. The same accounting rules, the same logistics flows, the same financial processes. But instead of 100 people operating around the system, companies may soon have 10.

### Where Helix sits

Helix exists to own the layer that nobody else wants to own: the customizations, the flows, the logic, the changes, the maintenance, the monitoring, the rollback, the support, and the continuity over time.

This is not just product positioning. It is a *structural requirement*. If Helix touches the custom operational layer but does not record its ownership, log its decisions, or maintain accountability, then Helix is just another tool that touches the layer temporarily --- no different from a consultant who leaves.

---

## 3. Design Principles

The ownership framework is governed by six principles, derived directly from the Helix Manifesto:

### Principle 1: Helix Owns; Humans Intervene

Default ownership belongs to Helix. Humans can override but are not required to approve. This is validated by production reality: 97.6% of deployed tickets already have no human involvement. The framework codifies what is already true.

### Principle 2: Trust is Earned Through Behavior, Not Assumed

*"Generating code is commoditized. Generating customizations is commoditized. Reliability is not."* (Manifesto, Principle 8)

Ownership is backed by a visible track record: completion rates, deployment success rates, failure handling, and resolution speed. Trust is not assumed --- it is engineered through transparent accountability.

### Principle 3: Every Action is Reversible, Observable, and Auditable

Safety is non-negotiable. Every ownership assertion, every decision, and every deployment must be recorded in an immutable trail. The current audit system captures 2,073 data inspection events but zero lifecycle events. This must change.

### Principle 4: Decisions Live in Helix

*"All inputs flow into Helix. All decisions live in Helix. All outcomes are executed and maintained by Helix."* (Manifesto, Principle 4)

Every automated decision --- proceed to next stage, verification outcome, deployment authorization --- must be captured with structured reasoning.

### Principle 5: Helix Maintains Systems, Not Just Tasks

Ownership does not end at DEPLOYED. The Continuity principle (Manifesto, Principle 6) requires ongoing accountability: monitoring, breakage detection, and remediation.

### Principle 6: Opinionated by Design

*"If the user must decide everything, Helix owns nothing."* (Manifesto, Principle 5)

The ownership model must not degenerate into a configuration burden. Helix asserts ownership automatically. Humans configure exceptions, not defaults.

---

## 4. Dimension 1: Ownership Assertion Model

### What "Helix Owns This" Means in Concrete Terms

An ownership assertion is an explicit, immutable record that Helix owns a specific outcome at a specific lifecycle stage. It answers four questions:

1. **What** is owned? (a ticket, a deployment, a verification outcome)
2. **Since when?** (timestamp of the assertion)
3. **At what stage?** (QUEUED, VERIFYING, DEPLOYING, DEPLOYED, etc.)
4. **With what scope?** (implementation correctness, deployment safety, ongoing monitoring)

### Key Design Decisions

**Ownership is not a field on a ticket --- it is a trail of events.** This is the most important architectural insight. A mutable field (like the existing `directorUserId`) can be overwritten and loses history. An append-only event log preserves every assertion and creates the accountability trail.

**Helix is always the default owner.** The assertion is not "assign ownership" --- it is "record that Helix owns this stage." The current 6.8% director adoption rate proves that optional human ownership goes unused. The ownership model should not repeat this mistake.

**Human interventions are exceptions, not transfers.** When a human intervenes (flags an issue, requests a rollback, overrides a decision), that intervention is recorded as an exception to Helix's default ownership. Ownership is not transferred to the human --- Helix still owns the outcome; the human influenced the decision.

### Conceptual Data Model

Each ownership assertion captures:

| Attribute | Description | Example |
|-----------|-------------|---------|
| Subject | What is owned | Ticket #142, Deployment #53 |
| Stage | Lifecycle stage | VERIFYING, DEPLOYING, DEPLOYED |
| Actor | Who made the assertion | SYSTEM (Helix) or USER (human intervention) |
| Scope | What ownership covers | "implementation correctness," "deployment safety" |
| Timestamp | When asserted | ISO 8601 datetime |
| Evidence | What supports the assertion | Link to verification report, sandbox proofs |

### What This Looks Like in Practice

When ticket #142 moves from VERIFYING to DEPLOYING, the system automatically records:

> *Helix asserts ownership of ticket #142 at stage DEPLOYING. Scope: deployment safety. Evidence: verification report (outcome: verified), 4 sandbox proofs passed. Actor: SYSTEM.*

This creates an immutable record that Helix decided to deploy, based on specific evidence. If the deployment later fails, the trail shows exactly what evidence Helix relied on.

---

## 5. Dimension 2: Decision Log Design

### The Problem: Decisions Without Justification

Helix currently makes all lifecycle decisions automatically, but records none of them with reasoning. The workflow orchestrator writes to stdout via `logRun` and `logRunWorkflowStep` functions --- transient logs that are not queryable, not structured, and not tied to the accountability trail.

When a deployment fails, there is no record of:
- Why Helix decided to deploy
- What evidence it considered
- What risk it assessed
- Whether it considered alternatives

### Decision Types

Derived from the current workflow, Helix makes the following decision types:

| Decision Type | When It Happens | Current State |
|---------------|-----------------|---------------|
| **Proceed to next stage** | Every status transition (RUNNING -> MERGING, VERIFYING -> DEPLOYING, etc.) | Happens automatically, no record |
| **Verification outcome** | After sandbox testing | Outcome recorded (verified/implementation_wrong/verification_broken) but not the reasoning |
| **Retry decision** | After a failure, whether to re-attempt | Never happens --- 0 tickets have verificationAttemptCount > 0 |
| **Deployment authorization** | Decision to deploy to production | No authorization or risk assessment recorded for any of 53 successful deployments |
| **Escalation** | Decision to alert a human | Does not exist yet |
| **Remediation** | Decision to rollback or fix | Does not exist yet |

### Decision Log Structure

Each decision log entry captures:

| Attribute | Description |
|-----------|-------------|
| Decision type | Enum: PROCEED, VERIFICATION_OUTCOME, RETRY, DEPLOY, ESCALATE, REMEDIATE |
| Subject | What the decision is about (ticket ID, deployment ID) |
| Reasoning | Structured text: what evidence was considered, what the outcome was |
| Evidence references | Links to sandbox run, verification report, proof URLs |
| Risk assessment | Confidence level, blast radius estimate (future) |
| Outcome | What happened as a result of the decision |
| Timestamp | When the decision was made |
| Actor | SYSTEM (Helix) or USER (human override) |

### Design Principle: Log Failures, Not Just Successes

Failed decisions are as important as successful ones. The 9 failed deployments and 38 failed tickets need the same decision trail as the 53 successful deployments. This is what builds trust: not hiding failures, but showing that Helix records them, learns from them, and handles them accountably.

### Why This Matters

The decision log is the mechanism that transforms Helix from "a system that does things" to "a system that can explain what it did and why." This is the core difference between an AI tool and an AI operator. Tools generate output. Operators make accountable decisions.

---

## 6. Dimension 3: Human Verification by Exception

### The Traditional Model vs. the Helix Model

| | Traditional | Helix |
|---|---|---|
| **Default state** | Blocked until approved | Proceeds automatically |
| **Human role** | Gatekeeper (approve/reject) | Reviewer (intervene if wrong) |
| **When humans act** | Before every deployment | Only when something is wrong |
| **What happens if human is absent** | Nothing --- work stops | Work completes normally |
| **Trust model** | No trust in system; all trust in human judgment | System earns trust through behavior; human oversight is safety net |

### Why Not Approval Gates

The ticket creator explicitly rejects human approval gates: *"I don't want to put a human's head in the noose. That defeats the purpose of Helix."*

The production data confirms this is the right call. Director adoption is 6.8%. Only 2.4% of deployed tickets have a director. Adding mandatory approval gates would:

1. **Re-introduce the bottleneck** the product is designed to eliminate
2. **Go unused** --- if optional director assignment runs at 6.8%, mandatory approval would be ignored or resented
3. **Contradict the Manifesto** --- "The role of Helix is not to ask for confirmation. It is to demonstrate understanding through correct action." (Principle 7)

### The Exception-Based Model

Instead of pre-authorization, the model works as follows:

```
Helix deploys to production
  -> Customer is notified
  -> Evidence is presented (sandbox proofs, verification report, decision trail)
  -> Customer can:
     a) Do nothing (most common case --- Helix continues owning)
     b) Acknowledge ("Looks good")
     c) Flag an issue ("Something is wrong")
     d) Request review ("I want a human to look at this")
     e) Request rollback ("Revert this change") [future]
```

Each intervention is recorded in the decision trail as a human exception to Helix's autonomous operation.

### Escalation Triggers

Not everything should proceed autonomously. The framework defines escalation triggers where Helix should proactively alert a human:

| Trigger | Action | Timeline |
|---------|--------|----------|
| Deployment failure | Alert director/reporter | 3 months |
| Verification outcome: `implementation_wrong` | Alert reporter with evidence | 3 months |
| Verification outcome: `verification_broken` | Alert Helix team | 3 months |
| Repeated failures on same ticket | Alert director + Helix team | 6 months |
| Risk threshold exceeded | Alert based on configurable policy | 18 months |
| Post-deployment anomaly detected | Alert based on monitoring rules | 12 months |

### The Cold-Start Trust Problem

The "intervene by exception" model requires customers to trust Helix *before* they see a track record. This is the hardest part of the ownership framework. The primary mechanism for solving it is the accountability dashboard (Dimension 4): a transparent, honest display of Helix's track record that shows both successes and failures.

For early adoption, the recommendation is to start with high-visibility accountability dashboards for the first customers, using Helix's existing production track record (265 tickets, 53 successful deployments) as the initial trust foundation.

---

## 7. Dimension 4: Accountability Visibility

### What "Helix Shows Its Track Record" Looks Like

The accountability dashboard is where trust gets engineered. It answers a simple question: **"Can I rely on Helix?"**

### Dashboard Metrics (Grounded in Current Data)

| Metric | Current Value | What It Tells the Customer |
|--------|--------------|---------------------------|
| Total tickets owned | 265 | Helix's breadth of engagement |
| Deployment success rate | 84.1% (53/63) | How often Helix gets deployment right |
| Verification coverage | 62.1% (380/612) | How often Helix verifies its own work |
| Tickets deployed to production | 124 (46.8%) | Completion rate through full lifecycle |
| Tickets in failed state | 38 (14.3%) | Failure rate --- must be visible, not hidden |
| Failed deployments | 9 | How many times Helix got it wrong in production |
| Failed deployments with remediation record | 0 | Current gap: no accountability for failures |
| Active organizations | 6 | Cross-customer trust data |
| Mean time to deployment | TBD | Speed of Helix's execution |
| Verification retry rate | 0% | Currently unused --- indicates no self-correction loop |

### Design Principle: Transparency Over Promotion

The dashboard must be honest about failures. An 84.1% deployment success rate with 9 unresolved failures tells a more trustworthy story than a dashboard that only shows successes. Customers who see that Helix tracks and accounts for its failures will trust the system more than customers who suspect failures are hidden.

### Existing Foundation

The client already has a usage metrics page (`src/routes/usage.tsx`) with:
- Per-user statistics (tickets, runs, success rates, deployments)
- Period filtering (sprint, week, month, year, all time)
- Sortable tables
- Summary cards

The accountability dashboard follows this exact pattern but shifts the subject from "per-user" to "Helix system-wide and per-ticket." The interaction model is proven; the data source changes.

### Per-Ticket Accountability

Beyond aggregate metrics, each ticket should show its own accountability summary:

- **Ownership trail**: Who owned what, at each stage
- **Decision trail**: What Helix decided and why
- **Evidence trail**: Sandbox proofs, verification reports, deployment records
- **Intervention history**: Any human exceptions or overrides

This per-ticket view is the mechanism customers use when they want to understand a specific outcome. The aggregate dashboard builds trust; the per-ticket view provides evidence.

---

## 8. Dimension 5: Reversibility Model

### The Manifesto Requirement

*"Every action is: reversible, observable, auditable."* (Manifesto, Principle 3)

### Current State: Zero Reversibility

No rollback mechanism exists. No revert capability exists. The 9 failed deployments have no recorded remediation. When a deployment fails, there is no way to undo it through Helix.

### Technical Feasibility Assessment

Reversibility is platform-dependent. The ownership model must separate the *concept* of rollback (platform-agnostic) from the *execution* of rollback (platform-specific).

**Standard deployments (Vercel, DigitalOcean):**
- Vercel supports deployment rollback via API (promote a previous deployment)
- DigitalOcean App Platform supports rollback to previous deployments
- Git-based rollback (revert commit, push, redeploy) is always available
- **Feasible** --- the infrastructure supports it; Helix needs the workflow

**NetSuite SDF deployments:**
- SDF `suitecloud project:deploy` applies objects to NetSuite. Rollback is not a native SDF operation.
- Partial rollback is possible by redeploying a previous known-good state
- Some object types (saved searches, workflows) can be individually reverted; others (record type changes) are harder
- **Technically constrained** --- not atomic, not fully reliable

### Rollback as a First-Class Concept

Even when technical execution is limited, rollback should be a first-class concept in the ownership model. A "remediation event" records:

| Attribute | Description |
|-----------|-------------|
| Trigger | What caused the rollback (human intervention, automated breakage detection) |
| Target | What is being rolled back (deployment ID, affected scripts/objects) |
| Plan | What the rollback strategy is (redeploy previous state, revert specific objects) |
| Execution | What happened during rollback (success, partial, failed) |
| Accountability | Who initiated, what evidence supported the decision |

### Phased Approach

| Phase | Capability | Timeline |
|-------|-----------|----------|
| Record the intent | Log rollback requests as decision events, even if execution is manual | 3 months |
| Standard platform rollback | Automated rollback for Vercel/DigitalOcean deployments | 6 months |
| NetSuite partial rollback | Redeploy previous known-good state for supported object types | 12 months |
| Full orchestrated rollback | Cross-system rollback with dependency awareness | 18+ months |

### Key Tradeoff

Full automated rollback is a 12-month+ capability. The 3-month milestone should focus on recording rollback *intent* and *plan*, even if execution is manual. This is still a significant improvement over the current state (zero accountability for failures).

---

## 9. Dimension 6: Continuity Model

### The Manifesto Requirement

*"Helix does not complete tasks. Helix maintains systems."* (Manifesto, Principle 6)

### Current State: Ownership Ends at DEPLOYED

The ticket lifecycle has no status beyond DEPLOYED. Once a ticket reaches DEPLOYED, Helix's involvement ends. There is no:
- Scheduled health check
- Breakage detection
- Ongoing monitoring
- Anomaly alerting
- Dependency tracking

This contradicts the Manifesto's most distinctive principle. If ownership ends at deployment, Helix is just a delivery system. The thing that makes Helix different from consultants and AI tools is *continuity* --- staying accountable for the outcome over time.

### What Post-Deployment Monitoring Looks Like

After deployment, Helix should:

1. **Record a "continuity assertion"** --- ownership explicitly continues beyond DEPLOYED
2. **Monitor the deployed change** --- check that it is working as expected
3. **Detect anomalies** --- identify when something breaks or behaves unexpectedly
4. **Log monitoring outcomes** --- record health checks in the decision trail
5. **Escalate when needed** --- alert humans when anomalies exceed thresholds

### Platform-Specific Monitoring

**NetSuite:**
- NetSuite does not expose real-time execution logs for SuiteScript via API
- Execution logs can be queried via SuiteTalk/REST (polling, not streaming)
- Script errors surface in the Execution Log within NetSuite
- **Approach**: Polling-based monitoring on a schedule (daily initially, increasing based on customer tier)

**Standard platforms (Vercel, DigitalOcean):**
- Both expose deployment health and status via API
- Error rates and response times available
- **Approach**: API-based health checks on a regular interval

### The Continuity Contract

The ownership framework should define a "continuity contract" --- a formal specification of what Helix monitors, how often, and what triggers action:

| Parameter | Value | Configurable? |
|-----------|-------|---------------|
| Monitoring frequency | Daily (default) | Yes, per customer tier |
| Health check scope | Deployment status + error rate | Yes, per deployment type |
| Anomaly threshold | Platform-specific defaults | Yes, per customer |
| Escalation target | Director or reporter | Yes |
| Monitoring duration | Indefinite (default) | Yes, with minimum 30 days |

### Key Tradeoff

Monitoring is expensive in engineering effort and runtime cost. The 6-month milestone should define the monitoring contract without building a full monitoring pipeline. The 12-month milestone is where persistent account memory and active monitoring should exist.

---

## 10. Technical Architecture Direction

### Core Architecture Decision: Separate Ownership Event Log

The ownership framework recommends an **append-only ownership event log** as the core data architecture. This decision was evaluated against three options:

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Extend existing models with fields | Add `ownedBy`, `decisionReason` fields to Ticket, Deployment | **Rejected** --- mixes concerns, overwrites history |
| B. Separate append-only event log | New model(s) for immutable ownership events | **Chosen** --- clean separation, preserves history |
| C. External event store | Event sourcing system outside main DB | **Rejected** --- over-engineered for current scale |

### Why Option B

The server already has a proven pattern for append-only logging: `InspectionAuditLog`. This model uses fire-and-forget async writes via `src/services/inspection-audit-service.ts` (39 lines of code). It is non-blocking, proven at scale (2,073 entries), and extensible.

Extending this pattern to lifecycle events is the smallest correct change that satisfies the ownership thesis. It preserves existing operational models while creating a clean accountability surface.

**The key insight**: Ownership is not a field on a ticket --- it is a trail of events. Helix asserts ownership at each lifecycle stage; each assertion is an immutable record. This matches the Manifesto's "fully and forever" principle and the "every action is auditable" safety requirement.

### Performance Expectations

| Operation | Target | Rationale |
|-----------|--------|-----------|
| Ownership event writes | <10ms added latency, fire-and-forget | Non-blocking to workflow orchestrator |
| Decision trail queries | <50ms at current scale (265 tickets) | Read-heavy, indexed on ticketId + createdAt |
| Accountability dashboard queries | <500ms at current scale | Aggregate queries, acceptable for analytics views |
| No regression on existing flows | 0ms impact on workflow transitions | Fire-and-forget pattern ensures this |

### Write Guarantee Tradeoff

The fire-and-forget pattern means audit writes can fail silently. For data inspection (current use) this is acceptable. For ownership accountability, silent failures are more concerning. The recommendation:

- **3-month milestone**: Use fire-and-forget (matches existing pattern, lowest risk)
- **6-month milestone**: Evaluate failure rate; add dead-letter queue or retry if needed
- **18-month milestone**: Evaluate transactional writes for institutional trust requirements

### Server Integration Points

The ownership event log integrates with the existing server architecture at these points:

| Integration Point | What Happens |
|-------------------|-------------|
| Workflow orchestrator (`src/helix-workflow/`) | Emit ownership assertions and decision events at each status transition |
| Deployment service | Emit deployment authorization decisions with evidence |
| Verification service | Emit verification outcomes with structured reasoning |
| Comment service (`src/services/comment-service.ts`) | Record human interventions (comments, director changes) |
| Inspection audit service (`src/services/inspection-audit-service.ts`) | Template for the new event log service |
| API routes (`src/routes/api.ts`) | New endpoints to serve ownership data to the client |

---

## 11. UI Surface Requirements

### Current Ownership UI: Minimal

The client has only two ownership components:
- **Director Picker** (`src/components/director-picker.tsx`): Optional human assignment, 6.8% adoption
- **Director Indicator** (`src/components/director-indicator.tsx`): Colored initials avatar

Everything else in the UI is lifecycle display with no approval gates: status badges, run history, proof viewer, board view, deployment center.

### Required New Surfaces

The diagnosis identified six categories of missing UI, each mapped to a Manifesto principle:

| Surface | Manifesto Principle | What It Shows | Timeline |
|---------|-------------------|---------------|----------|
| **Decision Trail View** | 4. Decision Ownership | Per-ticket chronological log of every Helix decision | 3 months |
| **Accountability Dashboard** | 8. Trust Through Behavior | Helix's aggregate track record | 3-6 months |
| **Verification-by-Exception Controls** | 7. Calibrated Understanding | Post-hoc review and intervention UI | 6 months |
| **Ownership Indicators** | 1. Responsibility | Lightweight badges on existing views | 3 months |
| **Rollback Controls** | 3. Safety (reversible) | Trigger remediation workflow | 12 months |
| **Escalation/Alert Configuration** | 9. Extreme Customer Support | Notification preferences | 18 months |

### Architecture Decision: Dedicated Surfaces

New ownership surfaces should be *dedicated routes alongside existing views*, not embedded into existing views. The existing ticket detail view, board view, and deployment center stay focused on their current purpose. Lightweight ownership indicators (badges, status annotations) on existing views link to the full ownership surfaces.

This follows the "Helix proactively shows what it owns" principle --- ownership is visible, not buried.

### Foundation Components

The client already has patterns that map to the new surfaces:

| New Surface | Existing Foundation | Reuse Strategy |
|-------------|-------------------|----------------|
| Decision Trail | Run history (`src/components/run-history.tsx`) | Extend with reasoning and evidence, not just status |
| Accountability Dashboard | Usage metrics (`src/routes/usage.tsx`) | Same interaction pattern: period filtering, sortable tables, summary cards |
| Verification-by-Exception | Proof viewer + Report viewer | Wrap with lightweight intervention controls |
| Ownership Indicators | Director indicator | Replace human avatar with Helix ownership status |

### No Approval Gate UI

The board view should not get an "Awaiting Approval" column. The deployment center should not get an "Approve" button. The ticket creator explicitly rejected this, and the production data confirms it: humans do not use optional ownership controls, and mandatory gates would re-introduce the bottleneck Helix eliminates.

---

## 12. Roadmap Mapping

The Reality Check document establishes time-bound milestones. The ownership framework maps concrete capabilities to each:

### 3 Months: Helix is Safe

*"Kill anything that looks like generic AI convenience."*

| Capability | Ownership Dimension | Description |
|-----------|---------------------|-------------|
| Append-only decision log | Decisions | Every lifecycle transition recorded with reasoning |
| Extended audit trail | Accountability | Lifecycle events logged alongside existing data inspection events |
| Basic ownership assertions | Assertion | Helix records "I own this" at each status transition |
| Decision trail view (UI) | Accountability | Per-ticket chronological decision log visible to customers |
| Ownership indicators (UI) | Assertion | Lightweight badges on ticket cards and board view |
| Deployment evidence linking | Decisions | Each deployment linked to the evidence that justified it |

**What this proves**: Helix is a controlled system with an audit trail, not a clever tool.

### 6 Months: Helix is Trusted in One Lane

*"Kill breadth. Own one thing completely."*

| Capability | Ownership Dimension | Description |
|-----------|---------------------|-------------|
| Decision log with reasoning | Decisions | Structured reasoning and evidence references in every decision |
| Deployment accountability | Accountability | Full decision trail for every deployment: why, what evidence, what risk |
| Accountability dashboard (UI) | Accountability | Aggregate track record visible to customers |
| Verification-by-exception (UI) | Verification | Post-hoc review and intervention controls |
| Standard platform rollback | Reversibility | Automated rollback for Vercel/DigitalOcean deployments |
| Evaluate audit write guarantees | Decisions | Assess fire-and-forget reliability; add retry if needed |

**What this proves**: Helix can be trusted to own one workflow category end-to-end.

**Critical market signal**: By 6 months, "AI for NetSuite" as a positioning starts becoming a bad place to stand. The only defensible zone is governed execution plus durable account-specific memory.

### 12 Months: Helix is Stateful and Persistent

*"Kill statelessness. The account must live inside Helix."*

| Capability | Ownership Dimension | Description |
|-----------|---------------------|-------------|
| Persistent account memory | Continuity | Cross-ticket dependency graph, knowledge of what changed and what depends on what |
| Post-deployment monitoring | Continuity | Polling-based health checks for deployed changes |
| Active breakage detection | Continuity | Detect when deployed changes cause issues |
| NetSuite partial rollback | Reversibility | Redeploy previous known-good state for supported object types |
| Rollback controls (UI) | Reversibility | Customer-facing rollback trigger in the UI |
| Monitoring dashboard (UI) | Continuity | Post-deployment health visibility |

**What this proves**: Helix knows the account over time and maintains ongoing accountability.

**Critical market signal**: By 12 months, the real split appears between native AI features (inside the ERP) and true ownership layers (external). Helix must be on the ownership side.

### 18 Months: Helix is Institutionally Trusted

*"Kill informality. Trust has to survive compliance, fear, and production reality."*

| Capability | Ownership Dimension | Description |
|-----------|---------------------|-------------|
| Configurable governance thresholds | Verification | Per-customer, per-risk-level escalation policies |
| Escalation policy configuration (UI) | Verification | Customer-configurable notification and intervention preferences |
| Formal audit export | Accountability | Compliance-ready export of ownership and decision trails |
| Stronger write guarantees | Decisions | Transactional writes for ownership events (not fire-and-forget) |
| Cross-system orchestration | Continuity | Ownership spans multiple connected systems |

**What this proves**: Organizations can delegate operational authority to Helix and satisfy compliance requirements.

### 36 Months: Helix is the Ownership Layer, or Dead

*"Kill wrapper behavior. Either Helix is the ownership layer or it is dead."*

| Capability | Description |
|-----------|-------------|
| Full ownership lifecycle | Assert, decide, execute, monitor, remediate, report |
| Account-specific operational memory | Deep, persistent knowledge of each customer's environment |
| Cross-system governance | Ownership across NetSuite + connected systems |
| Institutional trust infrastructure | Audit, compliance, formal governance, configurable boundaries |

**The test**: Is Helix the place where account-specific business logic, approvals, monitoring, deployment control, rollback, and ongoing operational accountability live? If yes, there is a real company. If Helix is still mainly a better way to ask for changes, it gets compressed hard.

---

## 13. Open Questions and Risks

### Critical Open Questions

| Question | Context | Recommendation |
|----------|---------|----------------|
| **What happens when Helix gets it wrong at scale?** | 9 of 63 deployments failed. No remediation exists. As volume grows, failure handling becomes critical. | Decision log + rollback model address this, but the 3-month milestone should include failure accountability even before rollback capability exists. |
| **Does "Helix owns outcomes" create legal liability?** | The Manifesto says "fully and forever." Customer contracts and SLAs may be affected. | Flag for legal review. The ownership assertion model should be designed so it can be scoped appropriately per customer agreement. |
| **How do customers build trust before seeing a track record?** | Cold-start problem: the "intervene by exception" model requires trust that does not yet exist. | Use current production data (265 tickets, 84.1% deployment success) as initial trust foundation. Accountability dashboard is the primary trust-building mechanism. |
| **Where is the line between "intervene by exception" and "no human oversight"?** | Regulators, auditors, and risk-averse customers may not accept pure autonomous operation. | The framework includes configurable governance thresholds (18-month milestone). Early customers should see clear escalation policies. |
| **Can Helix actually rollback a NetSuite deployment?** | SDF does not support atomic rollback. Partial reversal is possible for some object types. | Design rollback as "best effort with accountability" rather than "guaranteed atomic revert." Record what was attempted and what succeeded. |
| **What does post-deployment monitoring look like for NetSuite?** | NetSuite's observability surface for custom scripts is limited (execution logs via SuiteTalk, polling-based). | Start with low-frequency polling (daily). Increase based on customer tier and criticality. |

### Key Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Framework stays philosophical** | High | Ground every dimension in existing data model and production behavior. Every assertion, decision, and metric must be testable. |
| **Legal liability of ownership claims** | High | Scope ownership language in customer contracts. "Helix owns accountability for the process" is different from "Helix is liable for business outcomes." |
| **Fire-and-forget audit writes fail at scale** | Medium | Evaluate write guarantees at 6-month milestone. Add dead-letter queue if failure rate exceeds threshold. |
| **NetSuite rollback is technically infeasible** | High | Design rollback as "best effort" with accountability. Partial rollback + recorded intent is better than no rollback. |
| **Cold-start trust problem** | Medium | Start with high-visibility accountability dashboards. Use internal monitoring to build initial track record data. |
| **Monitoring costs exceed value** | Medium | Start with low-frequency polling. Monitor cost/value ratio. Increase frequency based on customer tier. |

### The Director Question

The existing director role (6.8% adoption) needs a clear evolution path. The recommendation:

- **Director stays** as a field, but its meaning shifts from "who oversees this ticket" to "who receives escalations when Helix needs human input"
- Director is **not required** for any lifecycle transition (preserving current autonomous behavior)
- Director becomes the **"exception intervener"** --- the human who gets notified when Helix's decision trail indicates something needs attention
- This is a conceptual shift, not a code change (for now)

---

## 14. Competitive Positioning

### The Two-Sided Compression

The Reality Check document frames the competitive landscape as two-sided compression:

```
Oracle/NetSuite compressing from the left
   (native AI features, agentic workflows, extensibility)

AI model vendors compressing from the right
   (Claude Code, Codex, enterprise agents, safer autonomy)

Helix's defensible zone: the governed execution layer in the middle
```

### What Each Side Will Not Own

**Oracle/NetSuite** will continue shipping native AI features: conversational intelligence, agentic workflows, natural-language search, AI-native SuiteCloud development. But NetSuite is not naturally in the business of owning each customer's custom operational layer. It provides the platform and supports customization --- it does not take end-to-end accountability for how individual business flows evolve.

**AI model vendors** (Anthropic, OpenAI) will continue pushing coding agents, safer autonomy, sandboxing, and enterprise deployment. But they are in the business of generating, reasoning, and helping --- not taking durable operational ownership of production ERP environments. Anthropic's own documentation includes examples of agentic misbehavior (deleting branches, exposing tokens, running migrations against production) that illustrate why "generic model in production NetSuite" remains a governance problem.

### Helix's Ownership Moat

The ownership framework is the competitive moat. Specifically:

| Ownership Dimension | Why Competitors Cannot Easily Replicate |
|--------------------|-----------------------------------------|
| **Ownership assertions** | Requires living inside the customer's workflow lifecycle, not just generating into it |
| **Decision trail** | Requires structured reasoning about domain-specific decisions, not general-purpose reasoning |
| **Account memory** | Requires persistent, cross-ticket knowledge that generic models do not carry |
| **Governed deployment** | Requires sandbox-to-production execution with accountability, not just code generation |
| **Rollback capability** | Requires understanding of deployed state + platform-specific revert mechanics |
| **Post-deployment monitoring** | Requires ongoing engagement with the production environment, not just task completion |

### The Timeline Pressure

The Reality Check assessment is direct:
- **3 months**: "AI that generates NetSuite customizations" is already commoditizing. "AI that safely owns the account-specific operational layer" is still open.
- **6 months**: Capability is abundant, governance is scarce. Helix needs visible trust infrastructure.
- **12 months**: The real split between native AI features and true ownership layers. Helix must be on the ownership side.
- **18 months**: Trust, governance, and operational continuity are the deciding factors.
- **36 months**: Either Helix is a real system-of-operation, or it gets compressed into tooling.

---

## 15. Recommendations for Next Steps

### Immediate (This Quarter)

1. **Define the ownership event schema** --- Concrete Prisma model for the append-only ownership event log, extending the `InspectionAuditLog` pattern. This is the data foundation for everything else.

2. **Instrument the workflow orchestrator** --- Add ownership event emission at every lifecycle transition in `src/helix-workflow/`. Start with the simplest assertion: "Helix owns ticket X at stage Y."

3. **Build the decision trail view** --- The simplest UI surface that makes ownership visible: a per-ticket timeline showing what Helix decided, when, and why.

4. **Add ownership indicators to the board view** --- Lightweight badges showing "Helix owns this" with links to the decision trail. Replace the near-invisible director indicator.

### Next Quarter

5. **Ship the accountability dashboard** --- Aggregate metrics (success rates, failure rates, deployment outcomes) using the existing usage page pattern.

6. **Implement deployment accountability** --- Link every deployment to the decision that authorized it, with evidence references.

7. **Build verification-by-exception controls** --- Post-hoc review UI wrapping existing proof viewer and report viewer.

8. **Implement standard platform rollback** --- Automated rollback for Vercel/DigitalOcean deployments.

### Design Reviews Needed

9. **Legal review of ownership language** --- Before codifying "Helix owns outcomes" in customer-facing assertions, get legal input on liability implications.

10. **Cold-start trust playbook** --- Define how to onboard customers who have not yet seen Helix's track record, including what data to show, what guarantees to make, and what escalation policies to offer.

### What This Report Does Not Address (Deferred to Future Drafts)

- Specific Prisma schema design (implementation-level detail)
- API endpoint specifications (implementation-level detail)
- Multi-tenant ownership isolation (important at scale, not current concern)
- Pricing/billing implications of ownership (separate business decision)
- Regulatory compliance mapping (requires legal input)
- Governance threshold configuration details (18-month capability)

---

## Methodology and Data Sources

This research was conducted by analyzing four categories of evidence:

### 1. Strategic Documents (Provided Attachments)
- **Helix Manifesto** --- Nine principles defining the ownership philosophy
- **Helix Positioning (Refined)** --- Structural gap analysis: ERP vs. consultants vs. AI models
- **Reality Check & Risks** --- Time-bound competitive roadmap with 3/6/12/18/36 month milestones
- **Helix Tagline** --- Brand positioning centered on "Owned operations"

### 2. Production Database (Live Queries)
All quantitative claims are backed by real-time queries against the production database:
- Ticket counts, status distributions, director adoption rates
- Deployment success/failure rates
- Sandbox run and verification report coverage
- Audit log entry counts and types
- Organization count

### 3. Codebase Analysis (Three Repositories)
- **helix-global-server**: Prisma schema, workflow orchestrator, audit service, deployment model, API routes
- **helix-global-client**: UI components, routes, existing ownership surfaces, usage analytics
- **helix-cli**: Identity attribution infrastructure, agent vs. human token types, comment system

### 4. Technical Research
- Server-side architecture options for ownership data model
- Client-side UI surface requirements and interaction models
- Cross-platform considerations (NetSuite vs. standard deployments)
- Performance expectations and dependency analysis

---

## Appendix A: Manifesto Principle Mapping

| Manifesto Principle | Ownership Dimension | Current Gap | 3-Month Target |
|--------------------|--------------------|-------------|----------------|
| 1. Responsibility | Assertion | No ownership assertions exist | Record Helix's ownership at every lifecycle stage |
| 2. Completion | Assertion + Decisions | Lifecycle runs but is not recorded | Decision log captures the full lifecycle trail |
| 3. Safety (reversible, observable, auditable) | Reversibility + Accountability | Observable via audit (inspection only). Not reversible. Lifecycle not auditable. | Extended audit trail + rollback intent recording |
| 4. Decision Ownership | Decisions | Workflow orchestrator decides but does not record | Structured decision log with reasoning and evidence |
| 5. Opinionated by Design | Assertion | N/A (already opinionated) | Ownership assertions are automatic, not opt-in |
| 6. Continuity | Continuity | No post-deployment monitoring | Continuity contract defined (execution at 12 months) |
| 7. Calibrated Understanding | Verification | Verification happens but no human review model | Verification-by-exception UI (6 months) |
| 8. Trust Through Behavior | Accountability | No track record visible | Accountability dashboard (3-6 months) |
| 9. Extreme Customer Support | Verification + Continuity | No escalation or alert system | Escalation triggers defined (3 months), configuration UI (18 months) |

---

## Appendix B: Cross-Platform Ownership Matrix

| Ownership Dimension | NetSuite-Specific | Transferable Pattern |
|--------------------|-------------------|---------------------|
| Ownership Assertions | Same | Fully platform-agnostic |
| Decision Log | Same | Fully platform-agnostic |
| Verification | Sandbox screenshots + SuiteScript tests | Verification model is already platform-neutral |
| Accountability Dashboard | Same | Fully platform-agnostic |
| Reversibility | SDF deploy is not atomically reversible; partial rollback only | Rollback *model* is agnostic; rollback *execution* is platform-specific |
| Post-Deployment Monitoring | NetSuite execution logs via SuiteTalk polling | Monitoring *contract* is agnostic; monitoring *data source* varies |

The ownership *model* (assertions, decisions, accountability) is platform-agnostic. The ownership *execution* (rollback mechanics, monitoring probes) is platform-specific. Separating these concerns cleanly ensures the framework transfers to non-NetSuite contexts.

---

*This is a first draft. The ticket creator expects iterative refinement: "I don't expect it all to be done today. I don't think we're going to nail it but this is the first of many drafts so just start exploring some ideas and we'll continue from there."*

*The framework is grounded in production reality (265 tickets, 53 successful deployments, 9 failures, 2,073 audit entries) and mapped to the competitive roadmap. The next draft should incorporate feedback on the design dimensions, prioritization of specific dimensions, and legal review of ownership language.*

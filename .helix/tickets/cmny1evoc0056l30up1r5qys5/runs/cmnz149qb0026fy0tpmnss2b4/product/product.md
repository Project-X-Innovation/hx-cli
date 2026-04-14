# Product Definition — RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Problem Statement

There is a structural ownership gap in the ERP ecosystem. Three parties touch the custom operational layer around ERPs like NetSuite, but none of them own it durably:

1. **ERPs** standardize business complexity with baked-in financial and accounting rules, but they do not own each customer's custom operational layer over time. They provide infinite customizability but take no end-to-end accountability for how individual business flows evolve.
2. **Consultants** implement the custom layer, but do not persist. They cycle in and out, leaving fragmented logic, inconsistent documentation, and scripts nobody fully understands.
3. **AI models** can generate into the custom layer, but do not govern it. They do not remember the account over time, do not test in sandbox, do not deploy safely to production, do not monitor outcomes, and do not carry accountability when something breaks.

Meanwhile, a macro trend is accelerating the problem: businesses are downsizing their internal operating teams. The same business complexity that required 100 people around the ERP may soon require 10. The ERP still matters. The business is just as complex. But the human operating layer is shrinking dramatically.

**Nobody owns the most important business-specific layer. That is the opportunity.**

## Product Vision

Helix exists to permanently own the operational layer in between.

Not the ERP itself. Not general-purpose AI generation. Not temporary consulting. Helix takes durable ownership of the custom operational layer around ERPs: the customizations, the flows, the logic, the changes, the maintenance, the monitoring, and the continuity over time.

The core thesis: ERPs will go the way of databases. Databases are used everywhere, but nobody interacts with them directly anymore. ERPs will become the same — infrastructure with baked-in financial and legal rules. The interface layer between users and ERPs will be an AI-powered operational platform like Helix.

**Compressed thesis for pitch:**
> NetSuite standardizes complexity, but does not own each customer's custom operational layer.
> Consultants implement that layer, but do not stay.
> AI models generate into that layer, but do not govern it.
> Meanwhile, the human teams around ERP are shrinking while the business complexity stays the same.
> **Helix exists to permanently own the operational layer in between.**

**Brand line:** "Owned operations."
**Investor line:** "The ownership layer for NetSuite."
**Supporting line:** "NetSuite owns the platform. Helix owns the operational layer inside your account."

## Users

| User Segment | Description | Pain Point |
|---|---|---|
| **NetSuite customers (primary)** | 40,000+ companies globally spending $5K-$20K/mo on consultants for customizations, reporting, debugging, deployments | Slow, expensive, never-ending consultant dependency; weeks for simple changes; fragmented knowledge across consultant rotations |
| **Internal NetSuite admins** | Operations staff managing ERP customizations, often on shrinking teams | Drowning in customization requests; bottlenecked by IT or external consultants for every workflow change |
| **Finance/accounting teams** | Departments dependent on accurate ERP-driven processes | Reports take days; custom logic is fragile; no persistent accountability for the operational layer |
| **IT leadership** | Decision-makers evaluating ERP operational costs amid headcount reductions | $5K-$20K/month on consultants with no persistent ownership; internal teams shrinking while complexity stays constant |

**Initial beachhead:** Mid-market NetSuite companies with active customization needs and ongoing consultant spend.

**Expansion path:** SAP, Odoo, and other ERPs — the structural gap is not NetSuite-specific.

## Use Cases

1. **Customization lifecycle ownership** — A business needs a new operational flow. Instead of engaging a consultant for weeks, they describe what they need. Helix takes it from request through safe testing, governed deployment, and ongoing maintenance — and remains accountable for it over time.

2. **Operational continuity across consultant turnover** — A company's third consultant in two years has just left. Existing customizations are undocumented and fragile. Helix takes persistent ownership of the custom operational layer, understands what exists, monitors it, and maintains it going forward.

3. **Team augmentation under downsizing** — An operations team of 50 is being cut to 15. The ERP complexity hasn't changed. Helix replaces the missing operational capacity by autonomously handling the customization, maintenance, and monitoring workload that the departed team members used to carry.

4. **Production issue resolution** — Something breaks in the live ERP environment. Instead of opening a support ticket and waiting days, Helix inspects the production state, diagnoses the root cause, and resolves it — with full auditability and rollback capability.

5. **Department-ready reporting** — A finance or ops team needs a custom report. Hours of consultant work becomes minutes of platform work — without pushing responsibility back to the requester.

## Core Workflow

At the highest level, Helix accomplishes the following:

**Intent in, owned outcomes out.**

1. **Receive intent** — The user describes what they need in natural language.
2. **Investigate** — Helix understands the current state of the account and the implications of the request.
3. **Plan and build** — Helix creates the solution, applying opinionated judgment rather than just generating options.
4. **Test safely** — Every change is validated in a safe environment before touching production.
5. **Deploy with governance** — Production deployment happens with human approval gates, audit trails, and rollback capability.
6. **Monitor and maintain** — Helix watches the deployed change, detects breakage, and takes corrective action. The work is not "done" — it is continuously owned.

This is fundamentally different from what AI tools or consultants offer. AI tools stop after generation. Consultants stop after implementation. Helix persists.

## Essential Features (MVP)

Described at the highest capability level, reflecting what the platform accomplishes:

1. **Autonomous operational lifecycle** — End-to-end handling of customization requests from natural language intent through governed production deployment, without requiring the user to manage intermediate steps. 81% of all tickets run autonomously.

2. **Governed execution** — Every action is reversible, observable, and auditable. Trust is not assumed; it is engineered through safe testing, approval gates, and deployment controls.

3. **Production inspection** — Read-only visibility into the live ERP environment to support diagnosis, monitoring, and proactive issue detection without risk to the running system.

4. **Account continuity** — Persistent, durable memory of the account over time: what changed, what depends on what, what is fragile, and why decisions were made. 33 configured repositories across 7 organizations demonstrate multi-environment depth.

5. **Bidirectional communication** — Real-time interaction between the platform and human stakeholders, so intent can be clarified, decisions can be discussed, and accountability is visible at every step.

6. **Enterprise security** — Encrypted credential management, role-based access, and organizational isolation appropriate for handling production ERP environments that run entire businesses.

7. **Extreme customer support at speed** — The platform combines the ownership posture of a consultant with the speed of software. Tickets that used to take weeks can be resolved in minutes.

## Features Explicitly Out of Scope (MVP)

| Feature | Rationale |
|---|---|
| **Replacing the ERP itself** | Helix owns the operational layer around the ERP, not the ERP. "If NetSuite can own it, we don't build it." |
| **Generic AI coding tool** | "If Claude Code can do it, it's not enough." Helix competes on governed ownership, not generation. |
| **Multi-ERP support (SAP, Odoo)** | Vision includes expansion, but MVP focuses exclusively on NetSuite to own one lane completely before broadening. |
| **In-product AI features that overlap with native ERP AI** | NetSuite will add natural language search, AI helpers, and in-product intelligence. Helix does not compete there. |
| **Finesse Contracts or Haven AI** | Separate products in the Project X Innovation portfolio. This pitch focuses exclusively on Helix. |

## Success Criteria

### For the Pitch Deck (Immediate Deliverable)

| Criterion | Measure |
|---|---|
| Positioning clarity | The three-way structural gap thesis is articulated in investor-ready language that any investor can grasp in 60 seconds |
| Market validation | TAM is framed with both conservative and ambitious numbers, supported by external data |
| Financial credibility | Dovie projections are presented with honest stress-testing and recommended investor framings |
| Competitive differentiation | Clear argument for why Oracle/NetSuite won't own this layer and why AI models won't either |
| Traction evidence | Production metrics demonstrate real usage — not just a prototype |
| Branding readiness | Taglines and positioning language are pitch-ready |

### For the Business (Milestone-Based Kill-or-Continue Gates)

From the Reality Check document:

| Horizon | Helix Must Be | Kill Rule |
|---|---|---|
| 3 months | **Safe** — controlled system, not clever tool | Kill anything that looks like generic AI convenience |
| 6 months | **Trusted in one narrow lane** — customers rely on it for one workflow class | Kill breadth. Own one thing completely |
| 12 months | **Stateful and persistent** — account memory, dependency awareness, breakage detection | Kill statelessness. The account must live inside Helix |
| 18 months | **Governable by an institution** — formal approval flows, compliance-ready | Kill informality. Trust must survive compliance and production reality |
| 36 months | **Where the owned operational layer lives** — the durable system-of-operation | Kill wrapper behavior. Either Helix is the ownership layer or it is dead |

## Key Design Principles

From the Helix Manifesto (the internal product bible):

1. **Responsibility** — "If Helix touches it, Helix is responsible for it. Not partially. Not temporarily. Fully. And forever."
2. **Completion** — Created, tested, deployed, verified. What Helix does is done.
3. **Safety** — Every action is reversible, observable, auditable. Trust is engineered, not assumed.
4. **Decision Ownership** — All decisions flow through Helix; once executed, Helix owns them.
5. **Opinionated by Design** — "People do not pay Helix for flexibility. They pay for the right defaults, the right actions, and the right decisions."
6. **Continuity** — Helix maintains systems, not just tasks.
7. **Trust Through Behavior** — "Generating code is commoditized. Reliability is not."

**The boundary test:** "If Claude Code can do it, it's not enough. If NetSuite can own it, we don't build it."

**The core distinction:** "Intelligence is not the product. Responsibility is."

**What Helix is not:** "Helix is not a tool. Tools assist. Helix operates. Tools suggest. Helix executes. Tools are used. Helix is relied on."

## Scope & Constraints

### Market Sizing

| TAM Frame | Calculation | Assessment |
|---|---|---|
| Conservative near-term (NetSuite only) | 10K companies with ongoing customization x $5K/mo x 12 | **$600M** — defensible floor |
| Mid-range (NetSuite) | 40K+ companies x $5K-$20K/mo x 12 | **$2.4B-$9.6B** — upper bound overstates continuous spend |
| AI-in-ERP market (macro) | $5.82B (2025) growing to $58.7B (2035) at 26% CAGR | Macro tailwinds validated |
| Multi-ERP expansion (long-term) | ERP consulting/integration market | **$50.1B** (2024) — long-term vision framing |

### Financial Model (Dovie Offer, April 2026 — Most Recent)

| Metric | Value |
|---|---|
| Pre-money valuation | $2.83M |
| Current investment ask | $50K for 2% or $100K for 4% (with net profit distributions) |
| Customer trajectory | 0 to 999 over 36 months at ~$1,500/mo average |
| Profitability | Month 6 (42 customers) |
| Payback | Month 22 |
| 12-month ARR | ~$1.8M (102 customers) |
| 36-month ARR | ~$18M |
| Monthly operating costs | $50K (flat) |
| Exit scenarios | $50M (early, 18mo) / $100M (growth, 36mo) / $150M (strategic, 36mo) |

### Financial Model Stress Points (Proactive Investor Framing)

| Assumption | Concern | Recommended Framing |
|---|---|---|
| $50K/mo flat costs through 999 customers | AI inference, infrastructure, and support scale with usage | Show cost-scaling tiers or explain efficiency leverage |
| Zero churn modeled | Even 2-3% monthly churn significantly impacts net growth at scale | Frame as conservative net-new projection; add churn sensitivity |
| Starting at 0 paying customers now | 5 NS orgs active in production but none confirmed paying | Frame as "conversion-ready pipeline" with beta traction |
| $1,500/mo average price | Below the $5K-$20K/mo consultant replacement value | Frame as pricing upside: land at $1.5K, expand to $5K+ as ownership deepens |
| Oracle/Next Technik $60M exit comp | Acquisition price not publicly disclosed | Use as directional reference, not confirmed valuation |

### Production Traction (April 2026)

| Metric | Value | Investor Narrative |
|---|---|---|
| Organizations | 7 (5 NetSuite, 2 General) | Multi-industry early adoption |
| Users | 22 | Team-level engagement, not single-user trials |
| Total tickets | 264 (143 in first 14 days of April) | Accelerating: on pace for 2x month-over-month growth |
| Tickets deployed to production | 124 (47% of total) | Real production impact, not experimentation |
| Configured repositories | 33 | Deep integration across customer environments |
| Autonomous execution rate | 81% of tickets in AUTO mode | Platform operates independently |

**Concerns to address proactively:**
- 55% overall run success rate — frame as "beta maturity with improving trajectory"
- 31% NetSuite deployment success vs 84% general — frame as "the hardest pipeline" with a clear improvement path; this is where the product is newest
- No billing/subscription data in production — revenue is pre-commercialization

### Competitive Landscape

**Tier 1: Oracle/NetSuite (ERP Platform)**

Oracle is moving faster than "cute features." NetSuite Next (rolling out mid-2026) includes agentic workflows, conversational intelligence, AI-native extensibility, and connectors to external AI assistants. SuiteAgents let developers build autonomous agents on the platform. NetSuite 2026.1 includes AI across financial close, reconciliation, forecasting, and developer tooling.

*Why Helix is still differentiated:* Oracle's AI is about in-platform intelligence and developer enablement. It does not mean Oracle is stepping in to permanently own, govern, deploy, monitor, and maintain each customer's custom operational layer over time. That layer remains structurally unclaimed.

**Tier 2: AI-Native ERP Replacements**

Rillet ($100M raised, 2025), Campfire ($100M raised) — these aim to *replace* ERPs with AI-native alternatives. Different buyer, different motion. They validate that the market sees ERP as ripe for disruption, but they attack the platform itself rather than the operational layer around it.

**Tier 3: AI Coding Tools**

General-purpose coding agents are increasingly capable at code generation, test running, and PR creation. But they do not handle ERP-specific lifecycle governance: safe deployment to production environments that run entire businesses, monitoring, rollback, ongoing maintenance, or durable account memory. They help the user act. They do not own the action.

**Key competitive insight (from the Reality Check):** "Capability is abundant, governance is scarce." The real threat model is not "NetSuite on the left, AI tools on the right." It is Oracle compressing the obvious product layer, AI models compressing the obvious capability layer, and Helix owning the governed execution layer that neither side wants to fully own.

### Team

7-person core team with 1-4 years working together: CEO/Founder, Tech Lead (AI Research), AI Agent Architect, Project Manager, Lead Dev (NetSuite/OSS contributor), Full Stack Dev, Special Projects. Tight-knit, role-specialized, battle-tested.

### Investment Structure

Two tiers observed in evidence:
- **Small raise (Dovie, April 2026):** $50K for 2% or $100K for 4%, with net profit distributions
- **Larger raise (One-Pager, March 2026):** $500K for 15% at same $2.83M pre-money

Both share the same pre-money valuation. Relationship between these two vehicles is unclear from current evidence.

## Future Considerations

1. **Multi-ERP expansion** — The structural gap (ERP doesn't own custom layer, consultants don't persist, AI doesn't govern) is not NetSuite-specific. SAP, Odoo, and other ERPs represent a path from a $600M near-term floor to the $50B+ ERP consulting market.

2. **The "ERP as database" future** — As ERPs become infrastructure nobody directly interacts with, the AI operational layer becomes the primary user interface. This positions Helix as the future of how businesses interact with their financial and operational systems.

3. **From change engine to operating layer** — The product must evolve from handling individual requests to being the persistent system-of-operation where account-specific logic, approvals, monitoring, and ongoing accountability live. This is the transition that separates a real company from a commodity wrapper.

4. **Pricing expansion** — Landing at $1,500/mo with expansion to $5K-$20K/mo as the platform proves deeper ownership. The consultant replacement value represents significant pricing headroom above the current entry point.

5. **Distribution partner channel** — Referenced in the Dovie projections as a growth lever. Consultants reselling Helix could become the primary go-to-market motion.

6. **Urgency from the Reality Check** — The window is shorter than it feels. "Your structural thesis is accurate. Your timing assumptions should be more aggressive." Oracle is erasing superficial whitespace, and AI model vendors are erasing superficial capability. The only thing left is owned, governed, account-specific continuity.

## Open Questions / Risks

| Category | Question / Risk | Source |
|---|---|---|
| **Timing** | "Your structural thesis is accurate. Your timing assumptions should be more aggressive." The competitive window is shorter than it feels. Oracle is erasing superficial whitespace faster than expected. | Reality Check |
| **Revenue** | No paying customers confirmed as of April 2026. 5 NS orgs in production are beta/pre-commercial. When does first revenue materialize? | Production data, Dovie Offer |
| **Churn** | Zero churn modeled in 36-month projections. What are actual retention patterns once customers start paying? | Dovie Offer |
| **Cost scaling** | $50K/month flat cost assumed through 999 customers. AI inference and infrastructure costs likely scale with usage. At what customer count does the model break? | Dovie Offer |
| **NS deployment maturity** | 31% NetSuite deployment success rate vs 84% for general deployments. Can this reach production-grade reliability before the competitive window narrows? | Production data |
| **Exit comp validity** | Oracle/Next Technik acquisition price ($60M) is not publicly disclosed. Should be used directionally, not as confirmed valuation. | Web search (diagnosis) |
| **Distribution partner** | Referenced as collaborator on Dovie numbers but identity and terms are not specified. | Dovie Offer |
| **Two investment vehicles** | Dovie ($50K-$100K small) and One-Pager ($500K large) appear to be different instruments at the same pre-money. Relationship unclear. | Dovie Offer, One-Pager |
| **ERP expansion path** | SAP/Odoo mentioned as targets but no technical foundation for those integrations exists today. | Ticket description |
| **Competitive pace from both sides** | Both Oracle and AI model vendors are moving faster than initially assumed. By 6 months, shallow "AI for ERP" positioning becomes crowded and weak. | Reality Check |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| ticket.md (helix-cli) | Understand deliverable requirements, source priority, and founder vision | Deliverable is pitch deck data backbone; focus on Helix for ERPs; Manifesto = most sincere; Dovie = most recent numbers |
| User continuation context | Updated guidance on scope, tone, and new documents | Describe capabilities at highest category level only; don't point out specific software implementations; include positioning/reality check/tagline docs |
| scout/scout-summary.md (helix-cli) | Pre-synthesized evidence landscape across all 7 attachments and 6 repos | Complete financial extractions, production metrics (7 orgs, 22 users, 264 tickets), competitive analysis, and 8 key unknowns |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis, stress-tested financials, competitive intelligence with web search validation | Three-way gap thesis validated; Oracle moving faster than expected; TAM framed conservatively and ambitiously; production metrics formatted for pitch credibility |
| Helix_Manifesto.pdf (attachment) | Philosophical foundation — Tier 1 source per ticket owner | 9 principles; "Intelligence is not the product. Responsibility is."; boundary test defines competitive moat |
| Helix_AI_Dovie_Offer.pdf (attachment) | Financial projections — most recent (April 2026, created with distribution partner) | 36-month model: 0-999 customers, $50K flat costs, profitable month 6, 5.6x return, exit scenarios up to $150M |
| Helix_Positioning_Refined.pdf (attachment) | Core positioning thesis — refined three-way structural gap narrative | Compressed thesis statement investor-ready; "Helix exists to permanently own the operational layer in between" |
| Helix_Positioning_Transcript.pdf (attachment) | Raw founder articulation of thesis | Original spoken thesis with nuances about ERP-as-database future and the accountability gap nobody else wants to fill |
| Reality_Check___Risks.pdf (attachment) | Honest threat assessment with timeline milestones | Thesis "mostly right" but pace faster on both sides; milestone gates at 3/6/12/18/36 months; "capability abundant, governance scarce" |
| Project_X_Innovation_One_Pager.pdf (attachment) | Market sizing and team | $500K/15% ask, $2B+ TAM, 40K+ NS companies, 7-person team, 4 enterprise betas |
| Helix_Tagline.pdf (attachment) | Branding direction for website and pitch | 5 finalists; recommended: "Owned operations." (homepage) + "The ownership layer for NetSuite." (pitch) |
| repo-guidance.json (helix-cli) | Repo intent mapping | helix-cli = target (research output); all other repos = context only; no code changes needed |
| Production runtime data (via diagnosis) | Real usage metrics for traction evidence | 7 orgs, 22 users, 264 tickets, 124 deployed, 81% autonomous; accelerating month-over-month |
| /tmp/helix-inspect/manifest.json | Confirm runtime inspection availability | DATABASE and LOGS inspection available for helix-global-server; production metrics already gathered by prior steps |

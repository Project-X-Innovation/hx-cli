# Scout Summary - RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Problem

Compile research-backed information to serve as the data backbone for an investor pitch deck and updated website for Helix for ERPs (focused on NetSuite, expanding to other ERPs). The deliverable is a comprehensive report covering: target market, TAM, revenue potential, product positioning, threats, branding direction, and future trajectory.

Seven attachments provide the input landscape: the Manifesto (philosophical foundation), Dovie Offer (financial projections), One-Pager (portfolio overview), Positioning Refined and Transcript (thesis narrative), Reality Check (threats and timeline), and Tagline (branding direction). Six repositories provide evidence of current product capabilities. Production runtime data provides real usage metrics.

User guidance: focus on Helix for ERPs (not Helix Global as a general dev tool); discuss capabilities at the highest category level; do not point out specific software implementations.

## Analysis Summary

### Evidence Landscape

The ticket provides a rich, multi-layered evidence base organized by reliability and purpose:

**Tier 1 - Philosophical Foundation (Manifesto):**
The Manifesto defines 9 principles around the thesis: "Intelligence is not the product. Responsibility is." The boundary test: "If Claude Code can do it, it's not enough. If NetSuite can own it, we don't build it." This is the most sincere document per the ticket owner and drives all other interpretation.

**Tier 2 - Financial Projections (Dovie Offer, April 2026):**
Most recent numbers, created with distribution partner. Projects 0 to 999 customers over 36 months at ~$1,500/mo average, reaching ~$18M ARR. Fixed costs at $50K/month. Profitable at month 6. Pre-money valuation $2.83M. Exit comps include Oracle's $60M acquisition of Next Technik (a NetSuite field service tool). Separate from the One-Pager's $500K/15% ask, the Dovie offer targets smaller investments: $50K for 2% or $100K for 4% with net profit distributions.

**Tier 3 - Market & Team (One-Pager, March 2026):**
TAM of $2B+ based on 40,000+ NetSuite companies spending $5K-$20K/mo on consultants. 7-person team with 1-4 years together. 4 enterprise beta users at time of writing. Key value prop: 60-80% reduction in consultant costs.

**Tier 4 - Positioning Thesis (Positioning Refined + Transcript):**
Articulates a three-way structural gap: (1) ERPs provide the platform but don't own each customer's custom operational layer over time, (2) consultants implement but don't persist, (3) AI models generate but don't govern or take accountability. Simultaneously, businesses are downsizing - the human operating layer around ERPs is shrinking while business complexity stays constant. Helix exists to permanently own the operational layer in between.

**Tier 5 - Reality Check & Risks:**
Validates structural thesis as "mostly right" but warns the pace is faster on both sides than assumed. Oracle is pushing agentic workflows, AI-native extensibility, and NetSuite Next. AI model vendors are pushing coding agents, enterprise deployment, and safer autonomy. Key insight: "Capability is abundant, governance is scarce." Provides milestone requirements at 3, 6, 12, 18, and 36 months. Most critical warning: if Helix remains a generation/convenience layer rather than becoming a governed operational system, it gets compressed by both sides.

**Tier 6 - Branding (Tagline):**
Five finalist taglines. Recommended: Homepage = "Owned operations." / Pitch = "The ownership layer for NetSuite." Sub-line: "NetSuite owns the platform. Helix owns the operational layer inside your account."

### Product Capabilities (from Codebase)

The product delivers an end-to-end autonomous workflow platform that takes a natural-language request through a 9-step pipeline: reconnaissance, diagnosis, product definition, technical research, implementation planning, implementation, code review, verification, and preview deployment. The platform orchestrates work across multiple repositories in isolated sandbox environments, with human approval gates before production deployment.

For NetSuite specifically, the platform manages the full customization lifecycle: credential management, sandbox testing, SuiteScript execution, file deployment, and production release. An open-source CLI tool (ns-gm, created by team member Luis Simosa) provides the foundational integration layer for remote NetSuite operations.

The web interface provides: ticket management with kanban workflow, a staging merge queue, deployment center, transcript-to-ticket conversion, production inspection (read-only database/logs/API queries), bidirectional agent-human communication, usage analytics, multi-section documentation, and administrative controls.

### Production Evidence (Runtime Inspection)

| Metric | Value | Notes |
|--------|-------|-------|
| Organizations | 7 | 5 NetSuite, 2 General |
| Users | 22 | Across all orgs |
| Total tickets | 264 | Growing: 121 in Mar, 143 in first 14 days of Apr |
| Sandbox runs | 611 | 55% success rate |
| Deployed tickets | 124 | 47% of all tickets reach production |
| General deployments | 63 | 84% success rate (53/63) |
| NetSuite deployments | 26 | 31% success rate (8/26) |
| Configured repos | 33 | Multi-repo customer environments |
| Ticket modes | AUTO: 214, RESEARCH: 26, BUILD: 14, FIX: 10 | Primarily autonomous execution |

**Notable:** NetSuite deployment success rate (31%) is significantly lower than general deployments (84%), suggesting the NS deployment pipeline is earlier in maturity.

### Financial Model Summary

| Metric | Dovie Offer | One-Pager |
|--------|------------|-----------|
| Pre-money | $2.83M | $2.83M |
| Ask | $50K-$100K (2-4%) | $500K (15%) |
| Breakeven | Month 6 | Month 8 |
| 12-mo ARR | ~$1.8M (102 customers) | $1.7M |
| 36-mo ARR | ~$18M (999 customers) | Not projected |
| Pricing | ~$1,500/mo avg | $5K-$20K/mo consultant replacement |
| Exit comp | Oracle/Next Technik $60M | Oracle/Next Technik $60M |

### Positioning & Branding Direction

**Core narrative for pitch:** ERPs will become like databases - infrastructure nobody directly interacts with. The interface layer between users and ERPs will be an AI platform like Helix. Helix is protected on both sides: ERPs won't take end-to-end accountability for custom operations (not their business), and AI models won't take durable operational ownership (not their business either).

**Key taglines developed:**
- Brand/homepage: "Owned operations."
- Pitch/investor: "The ownership layer for NetSuite."
- Supporting: "NetSuite owns the platform. Helix owns the operational layer inside your account."

### Threats & Timeline (from Reality Check)

The reality check document provides an honest assessment with milestone gates:

| Horizon | Threat Level | Key Dynamic | Helix Must Be |
|---------|-------------|-------------|---------------|
| 3 months | Manageable | AI-for-NS generation commoditizing | Safe, not just clever |
| 6 months | Rising | Shallow "ERP copilot" gets crowded | Trusted in one narrow lane |
| 12 months | Split point | Real divide: native AI vs ownership layers | Stateful and persistent |
| 18 months | High bar | Enterprise delegation to AI accelerates | Governable by an institution |
| 36 months | Binary | Either ownership layer or commodity wrapper | Where the owned operational layer lives |

**Critical insight:** "The only thing that stays scarce is continuity: knowing the account over time and governing its evolution."

### Key Unknowns

1. **Current revenue status** - Production has 5 NS orgs with real tickets, but no billing data visible. Relationship between "4 enterprise beta users" (One-Pager) and the 5 NS orgs in production is unclear.
2. **Churn modeling** - Dovie projections show growth only, no churn. Actual retention patterns unknown.
3. **Cost scalability** - $50K/month flat cost assumption may not hold as customers scale (AI inference, infrastructure, support).
4. **Competitive landscape** - No formal analysis of named competitors in "AI for ERP" space.
5. **Distribution partner** - Referenced as collaborator on Dovie numbers but unidentified.
6. **ERP expansion path** - SAP/Odoo mentioned as targets but no technical foundation exists yet.
7. **NS deployment maturity** - 31% success rate vs 84% for general deployments needs explanation.
8. **Two investment structures** - Dovie ($50K-$100K small) and One-Pager ($500K large) appear to be different vehicles; relationship unclear.

## Relevant Files

| Repository | Key File | Purpose |
|-----------|----------|---------|
| helix-global-server | `src/helix-workflow/helix-workflow-step-catalog.ts` | 9-step autonomous workflow pipeline |
| helix-global-server | `prisma/schema.prisma` | Full data model: orgs, tickets, runs, deployments, credentials |
| helix-global-server | `src/routes/api.ts` | 80+ API endpoints showing platform breadth |
| helix-global-server | `src/helix-workflow/orchestrator/native-phase.ts` | NetSuite SuiteCloud integration |
| helix-global-server | `src/services/inspection-proxy-service.ts` | Production inspection with safety guards |
| helix-global-server | `src/security/crypto.ts` | AES-256-GCM credential encryption |
| helix-global-client | `src/App.tsx` | 24 UI routes showing user-facing features |
| helix-global-client | `src/routes/settings/netsuite-tab.tsx` | NS credential management UI |
| helix-cli | `src/index.ts` | CLI: production inspection + agent-human communication |
| ns-gm | `ns_gm_restlet.js` | Open-source SuiteScript execution RESTlet |
| ns-gm | `src/cli.js` | OSS NetSuite CLI by team member |
| helix-ns-server | `src/helix-workflow/orchestrator.ts` | Legacy NS orchestrator (historical reference) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand deliverable requirements and source prioritization | Deliverable is pitch deck data backbone; focus on Helix for ERPs; Manifesto drives vision; Dovie numbers are most recent/relevant; ignore Finesse/Haven |
| Helix_Manifesto.pdf | Extract philosophical foundation and positioning principles | 9 principles; "Intelligence is not the product. Responsibility is."; boundary test: if Claude Code can do it, not enough; if NetSuite can own it, don't build it |
| Helix_AI_Dovie_Offer.pdf | Extract financial projections and investor terms | $2.83M pre-money; 0-999 customers/36mo; $18M ARR month 36; profitable month 6; $50K-$100K ask for 2-4% equity |
| Project_X_Innovation_One_Pager.pdf | Extract market sizing, team, and investment thesis | $500K/15% ask; $2B+ TAM; 40K+ NetSuite companies; 7-person team; 4 enterprise betas |
| Helix_Positioning_Refined.pdf | Extract core positioning narrative for pitch | Three-way structural gap: ERPs don't own custom layers, consultants don't persist, AI models don't govern. Helix owns the layer nobody else wants to own |
| Helix_Positioning_Transcript.pdf | Extract founder's original articulation of thesis | Raw thinking: ERP-as-database future; 100-person teams becoming 10; the accountability gap between ERP platforms and AI tools |
| Reality_Check___Risks.pdf | Extract honest threat assessment and timeline milestones | Thesis valid but time window shorter than it feels; capability abundant, governance scarce; milestone gates at 3/6/12/18/36 months |
| Helix_Tagline.pdf | Extract branding direction for website and pitch | Homepage: "Owned operations." / Pitch: "The ownership layer for NetSuite." / Sub: "NetSuite owns the platform. Helix owns the operational layer inside your account." |
| helix-global-server codebase | Map current product capabilities at high level | 9-step AI pipeline; multi-repo orchestration; NetSuite integration; deployment automation; production inspection; enterprise security |
| helix-global-client codebase | Map user-facing features | Dashboard, kanban, staging queue, deployment center, NS setup, analytics, docs, admin |
| helix-cli codebase | Map CLI capabilities | Production inspection (DB/logs/API); bidirectional agent-human communication |
| ns-gm codebase | Map OSS NetSuite integration foundation | SuiteScript execution CLI; OAuth 2.0 M2M; MIT license; created by team member |
| helix-ns-server / helix-ns-client | Historical reference for NS heritage | Legacy standalone NS repos; functionality now embedded in Helix Global |
| Production database (runtime) | Real usage metrics for pitch credibility | 7 orgs, 22 users, 264 tickets, 611 runs, 89 deployments; accelerating ticket volume |
| User continuation context | Updated guidance on scope and tone | Focus on Helix for ERPs; high-level capabilities only; include new positioning/risks/tagline docs |

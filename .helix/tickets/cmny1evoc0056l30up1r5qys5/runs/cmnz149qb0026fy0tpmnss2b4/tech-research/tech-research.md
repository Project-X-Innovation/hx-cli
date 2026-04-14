# Tech Research — RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Technology Foundation

This is a **research ticket**. The deliverable is a comprehensive information package serving as the data backbone for an investor pitch deck and updated website for **Helix for ERPs**. No software architecture or code changes are involved. The "technology foundation" is the evidence base, the analytical framework, and the content architecture that will shape the final research output.

**Evidence base:** Seven PDF source documents organized by reliability tier:
- **Tier 1:** Helix Manifesto (philosophical foundation, 9 principles)
- **Tier 2:** Dovie Offer (April 2026 financial projections, most recent numbers)
- **Tier 3:** Positioning Refined + Positioning Transcript (three-way structural gap thesis)
- **Tier 4:** Reality Check & Risks (honest threat assessment, milestone-based timeline)
- **Tier 5:** One-Pager (market sizing, team, broader investment ask)
- **Tier 6:** Tagline (branding direction, 5 finalists with context-specific recommendations)

Plus: six codebases (product capability evidence), production runtime data (7 orgs, 22 users, 264 tickets, 611 runs), and externally validated market intelligence gathered during diagnosis.

**Content destination:** The output is prompt-ready content that the founder will feed into a pitch deck builder. It must be modular (each section self-contained for slide or website extraction), narrative-coherent (following a single story arc), and evidence-backed (every claim traceable to a source).

**Key constraint from user guidance:** Describe product capabilities at the highest category level only. Do not point out specific software implementations. Focus on Helix for ERPs (not Helix Global as a general dev tool). Include the newly added positioning, reality check, and tagline documents.

## Architecture Decision

### Options Considered

**Option A: Encyclopedic reference document**
Organize by topic in exhaustive detail. Maximizes completeness but risks being too dense for pitch-deck conversion and burying the narrative arc.

**Option B: Narrative-arc document optimized for pitch-deck conversion** *(Chosen)*
Follow the Problem → Insight → Evidence → Opportunity → Ask arc that maps directly to standard investor deck flow. Each section is self-contained and modular. Include pitch-ready language within each topic area so the founder can lift content directly. Mark evidence quality tiers so the founder knows what to state as fact vs. frame as projection.

**Option C: Slide-by-slide outline**
Pre-structure as a literal slide deck outline. Too prescriptive — the founder explicitly wants to "take it from there" and make the pitch deck themselves.

### Chosen Option: Narrative-Arc Document (Option B)

**Rationale:** The founder's instruction is clear: "put together everything that might be helpful to think about" and "I'll take it from there and I'll make the pitch deck." Option B provides maximum narrative coherence with modular extraction. It respects the founder's ownership of the final deck while ensuring every section carries its own weight. The narrative arc also serves double duty — investor deck flow and website information architecture are structurally similar (problem → solution → proof → ask).

The four new continuation-context documents fundamentally shape this choice: Positioning Refined provides the narrative spine, Reality Check provides urgency, and Tagline provides ready-made language — all of which reward a narrative approach over encyclopedic cataloging.

### Content Architecture

| Section | Purpose | Primary Source(s) | Evidence Tier |
|---------|---------|-------------------|---------------|
| 1. The Structural Gap | Frame the problem nobody else is solving | Positioning Refined, Manifesto | A (thesis) |
| 2. Market Opportunity | Validate the size and growth of the opportunity | One-Pager, external market data | B (sourced) |
| 3. What Helix Accomplishes | Product capabilities at the highest category level | Codebase evidence, production data | A (verified) |
| 4. Traction & Momentum | Prove it's real and accelerating | Production runtime data | A (hard facts) |
| 5. Financial Model | Show capital efficiency and growth trajectory | Dovie Offer, One-Pager | C (projections) |
| 6. Competitive Landscape | Demonstrate differentiated positioning | Diagnosis web search, Reality Check | B (sourced) |
| 7. Risk Register & Mitigations | Build trust through honesty | Reality Check, stress-test analysis | Mixed |
| 8. Team & Investment | Who builds it and what's the ask | One-Pager, Dovie Offer | A/C (mixed) |
| 9. Branding & Positioning Language | Pitch-ready lines for slides and website | Tagline, Positioning Refined | A (ready) |
| 10. Future Vision | Where it goes from here | Manifesto, Positioning Transcript | C (vision) |

## Core Content Decisions

### Decision 1: Product Capability Framing — Six High-Level Categories

**Decision:** Describe product at six capability categories, not software features.

Per the founder's explicit guidance ("you don't have to point out specific software implementations"), product capabilities are organized as what the platform accomplishes:

1. **Autonomous operational lifecycle** — End-to-end handling from natural language intent through governed production deployment. Quantified by: 81% of tickets executed autonomously, 47% reaching production deployment.
2. **Governed execution** — Every action is reversible, observable, and auditable. Trust is engineered through safe testing, approval gates, and deployment controls.
3. **Production inspection** — Read-only visibility into the live ERP environment for diagnosis, monitoring, and proactive issue detection.
4. **Account continuity** — Persistent, durable memory of the account over time. 33 configured repositories across 7 organizations demonstrate depth.
5. **Bidirectional communication** — Real-time interaction between platform and human stakeholders for intent clarification and accountability visibility.
6. **Enterprise security** — Encrypted credential management, role-based access, and organizational isolation for production ERP environments.

Each category anchors to a Manifesto principle (Autonomous lifecycle → Completion; Governed execution → Safety; Account continuity → Continuity; Bidirectional communication → Calibrated Understanding; Enterprise security → Trust Through Behavior) to reinforce philosophical coherence.

**Rejected alternative:** Feature-by-feature inventory. Violates user guidance and shifts the pitch from "what we accomplish" to "what we built" — a weaker investor narrative for an early-stage company.

### Decision 2: Financial Model Presentation — Three-Layer Approach

**Decision:** Present the Dovie financial model in three explicit layers.

**Layer 1 — Base Case (as-is from Dovie Offer, April 2026):**
- 0 → 999 customers over 36 months
- ~$1,500/mo average price point
- $50K/mo flat operating costs
- Profitable at month 6 (42 customers)
- 36-month ARR: ~$18M
- Exit scenarios: $50M (early, 18mo) to $150M (strategic, 36mo)

**Layer 2 — Stress-Test Commentary:**
Proactively address the four vulnerabilities investors will spot:

| Assumption | Vulnerability | Recommended Framing |
|-----------|---------------|-------------------|
| $50K/mo flat costs | AI inference and infrastructure scale with usage | Show awareness; frame as "first-tier economics" with scaling model developing |
| Zero churn | 2-3% monthly churn at scale significantly impacts growth math | Frame as net-new projection; acknowledge retention is the key metric to prove |
| 0 paying customers today | 5 NS orgs in production but pre-commercial | Frame as "conversion-ready pipeline" — beta traction demonstrates demand |
| Next Technik $60M exit comp | Acquisition price not publicly disclosed | Use as directional reference only; lead with market-based valuation math |

**Layer 3 — Upside Framing:**
- $1,500/mo entry price is deliberate: land-and-expand against $5K-$20K/mo consultant replacement value
- Pricing headroom of 3x-13x above entry point
- The two investment structures (Dovie small / One-Pager large) serve different investor profiles, not contradictory asks
- Both share the $2.83M pre-money valuation

**Rejected alternative:** Presenting only the optimistic case. Investors doing even basic diligence will find the stress points. Proactive transparency builds more trust than optimistic projections alone.

### Decision 3: TAM Framing — Three Concentric Rings

**Decision:** Present TAM in three concentric rings from defensible to aspirational.

| Ring | Calculation | Value | Assessment |
|------|-----------|-------|------------|
| **Inner (Conservative)** | 10K NetSuite companies with ongoing customization × $5K/mo × 12 | **$600M** | Defensible floor; uses only companies with active consultant spend |
| **Middle (NetSuite)** | 40K+ companies × $5K-$20K/mo × 12 | **$2.4B-$9.6B** | Upper bound overstates; not all spend continuously |
| **Outer (Multi-ERP)** | ERP consulting/integration market | **$50.1B** | Long-term vision; expansion to SAP, Odoo, others |

**Supporting macro data (externally validated during diagnosis):**
- NetSuite: 43,000+ customers across 219 countries (Oracle confirmed)
- AI-in-ERP market: $5.82B (2025) → $58.7B by 2035 at 26% CAGR (Precedence Research)
- ERP consulting market: $50.1B in 2024 (Verified Market Reports)

**Recommended pitch framing:** Lead with the $600M conservative number ("our floor"), acknowledge the $2.4B+ NetSuite upper bound, and use the $50B+ multi-ERP market as the "why this becomes very big" long-term frame.

**Rejected alternative:** Leading with the $9.6B upper bound. Invites immediate skepticism. Starting conservative and expanding outward is more credible.

### Decision 4: Competitive Positioning — Concentric Compression Model

**Decision:** Structure competition as a concentric compression model, not a feature comparison matrix.

The key insight from the Reality Check: "Capability is abundant, governance is scarce." The competitive landscape is framed as two forces compressing from opposite sides with Helix occupying the ungoverned space in between.

**Force 1 (Left): ERP platforms compressing inward**
Oracle/NetSuite is making the platform smarter — NetSuite Next (mid-2026), SuiteAgents, AI Connector Service, AI across financial close and developer tooling. This compresses the "in-platform intelligence" layer.

*Why this doesn't close the gap:* Oracle's business model is platform licensing and extensibility. They enable customization; they don't take end-to-end accountability for each customer's custom operational layer over time. NetSuite making the platform smarter actually increases the complexity of the custom layer around it — more features means more configuration, more customization, more things to govern.

**Force 2 (Right): AI model vendors compressing inward**
Claude Code, OpenAI Codex, GitHub Copilot are increasingly capable at code generation, testing, and PR workflows. This compresses the "capability" layer.

*Why this doesn't close the gap:* AI tools generate code; they don't govern its deployment into production ERP environments, monitor its impact, maintain it over time, or take accountability when it breaks. Anthropic's own documentation includes examples of agentic misbehavior in production contexts (deleting branches, exposing tokens, running production migrations).

**The unclaimed center: governed operational ownership**
Neither side wants to fully own: safe ERP-specific testing, governed deployment with human approval gates, production monitoring, ongoing maintenance, durable account memory, and accountability for the custom layer over time. This is where Helix sits.

**Tier 2 threats (different motion):**
- AI-native ERP replacements (Rillet $100M, Campfire $100M) — these REPLACE ERPs rather than operate on top of them. Different buyer, different motion. They validate that the market sees ERP as ripe for disruption.
- Traditional NetSuite consultants — potential channel partners rather than competitors. The distribution partner collaboration on Dovie numbers hints at this channel strategy.

**Rejected alternative:** Feature comparison matrix vs. named competitors. No direct competitor offers autonomous, accountable ERP operational ownership. A feature matrix against Oracle or Claude Code would be misleading because they're solving different problems.

### Decision 5: Traction Data — Honest Contextualization

**Decision:** Present production metrics with proactive concern framing, not selective cherry-picking.

**Strong metrics (lead with these):**

| Metric | Value | Why It Matters |
|--------|-------|----------------|
| Organizations | 7 (5 NetSuite, 2 General) | Multi-industry early adoption |
| Users | 22 | Team-level engagement, not single-user trials |
| Total tickets | 264 (143 in first 14 days of April) | Accelerating — on pace for 2x month-over-month |
| Production deployments | 124 (47% of total) | Real operational impact, not experimentation |
| Autonomous execution | 81% in AUTO mode | Platform operates independently |
| Configured repositories | 33 | Deep integration across customer environments |

**Honest metrics (address proactively):**

| Metric | Value | Recommended Framing |
|--------|-------|-------------------|
| Run success rate | 55% overall | Beta maturity with improving trajectory; strict 9-step pipeline catches issues early |
| NS deployment success | 31% (8/26) | The hardest deployment pipeline — production ERP requires highest safety bar |
| General deployment success | 84% (53/63) | Demonstrates platform maturity; NS pipeline is catching up |
| Revenue | Pre-commercial | Conversion-ready pipeline: 5 NS orgs with active tickets, 264 tickets demonstrating demand |

**Rejected alternative:** Omitting the weak metrics. Any investor doing diligence will discover them. Preemptive honesty builds trust.

### Decision 6: Narrative Strategy — Lead with Structural Gap, Not Vision

**Decision:** Lead with the three-way structural gap (a problem that exists today), not the "ERP as database" future vision.

The founder's insight — that ERPs will go the way of databases (infrastructure nobody directly interacts with) — is compelling but too abstract to lead an early-stage pitch. The compressed thesis from Positioning Refined is the narrative spine:

> NetSuite standardizes complexity, but does not own each customer's custom operational layer.
> Consultants implement that layer, but do not stay.
> AI models generate into that layer, but do not govern it.
> Meanwhile, the human teams around ERP are shrinking while the business complexity stays the same.
> **Helix exists to permanently own the operational layer in between.**

The "ERP as database" vision belongs in the closing "Future Vision" section as the long-term thesis.

**Rationale:** Investors in a $50K-$500K raise need near-term execution clarity first. The structural gap is a present-tense problem with quantifiable market size. The visionary frame expands the opportunity but shouldn't carry the burden of initial persuasion.

**Rejected alternative:** Leading with the "ERP as database" vision. Too abstract for early-stage investor pitch.

### Decision 7: Reality Check Integration — Urgency as Strength

**Decision:** Position the Reality Check's milestone-based timeline as founder discipline, not warnings.

The Reality Check provides the most honest self-assessment in the evidence base. Its milestone gates should be positioned as execution markers that demonstrate strategic rigor:

| Horizon | Required State | Investor Framing |
|---------|---------------|-----------------|
| 3 months | Safe, not just clever | "We build for trust, not tricks" |
| 6 months | Trusted in one narrow lane | "We own NetSuite customization completely before expanding" |
| 12 months | Stateful and persistent | "The account lives inside Helix — not project-by-project" |
| 18 months | Governable by an institution | "Enterprise-grade trust that survives compliance" |
| 36 months | The owned operational layer | "Either we are the ownership layer or we failed" |

The kill rules at each gate demonstrate that the founder is building a real business with accountability, not riding a hype wave. The "less time than it feels like" urgency becomes a "why we need capital now" argument.

**Rejected alternative:** Burying the Reality Check in a risk footnote. Its honesty is a narrative asset, not a liability.

### Decision 8: Branding Language — Organized by Context

**Decision:** Provide branding language organized by destination, ready for direct lift.

| Context | Primary Line | Supporting Line |
|---------|-------------|-----------------|
| **Homepage / Brand** | "Owned operations." | "Helix owns how your NetSuite evolves — from request to tested, deployed, monitored, and maintained execution." |
| **Pitch / Investor** | "The ownership layer for NetSuite." | "NetSuite owns the platform. Helix owns the operational layer inside your account." |
| **One-slide thesis** | Compressed five-line thesis | From Positioning Refined — the complete structural gap narrative |
| **Manifesto hook** | "Intelligence is not the product. Responsibility is." | — |
| **Boundary test** | "If Claude Code can do it, it's not enough. If NetSuite can own it, we don't build it." | — |

## Technical Decisions (with Rejected Alternatives)

### Evidence Quality Management

**Decision:** Every claim in the research report should be traceable to an evidence quality tier.

| Tier | Type | Examples | Treatment |
|------|------|----------|-----------|
| A | Hard facts | Production metrics, team composition, codebase capabilities | State directly |
| B | Well-sourced external | NetSuite customer count, market growth rates, Oracle announcements | State with citation |
| C | Internal projections | Dovie financial model, pricing assumptions, exit scenarios | Present as projections with transparent assumptions |
| D | Unverifiable | Next Technik $60M price, distribution partner specifics, churn behavior | Explicit hedging language |

### Two Investment Structures

**Decision:** Present Dovie ($50K-$100K for 2-4% with distributions) and One-Pager ($500K for 15%) as complementary investor tiers.

Both share the $2.83M pre-money valuation. The Dovie structure targets angels/friends seeking cash-flow returns (distributions begin month 6). The One-Pager targets seed investors seeking equity appreciation. The report provides the common data foundation; the specific structure is chosen per investor.

**Rejected alternative:** Picking one structure and ignoring the other. Would leave gaps if the report serves both audiences.

## Cross-Platform Considerations

Not directly applicable — this is a research deliverable, not a software implementation. However, the research report serves two "platforms":

1. **Pitch deck input** — Sequential narrative for investor slides
2. **Website content** — Modular sections for gethelix.ai pages

The modular content architecture (each section self-contained) addresses this dual-use requirement. The branding language section specifically provides context-tagged lines for each destination.

**Multi-ERP expansion note:** The structural gap thesis (ERP doesn't own custom layer, consultants don't persist, AI doesn't govern) is not NetSuite-specific. SAP (440,000+ customers), Odoo, and other ERPs represent the same structural gap. The research report should present NetSuite as the beachhead with multi-ERP as the expansion path — without implying technical readiness for other ERPs, which does not yet exist.

## Performance Expectations

The research report's "performance" is measured by its utility for pitch-deck conversion:

| Criterion | Target |
|-----------|--------|
| Pitch conversion speed | Founder can extract slide content in one reading |
| Evidence traceability | Every quantitative claim cites its source |
| Narrative coherence | Story arc flows from structural gap through proof to ask |
| Dual-use capability | Sections work for both investor slides and website content |
| Honest vulnerability | Stress points addressed proactively, not buried |
| Branding readiness | Taglines and positioning lines ready for direct use |

## Dependencies

| Dependency | Source | Status | Risk if Missing |
|-----------|--------|--------|-----------------|
| Positioning thesis (three-way gap) | Positioning Refined PDF | Available, extracted | Core narrative has no backbone |
| Dovie financial model | Dovie Offer PDF | Available, extracted | No financial story |
| Production traction metrics | Runtime inspection (prior steps) | Available: 7 orgs, 22 users, 264 tickets | No proof of momentum |
| Competitive intelligence (April 2026) | Diagnosis web search | Available: NetSuite Next, SuiteAgents, AI Connector | Competitive section outdated |
| TAM external validation | Diagnosis web search | Available: 43K+ NS customers, market growth rates | TAM claims unsupported |
| Manifesto principles | Manifesto PDF | Available, extracted (9 principles) | No philosophical anchor |
| Tagline finalists | Tagline PDF | Available, extracted (5 finalists) | No branding language |
| Reality Check milestones | Reality Check PDF | Available, extracted (3/6/12/18/36mo gates) | No urgency framing |
| Billing/subscription data | Production database | **NOT available** — no billing tables in schema | Cannot confirm revenue; must frame as pre-commercial |
| Distribution partner identity | Referenced in Dovie but unidentified | **NOT available** | Cannot substantiate go-to-market channel claim |
| Churn data | No historical data exists | **NOT available** | Cannot validate retention assumptions |
| Next Technik acquisition price | Web search: not publicly disclosed | **NOT verifiable** | Exit comp must be hedged |

## Deferred to Round 2

1. **Multi-ERP technical feasibility assessment** — The expansion thesis (NetSuite → SAP, Odoo) is part of the vision but no technical foundation exists today. Research report should acknowledge this as aspirational without implying readiness.

2. **Cost-scaling model** — The $50K/mo flat cost assumption needs a proper scaling analysis with AI inference cost curves, but this is a financial modeling exercise beyond the scope of research synthesis.

3. **Churn sensitivity analysis** — A proper churn model requires historical retention data that doesn't exist yet (pre-commercial). Research report should flag retention as the key metric to prove once revenue begins.

4. **Named competitor deep-dive** — No direct competitor in "autonomous ERP operational ownership" was identified. If one emerges, targeted analysis would be needed.

5. **Website content architecture** — The research report serves as input for both pitch deck and website, but the website-specific page structure and messaging hierarchy is a separate deliverable.

6. **Customer case studies** — Once beta customers convert to paying, specific ROI stories would strengthen the pitch materially.

## Summary Table

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| Content architecture | Narrative-arc (Structural Gap → Evidence → Opportunity → Ask) | Maps to investor deck flow; modular for dual-use (slides + website) |
| Narrative spine | Compressed thesis from Positioning Refined | Five-line structural gap thesis is the most pitch-ready language in evidence base |
| Product framing | Six high-level capability categories | Per user guidance: no specific implementations; anchored to Manifesto principles |
| Financial presentation | Three layers (base case, stress-test, upside) | Builds trust through transparency; highlights capital efficiency |
| TAM framing | Three concentric rings ($600M → $2.4B → $50B) | Lead conservative, expand outward; externally validated |
| Competitive model | Concentric compression (ERP left, AI right, governance center) | "Governance is scarce" — positions Helix in structurally unclaimed space |
| Traction data | Honest contextualization with proactive concern framing | Weak metrics addressed upfront; acceleration narrative leads |
| Branding | Context-organized (homepage / pitch / thesis / hook) | Ready for direct lift into slides and website |
| Narrative strategy | Lead with structural gap, not "ERP as database" vision | Near-term problem grounds the pitch; vision expands in closing section |
| Timeline urgency | Reality Check milestones as execution discipline markers | Kill rules demonstrate founder rigor; urgency drives "why now" |
| Evidence quality | Four-tier system (facts / sourced / projections / unverifiable) | Ensures every claim carries appropriate confidence level |
| Investment structures | Complementary tiers for different investor profiles | Common data foundation; investor-specific structure per audience |
| Code changes | None | Research ticket — all output is documentation/analysis |

## APL Statement Reference

From `tech-research/apl.json`: This is a research ticket requiring a comprehensive information package to serve as the data backbone for an investor pitch deck and updated website. The technical direction focuses on content architecture, analytical framing decisions, and evidence quality management rather than software architecture. The research report should follow a narrative-arc structure (Problem/Structural Gap → Insight → Evidence → Opportunity → Ask) optimized for sequential pitch-deck conversion, with the compressed thesis from Positioning Refined as the narrative spine. Product capabilities should be described at six high-level categories without software implementation details, anchored to Manifesto principles. The financial model should be presented in three layers (base case, stress-test, upside framing). The competitive landscape should use the concentric compression model with "governance is scarce" as the centerpiece. The Reality Check's milestone-based timeline provides the "why now" urgency. All claims should be tagged to evidence quality tiers (hard facts, well-sourced, internal projections, unverifiable). No code changes are needed in any repository. All APL followups resolved.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Understand deliverable scope, source priorities, and founder intent | Output is pitch-deck data backbone; discuss capabilities at highest level only; founder will build deck from output |
| User continuation context | Updated guidance on scope, tone, and four new documents | No specific software implementations; include positioning/reality check/tagline docs; focus on Helix for ERPs |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis with competitive intelligence and financial stress-testing | Three-way gap thesis validated; Oracle faster than assumed; five stress points in Dovie model; production metrics formatted |
| diagnosis/apl.json (helix-cli) | Eight investigation questions with evidence-backed answers | Complete evidence landscape: thesis defensibility, financial realism, TAM validation, competitive intelligence, traction proof, risks, branding readiness |
| product/product.md (helix-cli) | Product definition with capability categories, financial model, competitive landscape, and success criteria | Six capability categories defined; milestone-based kill gates; dual investment structure; ten open questions identified |
| scout/scout-summary.md (helix-cli) | Pre-synthesized analysis of all 7 PDFs, 6 codebases, and production runtime | Evidence landscape organized by six tiers; 8 key unknowns; production metrics with NS vs. general deployment breakdown |
| scout/reference-map.json (helix-cli) | 14 key files, 30 verified facts, 11 explicit unknowns | Production database metrics (7 orgs, 22 users, 264 tickets, 611 runs); financial model extractions; no billing data visible |
| repo-guidance.json (helix-cli) | Repo intent mapping | helix-cli = target for research output; all other repos = context only; no code changes needed |
| Runtime inspection manifest | Confirm available inspection types | DATABASE and LOGS available for helix-global-server; production metrics already gathered by prior steps |
| Helix_Manifesto.pdf (attachment, via prior extraction) | Philosophical foundation — Tier 1 source per ticket owner | 9 principles; "Intelligence is not the product. Responsibility is."; boundary test defines competitive moat |
| Helix_AI_Dovie_Offer.pdf (attachment, via prior extraction) | Most recent financial projections (April 2026) | 36-month model: 0-999 customers, $50K flat costs, profitable month 6, exit scenarios up to $150M |
| Helix_Positioning_Refined.pdf (attachment, via prior extraction) | Core narrative: three-way structural gap thesis | Compressed thesis statement — the single most pitch-ready piece of language in evidence base |
| Helix_Positioning_Transcript.pdf (attachment, via prior extraction) | Raw founder articulation of thesis | ERP-as-database future; accountability gap; shrinking human operating layers |
| Reality_Check___Risks.pdf (attachment, via prior extraction) | Honest threat assessment with milestone-based timeline | "Capability abundant, governance scarce"; milestone gates at 3/6/12/18/36mo; "less time than it feels like" |
| Helix_Tagline.pdf (attachment, via prior extraction) | Branding direction with context-specific recommendations | "Owned operations." (homepage) + "The ownership layer for NetSuite." (pitch) |
| Project_X_Innovation_One_Pager.pdf (attachment, via prior extraction) | Market sizing and team composition | $500K/15% ask; $2B+ TAM; 40K+ NS companies; 7-person team |

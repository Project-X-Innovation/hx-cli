# Tech Research — RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Technology Foundation

This is a **research deliverable** — no code changes are required. The "technology" is the analytical framework and information architecture for producing a structured investor pitch information package.

**Deliverable format:** A single structured markdown document containing modular, self-contained sections that can be:
1. Fed as prompt context to generate pitch deck slides
2. Extracted for website content on gethelix.ai
3. Referenced by the founder for investor conversations

**Evidence base:** Six codebases (verified production capabilities), three PDF attachments (Manifesto, Dovie Offer, One Pager), production runtime data (7 orgs, 261 tickets, 606 runs), and externally validated market data from diagnosis-stage web research.

**Key constraint:** The Manifesto drives the narrative vision. The Dovie numbers are the most recent and relevant financials. The codebase describes the current product. The report must synthesize all three while reasonably extrapolating future direction (multi-ERP expansion).

## Architecture Decision

### Options Considered

**Option A: Linear narrative report** — A single flowing document from problem to solution to market to financials. Simple, but harder to extract specific sections for different pitch deck slides or website pages.

**Option B: Modular section-based report (CHOSEN)** — 9 self-contained sections, each with a narrative thesis, supporting evidence table, and key data points. Each section can be independently referenced when generating pitch deck slides or website content.

**Option C: Structured data format (JSON/YAML)** — Machine-readable format optimized for programmatic slide generation. Too rigid; loses narrative quality that the founder needs for investor storytelling.

### Chosen: Option B — Modular Section-Based Report

**Rationale:** The founder explicitly said "information that I'm going to feed in as a prompt to a pitch deck" and also "updated site." A modular structure serves both use cases — the pitch-deck prompt can reference specific sections ("use Market Sizing for slides 3-5"), and website content can extract positioning language from the narrative sections. The product step's 8 success criteria (product narrative, market analysis, financial model review, competitive landscape, risk register, traction dashboard, roadmap narrative, key quotes) map directly to discrete sections.

### Report Section Architecture

| # | Section | Purpose | Primary Data Source |
|---|---------|---------|-------------------|
| 1 | Executive Narrative | Elevator pitch and positioning | Manifesto + founder ticket description |
| 2 | Product Capabilities | Evidence-backed feature inventory | Codebase (6 repos) + production data |
| 3 | Market Sizing | TAM/SAM/SOM with external validation | Diagnosis web research + One Pager claims |
| 4 | Financial Model Analysis | Dovie projections with stress-testing | Dovie Offer + One Pager + scenario modeling |
| 5 | Competitive Landscape | 2x2 positioning map with differentiation | Diagnosis competitor research + Manifesto |
| 6 | Traction Dashboard | Production metrics formatted for credibility | Runtime database queries |
| 7 | Risk Register | Investor objection anticipation with mitigations | Diagnosis risk analysis + evidence |
| 8 | Strategic Roadmap | Near-term and long-term expansion path | Codebase architecture + founder vision |
| 9 | Key Quotes & Positioning | Manifesto-sourced language for slides/site | Helix Manifesto (3 pages, 9 principles) |

## Core API/Methods

Not applicable — this is a research deliverable, not a code change. The "core methods" here are the analytical frameworks applied to each section:

### Market Sizing Framework: TAM/SAM/SOM

| Layer | Definition | Data Sources | Estimate |
|-------|-----------|-------------|----------|
| **TAM** | Total AI-in-ERP market | Precedence Research | $5.82B (2025) -> $58.7B (2035) at 26% CAGR |
| **SAM** | NetSuite consulting spend | Oracle 43K+ customers x $3K-$10K/mo avg | $1.5B - $8.3B annually |
| **SOM** | Companies Helix can realistically serve near-term | ~5K-10K companies with active customization + budget | $90M - $180M at $1,500/mo |

The $2B+ headline from the One Pager is positioned as SAM with the qualifier that not all 40K+ companies spend continuously on consultants. The $90M-$180M SOM is the honest near-term target that corresponds to the Dovie model's 999-customer goal ($18M ARR = ~10-20% SOM penetration).

### Financial Stress-Testing Framework: Three Scenarios

| Parameter | Base (Dovie) | Conservative | Optimistic |
|-----------|-------------|-------------|-----------|
| Customer growth | 0 -> 999 (36mo) | 0 -> 500 (36mo, 30% slower) | 0 -> 999 (36mo) |
| Monthly churn | 0% | 3% | 1% |
| Costs | $50K flat | $50K + $30/customer/mo | $50K + $15/customer/mo |
| ARPU | $1,500/mo | $1,500/mo | $2,500/mo (value-based upsell) |
| Breakeven | Month 6 | ~Month 12-14 | Month 5 |
| 36-month ARR | ~$18M | ~$6M-$8M | ~$25M-$30M |

**Key insight:** Even the conservative case reaches profitability within 14 months, validating the business model. The Dovie flat-cost assumption is the biggest vulnerability — AI inference costs alone at 999 customers generating tickets would exceed $50K/month. The report should surface this transparently and propose the cost-scaling model above.

### Competitive Positioning: 2x2 Matrix

Axes: **Scope of Responsibility** (task-level vs. system-level) x **Domain Specificity** (general-purpose vs. ERP-specialized)

| Quadrant | Players | Threat to Helix |
|----------|---------|----------------|
| Task-level / General | Claude Code, Copilot, Cursor | Low-Medium — commoditize code generation, not ERP operation |
| Task-level / ERP-specialized | NetSuite Next, Autonomous Close | **High** — Oracle embedding AI in the platform directly |
| System-level / General | Rillet ($100M), Campfire ($100M) | Medium — replace ERPs entirely; different buyer, different sale |
| System-level / ERP-specialized | **Helix (alone)** | N/A — this is the defensible position |

## Technical Decisions

### Decision 1: Narrative Anchor — Manifesto's Accountability Thesis

**Chosen:** Use "Intelligence is not the product. Responsibility is." as the narrative anchor for the entire report.

**Rejected alternative:** Leading with technical capabilities (9-step pipeline, 80+ APIs). While impressive, technical features don't differentiate in an investor pitch — the moat story does.

**Rationale:** The Manifesto's core thesis that accountability is the defensible position as AI intelligence commoditizes is both philosophically compelling and empirically grounded in the product architecture. Every technical capability (sandbox testing, human approval gates, deployment automation, production inspection, audit logging) is a manifestation of the accountability principle. Leading with "why" rather than "what" creates a stronger investor narrative.

### Decision 2: Two Investment Structures — Present as Complementary Tiers

**Chosen:** Present Dovie ($50K-$100K for 2-4% with distributions) and One Pager ($500K for 15%) as complementary investor tiers, not competing structures.

**Rejected alternative:** Picking one structure and ignoring the other. This would leave gaps if the founder uses the report for both investor audiences.

**Rationale:** Both share the $2.83M pre-money valuation. The Dovie structure targets angels seeking cash-flow returns (distributions begin month 6). The One Pager targets seed investors seeking equity appreciation. The report provides the common data foundation; the specific structure is chosen per investor.

### Decision 3: Weak Metrics — Contextual Honesty, Not Hiding

**Chosen:** Surface all metrics (including 55% success rate, 31% NS deployment success, zero revenue) with honest context and improvement trajectories.

**Rejected alternative:** Omitting weak metrics or presenting only strong ones. Investors will discover them; preemptive honesty builds trust.

**Rationale:** 
- **55% run success rate:** Autonomous ERP operation is genuinely hard. Frame as "each failure generates training data." Note the 9-step pipeline itself is designed for iterative reliability improvement.
- **31% NS deployment success (8/26):** NetSuite SDF deployment is notoriously complex. General deployment success is 85% (52/61). NS-specific automation is the newest capability and improving.
- **Zero revenue:** 4 enterprise betas and 7 orgs demonstrate adoption. Revenue conversion is a go-to-market milestone, not a product validation failure. 261 tickets with 123 deployed to production prove the product works.
- **Lead with strength:** 261 tickets in ~2 months, 16% MoM growth, 5 active orgs in 30 days, 47% deployment rate, 33 configured repos.

### Decision 4: Market Sizing — Honest Layering Over Headline Number

**Chosen:** TAM/SAM/SOM framework that validates the $2B+ claim as SAM while providing a more conservative $90M-$180M SOM as the realistic near-term target.

**Rejected alternative:** Using only the $2B+ headline number without qualification. External validation (diagnosis stage) shows this requires all 40K+ companies spending continuously, which is unrealistic.

**Rationale:** Sophisticated investors will probe the TAM. Presenting a layered framework with external citations (Precedence Research, Oracle, Enlyft, TheirStack) builds credibility. The $90M-$180M SOM maps cleanly to the Dovie model (999 customers = $18M ARR = ~10-20% SOM penetration), which shows the plan is coherent even with conservative market assumptions.

### Decision 5: Competitive Oracle/NetSuite Next Threat — Acknowledge and Differentiate

**Chosen:** Directly acknowledge NetSuite Next (Oracle's agentic AI) as the primary competitive threat, then differentiate on the accountability/lifecycle gap.

**Rejected alternative:** Downplaying Oracle's AI roadmap. This is the most predictable investor question; not addressing it proactively undermines credibility.

**Rationale:** Oracle's business model is platform licensing — they sell tools and enable customization but don't take end-to-end responsibility for whether customizations work, deploy correctly, and remain maintained. Helix's moat per the Manifesto: "If Claude Code can do it, it's not enough. If NetSuite can own it, we don't build it." Oracle will make NetSuite smarter; Helix makes NetSuite accountably operated. These are complementary, not competitive — like how Salesforce getting smarter didn't eliminate Salesforce consultants (it created more demand for configuration).

## Cross-Platform Considerations

### Multi-ERP Expansion Path

The current codebase is NetSuite-only for ERP-specific features. The architecture, however, supports expansion:

- **Isolation point:** ERP-specific logic is concentrated in `helix-global-server/src/helix-workflow/orchestrator/native-phase.ts` (NetSuite SDF/SuiteCloud) and the NS-GM credential layer. The 9-step workflow pipeline is ERP-agnostic.
- **Pattern:** Adding SAP or Odoo support would require new "native phase" implementations and credential management modules, but the core pipeline, deployment infrastructure, and client UI are reusable.
- **No technical implementation exists for SAP/Odoo** — this is purely an architectural observation.

For the pitch, frame this as: "The 9-step pipeline and platform infrastructure are ERP-agnostic. NetSuite is the beachhead. SAP and Odoo expansion follows the same integration pattern." This is honest — the architecture supports it — without overpromising.

### Two Investment Tiers

The report must serve both investor audiences:
- **Dovie-tier ($50K-$100K):** Emphasize cash-flow returns (distributions from month 6), lower risk, distribution-first model
- **One Pager-tier ($500K/15%):** Emphasize equity appreciation, exit scenarios ($50M-$150M), growth trajectory

The financial analysis section should present both models with a common data foundation.

## Performance Expectations

Not applicable in the traditional sense (no code to optimize). For the research deliverable:

- **Report quality bar:** Every factual claim must cite a specific evidence source (codebase file, production data query, external source with citation, or PDF attachment page).
- **Narrative coherence:** Single story arc: Problem (ERP customization is expensive and slow) -> Product (autonomous ERP operator) -> Market (40K+ NetSuite companies, expanding to all ERPs) -> Financials (path to $18M ARR) -> Moat (accountability in a world of commoditized intelligence) -> Exit ($50M-$150M comps).
- **Usability:** Each section independently usable as pitch-deck prompt context. No cross-section dependencies that would break extraction.

## Dependencies

### Internal Dependencies (from evidence base)

| Dependency | Source | Status |
|-----------|--------|--------|
| Product capability inventory | 6 codebases (scout/reference-map.json) | Complete — 34 key files mapped, 30 verified facts |
| Production metrics | Runtime database queries (diagnosis stage) | Complete — 7 orgs, 261 tickets, 606 runs |
| Manifesto principles | Helix_Manifesto.pdf (3 pages) | Complete — 9 principles extracted |
| Dovie financial model | Helix_AI_Dovie_Offer.pdf (3 pages) | Complete — 36-month model with exit scenarios |
| One Pager market data | Project_X_Innovation_One_Pager.pdf | Complete — TAM, team, investment terms |
| External market validation | Web searches (diagnosis stage) | Complete — NS customer counts, AI-in-ERP market, competitors |

### External Dependencies (validated in diagnosis)

| Data Point | External Source | Validation Status |
|-----------|----------------|------------------|
| NetSuite customer count | Oracle (43K+), Enlyft (69K+), TheirStack (68K+) | Validated — higher than 40K claim |
| AI-in-ERP market size | Precedence Research | Validated — $5.82B (2025) at 26% CAGR |
| Consultant cost range | Multiple NS partner sites | Partially validated — $25K-$200K+ implementation |
| Oracle/Next Technik acquisition | Public reports (Oct 2023) | Confirmed — but $60M price unverifiable |
| Rillet/Campfire fundraising | TechCrunch, press releases | Validated — $100M each in 2025 |

### Missing / Unavailable

| Gap | Impact | Mitigation |
|-----|--------|-----------|
| gethelix.ai website content | Cannot reference current website messaging | Use Manifesto as source of truth for positioning |
| Distribution partner identity | Cannot cite partner in report | Note as "unnamed distribution partner" per founder confidentiality |
| Actual paying customer contracts | Cannot confirm revenue status | Present 7 orgs/22 users as "beta adoption" honestly |
| SAP/Odoo market-specific data | Cannot size non-NS ERP opportunity precisely | Use total AI-in-ERP TAM ($58.7B by 2035) as the multi-ERP ceiling |

## Deferred to Round 2

The following are not needed for the research report but may be relevant for future iterations:

1. **Customer case studies** — Once beta customers convert to paying, specific ROI stories would strengthen the pitch
2. **Cost-scaling model** — A detailed infrastructure cost model (AI inference per ticket, compute scaling, support staffing) would replace the flat $50K assumption
3. **Churn benchmarking** — Industry churn data for vertical SaaS (typically 3-5% monthly for SMB, 1-2% for enterprise) to calibrate the financial model
4. **Product roadmap timeline** — Specific dates/milestones for SAP/Odoo integration, self-service onboarding, success-rate improvement targets
5. **Website refresh design** — The gethelix.ai content update is a separate deliverable that can consume the positioning language from this report
6. **Formal competitive intelligence** — Detailed feature-by-feature comparison with NetSuite Next once Oracle's 2026 release details are public

## Summary Table

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| Report structure | 9 modular sections | Serves both pitch-deck prompting and website extraction |
| Narrative anchor | Manifesto accountability thesis | "Responsibility is the product" is the moat story |
| Market sizing | TAM/SAM/SOM with external validation | Honest layering; $2B+ as SAM, $90M-$180M as near-term SOM |
| Financial presentation | 3 scenarios (base/conservative/optimistic) | Surfaces Dovie assumptions transparently while showing model resilience |
| Investment structures | Present as complementary tiers | Common data foundation; investor-specific structure selection |
| Weak metrics | Contextual honesty with trajectories | Preemptive framing builds trust; lead with strong metrics |
| Competitive positioning | 2x2 matrix (scope x domain) | Helix alone in system-level/ERP-specialized quadrant |
| Oracle threat | Acknowledge and differentiate | Platform enablement vs. operational accountability are complementary |
| Multi-ERP narrative | Architecture supports it; no code yet | Honest framing: NetSuite beachhead, architecture-ready expansion |
| Evidence standard | Every claim cites specific source | Codebase files, production queries, PDF pages, external research |

## APL Statement Reference

From `tech-research/apl.json`: The technical direction for RSH-221 is to produce a modular, evidence-backed research report structured in 9 self-contained sections that serve as both pitch-deck prompt material and website content source. The report uses a TAM/SAM/SOM framework for market sizing, presents financial projections with base/conservative/optimistic scenarios, maps competitors on a 2x2 positioning matrix (scope-of-responsibility x domain-specificity), and frames all production metrics with honest context. Two investment structures (Dovie angel tier and One Pager seed tier) are presented as complementary instruments. The narrative is anchored by the Manifesto's accountability thesis and supported by codebase evidence (9-step pipeline, 80+ APIs, production deployment automation) and validated production metrics (7 orgs, 261 tickets, 123 deployed). Key risks (Oracle competition, cost scaling, zero revenue, success rates) are addressed with evidence-based mitigations rather than dismissed.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `helix-cli/.../ticket.md` | Understand deliverable requirements, source hierarchy, and both output targets (pitch deck + website) | Deliverable is pitch-deck data backbone; Manifesto = most sincere; Dovie = most recent numbers; focus on Helix for ERPs; report will be used as prompt input |
| `helix-cli/.../diagnosis/diagnosis-statement.md` | Root cause analysis, market validation results, financial stress-test findings, competitive mapping | $2B+ TAM partially validated ($500M-$1B more defensible); flat costs unrealistic; zero churn unrealistic; 4 competitor categories; Oracle/Next Technik $60M unverifiable |
| `helix-cli/.../diagnosis/apl.json` | 7 diagnostic questions fully answered with evidence — carry forward all findings | Product capabilities verified (9-step pipeline, 80+ APIs); Dovie strengths/weaknesses mapped; TAM validated at SAM level; competitive position unique; traction real but early; risks catalogued |
| `helix-cli/.../product/product.md` | Product definition with success criteria, use cases, feature inventory, design principles | 8 success criteria for report; 6 use cases; MVP features verified in production; open questions/risks catalogued; scope constraints (Helix for ERPs only) |
| `helix-cli/.../scout/scout-summary.md` | Comprehensive evidence synthesis across all 6 repos, 3 PDFs, and production data | 9-step pipeline, production metrics (7 orgs, 261 tickets, 606 runs), Dovie/One Pager financial extractions, Manifesto principles, key unknowns list |
| `helix-cli/.../scout/reference-map.json` | 34 key files mapped with 30 verified facts and 10 explicit unknowns | Complete file-to-capability mapping; production metrics from runtime queries; financial projection details; team composition |
| `helix-cli/.../repo-guidance.json` | Confirm helix-cli is target repo; all others are context | No code changes in any repo; helix-cli hosts research output artifacts |
| `Helix_Manifesto.pdf` (attachment) | Narrative anchor and positioning principles for investor story | 9 principles; "Intelligence is not the product. Responsibility is."; accountability gap is the moat; "accountable at speed" |
| `Helix_AI_Dovie_Offer.pdf` (attachment) | Most recent financial model (April 2026) with 36-month projections | 0->999 customers; $50K flat costs; profitable month 6; $2.83M pre-money; exit scenarios $50M-$150M; Oracle/Next Technik comp |
| `Project_X_Innovation_One_Pager.pdf` (attachment) | Market sizing, team composition, and seed-tier investment structure | $500K/15% ask; $2B+ TAM; 40K+ NS companies; 7-person team; 4 enterprise betas; multi-ERP expansion vision |
| `/tmp/helix-inspect/manifest.json` | Check runtime inspection availability | helix-global-server has DATABASE and LOGS types; production metrics already gathered in diagnosis stage |

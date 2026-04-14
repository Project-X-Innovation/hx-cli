# Implementation Plan — RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Overview

This is a **research/report mode** ticket. The deliverable is a single polished markdown research report at `report/report.md` in the helix-cli run root. The report serves as the data backbone for an investor pitch deck and updated website for **Helix for ERPs**. There are no code changes, no git commits, no PRs, and no deployments.

The implementation step will synthesize content from seven PDF source documents (organized by reliability tier), six codebases (for capability evidence at the highest category level only), production runtime data (traction metrics), and externally validated market intelligence (gathered during diagnosis). The report follows a narrative-arc structure (Structural Gap -> Evidence -> Opportunity -> Ask) optimized for pitch-deck conversion, with each section self-contained and modular for dual use (investor slides + website content).

**Critical user constraint:** Describe product capabilities at the highest category level only. Do not point out specific software implementations. Focus on Helix for ERPs (not Helix Global as a general dev tool).

**Seven source documents (by reliability tier):**
- Tier 1: Helix Manifesto (philosophical foundation, 9 principles)
- Tier 2: Dovie Offer (April 2026 financial projections, most recent numbers)
- Tier 3: Positioning Refined + Positioning Transcript (three-way structural gap thesis)
- Tier 4: Reality Check & Risks (honest threat assessment, milestone-based timeline)
- Tier 5: One-Pager (market sizing, team, broader investment ask)
- Tier 6: Tagline (branding direction, 5 finalists with context-specific recommendations)

## Implementation Principles

1. **Narrative coherence over encyclopedic completeness** — Follow the Problem -> Insight -> Evidence -> Opportunity -> Ask arc that maps to standard investor deck flow.
2. **Evidence-backed claims with quality tiers** — Every quantitative claim traces to a source. Use Tier A (hard facts), B (well-sourced external), C (projections), D (unverifiable) designations.
3. **Proactive transparency** — Address stress points and weak metrics upfront. Investors doing diligence will find them.
4. **Modular extraction** — Each section stands alone for slide or website section extraction.
5. **High-level capability framing** — Per user guidance, describe what the platform accomplishes, not what software was built. Anchor to Manifesto principles. No specific software implementations, file paths, or code references in capability descriptions.
6. **Founder ownership respected** — The founder explicitly said "I'll take it from there." Provide the information backbone, not a finished deck.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Read all seven PDF source documents and prior artifacts | Extracted content notes for synthesis |
| 2 | Gather supplementary production data if needed | Confirmed production metrics (from prior steps or fresh queries) |
| 3 | Write Section 1: The Structural Gap | Three-way thesis in investor-ready language |
| 4 | Write Section 2: Market Opportunity | TAM with three concentric rings + external citations |
| 5 | Write Section 3: What Helix Accomplishes | Six high-level capability categories with Manifesto anchors |
| 6 | Write Section 4: Traction & Momentum | Production metrics with honest contextualization |
| 7 | Write Section 5: Financial Model | Three-layer presentation (base, stress-test, upside) |
| 8 | Write Section 6: Competitive Landscape | Concentric compression model |
| 9 | Write Section 7: Risk Register & Mitigations | Reality Check milestones reframed as founder discipline |
| 10 | Write Section 8: Team & Investment | Team composition + dual investment structure |
| 11 | Write Section 9: Branding & Positioning Language | Context-organized lines ready for direct lift |
| 12 | Write Section 10: Future Vision | ERP-as-database thesis + multi-ERP expansion |
| 13 | Assemble and polish the complete report | Single `report/report.md` with all sections + evidence appendix |
| 14 | Self-verify report completeness and accuracy | Run verification checks against source documents |

## Detailed Implementation Steps

### Step 1: Read All Seven PDF Source Documents and Prior Artifacts

**Goal:** Extract and internalize all source content directly to ensure accurate synthesis. Prior artifacts contain summaries, but the implementation step must re-read primary sources to avoid errors through intermediate summaries.

**What to Build:** Read each attachment PDF in full:
- `<workspace>/.helix-inputs/attachments/cmny1ewa3005kl30u6tp3o0kq--Helix_Manifesto.pdf` (Tier 1)
- `<workspace>/.helix-inputs/attachments/cmny1ew0c005gl30unha4u32j--Helix_AI_Dovie_Offer.pdf` (Tier 2)
- `<workspace>/.helix-inputs/attachments/cmnz14a9j002afy0t18w1aytg--Helix_Positioning_Refined.pdf` (Tier 3)
- `<workspace>/.helix-inputs/attachments/cmnz14abo002cfy0tp6j50zcu--Helix_Positioning_Transcript.pdf` (Tier 3)
- `<workspace>/.helix-inputs/attachments/cmnz14a680028fy0tzjjkdr8w--Reality_Check___Risks.pdf` (Tier 4)
- `<workspace>/.helix-inputs/attachments/cmny1ew5p005il30uh46fw071--Project_X_Innovation_One_Pager.pdf` (Tier 5)
- `<workspace>/.helix-inputs/attachments/cmnz14afl002efy0txyfaolmd--Helix_Tagline.pdf` (Tier 6)

Where `<workspace>` = `/vercel/sandbox/workspaces/cmnz149qb0026fy0tpmnss2b4`

Also re-read prior-step artifacts for synthesized analysis:
- `product/product.md` — product definition with capability categories and success criteria
- `diagnosis/diagnosis-statement.md` — root cause analysis with competitive intelligence and stress-testing
- `tech-research/tech-research.md` — content architecture decisions and evidence quality framework
- `scout/scout-summary.md` — evidence landscape synthesis with production metrics

**Verification (AI Agent Runs):** Confirm all seven PDFs are readable. Confirm prior artifacts are accessible.

**Success Criteria:** All source documents read. No missing sources.

### Step 2: Gather Supplementary Production Runtime Data (If Needed)

**Goal:** Confirm production metrics gathered in prior steps are sufficient. The scout and diagnosis steps already gathered: 7 orgs, 22 users, 264 tickets, 611 runs, 124 deployed, 33 repos, 81% autonomous.

**What to Build:** Check `/tmp/helix-inspect/manifest.json` for runtime inspection availability. If prior metrics are sufficient (they should be based on scout/diagnosis), proceed without additional queries. If a specific data gap is identified (e.g., updated ticket count since prior steps ran), use the runtime-inspection skill for read-only queries against helix-global-server production database.

**Verification (AI Agent Runs):** Confirm production metrics are available from prior artifacts or fresh queries.

**Success Criteria:** All required traction metrics are available for Section 4.

### Step 3: Write Section 1 — The Structural Gap

**Goal:** Frame the problem nobody else is solving using the three-way thesis from Positioning Refined.

**What to Build:** The opening section, establishing the narrative spine. Content includes:
- The three-way structural gap: (1) ERPs standardize complexity but don't own each customer's custom operational layer over time, (2) consultants implement that layer but don't persist, (3) AI models generate into that layer but don't govern it
- The macro trend: human operating teams shrinking from 100 to 10 while business complexity stays constant
- The compressed five-line thesis from Positioning Refined as the centerpiece (verbatim)
- Manifesto anchor: "Intelligence is not the product. Responsibility is."
- Concluding statement: "Helix exists to permanently own the operational layer in between."

**Primary sources:** Positioning Refined PDF, Positioning Transcript PDF, Manifesto PDF.

**Verification (AI Agent Runs):** Confirm the compressed thesis matches the Positioning Refined PDF language exactly.

**Success Criteria:** Section clearly articulates the three-way gap in investor-ready language. No software implementation details. Thesis is verbatim from source.

### Step 4: Write Section 2 — Market Opportunity

**Goal:** Validate the size and growth of the opportunity with conservative and ambitious framings.

**What to Build:** Three concentric TAM rings (per tech-research Decision 3):
- **Inner (Conservative):** 10K NetSuite companies with ongoing customization x $5K/mo x 12 = **$600M** — defensible floor
- **Middle (NetSuite full):** 40K+ companies x $5K-$20K/mo x 12 = **$2.4B-$9.6B** — upper bound overstates continuous spend
- **Outer (Multi-ERP):** ERP consulting/integration market = **$50.1B** (2024) — long-term vision framing

Supporting externally validated data (from diagnosis web search):
- NetSuite: 43,000+ customers across 219 countries (Oracle confirmed)
- AI-in-ERP market: $5.82B (2025) -> $58.7B by 2035 at 26% CAGR (Precedence Research)
- ERP consulting market: $50.1B in 2024 (Verified Market Reports)

Recommended pitch framing: lead with $600M conservative floor, acknowledge $2.4B+ upper bound, use $50B+ as "why this becomes very big."

**Primary sources:** One-Pager PDF, diagnosis-statement.md (web search validated data).

**Verification (AI Agent Runs):** Confirm TAM calculations are arithmetically correct. Cross-check external data citations against diagnosis evidence.

**Success Criteria:** Three-ring TAM model with external citations. Calculations correct. Lead with conservative number.

### Step 5: Write Section 3 — What Helix Accomplishes

**Goal:** Describe product capabilities at six high-level categories, anchored to Manifesto principles. Per user guidance: no specific software implementations.

**What to Build:** Six capability categories (from tech-research Decision 1):
1. **Autonomous operational lifecycle** — End-to-end handling from natural language intent through governed production deployment. 81% of tickets executed autonomously. 47% reach production deployment. Anchors to Manifesto principle: Completion.
2. **Governed execution** — Every action is reversible, observable, and auditable. Trust is engineered through safe testing, approval gates, and deployment controls. Anchors to: Safety.
3. **Production inspection** — Read-only visibility into the live ERP environment for diagnosis, monitoring, and proactive issue detection without risk to the running system. Anchors to: Calibrated Understanding.
4. **Account continuity** — Persistent, durable memory of the account over time: what changed, what depends on what, what is fragile, and why decisions were made. 33 configured repositories across 7 organizations. Anchors to: Continuity.
5. **Bidirectional communication** — Real-time interaction between the platform and human stakeholders for intent clarification, decision discussion, and accountability visibility. Anchors to: Calibrated Understanding.
6. **Enterprise security** — Encrypted credential management, role-based access, and organizational isolation for production ERP environments that run entire businesses. Anchors to: Trust Through Behavior.

Include the boundary test: "If Claude Code can do it, it's not enough. If NetSuite can own it, we don't build it."

Include the core distinction: "Helix is not a tool. Tools assist. Helix operates. Tools suggest. Helix executes. Tools are used. Helix is relied on."

**Critical constraint:** Describe ONLY what the platform accomplishes, not how it is implemented. No file paths, no technology names, no codebase references, no pipeline step names. Quantitative evidence (production metrics) is acceptable.

**Primary sources:** Manifesto PDF, product/product.md capability categories, scout production metrics.

**Verification (AI Agent Runs):** Search the section for implementation-specific terms. Confirm each category maps to a Manifesto principle.

**Success Criteria:** Six categories clearly articulated with Manifesto anchoring. Zero implementation details.

### Step 6: Write Section 4 — Traction & Momentum

**Goal:** Present production metrics with honest contextualization (per tech-research Decision 5).

**What to Build:** Two sub-sections:

**Strong metrics (lead with these):**
| Metric | Value | Why It Matters |
|--------|-------|----------------|
| Organizations | 7 (5 NetSuite, 2 General) | Multi-industry early adoption |
| Users | 22 | Team-level engagement, not single-user trials |
| Total tickets | 264 (143 in first 14 days of April) | Accelerating: on pace for 2x month-over-month |
| Production deployments | 124 (47% of total) | Real operational impact, not experimentation |
| Autonomous execution | 81% in AUTO mode | Platform operates independently |
| Configured repositories | 33 | Deep integration across customer environments |

**Honest metrics (proactively addressed):**
| Metric | Value | Recommended Framing |
|--------|-------|---------------------|
| Run success rate | 55% overall | Beta maturity with improving trajectory |
| NS deployment success | 31% (8/26) | Hardest deployment pipeline; general at 84% shows platform maturity |
| General deployment success | 84% (53/63) | Demonstrates core platform maturity |
| Revenue | Pre-commercial | Conversion-ready pipeline: 5 NS orgs with active tickets |

**Primary sources:** scout/scout-summary.md, diagnosis-statement.md production metrics.

**Verification (AI Agent Runs):** Confirm all metrics match prior-step verified values exactly.

**Success Criteria:** Metrics accurately reported from verified sources. Weak metrics addressed proactively with framing.

### Step 7: Write Section 5 — Financial Model

**Goal:** Present Dovie financial projections with three-layer transparency (per tech-research Decision 2).

**What to Build:**

**Layer 1 — Base Case (Dovie Offer, April 2026):**
- 0 -> 999 customers over 36 months at ~$1,500/mo average
- $50K/mo flat operating costs
- Profitable at month 6 (42 customers)
- 12-month ARR: ~$1.8M (102 customers)
- 36-month ARR: ~$18M
- Exit scenarios: $50M (early, 18mo) / $100M (growth, 36mo) / $150M (strategic, 36mo)
- Pre-money valuation: $2.83M

**Layer 2 — Stress-Test Commentary (four vulnerabilities):**
| Assumption | Vulnerability | Recommended Framing |
|-----------|---------------|---------------------|
| $50K/mo flat costs | AI inference and infrastructure scale with usage | "First-tier economics" with scaling model developing |
| Zero churn modeled | Even 2-3% monthly churn significantly impacts growth at scale | Frame as net-new projection; retention is the key metric to prove |
| 0 paying customers today | 5 NS orgs in production but pre-commercial | "Conversion-ready pipeline" with beta traction |
| Next Technik $60M exit comp | Acquisition price not publicly disclosed | Use as directional reference only; lead with market-based math |

**Layer 3 — Upside Framing:**
- $1,500/mo entry price is deliberate land-and-expand against $5K-$20K/mo consultant replacement value
- 3x-13x pricing headroom above entry point
- Two investment structures: Dovie ($50K-$100K for 2-4% with distributions) and One-Pager ($500K for 15% equity) — complementary vehicles, same $2.83M pre-money

**Primary sources:** Dovie Offer PDF (Tier 2, most recent), One-Pager PDF (Tier 5), diagnosis stress-test analysis.

**Verification (AI Agent Runs):** Cross-check every financial figure against Dovie Offer PDF directly. Confirm all four stress points are addressed.

**Success Criteria:** Financial model with proactive transparency. All figures traceable to source. All stress points addressed.

### Step 8: Write Section 6 — Competitive Landscape

**Goal:** Structure competition using the concentric compression model (per tech-research Decision 4).

**What to Build:** The "governance is scarce" centerpiece:

**Force 1 (ERP platforms compressing inward):**
- Oracle/NetSuite: NetSuite Next (mid-2026), SuiteAgents, AI Connector Service, AI across financial close and developer tooling
- Key point: Oracle makes the platform smarter; this INCREASES complexity of the custom layer, making governance more valuable
- Mitigation: Oracle's business model is platform licensing and extensibility. They enable customization; they don't take end-to-end accountability for each customer's custom operational layer

**Force 2 (AI model vendors compressing inward):**
- Claude Code, OpenAI Codex, GitHub Copilot — increasingly capable at code generation, testing, PR workflows
- Mitigation: They generate code; they don't govern ERP-specific deployment, monitor impact, maintain over time, or take accountability when it breaks

**The unclaimed center: governed operational ownership**
- Neither side claims: safe ERP-specific testing, governed deployment with human approval gates, production monitoring, ongoing maintenance, durable account memory, accountability over time

**Tier 2 (different motion):**
- AI-native ERP replacements (Rillet $100M, Campfire $100M) — REPLACE ERPs rather than operate on them. Validates market sees ERP as ripe for disruption.
- Traditional consultants — potential channel partners

Key insight: "Capability is abundant, governance is scarce." (from Reality Check)

**Important:** Do NOT use a feature comparison matrix. No direct competitor offers what Helix offers. A feature matrix against Oracle or Claude Code would be misleading — they solve different problems.

**Primary sources:** Reality Check PDF, diagnosis competitive intelligence (web search validated), product/product.md competitive landscape.

**Verification (AI Agent Runs):** Confirm competitive claims match diagnosis web search evidence. Ensure Oracle roadmap items are accurately attributed.

**Success Criteria:** Concentric compression model clearly articulated. Oracle addressed head-on with differentiation argument.

### Step 9: Write Section 7 — Risk Register & Mitigations

**Goal:** Present the Reality Check's honest assessment as founder discipline (per tech-research Decision 7).

**What to Build:**

**Milestone-based timeline with kill rules:**
| Horizon | Required State | Kill Rule | Investor Framing |
|---------|---------------|-----------|-----------------|
| 3 months | Safe, not just clever | Kill generic AI convenience | "We build for trust, not tricks" |
| 6 months | Trusted in one narrow lane | Kill breadth | "Own NetSuite customization completely before expanding" |
| 12 months | Stateful and persistent | Kill statelessness | "The account lives inside Helix" |
| 18 months | Governable by institution | Kill informality | "Enterprise-grade trust that survives compliance" |
| 36 months | Where the owned operational layer lives | Kill wrapper behavior | "Either we are the ownership layer or we failed" |

**Key risks with mitigations:**
1. Oracle building it — platform licensing vs. operational ownership
2. AI tools becoming sufficient — generation vs. governed accountability
3. Zero revenue — conversion-ready pipeline with beta traction
4. Cost scaling — first-tier economics with scaling model developing
5. NS deployment maturity — hardest pipeline, general at 84%
6. Time window compression — "why we need capital now"
7. Exit comp unverifiable — use directionally, lead with market math
8. Competitive pace from both sides — "capability abundant, governance scarce"

**Primary sources:** Reality Check PDF (Tier 4), diagnosis risk analysis, product/product.md open questions.

**Verification (AI Agent Runs):** Confirm milestone gates match Reality Check document. Confirm risk list is comprehensive per diagnosis.

**Success Criteria:** Honest risk register. Kill rules positioned as founder discipline. "Less time than it feels like" urgency drives capital argument.

### Step 10: Write Section 8 — Team & Investment

**Goal:** Present team composition and dual investment structure.

**What to Build:**
- 7-person core team with 1-4 years working together
- Roles: CEO/Founder, Tech Lead (AI Research), AI Agent Architect, Project Manager, Lead Dev (NetSuite/OSS contributor), Full Stack Dev, Special Projects
- Two investment tiers (per tech-research Decision about complementary structures):
  - Dovie tier: $50K for 2% or $100K for 4% with net profit distributions (begins month 6)
  - Seed tier: $500K for 15% equity growth
- Both share $2.83M pre-money valuation
- Frame: Dovie targets angels/friends seeking cash-flow returns; One-Pager targets seed investors seeking equity appreciation. Common data foundation; investor-specific structure per audience.

**Primary sources:** One-Pager PDF (team), Dovie Offer PDF (small raise terms).

**Verification (AI Agent Runs):** Confirm team size and roles match One-Pager. Confirm investment terms match source documents.

**Success Criteria:** Team and investment clearly presented. Dual structure explained as complementary, not contradictory.

### Step 11: Write Section 9 — Branding & Positioning Language

**Goal:** Provide pitch-ready branding language organized by destination (per tech-research Decision 8).

**What to Build:**

| Context | Primary Line | Supporting Line |
|---------|-------------|-----------------|
| Homepage / Brand | "Owned operations." | "Helix owns how your NetSuite evolves -- from request to tested, deployed, monitored, and maintained execution." |
| Pitch / Investor | "The ownership layer for NetSuite." | "NetSuite owns the platform. Helix owns the operational layer inside your account." |
| One-slide thesis | Compressed five-line thesis | Verbatim from Positioning Refined |
| Manifesto hook | "Intelligence is not the product. Responsibility is." | Direct from Manifesto |
| Boundary test | "If Claude Code can do it, it's not enough. If NetSuite can own it, we don't build it." | Direct from Manifesto |

Additional tagline finalists from the Tagline document with context-specific rankings as provided in that source.

**Primary sources:** Tagline PDF (Tier 6), Positioning Refined PDF (Tier 3), Manifesto PDF (Tier 1).

**Verification (AI Agent Runs):** Confirm all quoted language matches source PDFs exactly (verbatim comparison).

**Success Criteria:** All branding lines ready for direct lift into slides and website. All quotes verified against source.

### Step 12: Write Section 10 — Future Vision

**Goal:** Close with the long-term thesis and expansion path.

**What to Build:**
- The "ERP as database" future: ERPs become infrastructure nobody interacts with directly; the AI operational layer becomes the primary user interface (from Positioning Transcript)
- Multi-ERP expansion: NetSuite beachhead ($600M conservative) -> SAP, Odoo, others ($50B+ ERP consulting market). The structural gap is not NetSuite-specific.
- Transition from change engine to operating layer: the shift from handling individual requests to being the persistent system-of-operation
- Pricing expansion: $1,500/mo entry -> $5K-$20K/mo as ownership deepens (3x-13x headroom)
- Distribution partner channel as go-to-market motion
- Reality Check urgency as closing: "The window is shorter than it feels like" — why the capital is needed now

**Critical honesty note:** Multi-ERP expansion is aspirational. No technical readiness for non-NetSuite ERPs exists today. The report should acknowledge this as vision, not current capability.

**Primary sources:** Positioning Transcript PDF (ERP-as-database), Manifesto PDF (principles), Reality Check PDF (urgency).

**Verification (AI Agent Runs):** Confirm expansion path is honest about current NetSuite-only readiness.

**Success Criteria:** Compelling closing vision grounded in present evidence. Aspirational but honest.

### Step 13: Assemble and Polish the Complete Report

**Goal:** Combine all sections into a single, cohesive `report/report.md` file.

**What to Build:**
- Create directory `report/` in helix-cli run root if needed
- Write complete report as single markdown file with:
  - Report header (title, date, purpose statement)
  - Executive summary (2-3 paragraph synthesis of the entire report)
  - Table of contents
  - All 10 sections in narrative-arc order
  - Evidence Sources & Quality appendix: catalog all seven PDFs, production data, and external research with quality tier assignments
- Consistent heading levels, formatting, and evidence tier markers throughout

File path: `/vercel/sandbox/workspaces/cmnz149qb0026fy0tpmnss2b4/helix-cli/.helix/tickets/cmny1evoc0056l30up1r5qys5/runs/cmnz149qb0026fy0tpmnss2b4/report/report.md`

**Verification (AI Agent Runs):** Confirm file exists. Confirm all 10 sections present. Confirm evidence appendix exists.

**Success Criteria:** Single cohesive report file with all sections, consistent formatting, evidence appendix.

### Step 14: Self-Verify Report Completeness and Accuracy

**Goal:** Execute verification checks before finishing.

**What to Build:** No new content. Run all Required Checks from the Verification Plan below. Fix any issues found before declaring completion.

**Verification (AI Agent Runs):** All Required Checks pass.

**Success Criteria:** Report passes all verification checks and is ready for the verification step.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects Checks |
|-----------|--------|-----------------|----------------|
| Seven PDF attachments accessible at `.helix-inputs/attachments/` paths | available | File paths confirmed in ticket.md; all seven PDFs read successfully in prior steps | CHK-01, CHK-03, CHK-05, CHK-06 |
| Prior-step artifacts (product.md, diagnosis-statement.md, tech-research.md, scout-summary.md) | available | All artifacts read and confirmed in this planning step | CHK-01, CHK-02, CHK-04 |
| Production runtime metrics (7 orgs, 22 users, 264 tickets, 124 deployed, 81% autonomous, 33 repos) | available | Gathered by scout and diagnosis steps; available in scout-summary.md and diagnosis-statement.md | CHK-04 |
| External market data (NetSuite customer counts, AI-in-ERP market size, ERP consulting market size) | available | Gathered during diagnosis step via web search; available in diagnosis-statement.md | CHK-03 |
| Report output directory writable in helix-cli run root | available | Run root directory confirmed to exist | CHK-01 |
| Runtime inspection for helix-global-server (DATABASE, LOGS) | available | `/tmp/helix-inspect/manifest.json` confirmed in scout step | CHK-04 |

### Required Checks

[CHK-01] Verify report file exists and contains all 10 required sections.
- Action: Read the file at `/vercel/sandbox/workspaces/cmnz149qb0026fy0tpmnss2b4/helix-cli/.helix/tickets/cmny1evoc0056l30up1r5qys5/runs/cmnz149qb0026fy0tpmnss2b4/report/report.md` and confirm the presence of all 10 sections: (1) The Structural Gap, (2) Market Opportunity, (3) What Helix Accomplishes, (4) Traction & Momentum, (5) Financial Model, (6) Competitive Landscape, (7) Risk Register & Mitigations, (8) Team & Investment, (9) Branding & Positioning Language, (10) Future Vision. Also confirm the report has an executive summary and an evidence sources appendix.
- Expected Outcome: The report file exists, is non-empty, and contains clearly labeled sections for all 10 topic areas plus an executive summary and evidence appendix. Each section has substantive content (not placeholder text).
- Required Evidence: File read output showing the report structure with all 10 section headings, executive summary, and evidence appendix, each with non-trivial content.

[CHK-02] Verify narrative arc follows Problem -> Insight -> Evidence -> Opportunity -> Ask ordering.
- Action: Read the report from top to bottom and confirm the section ordering follows: structural gap (problem) -> market opportunity (size) -> capabilities (insight) -> traction (evidence) -> financial model (opportunity) -> competitive landscape -> risks -> team/investment (ask) -> branding -> future vision.
- Expected Outcome: Sections flow in the prescribed narrative arc order. The report opens with the three-way structural gap thesis and builds toward the investment ask and future vision.
- Required Evidence: Sequential list of section headings extracted from the report showing the narrative arc ordering is correct.

[CHK-03] Verify financial figures match source documents.
- Action: Read the Dovie Offer PDF (`<workspace>/.helix-inputs/attachments/cmny1ew0c005gl30unha4u32j--Helix_AI_Dovie_Offer.pdf`) and cross-check at least five specific financial figures from the report: (a) pre-money valuation ($2.83M), (b) 36-month customer target (999), (c) month-6 profitability threshold (42 customers), (d) 36-month ARR (~$18M), (e) conservative TAM ($600M). Read both the report and the source PDF to perform the comparison.
- Expected Outcome: All five figures in the report match the source document values exactly. No figures are invented or miscalculated.
- Required Evidence: Side-by-side excerpts from the report and the Dovie Offer PDF showing matching values for each of the five figures.

[CHK-04] Verify production traction metrics match prior-step verified values.
- Action: Cross-check the traction metrics in the report against the values from `scout/scout-summary.md` and `diagnosis/diagnosis-statement.md`: organizations (7), users (22), total tickets (264), deployed tickets (124), autonomous rate (81%), configured repos (33), run success rate (55%), NS deployment success rate (31%).
- Expected Outcome: All traction metrics in the report match the values verified in prior steps exactly. No metrics are inflated or fabricated.
- Required Evidence: Excerpts from the report's traction section alongside the corresponding values from scout-summary.md or diagnosis-statement.md showing exact matches for all eight metrics.

[CHK-05] Verify no specific software implementation details appear in Helix capability descriptions.
- Action: Read the "What Helix Accomplishes" section (Section 3) and search for implementation-specific terms: file paths (e.g., "src/", ".ts", ".tsx"), technology names used as Helix implementation details (e.g., "Prisma", "Neon", "Northflank"), pipeline step names (e.g., "scout", "diagnosis", "native-phase"), specific API routes, function names, or code snippets. Note: references to external competitors (Oracle, Claude Code, SuiteAgents) are acceptable in the competitive landscape section but not in the Helix capability descriptions.
- Expected Outcome: Section 3 describes Helix capabilities using the six high-level categories (autonomous operational lifecycle, governed execution, production inspection, account continuity, bidirectional communication, enterprise security) without any internal implementation details.
- Required Evidence: Search results across Section 3 confirming no prohibited implementation-specific terms are present. If any borderline terms appear, confirm they are used in a high-level descriptive context, not as implementation references.

[CHK-06] Verify branding and positioning language matches source PDFs.
- Action: Read the Tagline PDF (`<workspace>/.helix-inputs/attachments/cmnz14afl002efy0txyfaolmd--Helix_Tagline.pdf`) and the Positioning Refined PDF (`<workspace>/.helix-inputs/attachments/cmnz14a9j002afy0t18w1aytg--Helix_Positioning_Refined.pdf`), then cross-check at least three quoted branding lines from the report: (a) "Owned operations." tagline, (b) "The ownership layer for NetSuite." pitch line, (c) the compressed five-line thesis from Positioning Refined.
- Expected Outcome: All three branding lines in the report are accurate verbatim reproductions of the source language.
- Required Evidence: Side-by-side excerpts from the report and the source PDFs showing matching language for each of the three items.

[CHK-07] Verify evidence quality tiering is present in the report.
- Action: Read the report's evidence sources appendix and confirm it categorizes claims by reliability tier. Confirm at least three different tiers are represented (e.g., Tier A hard facts, Tier B externally sourced, Tier C projections, Tier D unverifiable).
- Expected Outcome: The report distinguishes between hard facts (production data, team composition), well-sourced external data (market sizes, Oracle announcements), internal projections (Dovie model), and unverifiable claims (Next Technik acquisition price). At least three tiers are labeled.
- Required Evidence: Excerpt from the report showing the evidence quality framework or appendix with at least three different tiers represented and example claims assigned to each.

[CHK-08] Verify the financial model section addresses all four stress-test points.
- Action: Read the financial model section (Section 5) and confirm it proactively addresses all four vulnerabilities: (a) flat costs assumption ($50K/mo through 999 customers), (b) zero churn modeling, (c) zero current revenue (starting at 0 paying customers), (d) unverifiable Next Technik $60M exit comp.
- Expected Outcome: Each of the four stress-test points is explicitly mentioned and framed with a recommended investor-facing response. No vulnerability is omitted or glossed over.
- Required Evidence: Excerpts from the report's financial section showing each of the four stress-test points addressed with explicit framing language.

## Success Metrics

| Metric | Target |
|--------|--------|
| Report completeness | All 10 sections present with substantive content |
| Financial accuracy | All figures traceable to source documents with zero discrepancies |
| Traction accuracy | All production metrics match prior-step verified values exactly |
| Implementation detail compliance | Zero specific software implementation details in Helix capability descriptions |
| Branding accuracy | All quoted lines match source PDFs verbatim |
| Evidence quality | Claims tagged or appendixed with quality tiers (minimum 3 tiers) |
| Narrative coherence | Report flows in Problem -> Evidence -> Opportunity -> Ask arc |
| Stress-test transparency | All four financial vulnerabilities addressed proactively |
| Dual-use readiness | Each section self-contained for slide or website extraction |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Understand deliverable scope, source priorities, and founder guidance | Report is pitch-deck data backbone; focus on Helix for ERPs; Manifesto drives vision; Dovie = most recent numbers; founder will make deck from this |
| User continuation context | Updated guidance on scope, tone, and four new documents | No specific software implementations; highest category level only; include positioning/reality check/tagline docs |
| product/product.md (helix-cli) | Product definition with six capability categories, financial stress points, competitive landscape, success criteria | Six high-level capability categories defined; milestone-based kill gates; dual investment structure; ten open questions |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis with competitive intelligence, financial stress-testing, validated market data, production metrics | Three-way gap validated; Oracle faster than assumed; five Dovie stress points; traction formatted for pitch; competitive tiering |
| diagnosis/apl.json (helix-cli) | Eight investigation questions with evidence-backed answers | Complete evidence landscape: thesis defensibility, financial realism, TAM validation, competitive intel, traction, risks, branding |
| tech-research/tech-research.md (helix-cli) | Content architecture decisions: narrative-arc structure, six capabilities, three-layer financials, concentric compression model, evidence tiers | Eight core content decisions defining report structure and framing. This is the architectural blueprint for the report. |
| tech-research/apl.json (helix-cli) | Six investigation questions with answers on report design | Confirmed narrative-arc optimal; three-layer financial presentation; evidence quality tier framework |
| scout/scout-summary.md (helix-cli) | Pre-synthesized analysis of all 7 PDFs, 6 codebases, production runtime data | Evidence landscape by six tiers; 8 key unknowns; production metrics with NS vs. general breakdown |
| repo-guidance.json (helix-cli) | Repo intent mapping | helix-cli = target for research output; all other repos = context only; no code changes needed |
| Helix Manifesto PDF (Tier 1) | Philosophical foundation, 9 principles, boundary test | "Intelligence is not the product. Responsibility is."; "If Claude Code can do it, it's not enough" |
| Dovie Offer PDF (Tier 2) | Most recent financial projections (April 2026) | 36-month model: 0-999 customers, $50K flat costs, profitable month 6, exit scenarios up to $150M |
| Positioning Refined PDF (Tier 3) | Core narrative: three-way structural gap thesis | Compressed five-line thesis statement — the single most pitch-ready language in evidence base |
| Positioning Transcript PDF (Tier 3) | Raw founder articulation of thesis | ERP-as-database future; accountability gap; shrinking human operating layers |
| Reality Check & Risks PDF (Tier 4) | Honest threat assessment with milestone-based timeline | "Capability abundant, governance scarce"; milestone gates at 3/6/12/18/36mo; "less time than it feels like" |
| One-Pager PDF (Tier 5) | Market sizing and team composition | $500K/15% ask; $2B+ TAM; 40K+ NS companies; 7-person team |
| Tagline PDF (Tier 6) | Branding direction with context-specific recommendations | "Owned operations." (homepage) + "The ownership layer for NetSuite." (pitch) |

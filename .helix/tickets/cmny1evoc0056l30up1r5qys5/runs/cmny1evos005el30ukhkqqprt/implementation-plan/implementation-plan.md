# Implementation Plan — RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Overview

This plan assembles a comprehensive, modular investor-pitch research report for Helix for ERPs. The report will be written to `report/report.md` in the helix-cli run root. No code changes are required in any repository. The report synthesizes evidence from 6 codebases, 3 PDF attachments, production runtime data, and externally validated market research — all previously gathered during scout, diagnosis, product, and tech-research steps.

The report has 9 self-contained sections designed for dual use: (1) as prompt context for generating pitch deck slides and (2) as source material for updating gethelix.ai.

## Implementation Principles

1. **Evidence-backed claims only** — Every factual assertion cites a specific source (codebase file path, production data query, PDF attachment, or external research citation).
2. **Modular independence** — Each section is self-contained and extractable without cross-section dependencies.
3. **Honest framing** — Weak metrics are surfaced with context, not hidden. Assumptions are called out transparently.
4. **Manifesto-anchored narrative** — The accountability thesis ("Intelligence is not the product. Responsibility is.") is the narrative spine.
5. **Dual audience** — Content serves both investors (pitch deck) and website visitors (gethelix.ai).

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Refresh production metrics via runtime inspection | Fresh production data (org count, ticket count, deployment stats) for Section 6 |
| 2 | Capture current gethelix.ai website state | Website messaging notes for alignment/contrast in report |
| 3 | Write Section 1: Executive Narrative | Opening thesis, elevator pitch, and positioning language |
| 4 | Write Section 2: Product Capabilities | Evidence-backed feature inventory from codebase |
| 5 | Write Section 3: Market Sizing | TAM/SAM/SOM with external validation citations |
| 6 | Write Section 4: Financial Model Analysis | Dovie projections with 3-scenario stress test |
| 7 | Write Section 5: Competitive Landscape | 2x2 positioning matrix with differentiation arguments |
| 8 | Write Section 6: Traction Dashboard | Production metrics formatted for investor credibility |
| 9 | Write Section 7: Risk Register | Investor objections with evidence-based mitigations |
| 10 | Write Section 8: Strategic Roadmap | Near-term and long-term expansion path |
| 11 | Write Section 9: Key Quotes & Positioning | Manifesto-sourced language for slides and site |
| 12 | Assemble final report | Combine all sections into `report/report.md` |
| 13 | Self-verify report completeness | Run verification checks against success criteria |

## Detailed Implementation Steps

### Step 1: Refresh Production Metrics via Runtime Inspection

**Goal:** Obtain the latest production data to ensure report accuracy as of April 2026.

**What to Build:**
- Use the `runtime-inspection` skill to query the helix-global-server production database.
- Gather: organization count (total, by platform type, active in last 30 days), user count, ticket counts (total, by month, by status), run counts (total, succeeded, failed), deployment counts (general vs NetSuite, success rates), configured repository count.
- Record results for use in Section 6 (Traction Dashboard) and as evidence citations throughout.

**Verification (AI Agent Runs):**
- Confirm runtime inspection queries return data without errors.
- Compare refreshed metrics against scout-summary values (7 orgs, 261 tickets, 606 runs) — values should be same or higher.

**Success Criteria:**
- Fresh metric set documented with query timestamps.
- Any discrepancies from prior scout data noted and explained.

---

### Step 2: Capture Current gethelix.ai Website State

**Goal:** Record current website messaging for alignment and contrast in the report narrative.

**What to Build:**
- Use `agent-browser` to navigate to https://gethelix.ai and capture the current homepage messaging, feature descriptions, and positioning language.
- Take a screenshot for reference.
- Note any messaging that differs from the Manifesto's positioning (ticket says the website "was not very accurate").

**Verification (AI Agent Runs):**
- Screenshot captured successfully.
- Key messaging points noted.

**Success Criteria:**
- Current website messaging documented or, if the site is unavailable, that fact is recorded and the report uses the Manifesto as the sole positioning source (per tech-research decision).

---

### Step 3: Write Section 1 — Executive Narrative

**Goal:** Open the report with the compelling story of what Helix is, why it exists, and why it matters now.

**What to Build:**
- **Thesis statement** rooted in the Manifesto: "Intelligence is not the product. Responsibility is."
- **The problem:** 40,000+ NetSuite companies spend $5K-$20K/month on consultants. Slow, expensive, never-ending.
- **The vision:** ERPs will become data stores (like databases). The AI interface layer that owns customization, deployment, and maintenance is the future. Helix is that layer.
- **Elevator pitch:** "Autonomous ERP operator. Humans express intent. Helix creates, tests, deploys, monitors, and maintains — end-to-end, with accountability."
- **Why now:** AI intelligence commoditizing (Claude Code, Copilot, etc.), but operational accountability is not commoditized. ERPs (especially NetSuite) have massive installed base with high customization needs.
- Draw from: Manifesto (philosophical anchor), ticket description (founder's own framing), and product.md (elevator pitch language).

**Verification (AI Agent Runs):**
- Section contains a clear thesis, problem, vision, and "why now" with citations to Manifesto pages and ticket description.

**Success Criteria:**
- Investor-ready opening narrative that could standalone as a 60-second pitch.
- Manifesto quotations are verbatim with page attribution.

---

### Step 4: Write Section 2 — Product Capabilities

**Goal:** Provide an evidence-backed inventory of what Helix can do today.

**What to Build:**
- **Core capability table** with 15+ features, each citing the specific codebase file that proves it (from diagnosis-statement.md capability table).
- **9-step autonomous pipeline** walkthrough: Scout -> Diagnosis -> Product -> Tech Research -> Implementation Plan -> Implementation -> Code Review -> Verification -> Preview Config. Cite `helix-workflow-step-catalog.ts`.
- **Ticket modes** explained: AUTO, BUILD, FIX, RESEARCH, EXECUTE.
- **Key differentiators** framed for investors: per-ticket database branching (Neon), ephemeral preview environments (Northflank), AES-256-GCM credential encryption, production inspection with audit logging.
- **ns-gm open-source tool** — MIT-licensed, npm-published, created by team member. Shows OSS strategy.
- **Architecture note:** ERP-specific logic is isolated in `native-phase.ts`; core pipeline is ERP-agnostic, supporting multi-ERP expansion.

**Verification (AI Agent Runs):**
- Every capability in the table has a codebase file citation.
- Feature count matches or exceeds the 15 features identified in diagnosis.

**Success Criteria:**
- Complete, investor-readable feature inventory. No unverified claims.

---

### Step 5: Write Section 3 — Market Sizing

**Goal:** Present a layered, externally validated market-sizing framework.

**What to Build:**
- **TAM:** AI-in-ERP market — $5.82B (2025) growing to $58.7B by 2035 at 26% CAGR. Source: Precedence Research.
- **SAM:** NetSuite consulting spend — 43K-69K+ companies (Oracle, Enlyft, TheirStack confirmations) x $3K-$10K/mo average = $1.5B-$8.3B annually. Position the $2B+ headline claim here as SAM.
- **SOM:** Realistically serviceable near-term — ~5K-10K companies with active customization needs and budget = $90M-$180M at $1,500/mo. The Dovie model's 999 customers = $18M ARR = ~10-20% SOM penetration.
- **Multi-ERP ceiling:** Beyond NetSuite, SAP and Odoo represent additional ERP markets. Total ERP market = $70B+ and growing.
- **External validation table** mapping each claim to its source.

**Verification (AI Agent Runs):**
- TAM/SAM/SOM layers all have at least one external citation.
- Numbers are internally consistent (SOM < SAM < TAM).
- The $2B+ claim is positioned as SAM with appropriate qualifiers.

**Success Criteria:**
- An investor can trace every market-size number to its source.

---

### Step 6: Write Section 4 — Financial Model Analysis

**Goal:** Present the Dovie projections with transparent stress-testing.

**What to Build:**
- **Base case (Dovie model):** Reproduce key milestones — 0 to 999 customers over 36 months, $1,500/mo average, $50K flat costs, profitable month 6, $18M ARR at month 36, exit scenarios $50M-$150M. Cite Dovie Offer pages.
- **Conservative case:** 30% slower acquisition (0 to ~500 customers), 3% monthly churn, variable costs ($50K + $30/customer/mo for AI inference), same $1,500/mo ARPU. Breakeven ~month 12-14. 36-month ARR ~$6M-$8M.
- **Optimistic case:** Same growth as Dovie, 1% churn, variable costs ($50K + $15/customer/mo), value-based pricing upsell to $2,500/mo ARPU for enterprise tier. Breakeven month 5. 36-month ARR ~$25M-$30M.
- **Assumption callout box:** Explicitly flag the flat-cost assumption, zero-churn assumption, and immediate sales ramp as areas for model refinement.
- **Investment structure note:** Two complementary tiers — Dovie angel ($50K-$100K for 2-4% with distributions) and seed ($500K for 15% equity appreciation). Both share $2.83M pre-money.
- **Exit comp:** Oracle/Next Technik acquisition (Oct 2023) — confirmed but $60M price unverifiable. Cite as "reported" not "confirmed."

**Verification (AI Agent Runs):**
- All three scenarios have consistent math (check: 999 customers x $1,500/mo = $1,498,500 MRR = ~$18M ARR).
- Conservative scenario still reaches profitability within 14 months.
- Dovie data points match the PDF exactly.

**Success Criteria:**
- Transparent, investor-credible financial analysis with honest assumption surfacing.

---

### Step 7: Write Section 5 — Competitive Landscape

**Goal:** Map the competitive terrain and clearly articulate Helix's unique positioning.

**What to Build:**
- **2x2 positioning matrix** — Axes: "Scope of Responsibility" (task-level vs. system-level) x "Domain Specificity" (general-purpose vs. ERP-specialized).
  - Task/General: Claude Code, GitHub Copilot, Cursor — Low-Medium threat.
  - Task/ERP: NetSuite Next (Oracle agentic AI, Autonomous Close) — **High** threat.
  - System/General: Rillet ($100M), Campfire ($100M), ChatFin — Medium threat (different buyer, different sale — they replace ERPs rather than operate them).
  - System/ERP: **Helix (alone)** — the defensible position.
- **Oracle/NetSuite Next deep-dive:** Acknowledge this as the most direct threat. Differentiate on Manifesto thesis: Oracle's business is platform licensing, not accountability for customization outcomes. Oracle makes NetSuite smarter; Helix makes NetSuite accountably operated. These are complementary, like Salesforce getting smarter not eliminating Salesforce consultants.
- **Moat analysis:** The 9-step pipeline, production deployment, credential management, audit trails, and continuity model constitute operational infrastructure that AI tools alone cannot replicate.
- **Comp citations:** Rillet/Campfire fundraises (TechCrunch 2025), Oracle/Next Technik acquisition (Oct 2023).

**Verification (AI Agent Runs):**
- All four quadrants populated with named competitors.
- Oracle/NetSuite Next threat addressed directly with differentiation argument.
- Citations for all competitor data points.

**Success Criteria:**
- Investor can understand competitive positioning in under 2 minutes reading.

---

### Step 8: Write Section 6 — Traction Dashboard

**Goal:** Present production metrics in a format that maximizes investor credibility.

**What to Build:**
- **Lead-with-strength metrics table:**
  - 261 total tickets (140 in April, 121 in March = 16% MoM growth)
  - 123 tickets deployed to production (47% deployment rate)
  - 7 organizations (5 NetSuite, 2 General)
  - 22 users (multiple users per org = team adoption)
  - 33 configured repositories (deep integration)
  - 5 active organizations in last 30 days (71% monthly active)
  - 606 sandbox runs to date
  - 4 enterprise beta users (from One Pager)
- **Contextualized weak metrics:**
  - 55% run success rate — "autonomous ERP operation is genuinely hard; each failure generates training data."
  - 31% NS deployment success (8/26) — "NetSuite SDF deployment is notoriously complex; general deployments at 85% (52/61)."
  - Zero revenue — "4 enterprise betas validating product-market fit; conversion to paid is a GTM milestone."
- Use data from Step 1 (refreshed production metrics) if available; fall back to scout-summary data if inspection is unavailable.

**Verification (AI Agent Runs):**
- All metrics sourced to either production runtime queries or scout/reference-map data.
- Weak metrics accompanied by honest context and improvement trajectories.
- No metrics fabricated or estimated without flagging.

**Success Criteria:**
- Dashboard format is scannable, data-dense, and credibility-building.

---

### Step 9: Write Section 7 — Risk Register

**Goal:** Proactively address investor objections with evidence-based mitigations.

**What to Build:**
- **Risk table** with columns: Risk | Severity | Evidence | Mitigation
- Key risks (from diagnosis/apl.json Q6):
  1. **Oracle builds it themselves** — High severity. NetSuite Next agentic AI. Mitigation: platform vs. accountability distinction, Manifesto thesis.
  2. **AI tools become good enough** — Medium. Claude Code/Copilot commoditize code gen. Mitigation: Helix differentiates on full lifecycle, not just code generation.
  3. **Zero revenue today** — High. 0 paying customers April 2026. Mitigation: 4 enterprise betas, distribution partner, 261 tickets prove usage.
  4. **Cost scaling** — Medium-High. $50K flat costs unrealistic at scale. Mitigation: propose $50K + $15-30/customer/mo variable model; even at $30/customer, 999 customers = $80K/mo total, still profitable.
  5. **55% success rate** — Medium. May concern reliability-focused investors. Mitigation: beta-stage product maturity; 9-step pipeline is the reliability mechanism; general deploys at 85%.
  6. **Team of 7 at 999 customers** — Medium. Leverage via automation. Mitigation: autonomous pipeline eliminates manual work; customer support is AI-compressed (Manifesto Principle 9).
  7. **NetSuite-only initially** — Low-Medium. Limits near-term TAM. Mitigation: architecture ready for multi-ERP (native-phase.ts isolation); NetSuite is beachhead.
  8. **Two competing investment structures** — Low. Dovie vs One Pager. Mitigation: complementary tiers for different investor profiles.

**Verification (AI Agent Runs):**
- All 8 risks from diagnosis/product are covered.
- Each risk has both evidence (why it's a risk) and mitigation (why it's manageable).
- No risk dismissed without evidence.

**Success Criteria:**
- An investor reading this section feels the founder has thought deeply about failure modes.

---

### Step 10: Write Section 8 — Strategic Roadmap

**Goal:** Paint the near-term and long-term expansion path.

**What to Build:**
- **Phase 1 (Now - 12 months): NetSuite Dominance**
  - Convert 4 enterprise betas to paying customers
  - Improve NS deployment success rate (31% → target 80%+)
  - Launch distribution partner channel
  - Reach 100+ customers, $150K+ MRR
  - Self-service onboarding
- **Phase 2 (12-24 months): Multi-ERP Expansion**
  - Add SAP Business One integration (same native-phase pattern)
  - Add Odoo integration
  - 500+ customers across ERP platforms
  - Value-based pricing tiers
- **Phase 3 (24-36 months): Platform Play**
  - "The AI interface for ERPs" — not just NetSuite
  - 1,000+ customers, ~$18M ARR
  - Potential strategic exit ($50M-$150M)
  - Consultant partner ecosystem
- **Architecture readiness note:** Cite `native-phase.ts` isolation as evidence that multi-ERP expansion follows a proven pattern, not a rewrite.

**Verification (AI Agent Runs):**
- Each phase has specific, measurable milestones.
- Phase 1 milestones align with Dovie projections.
- Multi-ERP expansion framed honestly (architecture supports it, no code yet).

**Success Criteria:**
- Roadmap tells a credible growth story without overpromising.

---

### Step 11: Write Section 9 — Key Quotes & Positioning

**Goal:** Provide ready-to-use language from the Manifesto for pitch deck slides and website.

**What to Build:**
- **Headline quotes** (verbatim from Manifesto, with page attribution):
  - "Intelligence is not the product. Responsibility is."
  - "Humans express intent. Helix owns outcomes."
  - "If Claude Code can do it, it's not enough. If NetSuite can own it, we don't build it."
  - "Software is fast but detached. Consultants are accountable but slow. Helix is accountable at speed."
  - "Generating code is commoditized. Reliability is not."
  - "Helix does not complete tasks. Helix maintains systems."
  - "Tools assist. Helix operates. Tools suggest. Helix executes. Tools are used. Helix is relied on."
- **Suggested slide headlines** derived from the narrative:
  - "The $2B Consultant Problem" (market sizing)
  - "From Intent to Production in Minutes" (product demo)
  - "The Accountability Gap" (competitive positioning)
  - "ERPs Are the Next Databases" (vision)
- **Website messaging suggestions** contrasting current site (if captured in Step 2) with Manifesto-aligned positioning.

**Verification (AI Agent Runs):**
- All quotes verified verbatim against Manifesto PDF text.
- Page numbers/sections attributed.

**Success Criteria:**
- A pitch-deck designer could pick up any quote and use it directly.

---

### Step 12: Assemble Final Report

**Goal:** Combine all 9 sections into a single polished `report/report.md` file.

**What to Build:**
- Combine Sections 1-9 with consistent formatting.
- Add report header: title, date, confidentiality notice, table of contents.
- Add appendix: data sources catalog, methodology note, artifact inputs table.
- Write the file to: `<helix-cli run root>/report/report.md`

**Verification (AI Agent Runs):**
- File exists at the expected path.
- All 9 sections present with correct headings.
- Table of contents links are accurate.

**Success Criteria:**
- Single, polished markdown document ready for use as pitch-deck prompt and website content source.

---

### Step 13: Self-Verify Report Completeness

**Goal:** Run all verification checks from the Verification Plan before completing.

**What to Build:**
- Execute each Required Check from the Verification Plan below.
- Record pass/fail for each check.
- Fix any issues found before declaring completion.

**Verification (AI Agent Runs):**
- All Required Checks from the Verification Plan pass.

**Success Criteria:**
- Report meets all 7 success criteria from product.md.

---

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects Checks |
|-----------|--------|----------------|----------------|
| Runtime inspection available for helix-global-server (DATABASE, LOGS) | available | `/tmp/helix-inspect/manifest.json` confirms DATABASE and LOGS types | [CHK-04] |
| Prior artifacts complete (scout, diagnosis, product, tech-research) | available | All artifacts read and verified in helix-cli run root | [CHK-01], [CHK-02], [CHK-03], [CHK-05], [CHK-06], [CHK-07] |
| Helix Manifesto PDF attachment | available | `/vercel/sandbox/workspaces/cmny1evos005el30ukhkqqprt/.helix-inputs/attachments/cmny1ewa3005kl30u6tp3o0kq--Helix_Manifesto.pdf` | [CHK-03], [CHK-07] |
| Helix AI Dovie Offer PDF attachment | available | `/vercel/sandbox/workspaces/cmny1evos005el30ukhkqqprt/.helix-inputs/attachments/cmny1ew0c005gl30unha4u32j--Helix_AI_Dovie_Offer.pdf` | [CHK-05] |
| Project X One Pager PDF attachment | available | `/vercel/sandbox/workspaces/cmny1evos005el30ukhkqqprt/.helix-inputs/attachments/cmny1ew5p005il30uh46fw071--Project_X_Innovation_One_Pager.pdf` | [CHK-05] |
| Network access for gethelix.ai | unknown | Website may or may not be reachable from sandbox | [CHK-08] |

### Required Checks

[CHK-01] Verify report file exists with all 9 sections.
- Action: Read the file at `<helix-cli run root>/report/report.md` and confirm it contains all 9 section headings: (1) Executive Narrative, (2) Product Capabilities, (3) Market Sizing, (4) Financial Model Analysis, (5) Competitive Landscape, (6) Traction Dashboard, (7) Risk Register, (8) Strategic Roadmap, (9) Key Quotes & Positioning.
- Expected Outcome: The file exists and all 9 section headings are present in the correct order.
- Required Evidence: File read output showing all 9 section headings present.

[CHK-02] Verify evidence citations throughout the report.
- Action: Search the report for evidence citation patterns (e.g., file paths like `helix-global-server/src/`, PDF references like "Manifesto", "Dovie Offer", "One Pager", and external source references like "Precedence Research", "Enlyft", "Oracle").
- Expected Outcome: At least 30 distinct evidence citations across the report, with every section containing at least one citation.
- Required Evidence: Count of citations per section from grep/search output.

[CHK-03] Verify Manifesto quotes are verbatim.
- Action: Read the Manifesto PDF and cross-reference at least 5 key quotes used in the report to confirm they are word-for-word accurate.
- Expected Outcome: All checked quotes match the Manifesto PDF text exactly.
- Required Evidence: Side-by-side comparison of at least 5 quotes showing report text vs. Manifesto PDF text.

[CHK-04] Verify production metrics are sourced from runtime data.
- Action: Use runtime-inspection skill to query helix-global-server production database for organization count, ticket count, and run count. Compare these values against what appears in Section 6 (Traction Dashboard) of the report.
- Expected Outcome: Metrics in the report match or closely align with fresh runtime query results (within a reasonable range for data that may have grown since scout).
- Required Evidence: Runtime query output alongside the corresponding report metrics, showing alignment.

[CHK-05] Verify financial data accuracy against source PDFs.
- Action: Read the Dovie Offer PDF and verify that the report's Section 4 (Financial Model Analysis) correctly reproduces: (a) customer growth trajectory (0 to 999 over 36 months), (b) profitability month (month 6, Sep 2026), (c) pre-money valuation ($2.83M), (d) 36-month ARR (~$18M), (e) exit scenarios ($50M-$150M). Also verify One Pager data: $500K/15%, breakeven month 8, $1.7M 12-month ARR.
- Expected Outcome: All financial data points in the report match the source PDFs exactly.
- Required Evidence: Specific data point comparisons showing report values vs. PDF values.

[CHK-06] Verify market sizing has external validation.
- Action: Check that Section 3 (Market Sizing) contains: (a) TAM with Precedence Research citation, (b) SAM with at least two independent NetSuite customer count sources, (c) SOM with a realistic near-term estimate that is smaller than SAM.
- Expected Outcome: All three market-sizing layers (TAM/SAM/SOM) present with external citations. The $2B+ claim is positioned as SAM, not TAM, with appropriate qualifiers.
- Required Evidence: Extracted TAM/SAM/SOM figures and their citation sources from the report.

[CHK-07] Verify competitive landscape covers all four quadrants.
- Action: Check that Section 5 (Competitive Landscape) includes: (a) the 2x2 positioning matrix with both axes labeled, (b) named competitors in each of the four quadrants, (c) specific treatment of Oracle/NetSuite Next as the primary threat with differentiation argument, (d) Helix positioned uniquely in system-level/ERP-specialized quadrant.
- Expected Outcome: All four quadrants populated with at least one named player each. Oracle/NetSuite Next is addressed directly. Helix's unique positioning is articulated.
- Required Evidence: The 2x2 matrix content and Oracle/NetSuite Next differentiation text extracted from the report.

[CHK-08] Verify report is self-contained and section-independent.
- Action: Read any single section (e.g., Section 3 Market Sizing) in isolation and verify it makes sense without requiring context from other sections — i.e., it contains its own thesis, evidence, and data points.
- Expected Outcome: The selected section is comprehensible and useful as standalone content, suitable for direct use as pitch-deck prompt context.
- Required Evidence: The full text of one section extracted from the report, with confirmation it contains a thesis statement, supporting data, and source citations.

## Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Section completeness | 9/9 sections present | [CHK-01] |
| Evidence citation density | 30+ citations across report | [CHK-02] |
| Manifesto quote accuracy | 100% verbatim match | [CHK-03] |
| Production data freshness | Metrics from runtime queries | [CHK-04] |
| Financial data accuracy | 100% match to source PDFs | [CHK-05] |
| Market sizing validation | 3 layers with external sources | [CHK-06] |
| Competitive coverage | 4/4 quadrants populated | [CHK-07] |
| Section independence | Any section usable standalone | [CHK-08] |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| `helix-cli/.../ticket.md` | Understand deliverable requirements, source hierarchy, and founder's strategic framing | Deliverable is pitch-deck data backbone; Manifesto = most sincere; Dovie = most recent numbers; focus on Helix for ERPs only |
| `helix-cli/.../scout/scout-summary.md` | Pre-synthesized analysis of all 6 repos, 3 PDFs, and production metrics | Complete evidence inventory: 9-step pipeline, 80+ APIs, 7 orgs, 261 tickets, 606 runs, all financial extractions |
| `helix-cli/.../diagnosis/diagnosis-statement.md` | Market validation, financial stress-testing, competitive landscape, risk cataloging | $2B+ TAM partially validated; flat costs unrealistic; 4 competitor categories; Oracle threat acknowledged; 8 key risks identified |
| `helix-cli/.../diagnosis/apl.json` | 7 diagnostic questions with fully evidence-backed answers | Comprehensive answers on capabilities, financials, TAM, competition, traction, risks, and Manifesto positioning |
| `helix-cli/.../product/product.md` | Product definition with 7 success criteria, 6 use cases, feature inventory | 7 measurable success criteria for the report; scope constraints (Helix for ERPs only); open questions catalogued |
| `helix-cli/.../tech-research/tech-research.md` | Report architecture decisions and analytical frameworks | 9-section modular structure chosen; TAM/SAM/SOM framework; 3-scenario stress-test model; 2x2 competitive matrix; narrative anchor decision |
| `helix-cli/.../tech-research/apl.json` | 6 technical questions answered with evidence on report design | Modular architecture rationale; financial framing strategy; market-sizing methodology; investment-tier presentation; competitive positioning framework; weak-metric framing approach |
| `helix-cli/.../repo-guidance.json` | Confirm repo roles — helix-cli is target; all others are context | No code changes in any repo; helix-cli hosts research output |
| `Helix_Manifesto.pdf` (attachment) | Narrative anchor and verbatim quotes for Sections 1, 5, 9 | 9 principles; "Intelligence is not the product. Responsibility is."; accountability gap is the moat |
| `Helix_AI_Dovie_Offer.pdf` (attachment) | Financial model source data for Section 4 | 36-month model, $2.83M pre-money, exit scenarios, distribution model, Oracle/Next Technik comp |
| `Project_X_Innovation_One_Pager.pdf` (attachment) | Market sizing and investment structure for Sections 3, 4 | $500K/15% ask, $2B+ TAM, 40K+ NS companies, 7-person team, 4 enterprise betas |
| `/tmp/helix-inspect/manifest.json` | Confirm runtime inspection availability for fresh production data | helix-global-server DATABASE and LOGS types available for metric refresh |

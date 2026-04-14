# Diagnosis Statement — RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Problem Summary

This is a RESEARCH ticket requesting a comprehensive information package to serve as the data backbone for an investor pitch deck and updated website for **Helix for ERPs** (primarily NetSuite, expanding to other ERPs). Seven PDF attachments provide the evidence landscape — ranging from the Helix Manifesto (philosophical foundation), Dovie Offer (financial projections), Positioning Refined + Transcript (core thesis narrative), Reality Check & Risks (honest threat assessment with timeline milestones), One Pager (market sizing and team), and Tagline (branding direction). Six codebases and production runtime data provide additional evidence. No code changes are required — the output is a research report synthesizing product, market, financial, competitive, and strategic information.

**User guidance (continuation context):** Discuss product capabilities at the highest category level only. Do not point out specific software implementations. Focus on Helix for ERPs (not Helix Global as a general dev tool). Include the newly added positioning, reality check, and tagline documents.

## Root Cause Analysis

The "root cause" for this research ticket is the information gap between what exists across dispersed sources and what's needed for a compelling, evidence-backed investor narrative. The key synthesis challenges are:

### 1. The Positioning Thesis Is Strong But Needs Market Validation

The three-way structural gap thesis (from Positioning Refined) is the narrative backbone:
- ERPs standardize complexity but don't own each customer's custom operational layer over time
- Consultants implement that layer but don't persist
- AI models generate into that layer but don't govern it
- Meanwhile, human operating teams are shrinking while business complexity stays constant
- **Helix exists to permanently own the operational layer in between**

**External validation (web search, April 2026):** Oracle/NetSuite has 43,000+ customers across 219 countries. Even with NetSuite Next (rolling out mid-2026) and SuiteAgents, Oracle's messaging remains focused on platform enablement, agentic helpers, and extensibility — NOT permanent ownership of each customer's custom layer. The trust gap for generic AI models in production ERP remains real — Anthropic's own documentation includes examples of agentic misbehavior. The thesis holds.

### 2. Financial Projections Need Stress-Testing for Investor Scrutiny

**Dovie Offer (April 2026, most recent):**
- 0 → 999 customers over 36 months at ~$1,500/mo average
- Profitable at month 6 (42 customers); payback month 22
- 36-month ARR: ~$18M; Exit scenarios: $50M (early) to $150M (strategic)
- Investment: $50K for 2% or $100K for 4% with net profit distributions

**One Pager (March 2026, broader ask):**
- $500K for 15% equity at $2.83M pre-money
- 12-month ARR: $1.7M; breakeven month 8

**Stress points requiring proactive framing:**

| Assumption | Concern | Recommended Framing |
|-----------|---------|-------------------|
| $50K/mo flat costs through 999 customers | AI inference, infrastructure, and support scale with usage | Show cost-scaling tiers or explain efficiency leverage |
| Zero churn modeled | Even 2-3% monthly churn at scale significantly impacts net growth | Frame as conservative net-new projection; add churn sensitivity |
| Starting at 0 paying customers now | 5 NS orgs active in production but none confirmed paying | Frame as "conversion-ready pipeline" with beta traction |
| $1,500/mo average | Below the $5K-$20K/mo value proposition | Frame as pricing upside: land at $1.5K, expand to $5K+ |
| Next Technik $60M exit comp | Acquisition price not publicly disclosed | Use as directional reference, not confirmed valuation |

### 3. The Competitive Landscape Is Heating Up Faster Than Initially Assumed

The Reality Check document warned that "the pace is faster on both sides than your current framing implies." Fresh web search evidence confirms this:

**Oracle/NetSuite (Tier 1 threat):**
- **NetSuite Next** — rolling out mid-2026 in North America: agentic workflows, Ask Oracle (conversational intelligence), AI Canvas (scenario planning), Redwood UI redesign
- **SuiteAgents** — announced SuiteWorld 2025: developers/users can build autonomous agents on SuiteCloud that "analyze your business and take action on your behalf"
- **AI Connector Service** — launched August 2025: connects NetSuite to Claude, ChatGPT, and any MCP-compatible system for AI-driven access to NetSuite data
- **SuiteScript n/llm module** — embeds generative AI directly into SuiteScript customizations
- **NetSuite 2026.1** — AI across financial close, reconciliation, forecasting, developer tooling

**Key mitigation:** Oracle's AI is about in-platform intelligence and developer enablement. It does NOT mean Oracle is stepping in to permanently own, govern, deploy, monitor, and maintain each customer's custom operational layer over time. That layer remains unclaimed — which is exactly where Helix sits.

**AI-native ERP replacements (Tier 2):** Rillet ($100M raised, 2025), Campfire ($100M raised) — these REPLACE ERPs, not operate on top of them. Different buyer, different motion.

**AI coding tools (Tier 3):** Claude Code, OpenAI Codex, GitHub Copilot — increasingly capable at code generation but don't handle ERP-specific lifecycle governance (sandbox testing, safe deployment, monitoring, rollback, ongoing maintenance).

### 4. The TAM Needs Conservative and Ambitious Framings

| TAM Frame | Calculation | Assessment |
|-----------|------------|------------|
| Upper bound (One Pager) | 40K+ companies × $5K-$20K/mo × 12 = $2.4B-$9.6B | Overstates — not all companies spend continuously |
| Conservative near-term | 10K companies with ongoing customization × $5K/mo × 12 = $600M | Defensible floor for NetSuite alone |
| Broader AI-in-ERP market | $5.82B in 2025 → $58.7B by 2035 at 26% CAGR | Macro tailwinds validated |
| Multi-ERP expansion | ERP consulting/integration market at $50.1B (2024) | Long-term vision framing |

### 5. Production Traction Demonstrates Real Momentum

| Metric | Value | Investor Narrative |
|--------|-------|-------------------|
| Organizations | 7 (5 NetSuite, 2 General) | Multi-industry early adoption |
| Users | 22 | Team-level engagement, not single-user trials |
| Total tickets | 264 (143 in first 14 days of April) | Accelerating: on pace for 2x month-over-month growth |
| Tickets deployed to production | 124 (47% of total) | Real production impact, not just experimentation |
| Configured repos | 33 | Deep integration across customer codebases |
| Autonomous execution | 81% of tickets in AUTO mode | Platform operates independently, not as a tool |

**Concerns to address proactively:**
- 55% overall run success rate — frame as "beta maturity with improving trajectory"
- 31% NetSuite deployment success (8/26) vs. 84% general (53/63) — frame as "the hardest pipeline" with clear improvement path
- No billing/subscription data in production — revenue is pre-commercialization

### 6. Timeline Urgency from Reality Check

The Reality Check provides an honest, milestone-based assessment:

| Horizon | Required State | Kill Rule |
|---------|---------------|-----------|
| 3 months | **Safe** — not just clever | Kill anything that looks like generic AI convenience |
| 6 months | **Trusted in one narrow lane** | Kill breadth. Own one thing completely |
| 12 months | **Stateful and persistent** | Kill statelessness. The account must live inside Helix |
| 18 months | **Governable by an institution** | Kill informality. Trust must survive compliance and production reality |
| 36 months | **Where the owned operational layer lives** | Kill wrapper behavior. Either Helix is the ownership layer or it is dead |

**Core insight from the Reality Check:** "Capability is abundant, governance is scarce." The defensible zone is governed execution + durable account-specific memory — not generation or convenience.

### 7. Branding Direction Is Ready

From the Tagline document, recommended pairings:

**Homepage / Brand:**
> **Owned operations.**
> Helix owns how your NetSuite evolves — from request to tested, deployed, monitored, and maintained execution.

**Pitch / Investor:**
> **The ownership layer for NetSuite.**
> NetSuite owns the platform. Helix owns the operational layer inside your account.

**Compressed thesis (from Positioning Refined) for one pitch slide:**
> NetSuite standardizes complexity, but does not own each customer's custom operational layer.
> Consultants implement that layer, but do not stay.
> AI models generate into that layer, but do not govern it.
> Meanwhile, the human teams around ERP are shrinking while the business complexity stays the same.
> **Helix exists to permanently own the operational layer in between.**

## Evidence Summary

Evidence was gathered from seven categories:

1. **PDF attachment analysis (7 documents)** — Manifesto (philosophy + 9 principles), Dovie Offer (36-month financial model), One Pager (market sizing + team), Positioning Refined (three-way gap thesis), Positioning Transcript (raw founder articulation), Reality Check & Risks (honest threat assessment + milestone roadmap), Tagline (5 finalist branding directions)
2. **Codebase inspection (6 repositories)** — all repositories examined via scout reference-map for feature inventory at the category level: autonomous AI workflow pipeline, multi-repository orchestration, ERP-specific deployment integration, production inspection, security infrastructure, staging and preview environments, analytics, and open-source tooling
3. **Production runtime data** — database queries yielded real usage metrics: 7 orgs, 22 users, 264 tickets, 611 runs, 124 deployed, 33 repos; ticket acceleration confirms growing adoption
4. **External market research (web search)** — validated NetSuite customer counts (43K+), AI-in-ERP market growth ($5.82B → $58.7B), ERP consulting market size ($50.1B), and competitive landscape
5. **Competitive intelligence (web search)** — identified NetSuite Next rollout timeline (mid-2026), SuiteAgents, AI Connector Service, and AI-native ERP replacement startups (Rillet, Campfire at $100M each)
6. **Exit comp verification (web search)** — confirmed Oracle/Next Technik acquisition (Oct 2023) but found acquisition price was NOT publicly disclosed, making the $60M comp unverifiable
7. **Runtime inspection manifest** — confirmed DATABASE and LOGS inspection available for helix-global-server production environment

## Success Criteria

The research report (product step output) should contain:

1. **Positioning narrative** — the three-way structural gap thesis in investor-ready language, drawing from the Positioning Refined document and Manifesto
2. **Product capabilities** — described at the highest category level (autonomous operational lifecycle, governed deployment, production inspection, account continuity) without specific software implementation details, per user guidance
3. **Market analysis** — validated TAM with both conservative and ambitious framings, supported by external citations
4. **Financial model review** — Dovie projections with stress-testing commentary and recommended investor-facing framings
5. **Competitive landscape** — current April 2026 intelligence on Oracle/NetSuite AI roadmap, AI-native ERP startups, and AI coding tools with differentiation arguments
6. **Risk register** — the Reality Check's milestone-based timeline with kill rules, plus proactive framing of investor concerns (zero revenue, success rates, cost scaling, competitive pace)
7. **Traction dashboard** — production metrics formatted for pitch credibility with concern mitigations
8. **Branding and positioning lines** — tagline finalists with context-specific recommendations, compressed thesis, and key Manifesto quotes
9. **Team and investment structure** — from One Pager and Dovie, with reconciliation of the two investment tiers
10. **Future trajectory** — multi-ERP expansion vision, from NetSuite ($2B+) to the broader ERP consulting market ($50B+), framed with the Reality Check's milestone-based urgency

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Understand deliverable requirements and source priority rankings | Deliverable is pitch deck data backbone; Manifesto = most sincere; Dovie = most recent numbers; focus on Helix for ERPs only |
| User continuation context | Updated guidance on scope, tone, and new documents | Don't call out specific software implementations; high-level capabilities only; include positioning/reality check/tagline docs |
| scout/reference-map.json (helix-cli) | Comprehensive file inventory and production runtime facts | 14 key files mapped, 30+ verified facts, 11 explicit unknowns; production metrics confirmed |
| scout/scout-summary.md (helix-cli) | Pre-synthesized analysis with financial extractions and production metrics | Complete evidence landscape synthesis including all 7 tiers and 8 unknowns |
| Helix_Manifesto.pdf | Philosophical foundation — Tier 1 source per ticket owner | 9 principles; 'Intelligence is not the product. Responsibility is.'; boundary test for competitive positioning |
| Helix_AI_Dovie_Offer.pdf | Financial projections — Tier 2 source, most recent | 36-month model: 0→999 customers, $50K flat costs, profitable month 6, 5.6x return, exit scenarios up to $150M |
| Helix_Positioning_Refined.pdf | Core positioning thesis — Tier 3 source, new in continuation | Three-way structural gap + compressed thesis statement ready for pitch use |
| Helix_Positioning_Transcript.pdf | Raw founder articulation — Tier 3 source, new in continuation | Original spoken thesis with nuances about ERP-as-database future and accountability gap |
| Reality_Check___Risks.pdf | Honest threat assessment — Tier 4 source, new in continuation | Thesis 'mostly right' but pace faster; milestone gates at 3/6/12/18/36mo; 'capability abundant, governance scarce' |
| Project_X_Innovation_One_Pager.pdf | Market sizing and team — Tier 5 source | $500K/15% ask, $2B+ TAM, 40K+ NS companies, 7-person team, 4 enterprise betas |
| Helix_Tagline.pdf | Branding direction — Tier 6 source, new in continuation | 5 finalists; recommended: 'Owned operations.' (homepage) + 'The ownership layer for NetSuite.' (pitch) |
| helix-global-server codebase | Primary evidence for current product capabilities | Autonomous AI workflow pipeline, ERP deployment integration, production inspection, enterprise security |
| helix-global-client codebase | User-facing feature evidence | Dashboard, workflow management, deployment center, analytics, administration |
| helix-cli codebase | CLI capabilities evidence | Production inspection, bidirectional agent-human communication |
| ns-gm codebase | Open-source ERP integration foundation | Created by team member Luis Simosa; MIT license; foundational NetSuite connectivity |
| helix-ns-server / helix-ns-client | Historical product evolution context | Legacy standalone repos; ERP functionality now embedded in main platform |
| Production database (runtime) | Real usage metrics for pitch credibility | 7 orgs, 22 users, 264 tickets, 611 runs, 124 deployed; accelerating month-over-month |
| Web search: NetSuite market data | Validate TAM claims | 43K-69K+ customers confirmed; $1B/quarter NetSuite revenue; AI-in-ERP $5.82B→$58.7B |
| Web search: Competitive intelligence | Current competitive landscape | NetSuite Next mid-2026, SuiteAgents, AI Connector; Rillet/Campfire $100M each |
| Web search: Next Technik acquisition | Verify exit comp | Confirmed Oct 2023 but price NOT publicly disclosed — $60M figure unverifiable |

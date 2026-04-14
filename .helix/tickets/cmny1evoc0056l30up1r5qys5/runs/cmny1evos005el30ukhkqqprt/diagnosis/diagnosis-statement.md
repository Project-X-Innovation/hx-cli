# Diagnosis Statement — RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Problem Summary

This is a RESEARCH ticket requesting a comprehensive information package to serve as the data backbone for an investor pitch deck and updated website for **Helix for ERPs** (primarily NetSuite). The deliverable is structured information covering: target market, TAM, revenue potential, product positioning, competitive landscape, threats, and future direction. Three PDF attachments (Helix Manifesto, Dovie Offer, One Pager), six codebases, and production runtime data provide the evidence base. No code changes are required — the output is a research report synthesizing product, market, financial, and strategic information.

## Root Cause Analysis

The "root cause" for this research ticket is the information gap between what exists across dispersed sources (codebases, PDFs, production data, market data) and what's needed for a compelling, evidence-backed investor pitch. The key synthesis challenges are:

1. **Product Capabilities** — spread across 6 repositories, need consolidation into investor-ready feature narratives
2. **Market Sizing** — the $2B+ TAM claim needs external validation and reality-checking
3. **Financial Projections** — two different investment structures (Dovie: $50K-$100K; One Pager: $500K) need reconciliation; assumptions need stress-testing
4. **Competitive Positioning** — no formal competitive analysis exists; the Manifesto provides philosophy but not market context
5. **Risk Assessment** — investors will probe specific risks (Oracle competition, cost scaling, zero revenue, success rates) that need preemptive framing

### Product Capabilities (Verified from Codebase + Production)

The Helix platform is technically mature with evidence of real production usage:

| Capability | Evidence Source | Status |
|-----------|---------------|--------|
| 9-step autonomous AI workflow pipeline | `helix-global-server/src/helix-workflow/helix-workflow-step-catalog.ts` | Production |
| 80+ API endpoints | `helix-global-server/src/routes/api.ts` | Production |
| Multi-repo orchestration + GitHub integration | `helix-global-server/src/services/github-merge-service.ts` | Production |
| NetSuite SDF/SuiteCloud headless deployment | `helix-global-server/src/helix-workflow/orchestrator/native-phase.ts` | Production |
| Production inspection (read-only DB/logs/API) | `helix-global-server/src/services/inspection-proxy-service.ts`, `helix-cli/src/inspect/` | Production |
| Per-ticket database branching (Neon) | `helix-global-server/src/services/neon/provisioning.ts` | Production |
| Ephemeral preview environments (Northflank) | `helix-global-server/src/services/preview-deployment.ts` | Production |
| Staging merge queue | `helix-global-server/src/services/staging-queue-service.ts` | Production |
| AES-256-GCM credential encryption | `helix-global-server/src/security/crypto.ts` | Production |
| Usage analytics | `helix-global-server/src/services/analytics-service.ts` | Production |
| Bidirectional agent-user comments | `helix-global-server/src/services/comment-service.ts`, `helix-cli/src/comments/` | Production |
| CLI for production inspection | `helix-cli/src/index.ts` | Production |
| Deployment center (DigitalOcean + Vercel) | `helix-global-server/src/controllers/deployment-controller.ts` | Production |
| Custom LLM inference endpoints | `helix-global-server/src/services/inference-endpoint-service.ts` | Production |
| ns-gm OSS NetSuite CLI (MIT) | `ns-gm/src/cli.js` | Published on npm |
| Ticket modes: AUTO, BUILD, FIX, RESEARCH, EXECUTE | `helix-global-server/prisma/schema.prisma` | Production |

### Market Validation (External Research)

| Claim | External Validation | Assessment |
|-------|-------------------|------------|
| 40,000+ NetSuite companies | Oracle says 43,000+; Enlyft tracks 69,373; TheirStack tracks 68,032 | **Validated** — actually higher than claimed |
| $5K-$20K/mo consultant spend per company | Implementation costs $25K-$200K+; ongoing consulting 1.5x-3x annual license | **Partially validated** — true for companies with active customization, but not universal |
| $2B+ addressable annually | Math: 40K × $5K/mo = $2.4B, but assumes all companies spend continuously | **Optimistic** — $500M-$1B more defensible for directly addressable segment |
| AI in ERP market growing rapidly | $5.82B in 2025 → $58.7B by 2035 (26% CAGR) per Precedence Research | **Validated** — strong tailwinds |
| Oracle/Next Technik $60M comp | Acquisition confirmed (Oct 2023), but price not publicly disclosed | **Unverifiable** — $60M figure is not in public sources |

### Financial Projection Assessment

**Dovie Offer (most recent, April 2026):**
- Growth model: 0 → 999 customers over 36 months, ~$1,500/mo average
- Profitable month 6 (42 customers), payback month 22
- 36-month ARR: ~$18M with ~1,000 customers
- Exit comps: $50M (early) to $150M (strategic)

**Stress Points:**
1. **Flat $50K/month costs through 999 customers** — unrealistic. AI inference alone scales with usage. At 999 customers generating tickets, compute costs would be multiples of $50K. Need cost-scaling model.
2. **Zero churn modeled** — even 2% monthly churn at 500 customers = 10 lost/month, requiring 10+ new/month just to stay flat.
3. **Zero revenue today** — the projections start at 0 customers in April 2026 (the current month). The 4 enterprise betas mentioned in the One Pager are not yet paying.
4. **$1,500/mo average is conservative** relative to the $5K-$20K/mo value proposition — this could be framed as upside.

**One Pager (March 2026):**
- $500K ask at $2.83M pre-money (15% equity) — different investment vehicle than Dovie
- 12-month ARR: $1.7M; 18-month ARR: $3.1M
- Breakeven month 8 (vs. month 6 in Dovie — slight discrepancy, likely due to different cost assumptions)

### Competitive Landscape

| Competitor Type | Examples | Threat Level | Helix Differentiation |
|----------------|----------|-------------|----------------------|
| **ERP's own AI** | NetSuite Next (agentic AI, Autonomous Close) | **High** | Oracle sells platform, not accountability. NetSuite enables customization; Helix owns it end-to-end. |
| **AI-native ERP replacements** | Rillet ($100M raised), Campfire ($100M raised), ChatFin | **Medium** | These replace ERPs; Helix works on top of existing ERPs. Different buyer, different sale. |
| **AI coding tools** | Claude Code, GitHub Copilot, Cursor | **Low-Medium** | General-purpose code generation. Don't handle ERP-specific lifecycle (test in sandbox, deploy, monitor, maintain). |
| **Traditional NS consultants** | Protelo, SuiteDynamics, RSM | **Low** | Helix disrupts rather than competes. Consultants may become Helix channel partners. |

### Production Traction Metrics

| Metric | Value | Investor Significance |
|--------|-------|----------------------|
| Organizations | 7 (5 NS, 2 General) | Early adoption across both platforms |
| Users | 22 | Multiple users per org = team adoption |
| Total tickets (Apr 2026) | 140 | 16% month-over-month growth (vs 121 in March) |
| Tickets deployed | 123 (47% of total) | Real production impact, not just experimentation |
| Configured repos | 33 | Deep integration into customer codebases |
| Active orgs (30 days) | 5 of 7 | 71% monthly active rate |
| Run success rate | 55% | Concern — needs improvement narrative |
| NS deployment success | 31% (8/26) | Concern — NetSuite deployments still maturing |

## Evidence Summary

Evidence was gathered from five categories:

1. **Codebase inspection** — all 6 repositories examined for feature inventory, architecture, and technical maturity
2. **Production runtime data** — database queries yielded real usage metrics (orgs, users, tickets, runs, deployments)
3. **Attachment analysis** — Helix Manifesto (philosophical positioning), Dovie Offer (financial projections), One Pager (market sizing and team)
4. **External market research** — web searches validated NetSuite customer counts, consulting market size, AI-in-ERP market growth, competitive landscape, and the Next Technik acquisition
5. **Inspection audit** — production system is operational with active audit logging

## Success Criteria

The research report (product step output) should contain:

1. **Product narrative** — investor-ready description of Helix capabilities with evidence from codebase and production data
2. **Market analysis** — validated TAM with external citations, segmented by near-term (NetSuite) and long-term (multi-ERP)
3. **Financial model review** — Dovie projections with stress-testing commentary and recommended adjustments
4. **Competitive landscape** — positioning map with differentiation arguments grounded in the Manifesto and product evidence
5. **Risk register** — proactive identification of investor concerns with evidence-based mitigations
6. **Traction dashboard** — production metrics formatted for pitch credibility
7. **Future roadmap narrative** — extrapolation from current codebase to multi-ERP vision
8. **Key quotes and positioning lines** — drawn from the Manifesto for pitch narrative use

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Understand deliverable requirements, information priorities, and source reliability rankings | Deliverable is pitch deck data backbone; Manifesto = most sincere; Dovie = most recent numbers; codebase = current product; focus on Helix for ERPs only |
| scout/reference-map.json (helix-cli) | Comprehensive file inventory and production runtime facts | 34 key files mapped, 30 verified facts, 10 explicit unknowns; production metrics: 7 orgs, 261 tickets, 606 runs |
| scout/scout-summary.md (helix-cli) | Pre-synthesized analysis of all sources with financial extractions | Complete extraction of Dovie/One Pager numbers, workflow pipeline details, production metrics, and key unknowns list |
| Helix_Manifesto.pdf | Extract philosophical foundation and investor positioning | 9 principles; core thesis: "Intelligence is not the product. Responsibility is." Defines competitive moat as accountability gap |
| Helix_AI_Dovie_Offer.pdf | Extract detailed 36-month financial projections | 0→999 customers, $50K flat costs, profitable month 6, 5.6x return at 36 months, $2.83M pre-money, exit scenarios up to $150M |
| Project_X_Innovation_One_Pager.pdf | Extract market sizing, team composition, investment terms | $500K/15% ask, $2B+ TAM, 40K+ NS companies, 7-person team, 4 enterprise betas, Oracle/Next Technik acquisition comp |
| helix-global-server codebase | Verify product capabilities and technical architecture | 9-step pipeline, 80+ APIs, multi-repo orchestration, NS integration, deployment automation, inspection API, encryption |
| helix-global-client codebase | Verify user-facing features | Dashboard, kanban board, staging queue, deployment center, NS setup wizard, analytics, admin panel |
| helix-cli codebase | Verify CLI capabilities | Production inspection (DB/logs/API), bidirectional comments, OAuth login (~900 LOC) |
| ns-gm codebase | Verify OSS NetSuite tooling | SuiteScript execution CLI, OAuth 2.0 M2M auth, RESTlet architecture, MIT license, npm published |
| helix-ns-server codebase | Historical reference for product evolution | 6-step workflow, standalone NS backend → now merged into Helix Global |
| helix-ns-client codebase | Historical reference for product evolution | SDF/NS-GM credential UI → now merged into Helix Global |
| Production database (runtime) | Real usage metrics for pitch credibility | 7 orgs, 22 users, 261 tickets, 606 runs, 123 deployed, 33 repos |
| Web search: NetSuite market data | Validate TAM claims with external sources | 43K-69K+ NS customers confirmed; AI-in-ERP market $5.82B growing to $58.7B by 2035 |
| Web search: Competitive landscape | Identify competitors and differentiation | Rillet/Campfire ($100M each), ChatFin, NetSuite Next (agentic AI) — none do autonomous ERP operation |
| Web search: Oracle/Next Technik | Verify acquisition comp cited in pitch materials | Acquisition confirmed Oct 2023, but $60M price is not publicly confirmed |

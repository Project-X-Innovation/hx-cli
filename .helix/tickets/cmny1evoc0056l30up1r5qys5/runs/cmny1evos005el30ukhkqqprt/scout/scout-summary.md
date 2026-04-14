# Scout Summary - RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Problem

The ticket requests comprehensive research and information gathering to serve as the data backbone for an investor pitch deck and updated website for Helix for ERPs (primarily NetSuite). The deliverable is a structured information package covering: target market, TAM, revenue potential, product positioning, threats, and future direction. Three attachments provide financial projections (Dovie Offer), portfolio overview (One Pager), and philosophical foundation (Manifesto). Six repositories provide evidence of current product capabilities and architecture.

## Analysis Summary

### Product Architecture (6 repositories)

**Active production repositories (Helix Global):**

1. **helix-global-server** - The core orchestration engine. Express/TypeScript backend with Prisma/PostgreSQL, 80+ API endpoints, 9-step AI workflow pipeline powered by Anthropic Claude Agent SDK running in Vercel Sandbox environments. Supports both GENERAL and NETSUITE organization platform types. Features: ticket lifecycle management, multi-repo orchestration, GitHub merge/PR management, staging merge queue, deployment center (DigitalOcean + Vercel), NetSuite SDF/NS-GM credential management, production inspection API with audit logging, Neon database branching, Northflank preview environments, custom inference endpoints, threaded comments with reactions, and usage analytics.

2. **helix-global-client** - React 19 + TypeScript + Vite web application. Features: dashboard with ticket creation/management, kanban board view, inbox/activity feed, staging queue management, deployment center (general + NS-specific), notes-to-tickets conversion, settings with repository/credential/integration management, NetSuite setup wizard, usage analytics, admin panel, multi-section documentation, and CLI authentication flow.

3. **helix-cli** (`hlx`) - Lightweight TypeScript CLI (~900 LOC, zero runtime dependencies). Commands: `login` (OAuth), `inspect` (read-only database/logs/API queries against production), `comments` (bidirectional agent-user communication during runs). Enables sandbox agents to safely inspect production state and communicate with users.

4. **ns-gm** - Open-source (MIT) NetSuite CLI tool by Luis Simosa. Enables SuiteScript code execution against NetSuite via local proxy + RESTlet architecture. OAuth 2.0 M2M authentication (PS256 JWT). Commands: `setup`, `init`, `run`, `logs`, `env`, `stop`. Published on npm. Foundational tool for Helix's NetSuite integration layer.

**Legacy/deprecated repositories (historical reference):**

5. **helix-ns-server** - Original standalone NetSuite backend. Same core patterns (Express, Prisma, Vercel Sandbox, Claude Agent SDK) but scoped to NS-only. 6-step workflow (scout through implementation). Shows the evolutionary origin of the NS integration now in Helix Global.

6. **helix-ns-client** - Original standalone NetSuite frontend. React/Vite with SDF/NS-GM credential management, ticket lifecycle, and production deploy staging. Confirms the product's NetSuite-first heritage.

### Workflow Pipeline (Core Product)

The 9-step autonomous pipeline defined in `helix-workflow-step-catalog.ts`:
1. **Scout** - Codebase reconnaissance and mapping
2. **Diagnosis** - Problem analysis with APL artifact
3. **Product** - Product definition and planning
4. **Tech-Research** - Technology research with APL
5. **Implementation-Plan** - Detailed implementation strategy with APL
6. **Implementation** - Code generation and development with APL
7. **Code-Review** - Automated code review with APL
8. **Verification** - Testing and verification
9. **Preview-Config** - Preview deployment configuration

Ticket modes: AUTO (intelligent mode selection), BUILD (new features), FIX (bug fixes), RESEARCH (investigation), EXECUTE (NetSuite-only operations).

### Production Metrics (Runtime Evidence)

| Metric | Value |
|--------|-------|
| Organizations | 7 (5 NetSuite, 2 General) |
| Active orgs (30 days) | 5 |
| Users | 22 |
| Total tickets | 261 |
| Tickets (Apr 2026) | 140 |
| Tickets (Mar 2026) | 121 |
| Total sandbox runs | 606 |
| Run success rate | ~55% (333 succeeded / 606 total) |
| Deployed tickets | 123 (47% of all tickets) |
| Configured repositories | 33 |
| General deployments | 61 (52 deployed, 9 failed) |
| NetSuite deployments | 26 (8 succeeded, 18 failed) |

### Financial Projections (from Attachments)

**Dovie Offer (April 2026):**
- Pre-money valuation: $2.83M
- Equity tiers: 2% ($50K) or 4% ($100K)
- Monthly costs: $50K fixed
- Customer growth: 0 → 999 over 36 months (~10/mo initially, accelerating to ~10% monthly growth)
- Pricing: ~$1,500/mo average per customer
- Profitable: Month 6 (Sep 2026) at 42 customers
- Month 36 ARR: ~$18M with ~1,000 customers
- Exit comps: Oracle/Next Technik ($60M for NetSuite FSM tool)

**One Pager (March 2026):**
- Ask: $500K for 15% equity
- 12-month ARR projection: $1.7M
- 18-month ARR projection: $3.1M
- Breakeven: Month 8
- TAM: $2B+ (40,000+ NetSuite companies x $5K-$20K/mo consultant spend)
- Status: 4 enterprise beta users

### Manifesto Principles

The Manifesto establishes 9 principles centered on the thesis: **"Intelligence is not the product. Responsibility is."** Key positioning:
- Helix occupies the space between AI tools (which suggest but don't own) and ERPs (which customize but don't take responsibility)
- "If Claude Code can do it, it's not enough. If NetSuite can own it, we don't build it."
- Completion: created → tested → deployed → verified
- Safety: reversible, observable, auditable
- Continuity: Helix maintains systems, not just tasks
- "Software is fast but detached. Consultants are accountable but slow. Helix is accountable at speed."

### Key Unknowns

- Current paying customer count vs beta users (7 orgs exist but unclear revenue status)
- Cost scalability beyond $50K/month (AI inference costs grow with customers)
- No churn modeling in Dovie projections
- Competitive landscape not formally documented
- SAP/Odoo expansion path has no technical implementation yet
- Distribution partner not identified in available documents
- Two different investment structures exist (Dovie: $50K-$100K small; One Pager: $500K/15%)

## Relevant Files

| Repository | Key File | Purpose |
|-----------|----------|---------|
| helix-global-server | `src/helix-workflow/helix-workflow-step-catalog.ts` | 9-step workflow pipeline definition |
| helix-global-server | `src/helix-workflow/orchestrator.ts` | Core run executor |
| helix-global-server | `src/helix-workflow/orchestrator/native-phase.ts` | NetSuite SuiteCloud integration |
| helix-global-server | `prisma/schema.prisma` | Full data model (orgs, tickets, runs, deployments, credentials) |
| helix-global-server | `src/routes/api.ts` | 80+ API endpoints |
| helix-global-server | `src/services/inspection-proxy-service.ts` | Production inspection with safety guards |
| helix-global-server | `src/services/deployment-prep-service.ts` | AI-powered deployment preparation |
| helix-global-server | `src/services/neon/provisioning.ts` | Per-ticket database branching |
| helix-global-server | `src/services/preview-deployment.ts` | Ephemeral preview environments |
| helix-global-server | `src/security/crypto.ts` | AES-256-GCM credential encryption |
| helix-global-client | `src/App.tsx` | Client router / all pages |
| helix-global-client | `src/routes/deployment-center.tsx` | Deployment center UI |
| helix-global-client | `src/components/ns-readiness-banner.tsx` | NS credential readiness |
| helix-global-client | `src/routes/settings/netsuite-tab.tsx` | NS credential management UI |
| helix-cli | `src/index.ts` | CLI entry point (inspect, comments) |
| ns-gm | `src/cli.js` | OSS NetSuite CLI |
| ns-gm | `ns_gm_restlet.js` | SuiteScript 2.1 RESTlet |
| helix-ns-server | `src/helix-workflow/orchestrator.ts` | Legacy NS orchestrator (historical) |
| helix-ns-client | `src/routes/dashboard.tsx` | Legacy NS dashboard (historical) |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand deliverable requirements and information prioritization | Deliverable is pitch deck data backbone; focus on Helix for ERPs; Manifesto drives vision; Dovie numbers are most recent/relevant |
| Helix_Manifesto.pdf | Extract philosophical foundation and positioning principles | 9 principles; core thesis: responsibility > intelligence; Helix fills gap between AI tools and ERPs |
| Helix_AI_Dovie_Offer.pdf | Extract financial projections and investor terms | $2.83M pre-money; 0→999 customers/36mo; $18M ARR at month 36; profitable month 6; Oracle/Next Technik $60M comp |
| Project_X_Innovation_One_Pager.pdf | Extract market sizing, team, and broader investment context | $500K/15% ask; $2B+ TAM; 40K+ NetSuite cos; 7-person team; 4 enterprise betas; expandable to SAP/Odoo |
| helix-global-server codebase | Map current product capabilities, architecture, and feature breadth | 9-step AI pipeline; 80+ API endpoints; multi-repo orchestration; NS integration; deployment automation; inspection API |
| helix-global-client codebase | Map user-facing features and UI capabilities | Dashboard, board, staging queue, deployment center, NS setup, analytics, docs, admin |
| helix-cli codebase | Map CLI capabilities for agents and external users | Production inspection (DB/logs/API); bidirectional comments; OAuth login |
| ns-gm codebase | Map OSS NetSuite tooling and NS integration foundation | SuiteScript execution CLI; OAuth 2.0 M2M auth; RESTlet architecture; MIT license |
| helix-ns-server codebase | Historical reference for NS-focused architecture evolution | 6-step workflow; SDF/NS-GM credentials; standalone NS backend → now merged into Global |
| helix-ns-client codebase | Historical reference for NS-focused UI evolution | SDF/NS-GM credential UI; production deploy staging → now merged into Global |
| Production database (runtime) | Gather real usage metrics for pitch credibility | 7 orgs, 22 users, 261 tickets, 606 runs, 61 deployments, 26 NS deployments |
| Production logs (runtime) | Check system health and recent errors | System operational; inspection audit logging active; no critical errors in recent logs |

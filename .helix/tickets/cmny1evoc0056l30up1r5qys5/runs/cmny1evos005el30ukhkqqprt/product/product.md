# Product Definition — RSH-221: Helix Pitch | Information For Slide Deck and Updated Site

## Problem Statement

The founder needs to pitch Helix for ERPs to investors. The necessary information — product capabilities, market sizing, financial projections, competitive positioning, risk analysis, and strategic narrative — is scattered across six codebases, three PDF attachments, and a live production environment. No single document synthesizes this into a coherent, evidence-backed pitch-deck backbone. Without this synthesis, the pitch lacks the structured data and validated claims investors require.

## Product Vision

Helix is the AI interface layer between users and ERPs. The thesis: ERPs will become data stores with embedded financial and legal rules (like databases today), and the user-facing interface will be an AI platform that owns customization, deployment, and ongoing maintenance end-to-end. Helix occupies the gap where neither AI coding tools (which suggest but don't own outcomes) nor ERP vendors (which enable customization but don't take responsibility for it) can compete.

**Core positioning line (from Manifesto):** *"Intelligence is not the product. Responsibility is."*

**Elevator pitch:** Helix is an autonomous ERP operator. Humans express intent; Helix creates, tests, deploys, monitors, and maintains the customization — end-to-end, with accountability. Software is fast but detached. Consultants are accountable but slow. Helix is accountable at speed.

## Users

| User Segment | Description | Pain |
|---|---|---|
| **NetSuite customers (primary)** | 40,000+ companies globally spending $5K-$20K/mo on consultants for customizations, reporting, debugging, deployments | Slow, expensive, never-ending consultant dependency; weeks for simple changes |
| **Internal NetSuite admins** | Business analysts and admins within NS companies who need customizations but lack technical skill | Bottlenecked by IT or external consultants for every workflow change |
| **NetSuite consulting firms (channel)** | Existing NS consultants who could use Helix to scale their delivery | Constrained by headcount; can't serve more clients without more people |
| **ERP companies on SAP/Odoo (future)** | Similar pain to NetSuite segment but on different ERP platforms | Same consultant dependency; even larger market |

## Use Cases

1. **Build customization from intent** — User describes a business need in natural language; Helix autonomously scouts the codebase, diagnoses the problem, plans the implementation, writes the code, tests it, deploys it to staging, and prepares it for production deployment.
2. **Fix production bugs** — User reports an issue; Helix inspects production state (database, logs, APIs), diagnoses root cause, implements the fix, and deploys it — all within minutes instead of consultant weeks.
3. **Generate department reports** — User requests a report; Helix builds a custom SuiteScript report that would take consultants hours or days, ready in minutes.
4. **Research and investigate** — User asks a question about their ERP configuration; Helix investigates the codebase and production environment and delivers a structured answer.
5. **Execute NetSuite operations** — User requests a direct operation against their NetSuite instance (record operations, searches); Helix executes safely with audit trails.
6. **Ongoing system maintenance** — Helix monitors deployed customizations over time, maintaining systems rather than just completing tasks (Manifesto Principle 6: Continuity).

## Core Workflow

The 9-step autonomous pipeline (verified in codebase at `helix-global-server/src/helix-workflow/helix-workflow-step-catalog.ts`):

1. **Scout** — Codebase reconnaissance and mapping
2. **Diagnosis** — Root cause analysis
3. **Product** — Product definition and planning
4. **Tech Research** — Technology investigation
5. **Implementation Plan** — Detailed strategy
6. **Implementation** — Code generation
7. **Code Review** — Automated quality review
8. **Verification** — Testing and validation
9. **Preview Config** — Preview deployment setup

Ticket modes: AUTO (intelligent selection), BUILD (new features), FIX (bug fixes), RESEARCH (investigation), EXECUTE (NetSuite direct operations).

Human approval gate before production deployment. Everything before that is autonomous.

## Essential Features (MVP — Current State)

All features below are **verified in production** from codebase and runtime data:

- **Autonomous 9-step AI workflow pipeline** — End-to-end from intent to deployable code
- **Multi-repo orchestration** — Works across multiple customer repositories simultaneously
- **NetSuite SDF headless deployment** — SuiteCloud CLI integration for automated NS deployments
- **Production inspection** — Read-only database, logs, and API queries against live production with write-blocking safety guards
- **Per-ticket database branching** — Neon-powered isolated DB branches for safe testing
- **Ephemeral preview environments** — Northflank-based preview deployments per branch
- **Staging merge queue** — Ordered merging with conflict detection
- **Deployment center** — Supports DigitalOcean, Vercel, and NetSuite SDF targets
- **AES-256-GCM credential encryption** — Enterprise-grade security for stored credentials
- **Bidirectional agent-user communication** — Threaded comments during autonomous runs
- **Usage analytics** — Per-user and org-wide metrics
- **CLI tooling** — `hlx` CLI for production inspection and agent communication
- **ns-gm open-source NetSuite CLI** — MIT-licensed, npm-published SuiteScript execution tool

## Features Explicitly Out of Scope (MVP)

- **SAP / Odoo / other ERP integrations** — Future expansion; no technical implementation yet
- **Self-service customer onboarding** — Currently manual/beta onboarding
- **Churn prevention / automated retention features** — Not yet built
- **Cost-scaling infrastructure** — Flat $50K/mo cost model; no dynamic scaling for high customer counts
- **White-label / partner portal** — No channel-partner facing UI
- **Finesse Contracts and Haven AI** — Separate products under Project X Innovation; excluded from this pitch per founder direction

## Success Criteria

For this research deliverable (not for the product itself):

| Criterion | Measure |
|---|---|
| Market sizing is externally validated | TAM claim includes at least two independent data sources |
| Financial projections are stress-tested | Dovie model assumptions are surfaced with risk commentary |
| Competitive landscape is mapped | At least 4 competitor categories with differentiation arguments |
| Product capabilities are evidence-backed | Every claimed feature links to codebase or production data |
| Traction metrics are real | All usage numbers come from production database queries |
| Risk register is investor-ready | Key objections (zero revenue, success rates, cost scaling) have preemptive framing |
| Narrative is coherent | Single story from problem → product → market → financials → exit |

## Key Design Principles

Drawn directly from the Helix Manifesto (3 pages, 9 principles):

1. **Responsibility** — "If Helix touches it, Helix is responsible for it. Not partially. Not temporarily. Fully. And forever."
2. **Completion** — Created → tested → deployed → verified. What Helix does is done.
3. **Safety** — Every action is reversible, observable, auditable. Trust is engineered, not assumed.
4. **Decision Ownership** — All decisions flow through Helix; once executed, Helix owns them.
5. **Opinionated by Design** — "People do not pay Helix for flexibility. They pay Helix for the right defaults, the right actions, and the right decisions."
6. **Continuity** — Helix maintains systems, not just tasks.
7. **Calibrated Understanding** — Demonstrate understanding through correct action, not by asking for confirmation.
8. **Trust Through Behavior** — "Generating code is commoditized. Reliability is not."
9. **Extreme Customer Support** — "Software is fast but detached. Consultants are accountable but slow. Helix is accountable at speed."

## Scope & Constraints

**This ticket's scope:** Produce a structured research report that serves as the data backbone for an investor pitch deck and updated website for Helix for ERPs.

**Constraints:**
- Focus on **Helix for ERPs only** — not Helix Global for general development, not Finesse, not Haven.
- The Manifesto drives the narrative vision; the Dovie numbers are the most recent/relevant financials.
- The codebase describes current product but the report must reasonably extrapolate the future (multi-ERP, deeper automation).
- No code changes are needed — this is purely a research deliverable.
- Two different investment structures exist (Dovie: $50K-$100K small investor; One Pager: $500K/15% equity raise) and should not be conflated.

## Future Considerations

- **Multi-ERP expansion** — SAP, Odoo, and other ERPs represent the long-term vision of being "the AI interface for all ERPs." No technical implementation exists yet but the architecture (separate ERP integration layer in `native-phase.ts`) supports the pattern.
- **Distribution partner channel** — Dovie numbers were built with a distribution partner. This channel model (consultants reselling Helix) could be the primary go-to-market.
- **AI inference cost scaling** — As customer count grows, AI compute costs will grow proportionally. The flat $50K/mo cost assumption doesn't hold beyond ~100 customers.
- **Success rate improvement** — Current 55% run success rate and 31% NetSuite deployment success rate need improvement before scaling. These are product maturity metrics, not fundamental blockers.
- **Self-service onboarding** — Currently beta with manual onboarding (7 orgs, 22 users). Scaling to 100+ customers requires self-service.
- **Pricing model validation** — $1,500/mo average is conservative relative to consultant spend ($5K-$20K/mo). Potential for value-based pricing tiers.

## Open Questions / Risks

| Category | Question / Risk | Current Evidence |
|---|---|---|
| **Revenue** | Zero paying customers as of April 2026. When does revenue start? | 7 orgs exist but all appear to be beta; 4 enterprise betas cited in One Pager |
| **Cost scaling** | Flat $50K/mo costs through 999 customers is unrealistic. What is the real cost curve? | AI inference, compute, and support costs scale with customers. No variable cost model exists. |
| **Churn** | Dovie model assumes zero churn over 36 months. What is realistic churn? | Even 2% monthly churn at 500 customers = 10 lost/month, requiring 10+ new/month to stay flat |
| **Competition — Oracle** | NetSuite Next includes agentic AI and Autonomous Close. Can Oracle build this internally? | Per Manifesto thesis: Oracle's business is the platform, not end-to-end accountability for customization workflows. Plausible but unverified. |
| **Competition — AI-native ERPs** | Rillet ($100M raised) and Campfire ($100M raised) aim to replace ERPs entirely. | Different buyer (new vs. existing ERP customers). Helix works on top of existing ERPs — different value proposition. |
| **TAM validation** | $2B+ claim assumes all 40K+ NS companies spend continuously on consultants. | More defensible: $500M-$1B directly addressable segment (companies with active customization needs). Oracle cites 43K+ NS customers; third parties cite 68K+. |
| **Exit comp** | Oracle/Next Technik $60M acquisition cited as comp. Price not publicly confirmed. | Acquisition in Oct 2023 confirmed; $60M figure is not in public sources. |
| **NS deployment success** | 31% success rate on NetSuite deployments (8/26). Investors will probe this. | Product is maturing; general deployment success is higher (85% = 52/61). NS path is newer. |
| **Investment structure** | Two different asks exist: Dovie ($50K-$100K small) vs. One Pager ($500K/15%). Which is current? | Dovie is most recent (April 2026); One Pager is March 2026. May represent different investor tiers. |
| **Distribution partner** | Referenced in ticket as co-creator of Dovie numbers but not identified in any document. | Unknown — need to clarify for pitch credibility. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|---|---|---|
| `helix-cli/.../ticket.md` | Understand deliverable requirements, source reliability ranking, and founder's strategic framing | Deliverable is pitch-deck data backbone; Manifesto = most sincere; Dovie = most recent numbers; focus on Helix for ERPs only |
| `helix-cli/.../scout/scout-summary.md` | Pre-synthesized analysis of all 6 repos, 3 PDFs, and production metrics | 9-step pipeline, 80+ APIs, 7 orgs, 261 tickets, 606 runs; financial extractions from both investment docs |
| `helix-cli/.../scout/reference-map.json` | Key file inventory across repos and verified production facts | 34 key files mapped; production data model and runtime metrics |
| `helix-cli/.../diagnosis/diagnosis-statement.md` | Root cause analysis, market validation, financial stress-testing, competitive landscape | $2B+ TAM partially validated; flat costs unrealistic; zero churn unrealistic; 4 competitor categories mapped; Oracle/Next Technik comp unverifiable |
| `Helix_Manifesto.pdf` (attachment) | Extract philosophical foundation and positioning principles | 9 principles; core thesis: "Intelligence is not the product. Responsibility is." Defines competitive moat as the accountability gap |
| `Helix_AI_Dovie_Offer.pdf` (attachment) | Extract 36-month financial projections and investor terms | 0 → 999 customers, $1,500/mo avg, $50K flat costs, profitable month 6, $2.83M pre-money, exit scenarios $50M-$150M |
| `Project_X_Innovation_One_Pager.pdf` (attachment) | Extract market sizing, team, and investment thesis | $500K/15% ask, $2B+ TAM, 40K+ NS companies, 7-person team, 4 enterprise betas, expandable to SAP/Odoo |
| `helix-cli/.../repo-guidance.json` | Confirm repo roles for this run | helix-cli = target (research output); all others = context (evidence sources) |
| `/tmp/helix-inspect/manifest.json` | Check runtime inspection availability | helix-global-server has DATABASE and LOGS inspection types available |

# Ticket Context

- ticket_id: cmp63obfk00eikw0ufc2lvi7g
- short_id: BLD-464
- run_id: cmp63obfz00enkw0utmmnu6tp
- run_branch: helix/build/BLD-464-implement-ability-for-everybody-to-see-their-own
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Implement: Ability for everybody to see their own token usage in detail

## Description
I want to add two caveats. It may be important for the admin account, for our internal account, to track costs. The number cost is actually not the customer's usage-based cost. It is our cost, it is Helix's cost, and that should not be sent to the customer, nor does it need to be stored in any of the new tables. That's first of all.



Second of all, the LLM that is used does not need to be and should not be shown to the customer. That is okay to store for our usage, but it should not be sent to the client, never mind displayed to the client in any way



This is for customers of Helix to see their usage, and will eventually be extended for them to see their pricing, which we have not put in anywhere yet. It's not the pricing we get from Anthropik, of course. There will be a markup on top, and anything to do with the pricing from Anthropik is not relevant for them. The cost that we have now is not relevant for them. The LLMs are a secret sauce. They do not need to know and should not know which one. They just need to see, for now, tokens, and eventually we will implement our own cost structure on top.

## Research Report

# Org-Scoped Token Usage: Research Report

**Ticket**: RSH-455 -- Ability for everybody to see their own token usage in detail
**Date**: May 14, 2026
**Status**: Research Complete -- Ready for Build

---

## Executive Summary

Organizations on the Helix Portal currently have no way to view their own token consumption. Token visibility is split between an admin-only cross-org dashboard and developer-only per-run/per-ticket displays, leaving regular org users -- the actual customers who will pay usage-based pricing -- completely locked out of their own usage data.

The data infrastructure is production-ready: 1,092 runs across 11 organizations, with 96.8% token coverage for May 2026. All runs are linked to tickets (zero orphan runs), enabling clean per-ticket audit drill-down. The primary gap is pure exposure -- no endpoint or UI exists to serve this data to org users.

This report recommends adding a new `GET /analytics/token-usage` API endpoint (org-scoped, `requireAuth`) and a new `/usage/tokens` client page with summary cards and a sortable per-ticket table. The implementation adapts proven patterns from the existing admin token usage dashboard, requiring no schema migrations, no new dependencies, and no changes to existing functionality.

**Key data caveat**: `estimatedCostUsd` is populated for only ~13% of token-bearing runs. Token counts are the reliable metric; cost should be labeled as "estimated" with coverage disclosures.

---

## Current State

### Server Endpoints

The server currently exposes two usage-related endpoints:

| Endpoint | Auth | Scope | What It Returns |
|----------|------|-------|-----------------|
| `GET /analytics/usage` | `requireAuth` | Org-scoped | Operational metrics: tickets, runs, deployments, success rate, runtime. **Zero token or cost fields.** |
| `GET /admin/token-usage` | `requireAdmin` | Cross-org | Token aggregation: per-org input/output tokens, estimated cost, total runs, runs with token data. |

- **`analytics-service.ts`** (org-scoped): Returns `UsageSummary` with `totalTickets`, `totalRuns`, `successRate`, `totalRuntimeMs`, `deploymentCount`. No token fields exist in the type or queries.
- **`admin-token-usage-service.ts`** (admin-only): Uses raw SQL `SUM/GROUP BY` on `SandboxRun` joined to `Organization` (lines 44-68). Returns per-org token breakdown with summary computation (lines 82-101).
- **Route registration**: `api.ts` line 367 (`/analytics/usage` behind `requireAuth`), line 413 (`/admin/token-usage` behind `requireAdmin`).

### Client Visibility

| View | Auth Gate | Token Data |
|------|-----------|------------|
| `/usage` page | All authenticated users | **None** -- operational metrics only (tickets, runs, deployments, runtime) |
| `/admin/token-usage` page | `useIsAdmin()` + redirect | Cross-org token aggregation with per-org breakdown |
| Run history panel (`run-history.tsx` L379-406) | `isDeveloper` flag | Per-run: model, input/output tokens, cost |
| Ticket detail totals (`ticket-detail.tsx` L1852-1853, L2756-2760) | Developer-only display | Per-ticket computed totals from run data |

**Bottom line**: Regular org users see operational metrics only. Token data is visible only to platform admins (cross-org dashboard) and developers (per-run/per-ticket detail).

---

## Gap Analysis

### What's Missing

1. **No org-scoped token endpoint**: There is no API endpoint that returns token consumption data scoped to a single organization. The analytics endpoint returns operational metrics; the admin endpoint requires admin privileges and returns cross-org data.

2. **No org-scoped token UI**: The `/usage` page displays zero token fields. Token data on ticket detail and run history pages is gated behind `isDeveloper`, making it invisible to regular org users.

3. **No per-ticket audit view**: While the admin dashboard shows per-org breakdown, there is no view that breaks down an organization's token usage by ticket for audit purposes.

### Why It Matters

- **Cost management**: Organizations cannot monitor or forecast their token spend. With usage-based pricing on the roadmap, customers must be able to see what they're consuming before they can be billed for it.
- **Audit transparency**: Organizations cannot trace consumption back to specific work items (tickets). Budget owners have no way to identify high-cost work or validate charges.
- **Self-service**: The current admin dashboard serves Project X's internal cost management needs. This ticket addresses the customer-facing need -- each organization managing their own costs.

---

## Data Architecture

### Schema

The `SandboxRun` model in `prisma/schema.prisma` (lines 394-423) stores all token consumption data:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `modelUsed` | `String?` | Yes | LLM model identifier (e.g., `claude-opus-4-6`) |
| `inputTokens` | `Int?` | Yes | Input token count for the run |
| `outputTokens` | `Int?` | Yes | Output token count for the run |
| `estimatedCostUsd` | `Decimal(10,4)?` | Yes | Externally-populated estimated cost |
| `organizationId` | `String` | No | FK to `Organization` -- enables org scoping |
| `ticketId` | `String?` | Yes | FK to `Ticket` -- enables per-ticket drill-down |
| `startedAt` | `DateTime?` | Yes | Run start time -- used for date range filtering |

**Key relationships**:
- `SandboxRun.organizationId` -> `Organization.id` (every run belongs to an org)
- `SandboxRun.ticketId` -> `Ticket.id` (every run is linked to a ticket; zero orphan runs in production)
- `Ticket.ticketNumber` and `Ticket.title` provide human-readable labels for per-ticket display

### Token Capture Pipeline

Token data enters the database through the run execution pipeline in `run-store.ts`:

1. **Type definition**: `RunUsageData` type (lines 6-11) defines the shape: `{ modelUsed, inputTokens, outputTokens, estimatedCostUsd }`.
2. **Live updates**: `updateRunUsageBestEffort()` (lines 496-511) performs fire-and-forget DB updates with live token counts during run execution.
3. **Final persistence**: `persistStepProgress()` (lines 480-484) writes the final accumulated token values when a run step completes.
4. **External cost**: `estimatedCostUsd` is populated by workflow scripts, not calculated server-side from token counts.

### Existing SQL Patterns

Two proven SQL aggregation patterns exist:

**Admin cross-org aggregation** (`admin-token-usage-service.ts` L44-68):
```sql
SELECT sr."organizationId", o."name",
  COALESCE(SUM(sr."inputTokens"), 0) AS "totalInputTokens",
  COALESCE(SUM(sr."outputTokens"), 0) AS "totalOutputTokens",
  SUM(sr."estimatedCostUsd") AS "estimatedCostUsd",
  COUNT(*) AS "totalRuns",
  COUNT(sr."inputTokens") AS "runsWithTokens"
FROM "SandboxRun" sr
JOIN "Organization" o ON sr."organizationId" = o."id"
WHERE sr."startedAt" >= $startDate AND sr."startedAt" <= $endDate
GROUP BY sr."organizationId", o."name"
```

**Per-ticket aggregation** (`ticket-service.ts` L1600-1607):
```sql
SUM("inputTokens"), SUM("outputTokens"), SUM("estimatedCostUsd")
GROUP BY "ticketId"
```

Both patterns use `COALESCE` for null safety and BigInt/Decimal -> number conversion in the JavaScript mapping layer.

---

## Production Data Analysis

*Data queried: May 14, 2026 (read-only production database inspection)*

### Overall Statistics

| Metric | Value |
|--------|-------|
| Total runs | 1,092 |
| Runs with token data | 723 (66.2%) |
| Runs without token data | 369 (33.8%) |
| Organizations | 11 |
| Tickets | 475 |
| Orphan runs (no ticket) | 0 |

### Per-Organization Summary

| Organization | Total Runs | Runs w/ Tokens | Input Tokens | Output Tokens | Est. Cost |
|-------------|-----------|---------------|-------------|--------------|-----------|
| Project X Innovation | 998 | 657 | 4,789,585 | 62,662,359 | $236.02 |
| Dealmed | 18 | 18 | 117,382 | 1,085,819 | $8.37 |
| EKB | 33 | 17 | 48,255 | 986,550 | $8.16 |
| The Breadery | 14 | 12 | 32,578 | 1,007,681 | $4.72 |
| Finesse Contracts | 5 | 3 | 9,404 | 284,841 | --- |
| Motty Inc | 3 | 2 | 4,269 | 180,074 | $1.39 |
| ekb_test | 5 | 5 | 430 | 239,968 | $3.43 |
| Pharmsource, LLC | 4 | 4 | 450 | 392,875 | --- |
| DMW | 5 | 5 | 186 | 59,101 | $6.92 |
| Broudy Precision | 2 | 0 | 0 | 0 | --- |
| Outdoor Living Supply | 5 | 0 | 0 | 0 | --- |

**Notes**:
- Project X Innovation accounts for 91.4% of all runs (internal development/testing).
- Two orgs (Broudy Precision, Outdoor Living Supply) have no token data -- their runs predate token capture.
- Two orgs (Finesse Contracts, Pharmsource) have token data but no cost data.
- "---" indicates `estimatedCostUsd` is null for all runs in that org.

### Model Distribution

| Model | Run Count | Input Tokens | Output Tokens | Est. Cost |
|-------|----------|-------------|--------------|-----------|
| `claude-opus-4-6` | 461 | 2,511,393 | 40,707,630 | $207.87 |
| `claude-haiku-4-5-20251001` | 243 | 606,757 | 25,005,922 | $46.54 |
| `z-ai/glm-5` | 7 | 1,696,315 | 136,279 | $3.80 |
| `qwen/qwen3.6-plus` | 1 | 67,922 | 90 | $9.52 |
| `<synthetic>` | 1 | 91,163 | 5,787 | --- |
| `z-ai/glm-5-20260211` | 1 | 12,293 | 2,410 | --- |
| (null) | 9 | 16,698 | 1,041,223 | --- |

**Notes**:
- `claude-opus-4-6` dominates (63.8% of token-bearing runs, 50.1% of input tokens).
- `claude-haiku-4-5-20251001` is the second most used (33.6% of runs).
- 7 distinct model variants are tracked, plus 9 runs with null model identifiers.

### Token Coverage Trend

| Month | Total Runs | Runs w/ Tokens | Coverage |
|-------|-----------|---------------|----------|
| May 2026 | 189 | 183 | **96.8%** |
| April 2026 | 627 | 540 | **86.1%** |
| March 2026 | 275 | 0 | **0.0%** |
| (null date) | 1 | 0 | 0.0% |

**Key insight**: Token capture was implemented between March and April 2026. Coverage has been increasing month-over-month and is near-complete for May 2026 (96.8%). Historical data before April has zero token coverage.

### Cost Data Coverage

| Metric | Value |
|--------|-------|
| Runs with cost data | 97 |
| Runs with tokens but no cost | 629 |
| Total runs with tokens | 723 |
| **Cost coverage** | **13.4%** |
| Average input tokens/run | 6,919 |
| Average output tokens/run | 92,530 |

**Key insight**: `estimatedCostUsd` is populated for only 13.4% of token-bearing runs. Cost data comes from external workflow scripts, not server-side calculation. Token counts (input/output) are the reliable metric; cost should be treated as supplementary and labeled "estimated."

### Per-Ticket Drill-Down (Sample: Dealmed)

| # | Ticket Title | Runs | Input Tokens | Output Tokens | Est. Cost | Models |
|---|-------------|------|-------------|--------------|-----------|--------|
| 2 | New | 2 | 35,858 | 294,811 | --- | claude-opus-4-6 |
| 1 | Replace Algolia by DB Items Table on Sales Portal | 6 | 26,328 | 160,754 | $4.51 | claude-opus-4-6 |
| 7 | Enhance Vendor Bill Approval with On-Hold workflow | 2 | 13,241 | 1,506 | --- | claude-opus-4-6 |
| 5 | Operative IQ -- Dealmed Integrated Supplier API | 2 | 13,126 | 243,831 | $1.93 | claude-opus-4-6 |
| 8 | Repurpose script to provide ... | 2 | 11,321 | 86,148 | $1.21 | claude-opus-4-6 |
| 6 | Add a "missing item/charge" to the Daily EDI Report | 2 | 8,488 | 136,508 | $0.72 | claude-opus-4-6 |
| 4 | Add "record has been changed" validation for EDI 8... | 1 | 6,185 | 90,049 | --- | claude-opus-4-6 |
| 3 | Types of stocking behavior for products... | 1 | 2,835 | 72,212 | --- | claude-opus-4-6 |

**This demonstrates the audit pattern**: An org admin can see exactly which tickets consumed tokens, how many runs each ticket used, and the estimated cost where available. This is the per-ticket drill-down that the ticket requires.

### Key Findings

1. **Data infrastructure is production-ready**: Token capture works, coverage is high for recent months (96.8%), and all runs are ticket-linked (zero orphans).
2. **Coverage is improving**: From 0% in March to 86.1% in April to 96.8% in May. The trend indicates near-complete coverage going forward.
3. **Cost data is sparse**: Only 13.4% of token-bearing runs have `estimatedCostUsd`. Token counts are reliable; cost is supplementary.
4. **Per-ticket audit works**: The Dealmed example confirms that per-ticket drill-down with token, cost, and model data is feasible and useful.
5. **Multi-model tracking works**: 7 model variants are tracked across runs, enabling per-ticket model reporting.
6. **All runs are ticket-linked**: Zero orphan runs means per-ticket breakdown is sufficient for complete audit (no "unaccounted" usage).

---

## Recommended Implementation

### Server: New API Endpoint

**Endpoint**: `GET /analytics/token-usage`

| Aspect | Detail |
|--------|--------|
| Auth | `requireAuth` (org-scoped via JWT, **not** `requireAdmin`) |
| Scoping | `auth.user.organizationId` from JWT -- users cannot query other orgs |
| Query params | `startDate` (ISO string, optional), `endDate` (ISO string, optional) |
| Response | `{ summary: OrgTokenUsageSummary, tickets: OrgTokenUsageTicket[] }` |

**Response types**:

```typescript
type OrgTokenUsageSummary = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostUsd: number | null;
  totalRuns: number;
  runsWithTokens: number;
};

type OrgTokenUsageTicket = {
  ticketId: string;
  ticketTitle: string;
  ticketNumber: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  runCount: number;
  runsWithTokens: number;
  models: string[];
};

type OrgTokenUsageResponse = {
  summary: OrgTokenUsageSummary;
  tickets: OrgTokenUsageTicket[];
};
```

**New files**:

| File | Purpose |
|------|---------|
| `src/services/org-token-usage-service.ts` | Service with `getOrgTokenUsage(organizationId, options?)`. Raw SQL via `prisma.$queryRaw` adapting the admin pattern with `WHERE organizationId = $1` and `GROUP BY ticketId`. |
| `src/controllers/org-token-usage-controller.ts` | Controller extracting `auth.user.organizationId` and date range params. |
| Route in `src/routes/api.ts` | `apiRouter.get("/analytics/token-usage", getOrgTokenUsage)` near existing analytics route (line 367). |

**SQL approach**: Adapt `admin-token-usage-service.ts` lines 44-68:
1. Replace `JOIN "Organization"` with `JOIN "Ticket" t ON sr."ticketId" = t."id"` for ticket metadata.
2. Add `WHERE sr."organizationId" = ${organizationId}` filter.
3. Change `GROUP BY` to `sr."ticketId", t."title", t."ticketNumber"`.
4. Add `array_agg(DISTINCT sr."modelUsed") FILTER (WHERE sr."modelUsed" IS NOT NULL)` for per-ticket model names.
5. Compute summary by reducing per-ticket rows (same pattern as admin service lines 82-101).

**Key decisions**:
- **Separate endpoint** (not extending `/analytics/usage`): Different query patterns (raw SQL vs Prisma client), different response shapes (per-ticket vs per-user), no disruption to existing consumers.
- **Raw SQL** (not Prisma client `groupBy`): Prisma client lacks support for `array_agg(DISTINCT)`, complex aggregation with FILTER clauses, and multi-table joins in groupBy.
- **No pagination**: Largest org has ~998 runs across a few hundred tickets. Aggregated per-ticket result set is small.
- **No schema migration**: All required fields already exist on `SandboxRun`.
- **Server-side summary**: Computed from per-ticket rows, avoiding redundant client-side aggregation.

### Client: New Token Usage Page

**Route**: `/usage/tokens` (new lazy-loaded page)

**Design reference**: `admin-token-usage.tsx` pattern adapted for org-scoped per-ticket data.

| Component | Description |
|-----------|-------------|
| **Summary cards** | Total input tokens, total output tokens, estimated cost (`$X.XX` or `---`), total runs, data coverage % |
| **Period selector** | Week / month / year / all time (no sprint support -- token usage is cost-scoped, not sprint-scoped) |
| **Per-ticket table** | Sortable columns: ticket title (linked to `/tickets/:id`), input tokens, output tokens, estimated cost, run count, model(s) |
| **Cross-navigation** | Link from `/usage` page to `/usage/tokens` ("View Token Usage" or similar) |
| **No auth gate** | No `useIsAdmin()` or `useIsDeveloper()` check -- available to all authenticated org users |

**New files**:

| File | Purpose |
|------|---------|
| `src/routes/token-usage.tsx` | Token usage page component with summary cards, period selector, and per-ticket table |
| `src/api/token-usage.ts` | TanStack Query options for `GET /analytics/token-usage` with date range params and 5-min staleTime |
| Types in `src/types/api.ts` | `OrgTokenUsageSummary`, `OrgTokenUsageTicket`, `OrgTokenUsageResponse` |
| Route in `src/App.tsx` | Lazy-loaded `/usage/tokens` route |
| Link in `src/routes/usage.tsx` | Cross-navigation to `/usage/tokens` |

**Key decisions**:
- **Separate page** (not tab on `/usage`): Different data sources, different table structures, no tab infrastructure exists, follows admin-token-usage precedent of standalone pages.
- **Client-side sorting**: Small dataset (~200-300 rows max per org). Uses existing `SortChevron` pattern from `usage.tsx`.
- **`---` for null costs**: Matches admin-token-usage.tsx pattern. No misleading `$0.00` values.
- **Ticket title links**: Wrap in `<Link to={/tickets/${ticketId}}>` for drill-down to ticket detail.
- **No developer gate removal**: The `isDeveloper` gate on `run-history.tsx` and `ticket-detail.tsx` is a separate concern and not changed in this ticket.

### Cross-Repo Coordination

| Server (helix-global-server) | Client (helix-global-client) |
|------------------------------|------------------------------|
| New `GET /analytics/token-usage` endpoint | New `/usage/tokens` page consuming the endpoint |
| Response shape: `OrgTokenUsageResponse` | Types mirror server response |
| `requireAuth` org scoping | No client-side auth gate |
| Date filtering via `startDate`/`endDate` query params | Period selector generates date range params |

The client depends on the server endpoint. Both changes should be deployed together or the server endpoint should be deployed first.

---

## Cost Data & Risks

### Cost Sparsity

`estimatedCostUsd` is populated for only **97 of 723 token-bearing runs (13.4%)**. This is because cost data is externally populated by workflow scripts rather than calculated server-side from token counts and model pricing.

| Metric | Value |
|--------|-------|
| Runs with cost data | 97 (13.4% of token-bearing runs) |
| Runs with tokens but no cost | 629 (86.6% of token-bearing runs) |
| Orgs with zero cost data | 2 (Finesse Contracts, Pharmsource) |
| Total estimated cost across all runs | ~$269 |

**Impact**: The "Estimated Cost" summary card will show partial data. Per-ticket cost values will be `---` for most rows. Token counts (input/output) are the reliable, actionable metrics.

### Coverage Gaps

| Period | Coverage | Implication |
|--------|----------|-------------|
| May 2026 | 96.8% | Near-complete; reliable for current-month views |
| April 2026 | 86.1% | Good but incomplete; ~14% of runs have no token data |
| March 2026 | 0.0% | No token capture existed; users viewing "All Time" will see low aggregate coverage |
| Overall | 66.2% | Misleading if presented without context -- most "missing" data is from before token capture existed |

**Impact**: Users selecting "All Time" or "Year" periods will see lower coverage numbers. The UI must communicate this -- the gap is not data loss, but data that was never captured because the feature didn't exist yet.

### Mitigation Strategies

1. **Display data coverage percentage**: Show "X% of runs have token data" in a summary card, helping users understand data completeness.
2. **`---` for null costs**: Never show `$0.00` when cost is unknown. `---` clearly communicates "no data" vs "zero cost."
3. **Label costs as "estimated"**: The summary card should read "Estimated Cost" (not "Total Cost") to set appropriate expectations.
4. **Footer disclaimers**: Add a note explaining that cost data is estimated and may be incomplete, especially for older periods.
5. **Coverage-aware period defaults**: Default to "This Month" (highest coverage) rather than "All Time" (lowest coverage).

---

## Open Questions

| # | Question | Status | Notes |
|---|----------|--------|-------|
| 1 | New section/tab on `/usage` or separate route? | **Resolved** | Separate page at `/usage/tokens`. Follows admin-token-usage precedent, avoids restructuring existing page. |
| 2 | Should per-ticket rows link to ticket detail? | **Resolved** | Yes. Links to `/tickets/:ticketId` for per-run drill-down. Minimal implementation cost. |
| 3 | Should costs be labeled as "estimated" or "partial"? | **Resolved** | "Estimated." Transparent labeling with coverage context. |
| 4 | Are there near-term non-ticket token consumers? | **Resolved** | No. All 1,092 production runs are ticket-linked (zero orphan runs). Response shape accommodates future expansion. |
| 5 | Remove developer gates on existing token displays? | **Deferred** | Related but separate concern. Not in this ticket's scope. |
| 6 | Should the UI warn about lower coverage for older periods? | **Resolved** | Yes. Data coverage percentage in summary card plus footer disclaimer. |

---

## Future Considerations

1. **Usage-based pricing foundation**: This feature is explicitly called out as foundational for usage-based billing. The data exposure here will inform pricing page design and billing integration. The endpoint and response shape are designed to support downstream pricing/invoicing features.

2. **Per-user token breakdown**: Within an org, breaking down token usage by user (who created which tickets) is a natural next step for accountability. The `SandboxRun` model has a `userId` field that enables this. Deferred from MVP.

3. **Server-side cost calculation**: Moving from externally-populated `estimatedCostUsd` to server-calculated cost based on model pricing tables would dramatically improve cost coverage (from 13.4% to ~100% of token-bearing runs). This is likely a prerequisite for accurate billing.

4. **Export capabilities**: CSV/PDF export of usage data for finance and procurement teams. Not in MVP but anticipated for enterprise customers.

5. **Non-ticket consumers**: The ticket mentions "other ways" and "increasingly more ways" of consuming tokens beyond tickets. When these emerge, the per-ticket-only response shape will need a more generic "usage item" concept. Currently all 1,092 runs are ticket-linked, so this is not an immediate concern.

6. **Performance optimization**: If `SandboxRun` grows significantly, add a composite index on `(organizationId, startedAt)` and consider materialized summaries. At 1,092 rows, this is unnecessary.

7. **Data coverage improvement**: As token capture matures, older runs without token data become a smaller percentage of the total. No backfill is possible for runs that completed before token capture was implemented.

---

## Appendix: Data Sources

### Production Database Queries

All data in this report was gathered via read-only database inspection on May 14, 2026. Six query categories were executed:

1. **Per-org token summary**: `SandboxRun` joined to `Organization`, grouped by org name. 11 rows returned.
2. **Model distribution**: `SandboxRun` grouped by `modelUsed` where tokens are present. 7 model variants returned.
3. **Overall coverage stats**: Aggregate counts of total runs, token-bearing runs, org count, ticket count, orphan runs.
4. **Monthly coverage trend**: `SandboxRun` grouped by `DATE_TRUNC('month', startedAt)`. 4 months of data.
5. **Per-ticket drill-down (Dealmed)**: `SandboxRun` joined to `Ticket`, filtered to Dealmed org, grouped by ticket. 8 tickets returned.
6. **Cost coverage analysis**: Counts of runs with cost, runs with tokens-but-no-cost, average tokens per run.

### Source Code References

| File | Repo | Key Lines | What's Referenced |
|------|------|-----------|-------------------|
| `src/services/admin-token-usage-service.ts` | helix-global-server | L44-68, L82-101 | SQL aggregation pattern, summary computation |
| `src/services/analytics-service.ts` | helix-global-server | L32-223 | Existing org-scoped service (no token fields) |
| `src/controllers/analytics-controller.ts` | helix-global-server | L1-16 | Org-scoping pattern via `auth.user.organizationId` |
| `src/routes/api.ts` | helix-global-server | L367, L413 | Route registration for analytics and admin-token-usage |
| `prisma/schema.prisma` | helix-global-server | L394-423 | `SandboxRun` model with token fields |
| `src/services/ticket-service.ts` | helix-global-server | L1600-1607 | Per-ticket token aggregation SQL |
| `src/helix-workflow/orchestrator/run-store.ts` | helix-global-server | L6-11, L480-511 | Token capture pipeline |
| `src/auth/middleware.ts` | helix-global-server | -- | `requireAuth`, `requireAdmin` middleware |
| `src/routes/usage.tsx` | helix-global-client | L1-309 | Current org usage page (no token data) |
| `src/routes/admin-token-usage.tsx` | helix-global-client | L1-235 | Admin token dashboard (design reference) |
| `src/api/admin-token-usage.ts` | helix-global-client | L1-22 | API hook pattern for token queries |
| `src/api/analytics.ts` | helix-global-client | L1-18 | Org-scoped API hook pattern |
| `src/types/api.ts` | helix-global-client | L1323-1362 | Usage and admin token usage types |
| `src/App.tsx` | helix-global-client | L159, L194 | Route registration and lazy loading |
| `src/components/run-history.tsx` | helix-global-client | L379-406 | Per-run token display (developer-only) |
| `src/routes/ticket-detail.tsx` | helix-global-client | L1852-1853, L2756-2760 | Per-ticket token totals (developer-only) |

### Prior Research

- **RSH-431 Research Report** (library repo): Confirmed technical feasibility of org-scoped token exposure. Established that the gap is in data exposure, not data capture.

### Workflow Artifacts

| Artifact | Source | Key Takeaway |
|----------|--------|--------------|
| `scout/scout-summary.md` (helix-global-server) | Scout step | Token data capture production-ready; admin SQL pattern adaptable; no org-scoped endpoint |
| `scout/scout-summary.md` (helix-global-client) | Scout step | /usage page has zero token fields; admin-token-usage is design reference; developer-gated token data |
| `diagnosis/diagnosis-statement.md` (helix-global-server) | Diagnosis step | Feature gap; separate endpoint recommended; no schema migration needed |
| `diagnosis/diagnosis-statement.md` (helix-global-client) | Diagnosis step | UI feature gap; reuse admin design pattern with per-ticket breakdown |
| `product/product.md` | Product step | 5 MVP features; 8 out-of-scope items; usage-based pricing as strategic driver |
| `tech-research/tech-research.md` (helix-global-server) | Tech Research step | New endpoint, raw SQL, array_agg, no pagination, no migration |
| `tech-research/tech-research.md` (helix-global-client) | Tech Research step | New page at /usage/tokens, client-side sort, ticket links, period selector |

## Attachments
- (none)

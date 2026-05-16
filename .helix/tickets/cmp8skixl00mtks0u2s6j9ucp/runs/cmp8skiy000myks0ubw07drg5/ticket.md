# Ticket Context

- ticket_id: cmp8skixl00mtks0u2s6j9ucp
- short_id: RSH-476
- run_id: cmp8skiy000myks0ubw07drg5
- run_branch: helix/research/RSH-476-build-ticket-for-token-usage-accuracy
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Build Ticket for: Token usage accuracy

## Description
Making build ticket based on the last report.

## Research Report

# Token Usage Accuracy & Usage-Based Pricing Readiness

## 1. Executive Summary

**Direct answer: The proposed token accuracy fix is necessary and sufficient for accurate token *metering*. It is not sufficient alone for full usage-based *pricing* readiness.**

The platform is moving to usage-based pricing, which requires three things: the system must be **accurate** (measure real consumption), **fair** (charge proportionally to actual cost), and **transparent** (customers can see and understand their usage). The proposed fix -- adding two missing cache token fields at two locations in `execute-workflow-step.mjs` -- fully solves accuracy. But fairness and transparency require additional infrastructure that does not yet exist.

Three things need to happen for usage-based pricing:

1. **Fix token accuracy** (current ticket scope) -- Captures the 95-99% of input tokens currently missing. This is the measurement foundation everything else depends on. Scope: 1 file, 2 code locations. Risk: low.

2. **Add cost computation** (new work required) -- 97.9% of succeeded runs with token data have no dollar cost. Without server-side cost computation using model pricing tables, the platform cannot translate tokens into dollars. This is required for any dollar-denominated billing.

3. **Add customer transparency** (new work required) -- All token display is currently gated by an internal `isDeveloper` flag (52 occurrences across 11 client files). Customers cannot see their own consumption. For transparent billing, customers need a usage view.

**Key production evidence** (queried May 16, 2026): Across 1,153 total runs (731 succeeded), stored input tokens average **4,725** per run while output tokens average **105,515** -- a 22:1 inverted ratio that should be 5:1 to 20:1 the other direction. Grand totals: **5.11M stored input** vs. **72.6M stored output**. Every customer organization exhibits this undercount. The most recent 8 succeeded runs show output-to-input ratios ranging from 27:1 to 1,084:1 -- confirming the issue is actively ongoing and worsening with newer, more cache-heavy workflows.

---

## 2. Assessment: Are the Proposed Changes Enough?

### What the Fix Solves

The RC-1 fix adds `cache_creation_input_tokens` and `cache_read_input_tokens` to the input token sum at two capture points in `execute-workflow-step.mjs` (lines 1698-1699 and 1724-1725). This establishes accurate metering at the source, and every downstream consumer automatically benefits:

| # | Downstream Consumer | Location | Change Needed? |
|---|---|---|---|
| 1 | Log emission | `execute-workflow-step.mjs` line 1703 | No -- emits `[usage] input_tokens=NNN`; higher corrected integers emit correctly |
| 2 | Per-turn live updates (log parsing) | `workflow-step-chain.ts` line 895 | No -- regex `input_tokens=(\d+)` captures any non-negative integer |
| 3 | Live DB update (`updateRunUsageBestEffort`) | `run-store.ts` lines 496-511 | No -- fire-and-forget write of `inputTokens` integer to `SandboxRun`; no value transformation |
| 4 | Step result extraction | `execute.ts` lines 374-377 | No -- `typeof parsedResult.inputTokens === "number"` passthrough; no range validation |
| 5 | Step persistence (`persistStepProgress`) | `run-store.ts` lines 396-490 | No -- sums completed steps' `inputTokens` with `+=`; writes integer to DB |
| 6 | Final aggregation | `orchestrator.ts` lines 2237-2268 | No -- `Math.max(0, Math.floor(...))` on each step's integer; sums across steps |
| 7 | Per-ticket SQL SUM | `ticket-service.ts` lines 1601-1611 | No -- `SUM("inputTokens")` on corrected per-run values |
| 8 | Per-org SQL SUM | `admin-token-usage-service.ts` lines 54-68 | No -- `SUM("inputTokens")` with org JOIN on corrected per-run values |
| 9 | Admin dashboard | `admin-token-usage.tsx` | No -- renders server-provided aggregated data |
| 10 | Client token display | `dashboard.tsx`, `run-history.tsx` | No -- renders server data via `toLocaleString()` |

### What It Does NOT Solve

| Gap | Current State | Impact on Pricing |
|---|---|---|
| **Cost computation** | `estimatedCostUsd` is null/zero for 97.9% of succeeded runs with token data | Cannot bill in dollars without server-side cost calculation |
| **Customer visibility** | All token display gated by `isDeveloper` (52 occurrences across 11 client files) | Customers cannot see their own usage |
| **Cache token granularity** | Fix sums all input types into one number | Cannot apply differential pricing by token type (cache read vs. base) |
| **Historical data** | Pre-fix runs have 95-99% undercounted input | Cannot retroactively bill historical periods accurately |
| **Model-aware billing** | No per-model cost differentiation | Opus tokens cost 5x Haiku tokens but are stored identically |

### Verdict

| Dimension | Fix Sufficient? | Why |
|---|---|---|
| **Accuracy** | **Yes** | Captures complete input tokens at the source; downstream auto-propagates |
| **Fairness** | **Partially** | Accurate totals are necessary, but fair pricing also requires cost differentiation by model and token type |
| **Transparency** | **No** | Customers still cannot see their usage; no billing explanation exists |

**The fix is the essential first step. But usage-based pricing requires the additional work described in the roadmap (Section 8).**

---

## 3. Current State: Production Evidence

All data was collected from the production database via read-only runtime inspection queries on **May 16, 2026**.

### 3.1 Grand Totals

| Metric | Value |
|--------|-------|
| Total runs (all time) | 1,153 |
| Runs with input token data | 772 (66.9%) |
| Grand total stored input tokens | **5,106,124** |
| Grand total stored output tokens | **72,609,174** |
| Overall output-to-input ratio | **14.2:1** (inverted from expected) |
| Runs with cost data (>$0) | 108 (9.4% of all runs) |

### 3.2 Succeeded Run Statistics

| Metric | Value |
|--------|-------|
| Total succeeded runs | 731 |
| Succeeded runs with input data | 580 (79.3%) |
| Average stored input tokens per run | **4,725** |
| Average stored output tokens per run | **105,515** |
| Average output-to-input ratio | **195.6:1** (mean; heavily skewed by extreme cases) |
| Succeeded runs without cost data | 568 of 580 (**97.9%**) |

### 3.3 Per-Organization Token Breakdown

| Organization | Total Runs | With Tokens | Stored Input | Stored Output | Reported Cost | Cost Coverage |
|---|---:|---:|---:|---:|---:|---:|
| Project X Innovation | 1,056 | 706 | 4,893,171 | 68,372,335 | $266.32 | 84 runs (8.0%) |
| Dealmed | 18 | 18 | 117,382 | 1,085,819 | $8.37 | 6 runs (33.3%) |
| EKB | 33 | 17 | 48,255 | 986,550 | $8.16 | 8 runs (24.2%) |
| The Breadery | 14 | 12 | 32,578 | 1,007,681 | $4.72 | 1 run (7.1%) |
| Finesse Contracts | 5 | 3 | 9,404 | 284,841 | -- | 0 runs (0%) |
| Motty Inc | 3 | 2 | 4,269 | 180,074 | $1.39 | 1 run (33.3%) |
| Pharmsource, LLC | 4 | 4 | 450 | 392,875 | -- | 0 runs (0%) |
| ekb_test | 5 | 5 | 430 | 239,968 | $3.43 | 4 runs (80%) |
| DMW | 5 | 5 | 186 | 59,101 | $6.92 | 4 runs (80%) |
| Broudy Precision | 5 | 0 | 0 | 0 | -- | 0 runs |
| Outdoor Living Supply | 5 | 0 | 0 | 0 | -- | 0 runs |

Every organization with token data shows stored output exceeding stored input, confirming the undercount is systemic across all customers.

### 3.4 Per-Model Breakdown (Succeeded Runs with Token Data)

| Model | Runs | Avg Input | Avg Output | Output:Input Ratio | Runs with Cost |
|---|---:|---:|---:|---:|---:|
| claude-opus-4-6 | 321 | 6,171 | 102,170 | 16.6:1 | 7 (2.2%) |
| claude-haiku-4-5-20251001 | 247 | 2,614 | 109,508 | 41.9:1 | 5 (2.0%) |
| (null/unknown) | 10 | 1,955 | 134,559 | 68.8:1 | 0 (0%) |
| z-ai/glm-5 | 2 | 47,273 | 4,078 | **0.09:1** (correct) | 0 |

**Control observation**: The z-ai/glm-5 model (which does not use prompt caching) shows the correct ratio: input tokens higher than output. Only Claude models with prompt caching exhibit the inverted pattern, confirming cache token omission as the sole root cause.

**Model distribution** (all 731 succeeded runs): 321 Opus (43.9%), 247 Haiku (33.8%), 161 null/unknown (22.0%), 2 z-ai/glm-5 (0.3%). The 161 null-model runs likely represent older runs before model tracking was added.

### 3.5 Cost Data Coverage by Month

| Month | Total Runs | With Cost | Coverage |
|---|---:|---:|---:|
| May 2026 (partial, to May 16) | 250 | 23 | 9.2% |
| April 2026 | 627 | 85 | 13.6% |
| March 2026 | 275 | 0 | 0.0% |

Cost data coverage is inconsistent and low. The SDK's `total_cost_usd` field returns zero for current Claude models, making the existing cost capture ineffective. The slight improvement in April-May likely reflects runs using older model versions where the SDK still reported costs.

### 3.6 Most Recent Succeeded Runs (May 16, 2026)

| Stored Input | Stored Output | Output:Input Ratio | Model | Has Cost? |
|---:|---:|---:|---|---|
| 820 | 112,985 | **137.8:1** | claude-haiku-4-5 | No |
| 2,090 | 136,190 | 65.2:1 | claude-haiku-4-5 | No |
| 315 | 341,581 | **1,084.4:1** | claude-haiku-4-5 | No |
| 2,852 | 304,363 | 106.7:1 | (null) | No |
| 4,518 | 156,487 | 34.6:1 | claude-haiku-4-5 | No |
| 1,243 | 136,219 | 109.6:1 | claude-haiku-4-5 | No |
| 5,242 | 143,101 | 27.3:1 | claude-haiku-4-5 | No |
| 123 | 42,044 | **341.8:1** | claude-haiku-4-5 | No |

All 8 most recent runs show inverted ratios ranging from 27:1 to 1,084:1. Zero have cost data. This confirms the issue is actively ongoing and that the most cache-heavy workflows (ratio 1,084:1) are losing 99.9% of their input token data.

### 3.7 Seven-Day Trend (May 9-16, 2026)

| Date | Runs | Sum Input | Sum Output | Ratio |
|---|---:|---:|---:|---:|
| May 16 | 9 | 18,383 | 1,480,439 | 80.5:1 |
| May 15 | 14 | 30,644 | 1,809,550 | 59.1:1 |
| May 14 | 19 | 41,181 | 1,709,098 | 41.5:1 |
| May 13 | 11 | 44,249 | 1,238,150 | 28.0:1 |
| May 12 | 13 | 15,833 | 1,148,300 | 72.5:1 |
| May 11 | 11 | 29,446 | 1,516,399 | 51.5:1 |
| May 10 | 17 | 64,849 | 1,817,491 | 28.0:1 |
| May 9 | 5 | 7,902 | 367,256 | 46.5:1 |

Every day in the last week shows inverted ratios (28:1 to 80:1), confirming the fix has not been applied. Daily variation in the ratio is expected based on workflow type mix (more multi-turn conversations = higher cache utilization = higher undercount).

For the complete root cause analysis, pipeline architecture, and detailed fix specification, see the original RSH-456 findings summarized in the Appendix (Section 10.1).

---

## 4. Accuracy Analysis

### 4.1 Root Cause Recap

The SDK-level capture code in `execute-workflow-step.mjs` records only `input_tokens` from the Claude Agent SDK's usage objects, completely ignoring `cache_creation_input_tokens` and `cache_read_input_tokens`. Since the Claude Agent SDK uses prompt caching extensively in multi-turn agentic conversations, approximately **95-99% of input token consumption** goes through cache operations and is never recorded.

Two specific code locations:

1. **Per-turn accumulation** (line 1698): `resultInputTokens = (resultInputTokens ?? 0) + u.input_tokens` -- accumulates with `+=` but ignores cache fields.
2. **SDK result overwrite** (line 1724): `resultInputTokens = message.usage.input_tokens` -- overwrites with `=` (not `+=`), also ignoring cache fields. This causes the "values going lower" symptom.

The SDK type documentation (`docs/guides/claude-agent-sdk-typescript-ref.md` lines 2298-2303) confirms both `cache_creation_input_tokens` and `cache_read_input_tokens` are standard optional properties on the `Usage` type.

The complete root cause analysis with code evidence and production data is documented in the original RSH-456 research (Appendix Section 10.1).

### 4.2 What "Accurate" Means Post-Fix

After the fix, new runs should show:
- **Input-to-output ratios of 5:1 to 20:1** (input higher than output), consistent with typical multi-turn Claude conversations with prompt caching
- A workflow that currently shows 315 input / 341,581 output (1,084:1 inverted) should show approximately **1,700,000-3,400,000 input** / 341,581 output
- `[usage]` log lines will display realistic input token counts instead of single/double-digit values
- Value fluctuation ("going lower" symptom) will be greatly reduced as both capture paths produce convergent totals

### 4.3 Remaining Accuracy Gaps Post-Fix

| Gap | Severity | Description |
|---|---|---|
| **Cost estimation** | High (for pricing) | `estimatedCostUsd` remains null for 97.9% of succeeded runs with token data. The fix does not add cost computation. |
| **Historical runs** | Medium | Pre-fix runs store 1-5% of actual input. True values were never persisted and cannot be reconstructed. |
| **Per-turn vs. result path** | Low | Minor differences may persist between per-turn accumulated total and SDK result's cumulative total due to message deduplication via `seenMessageIds`. |
| **Non-Claude models** | None | z-ai/glm-5 already shows correct ratios (0.09:1). Fix handles null/undefined cache fields gracefully with `typeof === "number"` checks defaulting to 0. |

### 4.4 Estimated True Token Volumes

Using the production per-organization data and typical cache utilization ratios observed in multi-turn agentic workflows (cache reads typically constitute ~95% of total input token volume):

| Organization | Stored Input | Stored Output | Estimated True Input | Undercount Factor |
|---|---:|---:|---:|---:|
| Project X Innovation | 4,893,171 | 68,372,335 | ~683,000,000 | ~140x |
| Dealmed | 117,382 | 1,085,819 | ~10,858,000 | ~93x |
| EKB | 48,255 | 986,550 | ~9,866,000 | ~204x |
| The Breadery | 32,578 | 1,007,681 | ~10,077,000 | ~309x |
| Finesse Contracts | 9,404 | 284,841 | ~2,848,000 | ~303x |

**Estimation methodology**: True input tokens are estimated as approximately 10x the stored output tokens, based on typical prompt caching ratios where the context window (input) is substantially larger than the generated response (output) in agentic multi-turn conversations. The 10x multiplier is conservative; actual ratios vary by workflow complexity.

**Every customer's input token total is undercounted by 90-99%.** For any usage-based pricing model, the current stored values would undercharge by a corresponding factor.

---

## 5. Fairness Analysis

Fair usage-based pricing means customers pay proportionally to the actual cost their usage imposes. Three factors complicate fairness beyond raw token accuracy.

### 5.1 Cache Token Pricing Differentials

Anthropic prices different token types at significantly different rates (per million tokens):

| Token Type | Claude Opus 4 ($/MTok) | Claude Haiku 4.5 ($/MTok) | Relative Cost |
|---|---:|---:|---|
| Base input tokens | $5.00 | $1.00 | 1.0x (baseline) |
| Cache write tokens (5-min TTL) | $6.25 | $1.25 | 1.25x base |
| Cache write tokens (1-hr TTL) | $10.00 | $2.00 | 2.0x base |
| Cache read tokens | $0.50 | $0.10 | **0.10x base** |
| Output tokens | $25.00 | $5.00 | 5.0x base |

*Sources: [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)*

**Key insight**: Cache read tokens -- which make up the vast majority (~95%) of input token volume in multi-turn agentic conversations -- cost Anthropic only **10% of the base input rate**. This creates a significant fairness question for the platform.

**Example: Typical Haiku 4.5 Run** (using production averages and estimated token composition):

| Component | Token Volume | Anthropic Unit Price | Anthropic Cost |
|---|---:|---:|---:|
| Base input tokens (non-cached) | ~2,600 | $1.00/MTok | $0.003 |
| Cache creation tokens | ~50,000 | $1.25/MTok | $0.063 |
| Cache read tokens | ~950,000 | $0.10/MTok | $0.095 |
| Output tokens | ~109,500 | $5.00/MTok | $0.548 |
| **Total (actual Anthropic cost)** | **~1,112,100** | | **~$0.71** |

If the platform charges a flat rate per total input token (no cache differentiation):

| Component | Token Volume | Flat Rate (Haiku input) | Platform Charge |
|---|---:|---:|---:|
| All input tokens (summed) | ~1,002,600 | $1.00/MTok | $1.00 |
| Output tokens | ~109,500 | $5.00/MTok | $0.548 |
| **Total (flat-rate charge)** | | | **~$1.55** |

**The flat-rate approach charges ~2.2x Anthropic's actual cost per Haiku run.** This margin may be desirable for the platform, but it's important to understand it's built into the pricing structure, not explicit.

**Example: Typical Opus 4 Run**:

| Pricing Model | Est. Cost per Run | Notes |
|---|---:|---|
| Actual Anthropic cost (cache-differentiated) | ~$3.40 | Base $0.03 + cache write $0.31 + cache read $0.48 + output $2.55 |
| Flat rate on total input tokens | ~$7.60 | All input at $5/MTok + output at $25/MTok |
| Markup factor | ~2.2x | Flat rate is 2.2x actual cost |

### 5.2 Per-Model Cost Differences

The two primary models in production have dramatically different per-token costs:

| Model | Input $/MTok | Output $/MTok | Runs in Production | % of Succeeded |
|---|---:|---:|---:|---:|
| claude-opus-4-6 | $5.00 | $25.00 | 321 | 43.9% |
| claude-haiku-4-5-20251001 | $1.00 | $5.00 | 247 | 33.8% |
| **Cost ratio (Opus vs Haiku)** | **5x** | **5x** | | |

A "total tokens" billing model treats an Opus token the same as a Haiku token. But an Opus run costs Anthropic ~5x more than a Haiku run for the same token volume. Without model-aware pricing, customers using the cheaper Haiku model effectively subsidize Opus users.

**Production impact**: With 321 Opus runs averaging 6,171 stored input (est. ~1M true input) and 102,170 output, and 247 Haiku runs averaging 2,614 stored input (est. ~1M true input) and 109,508 output -- the cost difference per run is approximately 5x despite similar token volumes.

### 5.3 Billing Unit Options

| Option | How It Works | Pros | Cons |
|---|---|---|---|
| **A. Total tokens** | Charge per total token (input + output) at a flat rate | Simple to implement; easy to explain; works with current data model | Not model-aware; not cache-aware; Opus users underpay, Haiku users overpay |
| **B. Model-weighted tokens** | Different per-token rates by model | Fairer across model types; still relatively simple | Requires tracking model per billing line item; doesn't differentiate cache types |
| **C. Dollar cost pass-through** | Compute actual Anthropic cost per run, add margin | Most accurate; fairest to all customers; transparent | Requires server-side cost computation (biggest gap today); complex to explain |
| **D. Tiered pricing** | Fixed price per billing tier (e.g., X runs/month) | Simplest for customers; predictable billing | Not true usage-based; penalizes light users or heavy users depending on tier design |

**Recommendation**: Start with **Option B (model-weighted tokens)** as it balances fairness and implementation simplicity. The `modelUsed` field is already tracked on 77.7% of succeeded runs (568 of 731). Evolve to **Option C (dollar cost pass-through)** once server-side cost computation is built, as this is the most accurate and transparently fair approach.

### 5.4 Forward-Only Accuracy

Pre-fix runs have 95-99% undercounted input tokens. For billing periods that span the fix deployment date:

| Approach | Fairness | Complexity |
|---|---|---|
| **Exclude pre-fix runs from billing** | Most fair to customers; avoids charging on inaccurate data | Requires a cutover date in billing logic |
| **Include all runs, accept inaccuracy** | Simple; no special handling | Unfair to platform (massive undercharge for historical) |
| **Apply correction factor to historical** | Attempts fairness for both sides | Complex; correction factor is approximate (93x-309x range per org) |

**Recommendation**: Use a **clean cutover date** coinciding with the fix deployment. Bill usage-based pricing only on post-fix runs. Clearly communicate this to customers.

---

## 6. Transparency Analysis

### 6.1 Current Visibility Architecture

All LLM usage display in the client is gated by the `isDeveloper` boolean from the auth context. A grep of the client codebase shows **52 occurrences across 11 files**:

| Display Location | File | Gate | What's Shown |
|---|---|---|---|
| Dashboard ticket cards | `dashboard.tsx` | `isDeveloper` | `aggregateTotalTokens.toLocaleString()` |
| Ticket detail | `ticket-detail.tsx` | `isDeveloper` | Client-side sum of runs' input + output |
| Run history aggregate | `run-history.tsx` | `isDeveloper` | `totalInputTokens + totalOutputTokens` |
| Run history per-run | `run-history.tsx` | `isDeveloper` | Input tokens, output tokens, cost per run |
| Run detail modal | `run-detail-modal.tsx` | `isDeveloper` | Token breakdown per run |
| Admin token usage | `admin-token-usage.tsx` | `useIsAdmin` | Per-org breakdown with period filtering |

**Result**: Customers cannot see any token usage data. Only internal developers and admins can view consumption. This is incompatible with transparent usage-based billing.

### 6.2 What Customers Need for Transparent Billing

For usage-based pricing to be considered transparent, customers need:

1. **Consumption visibility**: See their own organization's total token usage for the current billing period
2. **Breakdown clarity**: Understand what they're being charged for (input tokens, output tokens, by model if applicable)
3. **Per-ticket attribution**: See token usage per ticket/workflow for cost attribution within their organization
4. **Billing explanation**: Documentation of how usage translates to charges (rate card, calculation methodology)
5. **Historical access**: View prior billing periods for comparison and audit

### 6.3 Existing Infrastructure That Can Be Leveraged

The admin token usage system (`admin-token-usage-service.ts`, 104 lines) already provides much of the backend needed:

```
GET /admin/token-usage?startDate=X&endDate=Y
```

This endpoint returns per-organization breakdowns with:
- `totalInputTokens`, `totalOutputTokens` per org (lines 59-61)
- `estimatedCostUsd` per org when available (line 62)
- `totalRuns`, `runsWithTokens` per org (lines 58-59)
- Date-range filtering via `startDate`/`endDate` parameters (lines 39-42)
- Summary rollup across all organizations (lines 82-101)

**What exists and can be repurposed**:
- Per-org SQL aggregation with date-range filtering (already billing-period ready)
- Per-ticket SQL aggregation (already in `ticket-service.ts` lines 1600-1610)
- Admin UI with period filtering (week/month/year/all) as a reference implementation
- API endpoint with date-range parameters

**What's missing**:
- Customer-scoped endpoint (current endpoint is admin-only, registered at `routes/api.ts` with `requireAdmin` middleware)
- Customer-facing UI page
- Token-to-dollar computation for the cost column
- Rate card / pricing explanation documentation
- Usage export (CSV/PDF for billing records)

### 6.4 Gap Assessment

| Transparency Component | Status | Effort to Build |
|---|---|---|
| Accurate token metering | Fix pending (this ticket) | Small -- 1 file, 2 locations |
| Per-org aggregation API | Exists (`admin-token-usage-service.ts`) | Adapt to customer-scoped access |
| Per-ticket aggregation | Exists (`ticket-service.ts`) | Adapt to customer-scoped access |
| Period filtering | Exists (week/month/year/all) | Reuse in customer view |
| Customer-scoped API endpoint | **Missing** | Medium -- new controller + auth |
| Customer-facing usage UI | **Missing** | Medium -- new page, adapt admin layout |
| Cost computation | **Missing** (97.9% null) | Medium -- pricing table + computation logic |
| Billing explanation docs | **Missing** | Small -- static content |
| Usage export | **Missing** | Small -- CSV/PDF generation |

---

## 7. Existing Infrastructure Inventory

### 7.1 Complete Infrastructure Assessment

| Component | Location | Status | Billing Ready? | Notes |
|---|---|---|---|---|
| Token capture (input) | `execute-workflow-step.mjs` lines 1698, 1724 | **Broken** -- 95-99% undercounted | No (until fix) | Fix is this ticket's scope |
| Token capture (output) | `execute-workflow-step.mjs` | Working | Yes | Output tokens captured correctly |
| Per-run DB storage | `run-store.ts` (3 write paths) | Working | Yes | Stores inputTokens, outputTokens per run |
| Per-ticket aggregation | `ticket-service.ts` lines 1601-1611 | Working | Yes | SQL SUM per ticket, includes `distinctModels` and `singleModel` |
| Per-org aggregation | `admin-token-usage-service.ts` lines 54-68 | Working | Yes | SQL SUM per org with date filtering |
| Admin API endpoint | `admin-token-usage-controller.ts` | Working | Admin-only | `GET /admin/token-usage?startDate&endDate` |
| Admin dashboard UI | `admin-token-usage.tsx` | Working | Admin-only | Period filtering, summary cards, org table |
| Model tracking | `SandboxRun.modelUsed` | Working | 77.7% coverage | Null for 161 of 731 succeeded runs |
| Cost data field | `SandboxRun.estimatedCostUsd` | **Gap** -- 97.9% null | No | SDK returns zero for current models |
| Cost computation | None | **Missing** | No | No server-side pricing logic exists |
| Customer API endpoint | None | **Missing** | No | No customer-scoped usage endpoint |
| Customer usage UI | None | **Missing** | No | All display is isDeveloper-gated (52 occurrences / 11 files) |
| Cache token columns | Not in schema | **Missing** | No (for differential pricing) | Only needed if charging different rates by token type |
| Model-aware pricing | None | **Missing** | No | No per-model rate differentiation |
| Usage export | None | **Missing** | No | No CSV/PDF generation |
| Billing docs | None | **Missing** | No | No rate card or methodology docs |

### 7.2 Build Effort Estimates

| Missing Component | Effort | Dependencies |
|---|---|---|
| Token accuracy fix | **Small** (1 file, 2 locations) | None |
| Server-side cost computation | **Medium** (pricing config + computation in pipeline) | Token accuracy fix |
| Customer-scoped API | **Medium** (new controller, org-scoped auth middleware) | Token accuracy fix |
| Customer usage UI | **Medium** (new page, adapted from admin layout) | Customer API |
| Cache token DB columns | **Medium** (Prisma migration + pipeline type changes across 8+ files) | Token accuracy fix |
| Model-aware pricing | **Small** (pricing table config, lookup in cost computation) | Cost computation |
| Usage export | **Small** (CSV generation from existing aggregation queries) | Customer API |
| Billing documentation | **Small** (static markdown/page) | Pricing decisions finalized |

---

## 8. Recommended Roadmap

### Phase 1: Fix Token Accuracy (Current Ticket -- Immediate)

**What**: Add `cache_creation_input_tokens` and `cache_read_input_tokens` to the input token sum at two capture points in `execute-workflow-step.mjs`.

**Scope**: 1 file (`execute-workflow-step.mjs`), 2 code locations (lines 1698-1699 and 1724-1725). No database migration. No downstream changes. No new dependencies.

**Unlocks**: Accurate per-run, per-ticket, and per-org token metering. Establishes the measurement foundation that all subsequent phases depend on. Immediately fixes the "values going lower" UI symptom as a side effect.

**Effort**: Small | **Risk**: Low | **Dependencies**: None

**Validation**: After deployment, new runs should show input-to-output ratios of 5:1 to 20:1 (input > output). The z-ai/glm-5 control model (0.09:1 ratio) confirms that non-Claude models will be unaffected.

---

### Phase 2: Server-Side Cost Computation (Next Priority)

**What**: Build server-side cost computation that translates token counts into dollar amounts using model pricing tables. Populate `estimatedCostUsd` for every run.

**Scope**:
- New pricing configuration (model -> per-token rates, with version dating for Anthropic price changes)
- Computation logic in the step execution pipeline or as a post-processing step
- Update `estimatedCostUsd` from ~2.1% coverage to ~100% for new runs
- Backfill computation for post-Phase-1 runs that have accurate token data

**Key design decisions**:
- Whether to use flat per-model rates or differentiate by cache token type (requires Phase 4 for separate columns)
- Whether pricing config is stored in code (simple, versioned) or database (configurable without deploys)
- How to handle Anthropic price changes over time (versioned pricing table recommended)

**Unlocks**: Dollar-value billing. Admin dashboard shows actual costs. Foundation for customer-facing billing. Enables gross margin analysis.

**Effort**: Medium | **Risk**: Low-Medium | **Dependencies**: Phase 1

---

### Phase 3: Customer-Facing Transparency (Customer-Visible)

**What**: Expose usage data to customers so they can see their own consumption.

**Scope**:
- New customer-scoped API endpoint (adapt from existing admin endpoint at `admin-token-usage-service.ts`, scope to requesting user's organization via auth context)
- New customer billing/usage page in the client UI (adapt from `admin-token-usage.tsx` reference implementation)
- Selectively remove or adjust `isDeveloper` gates to show appropriate data to all users (52 occurrences across 11 files to review)
- Billing explanation documentation (rate card, calculation methodology)
- Optional: usage export (CSV) for customer billing records

**Key design decisions**:
- What level of detail to expose (total tokens only vs. input/output breakdown vs. per-ticket attribution)
- Whether to show dollar amounts or only token counts
- How billing periods align with usage reporting
- Whether to show per-ticket token attribution (data already available via `ticket-service.ts`)

**Unlocks**: Transparent billing. Customers can verify their charges. Supports self-service account management.

**Effort**: Medium | **Risk**: Low | **Dependencies**: Phase 1, Phase 2 (for cost display)

---

### Phase 4: Granular Analytics and Differential Pricing (Future Enhancement)

**What**: Add separate database columns for cache token types to enable differential pricing and cache analytics.

**Scope**:
- Prisma schema migration: add `cacheCreationInputTokens Int?` and `cacheReadInputTokens Int?` to `SandboxRun`
- Update `execute-workflow-step.mjs` to export three separate input token fields alongside the summed total
- Update server pipeline (`execute.ts`, `types.ts`, `run-store.ts`, `orchestrator.ts`, and 4+ more files) to pass through separate fields
- Update admin dashboard with cache token breakdown visualization
- Optional: update customer-facing UI with token type breakdown

**Key design decisions**:
- Whether to pass through Anthropic's cache pricing differential to customers (see Section 5.1 -- flat-rate charges ~2.2x actual cost)
- Whether to break down by model in addition to token type
- Whether per-ticket attribution needs cache granularity

**Unlocks**: Differential pricing by token type. Cache utilization analytics. Most accurate cost pass-through. Enables passing Anthropic cache savings to customers.

**Effort**: Medium-Large | **Risk**: Medium (schema migration, pipeline-wide changes across 8+ files) | **Dependencies**: Phase 1

---

### Phase Summary

| Phase | Scope | Effort | Unlocks | Status |
|---|---|---|---|---|
| **1. Token Accuracy** | 1 file, 2 locations | Small | Accurate metering foundation | Current ticket |
| **2. Cost Computation** | Pricing config + computation logic | Medium | Dollar-value billing | Not started |
| **3. Customer Transparency** | New API + UI + docs | Medium | Transparent billing | Not started |
| **4. Cache Granularity** | Schema migration + pipeline | Medium-Large | Differential pricing, cache analytics | Not started |

**Total estimated effort to full pricing readiness**: 1 Small + 2 Medium + 1 Medium-Large = approximately 4-6 tickets of work beyond the current fix.

---

## 9. Open Questions for Business Decision

These questions require business input and cannot be answered by technical analysis alone. The answers will shape which roadmap phases to prioritize and how to implement them.

### 9.1 Billing Unit

> **Should customers be billed on total tokens, model-weighted tokens, or dollar cost?**

| Option | Simplicity | Fairness | Implementation Required |
|---|---|---|---|
| Total tokens (flat rate) | Simplest | Least fair (Opus = Haiku) | Phase 1 only |
| Model-weighted tokens | Moderate | Fair across models | Phase 1 + pricing config |
| Dollar cost pass-through | Complex | Most fair | Phase 1 + Phase 2 |

### 9.2 Cache Token Pass-Through

> **Should customers benefit from Anthropic's cache read discount (10% of base price)?**

If yes: Customers pay less for runs with high cache utilization (most runs). Requires Phase 4 for separate columns. Current flat-rate approach charges ~2.2x Anthropic's actual cost.
If no: Simpler pricing; platform keeps the cache margin (~55% of Anthropic's actual cost comes from cache savings). Works with Phase 1 alone.

### 9.3 Billing Period

> **Weekly, monthly, per-ticket, or custom billing periods?**

The existing `admin-token-usage-service.ts` already supports arbitrary date-range filtering via `startDate`/`endDate` parameters (lines 39-42). Per-ticket attribution also exists (`ticket-service.ts` lines 1600-1610). Any billing period is technically feasible with the current infrastructure.

### 9.4 Historical Data

> **How should pre-fix runs be handled for billing?**

Pre-fix runs have 95-99% undercounted input tokens. The original values were never persisted and cannot be recovered. Options:
- **Clean cutover**: Only bill post-fix runs. Most fair. Requires a date flag in billing logic.
- **Include all**: Accept that historical billing is inaccurate. Favors customers (massive undercharge).
- **Correction factor**: Apply an estimated multiplier (93x-309x per org, based on production data). Approximate but contentious.

**Recommendation**: Clean cutover is the fairest and simplest approach.

### 9.5 Model Choice and Cost

> **Should customers pay different rates based on which model their workflows use?**

Currently, 43.9% of succeeded runs use Opus ($5/$25 per MTok) and 33.8% use Haiku ($1/$5 per MTok). A flat rate per token would average out the 5x cost difference, potentially subsidizing Opus users at Haiku users' expense. The `modelUsed` field is already tracked on 77.7% of succeeded runs.

### 9.6 Customer Communication

> **When and how should the pricing model be communicated?**

Transparent billing requires proactive communication: rate card, methodology explanation, advance notice of billing start date, and a grace period for customers to review their usage patterns before charges begin. The fix deployment is a natural communication milestone ("we've improved our usage tracking accuracy").

---

## 10. Appendix: Data Sources and Methodology

### 10.1 Summary of Original RSH-456 Research Findings

The original RSH-456 research established:

- **Root cause (RC-1)**: `execute-workflow-step.mjs` captures only `input_tokens`, ignoring `cache_creation_input_tokens` and `cache_read_input_tokens`. Zero references to cache token fields in the entire `sandbox-runtime-assets/` directory.
- **Root cause (RC-2)**: Line 1724 uses `=` (assignment) instead of `+=` (accumulation), overwriting per-turn accumulated values with the SDK result's base-only count. Combined with three competing DB write paths in `run-store.ts`, this causes the "going lower" symptom.
- **Impact**: 95-99% of input tokens uncaptured. 99.4% of runs with token data show inverted output-to-input ratios.
- **Fix specification**: Add two cache fields at two code locations (lines 1698-1699 and 1724-1725) in `execute-workflow-step.mjs`. No schema migration, no downstream changes, no new dependencies.
- **SDK documentation**: Claude Agent SDK `Usage` type confirms `cache_creation_input_tokens` and `cache_read_input_tokens` are standard optional fields (documented in `docs/guides/claude-agent-sdk-typescript-ref.md` lines 2298-2303).
- **Architecture decision**: Sum cache tokens into existing `inputTokens` column (not separate columns) -- minimal change surface, maximum impact.
- **Post-fix convergence**: Once both capture paths include cache tokens, the per-turn accumulation and SDK result's cumulative total converge, naturally eliminating the "going lower" symptom.

### 10.2 Runtime Inspection Queries (This Report)

All queries executed May 16, 2026 via `hlx inspect db --repo helix-global-server` (read-only).

| Query | Purpose | Key Result |
|---|---|---|
| Grand totals (COUNT, SUM on SandboxRun) | Updated aggregate statistics | 1,153 runs; 5.11M input / 72.6M output |
| Per-org breakdown (SUM/GROUP BY with Organization JOIN) | Customer-level consumption patterns | 11 orgs; all Claude-using orgs show inverted ratios |
| Per-model breakdown (AVG/GROUP BY on modelUsed, succeeded only) | Model-specific analysis | Opus 16.6:1, Haiku 41.9:1, z-ai/glm-5 0.09:1 (correct) |
| Cost coverage by month (DATE_TRUNC/GROUP BY) | Cost data gap quantification | March 0%, April 13.6%, May 9.2% |
| Recent 8 runs (ORDER BY startedAt DESC) | Active issue confirmation | Ratios 27:1 to 1,084:1; 0/8 have cost data |
| 7-day trend (DATE/GROUP BY, succeeded only) | Fix-not-applied confirmation | All days 28:1 to 80.5:1 |
| Succeeded run averages | Per-run statistics | Avg 4,725 input / 105,515 output; 97.9% no cost |
| Cost gap percentage (CASE WHEN on estimatedCostUsd) | Precise coverage metric | 568 of 580 (97.9%) succeeded runs with token data lack cost |
| Model distribution (all succeeded) | Model usage analysis | 321 Opus, 247 Haiku, 161 null, 2 glm-5 |

### 10.3 Code Files Inspected

| File | Repository | Lines Cited | Purpose |
|---|---|---|---|
| `execute-workflow-step.mjs` | helix-global-server | 1698-1699, 1703, 1724-1725 | SDK token capture (bug location) and `[usage]` log emission |
| `run-store.ts` | helix-global-server | 325-362, 396-490, 496-511 | Three DB write paths: `markRunSucceeded`, `persistStepProgress`, `updateRunUsageBestEffort` |
| `workflow-step-chain.ts` | helix-global-server | 893-906 | Log line parsing and live updates |
| `execute.ts` | helix-global-server | 374-377 | Step result extraction (`typeof parsedResult.inputTokens === "number"` passthrough) |
| `orchestrator.ts` | helix-global-server | 2237-2268 | Final aggregation |
| `ticket-service.ts` | helix-global-server | 1587-1676 | Per-ticket SQL aggregation with model tracking |
| `admin-token-usage-service.ts` | helix-global-server | 35-104 (full file) | Per-org SQL aggregation with date filtering |
| `admin-token-usage-controller.ts` | helix-global-server | 1-13 (full file) | Admin API endpoint |
| `prisma/schema.prisma` | helix-global-server | 394-423 | SandboxRun model schema |
| `dashboard.tsx` | helix-global-client | isDeveloper gates | Dashboard token display |
| `ticket-detail.tsx` | helix-global-client | isDeveloper gates | Ticket token aggregation |
| `run-history.tsx` | helix-global-client | isDeveloper gates | Run history token display |
| `run-detail-modal.tsx` | helix-global-client | isDeveloper gates | Run detail token display |
| `admin-token-usage.tsx` | helix-global-client | Full file | Admin dashboard UI |

### 10.4 External Research

| Source | Purpose | Key Data |
|---|---|---|
| [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) | Current per-token rates | Opus $5/$25, Haiku $1/$5 per MTok |
| [Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) | Cache token pricing multipliers | 1.25x write (5-min), 2x write (1-hr), 0.1x read |
| [Claude API Pricing Breakdown](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration) | Cache economics analysis | Cache read = 90% discount; break-even after 1 read (5-min) |
| [Anthropic API Pricing Guide](https://www.finout.io/blog/anthropic-api-pricing) | Batch processing and caching economics | 50% batch discount; caching pays for itself quickly |

### 10.5 Prior Research Referenced

| Report | Date | Key Finding |
|---|---|---|
| RSH-456 (original) | May 14, 2026 | Root cause analysis; 95-99% input undercount; fix specification |
| RSH-431 | May 12, 2026 | Token pipeline coverage: 97% of runs have data, but values are wrong |

### 10.6 Data Freshness

All production data in this report was queried on **May 16, 2026**. Token statistics reflect the state of the production database at that time. Anthropic pricing data was researched on May 16, 2026 and reflects published rates as of that date. The production database shows 1,153 total runs (up from 1,113 on May 14), confirming active ongoing usage.

---

*Report generated May 16, 2026. Data sourced from production database runtime queries (read-only), source code inspection of helix-global-server and helix-global-client repositories, and published Anthropic API pricing. No customer PII is included. This report extends the original RSH-456 token accuracy research with usage-based pricing readiness analysis, addressing the three dimensions explicitly requested: accuracy, fairness, and transparency.*

## Attachments
- (none)

# Ticket Context

- ticket_id: cmp8xp13800r3ks0uhwo2vmnd
- short_id: FIX-477
- run_id: cmp8xp13p00r8ks0uk9km3r9o
- run_branch: helix/fix/FIX-477-token-usage-accuracy
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Token usage accuracy

## Description
Build ticket to implement research from RSH-476.

## Research Report

# Build Ticket: Fix Token Usage Accuracy -- Add Cache Token Fields to Input Token Capture

## 1. Title and Summary

**Fix input token capture to include cache tokens at two locations in `execute-workflow-step.mjs`.**

The platform's input token metering undercounts by 95-99% for all Claude model runs because the SDK capture code records only base `input_tokens` while ignoring `cache_creation_input_tokens` and `cache_read_input_tokens`. The fix adds these two cache token fields at exactly two code locations in a single file (`sandbox-runtime-assets/workflow-steps/execute-workflow-step.mjs`, lines 1698 and 1724). No schema migration, no downstream changes, and no new dependencies are required. All 10 downstream consumers are integer passthroughs that automatically reflect corrected values.

**Scope**: 1 file, 2 code locations, ~4 lines of new code.
**Risk**: Low.
**Expected impact**: Input token counts increase from ~2K-5K to ~1M-3M per run, establishing the measurement foundation for all future usage reporting and billing.

---

## 2. Problem Statement

### What is happening

Stored input token counts for Claude model runs are undercounted by 95-99%, producing inverted output-to-input ratios. In normal multi-turn Claude conversations with prompt caching, input tokens should be 5x to 20x *higher* than output tokens. Instead, the platform records output tokens as 27x to 1,084x higher than input tokens -- exactly backwards.

### Production evidence (queried May 16, 2026)

| Metric | Value |
|--------|-------|
| Total runs (all time) | 1,159 |
| Runs with input token data | 778 (67.1%) |
| Grand total stored input tokens | **5,116,439** |
| Grand total stored output tokens | **73,223,027** |
| Overall output-to-input ratio | **14.3:1** (inverted from expected) |
| Succeeded runs with input data | 586 |
| Average stored input per succeeded run | **4,699** |
| Average stored output per succeeded run | **105,908** |
| Runs with cost data (> $0) | 108 (9.3% of all runs) |

### Most recent succeeded runs (May 16, 2026, from runtime inspection)

| Stored Input | Stored Output | Output:Input Ratio | Model | Has Cost? |
|---:|---:|---:|---|---|
| 70 | 20,739 | **296:1** | claude-haiku-4-5 | No |
| 4,907 | 127,384 | 26:1 | claude-haiku-4-5 | No |
| 4,262 | 197,038 | 46:1 | claude-haiku-4-5 | No |
| 2,310 | 185,267 | 80:1 | claude-haiku-4-5 | No |
| 322 | 182,553 | **567:1** | claude-haiku-4-5 | No |
| 980 | 150,332 | 153:1 | claude-haiku-4-5 | No |
| 820 | 112,985 | 138:1 | claude-haiku-4-5 | No |
| 2,090 | 136,190 | 65:1 | claude-haiku-4-5 | No |

All 8 most recent runs show inverted ratios (26:1 to 567:1). Zero have cost data. The issue is actively ongoing and worsening with cache-heavy workflows.

### Business impact

- **Usage reporting is meaningless**: Admin dashboards show dramatically wrong consumption data.
- **Future billing is impossible**: Any usage-based pricing built on current data would undercharge by 20x-1,000x.
- **Cost analysis is blind**: 97.9% of succeeded runs with token data lack cost data, partly because input volume is wrong.
- **Every customer is affected**: All 11 organizations with token data show the same inverted pattern.

### Control observation

The z-ai/glm-5 model (which does not use prompt caching) shows the correct ratio: input tokens *higher* than output (0.09:1). Only Claude models with prompt caching exhibit the inverted pattern, confirming cache token omission as the sole root cause.

---

## 3. Root Cause Analysis

### Single root cause: cache token fields are not captured

The SDK capture code in `execute-workflow-step.mjs` records only the base `input_tokens` field from Claude Agent SDK Usage objects. It completely ignores two additional fields that account for ~95-99% of input token volume in cached conversations:

- `cache_creation_input_tokens` -- tokens used to create new cache entries
- `cache_read_input_tokens` -- tokens read from existing cache (the vast majority in multi-turn conversations)

Since the Claude Agent SDK uses prompt caching extensively, nearly all input token consumption flows through cache operations and is silently lost.

### Bug Location 1: Per-turn accumulation (line 1698)

**File**: `sandbox-runtime-assets/workflow-steps/execute-workflow-step.mjs`
**Line**: 1698

```javascript
// CURRENT (buggy): only captures base input_tokens
resultInputTokens = (resultInputTokens ?? 0) + (typeof u.input_tokens === "number" ? u.input_tokens : 0);
```

This line fires for each `assistant` message during execution. It accumulates token counts across turns using `+=`, but only adds the base `input_tokens` field. Cache token fields are ignored.

### Bug Location 2: SDK result overwrite (line 1724)

**File**: `sandbox-runtime-assets/workflow-steps/execute-workflow-step.mjs`
**Line**: 1724

```javascript
// CURRENT (buggy): only captures base input_tokens
resultInputTokens = typeof message.usage.input_tokens === "number" ? message.usage.input_tokens : null;
```

This line fires once when the SDK produces a final `result` message. It uses `=` (assignment, not `+=` accumulation) because the SDK result provides a cumulative total. But it still only reads the base `input_tokens`, ignoring cache fields.

### Why this causes the "values going lower" symptom

The per-turn path (line 1698) accumulates small base `input_tokens` values across many turns. The SDK result path (line 1724) then *overwrites* that accumulated value with just the result's base `input_tokens` -- a single, lower number. After the fix, both paths include cache tokens and produce convergent values, naturally eliminating this symptom.

### SDK type confirmation

The Claude Agent SDK `Usage` type (documented at `docs/guides/claude-agent-sdk-typescript-ref.md` lines 2298-2303) confirms both fields are standard optional properties:

```typescript
type Usage = {
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens?: number | null;  // tokens for creating cache entries
  cache_read_input_tokens?: number | null;       // tokens read from cache
};
```

### Codebase confirmation

A grep of the entire `sandbox-runtime-assets/` directory confirms **zero references** to `cache_creation_input_tokens` or `cache_read_input_tokens`. The fields have never been captured.

---

## 4. Fix Specification

### Architecture decision

**Chosen approach**: Add cache fields to the existing two capture points (Option A).

**Rejected alternatives**:
- **Option B (modelUsage-based)**: `modelUsage` is only available in SDK result messages (not per-turn), would require structural code changes, and uses different field naming (camelCase vs. snake_case).
- **Option C (separate DB columns)**: Requires Prisma schema migration and pipeline-wide changes across 8+ files. This is Phase 4 scope, not needed for Phase 1 accuracy.

### Fix at Location 1: Per-turn accumulation (line 1698)

```javascript
// FIXED: add cache token fields to per-turn accumulation
resultInputTokens = (resultInputTokens ?? 0)
  + (typeof u.input_tokens === "number" ? u.input_tokens : 0)
  + (typeof u.cache_creation_input_tokens === "number" ? u.cache_creation_input_tokens : 0)
  + (typeof u.cache_read_input_tokens === "number" ? u.cache_read_input_tokens : 0);
```

### Fix at Location 2: SDK result capture (line 1724)

```javascript
// FIXED: add cache token fields to SDK result capture
resultInputTokens = (typeof message.usage.input_tokens === "number" ? message.usage.input_tokens : 0)
  + (typeof message.usage.cache_creation_input_tokens === "number" ? message.usage.cache_creation_input_tokens : 0)
  + (typeof message.usage.cache_read_input_tokens === "number" ? message.usage.cache_read_input_tokens : 0);
```

> **Note**: The `=` operator (assignment, not `+=`) is kept intentionally at Location 2. The SDK result provides a cumulative total, so assignment is correct for this path.

> **Note**: The null return for Location 2 changes from `null` to `0` when all fields are absent. This is consistent with the per-turn path behavior and ensures the variable always holds a number after a result message is processed.

### Key code pattern decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Null safety pattern | `typeof === "number" ? value : 0` | Matches existing pattern for `input_tokens`; handles undefined, null, and NaN |
| Operator at line 1724 | Keep `=` (assignment) | SDK result provides cumulative total; `=` is intentional |
| Storage column | Sum into existing `inputTokens` | No schema migration; Phase 4 can add granular columns later |
| Downstream changes | None | All 10 consumers are integer passthroughs |

---

## 5. Downstream Impact Analysis

All 10 downstream consumers of `inputTokens` have been verified as integer passthroughs. **No changes are needed anywhere except the source capture file.**

| # | Consumer | File | Lines | Behavior | Change Needed? |
|---|---------|------|-------|----------|----------------|
| 1 | Log emission | `execute-workflow-step.mjs` | 1703 | Template literal `${resultInputTokens ?? 0}` -- emits `[usage] input_tokens=NNN` | No |
| 2 | Per-turn live updates (log parsing) | `workflow-step-chain.ts` | 895 | Regex `/input_tokens=(\d+)/` captures any non-negative integer | No |
| 3 | Live DB update | `run-store.ts` | 496-511 | `updateRunUsageBestEffort` -- fire-and-forget write of integer to DB | No |
| 4 | Step result extraction | `execute.ts` | 374-377 | `typeof parsedResult.inputTokens === "number"` passthrough | No |
| 5 | Step persistence | `run-store.ts` | 396-490 | `persistStepProgress` -- sums completed steps' `inputTokens` with `+=` | No |
| 6 | Final aggregation | `orchestrator.ts` | 2253-2285 | `Math.max(0, Math.floor(...))` on each step; sums across steps | No |
| 7 | Run completion | `run-store.ts` | 325-362 | `markRunSucceeded` -- writes integer to `SandboxRun` | No |
| 8 | Per-ticket SQL SUM | `ticket-service.ts` | 1632-1642 | `SUM("inputTokens")` on corrected per-run values | No |
| 9 | Per-org SQL SUM | `admin-token-usage-service.ts` | 54-68 | `SUM("inputTokens")` with org JOIN | No |
| 10 | Client displays | `dashboard.tsx`, `run-history.tsx`, `run-detail-modal.tsx` | Various | Render via `toLocaleString()` -- formats any integer | No |

---

## 6. Success Criteria

| Criterion | How to Measure | Target |
|-----------|---------------|--------|
| **Correct token ratios** | Input-to-output ratio on new Claude model runs | 5:1 to 20:1 (input higher than output) |
| **Value magnitude** | Input token count for a typical multi-turn run | ~1M-3M input tokens per run (vs. current ~2K-5K) |
| **Extreme case validation** | A run currently showing 315 input / 341,581 output | Should post-fix show ~1.7M-3.4M input / 341,581 output |
| **No downstream breakage** | All 10 downstream consumers function correctly | Zero errors with larger values |
| **Non-Claude model safety** | z-ai/glm-5 and other non-cached models | Ratios unchanged; null cache fields handled as 0 |
| **Build gates pass** | `npm run build`, `npm run typecheck`, `npm run lint` | All pass |
| **"Values going lower" resolved** | Run-level token display no longer shows decreasing input counts | Input values stable or increasing throughout run |

### Post-deployment validation

After deploying the fix, run the following query against production to confirm corrected ratios:

```sql
SELECT "inputTokens", "outputTokens",
       ROUND(CAST("inputTokens" AS DECIMAL) / NULLIF("outputTokens", 0), 1) as input_to_output_ratio,
       "modelUsed"
FROM "SandboxRun"
WHERE status = 'SUCCEEDED'
  AND "inputTokens" IS NOT NULL
  AND "startedAt" > '<deployment_timestamp>'
ORDER BY "startedAt" DESC
LIMIT 10;
```

Expected: `input_to_output_ratio` between 5.0 and 20.0 for Claude models.

---

## 7. Build and Quality Gates

### Commands

| Command | Purpose | Expected Result |
|---------|---------|-----------------|
| `npm run build` | TypeScript compilation + Prisma migrations | Pass (`.mjs` fix file is not compiled by `tsc`) |
| `npm run typecheck` | `tsc --noEmit` | Pass (`.mjs` file not type-checked) |
| `npm run lint` | `eslint .` | Pass |

### Important notes

- The fix file (`execute-workflow-step.mjs`) is plain JavaScript under `sandbox-runtime-assets/`. It is **NOT** processed by the TypeScript compiler (`tsc` compiles `src/` only).
- **No existing tests cover token capture in this file.** The only test file in `sandbox-runtime-assets/` is `suitecloud-command-blocker.test.mjs`, which is unrelated.
- No CI workflow files (`.github/workflows/`) exist in the repository.
- Validation relies on post-deployment production observation (input-to-output ratio verification per Section 6).

---

## 8. Risks and Mitigations

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|-----------|
| Cache fields absent at runtime on some SDK versions or message types | Low | Low | `typeof === "number"` guards default to 0. Field absence is handled identically to the existing `input_tokens` pattern. SDK type docs and Context7 confirm fields are standard. |
| Int32 overflow for per-run values | Very Low | Very Low | Max per-run estimate ~3.4M vs. Prisma Int max ~2.1B. Would require a 630x increase to overflow. |
| Per-ticket SQL SUM overflow for large customers | Very Low | Very Low | PostgreSQL `SUM(Int)` returns BigInt. Even 10,000 runs x 3M tokens = 30B is handled. |
| No existing test coverage for token capture | Medium | N/A | No test files exist for `execute-workflow-step.mjs`. Validation relies on post-deployment production observation. Consider adding unit tests as a follow-up. |
| Pre-fix historical data permanently undercounted | Known | Certain | ~1,159 existing runs retain 95-99% undercounted values. Cannot be retroactively corrected. Recommend clean cutover for any future billing. |
| SDK result `message.usage` may not contain cache fields for some message types | Low | Low | The `typeof === "number"` guard handles this identically to absent `input_tokens` -- defaults to 0. No runtime error possible. |
| `totalCostUsd` omission in execute.ts SUCCEEDED path (secondary bug) | Noted | Confirmed | Lines 452-475 omit `totalCostUsd` while UNVERIFIED and FAILED paths include it. This contributes to 97.9% null cost data. Outside Phase 1 scope; noted for Phase 2. |

---

## 9. Technical Decisions

Four key technical decisions were made during research and confirmed in tech research:

### Decision 1: Keep `=` (assignment) at line 1724

The `=` operator at the SDK result capture point is intentional. The SDK result message provides cumulative totals across all turns. Assignment captures the SDK's authoritative final count. The per-turn path (line 1698) already accumulates incrementally with `+=`. After the fix, both paths produce consistent values since both include cache tokens.

### Decision 2: Sum cache tokens into existing `inputTokens` column

No new database columns are created. Cache token values are summed into the single existing `inputTokens` field. This avoids a Prisma schema migration and pipeline-wide changes across 8+ files. Separate columns for cache token types are Phase 4 scope, needed only if differential pricing by token type is implemented.

### Decision 3: Use consistent `typeof === "number"` null-safety pattern

All cache field guards use the same `typeof === "number" ? value : 0` pattern already used for `input_tokens`. This handles `undefined` (field absent), `null` (explicitly nullable per SDK type), and `NaN`. It maintains code consistency with the existing capture logic.

### Decision 4: No downstream changes required

All 10 downstream consumers are verified integer passthroughs. They receive whatever integer value is stored at the source and pass it through without transformation, range validation, or type conversion. Correcting the source value automatically corrects every downstream display and aggregation.

---

## 10. Out-of-Scope

The following items are explicitly excluded from this ticket. They are tracked in the 4-phase pricing readiness roadmap.

| Feature | Why Out of Scope | Future Phase |
|---------|-----------------|--------------|
| Server-side cost computation | Requires pricing config + computation logic; separate effort | Phase 2 |
| Customer-facing usage visibility | Requires new API endpoint + UI + removing `isDeveloper` gates (52 occurrences / 11 client files) | Phase 3 |
| Separate cache token DB columns | Requires Prisma schema migration + pipeline changes across 8+ files | Phase 4 |
| Differential cache token pricing | Requires granular columns (Phase 4) and business pricing decisions | Phase 4 |
| Historical data correction | Pre-fix runs cannot be accurately reconstructed; clean cutover recommended | Business decision |
| Model-aware billing | Requires pricing table and cost computation infrastructure | Phase 2 |
| Usage export (CSV/PDF) | Requires customer-scoped API first | Phase 3 |
| `totalCostUsd` omission fix in execute.ts | Secondary bug contributing to 97.9% null cost data; separate fix scope | Phase 2 |

---

## 11. Roadmap Context

This ticket is **Phase 1** of a 4-phase roadmap to full usage-based pricing readiness. The fix establishes the measurement foundation that all subsequent phases depend on.

### Phase 1: Fix Token Accuracy (This Ticket)
- **Scope**: 1 file, 2 code locations
- **Unlocks**: Accurate per-run, per-ticket, and per-org token metering
- **Effort**: Small | **Risk**: Low | **Dependencies**: None

### Phase 2: Server-Side Cost Computation (Next Priority)
- **Scope**: Pricing configuration (model -> per-token rates) + computation logic in pipeline
- **Unlocks**: Dollar-value billing; `estimatedCostUsd` coverage from ~2.1% to ~100% for new runs
- **Effort**: Medium | **Dependencies**: Phase 1

### Phase 3: Customer-Facing Transparency
- **Scope**: Customer-scoped API endpoint + customer usage UI page + selectively removing `isDeveloper` gates
- **Unlocks**: Customers can see their own consumption; enables transparent billing
- **Effort**: Medium | **Dependencies**: Phase 1, Phase 2 (for cost display)

### Phase 4: Granular Analytics and Differential Pricing
- **Scope**: Prisma schema migration (add `cacheCreationInputTokens Int?`, `cacheReadInputTokens Int?`) + pipeline-wide changes across 8+ files
- **Unlocks**: Differential pricing by token type; cache utilization analytics; most accurate cost pass-through
- **Effort**: Medium-Large | **Dependencies**: Phase 1

### Total estimated effort to full pricing readiness
1 Small + 2 Medium + 1 Medium-Large = approximately 4-6 tickets beyond this fix.

---

## 12. Open Questions for Business

These questions require business input and cannot be answered by technical analysis. The answers shape which roadmap phases to prioritize.

### 12.1 Billing Unit

> **Should customers be billed on total tokens, model-weighted tokens, or dollar cost?**

| Option | Simplicity | Fairness | Required Phases |
|--------|-----------|---------|-----------------|
| Total tokens (flat rate) | Simplest | Least fair (Opus = Haiku) | Phase 1 only |
| Model-weighted tokens | Moderate | Fair across models | Phase 1 + pricing config |
| Dollar cost pass-through | Complex | Most fair | Phase 1 + Phase 2 |

**Recommendation**: Start with model-weighted tokens (balances fairness and simplicity), evolve to dollar cost pass-through.

### 12.2 Cache Token Pass-Through

> **Should customers benefit from Anthropic's cache read discount (10% of base price)?**

Current flat-rate approach charges ~2.2x Anthropic's actual cost per run. Passing through the cache discount requires Phase 4 (separate cache token columns).

### 12.3 Billing Period

> **Weekly, monthly, per-ticket, or custom billing periods?**

The existing infrastructure supports arbitrary date-range filtering via `startDate`/`endDate` parameters. Per-ticket attribution also exists. Any billing period is technically feasible.

### 12.4 Historical Data

> **How should pre-fix runs be handled for billing?**

Pre-fix runs have 95-99% undercounted input tokens. Original values were never persisted and cannot be recovered. **Recommendation**: Clean cutover date coinciding with fix deployment. Bill usage-based pricing only on post-fix runs.

### 12.5 Model Pricing

> **Should customers pay different rates for Opus vs. Haiku?**

Opus costs Anthropic 5x more than Haiku per token. Currently 43.9% of succeeded runs use Opus, 33.8% use Haiku. A flat rate would average out this 5x cost difference. The `modelUsed` field is tracked on 77.7% of succeeded runs.

---

## 13. Production Evidence Appendix

All production data queried via read-only runtime inspection on **May 16, 2026**.

### 13.1 Grand Totals

| Metric | Value |
|--------|-------|
| Total runs (all time) | 1,159 |
| Runs with input token data | 778 (67.1%) |
| Grand total stored input tokens | 5,116,439 |
| Grand total stored output tokens | 73,223,027 |
| Overall output-to-input ratio | 14.3:1 (inverted) |
| Runs with cost data (> $0) | 108 (9.3%) |

*Source: Runtime inspection query, May 16, 2026*

### 13.2 Succeeded Run Statistics

| Metric | Value |
|--------|-------|
| Total succeeded runs with input data | 586 |
| Average stored input per run | 4,699 |
| Average stored output per run | 105,908 |
| Succeeded runs with cost data | 12 (2.0%) |

*Source: Runtime inspection query, May 16, 2026*

### 13.3 Per-Organization Token Breakdown

| Organization | Total Runs | With Tokens | Stored Input | Stored Output | Estimated True Input | Undercount Factor |
|---|---:|---:|---:|---:|---:|---:|
| Project X Innovation | 1,056 | 706 | 4,893,171 | 68,372,335 | ~683M | ~140x |
| Dealmed | 18 | 18 | 117,382 | 1,085,819 | ~10.9M | ~93x |
| EKB | 33 | 17 | 48,255 | 986,550 | ~9.9M | ~204x |
| The Breadery | 14 | 12 | 32,578 | 1,007,681 | ~10.1M | ~309x |
| Finesse Contracts | 5 | 3 | 9,404 | 284,841 | ~2.8M | ~303x |
| Motty Inc | 3 | 2 | 4,269 | 180,074 | ~1.8M | ~422x |

*Source: Research Report Section 3.3, runtime inspection May 16, 2026. Estimated true input based on ~10x output (conservative multiplier for cache-heavy workflows).*

### 13.4 Per-Model Breakdown (Succeeded Runs)

| Model | Runs | Avg Input | Avg Output | Output:Input | Runs w/ Cost |
|---|---:|---:|---:|---:|---:|
| claude-opus-4-6 | 321 | 6,171 | 102,170 | 16.6:1 | 7 (2.2%) |
| claude-haiku-4-5-20251001 | 247 | 2,614 | 109,508 | 41.9:1 | 5 (2.0%) |
| (null/unknown) | 10 | 1,955 | 134,559 | 68.8:1 | 0 |
| z-ai/glm-5 | 2 | 47,273 | 4,078 | **0.09:1 (correct)** | 0 |

*Source: Research Report Section 3.4. The z-ai/glm-5 control model (no caching) shows the correct ratio.*

### 13.5 Seven-Day Trend (May 9-16, 2026)

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

*Source: Research Report Section 3.7*

### 13.6 Anthropic Token Pricing (for roadmap context)

| Token Type | Claude Opus 4 ($/MTok) | Claude Haiku 4.5 ($/MTok) |
|---|---:|---:|
| Base input tokens | $5.00 | $1.00 |
| Cache write tokens (5-min TTL) | $6.25 | $1.25 |
| Cache read tokens | $0.50 | $0.10 |
| Output tokens | $25.00 | $5.00 |

*Source: Anthropic API Pricing (platform.claude.com), researched May 16, 2026*

---

## 14. Data Sources

| Source | Type | What It Provided |
|--------|------|-----------------|
| Runtime inspection (May 16, 2026) | Production database queries (read-only) | Grand totals (1,159 runs, 5.1M input, 73.2M output), most recent runs (296:1 ratio), succeeded run averages |
| RSH-476 Research Report | Research analysis embedded in ticket.md | Root cause analysis, 4-phase roadmap, per-org breakdown, per-model breakdown, 7-day trend, fairness/transparency analysis, Anthropic pricing |
| RSH-456 Original Research | Prior research ticket | Original root cause identification, fix specification, pipeline architecture analysis |
| RSH-431 Research | Prior research ticket | Token pipeline coverage analysis (97% of runs have data, but values wrong) |
| Diagnosis statement (helix-global-server) | Workflow artifact | Root cause confirmation, runtime evidence (most recent run 296:1), success criteria, downstream consumer verification |
| Product specification (helix-global-server) | Workflow artifact | MVP scope definition, out-of-scope items, success criteria with measurable targets, key design principles |
| Tech research (helix-global-server) | Workflow artifact | Architecture decision (Option A chosen), SDK type verification via Context7, code pattern specification, 4 technical decisions, performance expectations, risk assessment |
| Scout reference map (helix-global-server) | Workflow artifact | Detailed file mapping with exact line numbers, 10 downstream consumers verified, 5 technical unknowns, build/quality gate identification |
| `execute-workflow-step.mjs` (direct inspection) | Source code | Confirmed bug locations at lines 1698 and 1724; zero cache field references in entire `sandbox-runtime-assets/` directory |
| `claude-agent-sdk-typescript-ref.md` lines 2298-2303 | SDK documentation | Usage type confirms `cache_creation_input_tokens` and `cache_read_input_tokens` as standard optional fields |
| Context7 Claude Agent SDK docs | External documentation | Confirmed Usage type includes cache fields; CacheUsage interface documents complete cache token tracking surface |
| Anthropic API Pricing page | External reference | Current per-token rates for Opus and Haiku models, cache token pricing differentials |

---

*Report generated May 16, 2026. This build ticket is based on production database runtime queries (read-only), source code inspection of helix-global-server, published Anthropic API pricing, and workflow artifacts from RSH-476 research, diagnosis, product, and tech-research phases. No customer PII is included.*

## Attachments
- (none)

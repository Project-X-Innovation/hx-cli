# Ticket Context

- ticket_id: cmp3fj4z500c9ly0utnotstgj
- short_id: FIX-441
- run_id: cmp3fj4zl00cely0udb4mqh4t
- run_branch: helix/fix/FIX-441-implement-library-system-architecture-checkup
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Implement: Library System Architecture Checkup

## Description
Let's go ahead and implement this. I would say two caveats:

1. Yes you are correct that the library repo should be provisioned for all organizations from the start. However for backwards compatibility let us keep the current system of provisioning the first time they run a library report so that existing organizations will not break, you can put a comment. You should always put a comment in these situations that this code is only because of backwards compatibility. 

2. Similarly if you are going to leave in the code for the backwards compatibility with the existing report branch naming and file naming convention, please make it very clear in comments in the code that this is the case and that this code is not being used for future reports and is only for backwards compatibility.

## Research Report

# Library System Architecture Checkup

This report examines the library system architecture in Helix and identifies a fundamental misalignment between the intended design and the current implementation. The core finding: **"ambient" was implemented to mean "read-only shallow clone excluded from the pipeline" when it should mean "always present in every ticket, every sandbox, every run -- writable for its purpose."** The fix is straightforward: treat RESEARCH like BUILD, with the library as the primary repo. Same pipeline, different target.

This report is structured in the order the ticket owner requested: the ambient correction first, the side-by-side comparison second, then root cause analysis and recommendations.

---

**Table of Contents**

- [Part I: Correcting the Ambient Misunderstanding](#part-i-correcting-the-ambient-misunderstanding)
- [Part II: Side-by-Side -- How Code Works vs How Reports Should Work](#part-ii-side-by-side----how-code-works-vs-how-reports-should-work)
- [Part III: Root Cause Analysis](#part-iii-root-cause-analysis)
- [Part IV: Recommendations](#part-iv-recommendations)
- [Appendix](#appendix)

---

## Part I: Correcting the Ambient Misunderstanding

The implementation got "ambient" wrong. This is not a minor naming issue -- it is the single decision from which every other problem in the library system flows. The code treats `isAmbient: true` as a signal to **exclude** the library from the writable pipeline. That is the opposite of what ambient is supposed to mean.

### What "Ambient" Currently Means in Code (Wrong)

The codebase interprets ambient as: read-only, shallow, conditional, invisible to agents, and excluded from the normal pipeline that branches, scaffolds, commits, and pushes code.

| # | Aspect | Current Behavior | Code Reference |
|---|--------|-----------------|----------------|
| 1 | **Presence** | Conditional -- only injected if the org already has `libraryRepoUrl` configured. New orgs get no library in the sandbox. | `repositories.ts:316` -- `if (libraryRepoUrl && libraryRepoName)` |
| 2 | **Clone depth** | Shallow `--depth 1` clone. Minimal history. | `orchestrator.ts:863` -- `git clone --depth 1` |
| 3 | **Pipeline treatment** | Excluded from `PreparedRunRepo[]`. No branch management, no `.helix/` scaffolding, no commit/push capability. | `orchestrator.ts:714-716` -- `regularRepositories = filter(!isAmbient)` |
| 4 | **Agent visibility** | Not in `repoRunRoots`. Agents cannot see it or write to it. It does not exist in the agent's world. | `workflow-step-chain.ts:875` -- `repoRunRoots: input.repos.map(...)` (regular repos only) |
| 5 | **User selection** | Not in the UI repo picker. Users cannot select it. | *(This part is correct -- keep it.)* |
| 6 | **Failure handling** | Clone failure is a non-fatal warning. If it fails, the run continues without the library. | `orchestrator.ts:866-869` -- `catch` logs warning, no throw |
| 7 | **Creation timing** | Lazily created during the first post-run report capture. Does not exist until the first RESEARCH ticket completes. | `orchestrator.ts:2444` -- `ensureReportRepo()` called inside report capture block |

Every one of these behaviors (except #5) is wrong.

### What "Ambient" Actually Means (Correct)

In the ticket owner's words:

> "Ambient means that it is included always and every time in every sandbox, in every ticket, in every request, every time there's any information being passed around. It is included there. It is not selectable. It's not something the user directly selects or adds to a ticket. It is always there in the ambient space."

> "Ambient does not mean it's not writable. Ambient means that it does not function like any old code repo. It is a repo but it is for the internal use of Helix."

> "The library and reports go hand in hand. The library's only purpose is to be the home for reports."

Ambient means:

- **Always present.** Every ticket. Every sandbox. Every run. Every mode. No conditions. No gates.
- **Not user-selectable.** Users don't see it, don't pick it, don't add it. Helix puts it there automatically.
- **Writable for its purpose.** For RESEARCH tickets, the library is the primary write target -- agents write reports directly to it. For BUILD tickets, it provides read-only context.
- **Helix's internal context repo.** It is the ambient context for all work. The way to add to it is through research. The collection space for research, and therefore helpful for all build tickets.

### How to Fix It in Existing Helix

Six specific changes transform the current wrong implementation into the correct one:

| # | Change | Where | What Changes | Why |
|---|--------|-------|-------------|-----|
| A1 | **Auto-create library repo at org setup** | `report-repo-service.ts:ensureReportRepo` + org onboarding flow | Call `ensureReportRepo()` during org creation, not lazily during first report capture | Library must exist from day one. Ambient means always present. Cannot be always present if it does not exist. |
| A2 | **Remove the conditional injection gate** | `repositories.ts:316` | Remove `if (libraryRepoUrl && libraryRepoName)`. Library is always injected. Keep `ensureReportRepo()` as a safety net if `libraryRepoUrl` is still null. | Unconditional. No gates. The library is always there. |
| A3 | **For RESEARCH: inject library as a regular `PreparedRunRepo`** | `repositories.ts:316-330` + `orchestrator.ts:714-733` | When mode=RESEARCH, push library config with `isAmbient: false` at position 0. It becomes `repos[0]` -- the primary repo. Full pipeline: branching, scaffolding, commit/push. | `primaryRepo = repos[0]` in `common.mjs:146`. Library at index 0 means all downstream code naturally treats it as the primary write target. |
| A4 | **For BUILD/FIX: keep library as context** | Same files | When mode=BUILD/FIX, push library config with `isAmbient: true` at end of configs. Same as current behavior, but unconditional. | Library is always present for context. Agents can read from it. Not a write target during code builds. |
| A5 | **Full clone depth for RESEARCH** | `orchestrator.ts:863` | For RESEARCH runs, library goes through full clone + branch setup (regular repo path). No `--depth 1`. | Reports need library history for context. Shallow clone is insufficient for a primary repo. |
| A6 | **Clone failure = real error for RESEARCH** | `orchestrator.ts:866-869` | For RESEARCH, if library clone fails, fail the run immediately. For BUILD, continue with degraded warning (current behavior). | If the library is the primary repo and cannot be cloned, the run cannot produce its output. |

After these six changes: the library is always there, it is never something a user selects, and for RESEARCH mode it is a full writable repo where the agent writes the report directly -- same as a code repo in BUILD mode.

---

## Part II: Side-by-Side -- How Code Works vs How Reports Should Work

The ticket owner asked for a clear, direct comparison: how BUILD works now, how RESEARCH works now, and how RESEARCH should work. For every divergence, an explanation of why.

### BUILD Flow Today (The Reference)

This is how code tickets work. It is the model that RESEARCH should follow.

```
 1. Ticket created     -> User selects code repos
 2. Sandbox created    -> Fresh Vercel sandbox
 3. Repos cloned       -> Full clone, helix/ticket/{id} branch created
 4. .helix/ scaffolded -> scout/, diagnosis/, product/, etc. directories created
 5. Steps run          -> scout -> diagnosis -> product -> tech-research
                          -> impl-plan -> implementation -> code-review
                          -> verification
 6. Implementation     -> Agent writes CODE to repo working tree
 7. Code committed     -> Agent's changes committed to branch
 8. Code pushed        -> Server pushes branch to GitHub
 9. Auto-PR created    -> PR from helix/ticket/{id} -> staging
10. Preview deployed   -> Vercel preview deployment
11. Status             -> DEPLOYED
```

The key: agents write directly to repos. Standard git operations handle everything downstream. No extraction. No server-side copying. No separate commit API.

### RESEARCH Flow Today (The Problem)

This is what happens now. Notice how steps 7-13 diverge entirely from BUILD.

```
 1. Ticket created     -> User selects CODE repos (library NOT a target)
 2. Sandbox created    -> Fresh Vercel sandbox
 3. Code repos cloned  -> Full clone, branch created
 4. Library cloned     -> Shallow --depth 1 (ambient, read-only)
 5. .helix/ scaffolded -> In CODE repo, NOT library
 6. Steps run          -> scout -> diagnosis -> product -> tech-research
                          -> impl-plan -> implementation -> verification
                          (code-review, preview-config SKIPPED)
 7. Implementation     -> Agent writes REPORT to {code-repo}/.helix/.../report/report.md
                          (NOT to the library -- library is invisible to the agent)
 8. Sanitizer          -> ALL changes in code repo reverted except .helix/ artifacts
 9. Post-run capture   -> Server reads report from code repo's .helix/
10. Server commits     -> GitHub Contents API -> library repo (branch: report/{ticketId})
11. LibraryItem        -> DB record created (DRAFT status)
12. Blob upload        -> Secondary storage for implementFromTicketId
13. Status             -> REPORT_READY
```

The agent writes the report to the wrong place (a code repo's `.helix/` directory). The server then extracts it and commits it to the library via the GitHub Contents API -- a completely separate mechanism from the normal git push flow. This is the "build-then-move" pattern, and it exists because the library was classified as ambient (read-only, excluded from the pipeline).

### RESEARCH Flow After Fix (Unified with BUILD)

This is the target. Notice how steps 1-10 mirror BUILD almost exactly.

```
 1. Ticket created     -> Library AUTO-INJECTED as primary repo
                          (user optionally selects context code repos)
 2. Sandbox created    -> Fresh Vercel sandbox
 3. Library cloned     -> Full clone, helix/ticket/{id} branch (same as BUILD)
 4. Code repos cloned  -> Full clone (for context reading)
 5. .helix/ scaffolded -> In LIBRARY repo (same structure as BUILD)
 6. Steps run          -> scout -> diagnosis -> product -> tech-research
                          -> impl-plan -> implementation -> verification
                          (code-review, preview-config SKIPPED -- same as now)
 7. Implementation     -> Agent writes REPORT directly to library as repo files
                          (reports/{shortId}/report.md -- natural library path)
 8. Report committed   -> Agent's changes committed to branch (same as BUILD)
 9. Report pushed      -> Server pushes branch to GitHub (same as BUILD)
10. Auto-PR created    -> PR from helix/ticket/{id} -> main on library
11. LibraryItem        -> DB record created from committed content
12. Status             -> REPORT_READY
```

The agent writes directly to the library. Standard commit/push/auto-PR delivers it. The entire post-run extraction path (steps 9-12 in the current flow) disappears.

### Every Divergence, Explained

| # | Phase | BUILD (Code) | RESEARCH Target (Reports) | Aligned? | Why It Diverges (or Doesn't) |
|---|-------|-------------|--------------------------|----------|------------------------------|
| 1 | **Repo selection** | User selects code repos | Library auto-injected; user optionally adds context repos | **Different** | The library is ambient -- not user-selectable. It is always the primary target for RESEARCH. This cannot be aligned because the library is not a user-facing repo. |
| 2 | **Sandbox creation** | Fresh sandbox | Fresh sandbox | **Aligned** | Same mechanism. |
| 3 | **Primary repo clone** | Full clone + branch | Full clone + branch on library | **Aligned** | Same mechanism (`prepareReposForRun`), same branch naming (`helix/ticket/{id}`). Different target repo. |
| 4 | **Additional repos** | All selected repos are writable targets | Code repos are context-only | **Different** | In BUILD, all repos are targets. In RESEARCH, only the library is the target; code repos provide context for the research. Cannot fully align because code repos should not be write-targets during RESEARCH. |
| 5 | **`.helix/` scaffolding** | In all target repos | In library repo | **Aligned** | Same scaffolding, same structure. |
| 6 | **Steps: scout through impl-plan** | Runs all | Runs all | **Aligned** | Same step chain, same execution engine. |
| 7 | **Implementation step** | Agent writes code to repos | Agent writes report to library | **Aligned** | Same mechanism: agent writes files to the primary repo. Different content (code vs. markdown report). The pipeline does not care what the content is. |
| 8 | **Code-review step** | Runs | **Skipped** | **Different** | Reports are prose. There is no linting, type-checking, or build validation to run on a markdown file. Nothing equivalent exists. Cannot align. |
| 9 | **Preview-config step** | Runs | **Skipped** | **Different** | Reports are not deployable applications. No preview URL applies. Cannot align. |
| 10 | **Commit and push** | Standard git push | Standard git push | **Aligned** | Same mechanism. Report committed to library branch, pushed to GitHub. |
| 11 | **Auto-PR** | PR to staging | PR to main | **Aligned** | Same auto-PR mechanism (`createPullRequestOnly`). Base branch differs: library repos don't have a staging branch, so PRs target main. This is a parameter difference, not a mechanism difference. |
| 12 | **Preview deployment** | Vercel preview | **Skipped** | **Different** | Nothing to deploy for a report. Cannot align. |
| 13 | **Terminal status** | DEPLOYED | REPORT_READY | **Different** | Different success semantics. A report is ready to be published, not deployed. This is a naming distinction, not a flow difference. |
| 14 | **Post-run capture** | N/A | **Eliminated** | **Aligned** | The entire build-then-move indirection goes away. Agent writes directly. Standard pipeline delivers. This is the biggest alignment gain. |

**Summary: 10 of 14 phases align exactly.** 4 diverge for justified, irreducible reasons: no code-review for prose, no preview for reports, different terminal status name, and context repos instead of writable targets. None of these 4 can or should be forced into alignment -- they reflect genuine differences between code and prose output.

The answer to "why can't research be more or less the same flow as a build ticket, just in the library repo?" is: **it can and should be.** The 4 divergences are minor and justified. The 10 aligned phases mean RESEARCH reuses the exact same pipeline infrastructure.

---

## Part III: Root Cause Analysis

### The Single Decision That Created the Complexity

The library was classified as "ambient" -- read-only, excluded from the write pipeline -- instead of being treated as a normal writable repo for RESEARCH mode. This one classification decision forced the creation of three workaround mechanisms. Every failure mode in the library system traces back to this decision.

### Mechanism 1: Ambient Injection (`repositories.ts:313-331`)

The library is injected with `isAmbient: true`. At `orchestrator.ts:714-716`, repos are partitioned:

- `regularRepositories` = repos where `!isAmbient` -- these get full PreparedRunRepo treatment (branching, scaffolding, commit/push)
- `ambientRepositories` = repos where `isAmbient` -- these get shallow clone only

The library lands in `ambientRepositories`. It never becomes a `PreparedRunRepo`. No branch is created. No `.helix/` scaffolding happens. No commits are possible. The library is invisible to the agent.

### Mechanism 2: RESEARCH Sanitization (`workflow-step-chain.ts:78-80`)

```typescript
function isNonImplementationStep(stepId, ticketMode) {
  if (ticketMode === "RESEARCH") return true;  // ALL RESEARCH steps sanitized
  return NON_IMPLEMENTATION_STEP_IDS.has(stepId);
}
```

In BUILD mode, only non-implementation steps are sanitized (scout, diagnosis, product, etc. -- their non-`.helix/` writes are reverted). The implementation step is exempt -- its code changes persist.

In RESEARCH mode, **ALL** steps return `true`, including implementation. The sanitizer (`workflow-step-chain.ts:399-483`) reverts all non-`.helix/` writes for every step. Even if the library were somehow available as a writable repo, the agent's report writes would be reverted by the sanitizer.

### Mechanism 3: Server-Side Report Service (`report-repo-service.ts`)

This entire service exists as a workaround. Because agents cannot write to the library during the run, the server must:

1. Read the report from the code repo's `.helix/` directory after the run (`orchestrator.ts:2417-2421`)
2. Ensure the library repo exists (`ensureReportRepo`, lines 52-94)
3. Create a branch and commit the report via GitHub Contents API (`commitReportFile`, lines 102-191)
4. Create a PR and merge it for publishing (`mergeReportBranch`, lines 196-243)

This duplicates what the normal git push/auto-PR flow already does for BUILD tickets. The duplication exists because the normal flow was made unavailable to the library.

### The Cascade

```
Mechanism 1 (ambient = read-only)
    -> Library excluded from PreparedRunRepo
    -> Agent can only write to code repos
    -> Report lands in code repo's .helix/
        -> Requires Mechanism 3 (server-side extraction and commit to library)
        -> Mechanism 2 (sanitize everything) prevents the agent from working around it
```

Remove Mechanism 1 -- make the library a regular repo for RESEARCH -- and Mechanisms 2 and 3 become unnecessary. The agent writes directly, the sanitizer is already configured to exempt implementation steps in BUILD (just extend the same logic to RESEARCH), and the report service's commit/merge methods are no longer needed for new runs.

### The #419 Case Study

#### What Happened

RESEARCH ticket #419 ran through the pipeline. The implementation step wrote a report. Verification returned `UNVERIFIED`. The orchestrator hit the early-exit path for UNVERIFIED outcomes (`orchestrator.ts:1966-2047`) and returned **before reaching the report capture block** (`orchestrator.ts:2403-2506`). Result: `reportDeliverable = null`, no LibraryItem created, report silently lost.

#### Why It Happened (Architecture, Not a Bug)

Two compounding failures, both architectural:

1. **UNVERIFIED bypass**: The orchestrator's UNVERIFIED early-exit path was added for BUILD mode (where an unverified run means the code should not be pushed). But for RESEARCH mode, the report had already been written -- it just needed to be captured. The post-run capture block is positioned after the UNVERIFIED exit, so it never runs.

2. **Competing convention**: The helix-workspace repository contains `strategy/agents.md`, which documents a convention: "Determine the next number, create report-NNN.md." Reports 001-003 already exist in `strategy/`. The #419 agent, exploring the workspace for context, discovered this convention and wrote to `strategy/report-005.md` instead of the expected `.helix/.../report/report.md` path. The sanitizer correctly reverted this write (helix-workspace was not a target repo), but the confusion is symptomatic of the architectural indirection.

#### How the Unified Model Prevents This

Under the unified model:

- **The report is committed during the implementation step** via the standard commit pipeline. Even if verification returns UNVERIFIED, the report is already on the library branch. The UNVERIFIED early-exit does not affect it.
- **No competing convention confusion.** The agent writes to the library at `reports/{shortId}/report.md` -- a natural, unambiguous path. The `strategy/` convention in helix-workspace is never relevant because the agent's primary repo is the library, not a code repo or workspace.
- **The "loosened sanitization" fix becomes unnecessary.** The implementation step for RESEARCH is treated identically to BUILD's implementation step -- the agent's writes persist. No special handling needed.

---

## Part IV: Recommendations

### The Unified Model

RESEARCH = BUILD with the library as the primary repo. Same pipeline, same mechanics, different target. One mental model.

In BUILD, agents write code to code repos. In RESEARCH, agents write reports to the library. The pipeline does not care what the content is. It branches, scaffolds, commits, pushes, and creates PRs. The content -- code or prose -- is irrelevant to the mechanism.

### Options Considered

| Option | Description | Verdict | Rationale |
|--------|------------|---------|-----------|
| **A. Patch individual failure modes** | Fix UNVERIFIED bypass, report-not-found, GitHub API 403 errors -- while keeping the indirect architecture. | **Rejected** | Treats symptoms. Ambient remains wrongly defined. Indirection persists. Future failures will continue in new forms. |
| **B. Dual path with fallback** | Promote library to `PreparedRunRepo` for RESEARCH but maintain `report-repo-service.ts` server-side commit as an alternative. | **Rejected** | Two code paths for the same outcome. Adds complexity instead of removing it. Maintenance burden with no benefit. |
| **C. Unify RESEARCH with BUILD pipeline** | Library becomes the primary repo for RESEARCH. Agent writes directly. Standard commit/push/auto-PR flow delivers the report. Post-run capture path deprecated. | **Chosen** | Directly addresses root cause. Aligns with the stated intent. Removes complexity rather than adding it. One pipeline, one mental model. |

### Implementation Roadmap -- 8 Targeted Changes

All changes are in `helix-global-server`. Client and helix-workspace are unaffected.

| # | Change | File | What Changes | Scope |
|---|--------|------|-------------|-------|
| TD-1 | **Library injection for RESEARCH** | `repositories.ts:316-330` | When mode=RESEARCH, inject library as regular (non-ambient) `RunRepositoryConfig` at position 0. For BUILD/FIX, continue as ambient. Always unconditional (remove the `if` gate). | Core change |
| TD-2 | **Branch naming** | No new code | Use standard `helix/ticket/{id}` branch naming. Reuses `buildTicketRepoBranchName()` unchanged. LibraryItem.branch stores the new format; existing items keep `report/{ticketId}`. | Convention only |
| TD-3 | **Sanitization exemption** | `workflow-step-chain.ts:78-80` | When mode=RESEARCH and stepId=`implementation`, return `false` from `isNonImplementationStep()`. All other RESEARCH steps remain sanitized. | ~3 lines |
| TD-4 | **Agent prompt update** | `implementation/step-config.mjs:17-24` | Change RESEARCH agent prompt: write `reports/{shortId}/report.md` as a real library file, not `.helix/.../report/report.md` in a code repo. | Prompt text |
| TD-5 | **Auto-PR for RESEARCH** | `orchestrator.ts:2238-2240` | Remove the `!isResearchMode` gate on auto-PR creation. For library repos, set base branch to `main` (library repos have no staging branch). | ~5 lines |
| TD-6 | **LibraryItem creation timing** | `orchestrator.ts` + `library-service.ts` | Call `createFromReport()` after standard commit/push succeeds for the library repo. Branch = `helix/ticket/{id}`, filePath = `reports/{shortId}/report.md`. | Reposition call |
| TD-7 | **`implementFromTicketId` compatibility** | `orchestrator.ts:2456-2473` | Keep blob storage upload as secondary storage during transition. After standard commit/push, read report content and upload to blob. `getTicketReportForOrganization()` continues reading from blob. | Backward compat |
| TD-8 | **Library auto-creation at org setup** | `report-repo-service.ts` + org onboarding | Call `ensureReportRepo()` during org creation. Keep it as a safety net in `resolveRunRepositories()` for orgs created before this change. | ~10 lines |

### What Does NOT Change

- **Client UI**: The client has zero concept of ambient repos. It fetches library data via `/library/items` API endpoints. No `isAmbient` flag exists in client types. No changes needed.
- **helix-workspace**: The Helix brand and strategy repo. Not the library. The ticket owner confirmed: "The helix-workspace is just the brand and strategy of Helix itself." No changes.
- **Prisma schema**: `LibraryItem.branch` is `String?` -- it accepts any string format. No migration needed. The branch format changes from `report/{ticketId}` to `helix/ticket/{id}` but the field stores whatever string is written. Existing records keep their old format.
- **Library-service.ts publish flow**: `publishItem()` reads `item.branch` dynamically and passes it to `mergeReportBranch()`. It does not hardcode the branch format. Works with both old and new branch names.
- **BUILD mode pipeline**: All changes are gated on RESEARCH mode. BUILD sanitization, non-implementation rules, auto-PR targeting, and the entire BUILD post-run path are completely unaffected. The library remains ambient (read-only context) for BUILD.
- **Existing LibraryItem records**: Old items with `report/{ticketId}` branches continue to work. The publish flow reads the branch name per-record. No migration of existing data.

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RESEARCH agent writes outside `reports/` in library | Low | Misplaced files in library repo | Agent prompt constrains writes. Sanitizer runs for all other steps. Only implementation exempt. |
| BUILD mode regression | Low | BUILD pipeline breaks | Library is ambient for BUILD (filtered to `ambientRepositories`). Only change for BUILD is unconditional injection -- adding read-only context, not write capability. |
| In-flight RESEARCH tickets during rollout | Medium | Old capture path fails for runs started before deploy | Keep old post-run capture as fallback for runs where library is not in `repos[]`. Phase out after all in-flight runs complete. |
| Org without library repo | Low | `resolveRunRepositories` fails | `ensureReportRepo()` as safety net at injection time. For RESEARCH, fail early. For BUILD, degrade gracefully. |
| Auto-PR targets wrong base branch | Medium | PR targets staging instead of main for library | Explicitly set base branch to `main` for library repos in auto-PR logic. Library repos never have staging. |
| `implementFromTicketId` breaks | Low | BUILD tickets can't access research report content | Blob upload kept as secondary storage during transition. |

### Deferred to Round 2

1. **BUILD tickets writing reports to library**: The ticket owner says this should be possible. Defer until the unified model is proven for RESEARCH.
2. **Removing `report-repo-service.ts` commit/merge methods**: Keep for backward compatibility with existing LibraryItem records that use `report/{ticketId}` branches. Remove once all existing items are published or aged out.
3. **Replacing blob storage with Git reads for `implementFromTicketId`**: Enhancement once direct library access is stable.
4. **Full clone for BUILD ambient**: Currently `--depth 1`. Could increase for better context. Defer to avoid performance risk.
5. **`strategy/agents.md` cleanup in helix-workspace**: Add note clarifying Library system relationship. Not blocking.
6. **Library content indexing for BUILD context**: Making library reports discoverable as structured context during BUILD runs.

---

## Appendix

### A. Production Evidence

Production database inspection (via Helix Inspect) confirms the current system behavior:

| Data Point | Finding | Source |
|-----------|---------|--------|
| Orgs with library repos | 2 orgs have library repos configured (`project-x-innovation-library`, `pharmsource-llc-library_b`) | Organization table |
| RESEARCH ticket outcomes | Recent tickets (RSH-439, RSH-438, RSH-433, RSH-431) all reached REPORT_READY | Ticket table |
| RESEARCH failure rate | ~5 of ~128 RESEARCH tickets failed (~4%) | Ticket table |
| Library as TicketRepository | RESEARCH tickets are associated with CODE repos (helix-global-server, helix-global-client, helix-cli) -- NOT with the library repo. Library is never a TicketRepository. | TicketRepository table |
| Report capture logs | "RESEARCH mode: capturing report deliverable" appears for every RESEARCH run | Production logs |
| Current run step count | 7 steps: scout, diagnosis, product, tech-research, implementation-plan, implementation, verification | Current run (cmp3cdbt600b3ly0um1yw43dv) |

### B. File Reference Map

Key files across all three repos with their roles in the library architecture:

| File | Repo | Role in Library System |
|------|------|----------------------|
| `src/helix-workflow/orchestrator/repositories.ts` | server | Ambient library injection point (line 316). **Change target.** |
| `src/helix-workflow/orchestrator.ts` | server | Central orchestrator: repo partitioning (714), ambient clone (855), report capture (2403-2506), auto-PR gate (2238). **Change target.** |
| `src/helix-workflow/orchestrator/workflow-step-chain.ts` | server | Sanitization logic (78-80), repoRunRoots construction (875). **Change target.** |
| `sandbox-runtime-assets/workflow-steps/implementation/step-config.mjs` | server | RESEARCH agent prompt directing writes. **Change target.** |
| `src/services/report-repo-service.ts` | server | Library repo CRUD via GitHub API. Workaround service. **Retained for backward compat.** |
| `src/services/library-service.ts` | server | LibraryItem DB CRUD, publish flow. **Minor change (creation timing).** |
| `src/services/ticket-service.ts` | server | Ticket creation, report retrieval. **No change initially.** |
| `src/helix-workflow/orchestrator/types.ts` | server | `RunRepositoryConfig.isAmbient`, `PreparedRunRepo` types. **No change (flag usage changes, not type).** |
| `sandbox-runtime-assets/workflow-steps/shared/common.mjs` | server | `primaryRepo = repos[0]`. **No change (works naturally).** |
| `prisma/schema.prisma` | server | Organization library fields, LibraryItem model. **No change.** |
| `src/api/library.ts` (client) | client | React Query hooks for library API. **No change.** |
| `src/pages/library.tsx` (client) | client | Library UI page. **No change.** |
| `strategy/agents.md` (workspace) | workspace | Competing `report-NNN.md` convention. **No change (fix is in agent prompts).** |

### C. Methodology

This report was produced by the RESEARCH mode pipeline (ticket RSH-421). It drew on:

- **Scout artifacts**: Comprehensive architecture mapping across all three repos (helix-global-server, helix-global-client, helix-workspace). 17 files mapped with line-level evidence.
- **Diagnosis artifacts**: Root cause analysis identifying the three cascading mechanisms. Production database evidence via Helix Inspect.
- **Product artifacts**: Unified model design, essential features, scope constraints.
- **Tech-research artifacts**: 8 technical decisions (TD-1 through TD-8) with file targets, options analysis, risk assessment.
- **Direct code inspection**: All code references in this report were verified against the actual source files at the cited line numbers.
- **Production data**: Database queries and log inspection via Helix Inspect runtime tools.

### D. Summary Decision Table

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture approach | Unify RESEARCH with BUILD pipeline (Option C) | Eliminates root cause; one pipeline, one mental model |
| Library injection for RESEARCH | Regular `PreparedRunRepo` at `repos[0]` | Natural primary repo; all downstream code works automatically |
| Library injection for BUILD | Ambient (always present, read-only, unconditional) | Context without write side-effects |
| Branch naming | `helix/ticket/{id}` (standard) | Reuse existing mechanism; no new convention needed |
| Sanitization | Exempt RESEARCH `implementation` step | Report IS the implementation output |
| Auto-PR | Enable for RESEARCH, base=main | Same mechanism as BUILD; library has no staging branch |
| Post-run capture | Deprecated; replaced by standard pipeline | Root cause elimination |
| LibraryItem creation | After standard commit/push succeeds | Reuse existing function with new branch/path parameters |
| Blob storage | Kept as secondary during transition | `implementFromTicketId` backward compatibility |
| Library auto-creation | At org setup + safety net at injection | Ambient means always present -- from day one |
| Client changes | None | API contract unchanged; client is API-agnostic |
| helix-workspace changes | None | Brand/strategy repo, not the library |

## Attachments
- (none)

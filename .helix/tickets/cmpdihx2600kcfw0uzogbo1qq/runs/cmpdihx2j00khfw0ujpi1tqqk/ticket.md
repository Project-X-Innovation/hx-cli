# Ticket Context

- ticket_id: cmpdihx2600kcfw0uzogbo1qq
- short_id: FIX-524
- run_id: cmpdihx2j00khfw0ujpi1tqqk
- run_branch: helix/fix/FIX-524-iterations-on-library-not-working-properly-with
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Iterations on Library not working properly with comments.

## Description
I want to point out two more things that are alluded to but not spoken out in this ticket:

1. The continuation is not necessarily from a published report's comment. In fact most of the time that you do an iteration, it's not necessarily published. If it was, I wouldn't have to do another iteration.

The main continuation context should be the comments on the last draft unless explicitly stated otherwise.

 2. The comments are the main context of the continuation, right? Normally when you do a continuation, you put in some continuation message and that becomes the main context for the continuation, the main steering for the continuation.



In this case the comments, the thumbs up, the thumbs down, and the message and where the message applies. That is the main continuation context. That is the main steering. That should be used as the continuation context. Of course if I also put a continuation context as I can, that is part of it but the continuation context is the comments with the sections and that final piece. That is the continuation context for a second round, for a next round of the library. It doesn't need to be published; it's just the latest version. The comments make up the continuation context.

## Research Report

# Library Comment Iteration Bug: Root Cause Analysis and Recommended Fix

## 1. Executive Summary

When users leave per-section comments on a library report and trigger an iteration, the agent ignores all feedback and generates an entirely new report. The root cause is a data-loss bug in `refreshCommentsForStep` (`orchestrator.ts:1822-1867`), which rebuilds `ticket.md` before every workflow step **without** passing the `libraryComments` parameter to `buildTicketArtifactMarkdown`. This overwrites the correctly-scaffolded `ticket.md` that contained the `## Library Report Feedback` section, so the agent never sees user feedback. The fix is a two-property addition to an existing function call --- passing the `libraryComments` and `referencedTicketsMarkdown` closure variables that are already in scope. A secondary issue excludes reply-thread comments from the context entirely. Both fixes are low-risk, use existing code patterns, and require no schema changes.

## 2. Problem Statement

### User Report

Ticket RSH-523 was filed after observing that the library commenting iteration feature (implemented in RSH-488) does not work as expected. The reporter stated:

> "I made very specific careful comments on this library piece on this report. After putting in very careful attention to every paragraph, the iteration basically just ignored everything I said and just did a new report."

### User Experience

1. A user reads a published library report and leaves per-section ratings and comments (e.g., "this analysis is missing X", "tone down the conclusion").
2. The user clicks **"Continue Iteration"** --- the UI explicitly states: *"All section ratings and comments will be automatically included as context for the agent."*
3. The agent executes the iteration workflow.
4. The resulting report completely ignores the user's feedback and is generated from scratch.

### Impact

- **Trust erosion**: Users lose confidence in the iteration feature after investing time in detailed feedback.
- **Wasted effort**: Per-paragraph comments take significant time to compose; ignoring them negates the value proposition of library iteration.
- **Broken contract**: The client UI makes an explicit promise that is not honored by the server.

## 3. Architecture Overview

### The Library Comment Iteration Pipeline

The library comment iteration system follows a five-stage pipeline:

```
[1] Comment Creation  -->  [2] Comment Fetch  -->  [3] Initial Scaffold  -->  [4] Step Refresh  -->  [5] Agent Execution
    (Client UI)             (Server DB query)       (ticket.md built)        (ticket.md rebuilt)     (Agent reads ticket.md)
```

**Stage 1 --- Comment Creation** (Client):
Users leave per-section ratings and comments via the library UI (`library-continuation-section.tsx`, `section-feedback-toolbar.tsx`, `section-comment-thread.tsx`). Comments are persisted to the `LibraryComment` table via the server API.

**Stage 2 --- Comment Fetch** (Server):
When a continuation/rerun is triggered, the orchestrator fetches library comments from the most recent PUBLISHED `LibraryItem` using `getLibraryCommentsForContinuation()` (`library-comment-service.ts:286-303`). Comments are grouped by anchor (section identifier).

**Stage 3 --- Initial Scaffold** (Server):
`scaffoldRunArtifactsAcrossRepositories()` calls `buildTicketArtifactMarkdown()` (`orchestrator.ts:470-485`) with the `libraryComments` parameter, producing a `ticket.md` that correctly contains a `## Library Report Feedback` section with per-anchor ratings and comment text.

**Stage 4 --- Step Refresh** (Server) --- **BUG IS HERE**:
`beforeStepComposed()` (`orchestrator.ts:1869-1873`) calls `refreshCommentsForStep()` before every workflow step. This function rebuilds `ticket.md` to include fresh discussion comments, but it **omits** the `libraryComments` parameter. The correctly-scaffolded `ticket.md` is overwritten with a version that lacks the `## Library Report Feedback` section.

**Stage 5 --- Agent Execution** (Server):
The agent reads `ticket.md` to understand the task context. Because the feedback section was stripped in Stage 4, the agent sees only the ticket metadata, description, and discussion comments --- not the per-section library feedback.

### Key Functions

| Function | File | Lines | Role |
|----------|------|-------|------|
| `buildTicketArtifactMarkdown()` | `orchestrator.ts` | 310-423 | Pure function that assembles `ticket.md` from structured inputs. Correctly handles `libraryComments` when provided. |
| `scaffoldRunArtifactsAcrossRepositories()` | `orchestrator.ts` | ~435 | Calls `buildTicketArtifactMarkdown()` with all parameters including `libraryComments`. |
| `getLibraryCommentsForContinuation()` | `library-comment-service.ts` | 286-303 | Fetches comments for a published LibraryItem, grouped by anchor. |
| `refreshCommentsForStep()` | `orchestrator.ts` | 1822-1867 | Rebuilds `ticket.md` before each step to include fresh discussion comments. **Does not pass `libraryComments`.** |
| `beforeStepComposed()` | `orchestrator.ts` | 1869-1873 | Hook that runs before every workflow step; calls `refreshCommentsForStep()`. |

## 4. Root Cause Analysis

### The Bug: Missing Parameters in `refreshCommentsForStep`

The root cause is a **parameter omission** in `refreshCommentsForStep()`. Here is the exact code at `orchestrator.ts:1835-1854`:

```typescript
// orchestrator.ts:1835-1854 (THE BUG)
const ticketMarkdown = buildTicketArtifactMarkdown({
  ticketId: run.ticketId,
  shortId: formatShortId(run.ticket.mode, run.ticket.ticketNumber),
  runId: run.id,
  runBranch: repo.runBranch,
  repoKey: repo.repoKey,
  repoUrl: repo.repoUrl,
  title: run.ticket.title,
  description: run.ticket.description,
  researchReportContent,        // <-- correctly passed via closure
  attachments: run.ticket.attachments,
  continuationContext: run.continuationContext,
  comments: freshComments.map((c) => ({
    content: c.content,
    isHelixTagged: c.isHelixTagged,
    isAgentAuthored: c.isAgentAuthored,
    createdAt: c.createdAt,
    authorUser: { name: c.authorUser.name, email: c.authorUser.email },
  })),
  // MISSING: libraryComments          <-- NOT passed
  // MISSING: referencedTicketsMarkdown <-- NOT passed
});
```

Compare this with the initial scaffold call at `orchestrator.ts:470-485`, which **correctly** includes both parameters:

```typescript
// orchestrator.ts:470-485 (CORRECT)
const ticketMarkdown = buildTicketArtifactMarkdown({
  ticketId: input.ticketId,
  shortId: input.shortId,
  runId: input.runId,
  runBranch: input.repo.runBranch,
  repoKey: input.repo.repoKey,
  repoUrl: input.repo.repoUrl,
  title: input.ticketTitle,
  description: input.ticketDescription,
  researchReportContent: input.researchReportContent,
  attachments: input.ticketAttachments ?? [],
  comments: input.ticketComments ?? [],
  libraryComments: input.libraryComments,            // <-- PRESENT
  continuationContext: input.continuationContext,
  referencedTicketsMarkdown: input.referencedTicketsMarkdown, // <-- PRESENT
});
```

### Why This Is a Simple Omission

Both `libraryComments` and `referencedTicketsMarkdown` are **already in closure scope** and accessible from `refreshCommentsForStep`:

- `libraryComments` is declared at `orchestrator.ts:1216` as a `let` variable in the enclosing function.
- `referencedTicketsMarkdown` is declared at `orchestrator.ts:1168` as a `let` variable in the same scope.
- `researchReportContent`, declared at `orchestrator.ts:1199`, follows the identical pattern and **is** correctly passed in `refreshCommentsForStep` (line 1844).

The pattern is already established. These two variables were simply not included when `refreshCommentsForStep` was written or updated.

### The Overwrite Mechanism

`beforeStepComposed()` (`orchestrator.ts:1869-1873`) is registered as a `beforeStep` hook:

```typescript
// orchestrator.ts:1869-1873
async function beforeStepComposed(stepId: HelixWorkflowStepId): Promise<void> {
  await configureInspectionForStep(stepId);
  await switchNsGmForStep(stepId);
  await refreshCommentsForStep(stepId);
}
```

This hook runs **before every workflow step** (scout, diagnosis, product, tech-research, implementation-plan, implementation, code-review, verification, preview-config). Each invocation of `refreshCommentsForStep` overwrites `ticket.md` in every repo sandbox with a version that lacks the Library Report Feedback section.

### Timeline of a Broken Iteration

| Time | Event | ticket.md State |
|------|-------|-----------------|
| T0 | User leaves section comments on published report | Comments in DB |
| T1 | User clicks "Continue Iteration" | Rerun created |
| T2 | Orchestrator fetches library comments | `libraryComments` populated in closure |
| T3 | `scaffoldRunArtifactsAcrossRepositories()` runs | **ticket.md has `## Library Report Feedback`** |
| T4 | `beforeStepComposed()` fires for scout step | `refreshCommentsForStep()` overwrites ticket.md |
| T5 | Scout agent reads ticket.md | **`## Library Report Feedback` section is GONE** |
| T6 | Same overwrite repeats for every subsequent step | Agent never sees library feedback |

## 5. Secondary Issue: Reply Thread Exclusion

`getLibraryCommentsForContinuation()` (`library-comment-service.ts:286-303`) uses a `parentCommentId: null` filter that excludes reply-thread comments:

```typescript
// library-comment-service.ts:286-293
export async function getLibraryCommentsForContinuation(libraryItemId: string) {
  const comments = await prisma.libraryComment.findMany({
    where: { libraryItemId, parentCommentId: null }, // <-- excludes replies
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { name: true, email: true } },
    },
  });
  // ...
}
```

### Impact

The codebase uses **single-level threading** (`library-comment-service.ts:68-69` --- replies-to-replies are redirected to the top-level parent). When users participate in threaded discussions on a section, those replies carry valuable context about what specifically needs to change. Excluding them means the agent sees only the top-level comment but not the follow-up discussion that may refine or clarify the request.

### Example

If a user leaves a top-level comment "This section needs more data" and another user replies "Specifically, add Q1 2026 revenue numbers", only the first comment reaches the agent. The specific request for Q1 2026 revenue is lost.

## 6. Client-Server Contract Break

### The Client Promise

At `library-continuation-section.tsx:110-111`:

```tsx
<p className="mb-3 text-xs text-neutral-500">
  Describe what to change in the next iteration. All section ratings and
  comments will be automatically included as context for the agent.
</p>
```

This text is displayed when users expand the "Continue Iteration" panel. It sets a clear expectation: **all comments will be included automatically**.

### The Server Reality

The server breaks this promise in two ways:

1. **Primary**: `refreshCommentsForStep` strips the `## Library Report Feedback` section before any workflow step executes. The agent never sees the comments.
2. **Secondary**: Even when the primary bug is fixed, reply-thread comments will still be excluded due to the `parentCommentId: null` filter.

### User Experience Consequence

Users who invest time in careful, per-paragraph feedback see the agent produce a report that appears to completely ignore their input. This is especially frustrating because:
- The UI explicitly told them their comments would be included.
- The initial scaffold *did* include the comments (for a brief moment before the first step).
- There is no error message or indication that comments were dropped.

## 7. Production Evidence

### Log Evidence: `refreshCommentsForStep` Runs Before Every Step

Production logs from BetterStack confirm that `refreshCommentsForStep` executes before every workflow step. Representative examples from May 20, 2026:

| Timestamp (UTC) | Run ID | Step | Comment Count |
|------------------|--------|------|---------------|
| 2026-05-20 03:18:45 | cmpdh329000gxfw0u4ijxyetp | implementation | 0 |
| 2026-05-20 03:18:41 | cmpdh68n600hpfw0uhk5uzdg8 | product | 3 |
| 2026-05-20 03:17:03 | cmpdh0sov00ghfw0ux83s29fn | implementation-plan | 3 |
| 2026-05-20 03:15:58 | cmpd9bkwl00aufw0uhy355g47 | preview-config | 0 |
| 2026-05-20 03:15:23 | cmpdh329000gxfw0u4ijxyetp | implementation-plan | 0 |
| 2026-05-20 03:12:12 | cmpdh0sov00ghfw0ux83s29fn | tech-research | 3 |
| 2026-05-20 03:12:00 | cmpdh329000gxfw0u4ijxyetp | tech-research | 0 |
| 2026-05-20 03:11:09 | cmpd9bkwl00aufw0uhy355g47 | verification | 0 |
| 2026-05-20 03:10:33 | cmpdh329000gxfw0u4ijxyetp | product | 0 |

**Key observations:**
- The log format is `refreshed comments for step={stepId} count={N}` (`orchestrator.ts:1862`).
- The `count` only reflects **ticket discussion comments** (from `prisma.ticketComment.findMany`), not library comments.
- There is no log entry mentioning library comment counts during the refresh --- because library comments are not being fetched or passed.
- The refresh runs consistently before every step across all active runs.

### Database Evidence

Direct database queries for `LibraryComment` records were blocked by inspection permissions. However, the existence of library comments in production is confirmed by:
1. The orchestrator code that fetches them (`orchestrator.ts:1217-1237`) and the user's report of having left comments.
2. The `getLibraryCommentsForContinuation` function (`library-comment-service.ts:286-303`) which is called during scaffold and successfully returns grouped comments when a published LibraryItem exists.
3. The initial scaffold **does** produce a correct `## Library Report Feedback` section, confirming the data is present in the database and fetched successfully.

### No Library Comment Refresh Logs

A search for `library comments for continuation` in production logs returned **no application-level results** (only inspection query logs). This is expected: the orchestrator only logs library comment activity during the initial fetch (`orchestrator.ts:1226`), not during step refreshes --- because the refresh does not touch library comments at all.

## 8. Recommended Fix

### Primary Fix: Pass Closure Variables in `refreshCommentsForStep`

**File**: `src/helix-workflow/orchestrator.ts`
**Location**: Lines 1835-1854 (the `buildTicketArtifactMarkdown` call within `refreshCommentsForStep`)

**Change**: Add `libraryComments` and `referencedTicketsMarkdown` to the object literal passed to `buildTicketArtifactMarkdown`:

```typescript
// BEFORE (orchestrator.ts:1835-1854):
const ticketMarkdown = buildTicketArtifactMarkdown({
  ticketId: run.ticketId,
  shortId: formatShortId(run.ticket.mode, run.ticket.ticketNumber),
  runId: run.id,
  runBranch: repo.runBranch,
  repoKey: repo.repoKey,
  repoUrl: repo.repoUrl,
  title: run.ticket.title,
  description: run.ticket.description,
  researchReportContent,
  attachments: run.ticket.attachments,
  continuationContext: run.continuationContext,
  comments: freshComments.map((c) => ({ ... })),
});

// AFTER:
const ticketMarkdown = buildTicketArtifactMarkdown({
  ticketId: run.ticketId,
  shortId: formatShortId(run.ticket.mode, run.ticket.ticketNumber),
  runId: run.id,
  runBranch: repo.runBranch,
  repoKey: repo.repoKey,
  repoUrl: repo.repoUrl,
  title: run.ticket.title,
  description: run.ticket.description,
  researchReportContent,
  attachments: run.ticket.attachments,
  continuationContext: run.continuationContext,
  comments: freshComments.map((c) => ({ ... })),
  libraryComments,            // ADD THIS
  referencedTicketsMarkdown,  // ADD THIS
});
```

### Secondary Fix: Include Reply Threads in `getLibraryCommentsForContinuation`

**File**: `src/services/library-comment-service.ts`
**Location**: Lines 286-303 (`getLibraryCommentsForContinuation`)

**Change**: Add a Prisma nested `include` for replies, and append replies to the grouped output:

```typescript
// BEFORE (library-comment-service.ts:286-303):
export async function getLibraryCommentsForContinuation(libraryItemId: string) {
  const comments = await prisma.libraryComment.findMany({
    where: { libraryItemId, parentCommentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { name: true, email: true } },
    },
  });

  const grouped: Record<string, typeof comments> = {};
  for (const c of comments) {
    if (!grouped[c.anchor]) grouped[c.anchor] = [];
    grouped[c.anchor].push(c);
  }
  return grouped;
}

// AFTER:
export async function getLibraryCommentsForContinuation(libraryItemId: string) {
  const comments = await prisma.libraryComment.findMany({
    where: { libraryItemId, parentCommentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { name: true, email: true } },
      replies: {
        include: { author: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const grouped: Record<string, typeof comments> = {};
  for (const c of comments) {
    if (!grouped[c.anchor]) grouped[c.anchor] = [];
    grouped[c.anchor].push(c);
    // Append replies after their parent within the same anchor group
    if (c.replies) {
      for (const reply of c.replies) {
        grouped[c.anchor].push(reply);
      }
    }
  }
  return grouped;
}
```

The `buildTicketArtifactMarkdown` formatter already handles comments without a rating by rendering them with a `[reply]` label (`orchestrator.ts:409`):

```typescript
const ratingLabel = c.rating ? `[${c.rating}]` : "[reply]";
```

This means reply threads will render correctly in the `## Library Report Feedback` section without any changes to the formatting function.

## 9. Fix Rationale

### Why Closure Variable Passthrough (Not Re-fetch, String Parsing, or Conditional Skip)

Four approaches were considered. The closure variable passthrough was chosen for the following reasons:

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| **A. Pass closure variables** | **Chosen** | Both variables are in scope. The identical pattern already exists for `researchReportContent` (line 1844). Two-property addition to an object literal. |
| B. Re-fetch from DB per step | Rejected | Library comments are tied to a PUBLISHED snapshot --- they cannot change during a run. Re-fetching adds unnecessary DB overhead per step (one query per step x N repos). |
| C. Parse existing ticket.md | Rejected | Fragile string manipulation. Defeats the purpose of `buildTicketArtifactMarkdown` as the canonical builder. Prone to breakage if the markdown format changes. |
| D. Skip rebuild for library runs | Rejected | Would prevent ticket discussion comments from refreshing during library iteration runs. Breaks the use case of users posting discussion comments while the iteration is running. |

### Why `researchReportContent` Proves This Pattern Is Correct

`researchReportContent` (`orchestrator.ts:1199`) is declared in the same enclosing function scope as `libraryComments` and `referencedTicketsMarkdown`. It **is** correctly passed to `buildTicketArtifactMarkdown` in `refreshCommentsForStep` at line 1844. This demonstrates:

1. The closure-variable pattern is intentional and works correctly.
2. The omission of `libraryComments` and `referencedTicketsMarkdown` is an oversight, not a design decision.
3. Adding these two properties follows the exact same pattern.

### Why `referencedTicketsMarkdown` Is Included

Although the user-reported problem specifically involves library comments, `referencedTicketsMarkdown` suffers from the identical omission in the same code path. The marginal cost of including it is zero (one additional property in the same object literal), and fixing it prevents a parallel data-loss bug from manifesting.

## 10. Testing Recommendations

### Unit Test for `buildTicketArtifactMarkdown`

`buildTicketArtifactMarkdown` (`orchestrator.ts:310-423`) is a **pure function** (input object to string, no side effects). It is an ideal candidate for unit testing. Currently there is **zero test coverage** for library comment features.

**Recommended test file**: `src/helix-workflow/orchestrator/build-ticket-markdown.test.ts` (co-located with existing orchestrator tests).

**Test cases**:
1. Library comments are included in output markdown when provided --- verify `## Library Report Feedback` heading and per-anchor sections appear.
2. Reply threads render correctly with `[reply]` labels.
3. Empty `libraryComments` (undefined or empty object) produces no `## Library Report Feedback` section.
4. `referencedTicketsMarkdown` is included when provided.
5. Existing sections (Discussion, Continuation Context, Research Report) are unaffected by the addition of library comments.

**Note**: Testing `buildTicketArtifactMarkdown` may require extracting it to a separate file if it is not currently exported. This extraction is a move-only refactor with no behavioral change.

### Integration Considerations

The `refreshCommentsForStep` integration (i.e., verifying that the correct parameters are passed through) is guaranteed by TypeScript's type system: `buildTicketArtifactMarkdown` has typed parameters, and passing `libraryComments` and `referencedTicketsMarkdown` follows the existing type contracts. A full integration test would require sandbox mocking and is disproportionate for this fix.

## 11. Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | `buildTicketArtifactMarkdown` not exported for testing | Medium | Low | Extract to a separate file (move-only refactor) or test via the module's internal exports. |
| 2 | Reply `include` changes the return type shape | Low | Low | TypeScript will catch any type mismatch. The consuming code in `orchestrator.ts:1228-1235` maps explicitly; replies need to be appended in the mapping logic. |
| 3 | Large comment threads inflate ticket.md | Very Low | Very Low | Library reports typically have a handful of section comments. The existing code has no size guard for discussion comments, so library comments follow the same pattern. |
| 4 | `libraryComments` could be undefined if fetch failed | Low | None | The fetch has a try/catch (`orchestrator.ts:1238-1240`) that logs a warning and leaves `libraryComments` as `undefined`. `buildTicketArtifactMarkdown` handles `undefined` correctly by not rendering the section. |
| 5 | Existing discussion comment refresh breaks | Very Low | Medium | The fix only adds parameters to an existing call --- it does not change the discussion comment fetch or rendering logic. Existing behavior is preserved. |

**Overall risk**: **Low**. The fix uses an existing code pattern (`researchReportContent` passthrough), existing data structures (closure variables already populated), and existing type contracts (`buildTicketArtifactMarkdown` already accepts these parameters). No schema changes, no new dependencies, no new API endpoints.

## 12. Open Questions and Future Considerations

| # | Topic | Details | Recommendation |
|---|-------|---------|----------------|
| 1 | **Agent prompt tuning** | Even with comments correctly delivered to ticket.md, the agent's system prompt may not give explicit instructions to prioritize library feedback for revisions. The RESEARCH-mode prompt may treat feedback as optional context. | Investigate after the fix: test whether the agent's output demonstrably changes when library feedback is present. If not, tune the system prompt to explicitly instruct the agent to address each piece of feedback. |
| 2 | **DRAFT item comments** | `getLibraryCommentsForContinuation` only fetches from PUBLISHED items. Users may want to comment on draft reports before publishing. | Product decision needed: when should comments become iteration-eligible? This is a separate feature request. |
| 3 | **Partial reruns** | If only specific steps are re-run (via `stepsToRun`), the scaffold behavior may differ. The initial scaffold may not re-run, so library comments may already be present in `ticket.md`. | Verify post-fix: test a partial rerun to ensure library comments survive across partial step executions. |
| 4 | **Git sidecar `comments.json`** | `library-comment-git-sync.ts` writes a `comments.json` file to the Git sidecar as a parallel comment source. This file is not part of the `ticket.md` pipeline but could serve as redundancy. | Not part of the current fix. Could be useful as a fallback or validation mechanism in future. |
| 5 | **`referencedTicketsMarkdown` as a separate fix** | Product explicitly scoped `referencedTicketsMarkdown` out of MVP. Including it in the fix has zero marginal cost, but product may prefer to track it separately. | Include it in the fix (zero cost) but note it in the PR description for product awareness. |

---

## Methodology

This report was produced by:

1. **Source code inspection**: Direct reading of `orchestrator.ts` (lines 310-423, 470-485, 1168, 1216, 1822-1873), `library-comment-service.ts` (lines 60-70, 286-303), and `library-continuation-section.tsx` (lines 110-111) in the current codebase.
2. **Production log analysis**: BetterStack log queries via the Helix runtime inspection system, confirming `refreshCommentsForStep` execution patterns across active runs.
3. **Prior artifact synthesis**: Diagnosis statement, product requirements, and tech-research architecture decision from the RSH-523 workflow pipeline.
4. **Database inspection**: Attempted but blocked by inspection permissions. Database evidence was inferred from code paths and log behavior.

## Data Sources

| Source | Type | What It Provided |
|--------|------|------------------|
| `helix-global-server/src/helix-workflow/orchestrator.ts` | Source code | Root cause location, function signatures, closure variable declarations |
| `helix-global-server/src/services/library-comment-service.ts` | Source code | Reply thread exclusion, threading model |
| `helix-global-client/src/components/library/library-continuation-section.tsx` | Source code | Client UI promise text |
| BetterStack production logs | Runtime data | Confirmation that `refreshCommentsForStep` runs before every step |
| Diagnosis statement (RSH-523) | Workflow artifact | Root cause analysis and evidence chain |
| Product requirements (RSH-523) | Workflow artifact | Scope, success criteria, and out-of-scope items |
| Tech-research (RSH-523) | Workflow artifact | Architecture decision and fix approach |

## Attachments
- (none)

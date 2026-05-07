# Ticket Context

- ticket_id: cmovlwzc0009tkn0tehan5y2v
- short_id: HLX-392
- run_id: cmovlwzcv009ykn0tsrb8aymg
- run_branch: helix/auto/HLX-392-implement-git-based-library
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Implement Git Based Library

## Description
So we already have some implementation. This report now defines a second round with some major corrections on the attention and infrastructure. Take your time. See the big picture. See what we have now. The general theme is good but the infrastructure will most likely have to be totally redone as per the report. 



I will make two caveats to the report.

1. I would say first of all in the naming of the repository and in similar naming themes. I wouldn't call it the report repository. I would call it the library. The library is a bigger concept. Right now we are filling it with reports but in general the library is a larger concept and we should call the repo the library. Whenever we have the opportunity to use library we should use that, except when it's talking about an actual report. In that case it is a report. I think you understand the idea of when to call something library and when to call something report.
2. Second I would say let's go ahead and put the artifacts in instead of deferring. That way we can we can just model the existing workflow for code changes that already commits all of the artifacts this is not a new concept so let's do that right you have all the artifacts in a dot helix folder and then you have the actual code changes where they exist and here you can have the same thing you can have all the run information all the artifact information in a dot helix folder or and then you can have a separate folder for the actual report that's one option or you can keep using the existing option in the library but either way it has to be yeah I would I would use the same as parallel to the code situation as possible except if it doesn't make any sense at all. I'm okay keeping the blob versions. Those can be helpful for other tools. 

Just to reiterate the primary version is to get the primary purpose of all this, which is to get the realization that the library (I shouldn't even call it the report flow) genuinely follows the same pattern, the same workflow as the build, fix, etc. flow and we want to take it closer. When in doubt match that flow. Alright, so the idea is that it is primarily Git. It is not primarily Blob. It's primarily Git-like code. The artifacts go into the repository the same way we find it helpful to have artifacts in the code repository. You'll find it even more helpful than in your library of research. You have the intermediate artifacts. And that of course reports change over time. Research changed over time. If you only have a final version and not the interim changes, it doesn't quite help you get to where you need to get. 



&nbsp;

## Research Report

# Git Based Library: Technical Architecture Report

## 1. Executive Summary

The Helix research library feature is implemented but not yet merged. In its current form, it stores research reports in **three redundant locations** — Vercel Blob, a PostgreSQL database content field, and a dedicated Git repository — when the intended architecture is **Git as the single source of truth**. Continuations (re-runs of research tickets) silently overwrite previous report versions due to per-ticket keying in both the database and Git. The Git repository is write-only: no UI surface reads content from it. Meanwhile, the library repo is not automatically available during ticket runs, requiring manual selection.

This report provides a comprehensive technical analysis of the current architecture, proposes a Git-primary redesign with concrete file-level guidance, evaluates UX patterns for version history navigation, and delivers a phased implementation roadmap. The core recommendation is to adopt **Git as the primary content store with the database as a lightweight metadata index**, implement **per-run versioning** that preserves all report versions, inject the library repo **ambiently** into every ticket run, and unify the two disconnected report viewing paths into **one Git-backed library view**.

The `LibraryItem` table does not yet exist in production (pending migration `20260505000000`), which means the schema can be modified directly before deployment — a significant advantage for this architectural pivot.

---

## 2. Current Architecture Analysis

### 2.1 Report Storage: Triple Redundancy

When a research-mode run completes, the orchestrator (`orchestrator.ts`, lines ~2380-2451) stores the generated `report.md` in three separate locations:

| Storage Layer | Code Path | Role | Fatal on Failure? |
|--------------|-----------|------|-------------------|
| **Vercel Blob** | `uploadReportDeliverable` | Primary delivery mechanism; URL stored in `SandboxRun.reportDeliverable` | Yes |
| **Git Repository** | `commitReportFile` via `report-repo-service.ts` | "Dual storage" — logged literally as "Git dual-storage" | No (try/catch) |
| **PostgreSQL DB** | `upsertFromReport` via `library-service.ts` | Content cache for library UI; full report text in `LibraryItem.content` | No (try/catch) |

The critical observation is that **Blob is the primary storage** (its failure is fatal), while **Git is secondary** (wrapped in a non-fatal try/catch). This is the exact inverse of the intended architecture where Git should be the canonical source.

**Report capture sequence:**

```
1. Read report.md from sandbox filesystem
2. Upload to Vercel Blob → store URL in SandboxRun.reportDeliverable  [PRIMARY, FATAL]
3. Try: Ensure {org}-reports GitHub repo exists
4. Try: Commit to branch report/{ticketId} at path reports/{ticketId}/report.md  [SECONDARY, NON-FATAL]
5. Try: Upsert LibraryItem with full content text  [SECONDARY, NON-FATAL]
```

### 2.2 Report Capture Flow (Orchestrator)

The orchestrator's report handling (`orchestrator.ts`, around line 2399) first calls `uploadReportDeliverable`, which uploads the markdown to Vercel Blob and stores the resulting URL in the `SandboxRun.reportDeliverable` JSON field. This is the only storage step whose failure aborts the process.

The Git commit happens next via `report-repo-service.ts`. The `commitReportFile` function:
- Ensures an `{org-name}-reports` private GitHub repository exists (auto-created if absent)
- Creates a branch named `report/{ticketId}` **from the default branch SHA** — not from the existing branch HEAD
- Commits to file path `reports/{ticketId}/report.md`
- On continuation, the branch is recreated from the default branch SHA, **discarding all previous branch content**

Finally, `upsertFromReport` in `library-service.ts` performs a `findFirst` by `{organizationId, ticketId}` and either creates or updates a single `LibraryItem` record. The full report content is stored in the `content @db.Text` column.

### 2.3 Report Viewing: Two Disconnected Paths

The system has two completely separate report viewing paths that read from different data sources:

| Surface | Component | Data Source | Code Path |
|---------|-----------|-------------|-----------|
| **Ticket detail page** | `report-viewer.tsx` | Vercel Blob (via server API) | `ticketReportQueryOptions` → `GET /tickets/:ticketId/report` → server reads from Blob URL |
| **Library detail page** | `library-detail.tsx` | PostgreSQL DB | `libraryItemQueryOptions` → `GET /library/items/:itemId` → `item.content` from DB |
| **Git repository** | *(none — never read)* | GitHub | Write-only via `commitReportFile` |

The ticket-detail viewer (`report-viewer.tsx`) fetches report content via a standard API call (`ticketReportQueryOptions`), which hits the server endpoint `GET /tickets/:ticketId/report`. The server then reads the content from the Blob URL stored in `SandboxRun.reportDeliverable` (`ticket-service.ts`, around line 1893) and returns it. The library detail viewer (`library-detail.tsx`) renders `item.content` directly from the database response (line 329). **No UI surface reads from Git.**

Both components duplicate significant helper code:
- `PDF_CSS` styling for PDF export (`report-viewer.tsx:26-47`, `library-detail.tsx:31-52`)
- `slugify()` function for filename generation (`report-viewer.tsx:7-13`, `library-detail.tsx:13-19`)
- `downloadMarkdown()` function for markdown export (`report-viewer.tsx:15-23`, `library-detail.tsx:21-29`)
- `StatusBadge` component is also duplicated between `library.tsx:16-29` and `library-detail.tsx:67-80`
- `formatDate` helper is duplicated between `library.tsx:7-14` and `library-detail.tsx:58-65`

The `library-detail.tsx` file even acknowledges this with a comment (line 10): "Helpers (duplicated from report-viewer.tsx per plan)."

### 2.4 Version Loss on Continuation

When a user does a continuation (re-run) of a research ticket, previous report versions are lost through three independent mechanisms:

1. **Database**: `upsertFromReport` (`library-service.ts`) uses `findFirst` by `{organizationId, ticketId}` — exactly **one LibraryItem per ticket**. A continuation overwrites the existing record.

2. **Git**: The branch `report/{ticketId}` is recreated from the default branch SHA each time (`report-repo-service.ts`). Previous branch content is discarded. The file path `reports/{ticketId}/report.md` is a single mutable file.

3. **Blob**: While Blob storage is technically per-run (keyed by `runId`), the UI only fetches from the latest run with a non-null deliverable, making previous versions inaccessible.

The `LibraryItem` model has no `runId` field, no version counter, and no mechanism for tracking multiple versions of a report for the same ticket. The pending migration (`20260505000000_add_library_item`) creates the table with:

```sql
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'REPORT',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "branch" TEXT,
    "filePath" TEXT,
    "content" TEXT,          -- Full report content stored in DB
    "generatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);
```

Note the absence of `runId` and the presence of `content TEXT` — both of which need to change in the proposed architecture.

### 2.5 No Ambient Repository Concept

The report repository is tracked via `Organization.reportRepoUrl` and `Organization.reportRepoName` — fields on the Organization model, completely separate from the `OrganizationRepository` table that backs the repository picker.

When a ticket run starts, `resolveRunRepositories` (`repositories.ts`, around line 273) processes only explicit `TicketRepository` entries. There is no mechanism to auto-include a special repository type. The ticket creation flow requires explicit repository selection, and since the report repo isn't an `OrganizationRepository`, it never appears in the picker and is never automatically included.

This means the library repo — containing all of the organization's research — is **not available to agents during ticket runs**. Builders cannot search past research. Researchers cannot reference prior work. The vision of an "ambient" company knowledge base is unimplemented.

---

## 3. Industry Context: Git-Backed Knowledge Management

The concept of using Git as a backing store for AI-accessible knowledge bases has gained significant traction in 2025-2026, driven by the convergence of LLM capabilities and the need for persistent, version-controlled knowledge.

### The Karpathy LLM Wiki Pattern

In April 2026, Andrej Karpathy published his "LLM Knowledge Bases" concept (commonly called the "LLM Wiki"), describing a system where raw source materials (articles, papers, repos, datasets) are ingested into a `raw/` directory and an LLM "compiles" them into a structured, interlinked wiki of markdown files. The system has three key operations: **ingestion** (raw materials in), **compilation** (LLM processes raw into structured wiki with summaries, backlinks, and concept articles), and **maintenance** (health checks and linting passes where the LLM scans for inconsistencies and new connections).

Karpathy's key insight is that this creates a **persistent, compounding artifact** — unlike traditional RAG (Retrieval-Augmented Generation), where every query starts from zero and the system is "perpetually amnesiac," the wiki retains synthesized knowledge. Cross-references are pre-built, contradictions are flagged, and synthesis reflects everything previously processed. The pattern has inspired multiple open-source implementations including LLM Wiki frameworks and multi-agent memory systems.

### Relevance to the Helix Library

The Helix Git-based library directly parallels Karpathy's pattern. Research ticket runs produce reports that are committed to a Git repository — markdown files with version control, authorship, and browsable structure. The library serves as a persistent knowledge base: **the Git repo is the wiki; the reports are the compiled knowledge.** The key difference is that Helix's compilation is task-driven (research tickets) rather than raw-material ingestion, and the "wiki" structure is per-ticket rather than per-concept. Future iterations could add cross-referencing, synthesis across reports, and iterative refinement — moving closer to the full LLM Wiki vision.

The broader industry trend reinforces this approach. Git-backed knowledge repositories are emerging as a preferred pattern for AI agent systems because they provide: version control (full history of changes), collaboration primitives (branches, PRs, reviews), accessibility (agents can clone, search, and read), and interoperability (markdown is universal). The growth of AI-related repositories on GitHub (over 4.3 million as of 2025) and the rise of agentic AI frameworks that rely on file-based context further validate Git as the right foundation for a knowledge library.

---

## 4. Proposed Architecture: Git as Single Source of Truth

### 4.1 Storage Architecture: Git-Primary with DB Metadata Index

The recommended architecture eliminates triple redundancy by making Git the canonical content store and reducing the database to a lightweight metadata index:

| Layer | Current Role | Proposed Role | Future State |
|-------|-------------|---------------|--------------|
| **Git Repository** | Secondary ("dual-storage"), write-only, non-fatal | **Primary content store**, read/write, fatal on failure | Sole content source |
| **PostgreSQL DB** | Full content cache (`content @db.Text`) | Metadata index only (title, status, timestamps, `runId`) | Metadata index only |
| **Vercel Blob** | Primary delivery mechanism, fatal on failure | Secondary/temporary, non-fatal (retained for materializer compatibility) | Removed |

**Key principle**: Git failure becomes fatal (the report must be committed to Git for the run to succeed). Blob failure becomes non-fatal (a best-effort backup for compatibility). The DB stores no report content — only metadata for fast list queries and version chain navigation.

**Why retain the DB at all?** Pure Git-only (Option B) would require GitHub API calls for every list page load, with no fast filtering or sorting. The DB as a metadata index preserves the existing ~10ms list query performance while Git serves content on demand.

**Why retain Blob temporarily?** The `referenced-ticket-materializer.ts` downloads report content from `reportDeliverable.blobUrl` to materialize artifacts for build tickets that reference research. Removing Blob immediately would break this flow. A follow-up ticket should migrate the materializer to read from Git, after which Blob can be removed entirely.

### 4.2 Git Repository Directory Structure

Three directory structure options were evaluated:

| Option | Structure | Pros | Cons |
|--------|-----------|------|------|
| **A (Recommended)** | `reports/{ticketShortId}/runs/{runId}/report.md` + `reports/{ticketShortId}/report.md` as latest | Human-browsable on GitHub; per-run preservation; quick-access latest file; follows `.helix` pattern | Two files committed per run |
| **B** | `reports/{ticketShortId}/report.md` only, use `git log` for history | Simple structure | Not browsable without Git commands; doesn't follow `.helix` pattern for runs |
| **C** | `reports/{ticketShortId}-run-{N}/report.md` flat files | Simple | No grouping by ticket; hard to find latest; no hierarchy |

**Recommended: Option A** — Per-run directories with a latest-version file.

```
{org}-reports/
  reports/
    RSH-391/
      report.md                          # Latest version (always updated)
      runs/
        cm1abc.../report.md              # Run 1 snapshot (immutable)
        cm2def.../report.md              # Run 2 snapshot (continuation)
    RSH-392/
      report.md                          # Latest version
      runs/
        cm3ghi.../report.md              # Run 1 snapshot
```

**Why `ticketShortId` (e.g., `RSH-391`) instead of CUID (e.g., `cmoutw8o70085kn0t1f6o5oor`)?** Short IDs are human-readable when browsing the repository on GitHub. They are already generated by `formatShortId` in `ticket-id-utils.ts`.

**Why a top-level `report.md` per ticket?** Provides quick access to the latest version without navigating into runs. This file is always overwritten with the newest content. Per-run files are immutable snapshots.

**Future: Artifact preservation.** The directory structure naturally supports extending to:
```
    RSH-391/
      report.md
      runs/
        cm1abc.../
          report.md
          .helix/               # Run artifacts (scout, diagnosis, etc.)
```

### 4.3 Database Model Changes

The `LibraryItem` model needs the following changes:

| Change | Current | Proposed | Rationale |
|--------|---------|----------|-----------|
| Add `runId` | *(absent)* | `runId String` (non-nullable, FK to SandboxRun) | Enable per-run records; version chain via `ticketId + createdAt` |
| Remove `content` | `content String? @db.Text` | *(removed)* | Content served from Git; DB is metadata-only |
| Add index | *(absent)* | `@@index([ticketId, createdAt])` | Fast version chain queries (all items for a ticket, ordered by creation) |
| Change upsert to create | `findFirst` + `upsert` by `{orgId, ticketId}` | `create` per run | Multiple records per ticket; no overwriting |

**Migration strategy**: Since the `LibraryItem` table does not exist in production (confirmed by the pending migration `20260505000000_add_library_item` and runtime inspection), the pending migration SQL can be modified directly. There is no data to migrate and no risk of production impact.

The pending cascade fix migration (`20260505100000_fix_library_item_ticket_cascade`) can be absorbed into the modified base migration.

**Proposed migration SQL diff:**

```sql
-- Modified: Add runId, remove content, add composite index
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,                          -- NEW: link to SandboxRun
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'REPORT',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "branch" TEXT,
    "filePath" TEXT,
    -- "content" TEXT,                              -- REMOVED: content from Git
    "generatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LibraryItem_organizationId_idx" ON "LibraryItem"("organizationId");
CREATE INDEX "LibraryItem_ticketId_idx" ON "LibraryItem"("ticketId");
CREATE INDEX "LibraryItem_organizationId_status_idx" ON "LibraryItem"("organizationId", "status");
CREATE INDEX "LibraryItem_ticketId_createdAt_idx" ON "LibraryItem"("ticketId", "createdAt");  -- NEW

ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "SandboxRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;  -- NEW
```

### 4.4 Ambient Repository Injection

The recommended injection point is `resolveRunRepositories` in `repositories.ts` (around line 273). After processing explicit `TicketRepository` entries, the function checks for `run.organization.reportRepoUrl`. If set, it appends a `RunRepositoryConfig` with a fixed `repoKey` of `"reports"` and `ORG_PAT` auth mode.

**Pseudocode:**

```typescript
// After processing TicketRepository entries...
const reportRepoUrl = run.organization.reportRepoUrl;
const reportRepoName = run.organization.reportRepoName;

if (reportRepoUrl && reportRepoName) {
  repoConfigs.push({
    repoKey: "reports",
    repositoryId: "ambient-reports",   // Sentinel ID
    repoUrl: reportRepoUrl,
    repoName: reportRepoName,
    branch: undefined,                 // Default branch
    authMode: "ORG_PAT",
    isAmbient: true,                   // Flag for special handling
  });
}
```

**Why this approach?**
- The `LoadedRun` type passed to `resolveRunRepositories` already includes `run.organization` — need to ensure it loads `reportRepoUrl` and `reportRepoName`
- Using `ORG_PAT` auth mode is consistent with other org repos
- A fixed `repoKey` of `"reports"` gives the agent a predictable workspace path
- The injection is skipped when `reportRepoUrl` is null (new orgs before first research run)
- This doesn't require creating fake `TicketRepository` entries that would corrupt the data model

**Alternatives considered and rejected:**
- *Inject at ticket creation*: The report repo isn't an `OrganizationRepository`, so it can't be a `TicketRepository` entry
- *Inject in the orchestrator*: `resolveRunRepositories` is the natural aggregation point for all repos; adding a special case elsewhere fragments repo resolution

### 4.5 Content Reading: Server-Side Git Proxy

Report content is read via the GitHub Contents API, proxied through the server. The existing `fetchGitHubJson` wrapper (`github-auth-validation.ts`, around line 94) provides authenticated GitHub API calls with proper timeout handling.

**New internal function in `library-service.ts`:**

```typescript
async function readContentFromGit(
  repoUrl: string,
  filePath: string,
  ref: string,              // Branch name or 'main'
  orgPat: string
): Promise<string | null> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const response = await fetchGitHubJson(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`,
    orgPat
  );
  if (!response || response.status === 404) return null;
  return Buffer.from(response.content, 'base64').toString('utf-8');
}
```

**Reading logic by status:**
- **Draft items**: Read from branch `report/{ticketId}` (`ref` = branch name)
- **Published items**: Read from `main` (`ref` = `"main"`) — content is merged to main during the publish flow

**Why server-side proxy instead of client-side GitHub fetch?**
- Consistent authentication (server holds the org PAT)
- Rate limit control (server-side management)
- No CORS issues with GitHub API
- Branch/ref resolution logic stays server-side
- Client API contract doesn't change — client still receives `content: string`

### 4.6 Orchestrator Changes: Report Capture Flow

The orchestrator's report handling reverses the priority of Git and Blob:

**Proposed capture sequence:**

```
1. Read report.md from sandbox filesystem
2. Commit to Git repo (per-run path + latest path)               [PRIMARY, FATAL]
3. Create LibraryItem metadata record in DB (no content)          [PRIMARY, FATAL]
4. Try: Upload to Vercel Blob (retained for materializer)         [SECONDARY, NON-FATAL]
```

**Key changes to `commitReportFile` in `report-repo-service.ts`:**
1. Accept `runId` and `ticketShortId` parameters
2. Check if branch `report/{ticketId}` exists before creating — if it exists, commit on top of existing HEAD (preserving previous files)
3. Commit **two files** per run:
   - `reports/{ticketShortId}/runs/{runId}/report.md` — per-run snapshot, immutable
   - `reports/{ticketShortId}/report.md` — latest version, always overwritten
4. Use existing branch HEAD as parent SHA instead of default branch SHA

**Key changes to `library-service.ts`:**
- `upsertFromReport` becomes `createFromReport` — creates a new `LibraryItem` per run (no overwrite)
- Stores `runId`, `branch`, `filePath` — no `content`
- New `getItemVersions(orgId, ticketId)` returns all LibraryItems for a ticket
- `listItems` returns latest per ticket via `DISTINCT ON (ticketId)` or subquery ordered by `createdAt DESC`
- `getItem` reads content from Git via `readContentFromGit` instead of `item.content`

### 4.7 Blob Storage Transition Plan

| Phase | Blob Role | Git Role | DB Role |
|-------|-----------|----------|---------|
| **Current** | Primary (report delivery, fatal) | Secondary ("dual-storage", non-fatal) | Content cache |
| **After this implementation** | Secondary (materializer compatibility, non-fatal) | **Primary** (content source, fatal) | Metadata index only |
| **Future ticket** | Removed | Sole source | Metadata index only |

**Why not remove Blob now?** The `referenced-ticket-materializer.ts` downloads report content from `reportDeliverable.blobUrl` to materialize artifacts for build tickets that reference research. Removing Blob would break the "implement from research" workflow. The materializer should be migrated to read from Git in a dedicated follow-up ticket, after which Blob upload can be removed entirely.

---

## 5. Version History UX

### 5.1 UX Pattern Options

Three patterns were evaluated for version navigation on the library detail page:

| Pattern | Description | Pros | Cons |
|---------|-------------|------|------|
| **Dropdown Selector** | Compact dropdown in the detail page header showing available versions | Minimal space; scales to many versions; familiar pattern; doesn't change layout | Less visual than timeline; requires click to discover versions |
| **Timeline View** | Vertical timeline showing all versions with dates and context | Visually rich; shows evolution at a glance; good for storytelling | Consumes significant vertical space; complex to implement; doesn't scale well |
| **Tabs** | Horizontal tabs, one per version | Familiar; immediate access to each version | Doesn't scale beyond 3-4 versions; tabs become crowded with continuations |

### 5.2 Recommended: Dropdown Selector

A dropdown in the library detail page header, populated by a new `/library/items/:itemId/versions` endpoint:

**Behavior:**
- **Default**: Latest version selected
- **Label format**: Formatted date (e.g., "May 7, 2026") with optional run indicator
- **Visibility**: Only shown when 2+ versions exist (single-version reports show no dropdown)
- **Navigation**: Selecting a version navigates to `/library/{versionItemId}` — each version has its own LibraryItem ID, making URLs bookmarkable and shareable
- **Data source**: New TanStack Query hook `libraryItemVersionsQueryOptions(itemId)` fetching from the versions endpoint

**API contract:**

```typescript
// New endpoint: GET /library/items/:itemId/versions
// Response:
{
  "versions": [
    { "id": "cm2def...", "runId": "cm2run...", "generatedAt": "2026-05-07T...", "createdAt": "2026-05-07T..." },
    { "id": "cm1abc...", "runId": "cm1run...", "generatedAt": "2026-05-06T...", "createdAt": "2026-05-06T..." }
  ]
}
```

**TanStack Query key structure:**
```
["library", "items"]                          — list (unchanged)
["library", "items", itemId]                  — detail (unchanged)
["library", "items", itemId, "versions"]      — version list (new)
```

Invalidation on publish/remove already invalidates the `["library", "items"]` prefix, which covers all related queries.

### 5.3 Unified Report Viewing

The separate Blob-backed `report-viewer.tsx` on the ticket detail page is replaced with a lightweight library link card:

```
+-------------------------------------------+
| Report: "Market Analysis Q2"    [Draft]   |
| View in Library ->                        |
+-------------------------------------------+
```

**What changes:**
- `report-viewer.tsx` is replaced with a simple link/card component
- The card shows the report title, status badge, and a "View in Library" link to `/library/{itemId}`
- `ticketReportQueryOptions` in `api/tickets.ts` is removed
- A new query `libraryItemByTicketQueryOptions(ticketId)` provides the `itemId` for linking

**Why a link instead of embedding?** The ticket owner explicitly stated: "I'm okay if any of the viewing is just in the library and not on the ticket." A link keeps the ticket-detail page and library page decoupled, avoids component coupling, and establishes one canonical viewing path.

**Shared utilities extraction:**

| Current Location | Shared Location | Contents |
|-----------------|-----------------|----------|
| `report-viewer.tsx`, `library-detail.tsx` | `src/utils/report-helpers.ts` | `slugify`, `downloadMarkdown`, `PDF_CSS` |
| `library.tsx`, `library-detail.tsx` | `src/components/status-badge.tsx` | `StatusBadge` component |

---

## 6. Implementation Roadmap

### 6.1 Phase 1: Server Changes (helix-global-server)

Changes are ordered by dependency — schema before services, services before controller, controller before orchestrator.

| # | Task | File(s) | Details |
|---|------|---------|---------|
| 1 | **Modify pending migration** | `prisma/schema.prisma`, `prisma/migrations/20260505000000_*/migration.sql` | Add `runId` (non-nullable FK to SandboxRun), remove `content` column, add `@@index([ticketId, createdAt])`, absorb cascade fix from `20260505100000` |
| 2 | **Update report commit** | `src/services/report-repo-service.ts` | Accept `runId` + `ticketShortId`; check branch existence before creating; commit two files per run (per-run + latest); use existing branch HEAD as parent |
| 3 | **Add Git content reading** | `src/services/library-service.ts` | New internal `readContentFromGit` function using `fetchGitHubJson` for GitHub Contents API with branch-aware ref |
| 4 | **Replace upsert with create** | `src/services/library-service.ts` | `upsertFromReport` -> `createFromReport` (per-run records); update `getItem` to read content from Git; new `getItemVersions`; update `listItems` to return latest per ticket |
| 5 | **Add versions endpoint** | `src/controllers/library-controller.ts`, `src/routes/api.ts` | `GET /library/items/:itemId/versions` returning version list for a ticket |
| 6 | **Update orchestrator** | `src/helix-workflow/orchestrator.ts` (~lines 2380-2451) | Git commit becomes primary (fatal); pass `runId` and `ticketShortId`; Blob becomes secondary (non-fatal try/catch) |
| 7 | **Inject ambient repo** | `src/helix-workflow/orchestrator/repositories.ts` | After TicketRepository processing, append report repo config if `organization.reportRepoUrl` is set |
| 8 | **Update publish flow** | `src/services/library-service.ts` | Set all items for a ticket to PUBLISHED status (not just one) when branch is merged to main |

### 6.2 Phase 2: Client Changes (helix-global-client)

Client changes depend on server changes being complete (new API endpoints, updated response shapes).

| # | Task | File(s) | Details |
|---|------|---------|---------|
| 1 | **Update types** | `src/types/api.ts` | Add `runId` to `LibraryItem`; add `LibraryItemVersion` type; add `LibraryItemVersionsResponse` type |
| 2 | **Add versions query hook** | `src/api/library.ts` | New `libraryItemVersionsQueryOptions(itemId)` with query key `["library", "items", itemId, "versions"]` |
| 3 | **Extract shared utilities** | `src/utils/report-helpers.ts`, `src/components/status-badge.tsx` | Move `slugify`, `downloadMarkdown`, `PDF_CSS` to shared utils; extract `StatusBadge` component |
| 4 | **Add version selector to library detail** | `src/routes/library-detail.tsx` | Dropdown in header populated by versions query; navigates to `/library/{versionItemId}` on selection; only shown when 2+ versions exist |
| 5 | **Replace report-viewer** | `src/components/report-viewer.tsx` (replace) | New lightweight component showing report title, status badge, and "View in Library" link |
| 6 | **Remove Blob report query** | `src/api/tickets.ts` | Remove `ticketReportQueryOptions` (Blob-backed path); add `libraryItemByTicketQueryOptions(ticketId)` |
| 7 | **Update library list** | `src/routes/library.tsx` | Use shared `StatusBadge` component |

### 6.3 Deferred Items

These items are explicitly out of scope for the initial implementation but are supported by the architecture:

| Item | Rationale for Deferral |
|------|----------------------|
| **Blob storage removal** | Requires migrating `referenced-ticket-materializer.ts` to read from Git first |
| **Artifact preservation in Git** | Directory structure supports it (`runs/{runId}/.helix/`), but orchestrator doesn't commit artifacts yet |
| **Rich version history (timeline, diff)** | Dropdown is sufficient for MVP; timeline can be added later |
| **Continuation context display** | Showing which user prompt triggered each version — useful but not essential |
| **Library search** | Could use GitHub Search API or index content in DB later |
| **Caching layer for Git reads** | Only needed if GitHub API latency or rate limits become an issue at scale |
| **Branch cleanup** | Automated cleanup of old `report/{ticketId}` branches after publish |

---

## 7. Open Questions & Risks

### Open Questions

| # | Question | Current Assessment | Impact |
|---|----------|-------------------|--------|
| 1 | **GitHub API rate limits at scale** | 5,000 requests/hour per PAT. A team of ~20 users viewing ~10 reports/hour = ~200 requests — well within limits. | Low risk for MVP; may need caching at scale |
| 2 | **Referenced ticket materializer compatibility** | Blob retained temporarily. Materializer continues to work unchanged. | Requires follow-up ticket to migrate materializer to Git |
| 3 | **Published vs draft reading paths** | Published reads from `ref=main`; drafts from `ref=report/{ticketId}`. Clear rule based on `item.status`. | Minor implementation complexity; well-defined |
| 4 | **`ticketShortId` vs `ticketId` (CUID) for Git paths** | Recommend `ticketShortId` (e.g., `RSH-391`) for human readability on GitHub. CUIDs are preserved in branch names for uniqueness. | Low risk — short IDs are already generated |
| 5 | **Artifact structure in reports repo** | Deferred. The per-run directory structure supports future artifact commits. | No immediate impact; architecture is ready |

### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **GitHub API availability/latency** | Low | Medium — library detail pages load slower or fail | Server returns cached metadata on API failure; add caching layer in follow-up |
| **Migration safety** | Very Low | Low — table doesn't exist yet | Modify pending migration directly; no production data at risk |
| **Branch management complexity** | Medium | Low — incorrect branch state could lose runs | Check branch existence before creating; use existing HEAD as parent; test with multi-run scenarios |
| **Blob removal breaks materializer** | Medium (if removed too early) | High — breaks implement-from-research flow | Explicit phase plan: retain Blob now, migrate materializer later, then remove |
| **GitHub API rate limits** | Low (for current team sizes) | Medium — degraded library experience | Monitor usage; add server-side cache (in-memory or Redis) with short TTL when needed |

---

## 8. Recommendations

Based on the analysis above, we recommend the following prioritized actions:

### Primary Recommendations

1. **Adopt Git-primary with DB metadata index (Option A)**
   - Git is the canonical content store. The DB holds lightweight metadata only. This directly fulfills the ticket owner's "Git is the database" vision while preserving fast list queries.

2. **Use per-run directory structure with latest-version file**
   - `reports/{ticketShortId}/runs/{runId}/report.md` for immutable per-run snapshots
   - `reports/{ticketShortId}/report.md` for quick-access latest version
   - Human-browsable on GitHub; follows the `.helix` pattern for future artifact preservation

3. **Implement dropdown version selector in library detail**
   - Compact, scalable, doesn't change page layout
   - Each version has its own URL for bookmarkability
   - Populated by a new API endpoint; only shown for 2+ versions

4. **Replace report-viewer with library link card**
   - One canonical viewing path through the library
   - Eliminates code duplication between report-viewer and library-detail
   - Aligns with the owner's stated preference: "I'm okay if any of the viewing is just in the library and not on the ticket"

5. **Modify pending migration directly**
   - Safe because the table doesn't exist in production
   - Add `runId`, remove `content`, add composite index
   - Absorb the cascade fix migration

6. **Inject ambient repo in `resolveRunRepositories`**
   - Single integration point for all repo resolution
   - No fake `TicketRepository` entries needed
   - Skipped gracefully when no report repo exists

### Secondary Recommendations

7. **Retain Blob temporarily for materializer compatibility**
   - Non-breaking transition; materializer continues to work
   - Create a follow-up ticket to migrate the materializer to Git reading

8. **Extract shared utilities proactively**
   - `report-helpers.ts` and `status-badge.tsx` reduce duplication
   - Makes future maintenance easier

### Implementation Priority

Execute in two phases: **Server first** (schema, services, orchestrator, ambient injection), **then Client** (types, queries, components, version selector). Server changes are independently valuable and testable. Client changes depend on the new API endpoints being available.

---

## Appendix A: Performance Expectations

| Operation | Current Latency | After Change | Net Impact |
|-----------|----------------|-------------|------------|
| Library list load | DB query (~10ms) | DB query (~10ms) | No change — metadata only |
| Library detail (content) | DB read (~10ms) | GitHub API (~200-500ms) | Slightly slower; accepted by owner |
| Version list | N/A | DB query (~10ms) | New capability |
| Report commit (orchestrator) | Blob + Git + DB (~2-3s) | Git primary + Blob secondary + DB meta (~2-3s) | Similar total time |
| Ticket report view | Blob download (~200-500ms) | Redirect to library (instant) | Faster — no Blob download |

## Appendix B: Server API Changes Summary

| Endpoint | Current | After Change |
|----------|---------|-------------|
| `GET /library/items` | Returns latest per ticket (DB metadata + content) | Returns latest per ticket (DB metadata only — content omitted in list) |
| `GET /library/items/:itemId` | Content from DB `item.content` | Content from Git via GitHub Contents API (transparent to client) |
| `GET /library/items/:itemId/versions` | *(does not exist)* | **New**: Returns version list for a ticket's library item |
| `POST /library/items/:itemId/publish` | Updates single item status | Updates all items for ticket to PUBLISHED |
| `DELETE /library/items/:itemId` | Removes single item | Unchanged |
| `GET /tickets/:ticketId/report` | Returns Blob content | Deprecated — client uses library link instead |

## Appendix C: Client Type Changes Summary

```typescript
// Updated: LibraryItem gains runId
export type LibraryItem = {
  id: string;
  ticketId: string;
  runId: string;           // NEW — links to SandboxRun for version tracking
  title: string;
  contentType: ContentType;
  status: LibraryItemStatus;
  generatedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  reporter?: Reporter | null;
};

// New: Version metadata for dropdown selector
export type LibraryItemVersion = {
  id: string;
  runId: string;
  generatedAt: string | null;
  createdAt: string;
};
```

## Appendix D: References

- Orchestrator report capture: `helix-global-server/src/helix-workflow/orchestrator.ts` (~lines 2380-2451)
- Git commit service: `helix-global-server/src/services/report-repo-service.ts` (~lines 87-152)
- Library CRUD service: `helix-global-server/src/services/library-service.ts`
- Repository resolution: `helix-global-server/src/helix-workflow/orchestrator/repositories.ts` (~lines 273-314)
- GitHub API wrapper: `helix-global-server/src/services/github-auth-validation.ts` (lines 94-127)
- LibraryItem schema: `helix-global-server/prisma/schema.prisma` (~lines 760-780)
- Organization report repo fields: `helix-global-server/prisma/schema.prisma` (~lines 177-178)
- Pending migration: `helix-global-server/prisma/migrations/20260505000000_add_library_item/migration.sql`
- Library detail view: `helix-global-client/src/routes/library-detail.tsx`
- Library list view: `helix-global-client/src/routes/library.tsx`
- Report viewer (Blob-backed): `helix-global-client/src/components/report-viewer.tsx`
- Client types: `helix-global-client/src/types/api.ts` (lines 90-128: `LibraryItemStatus`, `ContentType`, `LibraryItem`, `LibraryItemDetail`, response types)
- Library API hooks: `helix-global-client/src/api/library.ts`
- Andrej Karpathy's LLM Wiki: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

## Attachments
- (none)

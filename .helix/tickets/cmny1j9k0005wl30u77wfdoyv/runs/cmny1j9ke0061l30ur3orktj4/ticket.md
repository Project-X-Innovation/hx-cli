# Ticket Context

- ticket_id: cmny1j9k0005wl30u77wfdoyv
- short_id: BLD-222
- run_id: cmny1j9ke0061l30ur3orktj4
- run_branch: helix/build/BLD-222-sprint-cadence-for-board-and-usage
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Sprint Cadence For Board and Usage

## Description
Go ahead

## Research Report

# Sprint Cadence for Board and Usage — Design Research Report

## Executive Summary

Helix Global currently operates as a flat kanban-style ticket system with no concept of sprints, time-bounded work cadence, or period-scoped analytics. Teams using Helix (including Project X, which runs 2-week sprints) must mentally track sprint boundaries outside the tool. The usage page shows only all-time metrics, and the existing "Backlog" status label creates a terminology collision with standard sprint methodology.

This report presents a comprehensive design for adding **lightweight sprint cadence support** to Helix Global — enough to organize work into time-bounded iterations without transforming the product into a full project-management tool. The design covers both `helix-global-server` (backend) and `helix-global-client` (frontend), while explicitly excluding changes to the `nexus` and `sprint-calendar` reference repositories per the ticket owner's instruction.

**Key design decisions:**

- **Sprint model**: A new `Sprint` table with a foreign key on `Ticket` provides clean relational sprint-ticket association. Tickets with no sprint constitute the "backlog" (unassigned work).
- **BACKLOG-to-DRAFT rename**: The existing `BACKLOG` enum value is atomically renamed to `DRAFT` using PostgreSQL's `ALTER TYPE RENAME VALUE`, migrating all 7 production records in-place with zero downtime risk.
- **Sprint-optional**: Kanban remains the default cadence mode. Organizations opt into sprint mode via a new cadence settings panel. Non-sprint organizations see no sprint UI — only the DRAFT rename.
- **Time-windowed analytics**: Optional `startDate`/`endDate` query params on the existing analytics endpoint enable period-scoped usage views. The client computes date ranges from named periods (sprint, week, month, year, all-time).
- **Board extension**: The existing 4-column board is extended with a `SprintHeader` wrapper (sprint selector + goal banner) rather than rewritten. Columns remain identical; only ticket filtering changes.
- **No new dependencies**: Both server and client implementations use only existing libraries and patterns.

The design is scoped to an **MVP** that supports the core sprint workflow: create sprints with goals, assign tickets, view sprint-scoped boards, and check period-scoped usage. Features like velocity tracking, burndown charts, auto-rollover, and sprint templates are explicitly deferred.

**Scope**: `helix-global-server` + `helix-global-client` only. `nexus` and `sprint-calendar` are reference context.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Proposed Data Model Design](#2-proposed-data-model-design)
3. [API Design](#3-api-design)
4. [Client UI Architecture](#4-client-ui-architecture)
5. [Migration & Deployment Strategy](#5-migration--deployment-strategy)
6. [Reference Patterns & Ecosystem Analysis](#6-reference-patterns--ecosystem-analysis)
7. [Open Questions, Risks, and Future Considerations](#7-open-questions-risks-and-future-considerations)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Current State Analysis

### 1.1 Server Architecture (helix-global-server)

The server is a **Node.js + Express** application written in TypeScript strict mode, using **Prisma v6.19.2** as the ORM with PostgreSQL. The architecture follows a clean `Controller -> Service -> Prisma Client` layering pattern with Zod validation at the controller boundary.

**Production database state** (verified via runtime inspection, April 2026):

| Metric | Value | Source |
|--------|-------|--------|
| Total tables | 22 (+ `_prisma_migrations`) | Runtime DB: `information_schema.tables` |
| Total tickets | 258 | Runtime DB: `SELECT COUNT(*) FROM "Ticket"` |
| BACKLOG tickets | 7 | Runtime DB: `SELECT status, COUNT(*) FROM "Ticket" GROUP BY status` |
| Organizations | 7 | Runtime DB: `SELECT COUNT(*) FROM "Organization"` |
| Applied migrations | 48 | Runtime DB: `SELECT COUNT(*) FROM _prisma_migrations` |
| Latest migration | `20260412000000_add_referenced_ticket_ids` | Runtime DB query |

**Ticket status distribution** (runtime):

| Status | Count |
|--------|-------|
| DEPLOYED | 123 |
| FAILED | 38 |
| PREVIEW_READY | 34 |
| REPORT_READY | 21 |
| SANDBOX_READY | 16 |
| UNVERIFIED | 12 |
| BACKLOG | 7 |
| IN_PROGRESS | 6 |
| RUNNING | 1 |

**TicketStatus enum** (15 values, `prisma/schema.prisma` lines 22-38):
```
QUEUED, RUNNING, MERGING, SANDBOX_READY, VERIFYING, DEPLOYING,
PREVIEW_READY, REPORT_READY, STAGING_MERGED, IN_PROGRESS,
DEPLOYED, FAILED, UNVERIFIED, WAITING, BACKLOG
```

**Organization model** (`prisma/schema.prisma` lines 128-166): 23 columns — `id`, `name`, `platform`, `defaultBranch`, `commitArtifactsToGithub`, GitHub token fields (4), inference config fields (10), `ticketCounter`, `createdAt`, `updatedAt`. **No cadence, sprint, or cadence-mode columns exist.** Confirmed by both schema inspection and runtime DB column listing.

**Ticket model** (`prisma/schema.prisma` lines 264-307): Standard ticket entity with `organizationId`, `reporterUserId`, `directorUserId`, `status`, `mode`, `ticketNumber`, `branchName`, etc. **No `sprintId` or sprint association field exists.**

**Analytics service** (`src/services/analytics-service.ts` lines 32-60): The `getUsageForOrganization` function accepts only `organizationId` with **zero date-range filtering**. Four parallel Prisma queries (`ticket.groupBy`, `ticket.groupBy` for deployed, `sandboxRun.findMany`, `user.findMany`) all filter by `organizationId` alone, aggregating the organization's entire lifetime.

**BACKLOG status creation** (`src/services/ticket-service.ts` lines 713-716):
```typescript
// If saveToBacklog and no afterTicketId (WAITING takes precedence), use BACKLOG status
if (input.saveToBacklog && !input.afterTicketId) {
  initialStatus = TicketStatus.BACKLOG;
}
```

**BACKLOG transition guard** (`src/services/ticket-service.ts` lines 1109-1114):
```typescript
const BACKLOG_ALLOWED_FROM = new Set<TicketStatus>([
  TicketStatus.QUEUED,
  TicketStatus.FAILED,
  TicketStatus.UNVERIFIED,
  TicketStatus.IN_PROGRESS,
]);
```

**Manual status update API** (`src/controllers/ticket-controller.ts` line 190):
```typescript
status: z.enum(["IN_PROGRESS", "DEPLOYED", "QUEUED", "BACKLOG"]),
```

**API routes** (`src/routes/api.ts`, 304 lines): No sprint-related endpoints exist. Analytics is at line 262 (`apiRouter.get("/analytics/usage", getUsage)`). Settings endpoints span lines 229-252.

### 1.2 Client Architecture (helix-global-client)

The client is a **React 19 + TypeScript** SPA built with **Vite 7**, using **Tailwind CSS v4** for styling (no CSS files, no inline styles per `CLAUDE.md`), **TanStack React Query v5** for server state, and **@dnd-kit/react v0.3.2** for drag-and-drop.

**Board view** (`src/routes/board.tsx` lines 36-86): Four hardcoded columns:

| Column | Status | Actions |
|--------|--------|---------|
| Backlog | `BACKLOG` | Run (-> QUEUED) |
| Not Attended | `QUEUED` | Start Working (-> IN_PROGRESS) |
| In Progress | `IN_PROGRESS` | Mark Deployed (-> DEPLOYED) |
| Done | `DEPLOYED` | Reopen, Archive |

The `getColumnIdForStatus` function (line 88-93) routes tickets to columns by status. The board uses `DragDropProvider` from @dnd-kit for column-to-column status transitions and auto-refreshes every 10 seconds when active runs are detected.

**Usage page** (`src/routes/usage.tsx`): Displays all-time summary cards (Total Tickets, Total Runs, Deploy Rate, etc.) and a per-user metrics table. No period selector exists.

**Analytics hook** (`src/api/analytics.ts`, 10 lines):
```typescript
export function usageQueryOptions() {
  return queryOptions({
    queryKey: ["analytics", "usage"] as const,
    queryFn: () => apiFetch<UsageResponse>("/analytics/usage"),
  });
}
```
No query parameters are passed — all-time only.

**Settings page** (`src/routes/settings.tsx` lines 62-68): Five tabs — General, Repositories, Integrations, Appearance, NetSuite. No cadence or sprint settings.

**TicketStatus type** (`src/types/api.ts` lines 5-21): Const object pattern (not TypeScript `enum` due to `erasableSyntaxOnly`) with 15 values including `BACKLOG: "BACKLOG"`.

**Status badge** (`src/components/status-badge.tsx` line 23): `BACKLOG: "bg-status-backlog/15 text-status-backlog"` styling.

**Format utilities** (`src/lib/format.ts` line 34): `BACKLOG: "Backlog"` label mapping.

**Draft store** (`src/api/draft-store.ts` line 11): `saveMode?: "backlog" | "run"` type for localStorage auto-save. The auto-save mechanism uses `localStorage` under the `helix_ticket_draft` key with a 300ms debounce. This is **separate from the DRAFT status concept** — the auto-save persists form state, not ticket status.

**BACKLOG references across client** (40+ references in 10 files):

| File | References | Nature |
|------|------------|--------|
| `src/types/api.ts` | `BACKLOG: "BACKLOG"` | Type definition |
| `src/routes/board.tsx` | Column config, `getColumnIdForStatus`, `targetStatus` union | Board structure |
| `src/routes/ticket-detail.tsx` | Status checks | Ticket display |
| `src/routes/dashboard.tsx` | `saveMode: 'backlog'`, "Save to Backlog" button | Ticket creation |
| `src/components/status-badge.tsx` | Color mapping | Visual styling |
| `src/lib/format.ts` | `"Backlog"` label | Display text |
| `src/lib/ticket-filters.ts` | Filter definition | Ticket filtering |
| `src/api/draft-store.ts` | `saveMode: "backlog" \| "run"` | Auto-save type |
| `src/index.css` | `--color-status-backlog` | CSS variable |

### 1.3 Six Greenfield Gaps

The diagnosis identified six specific gaps that this design addresses:

1. **No Sprint entity** — No `Sprint` model in the schema (0 of 22 tables are sprint-related)
2. **No sprint-ticket linkage** — `Ticket` model has no `sprintId` field
3. **No cadence settings** — `Organization` has no cadence mode, sprint duration, or start day fields
4. **BACKLOG terminology collision** — `BACKLOG` as a status label conflicts with sprint "backlog" semantics
5. **No time-windowed analytics** — All queries aggregate the full organization lifetime
6. **Flat board UI** — Four hardcoded columns with no sprint scoping, navigation, or goal display

---

## 2. Proposed Data Model Design

### 2.1 New Sprint Model

A new `Sprint` table is the cleanest approach for a first-class entity with its own lifecycle, dates, and goals. This follows the existing codebase pattern where each domain concept has its own table (22 tables for distinct entities).

**Prisma schema addition:**

```prisma
enum SprintStatus {
  PLANNING
  ACTIVE
  COMPLETED
}

model Sprint {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  number         Int
  goal           String?      @db.Text
  startDate      DateTime
  endDate        DateTime
  status         SprintStatus @default(PLANNING)
  tickets        Ticket[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([organizationId, number])
  @@index([organizationId, status])
  @@index([organizationId, startDate])
}
```

**Fields explained:**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | cuid | Primary key, matching existing pattern |
| `organizationId` | FK to Organization | Sprint belongs to an org |
| `number` | Int | Auto-incrementing sprint number per org (e.g., Sprint 1, Sprint 2) |
| `goal` | String? | Optional sprint goal/mission text |
| `startDate` | DateTime | Sprint start date |
| `endDate` | DateTime | Sprint end date |
| `status` | SprintStatus | Lifecycle state: PLANNING, ACTIVE, COMPLETED |

**Indexes:**
- `(organizationId, number)` — Unique constraint ensures no duplicate sprint numbers per org
- `(organizationId, status)` — Efficient `getCurrentSprint()` query (WHERE status = ACTIVE)
- `(organizationId, startDate)` — Date-range sprint queries

**Rejected alternatives:**

| Alternative | Why Rejected |
|-------------|--------------|
| JSON field on Organization | No relational integrity; complex queries; poor indexing; fights Prisma's typed query model |
| Tag-based system (sprint as ticket tag) | No start/end dates; no sprint goal; no lifecycle; poor semantics |

### 2.2 Ticket Model Addition

Add an optional `sprintId` foreign key to the existing `Ticket` model:

```prisma
model Ticket {
  // ... existing fields ...
  sprintId       String?
  sprint         Sprint?      @relation(fields: [sprintId], references: [id], onDelete: SetNull)

  // ... existing indexes ...
  @@index([sprintId])
}
```

**Semantics:**
- `sprintId = null` — Ticket is in the "backlog" (not assigned to any sprint)
- `sprintId = <id>` — Ticket is assigned to that sprint

This is a **singular FK** (one sprint per ticket), not many-to-many. A ticket can be reassigned between sprints by updating the FK. Assigning a ticket to a new sprint implicitly removes it from the old one.

**Rejected alternative:** Many-to-many via a join table. This would allow a ticket in multiple sprints simultaneously, which has unclear semantics for status tracking and board views. The product workflow is linear: Draft -> Backlog -> Sprint N -> Done.

### 2.3 Organization Model Additions

Cadence settings live directly on the `Organization` model, following the existing pattern where all org-level settings (GitHub config, inference config, platform type, etc.) are stored as columns on `Organization` (`prisma/schema.prisma` lines 128-166, 23 existing columns).

```prisma
enum CadenceMode {
  KANBAN
  SPRINT
}

model Organization {
  // ... existing fields ...
  cadenceMode         CadenceMode @default(KANBAN)
  sprintDurationWeeks Int         @default(2)
  sprintStartDay      Int         @default(1) // 0=Sunday, 1=Monday, ..., 6=Saturday
  sprintCounter       Int         @default(0)
  sprints             Sprint[]
}
```

**New fields:**

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `cadenceMode` | CadenceMode enum | KANBAN | Sprint mode or kanban mode |
| `sprintDurationWeeks` | Int | 2 | Sprint length in weeks |
| `sprintStartDay` | Int (0-6) | 1 (Monday) | Day of week sprints start |
| `sprintCounter` | Int | 0 | Atomic counter for sprint numbering |

The `sprintCounter` mirrors the existing `ticketCounter` pattern (`prisma/schema.prisma` line 162: `ticketCounter Int @default(0)`), which is atomically incremented inside a `$transaction` when creating tickets (`ticket-service.ts` lines 757-759).

**Rejected alternative:** Separate `CadenceConfig` table. Adds a JOIN for every cadence check with no MVP benefit. The ticket explicitly states cadence is org-level, not per-user or per-team. Future per-team support can migrate to a separate table if needed.

### 2.4 BACKLOG-to-DRAFT Enum Rename

The `TicketStatus` enum value `BACKLOG` is renamed to `DRAFT` using PostgreSQL's `ALTER TYPE RENAME VALUE`:

```sql
ALTER TYPE "TicketStatus" RENAME VALUE 'BACKLOG' TO 'DRAFT';
```

This approach:
- Is **atomic** — a single SQL statement
- **Automatically updates** all 7 production tickets currently holding `BACKLOG` — no separate data migration needed
- Is supported since **PostgreSQL 10+** (production confirmed compatible via existing `ALTER TYPE ADD VALUE` usage in migrations)
- Aligns with the existing migration pattern — the codebase already uses custom SQL in `migration.sql` files

**Rejected alternatives:**

| Alternative | Why Rejected |
|-------------|--------------|
| Add DRAFT + migrate data + recreate enum without BACKLOG | Complex multi-step migration; risk of downtime; Prisma enum recreation is fragile |
| Keep BACKLOG internally, display as "Draft" | Permanent semantic confusion; code must translate forever; violates terminology clarity |

### 2.5 Sprint Status Lifecycle

```
PLANNING  ──>  ACTIVE  ──>  COMPLETED
```

- **PLANNING** (default on creation): Sprint is being set up, tickets are being assigned
- **ACTIVE**: Sprint is underway. **Only one sprint can be ACTIVE per organization** (enforced in service layer)
- **COMPLETED**: Sprint has ended. Tickets remain associated for historical viewing

**Manual transitions only for MVP.** No auto-activation based on dates, no cron jobs. This aligns with the product principle of "just enough, not too much" and the explicit out-of-scope exclusion of "advanced sprint automation."

### 2.6 Sprint-Ticket Assignment Semantics

- A ticket belongs to **at most one sprint** (singular FK)
- DRAFT-status tickets can be in a sprint (planning work before execution)
- When a sprint is COMPLETED, its tickets **remain associated** for historical viewing
- Unfinished tickets in a completed sprint **stay there** (no auto-rollover in MVP)
- Users manually move tickets to the next sprint or back to backlog

### 2.7 Entity Relationship Diagram

```
Organization (1) ──── (N) Sprint
     |                       |
     |                       |
     └──── (N) Ticket (N) ──┘ (optional FK: sprintId)

Organization fields: cadenceMode, sprintDurationWeeks, sprintStartDay, sprintCounter
Sprint fields: number, goal, startDate, endDate, status (PLANNING/ACTIVE/COMPLETED)
Ticket addition: sprintId (nullable FK to Sprint)
```

---

## 3. API Design

### 3.1 New Sprint Endpoints

Seven new endpoints following the existing `Controller -> Service -> Prisma` pattern. A new `sprint-controller.ts` + `sprint-service.ts` pair handles all sprint operations.

| # | Method | Path | Purpose | Auth |
|---|--------|------|---------|------|
| 1 | `GET` | `/sprints` | List sprints for org (optional `?status=` filter) | requireAuth |
| 2 | `POST` | `/sprints` | Create a sprint | requireAuth |
| 3 | `GET` | `/sprints/:id` | Get sprint details (includes ticket count) | requireAuth |
| 4 | `PATCH` | `/sprints/:id` | Update sprint (goal, status, dates) | requireAuth |
| 5 | `DELETE` | `/sprints/:id` | Delete sprint (only PLANNING, no tickets) | requireAuth |
| 6 | `POST` | `/sprints/:id/tickets` | Assign ticket(s) to sprint | requireAuth |
| 7 | `DELETE` | `/sprints/:id/tickets/:ticketId` | Remove ticket from sprint | requireAuth |

### 3.2 Cadence Settings Endpoints

Added to the existing settings controller pattern (`src/controllers/settings-controller.ts`):

| # | Method | Path | Purpose | Auth |
|---|--------|------|---------|------|
| 8 | `GET` | `/settings/cadence` | Get org cadence configuration | requireAuth |
| 9 | `PUT` | `/settings/cadence` | Update cadence mode, duration, start day | requireAuth |

### 3.3 Modified Existing Endpoints

**GET /tickets** — Add optional `sprintId` query parameter:
- `?sprintId=<id>` — Filter tickets assigned to that sprint
- `?sprintId=none` — Filter tickets with no sprint (the "backlog" view)
- No `sprintId` param — Return all tickets (backward compatible)

**GET /analytics/usage** — Add optional date range parameters:
- `?startDate=<ISO>&endDate=<ISO>` — Filter analytics to date range
- No params — All-time (backward compatible for kanban users)

### 3.4 Detailed Endpoint Specifications

#### POST /sprints — Create Sprint

**Request body (Zod schema):**
```typescript
const createSprintSchema = z.object({
  goal: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});
```

**Response:**
```json
{
  "sprint": {
    "id": "clx...",
    "organizationId": "clx...",
    "number": 1,
    "goal": "Ship sprint cadence feature",
    "startDate": "2026-04-14T00:00:00.000Z",
    "endDate": "2026-04-28T00:00:00.000Z",
    "status": "PLANNING",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Service behavior:**
- Auto-assigns next sprint number via atomic `sprintCounter` increment (same pattern as `ticketCounter` in `ticket-service.ts` lines 757-759)
- Validates no date overlap with existing sprints
- Returns 400 if `endDate <= startDate`

#### PATCH /sprints/:id — Update Sprint

**Request body (Zod schema):**
```typescript
const updateSprintSchema = z.object({
  goal: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
```

**Status transition validation:**
- `PLANNING -> ACTIVE`: Allowed. Checks no other sprint is already ACTIVE for the org.
- `ACTIVE -> COMPLETED`: Allowed.
- All other transitions: Rejected with 409.

#### POST /sprints/:id/tickets — Assign Tickets

**Request body:**
```typescript
const assignTicketsSchema = z.object({
  ticketIds: z.array(z.string()).min(1),
});
```

**Service behavior:**
- Validates all tickets belong to the same org
- Updates `ticket.sprintId` for each ticket (implicitly removes from any previous sprint)
- Returns updated ticket list

#### GET /settings/cadence — Get Cadence Config

**Response:**
```json
{
  "cadenceMode": "KANBAN",
  "sprintDurationWeeks": 2,
  "sprintStartDay": 1
}
```

#### PUT /settings/cadence — Update Cadence Config

**Request body:**
```typescript
const updateCadenceSchema = z.object({
  cadenceMode: z.enum(["KANBAN", "SPRINT"]),
  sprintDurationWeeks: z.number().int().min(1).max(8).optional(),
  sprintStartDay: z.number().int().min(0).max(6).optional(),
});
```

#### GET /analytics/usage — Extended with Date Filtering

**New query parameters:**
```typescript
const usageQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
```

**Implementation in `analytics-service.ts`:** The existing 4 parallel queries (lines 35-60) gain conditional date WHERE clauses:

```typescript
export async function getUsageForOrganization(
  organizationId: string,
  options?: { startDate?: Date; endDate?: Date },
): Promise<UsageResult> {
  const dateFilter = options?.startDate && options?.endDate
    ? { gte: options.startDate, lte: options.endDate }
    : undefined;

  const [ticketCounts, deployedCounts, runs, users] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["reporterUserId"],
      _count: { _all: true },
      where: {
        organizationId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
    }),
    prisma.ticket.groupBy({
      by: ["reporterUserId"],
      _count: { _all: true },
      where: {
        organizationId,
        status: "DEPLOYED",
        ...(dateFilter && { createdAt: dateFilter }),
      },
    }),
    prisma.sandboxRun.findMany({
      where: {
        organizationId,
        ...(dateFilter && { startedAt: dateFilter }),
      },
      // ... existing select
    }),
    // User query unchanged (users don't have a date dimension)
    prisma.user.findMany({ where: { organizationId }, /* ... */ }),
  ]);
  // ... rest unchanged
}
```

**Date filtering basis:** Tickets filtered by `createdAt`, runs filtered by `startedAt`. These are the most semantically meaningful timestamps — a ticket "belongs" to a period based on when it was created, a run based on when it started executing.

### 3.5 Sprint Service Methods

New file: `src/services/sprint-service.ts`

| Method | Purpose |
|--------|---------|
| `listSprintsForOrganization(orgId, { status? })` | Returns sprints sorted by startDate desc |
| `createSprintForOrganization(orgId, { goal?, startDate, endDate })` | Auto-assigns next sprint number; validates no date overlap |
| `getSprintForOrganization(sprintId, orgId)` | Single sprint with ticket count |
| `updateSprint(sprintId, orgId, { goal?, status?, startDate?, endDate? })` | Status transitions: PLANNING->ACTIVE, ACTIVE->COMPLETED |
| `deleteSprint(sprintId, orgId)` | Only PLANNING sprints with no assigned tickets |
| `assignTicketsToSprint(sprintId, orgId, ticketIds[])` | Bulk assignment |
| `removeTicketFromSprint(sprintId, orgId, ticketId)` | Sets ticket.sprintId to null |
| `getCurrentSprint(orgId)` | Returns the ACTIVE sprint (at most one per org) |

### 3.6 Ticket Service Modifications

In `src/services/ticket-service.ts`:

- `createTicketForOrganization`: Rename `saveToBacklog` input to `saveToDraft`; set status to `DRAFT` instead of `BACKLOG` (lines 713-716)
- `updateTicketStatusForOrganization`: Rename `BACKLOG_ALLOWED_FROM` to `DRAFT_ALLOWED_FROM`; update all BACKLOG references to DRAFT (lines 1109-1140)
- `listTicketsForOrganization`: Accept optional `sprintId` filter param

In `src/controllers/ticket-controller.ts`:

- Update Zod schema (line 190): `z.enum(["IN_PROGRESS", "DEPLOYED", "QUEUED", "DRAFT"])`

---

## 4. Client UI Architecture

### 4.1 Board Restructuring

The existing board is **extended** with a sprint context wrapper, not rewritten. The board's column structure (Draft/Queued/InProgress/Done) remains identical in both kanban and sprint mode. The only differences are *which tickets appear* and *what UI chrome appears above the columns*.

**Component hierarchy:**

```
BoardPage (existing route)
+-- SprintHeader (new, conditional on sprint mode)
|   +-- SprintSelector (dropdown for sprint switching)
|   +-- SprintGoalBanner (goal text display)
+-- BoardColumns (existing column layout, receives filtered tickets)
|   +-- BoardColumn (existing, renamed BACKLOG -> DRAFT)
|   |   +-- BoardCard (existing)
|   +-- ... (3 more columns)
+-- (kanban mode: no SprintHeader, all tickets shown)
```

**Sprint-scoped ticket filtering:** When a sprint is selected, the `ticketsQueryOptions` hook passes `sprintId` to the API, and only that sprint's tickets appear on the board. When "Backlog" (unassigned) is selected, `sprintId=none` is passed.

### 4.2 Sprint Navigation UX

A **dropdown selector** above the board with segmented groups:

| Section | Contents | Behavior |
|---------|----------|----------|
| **Current Sprint** | The ACTIVE sprint (highlighted, default selection) | Bold/emphasized |
| **Upcoming Sprints** | PLANNING sprints, sorted by startDate | Expandable list |
| **Backlog** | "Unassigned Tickets" special item | Shows tickets with no sprint |
| **Historical Sprints** | COMPLETED sprints, sorted by endDate desc | Collapsed by default |

This keeps the board layout unchanged (full-width 4 columns) and uses URL searchParams for sprint selection (`?sprint=<id>` or `?sprint=backlog`), matching the existing `useSearchParams()` pattern in `settings.tsx` (line 45). Sprint selection enables deep linking and browser back/forward navigation.

### 4.3 BACKLOG-to-DRAFT Client Rename

Systematic replacement across 10 source files. TypeScript strict mode catches any missed references at compile time (`npm run typecheck`).

**Complete change list:**

| # | File | Change |
|---|------|--------|
| 1 | `src/types/api.ts` (line 20) | `BACKLOG: "BACKLOG"` -> `DRAFT: "DRAFT"` |
| 2 | `src/routes/board.tsx` (lines 36-48) | Column: `columnId: "backlog"` -> `"draft"`, `title: "Backlog"` -> `"Draft"`, `targetStatus: "BACKLOG"` -> `"DRAFT"`, `emptyMessage: "No backlog tickets"` -> `"No draft tickets"` |
| 3 | `src/routes/board.tsx` (line 25) | `targetStatus` type: `"BACKLOG"` -> `"DRAFT"` in union |
| 4 | `src/routes/board.tsx` (line 89) | `getColumnIdForStatus`: `"BACKLOG"` -> `"DRAFT"` returns `"draft"` |
| 5 | `src/routes/ticket-detail.tsx` | All `status === "BACKLOG"` checks -> `"DRAFT"` |
| 6 | `src/routes/dashboard.tsx` | `saveMode: 'backlog'` -> `'draft'`; "Save to Backlog" -> "Save to Draft" |
| 7 | `src/components/status-badge.tsx` (line 23) | `BACKLOG: "bg-status-backlog/15 ..."` -> `DRAFT: "bg-status-draft/15 text-status-draft"` |
| 8 | `src/lib/format.ts` (line 34) | `BACKLOG: "Backlog"` -> `DRAFT: "Draft"` |
| 9 | `src/lib/ticket-filters.ts` | Filter value/label for BACKLOG -> DRAFT |
| 10 | `src/api/draft-store.ts` (line 11) | `saveMode?: "backlog" \| "run"` -> `"draft" \| "run"` |
| 11 | `src/index.css` (line 128) | `--color-status-backlog` -> `--color-status-draft` |

**Backward compatibility for localStorage drafts:** If a user has an auto-saved draft with `saveMode: 'backlog'`, treat it as `saveMode: 'draft'` when reading. A simple fallback in `getTicketDraft`:

```typescript
const draft = JSON.parse(raw) as TicketDraft;
if ((draft.saveMode as string) === 'backlog') {
  draft.saveMode = 'draft';
}
return draft;
```

### 4.4 Usage Page Period Selector

A **dropdown select** with predefined named periods:

| Period | Available | Default For | startDate | endDate |
|--------|-----------|-------------|-----------|---------|
| Current Sprint | Sprint mode only | Sprint orgs | Active sprint's startDate | Active sprint's endDate |
| This Week | Always | — | Monday 00:00 | Now |
| This Month | Always | Kanban orgs | 1st of month | Now |
| This Year | Always | — | Jan 1 | Now |
| All Time | Always | — | No params (backward compatible) | No params |

The client computes `startDate`/`endDate` locally from the selection and passes them as query params to the analytics API. The TanStack Query key includes the date params for proper cache segmentation:
```typescript
queryKey: ["analytics", "usage", { startDate, endDate }] as const,
```

**Date computation should happen during render** (not in a `useEffect`), per Vercel React best practices (`rerender-derived-state-no-effect`). Derive the date range from the selected period and sprint data:

```typescript
const dateRange = useMemo(() => {
  switch (selectedPeriod) {
    case 'sprint': return { startDate: activeSprint?.startDate, endDate: activeSprint?.endDate };
    case 'week': return { startDate: getMonday(), endDate: new Date().toISOString() };
    case 'month': return { startDate: getFirstOfMonth(), endDate: new Date().toISOString() };
    case 'year': return { startDate: getFirstOfYear(), endDate: new Date().toISOString() };
    default: return {};
  }
}, [selectedPeriod, activeSprint]);
```

### 4.5 Cadence Settings Tab

A new tab in the existing settings page, following the exact pattern of the 5 existing tabs.

**Changes to `src/routes/settings.tsx`:**
1. Add `"cadence"` to `TabId` union type (line 12)
2. Add `{ id: "cadence", label: "Cadence" }` to `tabs` array (lines 62-68)
3. Import and render `CadenceTab` component

**New component: `src/routes/settings/cadence-tab.tsx`:**

| Control | Type | Behavior |
|---------|------|----------|
| Cadence Mode | Radio buttons (Kanban / Sprint) | Toggles sprint mode on/off |
| Sprint Duration | Dropdown (1-4 weeks) | Disabled in kanban mode |
| Sprint Start Day | Dropdown (Monday-Sunday) | Disabled in kanban mode |

**API hooks: `src/api/cadence.ts`:**
```typescript
export function cadenceQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "cadence"] as const,
    queryFn: () => apiFetch<CadenceConfig>("/settings/cadence"),
  });
}

export function useUpdateCadence() {
  return useMutation({
    mutationFn: (data: Partial<CadenceConfig>) =>
      apiFetch("/settings/cadence", { method: "PUT", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "cadence"] }),
  });
}
```

### 4.6 Sprint Types and Hooks

**New types** (added to `src/types/api.ts`, following the existing const object pattern):

```typescript
export const SprintStatus = {
  PLANNING: "PLANNING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;
export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];

export type Sprint = {
  id: string;
  organizationId: string;
  number: number;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  createdAt: string;
  updatedAt: string;
};

export const CadenceMode = {
  KANBAN: "KANBAN",
  SPRINT: "SPRINT",
} as const;
export type CadenceMode = (typeof CadenceMode)[keyof typeof CadenceMode];

export type CadenceConfig = {
  cadenceMode: CadenceMode;
  sprintDurationWeeks: number;
  sprintStartDay: number;
};
```

**New hooks** (`src/api/sprints.ts`):

| Hook | Purpose |
|------|---------|
| `sprintsQueryOptions({ status? })` | List sprints for org |
| `sprintQueryOptions(sprintId)` | Single sprint detail |
| `currentSprintQueryOptions()` | Active sprint shortcut |
| `useCreateSprint()` | Create mutation |
| `useUpdateSprint()` | Update mutation |
| `useDeleteSprint()` | Delete mutation |
| `useAssignTicketsToSprint()` | Bulk ticket assignment |
| `useRemoveTicketFromSprint()` | Single ticket removal |

**Modified hooks:**
- `ticketsQueryOptions` gains optional `sprintId` param
- `usageQueryOptions` gains optional `startDate`/`endDate` params

### 4.7 Sprint Assignment UX

A **sprint assignment dropdown** on the ticket detail view. When a user opens a ticket, they see a "Sprint" field with a dropdown of available sprints (PLANNING and ACTIVE) plus a "Backlog (no sprint)" option.

This is the simplest MVP pattern. Bulk assignment from the backlog view and drag-and-drop between sprint views are deferred to future iterations.

### 4.8 Conditional Sprint UI Rendering

The cadence mode determines whether sprint UI appears. Per Vercel React best practices (`rerender-derived-state`), a `useIsSprintMode()` hook derives a boolean from the cadence config:

```typescript
function useIsSprintMode(): boolean {
  const { data } = useQuery(cadenceQueryOptions());
  return data?.cadenceMode === "SPRINT";
}
```

Board, usage, and other components subscribe to this **boolean**, not the full config, reducing re-renders when unrelated config fields change.

### 4.9 Performance Patterns

| Pattern | Application | Vercel Best Practice |
|---------|-------------|---------------------|
| Derived state boolean | `useIsSprintMode()` returns boolean, not full config | `rerender-derived-state` |
| Deferred reads | Board subscribes to sprintId URL param, not full Sprint object | `rerender-defer-reads` |
| No-effect computation | Date ranges computed during render, not in useEffect | `rerender-derived-state-no-effect` |
| Parallel queries | Sprint list + cadence config load in parallel on board mount | `async-parallel` (via TanStack Query) |
| Query deduplication | Sprint and cadence queries deduplicated across components | TanStack Query built-in |

---

## 5. Migration & Deployment Strategy

### 5.1 Single Prisma Migration

All schema changes are bundled into a **single Prisma migration**:

1. Create `SprintStatus` enum
2. Create `CadenceMode` enum
3. Create `Sprint` table with indexes
4. Add `sprintId` FK column to `Ticket` table with index
5. Add cadence fields to `Organization` table
6. Add `sprintCounter` to `Organization` table
7. Rename `BACKLOG` to `DRAFT` in `TicketStatus` enum

**Migration SQL (custom, in `migration.sql`):**

```sql
-- CreateEnum: SprintStatus
CREATE TYPE "SprintStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED');

-- CreateEnum: CadenceMode
CREATE TYPE "CadenceMode" AS ENUM ('KANBAN', 'SPRINT');

-- CreateTable: Sprint
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Sprint unique constraint
CREATE UNIQUE INDEX "Sprint_organizationId_number_key" ON "Sprint"("organizationId", "number");

-- CreateIndex: Sprint performance indexes
CREATE INDEX "Sprint_organizationId_status_idx" ON "Sprint"("organizationId", "status");
CREATE INDEX "Sprint_organizationId_startDate_idx" ON "Sprint"("organizationId", "startDate");

-- AddForeignKey: Sprint -> Organization
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add sprintId to Ticket
ALTER TABLE "Ticket" ADD COLUMN "sprintId" TEXT;

-- CreateIndex: Ticket sprintId index
CREATE INDEX "Ticket_sprintId_idx" ON "Ticket"("sprintId");

-- AddForeignKey: Ticket -> Sprint
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sprintId_fkey"
    FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add cadence fields to Organization
ALTER TABLE "Organization" ADD COLUMN "cadenceMode" "CadenceMode" NOT NULL DEFAULT 'KANBAN';
ALTER TABLE "Organization" ADD COLUMN "sprintDurationWeeks" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Organization" ADD COLUMN "sprintStartDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Organization" ADD COLUMN "sprintCounter" INTEGER NOT NULL DEFAULT 0;

-- RenameEnumValue: BACKLOG -> DRAFT
ALTER TYPE "TicketStatus" RENAME VALUE 'BACKLOG' TO 'DRAFT';
```

### 5.2 Deployment Safety

The build script runs `prisma migrate deploy` **before** starting the server (`package.json` build: `tsc --pretty && prisma migrate deploy`). This means:

1. Migration runs first (schema changes applied to DB)
2. New server code starts (references DRAFT, Sprint, etc.)
3. No window where old code runs against new schema (atomic deploy)

**The BACKLOG->DRAFT rename is safe because:**
- `ALTER TYPE RENAME VALUE` is atomic — all 7 production BACKLOG tickets instantly become DRAFT
- The new server code references `DRAFT` everywhere
- The migration and code deploy are atomic (build script runs migration before starting)

### 5.3 Backward Compatibility

- **Kanban is the default** — all 7 existing organizations get `cadenceMode: KANBAN`, `sprintDurationWeeks: 2`, `sprintStartDay: 1`
- **No behavior change for kanban orgs** — they see no sprint UI, board works as before, usage works as before
- **The only visible change for all orgs** is the BACKLOG -> DRAFT rename in status labels and board column title
- **All existing tickets retain their meaning** — the 7 BACKLOG tickets become DRAFT tickets, which means the same thing (parked/not-yet-started)
- **Analytics backward compatible** — omitting date params returns all-time data, identical to current behavior

### 5.4 Rollback Considerations

If the migration needs to be reverted:

1. **Revert the DRAFT->BACKLOG rename:** `ALTER TYPE "TicketStatus" RENAME VALUE 'DRAFT' TO 'BACKLOG'`
2. **Remove Organization cadence fields:** `ALTER TABLE "Organization" DROP COLUMN "cadenceMode", DROP COLUMN "sprintDurationWeeks", DROP COLUMN "sprintStartDay", DROP COLUMN "sprintCounter"`
3. **Remove Ticket sprintId:** `ALTER TABLE "Ticket" DROP COLUMN "sprintId"`
4. **Drop Sprint table:** `DROP TABLE "Sprint"`
5. **Drop new enums:** `DROP TYPE "SprintStatus"`, `DROP TYPE "CadenceMode"`

Since no sprints will have been created yet at deploy time, no data loss occurs beyond resetting the 7 DRAFT tickets back to BACKLOG.

---

## 6. Reference Patterns & Ecosystem Analysis

### 6.1 Nexus Patterns

The `nexus` repo (Fabiola's project) is a Next.js + Drizzle ORM ticketing system with sprint-adjacent patterns. Per the ticket owner's explicit instruction: *"These are projects worked on by Fabiola, a teammate of ours. [...] This ticket is not meant to work on them."*

**Patterns observed:**

| Pattern | Location | Adopted? | Rationale |
|---------|----------|----------|-----------|
| `sprintEstimate` field (integer) on tickets | `nexus/lib/db/schema.ts` line 41 | No (informational) | Sprint estimation is explicitly out of scope for MVP. No story points or effort estimation in Helix Global. |
| `queueRank` field (integer) on tickets | `nexus/lib/db/schema.ts` line 39 | No (informational) | Rank-based ordering is a different UX pattern. Helix Global uses status-based columns. |
| `TEAM_VELOCITY = 8` constant | `nexus/lib/ticketData.ts` line 7 | No (informational) | Velocity tracking is explicitly deferred to future. Informs a potential Round 2 feature. |
| `calculateSprintEstimate(position)` | `nexus/app/(protected)/tech/page.tsx` line 134 | No (informational) | Uses `Math.ceil(position / TEAM_VELOCITY)` — a simple capacity model. Deferred to future. |
| Status values: `backlog, selected, in-progress, waiting, pending-deploy, resolved, cancelled` | `nexus/lib/db/schema.ts` line 34 | Partially (informational) | Nexus uses string-based statuses vs Helix Global's enum. The "backlog" vs "selected" distinction informs the DRAFT/Backlog terminology split. |
| Queue API with rank-based ordering | `nexus/app/api/queue/route.ts` | No (informational) | Atomic rank updates for queue prioritization — a different paradigm from sprint assignment. |

**Key takeaway:** Nexus demonstrates that sprint-adjacent concepts (estimation, velocity, queue ranking) can coexist in a ticketing system without making it a full project management tool. The TEAM_VELOCITY and sprintEstimate patterns provide a roadmap for future Helix Global enhancements, but are not needed for the MVP.

### 6.2 Sprint-Calendar

The `sprint-calendar` repo is effectively empty — only a `.helix/` directory exists. No implementation, no schema, no code. It provides no design patterns to reference.

### 6.3 Design Influence Summary

The reference repos informed decisions without dictating them:

- Nexus's separation of `backlog` and `selected` statuses validated the BACKLOG-to-DRAFT terminology change
- Nexus's `sprintEstimate` and `TEAM_VELOCITY` patterns confirm a natural extension path for Round 2
- The empty sprint-calendar repo indicates this is a greenfield design space — there's no existing implementation to align with or break from

**Explicit boundary:** No changes are made to nexus or sprint-calendar. These repos remain context-only per the ticket owner's instruction.

---

## 7. Open Questions, Risks, and Future Considerations

### 7.1 Open Questions with Recommendations

| # | Question | Recommended Resolution | Rationale |
|---|----------|----------------------|-----------|
| 1 | **BACKLOG enum rename strategy** | Use `ALTER TYPE RENAME VALUE` (in-place rename) | Atomic, no data migration needed, simplest approach. The 7 production tickets auto-update. Deploy window risk is mitigated by atomic build-then-start pattern. |
| 2 | **Sprint end behavior for unfinished tickets** | Unfinished tickets remain in the completed sprint | Manual control gives users full visibility. Auto-rollover is explicitly out of scope for MVP. Users move tickets to next sprint or backlog manually. |
| 3 | **Cadence config storage** | Fields on Organization model | Follows existing pattern (all 23 org settings are columns). Separate table adds complexity with no MVP benefit. Future per-team sprints can migrate to a separate table. |
| 4 | **Analytics date filtering basis** | Tickets by `createdAt`, runs by `startedAt` | Most semantically meaningful — a ticket "belongs" to a period when created, a run when started. Avoids coupling analytics to sprint assignment. |
| 5 | **Sprint-calendar integration** | No integration needed | Repo is empty. No implementation to integrate with. Future alignment can be revisited if sprint-calendar gains an implementation. |
| 6 | **Auto-save "draft" UX / button text** | "Save to Draft" button text is appropriate | The auto-save form state is silent and unlabeled (per ticket: "just save your thing"). The "Save to Draft" button explicitly creates a ticket with DRAFT status — a different concept. The label accurately describes the action. |
| 7 | **Sprint activation** | Manual activation only in MVP | No cron jobs, no date-based auto-activation. The admin explicitly transitions a sprint from PLANNING to ACTIVE. Aligns with "just enough, not too much" principle. |

### 7.2 Risk Register

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| 1 | **BACKLOG->DRAFT enum rename during deploy** | Medium | Low | `ALTER TYPE RENAME VALUE` is atomic. Build script runs migration before starting server — no window where old code runs against new schema. |
| 2 | **Single ACTIVE sprint constraint not enforced at DB level** | Low | Low | Enforced in service layer. Prisma doesn't support conditional unique indexes natively. Service-level check is sufficient at current scale (7 orgs). |
| 3 | **Sprint date overlap** | Low | Low | Validated in service layer on create/update. No hard DB constraint needed for MVP. |
| 4 | **Board complexity increase with sprint mode conditionals** | Medium | Medium | Mitigated by keeping sprint vs kanban branching at the top level (SprintHeader shown/hidden). Column logic and card rendering are mode-agnostic. |
| 5 | **40+ BACKLOG reference rename misses a reference** | Low | Low | TypeScript strict mode catches any remaining BACKLOG references at compile time. `npm run typecheck` validates completeness. |
| 6 | **localStorage draft backward compatibility** | Low | Low | Simple fallback: treat `saveMode: 'backlog'` as `'draft'` when reading. One-line guard in `getTicketDraft`. |
| 7 | **Analytics query perf with date filters** | Low | Low | Date-filtered queries should be *faster* than all-time (smaller dataset). Existing `organizationId` indexes handle the primary filter. Add index on `Ticket.createdAt` and `SandboxRun.startedAt` only if needed. |

### 7.3 Future Considerations (Explicitly Out of Scope for MVP)

These features are deferred to Round 2 or later. They are documented here for roadmap planning:

| Feature | Complexity | Prerequisite |
|---------|-----------|--------------|
| Sprint velocity/burndown charts | Medium | Sprint model + historical data |
| Auto-rollover of incomplete tickets | Low | Sprint completion workflow |
| Recurring/template sprint creation | Medium | Sprint model + cadence settings |
| Per-team sprints within an org | High | Separate CadenceConfig table, team concept |
| Sprint reports & historical comparisons | Medium | Sprint model + analytics |
| Auto-activation by date ranges | Medium | Cron job or check-on-access pattern |
| Drag-and-drop between sprint views | Medium | Board sprint awareness |
| Story points / effort estimation | Low | New field on Ticket model |
| Sprint retrospective features | High | Sprint model + new UI surfaces |
| Partial unique index for ACTIVE constraint | Low | Custom Prisma migration |

---

## 8. Implementation Roadmap

### 8.1 Phase Ordering

The implementation must follow a strict dependency order: **server first, then client**. The client depends on server API endpoints that don't exist yet.

### 8.2 Phase 1 — Server Foundation (Prisma Schema + Migration)

**Goal:** Create the Sprint model, add cadence fields to Organization, rename BACKLOG to DRAFT.

**Changes:**
- Modify `prisma/schema.prisma`: Add `SprintStatus` enum, `CadenceMode` enum, `Sprint` model, `sprintId` on Ticket, cadence fields on Organization, `sprintCounter` on Organization, rename `BACKLOG` to `DRAFT` in `TicketStatus`
- Generate migration: `npx prisma migrate dev --name add_sprint_cadence`
- The migration SQL will need customization for the `RENAME VALUE` statement

**Files changed:** 2 (schema + migration)

### 8.3 Phase 2 — Server API

**Goal:** Implement sprint CRUD, cadence settings, and time-windowed analytics endpoints.

**Changes:**
- New: `src/services/sprint-service.ts` — Sprint CRUD + assignment logic
- New: `src/controllers/sprint-controller.ts` — HTTP handlers with Zod validation
- Modify: `src/routes/api.ts` — Register sprint and cadence routes
- Modify: `src/controllers/settings-controller.ts` — Add cadence GET/PUT handlers
- Modify: `src/services/settings-service.ts` — Add cadence read/write methods
- Modify: `src/services/analytics-service.ts` — Add date range params
- Modify: `src/controllers/analytics-controller.ts` — Parse date query params
- Modify: `src/services/ticket-service.ts` — Rename BACKLOG references to DRAFT, add sprintId filter
- Modify: `src/controllers/ticket-controller.ts` — Update Zod enum, rename BACKLOG to DRAFT

**Files changed:** 9 (2 new + 7 modified)

### 8.4 Phase 3 — Client Foundation

**Goal:** Add types, hooks, and perform the BACKLOG-to-DRAFT rename.

**Changes:**
- Modify: `src/types/api.ts` — Add Sprint, SprintStatus, CadenceMode, CadenceConfig types; rename BACKLOG to DRAFT
- New: `src/api/sprints.ts` — Sprint CRUD hooks
- New: `src/api/cadence.ts` — Cadence settings hooks
- Modify: `src/api/analytics.ts` — Add date range params to usageQueryOptions
- Modify: `src/api/tickets.ts` — Add sprintId param to ticketsQueryOptions
- Modify: `src/api/draft-store.ts` — Rename saveMode 'backlog' to 'draft' with backward compat
- Modify: `src/lib/format.ts` — Rename BACKLOG label to "Draft"
- Modify: `src/lib/ticket-filters.ts` — Rename BACKLOG filter
- Modify: `src/components/status-badge.tsx` — Rename BACKLOG styling to DRAFT
- Modify: `src/index.css` — Rename CSS variable

**Files changed:** 10 (2 new + 8 modified)

### 8.5 Phase 4 — Client UI

**Goal:** Build sprint-aware board, cadence settings tab, usage period selector, sprint assignment.

**Changes:**
- Modify: `src/routes/board.tsx` — Add SprintHeader, rename BACKLOG column to Draft, sprint-scoped ticket filtering
- New: `src/components/sprint-header.tsx` — Sprint selector dropdown + goal banner
- Modify: `src/routes/usage.tsx` — Add period selector dropdown
- Modify: `src/routes/settings.tsx` — Add cadence tab to tab list
- New: `src/routes/settings/cadence-tab.tsx` — Cadence mode toggle, duration, start day
- Modify: `src/routes/ticket-detail.tsx` — Add sprint assignment dropdown, rename BACKLOG references
- Modify: `src/routes/dashboard.tsx` — Rename 'backlog' saveMode and button text

**Files changed:** 7 (2 new + 5 modified)

### 8.6 Phase 5 — Integration Testing

**Goal:** Verify end-to-end workflows.

**Test scenarios:**
1. Create sprint -> assign tickets -> activate -> view on board -> complete sprint
2. Kanban mode: verify no sprint UI, board works as before with DRAFT column
3. Period-scoped analytics: select "This Week", verify filtered data
4. Cadence settings: toggle sprint mode, change duration, verify persistence
5. Sprint assignment: assign ticket from detail view, verify board updates
6. Historical sprint: complete a sprint, verify it appears in historical section

### 8.7 Estimated Change Summary

| Repo | New Files | Modified Files | Total |
|------|-----------|----------------|-------|
| helix-global-server | 3 (sprint-service, sprint-controller, migration) | 7 (schema, routes, controllers, services) | 10 |
| helix-global-client | 4 (sprints.ts, cadence.ts, sprint-header, cadence-tab) | 13 (types, board, usage, settings, ticket-detail, dashboard, format, filters, draft-store, status-badge, analytics, tickets, css) | 17 |
| **Total** | **7** | **20** | **27** |

### 8.8 Dependency Graph

```
Phase 1 (Server Schema)
    |
    v
Phase 2 (Server API)
    |
    v
Phase 3 (Client Foundation) -----> Phase 4 (Client UI)
                                        |
                                        v
                                Phase 5 (Integration Testing)
```

Phases 1-2 must complete before Phases 3-4. Phases 3 and 4 can be partially parallelized (types/hooks don't depend on UI components), but Phase 4 depends on Phase 3 types being defined.

---

## Data Sources and Methodology

This report synthesizes findings from the following sources:

### Runtime Evidence
- **Production database queries** via Helix Inspect (DATABASE type, helix-global-server): Ticket status distribution, Organization table columns, table inventory, migration count, latest migrations
- All queries were read-only; no production data was modified

### Source Code Inspection
- **helix-global-server**: `prisma/schema.prisma`, `src/services/ticket-service.ts`, `src/services/analytics-service.ts`, `src/controllers/ticket-controller.ts`, `src/controllers/settings-controller.ts`, `src/routes/api.ts`, `package.json`
- **helix-global-client**: `src/routes/board.tsx`, `src/routes/settings.tsx`, `src/types/api.ts`, `src/api/analytics.ts`, `src/api/draft-store.ts`, `src/components/status-badge.tsx`, `src/lib/format.ts`, `CLAUDE.md`
- **nexus** (reference only): `lib/db/schema.ts`, `lib/ticketData.ts`, `app/(protected)/tech/page.tsx`
- **sprint-calendar** (reference only): Empty repo (`.helix/` only)

### Prior Workflow Artifacts
- Scout summaries and reference maps (both repos)
- Diagnosis statements and APL (both repos)
- Product specifications (both repos)
- Tech research documents and APL (both repos)
- Repo guidance classification

---

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-global-server) | Primary requirements | Sprint cadence for board/usage; BACKLOG->DRAFT rename; sprint and kanban modes; nexus/sprint-calendar are reference-only |
| product/product.md (helix-global-server) | Product vision and success criteria | 7 success criteria, 11 essential features, kanban-default design principle |
| product/product.md (helix-global-client) | Client product requirements | Sprint-scoped board, draft rename, usage period selector, cadence settings tab |
| tech-research/tech-research.md (helix-global-server) | Server architecture decisions | 5 decisions: Sprint model, cadence on Org, ALTER TYPE RENAME, date params on analytics, 9 API endpoints |
| tech-research/tech-research.md (helix-global-client) | Client architecture decisions | 7 decisions: extend board, dropdown selector, systematic rename, dropdown period, cadence tab, Sprint types, URL params |
| tech-research/apl.json (helix-global-server) | Decision rationale chains | 6 Q&A pairs grounding server decisions |
| tech-research/apl.json (helix-global-client) | Decision rationale chains | 6 Q&A pairs grounding client decisions |
| diagnosis/diagnosis-statement.md (helix-global-server) | Root cause analysis | 6 greenfield gaps identified with production evidence |
| diagnosis/diagnosis-statement.md (helix-global-client) | Client root cause analysis | 6 client gaps, 40+ BACKLOG references, auto-save unaffected |
| scout/scout-summary.md (helix-global-server) | Server architecture baseline | Prisma v6.19.2, 48 migrations, no Sprint model, controller->service pattern |
| scout/scout-summary.md (helix-global-client) | Client architecture baseline | React 19, @dnd-kit/react, TanStack Query v5, Tailwind v4, 5 settings tabs |
| scout/reference-map.json (helix-global-server) | Detailed server evidence | 7 BACKLOG tickets, BACKLOG_ALLOWED_FROM transition set, 22 tables |
| scout/reference-map.json (helix-global-client) | Detailed client evidence | 40+ BACKLOG references, saveMode 'backlog'\|'run', board column config |
| repo-guidance.json | Repo scope | helix-global-server + helix-global-client are targets; nexus + sprint-calendar are context-only |
| Runtime DB (helix-global-server) | Production state verification | 258 tickets (7 BACKLOG), 7 orgs, 22 tables, 48 migrations, Organization column inventory |
| prisma/schema.prisma | Direct schema inspection | TicketStatus enum (line 22-38), Organization model (lines 128-166), Ticket model (lines 264-307) |
| src/services/ticket-service.ts | BACKLOG status logic | saveToBacklog flag (lines 713-716), BACKLOG_ALLOWED_FROM (lines 1109-1114) |
| src/services/analytics-service.ts | Analytics implementation | 4 parallel queries (lines 35-60), zero date filtering |
| src/routes/board.tsx | Board column structure | 4 columns (lines 36-86), getColumnIdForStatus (line 88-93) |
| nexus/lib/db/schema.ts | Sprint-adjacent patterns | sprintEstimate (line 41), queueRank (line 39), status values (line 34) |
| nexus/lib/ticketData.ts | Velocity pattern | TEAM_VELOCITY = 8 (line 7), calculateSprintEstimate function |

## Attachments
- (none)

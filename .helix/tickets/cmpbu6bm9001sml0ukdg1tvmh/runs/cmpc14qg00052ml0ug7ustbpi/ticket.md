# Ticket Context

- ticket_id: cmpbu6bm9001sml0ukdg1tvmh
- short_id: FIX-496
- run_id: cmpc14qg00052ml0ug7ustbpi
- run_branch: helix/fix/FIX-496-implement-hlx-cli-doesn-t-include-after-or-other
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Implement: hlx CLI doesn't include after or other ticket reference

## Description
I want to point out something as well. I'm not sure if you can directly run a ticket from the CLI but you definitely should be able to. If they see an only queue a ticket but not run it, there should be an option to run it, maybe to create it and run, maybe to create and then run, maybe both. I'll leave it up to you.

## Research Report

# Ticket Relationship Support in the Helix CLI

## Executive Summary

The `hlx` CLI currently has **zero support** for ticket relationships, despite the server API and web UI fully supporting dependency chains (`afterTicketId`), informational cross-references (`referencedTicketIds`), and research-to-implementation links (`implementFromTicketId`). The recommended solution adds three new flags to `hlx tickets create` (`--after`, `--reference`, `--implement-from`), extends the `tickets get` and `tickets list` displays to render relationship data, and updates all documentation surfaces. This is a single-repo change in `helix-cli` touching 7 files, requiring no new dependencies, no server modifications, and no client changes. The server API is fully ready and already returns rich relationship data on both detail and list endpoints.

---

## 1. Current State Analysis

### What the CLI Can Do Today

The `hlx tickets create` command accepts four fields:

```
hlx tickets create --title <title> --description <desc> | --description-file <path> --repos <name1,name2> [--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>]
```

The POST body sent to the server contains only `{ title, description, repositoryIds, mode }`.

**Source:** `helix-cli/src/tickets/create.ts`, lines 89-93:
```typescript
const data = (await hxFetch(config, "/tickets", {
  method: "POST",
  body: { title, description, repositoryIds, ...(mode && { mode }) },
  basePath: "/api",
})) as CreateTicketResponse;
```

The display commands are also incomplete:
- **`tickets get`** renders title, shortId, status, branch, reporter, archived state, repositories, and runs — but no relationship data. The `TicketDetail` type (lines 5-23) omits all relationship fields.
- **`tickets list`** renders shortId, ID abbreviation, status, reporter, updated date, title, and approval tag — but no dependency indicators. The `TicketItem` type (lines 5-13) omits relationship fields entirely.

A grep across the entire `helix-cli` codebase for `afterTicketId`, `referencedTicketIds`, or `implementFromTicketId` returns **zero matches**.

### What the Web UI Can Do

The Helix web client provides three interactive mechanisms for setting relationships during ticket creation:

| Mechanism | Trigger | Server Field | UI Component |
|-----------|---------|--------------|--------------|
| Dependency chain | `/after` slash command | `afterTicketId` | `DependencyChip` |
| Research link | `/implement` slash command | `implementFromTicketId` | `ImplementChip` |
| Cross-reference | `#` hashtag reference | `referencedTicketIds[]` | `ReferenceChip` |

The ticket detail view renders a "Related Tickets" section showing all three relationship types.

**Source:** `helix-global-client/src/routes/ticket-detail.tsx`, lines 2117-2144.

### The Gap

CLI-primary users and automation workflows that create tickets programmatically cannot:
1. Chain tickets into dependency sequences using `--after`
2. Add informational cross-references to related tickets
3. Link implementation tickets to completed research tickets
4. See any relationship data when viewing tickets via `tickets get` or `tickets list`

This means users who manage projects through the CLI cannot decompose projects into ordered ticket chains or link related work — capabilities that are fully available in the web UI.

---

## 2. Server API Contract

The server API is complete and requires no changes. This section documents the exact contract the CLI must conform to.

### POST `/api/tickets` — Create Ticket

The Zod schema `createTicketSchemaGeneral` accepts these relationship fields alongside the existing required fields:

**Source:** `helix-global-server/src/controllers/ticket-controller.ts`, lines 29-40:
```typescript
const createTicketSchemaGeneral = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(10_000),
  repositoryIds: z.array(z.string().trim().min(1)).min(1).max(20),
  afterTicketId: z.string().trim().min(1).optional(),
  implementFromTicketId: z.string().trim().min(1).optional(),
  // ... other fields ...
  mode: ticketModeEnum.optional(),
  referencedTicketIds: z.array(z.string().trim().min(1)).max(5).optional(),
});
```

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `afterTicketId` | `string` | No | Valid ticket ID in same org |
| `implementFromTicketId` | `string` | No | Valid ticket ID in same org |
| `referencedTicketIds` | `string[]` | No | Max 5 items, all valid IDs in same org |

### Server Validation Rules

The server performs thorough validation before creating the ticket. All validation logic is in `helix-global-server/src/services/ticket-service.ts`:

#### `afterTicketId` Validation (lines 688-736)

1. **Existence + org check:** Predecessor must exist in the same organization.
2. **Status guard:** Predecessor must not be DEPLOYED or STAGING_MERGED.
3. **Circular dependency detection:** Walks the `afterTicketId` chain up to 20 ancestors. If the new ticket's `afterTicketId` appears in its own ancestor chain, rejects with `"Circular dependency detected."`.
4. **Initial status setting:** If predecessor's latest run is SUCCEEDED or MERGED, the new ticket starts as QUEUED (ready to run). Otherwise, it starts as WAITING (blocked until predecessor completes).

#### `implementFromTicketId` Validation (lines 668-685)

1. **Existence + org check:** Target ticket must exist in the same organization.
2. **Mode check:** Target must be a RESEARCH mode ticket.
3. **Status check:** Target must have REPORT_READY status.

#### `referencedTicketIds` Validation (lines 760-777)

1. **Existence + org check:** All referenced tickets must exist in the same organization.
2. **Individual error:** If any ID fails validation, the error message includes the specific failing ID.

### Error Response Format

**Source:** `helix-global-server/src/app.ts`, lines 84-98:

| Error Type | HTTP Status | Response Shape |
|------------|-------------|----------------|
| Validation failure (`HttpError`) | 400 | `{ "error": "Human-readable message" }` |
| Schema failure (`ZodError`) | 400 | `{ "error": "Invalid request payload.", "details": [...] }` |

Example error messages from the validation logic:
- `"afterTicketId references a ticket that does not exist or belongs to a different organization."`
- `"afterTicketId references a ticket that is already deployed or merged to staging."`
- `"Circular dependency detected."`
- `"implementFromTicketId must reference a RESEARCH mode ticket."`
- `"implementFromTicketId must reference a ticket with REPORT_READY status."`
- `"referencedTicketIds contains a ticket that does not exist or belongs to a different organization: <id>"`

### GET `/api/tickets/:id` — Ticket Detail Response

The detail endpoint returns rich nested relationship objects.

**Source:** `helix-global-server/src/services/ticket-service.ts`, lines 1789-1828:

```typescript
{
  // ... standard fields ...
  afterTicketId: string | null,
  afterTicket: {
    id: string,
    title: string,
    status: string,
    shortId: string,
    mode: string,
    approvalStatus: string | null
  } | null,
  implementFromTicketId: string | null,
  implementFromTicket: {
    id: string,
    title: string,
    status: string,
    shortId: string,
    mode: string,
    approvalStatus: string | null
  } | null,
  referencedTicketIds: string[],
  referencedTickets: Array<{
    id: string,
    title: string,
    status: string,
    shortId: string,
    mode: string,
    approvalStatus: string | null
  }>
}
```

### GET `/api/tickets` — List Response (per item)

The list endpoint also returns relationship data, meaning no extra API calls are needed for the list view.

**Source:** `helix-global-server/src/services/ticket-service.ts`, lines 1674-1709:

```typescript
{
  // ... standard fields ...
  afterTicketId: string | null,
  afterTicket: {
    id: string,
    title: string,
    status: string,
    shortId: string,
    approvalStatus: string | null
  } | null,
  implementFromTicketId: string | null,
  referencedTicketIds: string[]
}
```

> **Note:** The list endpoint returns richer relationship data than initially expected. `afterTicket` is a full nested object (not just an ID), and both `implementFromTicketId` and `referencedTicketIds` are returned per item. This means the list view can show meaningful relationship information without any additional API calls.

---

## 3. Recommended Design

### Flag Design

| Flag | Argument | Maps to Server Field | Example |
|------|----------|---------------------|---------|
| `--after <ticket-ref>` | Single ticket reference | `afterTicketId` | `--after RSH-490` |
| `--reference <ref1,ref2,...>` | Comma-separated references | `referencedTicketIds` | `--reference RSH-490,RSH-491` |
| `--implement-from <ticket-ref>` | Single ticket reference | `implementFromTicketId` | `--implement-from RSH-485` |

All three flags are optional and can be combined with each other and existing flags.

### Reference Resolution

Use the existing `resolveTicket()` utility from `src/lib/resolve-ticket.ts` (lines 86-167). This function already handles all three reference formats:

1. **Internal ID:** Direct UUID match
2. **Short ID:** Case-insensitive match (e.g., `RSH-490`)
3. **Ticket number:** Numeric suffix match with ambiguity detection (e.g., `490`)

The function searches active tickets first, then falls back to archived tickets, and detects cross-set ambiguity for numeric references.

### Create Command Changes (`src/tickets/create.ts`)

1. Parse the three new optional flags using `getFlag()`:
   ```typescript
   const afterRef = getFlag(args, "--after");
   const referenceRaw = getFlag(args, "--reference");
   const implementFromRef = getFlag(args, "--implement-from");
   ```

2. Resolve each reference before the POST:
   ```typescript
   let afterTicketId: string | undefined;
   if (afterRef) {
     const resolved = await resolveTicket(config, afterRef);
     afterTicketId = resolved.id;
   }
   ```

3. For `--reference`, split on commas and resolve each:
   ```typescript
   let referencedTicketIds: string[] | undefined;
   if (referenceRaw) {
     const refs = referenceRaw.split(",").map(s => s.trim()).filter(s => s.length > 0);
     referencedTicketIds = [];
     for (const ref of refs) {
       const resolved = await resolveTicket(config, ref);
       referencedTicketIds.push(resolved.id);
     }
   }
   ```

4. Include resolved IDs in the POST body:
   ```typescript
   body: {
     title, description, repositoryIds,
     ...(mode && { mode }),
     ...(afterTicketId && { afterTicketId }),
     ...(implementFromTicketId && { implementFromTicketId }),
     ...(referencedTicketIds && { referencedTicketIds }),
   }
   ```

5. Wrap the `hxFetch` call in try/catch to surface server validation errors clearly:
   ```typescript
   try {
     const data = await hxFetch(config, "/tickets", { ... });
     // ... success output ...
   } catch (error) {
     // Extract server error message from the response
     const msg = error instanceof Error ? error.message : String(error);
     const jsonMatch = msg.match(/\{.*"error"\s*:\s*"([^"]+)"/);
     if (jsonMatch) {
       console.error(`Error: ${jsonMatch[1]}`);
     } else {
       console.error(`Error: ${msg}`);
     }
     process.exit(1);
   }
   ```

### Ticket Detail Display Changes (`src/tickets/get.ts`)

Extend the `TicketDetail` type with relationship fields:
```typescript
type TicketDetail = {
  // ... existing fields ...
  afterTicketId: string | null;
  afterTicket: { id: string; title: string; status: string; shortId: string; mode: string; approvalStatus: string | null } | null;
  implementFromTicketId: string | null;
  implementFromTicket: { id: string; title: string; status: string; shortId: string; mode: string; approvalStatus: string | null } | null;
  referencedTicketIds: string[];
  referencedTickets: Array<{ id: string; title: string; status: string; shortId: string; mode: string; approvalStatus: string | null }>;
};
```

Add relationship sections in `printTicketDetail()` after the status/branch header area:
```
Depends on:   RSH-490 (Build API) - IN_PROGRESS
Implements:   RSH-485 (Cache research) - REPORT_READY
References:   RSH-491 (Update docs) - COMPLETED, RSH-492 (Fix tests) - IN_PROGRESS
```

These sections should only appear when the corresponding relationship exists (non-null / non-empty array).

### Ticket List Display Changes (`src/tickets/list.ts`)

Extend the `TicketItem` type with relationship fields from the list response:
```typescript
type TicketItem = {
  // ... existing fields ...
  afterTicketId: string | null;
  afterTicket: { id: string; title: string; status: string; shortId: string; approvalStatus: string | null } | null;
  implementFromTicketId: string | null;
  referencedTicketIds: string[];
};
```

Append a dependency indicator to the output line when `afterTicket` is present:
```typescript
const afterTag = ticket.afterTicket ? ` [after ${ticket.afterTicket.shortId}]` : "";
console.log(`${ticket.shortId}  ...  ${ticket.title}${approvalTag}${afterTag}`);
```

### Error Handling Strategy

The server returns human-readable error messages in `{ "error": "message" }` format. The CLI's `hxFetch` wrapper throws errors with the format `"HTTP 400 Bad Request - {"error":"Circular dependency detected."}"`.

The recommended approach:
1. Wrap the `hxFetch` POST call in a try/catch block
2. Attempt to parse the JSON error from the thrown message
3. Extract and display the `error` field directly
4. Fall back to the raw error message if parsing fails

This matches the existing error-handling pattern used for repo resolution errors in `create.ts` (lines 72-76).

---

## 4. Implementation Approach

### Scope: Single-Repo Change

Only `helix-cli` requires code changes. The server (`helix-global-server`) and client (`helix-global-client`) already fully support all three relationship types and serve as reference/verification context only.

### Files to Change (7 files)

| # | File | Change Description |
|---|------|--------------------|
| 1 | `src/tickets/create.ts` | Add `--after`, `--reference`, `--implement-from` flag parsing; resolve references via `resolveTicket()`; include in POST body; add error handling |
| 2 | `src/tickets/get.ts` | Extend `TicketDetail` type with relationship fields; add "Depends on" / "Implements" / "References" display sections in `printTicketDetail()` |
| 3 | `src/tickets/list.ts` | Extend `TicketItem` type with relationship fields; append `[after RSH-XXX]` indicator to list output |
| 4 | `src/tickets/index.ts` | Update usage text and help strings for `tickets create` to include new flags |
| 5 | `src/docs/cli-content.ts` | Add new flags to the `tickets create` documentation table; add worked examples |
| 6 | `skill-content/SKILL.md` | Document relationship commands in the agent skill documentation |
| 7 | `skill-content/references/commands.md` | Add relationship flags to the `tickets create` command reference section |

### No New Dependencies

The implementation uses only existing modules:
- `resolveTicket()` from `src/lib/resolve-ticket.ts`
- `getFlag()` from `src/lib/flags.ts`
- `hxFetch()` from `src/lib/http.ts`

No new runtime or dev dependencies are needed. The CLI maintains its minimal dependency footprint (`@types/node` and `typescript` only).

### Detailed Per-File Specification

#### 1. `src/tickets/create.ts`

**Add import:**
```typescript
import { resolveTicket } from "../lib/resolve-ticket.js";
```

**Add flag parsing (after `mode` handling, before POST):**
```typescript
// --- Relationship flags ---
const afterRef = getFlag(args, "--after");
const referenceRaw = getFlag(args, "--reference");
const implementFromRef = getFlag(args, "--implement-from");

let afterTicketId: string | undefined;
if (afterRef) {
  const resolved = await resolveTicket(config, afterRef);
  afterTicketId = resolved.id;
  console.log(`Resolved --after "${afterRef}" to ${resolved.shortId} (${resolved.id})`);
}

let implementFromTicketId: string | undefined;
if (implementFromRef) {
  const resolved = await resolveTicket(config, implementFromRef);
  implementFromTicketId = resolved.id;
  console.log(`Resolved --implement-from "${implementFromRef}" to ${resolved.shortId} (${resolved.id})`);
}

let referencedTicketIds: string[] | undefined;
if (referenceRaw) {
  const refs = referenceRaw.split(",").map(s => s.trim()).filter(s => s.length > 0);
  if (refs.length > 5) {
    console.error("Error: --reference accepts at most 5 ticket references.");
    process.exit(1);
  }
  referencedTicketIds = [];
  for (const ref of refs) {
    const resolved = await resolveTicket(config, ref);
    referencedTicketIds.push(resolved.id);
    console.log(`Resolved --reference "${ref}" to ${resolved.shortId} (${resolved.id})`);
  }
}
```

**Update POST body:**
```typescript
body: {
  title, description, repositoryIds,
  ...(mode && { mode }),
  ...(afterTicketId && { afterTicketId }),
  ...(implementFromTicketId && { implementFromTicketId }),
  ...(referencedTicketIds && referencedTicketIds.length > 0 && { referencedTicketIds }),
}
```

**Add error handling:** Wrap the `hxFetch` call in try/catch, extract server error message from JSON response, display cleanly with `process.exit(1)`.

**Update usage string (line 16):**
```
"Usage: hlx tickets create --title <title> --description <desc> | --description-file <path> --repos <name1,name2> [--mode <mode>] [--after <ticket-ref>] [--reference <ref1,ref2>] [--implement-from <ticket-ref>]"
```

#### 2. `src/tickets/get.ts`

**Extend `TicketDetail` type** with all six relationship fields (afterTicketId, afterTicket, implementFromTicketId, implementFromTicket, referencedTicketIds, referencedTickets).

**Add display sections** in `printTicketDetail()` after the approval status output and before Repositories:
```typescript
if (ticket.afterTicket) {
  console.log(`Depends on:   ${ticket.afterTicket.shortId} (${ticket.afterTicket.title}) - ${ticket.afterTicket.status}`);
}
if (ticket.implementFromTicket) {
  console.log(`Implements:   ${ticket.implementFromTicket.shortId} (${ticket.implementFromTicket.title}) - ${ticket.implementFromTicket.status}`);
}
if (ticket.referencedTickets && ticket.referencedTickets.length > 0) {
  const refs = ticket.referencedTickets.map(r => `${r.shortId} (${r.title}) - ${r.status}`).join(", ");
  console.log(`References:   ${refs}`);
}
```

#### 3. `src/tickets/list.ts`

**Extend `TicketItem` type** with afterTicketId, afterTicket, implementFromTicketId, and referencedTicketIds.

**Add indicator** to the output line (line 107):
```typescript
const afterTag = ticket.afterTicket ? ` [after ${ticket.afterTicket.shortId}]` : "";
console.log(`${ticket.shortId}  ${idAbbr}  ${ticket.status.padEnd(12)}  ${reporter.padEnd(20)}  ${updated}  ${ticket.title}${approvalTag}${afterTag}`);
```

#### 4. `src/tickets/index.ts`

**Update `ticketsUsage()` function** (line 21) to include new flags in the create command usage:
```
hlx tickets create --title <title> --description <desc> | --description-file <path> --repos <name1,name2> [--mode <mode>] [--after <ticket-ref>] [--reference <ref1,ref2>] [--implement-from <ticket-ref>]
```

**Update case `"create"` help** (line 73) with the same expanded usage string.

#### 5. `src/docs/cli-content.ts`

**Add three rows** to the `hlx tickets create` flags table (after the `--mode` row):
```
| `--after <ticket-ref>` | Create after another ticket (dependency chain) |
| `--reference <ref1,ref2>` | Reference related tickets, comma-separated (max 5) |
| `--implement-from <ticket-ref>` | Link to a completed research ticket |
```

**Add worked examples** in the Worked Examples section for creating tickets with relationships.

#### 6. `skill-content/SKILL.md`

**Add to the Ticket Management workflow section:**
```bash
# Create a ticket that depends on another
hlx tickets create --title "Build API" --after RSH-490 --repos my-app --description "..."

# Create a ticket with cross-references
hlx tickets create --title "Update docs" --reference RSH-490,RSH-491 --repos my-app --description "..."

# Create implementation from a research ticket
hlx tickets create --title "Implement caching" --implement-from RSH-485 --repos my-app --description "..."
```

#### 7. `skill-content/references/commands.md`

**Update the `hlx tickets create` command** in the Action Commands section to include the new flags:
```
hlx tickets create --title <title> --repos <repo> [--description <desc>] [--after <ticket-ref>] [--reference <ref1,ref2>] [--implement-from <ticket-ref>]
```

---

## 5. Worked Examples

### Creating a Dependent Ticket

```bash
hlx tickets create \
  --title "Build API endpoints" \
  --after RSH-490 \
  --repos my-app \
  --description "Implement REST endpoints for user management"
```

**Expected output:**
```
Resolved --after "RSH-490" to RSH-490 (clxyz123...)
Ticket created:
  ID:       clxyz456...
  Short ID: BLD-501
  Status:   WAITING
  Mode:     BUILD
```

The ticket starts with WAITING status because RSH-490 hasn't completed yet. Once RSH-490's run succeeds, the server automatically transitions BLD-501 to QUEUED and starts its run.

### Creating a Ticket with Cross-References

```bash
hlx tickets create \
  --title "Update API documentation" \
  --reference RSH-490,RSH-491 \
  --repos my-app \
  --description "Update docs to reflect new endpoints and schema changes"
```

**Expected output:**
```
Resolved --reference "RSH-490" to RSH-490 (clxyz123...)
Resolved --reference "RSH-491" to RSH-491 (clxyz789...)
Ticket created:
  ID:       clxyz999...
  Short ID: BLD-502
  Status:   QUEUED
  Mode:     BUILD
```

References are informational only and do not affect ticket scheduling.

### Creating an Implementation from Research

```bash
hlx tickets create \
  --title "Implement caching layer" \
  --implement-from RSH-485 \
  --repos my-app \
  --description "Implement the caching strategy from the research report"
```

**Expected output:**
```
Resolved --implement-from "RSH-485" to RSH-485 (clxyz111...)
Ticket created:
  ID:       clxyz222...
  Short ID: BLD-503
  Status:   QUEUED
  Mode:     BUILD
```

> **Note:** `--implement-from` requires the target to be a RESEARCH mode ticket with REPORT_READY status. If those conditions aren't met, the server returns a clear error message.

### Combining Multiple Relationship Flags

```bash
hlx tickets create \
  --title "Build search feature" \
  --after RSH-501 \
  --reference RSH-490,RSH-491 \
  --implement-from RSH-485 \
  --repos my-app \
  --description "Implement search based on research findings, after API is ready"
```

All three flags can be used together in a single create command.

### Viewing Relationships on a Ticket

```bash
hlx tickets get RSH-501
```

**Expected output:**
```
Title:        Build API endpoints
Short ID:     RSH-501
Status:       IN_PROGRESS
Branch:       helix/BLD-501-build-api-endpoints
Reporter:     Jane Dev
Archived:     false
Depends on:   RSH-490 (Set up database schema) - COMPLETED
Implements:   RSH-485 (Research caching strategies) - REPORT_READY
References:   RSH-491 (Update docs) - IN_PROGRESS, RSH-492 (Fix tests) - COMPLETED

Repositories:
  my-app  https://github.com/org/my-app

Runs:
  clrun123...  IN_PROGRESS   5/18/2026, 10:30:00 AM  in progress
```

Relationship sections appear only when data is present. Tickets with no relationships display identically to today.

### List View with Dependency Indicators

```bash
hlx tickets list
```

**Expected output:**
```
BLD-502  clxyz999...  QUEUED        Jane Dev              5/18/2026, 11:00 AM  Update API documentation
BLD-501  clxyz456...  WAITING       Jane Dev              5/18/2026, 10:30 AM  Build API endpoints [after RSH-490]
BLD-500  clxyz123...  IN_PROGRESS   Jane Dev              5/18/2026, 10:00 AM  Set up database schema
```

The `[after RSH-490]` tag is appended to tickets that have a dependency, making it immediately visible which tickets are chained.

### Error Handling Examples

**Invalid predecessor (not found):**
```bash
hlx tickets create --title "Test" --after NONEXISTENT --repos my-app --description "..."
```
```
Error: Ticket "NONEXISTENT" not found in org "my-org". Accepted formats: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).
```

**Circular dependency:**
```bash
# If RSH-501 already depends on RSH-500
hlx tickets create --title "Test" --after RSH-500 --repos my-app --description "..."
# (if this would create RSH-501 -> RSH-500 -> RSH-501 cycle)
```
```
Error: Circular dependency detected.
```

**Wrong research ticket status:**
```bash
hlx tickets create --title "Test" --implement-from RSH-486 --repos my-app --description "..."
# (RSH-486 is RESEARCH mode but not REPORT_READY)
```
```
Error: implementFromTicketId must reference a ticket with REPORT_READY status.
```

---

## 6. Design Decisions & Rationale

### Why Comma-Separated for `--reference`

The `--reference` flag uses comma-separated values (`--reference RSH-490,RSH-491`) rather than space-separated or multiple flag instances.

**Rationale:**
- **Matches existing pattern:** The `--repos` flag already uses comma-separated values (see `create.ts` line 62: `reposRaw.split(",").map(s => s.trim()).filter(s => s.length > 0)`).
- **Avoids shell quoting issues:** Space-separated values would be ambiguous with positional arguments and require awareness of shell quoting.
- **Concise:** More compact than `--reference RSH-490 --reference RSH-491`.

### Why Sequential `resolveTicket()` Calls

Each reference is resolved independently via `resolveTicket()`, which may make up to 2 API calls per reference (active list + archived fallback).

**Rationale:**
- **Simplicity:** Reuses the existing, well-tested `resolveTicket()` utility without modification.
- **Correctness:** Each resolution handles ambiguity detection independently.
- **Acceptable performance:** Ticket creation is not a hot path. Even with 5 references (worst case ~10 API calls), this completes in seconds.
- **Deferral path:** Batch resolution (fetch list once, `matchTicket()` N times) can be added in Round 2 if users report slowness.

### Why Inline Changes in `create.ts` (Not a Separate Module)

The three new flags are added directly in `cmdTicketsCreate()` rather than extracting a `resolve-relationships.ts` module.

**Rationale:**
- **Follows established pattern:** The existing `--repos` resolution (lines 61-76) uses the same inline approach: parse flag, resolve, include in body.
- **Minimal diff:** Keeps the change small and reviewable.
- **No complexity reduction:** A separate module would add indirection without reducing the complexity of three independent `getFlag()` + `resolveTicket()` calls.

### Why Surface Server Error Messages Directly

The CLI extracts the `error` field from the server's JSON response and displays it as-is.

**Rationale:**
- **Already human-readable:** Server messages like "Circular dependency detected." and "implementFromTicketId must reference a RESEARCH mode ticket." are clear and actionable.
- **Consistency:** Avoids maintaining a parallel set of error messages that could drift from the server.
- **Best-effort parsing:** The error extraction attempts JSON parsing but falls back to the raw error message, making it resilient to response format changes.

### Why `[after RSH-XXX]` Appended (Not Prepended) in List View

The dependency indicator is appended to the end of the list line rather than prepended.

**Rationale:**
- **Preserves alignment:** The existing columns (shortId, ID, status, reporter, date, title) maintain their positions.
- **Low noise:** Only tickets with dependencies show the tag; the majority of the list remains unchanged.
- **Uses nested data:** The list endpoint returns `afterTicket.shortId`, so the indicator includes the human-readable short ID without additional API calls.

---

## 7. Performance & Tradeoffs

| Operation | Current API Calls | With Relationships | Acceptable? |
|-----------|------------------|--------------------|-------------|
| `tickets create` (no relationships) | 1 POST | 1 POST (unchanged) | Yes |
| `tickets create --after <ref>` | - | 2-3 resolve + 1 POST = 3-4 total | Yes |
| `tickets create --implement-from <ref>` | - | 2-3 resolve + 1 POST = 3-4 total | Yes |
| `tickets create --reference <5 refs>` | - | 10 resolve + 1 POST = ~11 total | Yes (not hot path) |
| `tickets get <ref>` | 1 GET | 1 GET (unchanged, data in response) | Yes |
| `tickets list` | 1 GET | 1 GET (unchanged, data in response) | Yes |

**Key insight:** The `get` and `list` commands require **zero additional API calls** because the server already includes relationship data in both the detail and list responses. This is the biggest performance win of the design.

The `create` command's additional API calls for reference resolution are bounded (max ~11 for 5 references) and occur on a non-hot path (ticket creation). The sequential resolution approach is simple and correct; batch optimization is deferred to Round 2.

---

## 8. Future Considerations

These items are explicitly out of scope for the initial implementation but are natural next steps:

### Editing Relationships on Existing Tickets

A `hlx tickets update --after <ref>` command would allow modifying dependency chains after creation. This requires a server PUT/PATCH endpoint and is a separate feature.

### Batch Ticket Creation with Chaining

A workflow like:
```bash
hlx tickets create-chain --file project-plan.yaml
```
Could read a YAML file defining multiple tickets with dependency relationships and create them in the correct order. This builds on the individual relationship flags.

### Batch Reference Resolution

For `--reference` with multiple values, fetching the ticket list once and running `matchTicket()` against it would reduce API calls from ~10 to 2-3. The existing `matchTicket()` function (lines 44-77 of `resolve-ticket.ts`) is already a pure function that takes an items array, making this optimization straightforward.

### Interactive Ticket Picker

An interactive mode where the user selects tickets from a list (using arrow keys or fuzzy search) rather than typing references manually. This would be useful for users who don't remember ticket short IDs.

### Dependency Tree Visualization

A `hlx tickets deps <ref>` command that walks the dependency chain and renders a tree view, showing the full sequence of dependent tickets and their statuses.

---

## 9. Appendix: Reference Architecture

### Existing Patterns to Follow

The implementation should follow these established patterns in the `helix-cli` codebase:

**Flag parsing pattern** (`src/lib/flags.ts`):
```typescript
export function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}
```

**Resolve-then-use pattern** (`src/tickets/create.ts`, lines 60-76):
```typescript
const reposRaw = requireFlag(args, "--repos", "...");
const repoEntries = reposRaw.split(",").map(s => s.trim()).filter(s => s.length > 0);
let repositoryIds: string[];
try {
  repositoryIds = await resolveAllRepos(config, repoEntries);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
```

The new relationship flags follow the exact same resolve-then-use approach, substituting `resolveTicket()` for `resolveAllRepos()`.

**Error handling pattern** (`src/tickets/create.ts`, lines 72-76):
```typescript
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Run "hlx inspect repos" to see available repositories.');
  process.exit(1);
}
```

### CLI Architecture Context

| Component | Description | Location |
|-----------|-------------|----------|
| Entry point | Arg router | `src/index.ts` |
| Ticket subcommands | Command implementations | `src/tickets/*.ts` |
| Flag parsing | `getFlag()`, `requireFlag()`, `hasFlag()` | `src/lib/flags.ts` |
| HTTP client | `hxFetch()` with retry | `src/lib/http.ts` |
| Ticket resolution | `resolveTicket()`, `matchTicket()` | `src/lib/resolve-ticket.ts` |
| Repo resolution | `resolveAllRepos()` | `src/lib/resolve-repo.ts` |
| Documentation | Exported content for external use | `src/docs/cli-content.ts` |
| Skill docs | Agent skill reference | `skill-content/` |

### Build & Quality Gates

| Gate | Command | Description |
|------|---------|-------------|
| Build | `tsc` | TypeScript compilation to `dist/` |
| Typecheck | `tsc --noEmit` | Type checking without output |
| Test | `tsc && node --test dist/**/*.test.js` | Compile + run Node test runner |

No ORM, no migrations, no database dependencies in `helix-cli`.

---

## Data Sources & Methodology

This report was assembled by synthesizing findings from a structured analysis workflow:

1. **Codebase scanning** of all four repositories (`helix-cli`, `helix-global-server`, `helix-global-client`, `library`) to map relevant files, types, and API contracts.
2. **Direct source inspection** of 16+ files across `helix-cli` and `helix-global-server` with specific line-number citations.
3. **API contract verification** by reading the server's Zod schema, validation logic, error handler, and response mapping functions.
4. **Pattern analysis** of existing CLI conventions (flag parsing, reference resolution, error handling, display formatting).
5. **Gap analysis** comparing web UI capabilities against CLI capabilities to define the exact feature gap.

All recommendations are grounded in observed code evidence. File paths and line numbers reference the codebase as of the analysis date and should be verified against the current HEAD before implementation.

## Attachments
- (none)

## Discussion
- **Helix** (2026-05-19T00:06:48.542Z) [Agent]: Changes applied to 1 repository. Verification could not be fully completed — please review the changes manually.

## Continuation Context
You do everything you need to do in order to verify, create any records you need, create any text you need, alter the database in any way, do whatever you need to verify.

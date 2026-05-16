# Ticket Context

- ticket_id: cmp7vf19r00cxks0uxvivoek5
- short_id: RSH-474
- run_id: cmp7vf1a400d2ks0uf83adq0q
- run_branch: helix/research/RSH-474-better-abstraction-for-helix-global-helix
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Better abstraction for Helix Global, Helix Netsuite, and Helix SMB. Ticket

## Description
Looks good.



Tighten it up, double check anything that needs to be double checked and harden it up. Then make a report with 3 parts:



1. Risks vs rewards. Is it worth it
2. An implementation ticket for Helix
3. Before running the implementation ticket, we should probably have test coverage. Create a ticket for a comprehensive testing plan to cover this transformation. Include unit and e2e. Think about the coverage carefully. We want to mitigate the risk

## Research Report

# Better Abstraction for Helix Global, Helix NetSuite, and Helix SMB

**Research Report** | RSH-368 | May 2026

---

## Executive Summary

The Helix platform supports multiple product variants — today **Global** and **NetSuite**, with **SMB** planned — but platform-specific behavior is implemented through a single boolean pattern: `useIsNetsuite()` on the client (20+ files branching on `isNs`) and `isNsPlatform` on the server (~200 lines of inline if-gates in the workflow orchestrator alone). There is no intermediate layer between platform identity (`OrganizationPlatform: GENERAL | NETSUITE`) and platform-specific behavior. Every consumer re-derives a boolean and branches locally. Adding a third platform would require modifying every branching point in both codebases.

The right abstraction is **functional platform config records** — plain data objects keyed by `OrganizationPlatform` that declare labels, capabilities, available modes, and behavior per platform. A single hook (`usePlatformConfig()` on the client) or utility (`getPlatformConfig()` on the server) resolves the current org's config. Consumers ask *"what does this platform support?"* rather than *"is this NetSuite?"* This is purely functional — plain objects and record lookups, no class hierarchies. The `Record<OrganizationPlatform, PlatformConfig>` pattern already exists in the codebase for similar lookups (`statusConfig` in `staging-queue.tsx:17`, `AUTH_MODE_LABELS` in `repositories-tab.tsx`).

The impact is structural: **adding a new platform becomes adding one config record per repo**. No consumer files change. The 20+ client files and 9 server architectural layers that currently need per-file modification become closed for modification and open for extension.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [What Is The Same Across Platforms](#what-is-the-same-across-platforms)
3. [What Is Different Per Platform](#what-is-different-per-platform)
4. [The Right Abstraction: Functional Platform Config Records](#the-right-abstraction-functional-platform-config-records)
5. [Client Architecture](#client-architecture)
6. [Server Architecture](#server-architecture)
7. [Adding a New Platform](#adding-a-new-platform)
8. [What Stays Separate](#what-stays-separate)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Risks and Open Questions](#risks-and-open-questions)

---

## Current State Analysis

### The Boolean Pattern

Platform detection in both repositories follows the same shape: resolve a boolean from the org's platform string, then scatter that boolean across consumers as inline ternaries and if-blocks.

**Client** (`src/lib/platform.ts:13-16`):

```typescript
export function useIsNetsuite(): boolean {
  const { data: auth } = useQuery(meQueryOptions());
  return auth?.organization.platform === "NETSUITE";
}
```

Every consumer calls this hook and stores the result as `isNs`, then branches:

```typescript
// src/components/pipeline-layout.tsx:25-31
const isNs = useIsNetsuite();
// ...
{isNs ? "Sandbox Queue" : "Staging Queue"}
```

```typescript
// src/routes/create-ticket.tsx:76-86
function getModeOptions(isNetsuite: boolean): ModeOption[] {
  const base: ModeOption[] = [
    { value: TicketMode.AUTO, label: "Auto", Icon: AutoIcon },
    { value: TicketMode.BUILD, label: "Build", Icon: BuildIcon },
    { value: TicketMode.FIX, label: "Fix", Icon: FixIcon },
    { value: TicketMode.RESEARCH, label: isNetsuite ? "Report" : "Research", Icon: ResearchIcon },
  ];
  if (isNetsuite) {
    base.push({ value: TicketMode.EXECUTE, label: "Execute", Icon: ExecuteIcon });
  }
  return base;
}
```

**Server** (`src/helix-workflow/orchestrator.ts:786-790`):

```typescript
const orgPlatform = await prisma.organization.findUnique({
  where: { id: run.organizationId },
  select: { platform: true },
});
const isNsPlatform = orgPlatform?.platform === "NETSUITE";
```

This single boolean then gates ~200 lines of NS-specific orchestrator logic for credential loading (lines 795-817), ns-gm CLI installation (lines 1253-1261), File Cabinet import (lines 1271-1343), and sandbox deployment (lines 2034-2122).

The pattern is consistent and it works correctly today for two platforms. The problem is what happens at three.

### Three Orthogonal Concepts

The codebase contains three separate "platform" concepts that must not be confused:

| Concept | Type | Where Defined | What It Represents |
|---------|------|---------------|-------------------|
| **OrganizationPlatform** | `GENERAL` \| `NETSUITE` | Client: `src/types/api.ts:196-202`; Server: `prisma/schema.prisma:105-108` | Org identity: which product variant this organization uses |
| **ProductionPlatformType** | `NONE` \| `DIGITALOCEAN` \| `VERCEL` | Client: `src/types/api.ts:1312-1319`; Server: `prisma/schema.prisma:68-72` | Per-repo deployment target: where code gets deployed |
| **PX Org Identity** | Hardcoded `Set<string>` | Client: `src/lib/platform.ts:7` | Internal feature access: documentation gating for PX orgs |

Only the first — **OrganizationPlatform** — is the subject of this abstraction. The other two are orthogonal concerns that must remain separate.

---

## What Is The Same Across Platforms

The majority of both codebases is platform-agnostic. The abstraction only needs to capture the *differences*, not the shared core.

### Client (Shared Across All Platforms)

- Core ticket lifecycle (create, list, detail, status tracking)
- Authentication and session management
- Organization and user management
- Repository browsing and settings (general tabs)
- Deployment center and deployment detail views
- Documentation sections (gated by PX org identity, not platform)
- App shell structure, navigation, routing
- All Tailwind CSS styling and component library

### Server (Shared Across All Platforms)

- HTTP routing and Express middleware pipeline
- Authentication and session management (JWT, cookies)
- Ticket CRUD and state machine (status transitions)
- Organization and user management
- Repository CRUD
- Git operations (clone, branch, commit, push)
- AI workflow execution pipeline (scout, diagnosis, implementation-plan, implementation, code-review, verification)
- Preview deployment via `production-platform.ts` factory (DigitalOcean/Vercel)
- Database branching (Neon)

### CLI (Entirely Platform-Agnostic)

The `helix-cli` repository has **zero** platform-specific logic. All platform differentiation is handled server-side. The CLI connects to any Helix server instance and operates uniformly regardless of organization platform. It requires no changes under any abstraction approach.

---

## What Is Different Per Platform

### Client Platform Differences

| Dimension | GENERAL | NETSUITE | SMB |
|-----------|---------|----------|-----|
| **Queue label** | "Staging Queue" | "Sandbox Queue" | Unknown |
| **Ticket modes** | AUTO, BUILD, FIX, RESEARCH | AUTO, BUILD, FIX, REPORT, EXECUTE | Unknown |
| **Repo picker** | User selects per ticket | Hidden (auto-assigned) | Unknown |
| **Settings tabs** | Standard | Standard + NetSuite tab | Unknown |
| **Onboarding flow** | `GeneralOrgWizardContent` | `NsSetupWizardContent` | Unknown |
| **Credential UI** | None | NS readiness banner | Unknown |
| **Repo type filtering** | All repos shown | NATIVE_NS/SPA_NS filtered | Unknown |
| **Status label** | "MERGED" | "Staged" | Unknown |

**Source evidence by dimension:**

| Dimension | File | Lines |
|-----------|------|-------|
| Queue label | `src/components/pipeline-layout.tsx` | 25-31 |
| Ticket modes | `src/routes/create-ticket.tsx` | 76-87 |
| Repo picker | `src/routes/create-ticket.tsx` | 97+ |
| Settings tabs | `src/routes/settings.tsx` | 63-70 |
| Onboarding flow | `src/routes/onboarding.tsx` | 43-66 |
| Credential UI | `src/components/ns-readiness-banner.tsx` | entire file |
| Repo type filtering | `src/routes/settings.tsx` | 59-61 |
| Status label | `src/routes/staging-queue.tsx` | 43-45 |

### Server Platform Differences

| Dimension | GENERAL | NETSUITE | SMB |
|-----------|---------|----------|-----|
| **Ticket validation** | Requires `repositoryIds` | No `repositoryIds`; auto-assigns all repos | Unknown |
| **Available modes** | AUTO, BUILD, FIX, RESEARCH | AUTO, BUILD, FIX, RESEARCH, EXECUTE | Unknown |
| **Repo resolution** | User-selected per ticket | All org repos auto-assigned | Unknown |
| **Repo subtypes** | None (type is null) | NATIVE_NS, SPA_NS | Unknown |
| **Credentials** | None platform-specific | SDF (sandbox+prod), NS-GM (sandbox+prod) | Unknown |
| **Workflow tools** | Standard tools | + ns-gm CLI, SuiteCloud bridge, File Cabinet import | Unknown |
| **Deploy pipeline** | Preview deploy (DO/Vercel) | Sandbox deploy (SDF project + SPA upload) | Unknown |
| **Freshness blockers** | N/A | Freshness blocking for NATIVE_NS repos | Unknown |
| **Endpoint guards** | Open | ~10 NS-specific endpoints guarded | Unknown |

**Source evidence by dimension:**

| Dimension | File | Lines |
|-----------|------|-------|
| Ticket validation | `src/controllers/ticket-controller.ts` | 107-144 |
| Available modes | `src/controllers/ticket-controller.ts` | 146-148 |
| Repo resolution | `src/services/ticket-service.ts` | 636-642 |
| Repo subtypes | `prisma/schema.prisma` | 123-126 |
| Credentials | `src/helix-workflow/orchestrator.ts` | 795-817 |
| Workflow tools | `src/helix-workflow/orchestrator.ts` | 1253-1343 |
| Deploy pipeline | `src/helix-workflow/orchestrator.ts` | 2034-2122 |
| Freshness blockers | `src/helix-workflow/orchestrator/workflow-step-chain.ts` | 638-646 |
| Endpoint guards | `src/controllers/settings-controller.ts` | 489-493 |

---

## The Right Abstraction: Functional Platform Config Records

### Why Not Classes (OOP)

The ticket is explicit: *"We're not into object-oriented programming; we're functional programmers."*

Class hierarchies add ceremony without benefit for 2-3 platform variants. The server already has a class-based factory in `production-platform.ts` for deployment targets — it works for that use case but introduces `abstract` methods, `implements` contracts, and `new` instantiation. For org-platform behavior that's mostly label selection and boolean flags, plain objects are simpler and more direct.

### Why Not Capability-Only Sets

A `Set<Capability>` per platform where consumers check `hasCapability('executeMode')` seems appealing. But most platform differences are not binary capabilities — they're **labels** (`"Staging Queue"` vs `"Sandbox Queue"`), **lists** (mode arrays), and **component selections** (which wizard to render). A capability set cannot express `"Sandbox Queue"`. You'd need a parallel label registry, a parallel mode registry, a parallel component registry — defeating the purpose of a single config.

### Why Not Context Providers

A React Context provider injecting platform-specific strategy objects into the component tree would work but is over-engineering for 2-3 platforms. The existing `useIsNetsuite()` hook already uses TanStack React Query (`meQueryOptions()`), which caches the auth data. Adding a Context layer on top just adds another wrapping provider. The hook-based approach (`usePlatformConfig()`) is simpler and uses the same underlying data source.

### The Config Record Pattern

The recommended abstraction is a `Record<OrganizationPlatform, PlatformConfig>` — a plain object mapping platform IDs to structured config records. Each record declares everything a consumer might need: labels, capabilities, mode lists, and behavioral settings.

**This pattern already exists in the codebase.** `staging-queue.tsx:17` uses `Record<StagingMergeQueueStatus, { label: string; className: string }>` for status configuration. `repositories-tab.tsx` uses a similar record for auth mode labels. The platform config extends this established pattern to org-level behavior.

The key insight: **consumers ask for data, not identity.** Instead of:

```typescript
const isNs = useIsNetsuite();
const label = isNs ? "Sandbox Queue" : "Staging Queue";
```

They write:

```typescript
const { labels } = usePlatformConfig();
const label = labels.queue;  // Already resolved for the current platform
```

This is functional programming: data in, data out. No classes, no inheritance, no strategy objects. Just a record lookup that returns a plain object.

---

## Client Architecture

### PlatformConfig Type

The type captures all 8 dimensions of client platform behavior, organized into logical groups:

```typescript
type PlatformConfig = {
  key: OrganizationPlatform;          // self-reference for downstream use
  displayName: string;                 // "Helix Global" | "Helix NetSuite"

  // Labels
  labels: {
    queue: string;                     // "Staging Queue" | "Sandbox Queue"
    mergedStatus: string;              // "MERGED" | "Staged"
    researchMode: string;              // "Research" | "Report"
  };

  // Capabilities (boolean feature flags)
  capabilities: {
    executeMode: boolean;              // EXECUTE ticket mode available
    repoPicker: boolean;               // user selects repos per ticket
    readinessBanner: boolean;          // show NS credential readiness banner
    netsuiteSettingsTab: boolean;      // show NetSuite settings tab
  };

  // Ticket modes
  availableModes: TicketMode[];        // ordered list for mode picker UI

  // Repository filtering
  repoTypeFilter: string[] | null;     // ["NATIVE_NS", "SPA_NS"] for NS, null = show all

  // Onboarding
  onboardingFlow: "general" | "netsuite"; // discriminant for wizard component selection
};
```

### platformConfigs Record

```typescript
const platformConfigs: Record<OrganizationPlatform, PlatformConfig> = {
  GENERAL: {
    key: "GENERAL",
    displayName: "Helix Global",
    labels: {
      queue: "Staging Queue",
      mergedStatus: "MERGED",
      researchMode: "Research",
    },
    capabilities: {
      executeMode: false,
      repoPicker: true,
      readinessBanner: false,
      netsuiteSettingsTab: false,
    },
    availableModes: [TicketMode.AUTO, TicketMode.BUILD, TicketMode.FIX, TicketMode.RESEARCH],
    repoTypeFilter: null,
    onboardingFlow: "general",
  },

  NETSUITE: {
    key: "NETSUITE",
    displayName: "Helix NetSuite",
    labels: {
      queue: "Sandbox Queue",
      mergedStatus: "Staged",
      researchMode: "Report",
    },
    capabilities: {
      executeMode: true,
      repoPicker: false,
      readinessBanner: true,
      netsuiteSettingsTab: true,
    },
    availableModes: [TicketMode.AUTO, TicketMode.BUILD, TicketMode.FIX, TicketMode.RESEARCH, TicketMode.EXECUTE],
    repoTypeFilter: ["NATIVE_NS", "SPA_NS"],
    onboardingFlow: "netsuite",
  },
};
```

### usePlatformConfig() Hook

Replaces `useIsNetsuite()` as the primary platform consumption API:

```typescript
function usePlatformConfig(): PlatformConfig {
  const { data: auth } = useQuery(meQueryOptions());
  const platform = auth?.organization.platform ?? "GENERAL";
  return platformConfigs[platform];
}
```

This uses the same underlying TanStack Query call as the current `useIsNetsuite()`. No additional re-renders, no new data fetching, no new providers. The hook returns a stable config reference for the same platform.

A non-hook utility exists for non-component contexts:

```typescript
function getPlatformConfig(platform: OrganizationPlatform): PlatformConfig {
  return platformConfigs[platform];
}
```

### Consumer Migration Pattern

Every consumer follows one of three shapes. Here's the before/after for each:

#### Shape 1: Label Selection (`pipeline-layout.tsx`)

**Before:**
```typescript
const isNs = useIsNetsuite();
// ...
{isNs ? "Sandbox Queue" : "Staging Queue"}
```

**After:**
```typescript
const { labels } = usePlatformConfig();
// ...
{labels.queue}
```

#### Shape 2: Capability Gating (`create-ticket.tsx`)

**Before:**
```typescript
const isNs = useIsNetsuite();
const modeOptions = getModeOptions(isNs);
// ... 12 lines of mode assembly logic
```

**After:**
```typescript
const { availableModes, labels } = usePlatformConfig();
// Map availableModes directly to UI — getModeOptions() is eliminated
```

#### Shape 3: Component Selection (`onboarding.tsx`)

**Before:**
```typescript
{orgType === "regular" && <GeneralOrgWizardContent ... />}
{orgType === "netsuite" && <NsSetupWizardContent ... />}
```

**After:**
```typescript
const config = platformConfigs[selectedPlatform];
{config.onboardingFlow === "general" && <GeneralOrgWizardContent ... />}
{config.onboardingFlow === "netsuite" && <NsSetupWizardContent ... />}
```

### OrgType Alignment

`org-wizard-dialog.tsx:5` defines `OrgType = "regular" | "netsuite"` — a parallel type that maps imprecisely to `OrganizationPlatform` (`"regular"` is not `"GENERAL"`). Under the new abstraction, the wizard uses `OrganizationPlatform` values directly (`"GENERAL"` | `"NETSUITE"`), and the wizard's component selection uses `platformConfigs[selectedPlatform].onboardingFlow`.

### Complete Removal of useIsNetsuite()

`useIsNetsuite()` is removed entirely after migrating all 20+ consumers. No backward-compatible wrapper. The build and typecheck validate completeness — any missed consumer fails to compile. This is the cleanest approach because:

1. A deprecated wrapper invites continued use.
2. There is no external API contract to maintain.
3. The migration touches every consumer anyway.

### NS-Specific Components

`ns-readiness-banner.tsx` and `ns-setup-wizard-dialog.tsx` remain as separate files. They are conditionally rendered based on `capabilities.readinessBanner` and `onboardingFlow` instead of `isNs`. The change is in *how* they're conditionally rendered, not in their file structure or internals.

---

## Server Architecture

### ServerPlatformConfig Type

The server type captures all 9 dimensions of server platform behavior:

```typescript
type ServerPlatformConfig = {
  key: OrganizationPlatform;

  // Ticket validation
  validationSchemaKey: "general" | "netsuite";
  allowedModes: TicketMode[];

  // Repository model
  repoResolution: "user-selected" | "auto-assigned";
  repoTypeFilter: string[] | null;

  // Credentials
  credentials: {
    sdf: boolean;
    nsGm: boolean;
  };

  // Workflow capabilities
  workflow: {
    nsGmCli: boolean;
    fileCabinetImport: boolean;
    suiteCloudSetup: boolean;
    sandboxDeploy: boolean;
    freshnessBlockers: boolean;
  };

  // Endpoint access
  endpointGroups: string[];
};
```

### New Module: src/lib/platform-config.ts

The server has no existing `src/lib/platform.ts` equivalent (unlike the client). The auth module (`src/auth/session.ts`) owns session types, not platform semantics. A dedicated `src/lib/platform-config.ts` module provides a single import source for all platform-aware consumers, containing:

- `ServerPlatformConfig` type
- `platformConfigs` record (`GENERAL` and `NETSUITE` entries)
- `getPlatformConfig(platform)` utility
- `requirePlatform(auth, platform)` centralized guard

### Typed AuthContext

Currently (`src/auth/session.ts:21`):

```typescript
organization: {
  id: string;
  name: string;
  githubConfigured: boolean;
  platform: string;           // <-- untyped string
  commitArtifactsToGithub: boolean;
};
```

Change `platform: string` to `platform: OrganizationPlatform`. This makes platform flow type-safe from auth through to every consumer. The TypeScript compiler catches any remaining string comparisons.

**Impact**: `middleware.test.ts` (lines 26, 59) uses `platform: 'default'` which is not a valid `OrganizationPlatform` value. These test fixtures must be updated to `"GENERAL"` — the correct default per the Prisma schema.

### Centralized Guards

The duplicated `requireNetsuitePlatform()` guard exists identically in two files:

- `src/controllers/settings-controller.ts:489-493`
- `src/controllers/ns-deployment-controller.ts:12-15`

Both are replaced by a single centralized `requirePlatform()`:

```typescript
function requirePlatform(
  auth: AuthContext,
  platform: OrganizationPlatform
): void {
  if (auth.user.organization.platform !== platform) {
    throw new HttpError(403, `This endpoint is restricted to ${platform} organizations.`);
  }
}
```

Call sites change from `requireNetsuitePlatform(auth)` to `requirePlatform(auth, "NETSUITE")`. The guard is now parameterized — it works for any platform, including future SMB-specific endpoints.

### Config-Driven Validation

**Before** (`ticket-controller.ts:107-144`):

```typescript
const isNs = auth.user.organization.platform === "NETSUITE";
if (isNs) {
  const input = createTicketSchemaNs.parse(body);
  // ... NS-specific field extraction
} else {
  const input = createTicketSchemaGeneral.parse(body);
  // ... General-specific field extraction
}
```

**After**:

```typescript
const config = getPlatformConfig(auth.user.organization.platform);
const schema = ticketSchemas[config.validationSchemaKey];
const input = schema.parse(body);
```

The two Zod schemas remain separate (they're structurally different — NS omits `repositoryIds`), but the selection logic is config-driven rather than boolean-driven.

### Config-Driven Repo Resolution

**Before** (`ticket-service.ts:636-642`):

```typescript
const isNs = input.platform === "NETSUITE";
const selectedRepositories = isNs
  ? await resolveNsTicketRepositories(input.organizationId)
  : await resolveTicketRepositoriesForCreate({...});
```

**After**:

```typescript
const config = getPlatformConfig(platform);
const resolver = repoResolvers[config.repoResolution];
const selectedRepositories = await resolver(input);
```

The strategy is declared in config (`"user-selected"` vs `"auto-assigned"`) and dispatched via a function registry. SMB could declare a third resolution strategy without modifying `ticket-service.ts`.

### Orchestrator Capability Dispatch

The orchestrator's NS-specific code (~200 lines) stays in place — only the conditions change. The code is deeply coupled to sandbox operations, credential caching, and git workflows. Extracting it to separate modules would require complex interfaces. For 2-3 platforms, changing the condition is sufficient.

**Before** (`orchestrator.ts:790-795`):

```typescript
const isNsPlatform = orgPlatform?.platform === "NETSUITE";
// ...
if (isNsPlatform) {
  logRun(run.id, "NS platform detected - loading SDF and NS-GM credentials");
  // ... credential loading
}
```

**After**:

```typescript
const platformConfig = getPlatformConfig(orgPlatform.platform);
// ...
if (platformConfig.credentials.sdf) {
  logRun(run.id, "Platform requires SDF credentials - loading");
  // ... credential loading (unchanged)
}
```

The `isNsPlatform` local variable is removed. `platformConfig` is resolved once from the Prisma query result and reused throughout the orchestrator run. Each NS-specific block changes its condition from identity-based to capability-based:

| Orchestrator Phase | Before Condition | After Condition |
|-------------------|-----------------|-----------------|
| Credential loading | `isNsPlatform` | `platformConfig.credentials.sdf` |
| ns-gm CLI install | `isNsPlatform` | `platformConfig.workflow.nsGmCli` |
| File Cabinet import | `isNsPlatform` | `platformConfig.workflow.fileCabinetImport` |
| Sandbox deploy | `isNsPlatform && !isResearchMode` | `platformConfig.workflow.sandboxDeploy && !isResearchMode` |
| Freshness blockers | `isNsPlatform` | `platformConfig.workflow.freshnessBlockers` |
| UNVERIFIED handling | `isNsPlatform` | `platformConfig.workflow.sandboxDeploy` |

### No Prisma Migration for SMB

The `OrganizationPlatform` Prisma enum is not changed as part of this abstraction work. Adding `SMB` requires a Prisma migration that affects the production database. This should only happen when SMB is actually being implemented and its requirements are defined.

---

## Adding a New Platform

This section demonstrates how the abstraction makes adding SMB (or any future platform) trivial. The contrast with the current approach is stark.

### What You Add

**Client** (2 changes):

1. Add `SMB: "SMB"` to the `OrganizationPlatform` const-object in `src/types/api.ts`
2. Add one `PlatformConfig` entry to `platformConfigs` in `src/lib/platform.ts`:

```typescript
SMB: {
  key: "SMB",
  displayName: "Helix SMB",
  labels: {
    queue: "Staging Queue",       // or whatever SMB calls it
    mergedStatus: "MERGED",       // or whatever SMB uses
    researchMode: "Research",     // or whatever SMB calls it
  },
  capabilities: {
    executeMode: false,           // TBD based on SMB requirements
    repoPicker: true,             // TBD
    readinessBanner: false,       // TBD
    netsuiteSettingsTab: false,   // definitely not
  },
  availableModes: [TicketMode.AUTO, TicketMode.BUILD, TicketMode.FIX, TicketMode.RESEARCH],
  repoTypeFilter: null,           // TBD
  onboardingFlow: "general",      // or a new "smb" flow
},
```

**Server** (3 changes):

1. Add `SMB` to `OrganizationPlatform` enum in `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add-smb-platform`
3. Add one `ServerPlatformConfig` entry to `platformConfigs` in `src/lib/platform-config.ts`

### What You Don't Change

**Zero consumer files.** The 20+ client component/route files that consume `usePlatformConfig()` automatically resolve the correct config for SMB orgs. The server controllers, services, and orchestrator dispatch capability checks against the config — SMB's capabilities determine its behavior without any file modifications.

### Contrast With Current Approach

Under the boolean pattern, adding SMB requires:

**Client (20+ file modifications):**
Every `isNs ? nsValue : generalValue` ternary becomes a three-way lookup. Every `if (isNs)` block needs an `else if (isSmb)` clause. Each of these files would need modification:

- `src/lib/platform.ts` — add `useIsSmb()` hook
- `src/components/pipeline-layout.tsx` — add SMB queue label
- `src/routes/create-ticket.tsx` — add SMB mode options
- `src/routes/settings.tsx` — add SMB tab gating + repo filtering
- `src/routes/onboarding.tsx` — add SMB wizard routing
- `src/routes/staging-queue.tsx` — add SMB status label
- `src/routes/dashboard.tsx` — add SMB queue display
- `src/routes/ticket-detail.tsx` — add SMB ticket rendering
- `src/routes/deployment-center.tsx` — add SMB deployment UI
- `src/components/app-shell.tsx` — add SMB navigation labels
- ...and 10+ more files

**Server (9 architectural layers):**
- Auth middleware — add `useIsSmb()` equivalent
- Controller guards — add `requireSmbPlatform()` (another duplicate)
- Controller validation — add third Zod schema branch
- Service logic — add third repo resolution branch
- Orchestrator — add `isSmb` boolean + inline if-blocks
- Step chain — add `isSmb` parameter propagation
- Tool bridges — add SMB-specific tool validation
- Deployment — add SMB deployment pipeline
- Setup/onboarding — add SMB setup flow

**That's the difference**: 2-3 config record additions vs. 30+ file modifications across two repositories.

---

## What Stays Separate

Three concepts that look like "platform" concerns but must not be unified into the org platform abstraction:

### ProductionPlatformType

`DIGITALOCEAN` | `VERCEL` | `NONE` — this is a **per-repository deployment target**, not an org-level identity. A NETSUITE org could have repositories deployed to either platform. The existing `production-platform.ts` factory handles this concern with its own dispatch pattern (class-based, but orthogonal). It stays exactly where it is.

- Client: `src/types/api.ts:1312-1319`
- Server: `prisma/schema.prisma:68-72`, `src/services/production-platform.ts:266-289`

### PX Org Identity

`useIsPxOrg()` checks a hardcoded set of org names (`"PX Cracked"`, `"Project X Innovation"`) for internal feature access (documentation gating). This is an **internal-access gate**, not a platform variant. PX orgs can be GENERAL or NETSUITE — it's orthogonal.

- Client: `src/lib/platform.ts:7,49-52`
- Consumers: `src/routes/docs-landing.tsx`, `src/routes/docs-layout.tsx`, `src/routes/docs-section.tsx`

### OrganizationRepositoryType

`NATIVE_NS` | `SPA_NS` | `null` — this is a **repo-level subtype** meaningful only for NETSUITE organizations. The platform config references it via `repoTypeFilter: ["NATIVE_NS", "SPA_NS"]` but does not absorb the enum. If SMB has its own repo subtypes, they'd be added to this enum independently.

- Server: `prisma/schema.prisma:123-126`
- Consumer: `src/services/ns-deployment-service.ts:501`

---

## Implementation Roadmap

The refactor is sequenced to minimize risk and enable incremental verification.

### Phase 1: Client Config Foundation
- Define `PlatformConfig` type in `src/lib/platform.ts`
- Create `platformConfigs` record with GENERAL and NETSUITE entries
- Implement `usePlatformConfig()` hook alongside existing `useIsNetsuite()`
- **Verify**: `npm run build` + `npm run typecheck` pass; both hooks coexist

### Phase 2: Client Consumer Migration
- Migrate all 20+ consumer files from `useIsNetsuite()` + `isNs` to `usePlatformConfig()` + config destructuring
- Replace `getModeOptions(isNs)` with direct `availableModes` consumption
- Migrate conditional tabs, labels, repo filtering to config lookups
- **Verify**: `npm run build` + `npm run typecheck`; spot-check create-ticket, settings, staging-queue, onboarding in browser

### Phase 3: Client Cleanup
- Remove `useIsNetsuite()` export from `src/lib/platform.ts`
- Align `OrgType` in `org-wizard-dialog.tsx` with `OrganizationPlatform` values
- **Verify**: Build confirms no remaining references; lint passes

### Phase 4: Server Config Foundation
- Create `src/lib/platform-config.ts` with `ServerPlatformConfig` type, `platformConfigs` record, `getPlatformConfig()`, `requirePlatform()`
- Change `AuthContext.organization.platform` from `string` to `OrganizationPlatform` in `session.ts`
- Update `middleware.test.ts` fixtures (`'default'` to `'GENERAL'`)
- **Verify**: `npm run build` + `npm test`

### Phase 5: Server Controller/Service Migration
- Replace `requireNetsuitePlatform()` calls with `requirePlatform(auth, "NETSUITE")` in both controllers
- Change ticket validation schema selection to config-driven
- Change repo resolution strategy to config-driven dispatch
- **Verify**: `npm run build` + `npm test`; verify ticket creation via API for both platforms

### Phase 6: Server Orchestrator Migration
- Replace `isNsPlatform` boolean with `platformConfig` resolved from Prisma query
- Change all orchestrator conditions from identity-based to capability-based
- Propagate typed platform through step chain
- **Verify**: `npm run build` + `npm test`; run test ticket through full workflow for both platforms

### Phase 7: Cross-Validation
- Full build of both repos
- Full server test suite
- Spot-check key user flows in browser (create ticket, settings, onboarding, deployment)
- Verify NS-specific flows still work (credential readiness, sandbox deploy)

---

## Risks and Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Subtle regression in one of 20+ migrated client files | Medium | User-visible wrong label or missing feature | Build + typecheck catch type mismatches; browser spot-check of key routes |
| No client test runner for behavioral regression | High (structural) | Can't automatically verify correct rendering per platform | Pre-existing constraint; lint + typecheck + build are the only automated gates |
| Orchestrator regression from condition refactor | Medium | Workflow failure for NS orgs | NS-specific code unchanged; only conditions change. Existing tests cover freshness blockers. Full test suite run required |
| Auth context type change breaks downstream consumers | Low | Compilation failures | TypeScript strict mode catches all type mismatches at build time |
| `middleware.test.ts` `platform: 'default'` is intentional | Low | Test fixture change may miss edge case | Prisma schema defaults to GENERAL; `'default'` is not a valid enum value at runtime |
| `OrgType` removal affects wizard state management | Low | Onboarding wizard breaks | `OrgType` is local state; changing from `"regular"/"netsuite"` to `"GENERAL"/"NETSUITE"` is a string value swap |

### Open Questions

| Question | Impact | Recommendation |
|----------|--------|----------------|
| What is "SMB" and what are its specific behaviors? | Cannot define its config record yet | The abstraction accommodates it without needing specifics. Define config record when SMB requirements are known |
| Should `useIsPxOrg()` be folded into platform config? | PX org gating is orthogonal but could be unified | Keep separate. PX is org-name-based, not platform-based. A NETSUITE org can also be a PX org |
| Will EXECUTE mode ever extend to non-NS platforms? | Determines if modes are per-platform or per-capability | Current design puts modes in platform config. If EXECUTE expands, simply add it to other platform configs' `availableModes` |
| Should the server orchestrator's NS phases become separate modules? | Affects file structure | Not for 2-3 platforms. Inline with capability dispatch is sufficient. Revisit at 5+ platforms |
| Should platform config eventually be server-driven (fetched from API)? | Enables runtime customization | Good future direction. For now, hardcoded config is simpler and avoids an API roundtrip |
| Should ProductionPlatformType factory adopt the same pattern? | Consistency across platform-like concerns | Not in this refactor. It works and is orthogonal. Unifying adds risk without value |

---

## Methodology

This report was produced through systematic analysis of both the `helix-global-client` and `helix-global-server` codebases, synthesizing findings from multiple analysis phases:

1. **Scout phase**: Mapped all platform-gating files with line-level evidence across both repos (21 client files, 23 server files). Confirmed `helix-cli` is entirely platform-agnostic.
2. **Diagnosis phase**: Identified root cause (missing platform config/capability layer), categorized shared vs. different behavior, and established the functional config direction.
3. **Product phase**: Defined essential features, success criteria, and design principles for both repos. Established the capability-based gating paradigm.
4. **Tech research phase**: Evaluated 3 architecture options per repo (flat config records, capability-only sets/plugin architecture, context providers/class-based strategies). Selected flat config records based on codebase fit, simplicity, and functional preference.
5. **Source verification**: All code references in this report were verified by directly reading source files at the stated line ranges.

### Data Sources

| Source | Repository | Purpose |
|--------|-----------|---------|
| `src/lib/platform.ts` | Client | Platform hook implementation |
| `src/types/api.ts` | Client | OrganizationPlatform type definition |
| `src/components/pipeline-layout.tsx` | Client | Label switching pattern example |
| `src/routes/create-ticket.tsx` | Client | Mode gating pattern example |
| `src/routes/settings.tsx` | Client | Tab gating and repo filtering example |
| `src/routes/onboarding.tsx` | Client | Component selection pattern example |
| `src/components/org-wizard-dialog.tsx` | Client | OrgType parallel type |
| `src/routes/staging-queue.tsx` | Client | Existing Record<> config pattern |
| `prisma/schema.prisma` | Server | OrganizationPlatform enum definition |
| `src/helix-workflow/orchestrator.ts` | Server | isNsPlatform master gate |
| `src/controllers/ticket-controller.ts` | Server | Dual validation schema pattern |
| `src/controllers/settings-controller.ts` | Server | Guard duplication (copy 1) |
| `src/controllers/ns-deployment-controller.ts` | Server | Guard duplication (copy 2) |
| `src/services/ticket-service.ts` | Server | Platform-branched repo resolution |
| `src/auth/session.ts` | Server | AuthContext platform typing |

---

*This report recommends a functional platform config architecture that answers the ticket's four core questions: what is the same (majority of both codebases is platform-agnostic), what is different (8 client dimensions + 9 server dimensions), what are the right abstractions (Record<OrganizationPlatform, PlatformConfig> with capability-based gating), and what is the right way to build it (plain data records + function dispatch, not classes). The pattern is implemented through existing codebase conventions, requires no new dependencies, and makes adding a new platform a one-record-per-repo operation.*

## Attachments
- (none)

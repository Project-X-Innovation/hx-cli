# Ticket Context

- ticket_id: cmp7wziis00fkks0uw2ofrqq6
- short_id: FIX-475
- run_id: cmpa76r7j001bdx0tgs5p0ag9
- run_branch: helix/fix/FIX-475-establish-platform-abstraction-test-coverage-for
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Establish Platform Abstraction Test Coverage for helix-global-client and helix-global-serverNetsuite, and Helix SMB. Ticket

## Description
Implement the test plan outlined in 3

## Research Report

# Platform Abstraction: Risks, Implementation, and Testing Plan

**Ticket**: RSH-474
**Date**: 2026-05-16
**Status**: Ready for Implementation
**Repos**: helix-global-client, helix-global-server
**Based on**: RSH-368 Research Report (Platform Abstraction Architecture)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part 1: Risks vs. Rewards](#part-1-risks-vs-rewards)
   - [Rewards](#rewards)
   - [Risks](#risks)
   - [Verdict: Is It Worth It?](#verdict-is-it-worth-it)
3. [Part 2: Implementation Ticket](#part-2-implementation-ticket)
   - [Title and Description](#title-and-description)
   - [Phased Implementation Plan](#phased-implementation-plan)
   - [Acceptance Criteria](#acceptance-criteria)
   - [Files Changed](#files-changed)
   - [Dependencies and Constraints](#dependencies-and-constraints)
4. [Part 3: Testing Plan Ticket](#part-3-testing-plan-ticket)
   - [Title and Description](#title-and-description-1)
   - [Test Infrastructure Requirements](#test-infrastructure-requirements)
   - [Unit Tests: Client](#unit-tests-client)
   - [Unit Tests: Server](#unit-tests-server)
   - [E2E Tests: Browser Flows](#e2e-tests-browser-flows)
   - [E2E Tests: API Flows](#e2e-tests-api-flows)
   - [Sequencing: Test Before Implement](#sequencing-test-before-implement)
5. [Appendix A: Data Sources](#appendix-a-data-sources)
6. [Appendix B: Platform Dimensions Reference](#appendix-b-platform-dimensions-reference)
7. [Appendix C: File Inventory](#appendix-c-file-inventory)

---

## Executive Summary

The Helix platform supports multiple product variants -- today **Global** and **NetSuite**, with **SMB** planned -- but platform-specific behavior is implemented through a scattered boolean pattern. On the client, `useIsNetsuite()` returns a boolean consumed as `isNs` across 11+ files. On the server, `isNsPlatform` gates ~200 lines of orchestrator logic across 12+ files spanning 9 architectural layers. There is no intermediate layer between platform identity and platform-specific behavior.

The RSH-368 research report proposes replacing this with **functional platform config records** -- plain data objects keyed by `OrganizationPlatform` that declare labels, capabilities, modes, and behavior per platform. This report delivers three deliverables:

1. **Part 1 -- Risks vs. Rewards**: A balanced analysis concluding the refactor is worth it. The structural benefits (adding a new platform = 1 config record per repo vs. 30+ file modifications) outweigh the risks, especially since the highest risk (no client test runner) is a pre-existing gap mitigated by the testing plan in Part 3.

2. **Part 2 -- Implementation Ticket**: A 7-phase plan covering both `helix-global-client` (~13 files) and `helix-global-server` (~12 files) with per-phase verification commands, concrete file lists, and measurable acceptance criteria.

3. **Part 3 -- Testing Plan Ticket**: A comprehensive unit + e2e test plan covering all 17 platform dimensions (8 client + 9 server), sequenced to run **before** the implementation to establish a behavioral baseline.

**Production context**: 13 organizations actively use the platform (8 NETSUITE, 5 GENERAL). No platform-related errors exist in recent production logs. Both platform variants are healthy.

---

## Part 1: Risks vs. Rewards

### Rewards

#### 1. Scalability: 1 Config Record vs. 30+ File Modifications

The most significant structural benefit. Under the current boolean pattern, adding a third platform (SMB) requires modifying:

- **Client**: 11+ consumer files, each adding a third branch to existing `isNs ? nsValue : generalValue` ternaries
- **Server**: 12+ files across 9 architectural layers (auth, controllers, services, orchestrator, step chain, deployment, onboarding, endpoint guards, tests)

Under the proposed config record pattern:

- **Client**: Add 1 `PlatformConfig` entry to `platformConfigs` in `src/lib/platform.ts`
- **Server**: Add 1 `ServerPlatformConfig` entry to `platformConfigs` in `src/lib/platform-config.ts` + 1 Prisma migration

**Zero consumer files change.** The 11+ client components and 12+ server files that currently need per-file modification become closed for modification and open for extension.

> *Evidence*: Scout summaries confirmed 17 files import from `platform.ts` (client); 12+ files with platform patterns (server). Research report Section "Adding a New Platform" details the contrast.

#### 2. Maintainability: Single Source of Truth

Today, platform behavior is defined implicitly across scattered ternaries and if-blocks. Understanding "what differs per platform" requires tracing 11+ client files and 12+ server files. Under the config pattern, a single config record per repo declares all platform-specific behavior in one place.

A new engineer reads one config record to understand all 8 client dimensions or all 9 server dimensions -- no file-tracing required.

> *Evidence*: Diagnosis statements (both repos) identified "missing platform config abstraction layer" as the root cause.

#### 3. Type Safety: string to OrganizationPlatform

The server's `AuthContext.organization.platform` is currently typed as `string` (`session.ts:21`), allowing any string value at compile time. Test fixtures exploit this with `platform: "default"` (`middleware.test.ts:26,35,59`) -- a value that doesn't exist in the Prisma enum.

Tightening to `OrganizationPlatform` makes the entire platform flow type-safe from auth through to every consumer. TypeScript strict mode catches invalid values at compile time.

> *Evidence*: Server scout summary confirmed auth typing gap; diagnosis statement confirmed `"default"` is not a valid enum value (Prisma schema defaults to `GENERAL`).

#### 4. Code Quality: Eliminates Duplication

- **Guard duplication**: `requireNetsuitePlatform()` is copy-pasted identically in `settings-controller.ts:489-495` and `ns-deployment-controller.ts:12-16`. Replaced by a single parameterized `requirePlatform(auth, platform)`.
- **Boolean resolution**: Every consumer currently re-derives `isNs` from the platform string. The hook/utility resolves config once.
- **Mode options helper**: `getModeOptions(isNetsuite)` in `create-ticket.tsx:76-87` is eliminated -- `availableModes` from config replaces it directly.

> *Evidence*: Server diagnosis confirmed character-for-character identical guards. Client tech research decision 6 recommends `getModeOptions` elimination.

#### 5. Developer Experience: Self-Documenting Config

The config record acts as living documentation. Each dimension (labels, capabilities, modes, repo filter, onboarding flow) is explicitly named and typed. Adding or auditing platform behavior is a single-file operation.

#### 6. Existing Codebase Pattern

The `Record<K, V>` config pattern already exists and is proven in this codebase:
- `staging-queue.tsx:17` uses `Record<StagingMergeQueueStatus, { label: string; className: string }>` for status configuration
- `repositories-tab.tsx` uses a similar record for auth mode labels

This is not introducing a new pattern -- it's extending an established idiom.

> *Evidence*: Client scout summary verified `statusConfig` at `staging-queue.tsx:17`.

#### 7. Zero New Dependencies

- **Client**: Uses existing TanStack React Query (`meQueryOptions()`) data source. No new providers, contexts, or libraries.
- **Server**: Uses existing Prisma types and Express HttpError. No new packages.

#### 8. No Prisma Migration Risk

The abstraction work does not modify the `OrganizationPlatform` Prisma enum. No database migration is required. The production database (13 organizations) is untouched.

> *Evidence*: Research report Section "No Prisma Migration for SMB" and server product doc both confirm no schema changes.

---

### Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | **Client: No automated behavioral tests** | HIGH (structural) | Cannot automatically verify rendering per platform after migrating 11+ files | **Pre-existing gap**, not introduced by refactor. Mitigated by: (a) TypeScript strict mode catches type mismatches at build, (b) `npm run build` + `npm run typecheck` + `npm run lint` as automated gates, (c) manual browser spot-checks of key routes, (d) **Testing plan in Part 3 addresses this before implementation** |
| R2 | **Client: Subtle consumer regression** | MEDIUM | One of 11+ migrated files could use wrong config field or destructure incorrectly, producing user-visible wrong labels or missing features | TypeScript strict mode catches type mismatches at build. The `PlatformConfig` type is fully typed -- wrong field access is a compile error. Browser spot-checks of create-ticket, settings, staging-queue, onboarding cover the critical paths. |
| R3 | **Server: Orchestrator condition refactor** | MEDIUM | ~15 branching points change from `isNsPlatform` to capability checks. A wrong condition could break NS workflows | NS-specific code **bodies are unchanged** -- only conditions change. Existing test suite covers freshness blockers (`freshness-blockers.test.ts`), deploy phase (`deploy-phase.test.ts`), and native phase (`native-phase.test.ts`). Full test run (29 files) required post-migration. |
| R4 | **Server: Auth context type cascade** | LOW | Tightening `platform: string` to `OrganizationPlatform` may surface unexpected consumers | TypeScript strict mode catches all type mismatches at build. Grep found only `middleware.test.ts` using invalid `"default"` value. Build failure surfaces any others. |
| R5 | **OrgType wizard state change** | LOW | Changing `"regular"/"netsuite"` to `"GENERAL"/"NETSUITE"` in wizard local state could break onboarding flow | 1:1 string value swap in local component state. TypeScript catches type mismatches. Wizard component selection uses `platformConfigs[selectedPlatform].onboardingFlow` which resolves correctly. |
| R6 | **Production regression** | LOW | 13 active orgs (8 NS, 5 General) could experience broken behavior | All behavior-changing code stays inline -- only conditions change. Build + test + lint gates. Runtime logs confirm no current platform errors. The testing plan (Part 3) establishes a behavioral baseline before changes. |
| R7 | **Step-executor propagation chain** | LOW | Undiscovered consumers of `isNsPlatform` beyond known 5 files | Grep confirmed `isNsPlatform` appears in only 5 files. TypeScript type change from `boolean` to `OrganizationPlatform` catches any missed references at build time. |

---

### Verdict: Is It Worth It?

**Yes. The refactor is worth it.**

The risk-reward balance strongly favors proceeding:

1. **The highest risk (R1: no client tests) is pre-existing.** It exists today and will only worsen as the platform grows. The testing plan in Part 3 directly addresses this gap by establishing test infrastructure *before* the refactor.

2. **The remaining risks (R2-R7) are well-mitigated.** TypeScript strict mode, the existing server test suite (29 files), and `npm run build` provide strong automated gates. The condition-only changes in the orchestrator preserve all existing code bodies.

3. **The rewards compound over time.** Every future platform addition (SMB, or any other variant) benefits from the config pattern. The cost of not refactoring grows linearly with each new platform -- each would require 30+ file modifications vs. 1 config record.

4. **The refactor is low-risk by design.** No database migration. No new dependencies. No API changes. No class hierarchies. The pattern already exists in the codebase (`staging-queue.tsx:17`). The implementation is incremental (7 phases, each independently verifiable).

5. **Production is healthy.** 13 organizations, zero platform-related errors. The refactor preserves behavior while improving the structure.

**Recommendation**: Proceed with the implementation, but execute the Testing Plan (Part 3) first to establish a behavioral baseline and provide automated regression coverage for the refactor.

---

## Part 2: Implementation Ticket

### Title and Description

**Title**: Implement Functional Platform Config Abstraction for helix-global-client and helix-global-server

**Description**: Replace the scattered boolean pattern (`useIsNetsuite()`/`isNs` on client, `isNsPlatform` on server) with functional platform config records. Consumers ask "what does this platform support?" instead of "is this NetSuite?". No database migration. No new dependencies. Adding a new platform becomes a one-record-per-repo operation.

**Prerequisites**: Testing Plan ticket (Part 3) should be completed first to establish behavioral baseline coverage.

---

### Phased Implementation Plan

#### Phase 1: Client Config Foundation

**Goal**: Define the config type, record, and hook alongside the existing `useIsNetsuite()`.

**Files Modified**:
- `src/lib/platform.ts` -- Add `PlatformConfig` type, `platformConfigs` record, `usePlatformConfig()` hook, `getPlatformConfig()` utility

**Changes**:
1. Define the `PlatformConfig` type capturing 8 dimensions:
   ```typescript
   type PlatformConfig = {
     key: OrganizationPlatform;
     displayName: string;
     labels: {
       queue: string;           // "Staging Queue" | "Sandbox Queue"
       mergedStatus: string;    // "MERGED" | "Staged"
       researchMode: string;    // "Research" | "Report"
     };
     capabilities: {
       executeMode: boolean;
       repoPicker: boolean;
       readinessBanner: boolean;
       netsuiteSettingsTab: boolean;
     };
     availableModes: TicketMode[];
     repoTypeFilter: string[] | null;
     onboardingFlow: "general" | "netsuite";
   };
   ```
2. Create `platformConfigs: Record<OrganizationPlatform, PlatformConfig>` with GENERAL and NETSUITE entries
3. Implement `usePlatformConfig()` hook using the same `meQueryOptions()` data source
4. Implement `getPlatformConfig(platform)` non-hook utility

**Verification**: `npm run build && npm run typecheck` -- both hooks coexist

---

#### Phase 2: Client Consumer Migration

**Goal**: Migrate all consumer files from `useIsNetsuite()` + `isNs` to `usePlatformConfig()` + config destructuring.

**Files Modified** (11+ consumer files):

| File | Migration Shape | Change |
|------|----------------|--------|
| `src/components/pipeline-layout.tsx` | Label selection | `isNs ? "Sandbox Queue" : "Staging Queue"` -> `labels.queue` |
| `src/routes/create-ticket.tsx` | Capability gating | `getModeOptions(isNs)` -> `availableModes` from config; `isNs ? "Report" : "Research"` -> `labels.researchMode`; repo picker -> `capabilities.repoPicker` |
| `src/routes/settings.tsx` | Capability gating | NS tab -> `capabilities.netsuiteSettingsTab`; repo filtering -> `repoTypeFilter` |
| `src/routes/onboarding.tsx` | Component selection | `orgType` routing -> `onboardingFlow` config field |
| `src/routes/staging-queue.tsx` | Label selection | `"Staged"` override -> `labels.mergedStatus` |
| `src/routes/dashboard.tsx` | Various | `isNs` at line 382 -> config lookup |
| `src/routes/ticket-detail.tsx` | Various | `isNs` at line 1411 -> config lookup |
| `src/routes/deployment-center.tsx` | Various | `isNs` at line 323 -> config lookup |
| `src/routes/deployment-detail.tsx` | Various | `isNs` at line 381 -> config lookup |
| `src/components/app-shell.tsx` | Label selection | `isNs` at line 213 -> config lookup |
| `src/routes/admin-setup-ns-repo.tsx` | Platform import | Migrate platform usage |
| `src/routes/admin-token-usage.tsx` | Platform import | Migrate platform usage |
| `src/routes/admin.tsx` | Platform import | Migrate platform usage |

**Changes**:
- Replace every `const isNs = useIsNetsuite()` with `const { labels, capabilities, ... } = usePlatformConfig()`
- Eliminate `getModeOptions(isNetsuite)` helper function in `create-ticket.tsx`
- Replace all ternaries and if-blocks with config field access

**Verification**: `npm run build && npm run typecheck && npm run lint`

---

#### Phase 3: Client Cleanup

**Goal**: Remove deprecated hook and align parallel types.

**Files Modified**:
- `src/lib/platform.ts` -- Remove `useIsNetsuite()` export
- `src/components/org-wizard-dialog.tsx` -- Change `OrgType` from `"regular" | "netsuite"` to use `OrganizationPlatform` values (`"GENERAL" | "NETSUITE"`)

**Verification**: `npm run build` -- confirms zero remaining `useIsNetsuite()` references. Build failure catches any missed consumer.

---

#### Phase 4: Server Config Foundation

**Goal**: Create the centralized platform config module, tighten auth typing, fix test fixtures.

**Files Created**:
- `src/lib/platform-config.ts` -- New module containing:
  - `ServerPlatformConfig` type (9 dimensions)
  - `platformConfigs` record (GENERAL + NETSUITE entries)
  - `getPlatformConfig(platform)` utility
  - `requirePlatform(auth, platform)` centralized guard

**Files Modified**:
- `src/auth/session.ts` -- Change `platform: string` to `platform: OrganizationPlatform` (line 21)
- `src/auth/middleware.test.ts` -- Change `platform: "default"` to `platform: "GENERAL"` (lines 26, 35, 59)

**Verification**: `npm run build && npm run test`

---

#### Phase 5: Server Controller/Service Migration

**Goal**: Replace boolean-based validation and resolution with config-driven dispatch.

**Files Modified**:

| File | Change |
|------|--------|
| `src/controllers/settings-controller.ts` | Remove local `requireNetsuitePlatform()`, import `requirePlatform` from `platform-config.ts` |
| `src/controllers/ns-deployment-controller.ts` | Remove local `requireNetsuitePlatform()`, import `requirePlatform` from `platform-config.ts` |
| `src/controllers/ticket-controller.ts` | Replace `isNs` boolean with `getPlatformConfig()` for schema selection and EXECUTE mode validation |
| `src/services/ticket-service.ts` | Replace `isNs` ternary with config-driven repo resolution dispatch |

**Verification**: `npm run build && npm run test && npm run lint`

---

#### Phase 6: Server Orchestrator Migration

**Goal**: Replace `isNsPlatform` boolean with capability-based platform config dispatch throughout the orchestrator and step chain.

**Files Modified**:

| File | Change |
|------|--------|
| `src/helix-workflow/orchestrator.ts` | Replace `isNsPlatform` with `platformConfig = getPlatformConfig(...)`. Change all ~15 conditions from identity-based to capability-based |
| `src/helix-workflow/orchestrator/workflow-step-chain.ts` | Replace `input.isNsPlatform` with `getPlatformConfig(input.platform)` for freshness blocker gating |
| `src/helix-workflow/step-executor/types.ts` | Replace `isNsPlatform?: boolean` with `platform?: OrganizationPlatform` |
| `src/helix-workflow/step-executor/execute.ts` | Pass `platform` instead of `isNsPlatform` |
| `src/helix-workflow/orchestrator/deploy-phase.ts` | Update any `isNsPlatform` references to use platform config |
| `src/services/onboarding-service.ts` | Update platform check (line 81-82) to use config |

**Orchestrator condition mapping**:

| Phase | Before | After |
|-------|--------|-------|
| Credential loading | `isNsPlatform` | `platformConfig.credentials.sdf` |
| ns-gm CLI install | `isNsPlatform` | `platformConfig.workflow.nsGmCli` |
| File Cabinet import | `isNsPlatform` | `platformConfig.workflow.fileCabinetImport` |
| Sandbox deploy | `isNsPlatform && !isResearchMode` | `platformConfig.workflow.sandboxDeploy && !isResearchMode` |
| Freshness blockers | `isNsPlatform` | `platformConfig.workflow.freshnessBlockers` |
| UNVERIFIED handling | `isNsPlatform` | `platformConfig.workflow.sandboxDeploy` |

**Test files updated**:
- `freshness-blockers.test.ts` -- Update `isNsPlatform: true` to `platform: "NETSUITE"` in test fixtures

**Verification**: `npm run build && npm run test`

---

#### Phase 7: Cross-Validation

**Goal**: Full verification across both repos.

**Checks**:
1. `npm run build` on both repos (client: tsc + vite build; server: tsc + prisma migrate)
2. `npm run test` on server (29 test files)
3. `npm run lint` on both repos
4. Browser spot-check for both GENERAL and NETSUITE orgs:
   - Create ticket flow (modes, repo picker, labels)
   - Settings page (tabs, repo filtering)
   - Staging queue (status labels)
   - Onboarding wizard (component selection)
5. Verify NS-specific flows (credential readiness, sandbox deploy) still function

---

### Acceptance Criteria

#### Client

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | `usePlatformConfig()` hook exists in `src/lib/platform.ts` returning typed `PlatformConfig` | Code inspection |
| AC-2 | `platformConfigs` record has GENERAL and NETSUITE entries with all 8 dimensions | Code inspection |
| AC-3 | All 11+ consumer files use config destructuring instead of `isNs` boolean | `grep -r "useIsNetsuite" src/` returns zero results |
| AC-4 | `useIsNetsuite()` fully removed from `platform.ts` | `grep -r "useIsNetsuite" src/lib/platform.ts` returns zero results |
| AC-5 | `getModeOptions()` helper removed from `create-ticket.tsx` | Code inspection |
| AC-6 | `OrgType` uses `OrganizationPlatform` values | Code inspection of `org-wizard-dialog.tsx` |
| AC-7 | `npm run build` passes | CI output |
| AC-8 | `npm run lint` passes | CI output |
| AC-9 | Orthogonal concerns untouched | `useIsPxOrg()`, `ProductionPlatformType`, `useIsAdmin()`, `useIsDeveloper()`, `useIsPowerUser()` unchanged |

#### Server

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-10 | `src/lib/platform-config.ts` exists with `ServerPlatformConfig`, `platformConfigs`, `getPlatformConfig()`, `requirePlatform()` | Code inspection |
| AC-11 | `AuthContext.organization.platform` typed as `OrganizationPlatform` | Code inspection of `session.ts` |
| AC-12 | `middleware.test.ts` fixtures use `"GENERAL"` | Code inspection |
| AC-13 | Duplicated `requireNetsuitePlatform()` removed from both controllers | `grep -r "requireNetsuitePlatform" src/` returns zero results |
| AC-14 | Ticket validation schema selection is config-driven | Code inspection of `ticket-controller.ts` |
| AC-15 | Repo resolution strategy is config-driven | Code inspection of `ticket-service.ts` |
| AC-16 | All orchestrator conditions use capability-based dispatch | `grep "isNsPlatform" src/helix-workflow/` returns zero results |
| AC-17 | Step-executor passes `platform?: OrganizationPlatform` | Code inspection of `types.ts` |
| AC-18 | `npm run build` passes | CI output |
| AC-19 | `npm run test` passes (29 files) | CI output |
| AC-20 | `npm run lint` passes | CI output |
| AC-21 | No Prisma migration created | `ls prisma/migrations/` shows no new directory |

---

### Files Changed

#### Client (~13 files)

| File | Action | Reason |
|------|--------|--------|
| `src/lib/platform.ts` | Modified | Add PlatformConfig type, platformConfigs record, usePlatformConfig() hook, getPlatformConfig() utility; remove useIsNetsuite() |
| `src/components/org-wizard-dialog.tsx` | Modified | Align OrgType to OrganizationPlatform values |
| `src/components/pipeline-layout.tsx` | Modified | Migrate queue label from isNs ternary to labels.queue |
| `src/components/app-shell.tsx` | Modified | Migrate platform usage to config lookup |
| `src/routes/create-ticket.tsx` | Modified | Migrate mode options, repo picker, labels to config; remove getModeOptions() |
| `src/routes/settings.tsx` | Modified | Migrate tab gating + repo filtering to config |
| `src/routes/onboarding.tsx` | Modified | Migrate wizard selection to onboardingFlow config |
| `src/routes/staging-queue.tsx` | Modified | Migrate status label to labels.mergedStatus |
| `src/routes/dashboard.tsx` | Modified | Migrate isNs to config lookup |
| `src/routes/ticket-detail.tsx` | Modified | Migrate isNs to config lookup |
| `src/routes/deployment-center.tsx` | Modified | Migrate isNs to config lookup |
| `src/routes/deployment-detail.tsx` | Modified | Migrate isNs to config lookup |
| `src/routes/admin-setup-ns-repo.tsx` | Modified | Migrate platform import to config |
| `src/routes/admin-token-usage.tsx` | Modified | Migrate platform import to config |
| `src/routes/admin.tsx` | Modified | Migrate platform import to config |

#### Server (~12 files)

| File | Action | Reason |
|------|--------|--------|
| `src/lib/platform-config.ts` | **Created** | New centralized platform config module |
| `src/auth/session.ts` | Modified | Tighten platform typing from string to OrganizationPlatform |
| `src/auth/middleware.test.ts` | Modified | Fix test fixtures from "default" to "GENERAL" |
| `src/controllers/settings-controller.ts` | Modified | Replace local requireNetsuitePlatform() with centralized requirePlatform() |
| `src/controllers/ns-deployment-controller.ts` | Modified | Replace local requireNetsuitePlatform() with centralized requirePlatform() |
| `src/controllers/ticket-controller.ts` | Modified | Config-driven validation schema selection |
| `src/services/ticket-service.ts` | Modified | Config-driven repo resolution |
| `src/helix-workflow/orchestrator.ts` | Modified | Replace isNsPlatform with capability-based platformConfig dispatch |
| `src/helix-workflow/orchestrator/workflow-step-chain.ts` | Modified | Freshness blocker gating via platform config |
| `src/helix-workflow/step-executor/types.ts` | Modified | Replace isNsPlatform?: boolean with platform?: OrganizationPlatform |
| `src/helix-workflow/step-executor/execute.ts` | Modified | Pass platform instead of isNsPlatform |
| `src/services/onboarding-service.ts` | Modified | Update platform check to use config |

#### Not Changed

| File/Repo | Reason |
|-----------|--------|
| `helix-cli` (entire repo) | Zero platform-specific logic (confirmed by research) |
| `prisma/schema.prisma` | No enum changes; SMB addition deferred |
| `src/lib/platform.ts` (useIsPxOrg) | Orthogonal concern (org-name-based, not platform-based) |
| `src/services/production-platform.ts` | Orthogonal concern (per-repo deployment target) |

---

### Dependencies and Constraints

| Constraint | Detail |
|------------|--------|
| **No Prisma migration** | The `OrganizationPlatform` enum is not changed. Database untouched. |
| **No new dependencies** | Client: existing TanStack Query. Server: existing Prisma types + Express HttpError. |
| **TypeScript strict mode** | Both repos. `erasableSyntaxOnly: true` on client (no TS enums; const-object pattern). |
| **No client test runner** | Verification relies on build + typecheck + lint + manual browser checks. Addressed by Testing Plan (Part 3). |
| **Server test runner** | Node.js built-in test runner with tsx. 29 existing test files. |
| **Production impact** | 13 organizations (8 NS, 5 General). All behavior-preserving; only dispatch mechanism changes. |

---

## Part 3: Testing Plan Ticket

### Title and Description

**Title**: Establish Platform Abstraction Test Coverage for helix-global-client and helix-global-server

**Description**: Create comprehensive unit and e2e test coverage for the 17 platform dimensions (8 client + 9 server) that will be refactored in the Platform Config Abstraction implementation ticket. This test plan should be executed **before** the implementation to establish a behavioral baseline, ensuring the refactor preserves all existing platform-specific behavior.

**Sequencing**: Run this ticket FIRST, before the implementation ticket. The tests establish the "before" state, then the implementation preserves the tests passing with the new abstraction.

---

### Test Infrastructure Requirements

#### Client: New Test Framework

The client currently has **zero test infrastructure** -- no test runner, no test files, no test configuration. This is the highest-risk gap.

**Recommended setup**:

| Component | Recommendation | Rationale |
|-----------|---------------|-----------|
| **Test runner** | Vitest | Natural companion to Vite 7 (already in use). Zero-config Vite integration. Compatible with React 19. |
| **React testing** | `@testing-library/react` + `@testing-library/jest-dom` | Standard React testing library. Works with Vitest. |
| **Hook testing** | `@testing-library/react` `renderHook()` | Test `usePlatformConfig()` in isolation |
| **Configuration** | `vitest.config.ts` extending Vite config | Reuse existing Vite config, add test environment (jsdom) |
| **package.json script** | `"test": "vitest run"`, `"test:watch": "vitest"` | Standard Vitest scripts |

**Infrastructure ticket scope**:
1. Install Vitest + testing-library packages
2. Create `vitest.config.ts` with jsdom environment
3. Add `test` script to `package.json`
4. Create a smoke test to verify the framework works
5. Verify `npm run test` executes successfully

#### Server: Extend Existing Infrastructure

The server has 29 existing test files using Node.js built-in test runner with tsx. No new framework needed -- add test files following existing conventions.

---

### Unit Tests: Client

Each test validates one platform dimension for both GENERAL and NETSUITE platforms. These tests target the *new* `usePlatformConfig()` hook and `platformConfigs` record that will be introduced.

#### Test File: `src/lib/__tests__/platform.test.ts`

**Test: Platform config record completeness**
```
- GENERAL config has all required fields (key, displayName, labels, capabilities, availableModes, repoTypeFilter, onboardingFlow)
- NETSUITE config has all required fields
- Every OrganizationPlatform value has a corresponding config entry
```

**Test: usePlatformConfig() hook behavior**
```
- Returns GENERAL config when organization.platform is "GENERAL"
- Returns NETSUITE config when organization.platform is "NETSUITE"
- Defaults to GENERAL when auth data is unavailable
```

**Test: getPlatformConfig() utility**
```
- Returns GENERAL config for "GENERAL" input
- Returns NETSUITE config for "NETSUITE" input
```

#### Dimension-Specific Tests

| # | Dimension | Test Case | Expected (GENERAL) | Expected (NETSUITE) |
|---|-----------|-----------|-------------------|---------------------|
| D1 | Queue label | `config.labels.queue` | `"Staging Queue"` | `"Sandbox Queue"` |
| D2 | Merged status label | `config.labels.mergedStatus` | `"MERGED"` | `"Staged"` |
| D3 | Research mode label | `config.labels.researchMode` | `"Research"` | `"Report"` |
| D4 | Execute mode capability | `config.capabilities.executeMode` | `false` | `true` |
| D5 | Repo picker capability | `config.capabilities.repoPicker` | `true` | `false` |
| D6 | Available modes | `config.availableModes` | `[AUTO, BUILD, FIX, RESEARCH]` (4 modes) | `[AUTO, BUILD, FIX, RESEARCH, EXECUTE]` (5 modes) |
| D7 | Repo type filter | `config.repoTypeFilter` | `null` | `["NATIVE_NS", "SPA_NS"]` |
| D8 | Onboarding flow | `config.onboardingFlow` | `"general"` | `"netsuite"` |

**Additional client unit tests** (post-implementation):

| Test | File Under Test | Behavior |
|------|----------------|----------|
| Readiness banner rendering | `ns-readiness-banner.tsx` | Rendered only when `capabilities.readinessBanner` is true |
| NS settings tab rendering | `settings.tsx` | Tab rendered only when `capabilities.netsuiteSettingsTab` is true |
| Mode picker rendering | `create-ticket.tsx` | Renders exactly `availableModes.length` mode options |
| Repo picker visibility | `create-ticket.tsx` | Visible when `capabilities.repoPicker` is true, hidden when false |

---

### Unit Tests: Server

#### Test File: `src/lib/__tests__/platform-config.test.ts`

**Test: Platform config record completeness**
```
- GENERAL config has all required fields (key, validationSchemaKey, allowedModes, repoResolution, credentials, workflow, endpointGroups)
- NETSUITE config has all required fields
- Every OrganizationPlatform value has a corresponding config entry
```

**Test: getPlatformConfig() utility**
```
- Returns GENERAL config for "GENERAL" input
- Returns NETSUITE config for "NETSUITE" input
```

**Test: requirePlatform() guard**
```
- Passes silently when auth platform matches requested platform
- Throws HttpError(403) when auth platform does not match
- Error message includes the requested platform name
```

#### Dimension-Specific Tests

| # | Dimension | Test Case | Expected (GENERAL) | Expected (NETSUITE) |
|---|-----------|-----------|-------------------|---------------------|
| S1 | Validation schema key | `config.validationSchemaKey` | `"general"` | `"netsuite"` |
| S2 | Allowed modes | `config.allowedModes` | `[AUTO, BUILD, FIX, RESEARCH]` (4 modes) | `[AUTO, BUILD, FIX, RESEARCH, EXECUTE]` (5 modes) |
| S3 | Repo resolution | `config.repoResolution` | `"user-selected"` | `"auto-assigned"` |
| S4 | SDF credentials | `config.credentials.sdf` | `false` | `true` |
| S5 | NS-GM credentials | `config.credentials.nsGm` | `false` | `true` |
| S6 | ns-gm CLI workflow | `config.workflow.nsGmCli` | `false` | `true` |
| S7 | File Cabinet import | `config.workflow.fileCabinetImport` | `false` | `true` |
| S8 | Sandbox deploy | `config.workflow.sandboxDeploy` | `false` | `true` |
| S9 | Freshness blockers | `config.workflow.freshnessBlockers` | `false` | `true` |

**Existing test file updates**:

| Test File | Change |
|-----------|--------|
| `middleware.test.ts` | Update mock fixtures from `"default"` to `"GENERAL"` |
| `freshness-blockers.test.ts` | Update `isNsPlatform: true` to `platform: "NETSUITE"` |
| Other test files using platform mocks | Update to valid `OrganizationPlatform` values |

---

### E2E Tests: Browser Flows

These tests verify end-to-end platform-specific behavior through the browser UI. They require a running dev server and a browser automation framework.

**Recommended framework**: Playwright (standard for Vite projects) or the existing `agent-browser` CLI tool.

#### GENERAL Org Flows

| # | Flow | Steps | Expected Outcome |
|---|------|-------|-----------------|
| E1 | Create ticket | Login as GENERAL org -> Navigate to create ticket | 4 mode options shown (Auto, Build, Fix, Research); repo picker visible; "Research" label on research mode |
| E2 | Staging queue | Navigate to staging queue | "Staging Queue" page title; "MERGED" status label on merged items |
| E3 | Settings page | Navigate to settings | No NetSuite tab visible; all repo types shown in repository list |
| E4 | Onboarding | Start new org onboarding as GENERAL | `GeneralOrgWizardContent` component renders |

#### NETSUITE Org Flows

| # | Flow | Steps | Expected Outcome |
|---|------|-------|-----------------|
| E5 | Create ticket | Login as NETSUITE org -> Navigate to create ticket | 5 mode options shown (Auto, Build, Fix, Report, Execute); repo picker NOT visible; "Report" label on research mode |
| E6 | Staging queue | Navigate to staging queue | "Sandbox Queue" page title; "Staged" status label on merged items |
| E7 | Settings page | Navigate to settings | NetSuite tab visible; repos filtered to NATIVE_NS/SPA_NS types |
| E8 | Credential readiness | Navigate to dashboard | NS readiness banner visible (if credentials incomplete) |
| E9 | Onboarding | Start new org onboarding as NETSUITE | `NsSetupWizardContent` component renders |

---

### E2E Tests: API Flows

These tests verify server-side platform enforcement via HTTP API calls.

#### Ticket Creation

| # | Test | Request | Expected |
|---|------|---------|----------|
| A1 | GENERAL ticket with repos | `POST /tickets` with `repositoryIds` array | 200 OK; ticket created with user-selected repos |
| A2 | NETSUITE ticket without repos | `POST /tickets` without `repositoryIds` | 200 OK; ticket created with auto-assigned repos |
| A3 | NETSUITE EXECUTE mode | `POST /tickets` with `mode: "EXECUTE"` | 200 OK; ticket created in EXECUTE mode |
| A4 | GENERAL EXECUTE mode (rejected) | `POST /tickets` with `mode: "EXECUTE"` as GENERAL org | 400 Bad Request; EXECUTE not available |

#### Endpoint Guards

| # | Test | Request | Expected |
|---|------|---------|----------|
| A5 | NS endpoint from GENERAL org | Access NS-specific endpoint with GENERAL org auth | 403 Forbidden |
| A6 | NS endpoint from NS org | Access NS-specific endpoint with NETSUITE org auth | 200 OK |

#### Platform Config Resolution

| # | Test | Request | Expected |
|---|------|---------|----------|
| A7 | Auth response platform typing | `GET /auth/me` | `organization.platform` is valid OrganizationPlatform value |

---

### Sequencing: Test Before Implement

```
1. [Testing Plan Ticket - Part A: Infrastructure]
   - Set up Vitest on client
   - Add test scripts to package.json
   - Verify framework works with smoke test

2. [Testing Plan Ticket - Part B: Baseline Tests]
   - Write client unit tests for current useIsNetsuite() behavior (these will be adapted after refactor)
   - Write server unit tests for current platform gating behavior
   - Update existing server test fixtures ("default" -> "GENERAL")
   - Run full test suites to establish green baseline

3. [Testing Plan Ticket - Part C: E2E Foundation]
   - Set up browser e2e framework (if not already available)
   - Write e2e tests for both GENERAL and NETSUITE flows
   - Run e2e suite to confirm current behavior captured

4. [Implementation Ticket - Phases 1-7]
   - Execute with test suite running at each phase
   - Adapt client tests from useIsNetsuite() to usePlatformConfig()
   - All tests must stay green through the entire migration

5. [Post-Implementation Validation]
   - Full test suite run
   - Browser verification of all platform flows
   - Production deployment verification
```

**Why this order matters**: Writing tests first captures the *current* correct behavior. If a test fails after the refactor, that's a regression. Without baseline tests, there's no automated way to detect if the refactor changed behavior unintentionally. This is especially critical for the client, which has zero test coverage today.

---

## Appendix A: Data Sources

This report was assembled from the following verified sources:

| Source | Type | Key Contribution |
|--------|------|-----------------|
| RSH-368 Research Report (embedded in ticket.md) | Primary specification | Full current state analysis, proposed abstraction design, 7-phase roadmap, risk assessment |
| Scout summary (helix-global-client) | File inventory | 17 files importing from platform.ts; 8 platform dimensions; no test runner; existing Record<> pattern |
| Scout summary (helix-global-server) | File inventory + runtime | 12+ files with platform patterns; 29 test files; 13 production orgs (8 NS, 5 General); no platform errors |
| Diagnosis statement (helix-global-client) | Root cause analysis | Missing platform config layer; 11 behavioral consumers; 3 migration shapes; 7 success criteria |
| Diagnosis statement (helix-global-server) | Root cause analysis | Missing centralized module + weak auth typing + guard duplication; 12 success criteria |
| Product doc (helix-global-client) | Scope definition | 7 essential features; no test runner constraint; explicit out-of-scope items |
| Product doc (helix-global-server) | Scope definition | 9 essential features; 29 test files; no Prisma migration |
| Tech research (helix-global-client) | Architecture decision | Functional Config Records chosen over Capability Sets and Context Providers |
| Tech research (helix-global-server) | Architecture decision | Functional Config Records chosen over Plugin Architecture and Class-Based Strategy |
| Source code (both repos) | Verification | All code references verified by direct file reading |
| Runtime inspection (server) | Production state | 13 orgs queried; no platform-related errors in logs |

---

## Appendix B: Platform Dimensions Reference

### Client Dimensions (8)

| # | Dimension | File | Lines | GENERAL Value | NETSUITE Value |
|---|-----------|------|-------|---------------|----------------|
| 1 | Queue label | `pipeline-layout.tsx` | 25-31 | "Staging Queue" | "Sandbox Queue" |
| 2 | Ticket modes | `create-ticket.tsx` | 76-87 | AUTO, BUILD, FIX, RESEARCH | AUTO, BUILD, FIX, REPORT, EXECUTE |
| 3 | Repo picker | `create-ticket.tsx` | 97+ | Visible (user selects) | Hidden (auto-assigned) |
| 4 | Settings tabs | `settings.tsx` | 69 | Standard tabs | Standard + NetSuite tab |
| 5 | Onboarding flow | `onboarding.tsx` | 43-66 | GeneralOrgWizardContent | NsSetupWizardContent |
| 6 | Credential UI | `ns-readiness-banner.tsx` | entire file | Not rendered | Conditionally rendered |
| 7 | Repo type filtering | `settings.tsx` | 59-61 | All repos shown | NATIVE_NS/SPA_NS filtered |
| 8 | Status label | `staging-queue.tsx` | 43-45 | "MERGED" | "Staged" |

### Server Dimensions (9)

| # | Dimension | File | Lines | GENERAL Value | NETSUITE Value |
|---|-----------|------|-------|---------------|----------------|
| 1 | Ticket validation | `ticket-controller.ts` | 105-188 | createTicketSchemaGeneral | createTicketSchemaNs |
| 2 | Available modes | `ticket-controller.ts` | 146 | AUTO, BUILD, FIX, RESEARCH | + EXECUTE |
| 3 | Repo resolution | `ticket-service.ts` | 657-663 | User-selected | Auto-assigned (all org repos) |
| 4 | Credentials | `orchestrator.ts` | 864 | None platform-specific | SDF + NS-GM (sandbox+prod) |
| 5 | Workflow tools | `orchestrator.ts` | 1343-1361 | Standard | + ns-gm CLI, SuiteCloud, File Cabinet |
| 6 | Deploy pipeline | `orchestrator.ts` | 2146 | Preview deploy (DO/Vercel) | Sandbox deploy (SDF + SPA) |
| 7 | Freshness blockers | `workflow-step-chain.ts` | 638-657 | N/A | Freshness blocking for NATIVE_NS repos |
| 8 | Endpoint guards | `settings-controller.ts`, `ns-deployment-controller.ts` | 489, 12 | Open | ~10 NS-specific endpoints guarded |
| 9 | Onboarding validation | `onboarding-service.ts` | 81-82 | Standard | Platform !== NETSUITE throws |

---

## Appendix C: File Inventory

### Client Files Requiring Modification

| # | File | Import | Usage |
|---|------|--------|-------|
| 1 | `src/lib/platform.ts` | (source) | Add PlatformConfig + usePlatformConfig(); remove useIsNetsuite() |
| 2 | `src/components/pipeline-layout.tsx` | useIsNetsuite | Queue label ternary |
| 3 | `src/routes/create-ticket.tsx` | useIsNetsuite | getModeOptions + repo picker + labels |
| 4 | `src/routes/settings.tsx` | useIsNetsuite | Tab gating + repo type filtering |
| 5 | `src/routes/onboarding.tsx` | useIsNetsuite | Wizard component selection |
| 6 | `src/routes/staging-queue.tsx` | useIsNetsuite | Status label override |
| 7 | `src/routes/dashboard.tsx` | useIsNetsuite | Platform-specific display |
| 8 | `src/routes/ticket-detail.tsx` | useIsNetsuite | Platform-specific display |
| 9 | `src/routes/deployment-center.tsx` | useIsNetsuite | Platform-specific display |
| 10 | `src/routes/deployment-detail.tsx` | useIsNetsuite | Platform-specific display |
| 11 | `src/components/app-shell.tsx` | useIsNetsuite | Navigation labels |
| 12 | `src/components/org-wizard-dialog.tsx` | (OrgType) | Align to OrganizationPlatform values |
| 13 | `src/routes/admin-setup-ns-repo.tsx` | platform import | Admin platform usage |
| 14 | `src/routes/admin-token-usage.tsx` | platform import | Admin platform usage |
| 15 | `src/routes/admin.tsx` | platform import | Admin platform usage |

### Server Files Requiring Modification

| # | File | Current Pattern | Target Pattern |
|---|------|----------------|----------------|
| 1 | `src/lib/platform-config.ts` | (new) | New centralized config module |
| 2 | `src/auth/session.ts` | `platform: string` | `platform: OrganizationPlatform` |
| 3 | `src/auth/middleware.test.ts` | `"default"` | `"GENERAL"` |
| 4 | `src/controllers/settings-controller.ts` | `requireNetsuitePlatform()` | `requirePlatform(auth, "NETSUITE")` |
| 5 | `src/controllers/ns-deployment-controller.ts` | `requireNetsuitePlatform()` | `requirePlatform(auth, "NETSUITE")` |
| 6 | `src/controllers/ticket-controller.ts` | `isNs` boolean branch | Config-driven schema selection |
| 7 | `src/services/ticket-service.ts` | `isNs` ternary | Config-driven repo resolution |
| 8 | `src/helix-workflow/orchestrator.ts` | `isNsPlatform` (~15 usages) | `platformConfig.capability` checks |
| 9 | `src/helix-workflow/orchestrator/workflow-step-chain.ts` | `input.isNsPlatform` | `getPlatformConfig(input.platform)` |
| 10 | `src/helix-workflow/step-executor/types.ts` | `isNsPlatform?: boolean` | `platform?: OrganizationPlatform` |
| 11 | `src/helix-workflow/step-executor/execute.ts` | `isNsPlatform` passthrough | `platform` passthrough |
| 12 | `src/services/onboarding-service.ts` | `platform !== "NETSUITE"` | Config-based check |

### Files Explicitly NOT Changed

| File/Repo | Reason |
|-----------|--------|
| `helix-cli` (all files) | Zero platform-specific logic |
| `prisma/schema.prisma` | No enum changes (SMB deferred) |
| `src/lib/platform.ts` (useIsPxOrg) | Orthogonal: org-name-based, not platform-based |
| `src/services/production-platform.ts` | Orthogonal: per-repo deployment target |
| `src/components/ns-readiness-banner.tsx` | Internals unchanged; only conditional rendering changes |
| `src/components/ns-setup-wizard-dialog.tsx` | Internals unchanged; only conditional rendering changes |

---

*This report delivers three deliverables: (1) a risk/reward analysis recommending the refactor proceed, (2) a 7-phase implementation ticket with concrete file lists and acceptance criteria, and (3) a testing plan to establish behavioral baselines before the refactor. The testing plan should execute first, followed by the implementation, to ensure the refactor preserves all 17 platform dimensions across both repositories.*

## Attachments
- (none)

## Discussion
- **Helix** (2026-05-16T06:56:44.906Z) [Agent]: Your changes are ready! Updated 2 repositories.

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/0/image?runId=cmp7wzij900fpks0uz26vwzb2)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/1/image?runId=cmp7wzij900fpks0uz26vwzb2)
- **Helix** (2026-05-16T21:56:51.573Z) [Agent]: Your changes are ready! Updated 2 repositories.

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/0/image?runId=cmp8rnuiv00k4ks0uzmn2t3lo)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/1/image?runId=cmp8rnuiv00k4ks0uzmn2t3lo)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/2/image?runId=cmp8rnuiv00k4ks0uzmn2t3lo)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/3/image?runId=cmp8rnuiv00k4ks0uzmn2t3lo)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/4/image?runId=cmp8rnuiv00k4ks0uzmn2t3lo)
- **Helix** (2026-05-16T23:59:23.211Z) [Agent]: Your changes are ready! Updated 2 repositories.

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/0/image?runId=cmp8ws61u00omks0u8pd8uri4)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/1/image?runId=cmp8ws61u00omks0u8pd8uri4)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/2/image?runId=cmp8ws61u00omks0u8pd8uri4)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/3/image?runId=cmp8ws61u00omks0u8pd8uri4)

![Verification Screenshot](/tickets/cmp7wziis00fkks0uw2ofrqq6/proof/4/image?runId=cmp8ws61u00omks0u8pd8uri4)
- **Usher** (2026-05-17T00:02:08.359Z) [Helix]: @Helix what was added
- **Helix** (2026-05-17T00:02:27.259Z) [Agent]: Here's a summary of what was added and changed across both repositories:

---

### helix-global-client — E2E Browser Test Hardening

- **Credentials externalized**: The hardcoded password in `auth.setup.ts` was removed and replaced with an environment variable (`E2E_LOGIN_PASSWORD`) that throws an error if missing — no more secrets in code.
- **Non-discriminative assertions replaced**: All 6 "OR" assertion patterns (e.g., `expect(A || B).toBeTruthy()`) were replaced with explicit positive + negative assertion pairs (e.g., `expect(A).toBeTruthy()` + `expect(B).toBeFalsy()`). These can now actually catch a platform regression.
- **Silent failures eliminated**: `console.log`-only observations were replaced with hard assertions or Playwright annotations.
- **Skips made visible**: Silent pass-throughs for the mode picker (behind an "Advanced Options" flag) were replaced with `test.skip()` calls that show a clear reason in test reports.

---

### helix-global-server — E2E API Test Hardening

- **`src/app.ts` extracted** (from a prior run): The Express app was separated from server startup logic, making it importable for testing without spinning up a real server.
- **7 API platform tests added** (`src/e2e/api-platform.test.ts`): Tests cover ticket creation for GENERAL and NetSuite orgs, mode validation (EXECUTE blocked for GENERAL), platform-gated deployment endpoints, and the auth/me endpoint — all using `supertest`.
- **OR assertion cleaned up**: A redundant OR pattern in the A7 test was replaced with a discriminative `assert.equal`.
- **All 7 API tests pass**; 12 pre-existing failures in unrelated files remain unchanged.
- **Usher** (2026-05-17T00:03:30.717Z) [Helix]: Do I need to put an env variable or Helix already knows how
- **Helix** (2026-05-17T00:03:39.782Z) [Agent]: You'll need to set that one up yourself. `E2E_LOGIN_PASSWORD` is a secret (a login credential), so Helix can't know or store it — it needs to come from your environment or CI secrets manager.

Just add it wherever your E2E tests run:
- **Locally**: set it in your shell or `.env` file
- **CI (e.g., GitHub Actions)**: add it as a repository secret and reference it in your workflow

Once it's in place, the auth setup will pick it up automatically.
- **Usher** (2026-05-17T00:04:14.364Z) [Helix]: Anything else you recommend we add or are we good to go?
- **Helix** (2026-05-17T00:04:27.686Z) [Agent]: The core work looks solid! A few things worth considering before you ship:

1. **NetSuite & Helix SMB coverage** — The ticket title mentions NetSuite and Helix SMB specifically. The server-side API tests cover NetSuite org scenarios, but it's worth confirming Helix SMB platform paths have equivalent coverage if they were in scope.

2. **CI integration** — Make sure `E2E_LOGIN_PASSWORD` is wired into your CI pipeline so the new browser tests don't silently skip or fail in automated runs.

3. **The 12 pre-existing test failures** — These weren't introduced by Helix, but now that test coverage is more visible, it might be a good time to triage those and decide if any are worth fixing.

4. **Coverage thresholds** — If your project has a minimum coverage target, it's worth checking if the new tests push you above it or if there are gaps in edge cases (e.g., expired tokens, invalid platform values).

Outside of those, you're in good shape. The non-discriminative assertions and credential hardening were the main hygiene issues, and those are resolved. ✅
- **Usher** (2026-05-17T00:05:07.582Z) [Helix]: What are the pre-existing test failures
- **Helix** (2026-05-17T00:05:21.833Z) [Agent]: Here are the 12 pre-existing failures, all in `helix-global-server` and all unrelated to the platform abstraction work:

| File | # Failures | Root Cause |
|---|---|---|
| `comment-controller.test.ts` | 1 | Helix reply generation issue |
| `github-merge-service-fallback.test.ts` | 3 | Import error on `cleanupTerminalTicketResources` |
| `staging-queue-service.test.ts` | 2 | Same import error + missing `DATABASE_URL` |
| `ticket-service-artifacts.test.ts` | 6 | Import issue with `markRunFailed` |

The common thread across most of them is broken imports — likely functions that were moved, renamed, or removed at some point. None of them are related to anything Helix touched in this ticket.

If you want to address them, the `github-merge-service-fallback`, `staging-queue-service`, and `ticket-service-artifacts` failures look like they might all stem from the same refactor (the `cleanupTerminalTicketResources`/`markRunFailed` import chain), so fixing that could knock out 11 of the 12 in one go.
- **Usher** (2026-05-17T00:05:56.649Z) [Helix]: Let's go ahead and fix them up.
- **Helix** (2026-05-17T00:06:08.068Z) [Agent]: Helix is now working on resolving those pre-existing failures — starting with the broken import chain around `cleanupTerminalTicketResources` and `markRunFailed`, which should take care of the bulk of them. I'll update you when it's done!
- **Helix** (2026-05-17T01:10:52.494Z) [Agent]: I'm working on this, I'll get back to you when ready.
- **Usher** (2026-05-17T02:36:17.243Z) [Helix]: What's going on
- **Helix** (2026-05-17T02:36:21.687Z) [Agent]: I'm working on this, I'll get back to you when ready.
- **Helix** (2026-05-17T02:37:51.745Z) [Agent]: I'm working on this, I'll get back to you when ready.
- **Helix** (2026-05-17T19:22:38.156Z) [Agent]: I'm working on this, I'll get back to you when ready.
- **Helix** (2026-05-17T19:47:18.593Z) [Agent]: I'm working on this, I'll get back to you when ready.
- **Helix** (2026-05-17T19:52:35.489Z) [Agent]: I'm working on this, I'll get back to you when ready.

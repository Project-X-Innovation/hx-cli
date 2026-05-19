# Ticket Context

- ticket_id: cmpd3tbcd003tfw0uv0i6olc3
- short_id: RSH-500
- run_id: cmpd3tbct003zfw0ug6gxj9d3
- run_branch: helix/research/RSH-500-helix-for-smb-basic-infra-utility
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Helix for SMB - Basic Infra & Utility

## Description
All right so what should go into an MVP of this concept? First of all just take a step back and think about it a little bit. What should it look like? I'll give you some ideas and I'll tell you where it diverges from Helix NetSuite and where it converges.



First of all I think we need everything we discussed in the last ticket. That's just the basic infrastructure. What next? I think there are some sections of business that people will want to integrate with. I'm sure you can come up with the basic ideas and some kind of onboarding, whether it's integration or whether they need it on the spot.



For a lot of people they have either:

- existing software

- random spreadsheets, messages, et cetera

- or they actually need an ERP like we've discussed



&nbsp;

I think an MVP is some mix of that: some way of easily sending over via email or WhatsApp documents, contacts, data, context, and integrating with their existing software. Maybe we can come up with some classes and provisioning an ERP and putting it all together.

## Research Report

# Helix for SMB: Basic Infrastructure & Utility Research Report

**Ticket:** RSH-495
**Date:** 2026-05-19
**Repositories Analyzed:** helix-global-server, helix-global-client, breadery-client (reference), helix-cli (context)
**Report Type:** Research & Architecture Blueprint

---

## 1. Executive Summary

Helix's SMB customer onboarding today requires an administrator to manually provision and configure five separate systems: a Neon PostgreSQL database, a GitHub code repository, a Vercel deployment, environment variables, and standalone authentication credentials. The Breadery -- Helix's sole SMB customer to date -- was set up entirely by hand through this process. This manual path does not scale.

**Core finding: Composition, not invention.** All four infrastructure building blocks needed for automated SMB provisioning already exist as independent, production-tested services in helix-global-server:

| Building Block | Existing Service | Status |
|----------------|-----------------|--------|
| Database provisioning | `neon/provisioning.ts` via `createProject()` in `neon/api.ts` | Production-active (3 repos at READY) |
| Code repository creation | `github-repo-service.ts` with collision handling | Production-active |
| Deployment pipeline | `production-platform.ts` + `deployment-execution-service.ts` | Production-active (3 VERCEL repos) |
| Authentication | `oauth-service.ts` with OAuth 2.1 PKCE | Implemented, not yet used for SMB |

However, none of these services are wired into the GENERAL platform provisioning flow. The `provisionOrganization()` function in `setup-service.ts` creates only database records (org, users, repo references). Each infrastructure step requires separate manual API calls or external configuration. The result: The Breadery has `neonProvisioningStatus=READY` but `productionPlatform=NONE` in Helix's database -- deployment was managed entirely outside Helix.

**Recommendation:** Extend `provisionOrganization()` to compose these four existing services into a unified, automated flow. Add an Operations nav item in helix-global-client that surfaces the customer's deployed app via OAuth 2.1 PKCE redirect -- no iframes, no separate login. Create a GitHub template repository (Next.js + Drizzle + Helix OAuth) as the scaffold for new SMB apps. Schema changes are minimal: two nullable fields on existing models.

The implementation spans two repositories (helix-global-server and helix-global-client) and requires no new external dependencies or fundamental architecture changes. All five existing GENERAL organizations remain unaffected -- new fields default to null.

---

## 2. Background & Context

### 2.1 The SMB Premise

Helix is a platform that builds itself -- when a new customer starts, they have Helix but zero operational complexity. As they build via tickets, Helix writes code, deploys it, and their operational footprint grows. The foundational premise for SMB is that customers should never deal with infrastructure:

> "Customers don't have to worry about provisioning code or deploying code or setting up a DB. That's all taken care of. They just have to put in tickets and things get built."
> -- Ticket RSH-495

The four building blocks every SMB customer needs are:

1. **A database** -- provisioned automatically, not set up manually
2. **A code repository** -- automatically provisioned, not created by hand
3. **A deployment target** -- code deploys without the customer touching deployment tooling
4. **A unified login** -- customers authenticate through Helix, not through a separate system

### 2.2 The Breadery: Manual Baseline

The Breadery is the only existing SMB customer. It is a standalone Next.js 15 bakery operations app managing customers, standing orders, order runs, restock, and delivery schedules. It was set up entirely by hand by a Helix administrator:

1. Organization "The Breadery" created in Helix (GENERAL platform, 2026-04-16)
2. `breadery-client` repository registered in Helix with Neon database provisioned (status: READY)
3. App deployed to Vercel **separately** -- outside Helix's control (`productionPlatform=NONE`)
4. Standalone JWT auth configured (`ADMIN_PASSWORD` env var) with zero Helix SSO integration
5. Environment variables (`DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `VEPAAR_*`) manually set in Vercel dashboard

**Source:** breadery-client scout summary; production DB query confirming `neonProvisioningStatus=READY`, `productionPlatform=NONE` for The Breadery's repo.

The Breadery proves the concept works -- SMB customers can run operational software built by Helix. But the setup path is entirely manual and does not scale. This report documents what it would take to automate this path.

---

## 3. Current State Assessment

### 3.1 GitHub Repository Creation

**Service:** `src/services/github-repo-service.ts` in helix-global-server
**Function:** `createGitHubRepositoryWithCollisionHandling()`

Creates private GitHub repos via the GitHub REST API using the platform's `GITHUB_TOKEN` (configured in `env.ts`). Handles name collisions with `_b` through `_z` suffixes. Currently used during NetSuite org setup and available as a standalone endpoint (`POST /api/setup/create-repository`).

**Gap:** Only invoked during NetSuite onboarding. `provisionOrganization()` for GENERAL platform does not call this function -- it expects repo URLs to be provided by the administrator. No template-based repo creation exists (`auto_init: true` creates repos with just a README).

### 3.2 Neon Database Provisioning

**Service:** `src/services/neon/provisioning.ts` in helix-global-server
**API Client:** `src/services/neon/api.ts`

`provisionRepo()` (lines 113-206) orchestrates the full pipeline: create Neon project via `createProject()`, spin up a Vercel sandbox runtime, install PostgreSQL 17, run `pg_dump` from a source database, `pg_restore` to the Neon target. Status tracked as `PROVISIONING` -> `READY` or `FAILED` on the `OrganizationRepository` record.

Per-ticket Neon branching is actively running in production via `ticket-branches.ts` -- production logs confirm tier-1 cache hits, branch creation, and cleanup within the last 24 hours.

**Production status:**

| Neon Provisioning Status | Count (GENERAL repos) |
|--------------------------|----------------------|
| READY | 3 |
| null (not provisioned) | 24 |

**Gap:** The provisioning flow requires a `sourceConnectionUri` for `pg_dump`/`pg_restore` -- there is no code path for creating a fresh empty database. New SMB customers have no source database to dump from. However, the underlying `createProject()` in `neon/api.ts` already creates empty Neon projects -- this capability just needs to be exposed without the dump/restore pipeline.

### 3.3 Deployment Platform

**Service:** `src/services/production-platform.ts` in helix-global-server
**Orchestrator:** `src/services/deployment-execution-service.ts`

Supports two platforms via an abstract interface:
- **DigitalOcean App Platform** -- `DigitalOceanAppPlatform` class
- **Vercel** -- `VercelPlatform` class with `setEnvVars()`, `getDeploymentStatus()`, and the reusable `vercelFetch()` helper

`executeDeployment()` merges staging branches to main and triggers platform deploys. The pipeline includes 15-second polling intervals with 10-minute timeouts for deployment completion tracking.

**Production deployment platform distribution (all repos):**

| Platform | Count |
|----------|-------|
| NONE | 23 |
| VERCEL | 3 |
| DIGITALOCEAN | 1 |

**GENERAL platform specifics:** Among the 27 GENERAL repos, only `finesse-landing` and `Sprint-Calendar` use `productionPlatform=VERCEL`. The Breadery has `productionPlatform=NONE` despite being Vercel-hosted in practice -- deployment was configured outside Helix.

**Gap:** No Vercel project creation capability exists -- `VercelPlatform` manages existing projects but cannot create new ones. The `productionPlatform` field defaults to `NONE` for new repos with no auto-configuration during org setup.

### 3.4 OAuth 2.1 and Authentication

**Service:** `src/auth/oauth-service.ts` in helix-global-server
**Models:** `OAuthClient`, `OAuthAuthorizationCode`, `OAuthRefreshToken` in `prisma/schema.prisma`

Full OAuth 2.1 authorization code flow with PKCE is implemented:
- `generateAuthorizationCode()` creates auth codes with PKCE challenge, scoped to `userId` + `organizationId`
- `exchangeCodeForTokens()` verifies PKCE, supports public clients (null `clientSecretHash` at lines 106-113), issues JWT access tokens
- `validateClient()` supports both registered and URL-based client IDs
- Refresh token rotation is implemented

**Gap:** No SMB customer app has been integrated with the OAuth flow. The Breadery uses standalone JWT auth (`lib/auth.ts`) with an `ADMIN_PASSWORD` env var and its own `JWT_SECRET` -- completely disconnected from Helix. The `OAuthClient` table could not be queried in production (permission denied), so the current state of registered clients is unknown.

### 3.5 Client UI

**App:** helix-global-client -- React 19, Vite 7, React Router 7, Tailwind CSS v4, TanStack React Query

Navigation has 6 primary items: Home (tickets), Pipeline (staging-queue + deployments), Library, Settings, Docs, More (Notes to Tickets, Usage, Token Usage). The general org wizard (`general-org-wizard-dialog.tsx`) has a 5-step flow: org-details -> users -> repositories -> review -> complete.

**Gap:** No `/operations` route, no Operations menu item, no mechanism to surface customer operational apps. The wizard collects repo URLs but does not trigger GitHub repo creation or Neon database provisioning -- those are separate manual steps.

### 3.6 Production Landscape

**Data gathered via runtime inspection of the production database (2026-05-19):**

| Metric | Value |
|--------|-------|
| Total organizations | 13 (5 GENERAL + 8 NETSUITE) |
| Total GENERAL repos | 27 |
| Repos with Neon READY | 3 |
| Repos with productionPlatform=VERCEL | 3 (finesse-landing, Sprint-Calendar, + 1 non-GENERAL) |
| Repos with productionPlatform=DIGITALOCEAN | 1 |
| Repos with productionPlatform=NONE | 23 |

**GENERAL platform organizations:**

| Organization | Created | Notes |
|-------------|---------|-------|
| Project X Innovation | 2026-03-03 | Internal; 10+ repos including helix-cli, breadery-client |
| PX Cracked | 2026-03-28 | Internal |
| Finesse Contracts | 2026-04-15 | Has finesse-landing on Vercel |
| The Breadery | 2026-04-16 | SMB reference; Neon READY, productionPlatform=NONE |
| Motty Inc | 2026-04-24 | Newest; 1 repo (Prosper, no provisioning) |

**Key observation:** The Breadery is the only GENERAL org where Neon is provisioned to READY, yet its deployment was configured entirely outside Helix (`productionPlatform=NONE`). This is the precise gap the automated flow would close.

---

## 4. Gap Analysis

### 4.1 Unified Provisioning Flow

**What exists:** `provisionOrganization()` in `setup-service.ts` (lines 458-575) creates org records, upserts users with bcrypt password hashes, registers pre-existing repo URLs provided by the caller, and auto-provisions a library repo via `ensureReportRepo()` (fire-and-forget pattern at lines 546-572).

**What's missing:** The function does not:
- Create a GitHub repository (`createGitHubRepositoryWithCollisionHandling()` is not called)
- Trigger Neon database provisioning (`provisionRepo()` is not called)
- Configure a deployment platform (repos get `productionPlatform=NONE`)
- Register an OAuth client for SSO

**Production evidence:** All five GENERAL orgs have repos with `productionPlatform=NONE` by default. Neon provisioning was triggered manually for The Breadery's repo via a separate `POST /api/settings/repositories/:id/neon/provision` call.

### 4.2 Operational Pane

**What exists:** helix-global-client has a comprehensive nav structure with Home, Pipeline, Library, Settings, Docs, and More items in `app-shell.tsx`.

**What's missing:** No `/operations` route exists in `App.tsx`. No Operations menu item in the navigation. No mechanism to surface a customer's deployed operational app within Helix. No iframe usage exists anywhere in the codebase (consistent with the ticket's rejection of iframes).

**Production evidence:** Breadery users must navigate to a completely separate URL and log in with a separate password to access their operational app.

### 4.3 SSO/OAuth Integration

**What exists:** OAuth 2.1 with PKCE fully implemented in `oauth-service.ts`. Public client support (null `clientSecretHash`). `OAuthClient` model has `organizationId` for org-scoped clients. JWT session infrastructure in `auth/middleware.ts` and `auth/session.ts`.

**What's missing:** No SMB customer app has been integrated. Breadery uses standalone `ADMIN_PASSWORD` -> JWT auth (`breadery-client/lib/auth.ts`). No auto-registration of OAuth clients during org provisioning. No client-side OAuth redirect flow for accessing customer apps.

**Production evidence:** Breadery's `.env.example` shows `JWT_SECRET` and `ADMIN_PASSWORD` as required env vars -- entirely separate from Helix's auth system.

### 4.4 Auto-Deployment

**What exists:** Full deployment pipeline in `deployment-execution-service.ts` supporting Vercel and DigitalOcean. `VercelPlatform` class with `setEnvVars()` and `getDeploymentStatus()`. Existing `vercelFetch()` helper for API calls. `VERCEL_PRODUCTION_TOKEN` configured in `env.ts`.

**What's missing:** No Vercel project creation capability -- the pipeline manages existing projects but cannot create new ones. No auto-deploy-on-merge for customer repos. New repos default to `productionPlatform=NONE` with no automatic configuration.

**Production evidence:** Only `finesse-landing` and `Sprint-Calendar` have `productionPlatform=VERCEL` among GENERAL repos. The Breadery is Vercel-hosted but Helix has no record of this (`productionPlatform=NONE`).

### 4.5 Starter Template

**What exists:** Breadery-client serves as a reference implementation: Next.js 15 App Router, Drizzle ORM 0.39.3, PostgreSQL, `vercel-build` script that runs migrations before Next.js build. The GitHub repo creation service supports `auto_init: true` (empty repo with README).

**What's missing:** No GitHub template repository exists for new SMB apps. No template-based repo creation function (GitHub's Template API `POST /repos/{template}/generate` is not used). New repos would start empty with no scaffold.

**Production evidence:** The Breadery was built from scratch, requiring multiple tickets to get a functioning app. A template would provide a working scaffold from day one.

---

## 5. Architecture Recommendation

### 5.1 Provisioning Flow: Extend provisionOrganization()

**Chosen approach:** Compose the four independent provisioning services into the existing `provisionOrganization()` flow in `setup-service.ts`.

**Rationale:** All building blocks exist. The function already has the pattern for fire-and-forget background tasks (library repo creation at lines 546-572). The same pattern applies to Neon provisioning (background task with status tracking). This is the smallest change that achieves the goal -- no new services, no new endpoints for the core flow, just composition of existing pieces.

**Extended flow:**
1. Create org + users (existing)
2. Create GitHub repo from template (NEW -- `createGitHubRepoFromTemplate()`)
3. Register OrganizationRepository with repo URL (existing, resequenced)
4. Fire-and-forget: Neon provisioning via empty-project path (NEW trigger)
5. Fire-and-forget: Vercel project creation + GitHub linking (NEW -- `createVercelProject()`)
6. Register OAuth client for customer app (NEW -- `registerOAuthClientForOrg()`)
7. Auto-provision library repo (existing)

**Rejected alternatives:**

| Alternative | Why Rejected |
|-------------|-------------|
| New dedicated `smb-provisioning-service.ts` | Duplicates org/user creation logic already in `provisionOrganization()`. The GENERAL flow IS the SMB flow -- no parallel code path needed. |
| Event-driven provisioning pipeline | Over-engineering for current scale. Adds Redis/Bull dependency without proportional benefit. Neon's status tracking already provides async coordination. |

### 5.2 Deployment Platform: Vercel with GitHub Auto-Linking

**Chosen approach:** Vercel as the default SMB deployment platform with auto-deploy via GitHub integration.

**Rationale:**
- **Breadery precedent** -- proven to work for Next.js SMB apps
- **Vercel API** supports project creation + GitHub linking in a single call (`POST /v11/projects` with `gitRepository`), enabling zero-touch deploy-on-push
- **Existing infrastructure** -- `VERCEL_PRODUCTION_TOKEN` and `VercelPlatform` class already exist
- **No custom pipelines needed** -- Vercel's built-in GitHub integration handles deploy-on-merge automatically

**New function:** `createVercelProject()` added to `production-platform.ts` using the existing `vercelFetch()` helper.

```
POST /v11/projects
Body: {
  name: "<org-slug>-operations",
  framework: "nextjs",
  gitRepository: { repo: "owner/name", type: "github" },
  environmentVariables: [
    { key: "DATABASE_URL", value: "<neon-connection-uri>", type: "encrypted", target: ["production", "preview"] },
    // OAuth client credentials injected here
  ]
}
```

**Auto-injected environment variables per tenant app:**

| Env Var | Source | Purpose |
|---------|--------|---------|
| `DATABASE_URL` | Neon provisioning connection URI | Database access |
| OAuth-related env vars | Auto-registered OAuth client | Helix SSO integration |

**Rejected alternatives:**

| Alternative | Why Rejected |
|-------------|-------------|
| DigitalOcean App Platform | Supported by existing code but requires more manual config (app spec). No SMB precedent. Higher ops overhead for Next.js. |
| Sprites.dev (Fly Sprites) | Currently only for ephemeral preview environments. Production hosting untested. |

### 5.3 Operations Pane: External Link with OAuth Redirect

**Chosen approach:** An Operations nav item in helix-global-client that opens the customer app URL in a new tab, with OAuth-initiated session.

**Rationale:**
- Ticket explicitly rejects iframes: "It shouldn't be an iFrame"
- Ticket endorses external navigation: "Maybe they click a link and they get taken to a different site. That's not the end of the world."
- External link is the simplest viable approach
- OAuth PKCE provides seamless auth handoff without a second login prompt (Helix session is already active, so the authorize endpoint can auto-approve for the same user)

**Auth flow:**
1. User clicks "Operations" in Helix nav
2. Client initiates OAuth authorization request to Helix server (`/oauth/authorize` with PKCE)
3. Server auto-approves (user already authenticated) and redirects to customer app's callback URL with auth code
4. Customer app exchanges code for tokens via PKCE
5. User lands on customer app authenticated -- no second login

**Rejected alternatives:**

| Alternative | Why Rejected |
|-------------|-------------|
| iframe embed | Explicitly rejected by ticket. Security concerns (CSP, clickjacking). UX limitations (nested scrolling). |
| Subdomain routing | Complex infrastructure (wildcard cert, DNS, reverse proxy). Overkill for MVP. |
| Shared JWT secret | Security coupling -- any secret rotation breaks all customer apps simultaneously. |

### 5.4 SSO Mechanism: OAuth 2.1 PKCE Public Client

**Chosen approach:** Public client (no `client_secret`) with PKCE S256 challenge.

**Rationale:** SMB customer apps are SPAs (Next.js) where `client_secret` cannot be securely stored. The existing OAuth implementation already handles public clients (null `clientSecretHash` at `oauth-service.ts:106-113`). PKCE provides the security guarantee without requiring a backend secret exchange.

**New function:** `registerOAuthClientForOrg()` creates an `OAuthClient` record during provisioning:
- `clientId`: auto-generated
- `redirectUris`: `[appBaseUrl/api/auth/callback]`
- `organizationId`: linked to the provisioned org
- `clientSecretHash`: null (public client)
- `isActive`: true

**Rejected alternatives:**

| Alternative | Why Rejected |
|-------------|-------------|
| Shared JWT secret | Security risk -- one compromised tenant exposes Helix. No refresh token rotation, no scope control. |
| API key pass-through | Less secure than OAuth. No token rotation. No granular scoping. |

### 5.5 Starter Template: GitHub Template Repository

**Chosen approach:** GitHub template repository via `POST /repos/{template_owner}/{template_repo}/generate`.

**Rationale:** New SMB repos need a working app scaffold from day one -- not an empty `auto_init` repo. The template eliminates the cold-start problem where a customer would need multiple Helix tickets just to get a functioning app.

**Template stack** (informed by Breadery reference):
- Next.js 15 (App Router)
- Drizzle ORM with PostgreSQL
- Helix OAuth PKCE client (replacing standalone JWT)
- `vercel-build` script that runs Drizzle migrations automatically
- Minimal operational dashboard scaffold

**New function:** `createGitHubRepoFromTemplate()` in `github-repo-service.ts` using the existing `fetchGitHubJson()` helper. Falls back to `createGitHubRepository()` with `auto_init` if the template is not found.

**Dependency:** A template repository (e.g., `smb-app-template`) must be created in the GitHub org and marked as a "template repository" in GitHub settings. This is a one-time manual setup task.

**Rejected alternatives:**

| Alternative | Why Rejected |
|-------------|-------------|
| Empty repo + ticket-driven scaffolding | Too slow for first use. Multiple tickets needed before anything works. |
| Fork + detach | Leaves Git history artifacts from the template repo. |

### 5.6 Schema Changes: Two Nullable Fields

**Chosen approach:** Add two nullable fields to existing models.

| Field | Model | Purpose |
|-------|-------|---------|
| `operationsRepoId` (String?) | `Organization` | Points to the OrganizationRepository that is the customer's operational app |
| `productionUrl` (String?) | `OrganizationRepository` | Stores the deployed app URL for Operations navigation |

**Rationale:** No new models needed. `OAuthClient` already has `organizationId`. `OrganizationRepository` already has all Vercel/Neon fields. These two fields fill the only gaps: identifying which repo is the operations app and where it's deployed.

**Migration:** Prisma migration with `--name add-smb-operations-fields`. All fields nullable -- existing records unaffected (null = not auto-provisioned). No data migration needed.

**Rejected alternative:** New `OperationsConfig` model -- over-engineering. The operations app is just one repo with a URL -- not complex enough for a separate model.

---

## 6. Implementation Roadmap

### 6.1 Phased Approach

```
Phase 1: Schema & Fresh Database
  - Add 2 fields (operationsRepoId, productionUrl) to Prisma schema
  - Generate migration
  - Implement empty-project Neon provisioning path (skip dump/restore)

Phase 2: Repository & Deployment Creation
  - Implement createGitHubRepoFromTemplate() in github-repo-service.ts
  - Implement createVercelProject() in production-platform.ts

Phase 3: Provisioning Orchestration
  - Extend provisionOrganization() to compose all services
  - Implement registerOAuthClientForOrg() in oauth-service.ts
  - Update POST /api/setup/organization response

Phase 4: Client Operations Nav & Route
  - Add Operations NavItem to app-shell.tsx (between Pipeline and Library)
  - Create /operations route component (lazy-loaded)
  - Create GET /api/organizations/:id/operations endpoint
  - Register route in App.tsx

Phase 5: Client Wizard Enhancement
  - Extend general-org-wizard-dialog.tsx with provisioning progress display
  - Add real-time status indicators (Database/Repo/Deployment: done/provisioning/failed)

Phase 6: Template Repository (One-Time Setup)
  - Create smb-app-template repo in GitHub org
  - Scaffold with Next.js 15 + Drizzle + Helix OAuth PKCE client
  - Mark as template repository in GitHub settings

Phase 7: Integration Testing
  - End-to-end: wizard -> provisioning -> deployment -> operations access
  - OAuth flow verification
  - Backward compatibility for existing GENERAL orgs
```

### 6.2 Server-Side Changes (helix-global-server)

#### New Functions

| Function | File | Purpose |
|----------|------|---------|
| `createGitHubRepoFromTemplate()` | `github-repo-service.ts` | GitHub Template API: `POST /repos/{template}/generate` |
| `createVercelProject()` | `production-platform.ts` | Vercel API: `POST /v11/projects` with `gitRepository` linking |
| `registerOAuthClientForOrg()` | `oauth-service.ts` | Auto-register OAuth public client during provisioning |
| Empty-project Neon path | `neon/provisioning.ts` | `createProject()` without dump/restore pipeline |
| `GET /api/organizations/:id/operations` | New controller | Returns `{ url, status, oauthClientId }` for client nav |

#### Modified Files

| File | Change | Shared/Review Hotspot |
|------|--------|-----------------------|
| `prisma/schema.prisma` | Add `operationsRepoId` to Organization, `productionUrl` to OrganizationRepository | Schema change -- affects all consumers |
| `setup-service.ts` | Extend `provisionOrganization()` with template repo, Neon, Vercel, OAuth steps | Core provisioning flow -- high scrutiny |
| `github-repo-service.ts` | Add template-based creation alongside existing `auto_init` path | Shared utility |
| `production-platform.ts` | Add `createVercelProject()` to VercelPlatform class | Deployment infrastructure |
| `neon/provisioning.ts` | Add empty-project path (skip sandbox/dump/restore) | Database provisioning |
| `oauth-service.ts` | Add `registerOAuthClientForOrg()` for auto-registration | Auth infrastructure |
| `routes/api.ts` | Register new operations endpoint | Route registry |

### 6.3 Client-Side Changes (helix-global-client)

#### New Files

| File | Purpose |
|------|---------|
| `src/routes/operations.tsx` | Operations page with provisioning status and launch button |

#### Modified Files

| File | Change | Shared/Review Hotspot |
|------|--------|-----------------------|
| `app-shell.tsx` | Add Operations NavItem (conditional: GENERAL + has operations repo) | Navigation -- visible to all users |
| `App.tsx` | Register `/operations` route with `React.lazy()` | Routing -- bundle split point |
| `general-org-wizard-dialog.tsx` | Add provisioning progress step after org creation | Wizard flow -- user-facing |
| `types/api.ts` | Add operations-related type definitions | Shared types |

### 6.4 Performance Expectations

| Operation | Expected Duration | Mechanism |
|-----------|------------------|-----------|
| Org + users creation | < 1s | Synchronous DB writes (existing) |
| GitHub repo from template | 2-5s | GitHub API call |
| Neon project creation (empty) | 5-10s | Neon API (no dump/restore) |
| Vercel project creation + linking | 3-8s | Vercel API call |
| OAuth client registration | < 1s | DB write |
| **Total provisioning (admin-visible)** | **~10-15s** | GitHub -> then Neon + Vercel in parallel |
| First Vercel deploy (from template push) | 60-120s | Vercel build pipeline (background) |
| First deploy ready | ~2-3 min | Background Vercel deploy after provisioning |

The admin sees provisioning complete within 15 seconds. The customer app becomes accessible after the first Vercel deployment completes (~2-3 minutes). The wizard shows real-time progress for each step.

### 6.5 Environment Variable Dependencies

| Variable | Status | Purpose |
|----------|--------|---------|
| `GITHUB_TOKEN` | Exists in `env.ts` | Repo creation (org-level) |
| `GITHUB_ORG` | Exists in `env.ts` | Target GitHub org for new repos |
| `VERCEL_PRODUCTION_TOKEN` | Exists in `env.ts` | Vercel project management |
| `NEON_API_KEY` | Exists in `neon/config.ts` | Neon project creation |
| `AUTH_JWT_SECRET` | Exists in `env.ts` | OAuth token signing |
| `SMB_TEMPLATE_REPO` | **New -- required** | Name of the GitHub template repo |

All existing variables are already configured in the production environment. Only `SMB_TEMPLATE_REPO` needs to be added.

### 6.6 NPM Dependencies

No new npm dependencies required for either repository. All needed functionality (HTTP calls via `fetch`, crypto for client IDs, Prisma for data access, JWT via existing `jsonwebtoken` / `jose`) is already available.

---

## 7. Risks & Open Questions

### 7.1 Risk Matrix

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Template repo not ready at implementation time | Medium | Blocks provisioning testing | Create minimal scaffold during Phase 2; falls back to `auto_init` if template not found |
| R2 | Vercel token lacks project creation permission | Low | Blocks deployment auto-config | Existing token manages deployments, likely sufficient; verify early |
| R3 | Neon project limits on current plan | Low | Provisioning fails for new tenants | Verify plan limits; each SMB tenant = 1 additional project |
| R4 | OAuthClient table permissions | Unknown | Cannot verify existing clients | Permission denied in production queries; verify admin access or test in staging |
| R5 | Popup blocker prevents `window.open` | Medium | User can't open tenant app | Trigger `window.open` synchronously from user click gesture; fall back to same-tab navigation |
| R6 | Backward compatibility for 5 existing GENERAL orgs | Low | Disruption | All new fields nullable; Operations nav hidden when `operationsRepoId` is null |
| R7 | Provisioning partial failure | Medium | Orphaned resources | Each step checks existing resources before creating (idempotent retry); cleanup on failure |

### 7.2 Open Questions from Product Specification

| # | Question | Resolution in This Report |
|---|----------|--------------------------|
| 1 | How should the operational app be surfaced? | External link in new tab with OAuth PKCE redirect (Section 5.3). Ticket endorses "click a link and get taken there." |
| 2 | Which deployment platform should be default? | Vercel (Section 5.2). Breadery precedent; API supports project creation + GitHub linking in one call. |
| 3 | What does the starter template look like? | Next.js 15 + Drizzle + Helix OAuth PKCE client (Section 5.5). Mirrors Breadery stack with OAuth replacing standalone JWT. |
| 4 | OAuth client registration verification? | `OAuthClient` table could not be queried (permission denied). Flow has not been exercised end-to-end for SMB. Recommend staging verification. |
| 5 | Auto-deploy trigger mechanism? | Vercel's built-in GitHub integration (Section 5.2). Creating a Vercel project with `gitRepository` linking auto-enables deploy-on-push. No webhooks or GitHub Actions needed. |
| 6 | Env var propagation for customer apps? | Auto-injected during Vercel project creation via `environmentVariables` array in the API call (Section 5.2). `DATABASE_URL` and OAuth-related vars are injected automatically. Customer-specific vars (e.g., Breadery's `VEPAAR_*`) require manual Vercel dashboard config for MVP. |
| 7 | Database seeding / schema initialization? | Empty Neon project + Drizzle migrations in the template app handle schema (Section 5.5). No seed data needed -- `vercel-build` script runs migrations on first deploy. |

---

## 8. Deferred Items / Future Considerations

These items are explicitly out of scope for the MVP implementation and documented for future work:

| # | Item | Rationale for Deferral |
|---|------|----------------------|
| 1 | Retrofitting The Breadery | Existing setup remains as-is. Product spec explicitly excludes migration of existing customers. |
| 2 | Customer self-signup | Onboarding is admin-initiated for MVP. Self-service registration is a future consideration. |
| 3 | Custom domain configuration | SMB apps use Vercel-provided URLs. Custom domains add DNS/SSL complexity. |
| 4 | Multi-repo per customer | Each SMB customer gets one operational repo. Multi-repo setups are future work. |
| 5 | Advanced deployment strategies | Basic deploy-on-merge only. Blue-green, canary, and rollback are deferred. |
| 6 | Usage-based billing integration | No metering or billing tied to provisioning for MVP. |
| 7 | Operations embedded view | MVP uses external link. Future iteration could add same-origin proxy or micro-frontend. |
| 8 | Template marketplace | Single template for MVP. Industry-specific templates deferred. |
| 9 | Non-Vercel deployment targets | DigitalOcean exists in the pipeline but auto-project-creation is Vercel-only for MVP. |
| 10 | CLI provisioning commands | helix-cli is a read-only tool with no provisioning capabilities. Not impacted. |
| 11 | Breadery migration to SSO | Optionally migrate The Breadery to automated SSO/deployment model in a future ticket. |

---

## 9. Appendix: Artifact Inputs Used

| Artifact | Source Repo | Why Used | Key Takeaway |
|----------|-------------|----------|--------------|
| ticket.md | library | Primary ticket specification | Research ticket for automated SMB provisioning to match manual Breaderie setup; no iframes; single login |
| scout/scout-summary.md | library | Cross-repo gap analysis | 5 automation gaps identified; all building blocks exist independently |
| scout/reference-map.json | library | Cross-repo file mapping | 22 files mapped across 4 repos; all provisioning services in helix-global-server |
| diagnosis/diagnosis-statement.md | library | Root cause and evidence synthesis | Fragmented provisioning orchestration; 5 success criteria defined |
| diagnosis/apl.json | library | Structured diagnosis findings | 5 questions answered with evidence; all building blocks confirmed independent |
| product/product.md | library | Product requirements and success criteria | 5 essential features, 7 out-of-scope items, 7 open questions, 5 success criteria |
| tech-research/tech-research.md | helix-global-server | Architecture decisions and API designs | 6 technical decisions with rationale; concrete API/method designs; performance expectations |
| tech-research/apl.json | helix-global-server | Structured technical findings | 7 questions answered with evidence; provisioning flow design confirmed |
| scout/scout-summary.md | helix-global-server | Server-side gap analysis | provisionOrganization() doesn't orchestrate full chain; 4 automation gaps |
| scout/scout-summary.md | helix-global-client | Client UI mapping | No /operations route or nav item; wizard doesn't trigger full provisioning |
| scout/scout-summary.md | breadery-client | Reference app analysis | Standalone Next.js app with zero Helix integration -- the manual baseline |
| repo-guidance.json | library | Repo intent mapping | helix-global-server + helix-global-client are targets; library, breadery-client, helix-cli are context |
| Production DB: Organization table | helix-global-server (runtime) | Verify org landscape | 13 orgs (5 GENERAL + 8 NETSUITE); The Breadery created 2026-04-16 |
| Production DB: OrganizationRepository table | helix-global-server (runtime) | Verify provisioning state | 27 GENERAL repos; 3 Neon READY; platform distribution: NONE=23, VERCEL=3, DO=1 |
| Production DB: OrganizationRepository schema | helix-global-server (runtime) | Column verification | 29 columns; confirmed field names for neonProvisioningStatus, productionPlatform, productionUrl (absent) |
| Production logs | helix-global-server (runtime) | Verify Neon activity | Active Neon branching (tier-1 cache hits, branch create/delete) confirmed |

## Attachments
- (none)

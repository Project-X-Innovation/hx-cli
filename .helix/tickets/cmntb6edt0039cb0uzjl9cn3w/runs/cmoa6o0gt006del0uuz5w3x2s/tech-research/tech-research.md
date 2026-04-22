# Tech Research — HLX-207: Improve helix-cli packaging, documentation, and artifact retrieval

## Technology Foundation

- **Language**: TypeScript 6 (strict mode, ES2022 target, Node16 module resolution)
- **Runtime**: Node.js >= 18 (required for native `fetch` and `AbortSignal.timeout`)
- **Module system**: ESM (`"type": "module"` in package.json)
- **Build**: `tsc` compiles `src/` to `dist/`; no bundler needed
- **Runtime dependencies**: Zero (uses only Node builtins and native fetch)
- **Dev dependencies**: `@types/node` ^25.5.0, `typescript` ^6.0.2
- **Package**: `@projectxinnovation/helix-cli`, scoped, bin entry `hlx` -> `dist/index.js`

No changes to the technology foundation are required. All additions use existing tooling.

---

## Architecture Decision

### Decision 1: Version Drift Fix — Runtime Read via createRequire

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. `createRequire` (chosen) | Read `package.json` at runtime using `createRequire(import.meta.url)` | Zero build changes, works in ESM, package.json always in npm packages | Slightly more code at import site |
| B. Build-time code generation | Generate `src/generated/version.ts` in a prebuild script | Version baked in at compile time | Adds build complexity, new script, new generated file to gitignore |
| C. Import assertion | `import pkg from '../package.json' with { type: 'json' }` | Clean ESM syntax | Requires `resolveJsonModule` tsconfig change; import assertions still evolving across Node versions |

**Chosen: Option A** — `createRequire(import.meta.url)` to load `../package.json` from `dist/index.js`.

**Rationale**: Simplest approach with no build pipeline changes. `createRequire` is a stable Node API (since v12). `package.json` is always included in npm packages regardless of the `files` field, so the relative path `../package.json` resolves correctly from `dist/index.js` in both local development and npm-installed contexts. No tsconfig changes needed.

**Implementation sketch** (in `src/index.ts`):
```
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
// Then use `version` in the --version handler
```

### Decision 2: Artifact Commands — Thin Client via hxFetch to Helix Backend

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Thin client via backend (chosen) | CLI calls Helix backend via `hxFetch`; backend proxies to GitHub/Vercel APIs | Consistent architecture, no new tokens for users, credentials managed server-side, zero new deps | Requires backend endpoints to exist (may not yet) |
| B. Direct API calls from CLI | CLI calls GitHub/Vercel APIs directly using native `fetch` | No backend dependency, works independently | Requires users to configure GitHub/Vercel tokens separately, breaks thin-client pattern, credential management in CLI |
| C. Hybrid | CLI tries backend first, falls back to direct API calls | Works even if backend endpoints don't exist yet | Complex, two code paths, inconsistent auth model |

**Chosen: Option A** — Thin client through the Helix backend, consistent with all existing commands.

**Rationale**: Every existing authenticated command (`inspect/*`, `comments/*`) follows the `requireConfig() -> hxFetch() -> display` pattern. The CLI never calls external APIs directly. Artifact commands should maintain this architectural invariant. This keeps credentials centralized in the Helix backend, preserves the zero-runtime-dependency property, and avoids requiring users to set up separate GitHub/Vercel tokens.

**Risk**: If the Helix backend does not yet have artifact endpoints, the CLI commands will be non-functional until those endpoints are created. This is documented as an explicit risk and the CLI should be built against a clear API contract.

### Decision 3: Publish Workflow — Version-Gated via npm Registry Comparison

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. npm registry comparison (chosen) | Compare `package.json` version against `npm view` output; publish if different | Handles edge cases (force-push, cherry-pick, manual publish), no third-party action dependency | Requires the package to be on npm (handle first-publish case) |
| B. Git diff on package.json | Compare version field against previous commit | Simple | Misses cherry-picks, rebases; compares against wrong baseline after merges |
| C. Third-party action (js-DevTools/npm-publish) | Marketplace action that handles version detection + publish | Convenient, well-tested | External dependency on third-party action, less transparent |

**Chosen: Option A** — Compare against npm registry, publish only when versions differ.

**Rationale**: Comparing against the actual npm registry is the most reliable source of truth. It handles first-time publish (npm view returns error), manual out-of-band publishes, and git history rewriting. The implementation is ~5 lines of shell script, transparent and maintainable without third-party action dependencies. Aligned with product spec ("publishes only when package.json version changes") and diagnosis recommendation.

---

## Core API/Methods

### Artifact Backend API Contract

The CLI will expect these endpoints on the Helix backend (basePath: `/api`):

**GET `/api/artifacts/tickets/{ticketId}`**
- Query params: `source=github|vercel` (optional)
- Response: `{ artifacts: ArtifactInfo[] }`

**GET `/api/artifacts/runs/{runId}`**
- Query params: `source=github|vercel` (optional)
- Response: `{ artifacts: ArtifactInfo[] }`

**ArtifactInfo type:**
```typescript
type ArtifactInfo = {
  id: string;
  name: string;
  source: "github" | "vercel";
  createdAt: string;
  sizeBytes?: number;
  url?: string;
  metadata?: Record<string, unknown>;
};
```

### CLI Command Interface

```
hlx artifacts ticket <ticket-id> [--source github|vercel]
hlx artifacts run <run-id> [--source github|vercel]
```

### Existing Patterns Used

- **Auth**: `requireConfig()` from `src/lib/config.ts` — returns `{ apiKey, url }`
- **HTTP**: `hxFetch(config, path, { basePath, queryParams })` from `src/lib/http.ts` — handles auth headers, retry/backoff
- **Arg parsing**: `getFlag(args, flagName)` / `getPositionalArgs(args, excludeFlags)` — hand-rolled, no external lib
- **Error handling**: Top-level try/catch in `src/index.ts` catches errors and exits with code 1

---

## Technical Decisions

### Shared Arg-Parsing Helpers

**Decision**: Extract `getFlag` and `getPositionalArgs` into `src/lib/args.ts`.

**Why**: These helpers are currently duplicated across three files:
- `src/inspect/index.ts` (lines 5-19)
- `src/comments/index.ts` (lines 5-8)
- `src/comments/list.ts` (lines 13-17)

The new `src/artifacts/index.ts` module will need the same helpers. Extracting them into a shared module avoids a fourth copy and provides a single place to maintain arg-parsing logic. Existing imports in `inspect/` and `comments/` should be updated to use the shared module.

**Rejected alternative**: Leave duplicated. Rejected because adding a fourth copy for artifacts crosses the threshold where consolidation is clearly worthwhile.

### Artifact Command Module Structure

```
src/artifacts/
  index.ts    — command router (mirrors inspect/index.ts and comments/index.ts)
  ticket.ts   — fetch artifacts by ticket ID
  run.ts      — fetch artifacts by run ID
```

This mirrors the existing module structure precisely:
- `inspect/index.ts` -> `inspect/repos.ts`, `inspect/db.ts`, etc.
- `comments/index.ts` -> `comments/list.ts`, `comments/post.ts`

### Display Format for Artifacts

Artifact list output should follow the same plain-text format used by `comments/list.ts`:

```
[2024-01-15T10:30:00Z] [github] build-artifacts  (1.2 MB)
[2024-01-15T10:30:00Z] [vercel] deployment-output  (3.4 MB)
```

Empty results should print "No artifacts found." (consistent with comments: "No comments found.").

`--json` output is explicitly out of scope for MVP per product spec.

### GitHub Actions Workflow Structure

File: `.github/workflows/publish.yml`

```yaml
# Trigger: push to main
# Steps:
# 1. Checkout code
# 2. Setup Node 18+
# 3. Install dependencies (npm ci)
# 4. Build (npm run build)
# 5. Typecheck (npm run typecheck)
# 6. Version check: compare package.json version vs npm registry
# 7. If version changed: npm publish
```

Key details:
- Uses `NPM_TOKEN` GitHub secret for npm authentication
- `npm ci` for deterministic installs (package-lock.json exists)
- Build before typecheck (typecheck uses `tsc --noEmit` which validates the same code)
- Version check uses `npm view @projectxinnovation/helix-cli version 2>/dev/null || echo "0.0.0"` to get current published version
- First-time publish handled gracefully (npm view returns empty/error for unpublished packages)
- No test step (no tests exist; typecheck is the only validation gate)

### README Documentation Structure

File: `README.md` at repo root

Sections:
1. Title and description (what the CLI does)
2. Installation (`npm install -g @projectxinnovation/helix-cli`)
3. Requirements (Node >= 18)
4. Authentication (`hlx login` flow + env vars + config file)
5. Configuration (env vars: `HELIX_API_KEY`, `HELIX_URL`; config file: `~/.hlx/config.json`)
6. Command reference:
   - `hlx login`
   - `hlx inspect` (repos, db, logs, api)
   - `hlx comments` (list, post)
   - `hlx artifacts` (ticket, run)
   - `hlx --version`
7. Artifact retrieval examples
8. Release/publish notes for maintainers
9. License

---

## Cross-Platform Considerations

The CLI already handles cross-platform browser launching in `src/login.ts` (win32/darwin/linux). No additional cross-platform concerns apply to the new work:
- `createRequire` works identically across platforms
- `hxFetch` uses native `fetch` which is platform-independent
- GitHub Actions workflow runs on ubuntu-latest (standard)
- The CLI bin entry (`#!/usr/bin/env node`) works on all Node-supported platforms

---

## Performance Expectations

- **Artifact commands**: Performance is bounded by the Helix backend response time (same as existing inspect/comments commands). The CLI adds negligible overhead — it's a single HTTP request with retry.
- **Version read**: `createRequire` + JSON parse of `package.json` adds <1ms at startup. Negligible.
- **Build time**: Adding 3-4 new TypeScript source files to the tsc compilation adds negligible time.
- **Publish workflow**: Expected to complete in 1-2 minutes (install + build + typecheck + publish). No lengthy test suite.

---

## Dependencies

### Runtime Dependencies (no changes)

None. The CLI continues to use only Node builtins and native `fetch`.

### Dev Dependencies (no changes)

- `@types/node` ^25.5.0
- `typescript` ^6.0.2

### CI/Infrastructure Dependencies

| Dependency | Purpose | Notes |
|------------|---------|-------|
| GitHub Actions `actions/checkout@v4` | Checkout repo in CI | Standard, maintained by GitHub |
| GitHub Actions `actions/setup-node@v4` | Setup Node.js in CI | Standard, maintained by GitHub |
| `NPM_TOKEN` GitHub secret | Authenticate npm publish | Must be configured in repo settings |
| npm registry access | Publish and version check | Requires appropriate publish permissions for `@projectxinnovation` scope |

### External Service Dependencies

| Service | Used By | Notes |
|---------|---------|-------|
| Helix backend API | Artifact commands | Must have `/api/artifacts/tickets/{id}` and `/api/artifacts/runs/{id}` endpoints. **Unknown whether these exist today.** |
| npm registry | Publish workflow + version check | Standard npm infrastructure |

---

## Deferred to Round 2

| Item | Reason |
|------|--------|
| `hlx artifacts download` command | Explicitly out of MVP scope per product spec |
| `--json` output mode | Out of MVP scope; future enhancement |
| PR number lookup for artifacts | Out of MVP scope |
| `hlx artifacts list` (browse all) | Out of MVP scope |
| Test framework and unit tests | Separate effort per product spec |
| npm Trusted Publishing (OIDC) | More secure than token-based auth but requires npm org configuration; can be adopted later |
| `prepublishOnly` script | Would protect against broken manual publishes; minor improvement for later |

---

## Summary Table

| Area | Decision | Rationale |
|------|----------|-----------|
| Version drift fix | `createRequire` to read `package.json` at runtime | Simplest, no build changes, stable Node API |
| Artifact architecture | Thin client via `hxFetch` to Helix backend | Consistent with all existing commands, no new tokens needed |
| Artifact API contract | `GET /api/artifacts/tickets/{id}` and `GET /api/artifacts/runs/{id}` | RESTful, matches existing `/api` basePath pattern |
| Publish trigger | Version-gated via npm registry comparison | Most reliable source of truth, handles edge cases |
| Publish auth | `NPM_TOKEN` GitHub secret | Standard approach; OIDC deferred |
| New runtime deps | None | Preserves zero-dep invariant per product spec |
| Arg parsing | Extract shared `src/lib/args.ts` | Avoids fourth copy of duplicated helpers |
| Module structure | `src/artifacts/{index,ticket,run}.ts` | Mirrors existing `inspect/` and `comments/` patterns |
| Files to create | `README.md`, `.github/workflows/publish.yml`, `src/artifacts/index.ts`, `src/artifacts/ticket.ts`, `src/artifacts/run.ts`, `src/lib/args.ts` | Six new files |
| Files to modify | `src/index.ts`, `src/inspect/index.ts`, `src/comments/index.ts`, `src/comments/list.ts` | Update version handler + import shared args |

---

## Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Helix backend artifact endpoints may not exist** | High | Define clear API contract in the CLI code. If endpoints don't exist, the commands will return clear HTTP errors. Backend work is tracked separately. |
| 2 | **NPM_TOKEN secret not configured** | Medium | Document the secret requirement clearly in README and workflow comments. Workflow fails gracefully without token. |
| 3 | **First npm publish may require manual setup** | Medium | If the package was never published or scope access needs configuration, the first publish may fail. Document manual fallback. |
| 4 | **No test suite** | Low | Typecheck is the only validation gate. Risk of runtime bugs is mitigated by the simplicity of the commands (each is a single hxFetch call + display). |
| 5 | **No runtime inspection available** | Low | Could not verify production API behavior or existing backend endpoints. API contract is defined from ticket requirements and existing patterns. |

---

## APL Statement Reference

The technical direction for HLX-207 is to make three additions (README, GitHub Actions publish workflow, artifact retrieval commands) plus one defect fix (version drift), all within the helix-cli repo with zero new runtime dependencies. The version drift is fixed by reading package.json at runtime via `createRequire`. Artifact commands follow the existing thin-client `hxFetch` pattern with a defined backend API contract. The publish workflow uses a version comparison against the npm registry to publish only on version changes. Shared arg-parsing helpers are consolidated into `src/lib/args.ts`.

---

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand full scope, acceptance criteria, and open decisions | Three workstreams (README, CI publish, artifact retrieval) plus version drift fix; UX examples for artifact commands |
| scout/scout-summary.md | Understand current repo architecture and gaps | 13 source files, 3 command groups, zero deps/tests/CI, hxFetch thin-client pattern, version drift confirmed |
| scout/reference-map.json | Structured file inventory, confirmed facts, unknowns | Complete file list with roles, version drift (1.2.0 vs 0.1.0), architecture invariants |
| diagnosis/apl.json | Diagnosis investigation questions, evidence, and conclusions | All three gaps confirmed with file-level evidence; backend-proxy pattern recommended; version-gated publish recommended |
| diagnosis/diagnosis-statement.md | Root cause analysis and architectural recommendations | Version should be derived from package.json; artifact commands use hxFetch; publish on version change |
| product/product.md | Product requirements, success criteria, scope boundaries | Zero new runtime deps, thin-client pattern, version-gated publish, explicit out-of-scope items (download, --json, tests) |
| repo-guidance.json | Repo intent classification | helix-cli is sole target repo, no cross-repo changes |
| src/index.ts (direct read) | Verify command router structure and version drift | Line 47 hardcodes "0.1.0"; switch statement is the extension point for new commands |
| src/lib/http.ts (direct read) | Understand hxFetch API surface for artifact command design | Supports basePath, queryParams, method, body; handles retry/backoff and auth |
| src/lib/config.ts (direct read) | Understand auth model for README and artifact commands | requireConfig() returns HxConfig; env vars or ~/.hlx/config.json |
| src/comments/index.ts (direct read) | Reference command router pattern for artifacts module | getFlag/switch pattern, resolveTicketId from --ticket or env var |
| src/comments/list.ts (direct read) | Reference subcommand pattern for artifact display | hxFetch with basePath '/api', type casting, empty-result handling |
| src/inspect/index.ts (direct read) | Reference command router with getPositionalArgs | getFlag + getPositionalArgs helpers, switch-based routing |
| src/inspect/db.ts (direct read) | Reference simplest subcommand pattern | resolveRepo + hxFetch + JSON.stringify output |
| package.json (direct read) | Verify npm config, scripts, engine constraint | Scoped package, files: [dist], ESM, Node>=18, build: tsc |
| tsconfig.json (direct read) | Verify TypeScript config for compatibility with createRequire approach | ES2022 target, Node16 module, strict, no resolveJsonModule |
| Web search: GitHub Actions npm publish | Verify current best practices for publish workflows | npm registry comparison is standard; OIDC/Trusted Publishing is newer secure option |

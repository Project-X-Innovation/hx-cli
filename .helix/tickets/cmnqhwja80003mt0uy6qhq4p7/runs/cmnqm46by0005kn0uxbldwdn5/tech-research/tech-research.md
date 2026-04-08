# Tech Research: Remove Hardcoded `isHelixTagged` — helix-cli

## Technology Foundation

- **Runtime**: Node.js + TypeScript (ES2022, Node16 modules)
- **Build**: `tsc` (via `npm run typecheck`)
- **HTTP client**: Custom `hxFetch` wrapper in `src/lib/http.ts`

No new dependencies required.

## Architecture Decision

### Problem

The CLI's `hlx comments post` command unconditionally sends `isHelixTagged: true` in the POST body (post.ts:32), regardless of who is posting. This means any external user commenting via the CLI wrongly has their comment marked as Helix-tagged.

### Options Considered

| # | Option | Pros | Cons |
|---|--------|------|------|
| 1 | **Remove `isHelixTagged` from body; send only `{ content: message }`** | Server decides attribution; simplest change; correct for both agent and user paths | External CLI users can't Helix-tag from CLI (MVP limitation) |
| 2 | **Add `--helix` flag to CLI post command** | External users could opt-in to Helix-tagging | Extra complexity; server should be source of truth; not needed for MVP |
| 3 | **Detect agent vs user from stored config and set accordingly** | CLI could self-identify | Config only stores `{ apiKey, url }`; no identity info; spoofing risk |

### Chosen: Option 1 — Remove `isHelixTagged`, send only content

**Rationale**: The server is the source of truth for attribution. After the server-side fix:
- For Helix sandbox agents (JWT with `isHelixAgent: true`): the server forces `isHelixTagged=true` and `isAgentAuthored=true` regardless of what the client sends.
- For external CLI users (API key auth): the server defaults `isHelixTagged` to `false` (comment-controller.ts:65-66), which is correct — external users should not auto-tag as Helix.

## Core API/Methods

### `cmdPost` (post.ts:8-38)

**Current** (line 31-32):
```typescript
body: { content: message, isHelixTagged: true },
```

**Change**:
```typescript
body: { content: message },
```

This is the only change in the CLI repo.

## Technical Decisions

### CLI does not need to know who it is

The CLI config stores `{ apiKey: string; url: string }` (config.ts:5-8). The server resolves identity from the API key (mapping to `createdByUserId` via middleware.ts:154-167) or from the inspection JWT (extracting `isHelixAgent` claim). The CLI does not need local identity storage or display.

**Rejected alternative**: Storing user identity in CLI config after login. Rejected because: (a) it's unnecessary — the server handles all attribution; (b) it would be a stale copy that could become inconsistent.

### No `--helix` flag for MVP

External CLI users who want to @mention Helix can use the web UI. The server doesn't parse @mentions from plain text. A `--helix` flag is a future consideration.

**Rejected alternative**: Adding the flag now for completeness. Rejected per product scope — MVP focuses on correct attribution, not new CLI features.

## Cross-Platform Considerations

This change can deploy before or after the server change:
- **If CLI deploys first**: The CLI no longer sends `isHelixTagged: true`. The server's existing logic defaults it to `false` for non-agent comments (correct) and forces `true` for agent comments via the `isAgentAuthored ? true : isHelixTagged` override (correct).
- **If server deploys first**: The CLI still sends `isHelixTagged: true`, but the server overrides it for agent comments and respects it for user comments. External CLI user comments will still be Helix-tagged until the CLI updates, but this is a temporary state.

## Performance Expectations

No performance impact. The POST body is marginally smaller (one fewer field).

## Dependencies

No new dependencies. The `hxFetch` wrapper and config system are unchanged.

## Risks

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | External CLI users lose ability to Helix-tag comments | Not available before this change either (it was forced to true for everyone). For MVP, @Helix tagging from CLI is out of scope. Can add `--helix` flag later. |

## Deferred to Round 2

- `--helix` flag on `hlx comments post` for external CLI users
- `--mention` flag to specify mentioned user IDs
- CLI display of commenter identity in `hlx comments list` output

## Summary Table

| Aspect | Decision |
|--------|----------|
| **Change scope** | 1 file: post.ts |
| **Lines changed** | 1 line (remove `isHelixTagged: true` from body object) |
| **New dependencies** | None |
| **Deployment dependency** | None — safe in any order |

## APL Statement Reference

See tech-research/apl.json. All questions resolved; no followups.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand requirements | CLI should not override server decisions; Helix identity must be verified |
| Continuation context | Clarify refined requirements | External CLI users must appear as themselves; only Helix agents post as Helix |
| diagnosis/diagnosis-statement.md (CLI) | CLI-specific diagnosis | Remove hardcoded isHelixTagged; let server determine |
| diagnosis/apl.json (CLI) | Investigation findings | CLI should send only { content: message }; server defaults isHelixTagged to false |
| product/product.md (CLI) | Product specification | CLI stops overriding Helix tagging; server decides based on auth identity |
| post.ts (direct read) | Verify CLI behavior | Confirmed hardcoded `isHelixTagged: true` at line 32 |
| comment-controller.ts (direct read) | Verify server handling | Server defaults isHelixTagged to false (line 65-66); forces true for agents (line 77) |

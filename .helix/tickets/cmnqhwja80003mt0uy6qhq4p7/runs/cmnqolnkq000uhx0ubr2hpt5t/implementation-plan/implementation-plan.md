# Implementation Plan: helix-cli

## Overview

Remove the hardcoded `isHelixTagged: true` from the CLI's `hlx comments post` command. The server determines `isHelixTagged` and `isAgentAuthored` based on auth identity — the CLI should send only the comment content and let the server decide attribution.

One file changes: `src/comments/post.ts` (line 33). Change `{ content: message, isHelixTagged: true }` to `{ content: message }`.

## Implementation Principles

- **Server as source of truth**: The CLI does not determine its own identity. The server resolves identity from the auth credentials.
- **Minimal change**: One line in one file. Remove `isHelixTagged: true` from the POST body.
- **No new functionality**: No CLI flags, no local identity storage, no new commands.

## Implementation Steps Summary

| Step | Goal | Deliverable |
|------|------|-------------|
| 1 | Remove hardcoded `isHelixTagged: true` from post command | Updated `src/comments/post.ts` |
| 2 | Verify quality gates | `npm run typecheck` passes |

## Detailed Implementation Steps

### Step 1: Remove hardcoded `isHelixTagged: true` from `post.ts`

**Goal**: Stop the CLI from overriding the server's Helix-tagging decision.

**What to Build**:
- In `src/comments/post.ts`, line 33, change:
  ```typescript
  body: { content: message, isHelixTagged: true },
  ```
  to:
  ```typescript
  body: { content: message },
  ```
- No other changes needed. The server handles attribution:
  - For Helix sandbox agents (inspection JWT with `isHelixAgent: true`): server forces `isAgentAuthored=true` and `isHelixTagged=true`.
  - For external CLI users (API key auth): server defaults `isHelixTagged=false` and `isAgentAuthored=false`.

**Files**: `src/comments/post.ts`

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmnqm46by0005kn0uxbldwdn5/helix-cli && npm run typecheck 2>&1 | tail -5
```

**Success Criteria**: `isHelixTagged: true` is removed from the POST body. The CLI sends only `{ content: message }`. TypeScript compiles.

---

### Step 2: Verify quality gates

**Goal**: Confirm the CLI builds and passes typecheck.

**Verification (AI Agent Runs)**:
```bash
cd /vercel/sandbox/workspaces/cmnqm46by0005kn0uxbldwdn5/helix-cli && npm run typecheck 2>&1 | tail -5
cd /vercel/sandbox/workspaces/cmnqm46by0005kn0uxbldwdn5/helix-cli && npm run build 2>&1 | tail -5
```

**Success Criteria**: `npm run typecheck` exits 0. `npm run build` exits 0.

---

## Cross-Repo Coordination Notes

- **helix-global-server**: The server-side fix adds `isHelixAgent` JWT claim and uses it for `isAgentAuthored`. The CLI change is compatible with both old and new server behavior:
  - **Old server (before fix)**: CLI stops sending `isHelixTagged: true`. Server defaults to `false` (comment-controller.ts:65-66). But server also forces `true` for `isAgentAuthored` comments (line 77). Since old server treats all inspection auth as agent-authored, sandbox agent comments still get `isHelixTagged=true`. External CLI users' comments lose the incorrect Helix tag. This is a partial improvement even before the server fix.
  - **New server (after fix)**: Server correctly sets both `isAgentAuthored` and `isHelixTagged` based on the JWT claim. CLI sending `{ content }` only is the correct behavior.
- **Deployment independence**: Safe to deploy before, after, or simultaneously with the server change. No functional breakage in any order.

## Verification Plan

### Pre-conditions

| Dependency | Status | Source/Evidence | Affects checks |
|-----------|--------|----------------|----------------|
| Node.js >= 18 installed | available | package.json engines field | CHK-01, CHK-02, CHK-03 |
| npm dependencies installed (`npm install`) | available | dev setup config | CHK-01, CHK-02, CHK-03 |
| Server running on port 4000 with `.env` | available | dev setup config for helix-global-server | CHK-03 |
| A valid ticket ID in the database | unknown | depends on database state | CHK-03 |
| CLI configured with API key (via `hlx login` or env var) | unknown | requires manual setup or env var | CHK-03 |

### Required Checks

[CHK-01] TypeScript typecheck passes.
- Action: Run `cd /vercel/sandbox/workspaces/cmnqm46by0005kn0uxbldwdn5/helix-cli && npm run typecheck`.
- Expected Outcome: Exit code 0, no type errors.
- Required Evidence: Terminal output showing successful typecheck with no errors.

[CHK-02] Build succeeds.
- Action: Run `cd /vercel/sandbox/workspaces/cmnqm46by0005kn0uxbldwdn5/helix-cli && npm run build`.
- Expected Outcome: Exit code 0, `dist/` directory updated.
- Required Evidence: Terminal output showing successful build with no errors.

[CHK-03] CLI posts comment without `isHelixTagged` field.
- Action: Start the helix-global-server with `npm run dev` on port 4000 with `.env`. Set the `HELIX_API_KEY` env var to a valid `hxi_` API key. Run `node dist/index.js comments post --ticket <valid-ticket-id> "Test comment from CLI"` from the helix-cli directory. Verify the server response and the created comment.
- Expected Outcome: The comment is created successfully (output: `Comment posted (id: ...)`). The comment's `isHelixTagged` is `false` (because the API key user is not a Helix agent and the CLI no longer sends `isHelixTagged: true`). The comment's `isAgentAuthored` is `false` (because API key auth is not a Helix agent).
- Required Evidence: Terminal output of the CLI post command showing success. Verification of the created comment via `node dist/index.js comments list --ticket <valid-ticket-id>` or direct API call showing `isHelixTagged: false` and `isAgentAuthored: false`.

## Success Metrics

1. `isHelixTagged: true` removed from CLI POST body.
2. CLI sends only `{ content: message }` to the server.
3. `npm run typecheck` and `npm run build` exit 0.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Requirements source | CLI is the communication channel; server determines identity |
| Continuation context | Clarified requirements | External CLI users must appear as themselves; only Helix agents post as Helix |
| product/product.md | Product specification | "CLI stops overriding Helix tagging: The CLI sends only the comment content" |
| diagnosis/diagnosis-statement.md (CLI) | CLI-specific diagnosis | Remove hardcoded isHelixTagged: true at post.ts:32 |
| diagnosis/apl.json (CLI) | Investigation evidence | CLI should send only { content: message }; server handles attribution |
| tech-research/tech-research.md | Architecture decisions | "CLI sends only { content: message } — no isHelixTagged"; no CLI flag for MVP |
| scout/reference-map.json (CLI) | File-level code mapping | post.ts:33 is the single change point |
| scout/scout-summary.md (CLI) | CLI analysis | Hardcoded isHelixTagged: true; no local identity storage |
| post.ts (direct read) | Verified CLI code | Confirmed `body: { content: message, isHelixTagged: true }` at line 33 |
| comment-controller.ts (direct read, lines 65-77) | Verified server defaults | isHelixTagged defaults to false; forced true for agent comments |

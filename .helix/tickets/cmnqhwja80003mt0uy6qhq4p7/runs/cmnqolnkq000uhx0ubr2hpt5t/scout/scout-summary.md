# Scout Summary: helix-cli

## Problem

The CLI's `hlx comments post` command unconditionally sends `isHelixTagged: true` on every comment (post.ts:33), regardless of who is posting. This means external users commenting via the CLI have their comments wrongly marked as Helix-tagged. The CLI also stores no user identity information — only `{ apiKey, url }` — so there is no local signal to distinguish Helix sandbox agents from external human users.

## Analysis Summary

### Hardcoded isHelixTagged in Post Command

`src/comments/post.ts` line 31-33:
```typescript
const data = (await hxFetch(config, `/tickets/${ticketId}/comments`, {
  method: "POST",
  body: { content: message, isHelixTagged: true },
  basePath: "/api",
})) as PostCommentResponse;
```

Every CLI-posted comment is tagged `isHelixTagged: true`, regardless of whether the user is a Helix sandbox agent or an external user running `hlx` from their terminal.

### Comment List Display

`src/comments/list.ts` lines 48-55:
```typescript
const authorLabel = comment.isAgentAuthored
  ? "Helix"
  : (comment.author.name ?? comment.author.email);
```

Agent-authored comments display as "Helix"; other comments show the author's name/email. The `--helix-only` filter selects comments where `isHelixTagged === true`.

### Auth Identity — No Local User Info

Config (`src/lib/config.ts`) stores only `{ apiKey: string; url: string }`. There is no user ID, name, email, or agent-type stored locally. The identity is resolved entirely server-side based on the API key or token.

Env var priority for apiKey: `HELIX_API_KEY` > `HELIX_INSPECT_TOKEN` > `HELIX_INSPECT_API_KEY`. Sandbox agents get `HELIX_INSPECT_TOKEN` from the orchestrator. External users authenticate via `hlx login` (OAuth flow or manual key entry).

### HTTP Client — Already Supports Comment Paths

`hxFetch` in `src/lib/http.ts` accepts a configurable `basePath` parameter. Comment commands use `basePath: "/api"` (not the default `/api/inspect`), so the HTTP client already supports comment endpoints.

### Ticket ID Resolution

`src/comments/index.ts` resolves `ticketId` from `--ticket` flag or `HELIX_TICKET_ID` env var. The `HELIX_TICKET_ID` env var is already injected by the orchestrator for sandbox agents.

### Quality Gates

- Build: `npm run build` (tsc)
- Typecheck: `npm run typecheck` (tsc --noEmit)
- No lint or test commands configured
- Zero runtime dependencies

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/comments/post.ts` | Hardcoded `isHelixTagged: true` at line 33 — core issue |
| `src/comments/list.ts` | Comment display logic; isAgentAuthored → "Helix" label; --helix-only/--since filters |
| `src/comments/index.ts` | Comments subcommand router; ticketId from args or HELIX_TICKET_ID env var |
| `src/lib/config.ts` | Auth config: only stores { apiKey, url } — no user identity |
| `src/lib/http.ts` | HTTP client with configurable basePath; hxi_ → X-API-Key, others → Bearer |
| `src/login.ts` | OAuth/manual login; saves { apiKey, url } — no user metadata |
| `src/index.ts` | CLI entry point; comment command routing |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| src/comments/post.ts | Identify hardcoded isHelixTagged | Line 33: always sends isHelixTagged: true regardless of user identity |
| src/comments/list.ts | Map comment display and filtering | isAgentAuthored → "Helix" label; --helix-only and --since filters supported |
| src/comments/index.ts | Map subcommand routing | ticketId resolved from --ticket flag or HELIX_TICKET_ID env var |
| src/lib/config.ts | Map auth config | Only { apiKey, url } stored; no user identity info |
| src/lib/http.ts | Map HTTP client | Supports configurable basePath; hxi_ prefix detection for header choice |
| src/login.ts | Map user auth flow | OAuth or manual; saves only apiKey+url |
| ticket.md + continuation context | Clarify requirements | Only Helix agents should tag as Helix; external users should show as themselves; isHelixTagged should not be hardcoded |

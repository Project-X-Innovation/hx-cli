# Product: Correct Comment Attribution and @Helix Mention Flow

## Problem Statement

When users comment on a ticket via the Helix CLI, every comment is attributed to "Helix" regardless of who actually posted it. A user commenting from their own Claude Code terminal appears as "Helix," not as themselves. Conversely, there is no verified mechanism to ensure that comments displayed as "from Helix" actually originated from a Helix sandbox agent. The UI also has a redundant "Add Helix" checkbox that duplicates the already-functional @Helix mention autocomplete.

These issues erode trust in the discussion system: users cannot tell who said what, and Helix's identity — which carries authority — can be inadvertently claimed by any CLI user.

## Product Vision

The ticket discussion system should feel like a natural conversation where every participant's identity is clear and trustworthy. @Helix is the sole mechanism for invoking Helix's attention, and when Helix responds, users can trust that response genuinely came from Helix's agents. When any other user comments, their name appears — no ambiguity, no impersonation.

## Users

| User Type | Description |
|-----------|-------------|
| **Helix sandbox agents** | Automated agents running inside the Helix orchestrator sandbox. They comment on behalf of Helix during workflow execution. |
| **External CLI users** | Human users (e.g., developers, admins) using `hlx` from their terminal via Claude Code or directly. They authenticate via `hlx login` and comment as themselves. |
| **Web UI users** | Users interacting with ticket discussions through the Helix web client. They @mention Helix and read comment threads. |

## Use Cases

1. **External user comments via CLI**: A developer uses `hlx comments post` from their Claude Code session. Their comment appears under their own name, not as "Helix."
2. **Helix agent responds to @Helix**: A user @mentions Helix in a comment. At the next check-in interval, the Helix agent sees the mention, and its response is clearly attributed to "Helix."
3. **User @mentions Helix in web UI**: A user types `@Helix` in the comment box. The autocomplete suggests the Helix pseudo-member. The comment is tagged for Helix's attention. No separate checkbox is needed.
4. **Trust in Helix identity**: When a comment shows as "from Helix," the reader can trust it actually came from a verified Helix sandbox agent, not from an arbitrary CLI user.

## Core Workflow

1. User posts a comment (via web UI or CLI).
2. The server identifies the commenter based on their auth credentials:
   - Helix sandbox agent token -> attributed to "Helix," marked as agent-authored
   - API key from `hlx login` -> attributed to the authenticated user by name
   - Web session -> attributed to the logged-in user
3. If the comment @mentions Helix, it is tagged for Helix's attention.
4. At the start of each workflow step, Helix agents check for new @Helix comments and respond briefly.

## Essential Features (MVP)

1. **Correct comment attribution**: Comments from external CLI users show the user's own name/identity. Only comments from verified Helix sandbox agents display as "Helix."
2. **Verified Helix identity**: The system distinguishes Helix sandbox agent auth from external user auth so that no one can accidentally or intentionally post as Helix.
3. **@Helix mention as sole invocation mechanism**: The @Helix autocomplete in the web UI is the only way to tag Helix on a comment. The redundant "Add Helix" checkbox is removed.
4. **Server-determined tagging**: The server determines whether a comment is Helix-tagged and agent-authored based on the authenticated identity, rather than trusting client-supplied flags.
5. **CLI stops overriding Helix tagging**: The CLI sends only the comment content and lets the server decide attribution based on the caller's identity.

## Features Explicitly Out of Scope (MVP)

1. **Real-time comment push notifications**: Agents check at step boundaries (already implemented), not via live websockets.
2. **Rich formatting or attachments in CLI comments**: Comments remain plain text.
3. **Per-comment identity display changes in web UI**: The existing CommentItem display logic (showing "Helix" for agent-authored, user name otherwise) is sufficient once the server correctly sets `isAgentAuthored`.
4. **New database schema migrations**: The diagnosis confirms the TicketComment table does not yet exist in production, and the fix can use JWT claims rather than new DB fields.
5. **Changes to comment polling frequency**: The existing 30-second web UI polling and per-step agent refresh are adequate.
6. **CLI storing local user identity**: The server resolves identity from the API key; no local config changes needed.

## Success Criteria

| # | Criterion |
|---|-----------|
| 1 | A comment posted by an external CLI user (authenticated via `hlx login` API key) displays the user's own name in both the web UI and in agent-consumed ticket.md. |
| 2 | A comment posted by a Helix sandbox agent displays as "Helix" with the agent badge. |
| 3 | No external CLI user can have their comment attributed to "Helix." |
| 4 | The "Add Helix" checkbox is removed from the web UI; @Helix mention autocomplete is the sole tagging mechanism. |
| 5 | The CLI does not send `isHelixTagged: true` — the server determines tagging from auth identity. |
| 6 | All three repos (server, client, CLI) pass their respective build/typecheck/lint quality gates. |

## Key Design Principles

- **Identity integrity**: Who you are determines how your comment appears. The system must not allow identity spoofing or ambiguity.
- **Server as source of truth**: Attribution decisions (isAgentAuthored, isHelixTagged) are made server-side based on verified auth, not client-supplied flags.
- **Minimal change**: Fix the identity conflation in the existing auth chain rather than introducing new models, tables, or complex infrastructure.
- **@Helix is natural and beautiful**: Mentioning Helix works exactly like mentioning any other team member — type `@Helix`, select from autocomplete, done.

## Scope & Constraints

- **Three repos affected**: helix-global-server (core identity fix), helix-cli (remove hardcoded tagging), helix-global-client (remove checkbox).
- **No DB migration required**: TicketComment table is not yet in production (confirmed via runtime DB inspection). The identity distinction can be carried in JWT claims.
- **Backward compatible**: Existing API key auth for external users continues to work; the change only affects how the server interprets auth signals for comment attribution.
- **Mid-run comment checking already exists**: `refreshCommentsForStep` and `DISCUSSION_AWARENESS_RULES` are already in place in all 9 workflow step prompts. No new polling infrastructure needed.

## Future Considerations

- Richer comment interaction patterns (reactions, threading, editing)
- Real-time comment notification via websockets instead of polling
- Displaying the specific Helix agent step (e.g., "Helix - Scout") rather than a generic "Helix" label
- CLI storing user identity locally for offline display or richer UX
- Rate limiting or abuse prevention for comment posting via API keys

## Open Questions / Risks

| # | Question / Risk |
|---|----------------|
| 1 | **JWT claim vs. API key field**: Diagnosis recommends a JWT claim (`isHelixAgent`) which avoids DB changes. If future requirements need to distinguish agent types at the API key level, a DB field may be needed later. |
| 2 | **Existing API keys in production**: Two active API keys exist (both created by the admin user "Mr Usher"). The fix must not break their current behavior — they should continue working but now correctly attribute comments to the key creator rather than to "Helix." |
| 3 | **CLI login flow verification**: Need to confirm the full OAuth flow for `hlx login` produces an `hxi_`-prefixed API key (not a JWT), ensuring external users always go through the API key auth path. |
| 4 | **isAgentAuthored redefinition scope**: Changing the meaning of `isAgentAuthored` from "any inspection auth" to "verified Helix agent" affects how the web UI and ticket.md render comments. All consumers of this field must be consistent. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (all repos) | Understand requirements and user intent | @Helix mention is sole mechanism; agents check at intervals; CLI is the communication channel |
| Continuation context | Clarify refined requirements from user | No checkbox needed; external CLI users must appear as themselves; only Helix agents can post as Helix; identity must be verified |
| scout/scout-summary.md (helix-global-server) | Map server auth chain and comment attribution | isAgentAuthored=isInspectionAuth conflates user types; refreshCommentsForStep already exists; no isHelixAgent JWT claim |
| scout/scout-summary.md (helix-global-client) | Map client UI for checkbox and display | Checkbox at lines 1466-1474 is redundant; @Helix autocomplete already functional |
| scout/scout-summary.md (helix-cli) | Map CLI comment behavior | isHelixTagged hardcoded true; CLI stores no user identity |
| scout/reference-map.json (helix-global-server) | Detailed file-level evidence | 9 files mapped; 12 facts established; 4 unknowns recorded |
| scout/reference-map.json (helix-global-client) | Detailed file-level evidence | 5 files; checkbox redundancy confirmed; agent display uniformity noted |
| scout/reference-map.json (helix-cli) | Detailed file-level evidence | 7 files; hardcoded tagging confirmed; no local identity storage |
| diagnosis/diagnosis-statement.md (helix-global-server) | Root cause and fix strategy | JWT claim approach avoids DB migration; 4 server touchpoints; TicketComment not in production |
| diagnosis/diagnosis-statement.md (helix-global-client) | Client-specific diagnosis | Checkbox removal; @Helix autocomplete preserved |
| diagnosis/diagnosis-statement.md (helix-cli) | CLI-specific diagnosis | Remove hardcoded isHelixTagged; let server determine |
| repo-guidance.json (helix-global-client) | Repo intent classification | All three repos are targets; server is primary |
| Runtime DB (via manifest.json) | Production state verification | TicketComment table absent; 2 active API keys exist |

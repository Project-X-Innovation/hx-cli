# Product: Bidirectional Mid-Run Discussion Between Users and Helix Agents

## Problem Statement

Users cannot communicate with Helix agents once a workflow run begins. Today, comments are one-directional: users post discussion on a ticket, those comments are baked into `ticket.md` at run start, and agents never see any comments added after that point. Agents have no way to post responses back. This means users cannot provide additional context, ask questions, or redirect Helix mid-run — and Helix cannot acknowledge or respond to user input during a run.

## Product Vision

Enable natural, bidirectional conversation between users and Helix agents during workflow runs. Users @mention Helix in discussion (the same way they @mention any other team member), and Helix agents check for and respond to those messages at stage boundaries. The interaction is informal, brief, and asynchronous — not real-time chat, but responsive enough that users feel heard within minutes.

## Users

| User | Context |
|------|---------|
| **Ticket authors / team members** | Post comments and @mention Helix during a run to provide context, ask questions, or give direction |
| **Helix agents (sandbox)** | Read new comments at step boundaries, respond to @Helix-tagged messages, and incorporate user input into their work |
| **External CLI users** | Developers using `hlx` from their terminal (e.g., with Claude Code) who want to read and post comments on tickets they have access to |

## Use Cases

1. **User asks Helix a question mid-run**: A user types "@Helix can you also check the migration file?" in discussion. Before the next workflow step, the agent sees this comment and responds with a brief acknowledgment or answer.
2. **User provides additional context**: A user adds a comment with a code snippet or clarification after the run has started. Helix sees it at the next step boundary and incorporates the context.
3. **Helix responds with a brief answer**: When an @Helix comment asks a question Helix can answer (including by referencing existing documentation), Helix posts a brief, informal response.
4. **External developer reads ticket discussion**: A developer using `hlx` from their terminal views comments on a ticket to understand what has been discussed.
5. **External developer posts a comment**: A developer using `hlx` posts a comment on a ticket, attributed to their own identity.

## Core Workflow

1. User writes a comment in the ticket discussion and @mentions Helix (via autocomplete, the same way they mention any team member).
2. The comment is saved with `isHelixTagged=true`, signaling it is directed at Helix.
3. At step boundaries (before/after each workflow stage), the orchestrator refreshes comments and updates `ticket.md` in the sandbox with any new discussion.
4. The agent sees new @Helix comments, processes them, and posts a brief response via the Helix CLI (`hlx comments post`).
5. The response appears in the ticket discussion attributed to "Helix" (not the org user), visually distinct from human comments.
6. The user sees Helix's response in the UI (picked up by the existing 30-second polling).

## Essential Features (MVP)

1. **@Helix in mention autocomplete**: "Helix" appears as a selectable entry in the @mention dropdown, setting `isHelixTagged=true` when selected.
2. **Agent comment display**: Comments posted by Helix agents render with Helix branding (icon, "Helix" name, distinct styling) instead of the org user's identity.
3. **Server auth for agents/CLI**: Comment API endpoints accept inspection tokens and hxi_ API keys — not just session JWTs — so agents and CLI users can read and post comments.
4. **Agent identity attribution**: Comments posted via inspection tokens are marked as agent-authored (`isAgentAuthored` field) so the system knows to display them as "from Helix."
5. **Mid-run comment refresh**: The orchestrator checks for new comments at step boundaries (before each workflow stage) and updates `ticket.md` in the sandbox.
6. **CLI comment commands**: `hlx comments list` and `hlx comments post` commands allow agents and CLI users to read and write comments.
7. **Ticket ID in sandbox environment**: `HELIX_TICKET_ID` is injected into the sandbox env so agents can use CLI comment commands without parsing paths.
8. **Agent prompt updates**: Minimal prompt additions instructing agents to check for and respond to @Helix comments at step boundaries. Responses should be brief and informal.

## Features Explicitly Out of Scope (MVP)

- **Real-time / push-based comment delivery**: Polling at step boundaries is sufficient; no WebSocket or SSE streaming to agents.
- **Rich conversation threading**: Comments remain a flat list; no reply-to or threading.
- **Agent-initiated outbound questions**: Agents respond to @Helix comments but do not proactively ask users questions unprompted.
- **Comment editing**: Comments remain immutable after posting.
- **Notification system**: No push notifications, email, or in-app alerts for agent responses beyond what already exists.
- **Rate limiting or abuse prevention for agent comments**: Not needed for MVP given controlled sandbox environment.
- **Multi-agent attribution**: All agent comments appear as "Helix" regardless of which workflow step posted them.

## Success Criteria

| # | Criterion | How Verified |
|---|-----------|--------------|
| 1 | User types "@H" in comment box and "Helix" appears in the autocomplete dropdown | Manual UI test |
| 2 | Selecting @Helix sets `isHelixTagged=true` on the created comment | Inspect API payload |
| 3 | Agent-authored comments display with Helix branding (icon, "Helix" name), not the org user's identity | Visual inspection in UI |
| 4 | `hlx comments list --ticket <id>` returns ticket comments when authenticated with an inspection token | CLI test in sandbox |
| 5 | `hlx comments post --ticket <id> "message"` creates a comment attributed to Helix | CLI test + UI check |
| 6 | New comments posted after run start appear in `ticket.md` before the next workflow step executes | Log inspection / artifact check |
| 7 | Agent responds to an @Helix comment with a brief message visible in the UI | End-to-end run test |
| 8 | External CLI user's comments are attributed to their own identity (not Helix) | CLI test with user auth |

## Key Design Principles

- **@mention parity**: Mentioning Helix works exactly like mentioning a team member — same autocomplete, same interaction pattern.
- **Identity clarity**: It is always clear who posted a comment — Helix vs. a specific human user. The auth mechanism (inspection token vs. session/API key) determines identity.
- **Brevity**: Agent responses are informal and brief. This is not the place for full reports or investigations.
- **Non-disruptive**: Mid-run comment checking happens at natural stage boundaries, not interrupting agent work mid-task.
- **Two-for-one mechanism**: The Helix CLI serves both sandbox agents and external CLI users with the same commands, differentiated by auth identity.

## Scope & Constraints

- **Three repos impacted**: helix-global-server (auth, orchestrator, schema), helix-cli (new commands, HTTP client), helix-global-client (UI: autocomplete, comment display, types).
- **Schema migration required**: Adding `isAgentAuthored` boolean to `TicketComment` requires a Prisma migration.
- **Existing 30s polling is adequate**: The client already refetches comments every 30 seconds — no client-side polling changes needed for agent responses to appear.
- **Backward compatible**: The "Add Helix" checkbox can be retained alongside @mention for backward compatibility. Existing comment functionality must not break.

## Future Considerations

- Real-time comment delivery to agents (WebSocket/SSE) for more responsive interaction.
- Threaded replies to enable structured conversation.
- Agent-initiated questions ("I need clarification on X — can you confirm?").
- Per-step attribution (showing which workflow stage posted a response).
- Richer comment formatting or structured data in agent responses.
- Comment-based workflow control (e.g., "@Helix skip the code review step").

## Open Questions / Risks

| # | Question / Risk | Notes |
|---|-----------------|-------|
| 1 | Should the "Add Helix" checkbox be removed or kept alongside @mention? | Ticket says @mention; diagnosis suggests keeping both for backward compatibility. Product recommendation: keep both for MVP, synced. |
| 2 | How should inspection token scope be extended for comment access? | Currently scoped to repo IDs only. May need ticket-level scope or rely on org membership. |
| 3 | What is the right interval for comment checking — before each step only, or before and after? | Ticket says "at least at the beginning of each stage." Before-and-after gives agents a chance to respond at step end. |
| 4 | How should agents handle comments that require significant work or are out of scope? | Agents should acknowledge the comment and explain briefly that it's outside the current task scope. |
| 5 | What happens if a user @mentions Helix after all steps have completed? | The run is finished — no agent will see the comment. This is a known limitation for MVP. |
| 6 | Should agent responses include a visual indicator of which step they were posted from? | Out of scope for MVP but useful for future transparency. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/scout-summary.md (helix-global-server) | Understand server architecture and gaps | Comment routes are session-only auth; comments loaded once at run start; beforeStep hook is the natural integration point |
| scout/scout-summary.md (helix-global-client) | Understand client UI state | @Helix not in autocomplete; "Add Helix" is checkbox-based; 30s refetch already exists |
| scout/scout-summary.md (helix-cli) | Understand CLI capabilities | No comment commands; HTTP client hardcodes /api/inspect; ticket ID not in sandbox env |
| diagnosis/diagnosis-statement.md (helix-global-server) | Identify five architectural gaps | Auth gap, mid-run refresh gap, identity attribution gap, CLI gap, client UI gap — all confirmed with evidence |
| diagnosis/diagnosis-statement.md (helix-global-client) | Identify client-specific gaps | MentionAutocomplete members-only; no agent comment display; TicketComment lacks isAgentAuthored |
| diagnosis/diagnosis-statement.md (helix-cli) | Identify CLI-specific gaps | No comment commands; hxFetch hardcodes /api/inspect; HELIX_TICKET_ID missing |
| diagnosis/apl.json (helix-global-server) | Detailed Q&A evidence | Confirmed auth boundary at api.ts line 151; beforeStep composition; token identity resolution |
| diagnosis/apl.json (helix-global-client) | Detailed Q&A evidence | Confirmed MentionAutocomplete filter, checkbox behavior, CommentItem rendering |
| diagnosis/apl.json (helix-cli) | Detailed Q&A evidence | Confirmed hxFetch URL construction, command router pattern, env var availability |
| repo-guidance.json | Repo intent classification | All three repos are targets: server (heaviest), CLI (net-new commands), client (UI changes) |
| scout/reference-map.json (all repos) | File inventory | Key files and line numbers for all touchpoints |

# Scout Summary: helix-cli

## Problem

Research ticket RSH-226 asks how to bring ownership into Helix so that Helix itself (not humans) owns outcomes, accountability, and operational continuity. The ticket explicitly rejects putting "a human's head in the noose" and asks for brainstorming about ownership models that let Helix take accountability while still allowing human verification. Four attached strategy documents (Manifesto, Positioning, Reality Check & Risks, Tagline) establish that Helix's core thesis is "owned operations" - durable ownership of the custom operational layer that neither ERPs nor AI models currently own.

## Analysis Summary

### Existing Ownership Surface in helix-cli

The CLI is primarily an agent communication tool with two capabilities: **comments** (read/write) and **inspection** (read-only). It has no explicit ownership concepts but provides the **identity attribution infrastructure** that would underpin any ownership model:

1. **Agent vs Human Identity**: Two token types (`hxi_*` for agents, Bearer JWT for humans) are distinguished at the HTTP transport level, enabling server-side attribution of all actions.

2. **Comment Attribution**: The comment model tracks `author`, `isAgentAuthored`, and `isHelixTagged` flags. This creates an audit trail of who said what, but comments are informational only - not approval gates.

3. **Ticket Binding**: Agent actions are bound to specific tickets via `HELIX_TICKET_ID` environment variable, ensuring traceability.

### What Does NOT Exist in helix-cli

- No approval, verification, or sign-off commands
- No rollback or revert operations
- No ownership assignment or transfer
- No deployment trigger or gate commands
- All governance logic lives server-side (helix-global-server)

### Strategic Context from Attachments

The four attached documents collectively define Helix's ownership thesis:

- **Manifesto**: "If Helix touches it, Helix is responsible for it. Not partially. Not temporarily. Fully. And forever." Nine principles including Responsibility, Completion, Safety, Decision Ownership, Continuity, Trust Through Behavior.
- **Positioning**: Helix fills the structural gap between ERP (owns platform, not custom layer), consultants (implement but don't stay), and AI models (generate but don't govern).
- **Reality Check**: Time-bound roadmap - by 6 months Helix needs governed execution in one lane; by 12 months, persistent account memory; by 18 months, institutional trust; by 36 months, it's either the ownership layer or dead.
- **Tagline**: "Owned operations." The brand centers on ownership as the scarce differentiator.

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/comments/list.ts` | Comment attribution model (author, isAgentAuthored, isHelixTagged) |
| `src/comments/post.ts` | Agent comment posting - the dialogue audit trail |
| `src/lib/config.ts` | Two auth paths (hxi_ vs Bearer JWT) for agent vs human identity |
| `src/lib/http.ts` | Transport-level identity distinction via headers |
| `src/inspect/db.ts` | Audited database inspection (server audits all queries) |
| `src/index.ts` | CLI command router - full agent surface area |
| `package.json` | Build: tsc. Typecheck: tsc --noEmit. No test/lint scripts. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand ticket scope and intent | Research ticket about ownership models; brainstorming, not implementation. Explicitly wants Helix to own outcomes, not humans. |
| Helix_Manifesto.pdf | Referenced strategy document | Nine principles defining ownership philosophy. "Humans express intent. Helix owns outcomes." Principle 4: "All decisions live in Helix." |
| Helix_Positioning_Refined.pdf | Referenced strategy document | Structural gap analysis: ERP doesn't own custom layer, consultants don't stay, AI doesn't govern. Helix fills the gap with durable operational ownership. |
| Reality_Check___Risks.pdf | Referenced strategy document | Time-pressure roadmap. By 6 months: governed execution in one lane. By 12 months: stateful and persistent. By 36 months: ownership layer or dead. |
| Helix_Tagline.pdf | Referenced strategy document | "Owned operations." Brand centers on ownership as the scarce thing. Five tagline variants all lead with ownership. |
| src/comments/list.ts | Map existing attribution | isAgentAuthored and isHelixTagged flags provide identity attribution but no ownership enforcement |
| src/lib/config.ts | Map identity infrastructure | Two token types enable agent vs human distinction at transport level |

# Diagnosis Statement: helix-cli

## Problem Summary

The CLI's `hlx comments post` command unconditionally sends `isHelixTagged: true` on every comment (post.ts:32), regardless of who is posting. This means any external user commenting via the CLI wrongly has their comment marked as Helix-tagged.

## Root Cause Analysis

The hardcoded `isHelixTagged: true` was a shortcut from the initial implementation when the CLI was assumed to be used only by Helix sandbox agents. With the server-side identity fix introducing `isHelixAgent` as a distinct JWT claim, the server will determine `isHelixTagged` and `isAgentAuthored` based on auth identity. The CLI should not override this.

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| Hardcoded isHelixTagged | `post.ts:31-33` | `body: { content: message, isHelixTagged: true }` |
| Server defaults isHelixTagged to false | `comment-controller.ts:65-66` | Falls back to false if not provided |
| Server forces for agents | `comment-controller.ts:77` | `isHelixTagged: isAgentAuthored ? true : isHelixTagged` |

## Success Criteria

1. `hlx comments post` does not send `isHelixTagged: true` — sends only `{ content: message }`.
2. `npm run typecheck` passes.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md + continuation context | Requirements | External CLI users should not auto-tag as Helix |
| scout/reference-map.json (CLI) | Map code structure | Identified hardcoded isHelixTagged at post.ts:32 |
| post.ts (direct read) | Verify CLI behavior | Confirmed hardcoded isHelixTagged: true in POST body |
| comment-controller.ts (direct read) | Verify server behavior | Server defaults isHelixTagged to false; forces true for agent comments |

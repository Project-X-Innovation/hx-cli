# Scout Summary — helix-cli

## Problem

The CLI is the in-sandbox communication layer between Helix agents and the server. For the ego agent concept, the CLI represents the boundary through which agents (including a potential ego agent) interact with the outside world during runs. The CLI's comment commands (list/post) are the existing mechanism for agent-to-user communication, and its HTTP client provides server connectivity with retry logic.

## Analysis Summary

The helix-cli is a minimal, zero-dependency TypeScript CLI that provides:

1. **Comment commands** (`src/comments/list.ts`, `src/comments/post.ts`): Allow in-sandbox agents to read discussion context (with optional Helix-tagged and date filters) and post agent-authored comments (always with `isHelixTagged: true`).

2. **HTTP transport** (`src/lib/http.ts`): Authenticated HTTP client with 3-attempt retry, exponential backoff, and 30s timeout. Supports both inspection tokens (`hxi_` prefix) and bearer tokens.

3. **Environment-based identity** (`src/lib/config.ts`): Agent identity and connectivity configured via `HELIX_INSPECT_TOKEN`, `HELIX_INSPECT_BASE_URL`, and `HELIX_TICKET_ID`.

The CLI is used by the orchestrator to inject agent capabilities into the sandbox. Each run gets a fresh inspection token with `isHelixAgent=true`. The CLI itself has no concept of persistent sessions or agent continuity — it operates statelessly within whatever sandbox environment it's invoked in.

For the ego agent concept, the CLI is relevant as the communication interface that would need to support any new interaction patterns (e.g., ego agent reading/writing shared state, requesting step re-execution, or maintaining persistent context).

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/index.ts` | CLI entry point with manual argv routing |
| `src/comments/list.ts` | Comment listing with filters for agent context reading |
| `src/comments/post.ts` | Agent comment posting (isHelixTagged=true) |
| `src/lib/http.ts` | HTTP client with retry logic and token authentication |
| `src/lib/config.ts` | Environment-based agent identity configuration |
| `package.json` | Zero-dependency constraint, build scripts |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement context | The ego agent needs persistent communication; CLI is the in-sandbox communication layer |
| src/index.ts | Map CLI command surface | Manual argv routing, small command set — extensible for new ego agent commands |
| src/comments/post.ts | Understand agent-to-user communication | Agent comments always tagged isHelixTagged=true; stateless per-invocation |
| src/lib/config.ts | Understand agent identity in sandbox | Identity from env vars (HELIX_INSPECT_TOKEN), no persistent session concept |
| package.json | Map build and dependency constraints | Zero runtime deps by design; build via tsc |

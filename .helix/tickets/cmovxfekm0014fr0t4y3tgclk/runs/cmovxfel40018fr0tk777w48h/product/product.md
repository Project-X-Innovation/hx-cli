# Product — BLD-401

## Problem Statement

`hlx tickets create` has three usability defects that cause silent failures and prevent basic post-create corrections:

1. **`--repos` rejects repo names/keys**: Users pass the human-readable names shown by `hlx inspect repos`, but the CLI sends them as raw repository IDs. The server returns HTTP 400 for anything that is not an internal ID — a confusing failure with no actionable guidance.
2. **No file-based description input**: `--description` only accepts a literal string. Passing a file path silently uses the path itself as the ticket body. Agent workflows that pipe file paths are especially vulnerable to this silent corruption.
3. **No way to fix a description after creation**: Typos or incorrect descriptions require creating a new ticket. The server already supports description editing via PATCH, but no CLI command exposes it.

## Product Vision

Make `hlx tickets create` reliable and predictable for both interactive and agent-driven workflows by resolving repo identifiers, supporting file-based descriptions, and enabling post-create corrections.

## Users

- **CLI operators** who create and manage Helix tickets from terminal sessions.
- **Automated agents** that invoke `hlx tickets create` programmatically and pass file paths or repo keys from context.

## Use Cases

1. A user creates a ticket referencing repos by their display name or key (e.g., `--repos helix-cli`) and expects it to work without looking up internal IDs.
2. An agent writes a description to a temp file and passes the file path via `--description-file /tmp/desc.md`.
3. A user accidentally passes a file path to `--description` and expects a clear error instead of a ticket with a path string as the body.
4. A user notices a description error immediately after creation and fixes it with `hlx tickets update-description`.

## Core Workflow

1. User runs `hlx tickets create --repos <name-or-key> --description-file <path> ...`
2. CLI resolves each repo name/key to an internal ID (client-side, before any ticket is created).
3. CLI reads the description from the file.
4. CLI creates the ticket via the existing POST endpoint.
5. If the description needs correction, user runs `hlx tickets update-description <ticket-ref> --file <path>` or `--text <string>`.

## Essential Features (MVP)

| # | Feature | User-Facing Behavior |
|---|---------|---------------------|
| F1 | **Repo name/key resolution** | `--repos` accepts display names, keys, or IDs. Unknown values fail before ticket creation with a message referencing `hlx inspect repos`. |
| F2 | **`--description-file` flag** | Reads UTF-8 text from disk and uses file contents as the ticket description. |
| F3 | **Mutual exclusivity** | `--description` and `--description-file` cannot be combined; providing both fails immediately with a clear error. |
| F4 | **File-path detection on `--description`** | If `--description` value is a readable local file path, CLI fails with a clear error directing the user to `--description-file`. |
| F5 | **`update-description` subcommand** | `hlx tickets update-description <ticket-ref> --file <path>` or `--text <string>` updates the description. Change is reflected by `hlx tickets get`. |
| F6 | **Accurate help text** | `tickets create` help text states that `--repos` accepts names, keys, or IDs. |

## Features Explicitly Out of Scope (MVP)

- Editing other ticket fields (title, status, mode).
- Markdown rendering or formatting changes.
- Bulk ticket operations.
- Server-side changes (all required API endpoints already exist).
- Changes to `helix-global-server`.

## Success Criteria

| # | Criterion | Verified By |
|---|-----------|-------------|
| SC1 | `--description-file <existing-md>` produces a ticket whose description equals the file contents. | Create ticket, then `hlx tickets get` to confirm. |
| SC2 | `--description <existing-file-path>` does NOT silently use the path string as the body. | CLI exits with non-zero code and clear error. |
| SC3 | `--repos <unknown-name>` fails before creating any ticket, with a message referencing `hlx inspect repos`. | CLI exits with non-zero code; no ticket created. |
| SC4 | `hlx tickets update-description <ticket-ref>` updates the description. | `hlx tickets get` reflects the new value. |
| SC5 | Help text for `tickets create` matches actual `--repos` contract. | `hlx tickets create --help` shows names/keys/IDs are accepted. |

## Key Design Principles

- **Fail fast, fail clearly**: All validation (repo resolution, file existence, flag conflicts) happens before any API call.
- **Reuse existing infrastructure**: `resolveRepo()` already resolves names/keys; the server PATCH endpoint already accepts description updates.
- **Smallest correct change**: CLI-only modifications; no server changes needed.
- **Consistent patterns**: New subcommand follows the established `extractTicketRef + resolveTicket + handler` pattern.

## Scope & Constraints

- **Change target**: `helix-cli` only. `helix-global-server` is context-only — no modifications.
- **Server status restriction**: Description edits are restricted to DRAFT or QUEUED tickets by the server (returns HTTP 409 otherwise). The CLI should surface this server error clearly but does not need to pre-validate status.
- **Description length**: Server enforces a 10,000-character maximum (`updateTicketSchema`). The CLI should pass through the server's validation error.
- **File encoding**: `--description-file` reads UTF-8. No requirement for other encodings.

## Future Considerations

- Editing additional ticket fields (title, status) via CLI.
- Interactive/editor-based description editing (e.g., `$EDITOR` integration).
- Batch ticket operations.
- Repo resolution caching for repeated calls.

## Open Questions / Risks

| # | Question | Impact |
|---|----------|--------|
| OQ1 | Does the CLI auth token always have access to `GET /api/inspect/repositories` (inspect auth), or could some tokens only access `GET /api/settings/repositories` (standard auth)? | If inspect auth is not universally available, `resolveRepo()` may fail for some users. Needs verification during implementation. |
| OQ2 | Should file-path detection on `--description` warn-and-exit or silently load the file? | Ticket says "either load the file or fail closed." Product preference is fail-with-error directing to `--description-file` for explicitness. |
| OQ3 | Should `update-description` accept both `--file` and `--text` simultaneously, or require exactly one? | Mutual exclusivity is cleaner and matches the `--description` / `--description-file` pattern. |

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md (helix-cli) | Requirements and acceptance criteria | Three defects with clear acceptance criteria and out-of-scope boundaries |
| scout/scout-summary.md (helix-cli) | Code analysis and file mapping | CLI-only change set; resolveRepo already exists; server PATCH endpoint functional |
| scout/reference-map.json (helix-cli) | Detailed file-level evidence and facts | Confirmed raw pass-through in create.ts, resolveRepo pattern, hxFetch PATCH support |
| diagnosis/diagnosis-statement.md (helix-cli) | Root cause analysis and fix direction | Three root causes confirmed with evidence; all fixable within CLI |
| diagnosis/apl.json (helix-cli) | Answered diagnostic questions | Server endpoints confirmed functional; CLI has all needed infrastructure |
| repo-guidance.json (shared) | Repo intent classification | helix-cli = target, helix-global-server = context only |
| /tmp/helix-inspect/manifest.json | Runtime inspection availability | DB/logs available for server; not needed for CLI-only product framing |

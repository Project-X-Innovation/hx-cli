# Ticket Context

- ticket_id: cmovxfekm0014fr0t4y3tgclk
- short_id: BLD-401
- run_id: cmovxfel40018fr0tk777w48h
- run_branch: helix/build/BLD-401-improve-hlx-tickets-create-ergonomics-repos
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Improve hlx tickets create ergonomics: --repos, --description-file, post-create edit

## Description
# Ticket: Improve `hlx tickets create` ergonomics

## Summary
Fix three usability defects in `hlx tickets create`: misleading `--repos` semantics, no file-based description input, and no way to correct a description after creation.

## Why
1. `--repos` help text suggests repo names/keys are accepted, but the implementation requires internal repository IDs. Passing a key returns `HTTP 400 — Unknown repositoryId: <key>`.
2. `--description` is literal-only. Passing a local file path silently uses the path string as the ticket body — easy to miss when invoking from an agent.
3. There is no command to fix the description after creation, even though it is the most common post-create correction.

## Required Behavior
- `--repos` either accepts repo keys/names (resolved via the same source as `hlx inspect repos`) OR the help text and error messages clearly state that repository IDs are required and reference `hlx inspect repos`.
- New `--description-file <path>` flag on `tickets create` reads UTF-8 text from disk and posts file contents as the description.
- `--description` and `--description-file` must be mutually exclusive — providing both must fail clearly before any ticket is created.
- If `--description` is given a value that is a readable local file path, the CLI must NOT silently use the path string. Either load the file or fail closed with a clear error.
- New CLI surface for editing a ticket description after creation (e.g. `hlx tickets update-description <ticket-ref> --file <path>` or `--text <string>`). The change must be reflected by `hlx tickets get`.

## Non-Negotiable
- Unknown repo key/name in `--repos` must fail before any ticket is created.
- Unreadable file passed to `--description-file` must fail with a non-zero exit code and a clear error.

## Out of Scope
- Editing other ticket fields (title, status, mode).
- Markdown rendering changes.
- Bulk ticket operations.

## Acceptance Criteria
1. `hlx tickets create --description-file <existing-md> ...` produces a ticket whose description equals the file contents.
2. `hlx tickets create --description <existing-file-path> ...` does NOT silently use the path string as the body.
3. `hlx tickets create --repos <unknown> ...` fails before creating the ticket, with a message that references `hlx inspect repos`.
4. `hlx tickets update-description <ticket-ref>` updates the description and `hlx tickets get` reflects the new value.
5. Help text for `tickets create` matches the actual contract for `--repos`.

## Attachments
- (none)

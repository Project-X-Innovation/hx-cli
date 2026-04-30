# Ticket Context

- ticket_id: cmolkrnae0013eg0u71xp0gle
- short_id: HLX-343
- run_id: cmolkrnas0016eg0uk3l2mtq2
- run_branch: helix/auto/HLX-343-add-explicit-mode-selection-to-hlx-tickets-create
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Add Explicit Mode Selection To hlx tickets create

## Description
# Ticket: Add Explicit Mode Selection To `hlx tickets create`

## Summary
Add a `--mode` option to `hlx tickets create` so CLI users can explicitly create `AUTO`, `BUILD`, `FIX`, `RESEARCH`, or `EXECUTE` tickets instead of always relying on the backend default.

## Why
When creating a CLI improvement ticket through `hlx tickets create`, the resulting ticket was created as `AUTO` / `HLX-*`. The CLI did not expose a way to choose the ticket mode. The backend already supports an optional `mode` field on `POST /api/tickets`, but the CLI currently sends only `title`, `description`, and `repositoryIds`. This makes the CLI less capable than the UI/API and causes accidental Auto tickets when the operator intended Build, Fix, Research, or Execute.

## Decisions Already Made
- This is a CLI feature ticket, not a backend workflow redesign.
- The backend already supports `mode`; reuse that API contract.
- `--mode` must be optional so existing CLI usage remains compatible.
- If `--mode` is omitted, preserve current backend default behavior.
- The CLI should validate the mode before sending the request.

## Do Not Re-Decide
- Do not change backend ticket mode names.
- Do not change short-id prefix mapping.
- Do not change branch naming semantics.
- Do not change default backend behavior when mode is omitted.
- Do not combine this with the broader ticket lookup/json/help work.

## Non-Negotiable Invariants
- `hlx tickets create --mode BUILD ...` must create a Build ticket, producing the expected Build short-id prefix from the backend.
- `hlx tickets create --mode FIX ...` must create a Fix ticket.
- `hlx tickets create --mode RESEARCH ...` must create a Research ticket.
- `hlx tickets create --mode AUTO ...` must create an Auto ticket.
- `hlx tickets create --mode EXECUTE ...` must pass `EXECUTE` to the backend and let the backend enforce platform restrictions.
- Invalid mode values must fail locally with a clear error before making the API call.
- Existing `hlx tickets create` calls without `--mode` must continue to work exactly as before.

## In Scope
- Add `--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>` to `hlx tickets create`.
- Include `mode` in the request body only when the flag is provided.
- Update CLI usage text for `tickets create`.
- Update create response handling if needed so it displays the server-returned mode and short id correctly.
- Add focused CLI tests or equivalent coverage for create body construction and mode validation.

## Out of Scope
- Changing ticket mode semantics in the server.
- Changing short-id prefix mapping.
- Changing branch naming.
- Adding mode selection to the UI.
- Adding ticket lookup by short id or numeric id.
- Adding JSON output or help handling beyond the specific `tickets create` usage text needed for this flag.

## Required Behavior
1. Parse optional `--mode` in `hlx tickets create`.
2. Accept exactly `AUTO`, `BUILD`, `FIX`, `RESEARCH`, and `EXECUTE`.
3. Treat mode values case-insensitively if that matches existing CLI style; normalize to uppercase before sending.
4. Reject invalid values with a clear error listing the allowed modes.
5. When `--mode` is provided, include `{ mode: <MODE> }` in the `POST /api/tickets` body.
6. When `--mode` is omitted, do not send a `mode` field.
7. Print the ticket mode in the success output if the API response includes it.
8. Fix create response typing/output so a valid server-created ticket does not print `Short ID: undefined` when the response omits `shortId` but includes enough fields to derive or fetch it.

## Failure Behavior
- Invalid `--mode` must fail before the API call.
- If the backend rejects `EXECUTE` because the current organization is not NetSuite, surface the backend error clearly.
- If the backend response lacks `shortId`, do not print `Short ID: undefined`; print a clear fallback or fetch/display the created ticket details.
- Do not silently convert invalid values to `AUTO`.

## Batch / Cardinality Rules
- `hlx tickets create` creates exactly one ticket per command invocation.
- The selected mode applies only to that created ticket.
- Do not reuse a prior command's mode or global state as a default.

## Persistence / Artifact Rules
- Do not persist the selected mode in local CLI config.
- Do not create local files for this feature.
- The only persistence is the ticket created by the backend API.

## Acceptance Criteria
1. `hlx tickets create --mode BUILD --title ... --description ... --repos ...` sends `mode: BUILD` to the API.
2. `hlx tickets create --mode FIX ...` sends `mode: FIX` to the API.
3. `hlx tickets create --mode RESEARCH ...` sends `mode: RESEARCH` to the API.
4. `hlx tickets create --mode AUTO ...` sends `mode: AUTO` to the API.
5. `hlx tickets create --mode EXECUTE ...` sends `mode: EXECUTE` to the API and does not try to enforce platform rules locally beyond allowed-value validation.
6. `hlx tickets create` without `--mode` sends no `mode` field and preserves current behavior.
7. `hlx tickets create --mode banana ...` fails locally with a clear allowed-values message and makes no API request.
8. Success output includes the mode when available.
9. Success output never prints `Short ID: undefined`.
10. Usage text documents the new `--mode` flag and allowed values.

## Attachments
- (none)

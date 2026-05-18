# Tech Research — Peer Approval Status Visibility (helix-cli)

**Ticket**: FIX-468 — Peer Approval status

## Technology Foundation

- **Runtime**: Node.js, TypeScript
- **Build**: `tsc` (plain TypeScript compilation)
- **Test**: `tsx --test` / `node --test`
- **Display pattern**: Console.log with string padding for alignment
- **Types**: Locally defined in each command file (not shared types module)

## Architecture Decision

### AD1: How to display approval status in CLI output

**Options considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Blend into status column | When `approvalStatus === "PENDING"`, show `PENDING_APPROVAL` instead of `PREVIEW_READY` in the status column | Consistent with client approach; single status column | Changes the status string the user sees |
| B. Separate line/column for approval | Add `Approval: PENDING` as a new line in `get` and a new column in `list` | Keeps status pure; shows both dimensions | More verbose; wider output |
| C. Parenthetical suffix | Show `PREVIEW_READY (approval pending)` | Both dimensions visible | Wider; breaks fixed-width padding |

**Chosen**: Option B — Separate line/column for approval status.

**Rationale**: The CLI displays raw status values (e.g., `PREVIEW_READY`, not human-friendly labels). Users who pipe CLI output or use `--json` expect stable field names. Adding a separate `Approval:` line in `get` and a brief indicator in `list` preserves the existing status semantics while adding the new dimension. This matches the existing pattern where `mergeQueueStatus` is a separate line (get.ts lines 57-59). The `--json` flag already returns the full ticket object, so the new field appears naturally in JSON output.

## Core API/Methods

### Type changes

1. **`TicketDetail`** (get.ts lines 5-22): Add `approvalStatus?: string | null`.
2. **`TicketItem`** (list.ts lines 5-12): Add `approvalStatus?: string | null`.

### Display changes

3. **`printTicketDetail`** (get.ts lines 46-83): After the `mergeQueueStatus` conditional (line 57-59), add:
   ```
   if (ticket.approvalStatus) {
     console.log(`Approval:     ${ticket.approvalStatus}`);
   }
   ```

4. **`cmdTicketsList`** (list.ts line 105): Append a brief approval indicator when `approvalStatus` is present. For example, append ` [approval: PENDING]` after the status column, or blend into the padded status column.

## Technical Decisions

### TD1: Approval status displayed only when present

The `approvalStatus` field is optional. When `null` or `undefined`, no approval line is shown. This keeps output clean for orgs without peer approval enabled and for tickets without approval requests.

### TD2: No new CLI commands

Product spec and diagnosis both confirm: this ticket is about status visibility, not adding full CLI approval workflow commands (submit defense, approve, respond). Those are explicitly out of scope.

### TD3: JSON output includes raw field

The `--json` flag in both `get` and `list` outputs the full server response. The new `approvalStatus` field will appear in JSON output automatically since it's part of the server response. No additional JSON formatting needed.

## Cross-Platform Considerations

- **Server dependency**: CLI changes require the server to add `approvalStatus` to `GET /api/tickets` and `GET /api/tickets/:id` responses. The field is optional in the CLI types to handle version skew.
- **No backward compatibility risk**: The field is additive. Older server versions simply won't include it, and the CLI won't display it.

## Performance Expectations

- **No additional API calls**: Approval status piggybacks on existing ticket list/detail responses.
- **No compute overhead**: Simple conditional string formatting.

## Dependencies

| Dependency | Version | Purpose | Risk |
|------------|---------|---------|------|
| TypeScript | Existing | Type definitions | None |
| Node.js | Existing | Runtime | None |

No new dependencies introduced.

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Version skew: CLI updated before server | Low | None — field is optional; not displayed when absent | Optional typing |
| 2 | List output width increases | Low | Low — brief indicator | Keep indicator short (e.g., `[PENDING]`) |

## Deferred to Round 2

- Full CLI approval commands (submit defense, approve/reject).
- Color-coded approval status in CLI output (terminal colors).
- Approval status in `--json` with human-friendly labels option.

## Summary Table

| Aspect | Decision |
|--------|----------|
| Display strategy | Separate `Approval:` line in `get`; brief indicator in `list` |
| Type strategy | Optional `approvalStatus?: string \| null` on both TicketDetail and TicketItem |
| JSON output | Automatic — field included in server response |
| Files changed | `get.ts` (type + display), `list.ts` (type + display) |

## APL Statement Reference

CLI adds optional `approvalStatus` field to `TicketDetail` and `TicketItem` types. Displays approval status as a separate line in `hlx tickets get` and a brief indicator in `hlx tickets list`. No new CLI commands. Two files changed: get.ts and list.ts.

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Problem statement | Approval status must be visible in CLI |
| diagnosis/diagnosis-statement.md (CLI) | Root cause | CLI types and display lack approval fields |
| diagnosis/apl.json (CLI) | Structured diagnosis | No new CLI commands needed — scope is status visibility only |
| product/product.md | Product requirements | CLI shows approval line in get; approval indicator in list |
| scout/reference-map.json (CLI) | File map | get.ts and list.ts are change targets |
| scout/scout-summary.md (CLI) | Analysis | CLI types and display lack approval fields; depends on server API |
| get.ts (direct) | Detail display | Lines 5-22: TicketDetail type has no approval field; line 52: prints raw status; lines 57-59: mergeQueueStatus is separate line — same pattern for approval |
| list.ts (direct) | List display | Lines 5-12: TicketItem type has no approval field; line 105: prints padded status |
| repo-guidance.json | Repo intent | CLI is a target for display updates |

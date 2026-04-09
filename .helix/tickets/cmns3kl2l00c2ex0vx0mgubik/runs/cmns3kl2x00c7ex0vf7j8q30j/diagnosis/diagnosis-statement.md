# Diagnosis Statement — Side Quests (helix-cli)

## Problem Summary

The Helix CLI currently has no ticket lifecycle commands (only login, inspect, comments). For the Side Quests feature, agents running inside Vercel Sandbox could theoretically use a CLI command to create child tickets, but the recommended architecture handles side quest creation server-side within the orchestrator, making CLI changes optional.

## Root Cause Analysis

There is no "root cause" issue in the CLI — the gap is simply that ticket creation commands don't exist because they weren't needed before. The core side quest mechanism is orchestrator-driven (server parses step output and creates children), so the CLI is not on the critical path. A `hlx tickets create` command would be a convenience enhancement, not a requirement.

## Evidence Summary

| Evidence | Source | Significance |
|----------|--------|-------------|
| 3 commands only (login, inspect, comments) | src/index.ts | No ticket lifecycle commands exist |
| Subcommand dispatch pattern exists | src/comments/index.ts | Template for adding tickets subcommand |
| hxFetch HTTP client with auth | src/lib/http.ts | Ready for new API calls |
| HELIX_INSPECT_TOKEN for sandbox auth | src/lib/config.ts | May need elevated scope for ticket creation |

## Success Criteria

1. Core side quest mechanism works without CLI changes (server-side creation)
2. Optional: `hlx tickets create` command with --parent-ticket, --mode, --after flags
3. Optional: `hlx tickets status` command for checking side quest completion

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| ticket.md | Understand feature scope | CLI-based creation is one of two paths; server-side preferred |
| scout/reference-map.json (CLI) | Map command surface and extension points | Switch-case dispatcher extensible; 3 commands; auth via env vars |
| scout/scout-summary.md (CLI) | Evaluate CLI role | Two architectural paths; server-side recommended; CLI is optional enhancement |
| scout/scout-summary.md (server) | Understand primary mechanism | Orchestrator creates children server-side; CLI not required |

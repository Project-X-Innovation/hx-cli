# Diagnosis Statement — Walkthrough Feature (helix-cli)

## Problem Summary

The ticket proposes extending helix-cli as an alternative walkthrough delivery channel, allowing devs to review AI-generated changes in their coding agent (e.g., Claude Code). helix-cli currently has zero walkthrough capability — no commands, no data fetching, no rendering. This diagnosis assesses the extension surface and feasibility.

## Root Cause Analysis

The CLI has no walkthrough functionality because the original walkthrough design was web-only (client modal + server generation). The ticket author now recognizes that meeting developers where they work (CLI/coding agent) may be more effective than forcing them to a web dashboard.

The CLI's existing architecture (3 top-level commands, HTTP client, env-based context) provides clear extension patterns. A walkthrough command would follow the same structure as `comments` (subcommand router with data-fetching commands) or `inspect` (read-only data retrieval).

## Evidence Summary

| Evidence | Source | Finding |
|----------|--------|---------|
| No walkthrough command | src/index.ts (57 lines) | Only login, inspect, comments exist |
| Reusable patterns | src/comments/list.ts | --ticket flag with HELIX_TICKET_ID env fallback |
| HTTP client ready | src/lib/http.ts | Retry, backoff, 30s timeout — ready for new API calls |
| Server endpoints exist | Server routes/api.ts lines 189-190 | POST /walkthrough and POST /walkthrough/files already available |
| Quality gates | package.json | build (tsc), typecheck (tsc --noEmit). No lint or test scripts. |

## Success Criteria

- A `hlx walkthrough` command exists that retrieves and displays walkthrough data for a given ticket/run
- Output format is useful for both terminal reading and piping to coding agents
- The command integrates naturally with the existing CLI patterns (flags, env vars, authentication)

## Artifact Inputs Used

| Artifact | Why Used | Key Takeaway |
|----------|----------|--------------|
| scout/reference-map.json (CLI) | Map existing CLI structure | 3 commands, HTTP client, HELIX_TICKET_ID pattern |
| scout/scout-summary.md (CLI) | Understand extension points | comments pattern is closest analog for new walkthrough command |
| src/index.ts (source) | Verify command structure | Switch-based routing, easy to add new command |
| src/lib/http.ts (source) | Verify HTTP client capabilities | Ready for new server API calls |

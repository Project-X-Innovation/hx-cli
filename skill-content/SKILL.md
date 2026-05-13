---
name: hlx-cli
description: Operational guidance for AI agents using the Helix CLI (hlx) to inspect production systems, manage tickets, and interact with the Helix platform.
---

# hlx-cli Agent Skill

This skill provides operational guidance for AI agents working with the Helix CLI (`hlx`). It covers authentication, ticket management, production inspection, and common workflows.

## Guardrails

- **Read-only inspection**: Use `hlx inspect` commands for read-only production checks only. Do not create, update, or delete production records through inspection.
- **Authentication required**: Most commands require authentication. Run `hlx token add` or `hlx login` before using API-dependent commands.
- **No secrets in output**: Do not log or display full API keys. Use `hlx org list` which masks tokens automatically.
- **Respect org context**: Always verify the active org with `hlx org current` before running commands that target a specific organization.

## Environment Setup

The `hlx` CLI authenticates via one of two methods:

1. **Environment variables** (preferred for CI/automation):
   - `HELIX_API_KEY` — your Helix API key
   - `HELIX_URL` — the Helix server URL

2. **Config file** (interactive use):
   - Run `hlx login <server-url>` for browser-based OAuth login
   - Or `hlx token add --token <hxi_key> --url <server>` for direct token setup
   - Config is stored at `~/.hlx/config.json`

## Available Commands

| Command | Description |
|---------|-------------|
| `hlx login <server-url>` | Authenticate with a Helix server via browser |
| `hlx login --manual` | Paste API key manually |
| `hlx token add` | Add an API token directly |
| `hlx org current\|list\|switch` | Manage organization context |
| `hlx tickets list\|latest\|get` | Discover and inspect tickets |
| `hlx tickets create\|rerun\|continue` | Ticket lifecycle actions |
| `hlx tickets artifacts\|artifact` | Inspect step artifacts |
| `hlx tickets bundle <id> --out <dir>` | Bundle ticket for Codex |
| `hlx inspect repos` | List available repositories and inspection types |
| `hlx inspect db --repo <name> "<sql>"` | Run a read-only database query |
| `hlx inspect logs --repo <name> "<query>"` | Search application logs |
| `hlx inspect api --repo <name> <path>` | Make a read-only API inspection call |
| `hlx comments list` | List ticket comments |
| `hlx comments post <message>` | Post a comment to a ticket |
| `hlx library list` | List library items with ID, title, status, date |
| `hlx library show <ref>` | Show report with section headings annotated with [slug] and comment summaries |
| `hlx library comments list <ref> [--section <slug>]` | List comments grouped by section |
| `hlx library comments post <ref> --section <slug> --rating <value> [message]` | Post section rating with optional text |
| `hlx update` | Check for and apply CLI updates |
| `hlx skill show` | Print the bundled hlx-cli skill to stdout |
| `hlx skill install` | Install the skill to an agent's skills directory |

## Common Workflows

### Authentication

```bash
# Option 1: Environment variables
export HELIX_API_KEY=hxi_...
export HELIX_URL=https://your-helix-server.example.com

# Option 2: Interactive login
hlx login https://your-helix-server.example.com

# Option 3: Direct token
hlx token add --token hxi_... --url https://your-helix-server.example.com --name my-org --current
```

### Ticket Management

```bash
# List recent tickets
hlx tickets list

# Get the latest ticket
hlx tickets latest

# Get a specific ticket
hlx tickets get <ticket-id>

# View step artifacts
hlx tickets artifacts <ticket-id>
hlx tickets artifact <ticket-id> --step <step> --artifact <name>

# Create a new ticket
hlx tickets create --title "Fix login bug" --repo my-app

# Continue work on a ticket
hlx tickets continue <ticket-id>
```

### Production Inspection

```bash
# List available repos and inspection types
hlx inspect repos

# Run a database query
hlx inspect db --repo my-app "SELECT id, name FROM users LIMIT 10"
hlx inspect db --repo my-app --query "SELECT id FROM users LIMIT 5"
hlx inspect db --repo my-app --query-file complex-query.sql

# Search logs
hlx inspect logs --repo my-app "error" --limit 50

# API inspection
hlx inspect api --repo my-app /health
```

### Organization Management

```bash
# Check current org
hlx org current

# List all configured orgs
hlx org list

# Switch active org
hlx org switch <org-id-or-alias>
```

### Skill Installation

```bash
# Print skill content to stdout
hlx skill show

# Install to auto-detected agent skills directory
hlx skill install

# Install for a specific agent
hlx skill install --for claude
hlx skill install --for codex

# Install to a custom path
hlx skill install --target /path/to/skills

# Overwrite existing installation
hlx skill install --force
```

### Library Reports

```bash
# List all library items
hlx library list

# Show report with section annotations and comment summaries
hlx library show RSH-439

# List comments grouped by section
hlx library comments list RSH-439

# Filter comments by section
hlx library comments list RSH-439 --section key-findings

# Post a section rating
hlx library comments post RSH-439 --section key-findings --rating thumbs-up "Dive deeper into this"

# Post a thumbs-down rating
hlx library comments post RSH-439 --section market-overview --rating down "Totally extra"

# Post a love rating
hlx library comments post RSH-439 --section introduction --rating love

# Rating values: thumbs-up (up), thumbs-down (down), love
# Section accepts both raw slugs and heading text (auto-slugified)
```

## Flag Conventions

- All flags use `--long-name` format (e.g., `--repo`, `--ticket`, `--force`).
- Help is available on every command with `--help` or `-h`.
- Flags that take values use `--flag <value>` syntax (space-separated, not `=`).
- Boolean flags (e.g., `--force`, `--json`, `--current`) are presence-based.

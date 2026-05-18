export const cliDocsContent = {
  id: "helix-cli",
  title: "Helix CLI",
  content: `# Helix CLI

The Helix CLI (\`hlx\`) is the command-line interface for the Helix platform. It lets you manage tickets, inspect production systems, post comments, and keep the tool itself up to date — all from your terminal.

**Package:** \`@projectxinnovation/helix-cli\`
**Binary:** \`hlx\`

---

## Installation

Install the CLI globally from npm:

\`\`\`bash
npm install -g @projectxinnovation/helix-cli@latest
\`\`\`

After installation the \`hlx\` command is available system-wide.

---

## Setup & Authentication

### Browser Login (OAuth)

The default login flow opens your browser for OAuth authentication:

\`\`\`bash
hlx login <server-url>
\`\`\`

Replace \`<server-url>\` with the Helix server URL provided by your organization.

### Manual Login (API Key)

If a browser is unavailable (e.g. SSH sessions, CI), use manual mode:

\`\`\`bash
hlx login --manual
\`\`\`

You will be prompted for the server URL and an API key (\`hxi_...\`).

### Adding a Token Directly

You can also add a pre-existing API key without the interactive login flow:

\`\`\`bash
hlx token add --token <hxi_key> --url <server-url> --name <alias> --current
\`\`\`

| Flag | Required | Description |
|------|----------|-------------|
| \`--token\` | Yes | API key (must start with \`hxi_\`) |
| \`--url\` | Yes (first time) | Server URL. Optional if orgs already exist in config |
| \`--name\` | No | Human-friendly alias for this org |
| \`--current\` | No | Set this org as the active org (automatic if no current org exists) |

### Configuration

All authentication state is stored in \`~/.hlx/config.json\`. You can switch between organizations with:

\`\`\`bash
hlx org list       # Show all configured orgs
hlx org current    # Show the active org
hlx org switch     # Switch to a different org
\`\`\`

---

## Common Commands

### Tickets

| Command | Description |
|---------|-------------|
| \`hlx tickets list\` | List tickets with optional filters |
| \`hlx tickets get <ref>\` | Get a single ticket by ID, short ID (e.g. BLD-339), or number |
| \`hlx tickets create\` | Create a new ticket |
| \`hlx tickets artifacts <ref>\` | List artifacts for a ticket |
| \`hlx tickets continue <ref>\` | Continue a ticket with additional context |
| \`hlx tickets update-description <ref>\` | Update a ticket's description |

**\`hlx tickets list\` flags:**

| Flag | Description |
|------|-------------|
| \`--search <text>\` | Search tickets by title |
| \`--user <email-or-name>\` | Filter by reporter |
| \`--status <status>\` | Filter by status (e.g. IN_PROGRESS, COMPLETED) |
| \`--status-not-in <statuses>\` | Exclude comma-separated statuses |
| \`--archived\` | Include archived tickets |
| \`--sprint <id>\` | Filter by sprint ID |
| \`--json\` | Output results as JSON |

**\`hlx tickets create\` flags:**

| Flag | Description |
|------|-------------|
| \`--title <title>\` | Ticket title (required) |
| \`--description <text>\` | Literal description text |
| \`--description-file <path>\` | Read description from a file (mutually exclusive with \`--description\`) |
| \`--repos <name1,name2>\` | Target repositories, comma-separated (required) |
| \`--mode <mode>\` | Ticket mode: AUTO, BUILD, FIX, RESEARCH, or EXECUTE |
| \`--after <ticket-ref>\` | Create after another ticket (dependency chain) |
| \`--reference <ref1,ref2>\` | Reference related tickets, comma-separated (max 5) |
| \`--implement-from <ticket-ref>\` | Link to a completed research ticket |

**\`hlx tickets continue\` flags:**

| Flag | Description |
|------|-------------|
| \`--dry-run\` | Preview the continuation payload without starting a run |

**\`hlx tickets update-description\` flags:**

| Flag | Description |
|------|-------------|
| \`--file <path>\` | Read new description from a file |
| \`--text <string>\` | Literal new description (mutually exclusive with \`--file\`) |

**\`hlx tickets artifacts\` flags:**

| Flag | Description |
|------|-------------|
| \`--run <run-id>\` | Filter artifacts to a specific run |

### Inspect

| Command | Description |
|---------|-------------|
| \`hlx inspect repos\` | List all repositories and their available inspection types |
| \`hlx inspect db --repo <name> "<sql>"\` | Run a read-only database query |
| \`hlx inspect logs --repo <name> "<query>"\` | Search application logs |
| \`hlx inspect api --repo <name> <path>\` | Call a read-only API endpoint |

### Comments

| Command | Description |
|---------|-------------|
| \`hlx comments list\` | List comments on a ticket |
| \`hlx comments post\` | Post a comment to a ticket |

**\`hlx comments list\` flags:**

| Flag | Description |
|------|-------------|
| \`--ticket <id>\` | Ticket ID |
| \`--helix-only\` | Show only Helix-generated comments |
| \`--since <iso-date>\` | Only comments after this date |

**\`hlx comments post\` flags:**

| Flag | Description |
|------|-------------|
| \`--ticket <id>\` | Ticket ID |

### Update

| Command | Description |
|---------|-------------|
| \`hlx update\` | Check for and apply CLI updates |
| \`hlx update --enable-auto\` | Enable automatic update checks |
| \`hlx update --disable-auto\` | Disable automatic update checks |

---

## Worked Examples

### List tickets with filters

List all in-progress tickets as JSON:

\`\`\`bash
hlx tickets list --status IN_PROGRESS --json
\`\`\`

Search for tickets by title:

\`\`\`bash
hlx tickets list --search "migration"
\`\`\`

### Get a single ticket

Retrieve a ticket by its short ID in JSON format:

\`\`\`bash
hlx tickets get BLD-339 --json
\`\`\`

You can also use the full internal ID or just the number (\`339\`).

### Create a ticket with a description file

\`\`\`bash
hlx tickets create --title "Migrate user schema" --description-file ./desc.md --repos my-repo --mode BUILD
\`\`\`

This reads the description from \`./desc.md\` instead of passing it inline. The \`--mode\` flag accepts: AUTO, BUILD, FIX, RESEARCH, or EXECUTE.

### Create a ticket with a dependency

\`\`\`bash
hlx tickets create --title "Build API endpoints" --after RSH-490 --repos my-app --description "Implement REST endpoints after schema is ready"
\`\`\`

The ticket starts as WAITING until the predecessor (RSH-490) completes, then transitions to QUEUED automatically.

### Create a ticket with cross-references

\`\`\`bash
hlx tickets create --title "Update API docs" --reference RSH-490,RSH-491 --repos my-app --description "Update docs to reflect new endpoints"
\`\`\`

References are informational only and do not affect ticket scheduling.

### Create an implementation from a research ticket

\`\`\`bash
hlx tickets create --title "Implement caching" --implement-from RSH-485 --repos my-app --description "Implement caching based on research findings"
\`\`\`

The \`--implement-from\` flag requires a RESEARCH mode ticket with REPORT_READY status.

### View ticket relationships

\`\`\`bash
hlx tickets get RSH-501
\`\`\`

When a ticket has relationships, the detail view shows "Depends on", "Implements", and/or "References" lines with the related ticket's short ID, title, and status.

### View artifacts for a specific run

\`\`\`bash
hlx tickets artifacts BLD-339 --run <run-id>
\`\`\`

Omit \`--run\` to see artifacts across all runs.

### Inspect repositories

List all repositories with their available inspection types:

\`\`\`bash
hlx inspect repos
\`\`\`

### Post a comment on a ticket

\`\`\`bash
hlx comments post --ticket BLD-339 "Deployment verified in staging"
\`\`\`

### Update a ticket description from a file

\`\`\`bash
hlx tickets update-description BLD-339 --file ./updated.md
\`\`\`

### Continue a ticket with a dry run

Preview what would be sent before starting a new run:

\`\`\`bash
hlx tickets continue BLD-339 "Add error handling for edge cases" --dry-run
\`\`\`

---

## Updating

To update the CLI to the latest version:

\`\`\`bash
hlx update
\`\`\`

This checks npm for the latest published version and applies the update automatically.

You can also enable or disable automatic update checks:

\`\`\`bash
hlx update --enable-auto    # Check for updates on every command
hlx update --disable-auto   # Turn off automatic checks
\`\`\`

---

## Troubleshooting

### Stale Symlink After Update

If \`hlx\` stops working after an update (e.g. "command not found" or "module not found" errors), the global npm symlink may be stale. Fix it with a clean reinstall:

\`\`\`bash
npm install -g @projectxinnovation/helix-cli@latest
\`\`\`

### Authentication Issues

If commands fail with authentication errors, verify your configuration:

\`\`\`bash
hlx org current    # Check which org is active
hlx org list       # List all configured orgs
\`\`\`

To re-authenticate, run \`hlx login <server-url>\` again.

### Configuration Location

All CLI configuration is stored at:

\`\`\`
~/.hlx/config.json
\`\`\`

This file contains your authentication tokens and organization settings. If you need to start fresh, you can delete this file and run \`hlx login\` again.
`,
  order: 2,
  keywords: [
    "cli",
    "hlx",
    "command line",
    "terminal",
    "install",
    "setup",
    "authentication",
    "login",
    "tickets",
    "inspect",
    "comments",
    "update",
    "troubleshooting",
    "npm",
    "helix-cli",
    "artifacts",
    "token",
    "org",
  ],
};

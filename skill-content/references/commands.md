# hlx Command Reference

Detailed reference for all `hlx` CLI commands, flags, and usage patterns.

## hlx login

Authenticate with a Helix server.

```
hlx login <server-url>          Open browser for OAuth login
hlx login --manual               Paste API key manually
```

## hlx token add

Add an API token directly without browser-based login.

```
hlx token add --token <hxi_key> [--url <server>] [--name <alias>] [--current]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--token` | Yes | The API key (hxi_...) |
| `--url` | No | Server URL (uses default if omitted) |
| `--name` | No | Alias for the org entry |
| `--current` | No | Set this org as the active one |

## hlx org

Manage organization context. Multi-org setups use `org switch` to change the active org.

```
hlx org current                  Show active organization
hlx org list                     List all configured orgs (tokens are masked)
hlx org switch <org-id-or-alias> Switch to a different org
```

## hlx tickets

Discover, inspect, and manage tickets.

### Read Commands

```
hlx tickets list [--limit N]                List recent tickets
hlx tickets latest                          Show the most recent ticket
hlx tickets get <ticket-id>                 Get details for a specific ticket
hlx tickets artifacts <ticket-id>           List step artifacts for a ticket
hlx tickets artifact <ticket-id> --step <step> --artifact <name>  View a specific artifact
```

### Action Commands

```
hlx tickets create --title <title> --repo <repo> [--description <desc>]
hlx tickets rerun <ticket-id>
hlx tickets continue <ticket-id>
hlx tickets bundle <ticket-id> --out <dir>
```

## hlx inspect

Read-only production inspection for databases, logs, and APIs.

```
hlx inspect repos                                    List repos and available inspection types
hlx inspect db --repo <name> "<sql>"                 Run SQL query (positional)
hlx inspect db --repo <name> --query "<sql>"         Run SQL query (flag, recommended)
hlx inspect db --repo <name> --query-file <path>     Run SQL from file
hlx inspect logs --repo <name> "<query>" [--limit N] Search logs
hlx inspect api --repo <name> <path>                 API GET request
```

### SQL Quoting Tips

- **Bash/Zsh**: Use single quotes around the query value.
- **PowerShell 7**: Use single quotes around `--query` value.
- **PowerShell 5.1**: Use double quotes with backtick-escaped inner quotes.
- **Any shell**: Use `--query-file` with a `.sql` file to avoid quoting issues entirely.

## hlx comments

Post and list ticket comments.

```
hlx comments list [--ticket <id>] [--helix-only] [--since <iso-date>]
hlx comments post [--ticket <id>] <message>
```

## hlx update

Check for and apply CLI updates from npm.

```
hlx update                       Check for updates and apply if available
hlx update --enable-auto         Enable automatic update checks
hlx update --disable-auto        Disable automatic update checks
```

## hlx skill

Access the bundled hlx-cli agent skill.

```
hlx skill show                              Print skill content to stdout
hlx skill install [--target <path>]         Install to a specific directory
hlx skill install [--for <claude|codex>]    Install for a specific agent
hlx skill install [--force]                 Overwrite existing installation
```

### Install Behavior

- With no flags: auto-detects `~/.claude/skills/` or `~/.codex/skills/`. If exactly one exists, installs there. If both exist, requires `--for`. If neither exists, requires `--target`.
- `--target <path>`: Installs to `<path>/hlx-cli/`, ignoring auto-detection.
- `--for <claude|codex>`: Installs to the canonical skills directory for that agent.
- `--force`: Allows overwriting an existing installation. Without this flag, install refuses to overwrite.

## hlx --version

Print the installed CLI version.

```
hlx --version
hlx -v
```

# @projectxinnovation/helix-cli

CLI for Helix production inspection, comments, and artifact retrieval.

## Installation

```bash
npm install -g @projectxinnovation/helix-cli
```

Requires **Node.js >= 18**.

## Authentication

### Browser Login (OAuth)

```bash
hlx login https://your-helix-server.com
```

Opens a browser window for OAuth authentication. On success, credentials are saved to `~/.hlx/config.json`.

### Manual Login

```bash
hlx login --manual
```

Paste your API key (`hxi_...`) and server URL when prompted. Credentials are saved to `~/.hlx/config.json`.

### Environment Variables

Environment variables take priority over the config file. Set the following to authenticate without `hlx login`:

| Variable | Description |
|---|---|
| `HELIX_API_KEY` | API key (primary) |
| `HELIX_INSPECT_TOKEN` | API key (alias) |
| `HELIX_INSPECT_API_KEY` | API key (alias) |
| `HELIX_URL` | Helix server URL (primary) |
| `HELIX_INSPECT_BASE_URL` | Server URL (alias) |
| `HELIX_INSPECT_URL` | Server URL (alias) |

The CLI checks for API key and URL in the order listed above. The first match wins.

### Config File

`~/.hlx/config.json` stores credentials from `hlx login`:

```json
{
  "apiKey": "hxi_...",
  "url": "https://your-helix-server.com"
}
```

## Command Reference

### `hlx login`

Authenticate with a Helix server.

```bash
hlx login <server-url>       # OAuth browser flow
hlx login --manual            # Paste API key manually
```

### `hlx inspect`

Inspect production databases, logs, APIs, and repositories.

```bash
hlx inspect repos                              # List repositories
hlx inspect db --repo <name> "<sql>"            # Run a database query
hlx inspect logs --repo <name> "<query>"        # Search logs
hlx inspect api --repo <name> <path>            # Call an API endpoint
```

### `hlx comments`

List and post comments on Helix tickets.

```bash
hlx comments list --ticket <id>                 # List comments on a ticket
hlx comments list --ticket <id> --helix-only    # Only Helix-tagged comments
hlx comments list --ticket <id> --since 2025-01-01T00:00:00Z
hlx comments post --ticket <id> "Your message"  # Post a comment
```

The `--ticket` flag can be omitted if the `HELIX_TICKET_ID` environment variable is set.

### `hlx artifacts`

List and retrieve artifacts for Helix tickets and runs.

```bash
hlx artifacts ticket <ticket-id>                # List artifacts for a ticket
hlx artifacts ticket <ticket-id> --run <run-id> # Filter by run ID
hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>
                                                 # Retrieve step artifacts
```

### `hlx --version`

Print the CLI version.

```bash
hlx --version
```

## Artifact Retrieval

### Listing Artifacts for a Ticket

```bash
hlx artifacts ticket <ticket-id>
```

Lists all artifacts associated with a ticket, including:
- Repository labels, run IDs, branches, and URLs
- Available step artifacts by step ID and repo key

Optionally filter by a specific run:

```bash
hlx artifacts ticket <ticket-id> --run <run-id>
```

### Retrieving Step Artifacts

```bash
hlx artifacts run <run-id> --ticket <ticket-id> --step <step-id> --repo-key <repo-key>
```

Retrieves and prints the content of step-level artifacts. All flags are required:

| Flag | Description |
|---|---|
| `--ticket <id>` | Ticket ID (or set `HELIX_TICKET_ID` env var) |
| `--step <id>` | Step ID (e.g., `scout`, `diagnosis`, `implementation`) |
| `--repo-key <key>` | Repository key |

Example:

```bash
hlx artifacts run cmoepuyrl005b --ticket cmoaat2ig007t --step implementation --repo-key helix-cli
```

The command prints each artifact file's name, content type, and raw content directly to stdout.

### Error Handling

- **No credentials**: The CLI exits with a clear message directing you to run `hlx login` or set environment variables.
- **No artifacts found**: Prints `"No artifacts found for this ticket."` or `"No step artifacts found."`.
- **Missing required flags**: Prints a usage error indicating which flags are required.

## Publishing Setup (Maintainers)

The repository includes a GitHub Actions workflow (`.github/workflows/publish.yml`) that automatically publishes to npm when a push to `main` includes a version change in `package.json`.

### How It Works

1. On every push to `main`, the workflow runs `npm ci`, `npm run build`, and `npm run typecheck`.
2. It compares the local `package.json` version to the currently published version on npm.
3. If the version has changed, it publishes the package with `npm publish --access public`.
4. If the version is unchanged, publish is skipped.
5. The `prepublishOnly` script ensures `dist/` is built before any publish.

### npm Setup

1. Log into [npmjs.com](https://www.npmjs.com) with an account that has publish rights to the `@projectxinnovation` scope.
2. Navigate to **Settings** > **Access Tokens** > **Generate New Token**.
3. Choose **Automation** token type (Classic). This bypasses org-level 2FA requirements for CI use.
   - Alternative: Use a **Granular Access Token** scoped to `@projectxinnovation/helix-cli` with **Read and Write** permissions.
4. Copy the generated token value.

### GitHub Repository Setup

1. Navigate to the `helix-cli` repository on GitHub.
2. Go to **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Set:
   - **Name**: `NPM_TOKEN`
   - **Value**: The npm access token from the previous step.
5. Click **Add secret**.

### Required Secrets Summary

| Secret | Where | Setup |
|---|---|---|
| `NPM_TOKEN` | GitHub repository secret | Manual — follow npm + GitHub steps above |
| `GITHUB_TOKEN` | GitHub Actions (automatic) | No setup needed — provided automatically by GitHub |

### Releasing a New Version

1. Update the `version` field in `package.json`.
2. Commit and push to `main`.
3. The workflow detects the version change and publishes automatically.

## License

MIT

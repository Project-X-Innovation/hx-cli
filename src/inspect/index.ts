import type { HxConfig } from "../lib/config.js";
import { getFlag, getPositionalArgs, isHelpRequested } from "../lib/flags.js";
import { cmdRepos } from "./repos.js";
import { cmdDb } from "./db.js";
import { cmdLogs } from "./logs.js";
import { cmdApi } from "./api.js";

function inspectUsage(exitCode: number = 1): never {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Usage:
  hlx inspect repos
  hlx inspect db --repo <name> "<sql>"
  hlx inspect db --repo <name> --query "<sql>"
  hlx inspect logs --repo <name> "<query>" [--limit N]
  hlx inspect api --repo <name> <path>

The --query flag is an alternative to positional SQL for inspect db.
This is useful in PowerShell where double-quoted Postgres identifiers
cause quoting issues:

  # PowerShell-safe example:
  hlx inspect db --repo my-app --query 'SELECT * FROM "Tickets" LIMIT 5'`);
  process.exit(exitCode);
}

export async function runInspect(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    inspectUsage(0);
  }

  switch (subcommand) {
    case "repos":
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx inspect repos");
        process.exit(0);
      }
      await cmdRepos(config);
      break;

    case "db": {
      if (isHelpRequested(rest)) {
        console.log(`Usage: hlx inspect db --repo <name> "<sql>"
       hlx inspect db --repo <name> --query "<sql>"

The --query flag is an alternative to positional SQL arguments.
This is useful in PowerShell where double-quoted Postgres identifiers
cause quoting issues:

  # PowerShell-safe example:
  hlx inspect db --repo my-app --query 'SELECT * FROM "Tickets" LIMIT 5'`);
        process.exit(0);
      }
      const repo = getFlag(rest, "--repo");
      const queryFlag = getFlag(rest, "--query");
      const positional = getPositionalArgs(rest, ["--repo", "--query"]);
      const query = queryFlag ?? positional.join(" ");
      if (!repo || !query) { console.error("Error: --repo and a SQL query are required."); inspectUsage(); }
      await cmdDb(config, repo, query);
      break;
    }

    case "logs": {
      if (isHelpRequested(rest)) {
        console.log('Usage: hlx inspect logs --repo <name> "<query>" [--limit N]');
        process.exit(0);
      }
      const repo = getFlag(rest, "--repo");
      const limit = getFlag(rest, "--limit");
      const positional = getPositionalArgs(rest, ["--repo", "--limit"]);
      const query = positional.join(" ");
      if (!repo || !query) { console.error("Error: --repo and a query are required."); inspectUsage(); }
      await cmdLogs(config, repo, query, limit ? parseInt(limit, 10) : undefined);
      break;
    }

    case "api": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx inspect api --repo <name> <path>");
        process.exit(0);
      }
      const repo = getFlag(rest, "--repo");
      const positional = getPositionalArgs(rest, ["--repo"]);
      const path = positional[0];
      if (!repo || !path) { console.error("Error: --repo and a path are required."); inspectUsage(); }
      await cmdApi(config, repo, path);
      break;
    }

    default:
      if (isHelpRequested(rest)) {
        inspectUsage(0);
      }
      if (subcommand) console.error(`Unknown inspect command: ${subcommand}`);
      inspectUsage();
  }
}

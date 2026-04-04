import type { HxConfig } from "../lib/config.js";
import { cmdRepos } from "./repos.js";
import { cmdDb } from "./db.js";
import { cmdLogs } from "./logs.js";
import { cmdApi } from "./api.js";

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function getPositionalArgs(args: string[], excludeFlags: string[]): string[] {
  const flagValues = new Set<string>();
  for (const flag of excludeFlags) {
    const val = getFlag(args, flag);
    if (val) flagValues.add(val);
  }
  return args.filter((a) => !a.startsWith("--") && !flagValues.has(a));
}

function inspectUsage(): never {
  console.error(`Usage:
  hlx inspect repos
  hlx inspect db --repo <name> "<sql>"
  hlx inspect logs --repo <name> "<query>" [--limit N]
  hlx inspect api --repo <name> <path>`);
  process.exit(1);
}

export async function runInspect(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "repos":
      await cmdRepos(config);
      break;

    case "db": {
      const repo = getFlag(rest, "--repo");
      const positional = getPositionalArgs(rest, ["--repo"]);
      const query = positional.join(" ");
      if (!repo || !query) { console.error("Error: --repo and a SQL query are required."); inspectUsage(); }
      await cmdDb(config, repo, query);
      break;
    }

    case "logs": {
      const repo = getFlag(rest, "--repo");
      const limit = getFlag(rest, "--limit");
      const positional = getPositionalArgs(rest, ["--repo", "--limit"]);
      const query = positional.join(" ");
      if (!repo || !query) { console.error("Error: --repo and a query are required."); inspectUsage(); }
      await cmdLogs(config, repo, query, limit ? parseInt(limit, 10) : undefined);
      break;
    }

    case "api": {
      const repo = getFlag(rest, "--repo");
      const positional = getPositionalArgs(rest, ["--repo"]);
      const path = positional[0];
      if (!repo || !path) { console.error("Error: --repo and a path are required."); inspectUsage(); }
      await cmdApi(config, repo, path);
      break;
    }

    default:
      if (subcommand) console.error(`Unknown inspect command: ${subcommand}`);
      inspectUsage();
  }
}

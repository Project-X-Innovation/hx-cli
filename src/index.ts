#!/usr/bin/env node

import { requireConfig, loadConfig } from "./lib/config.js";
import { isHelpRequested } from "./lib/flags.js";
import { runComments } from "./comments/index.js";
import { runInspect } from "./inspect/index.js";
import { runLogin } from "./login.js";
import { runOrg } from "./org/index.js";
import { runToken } from "./token/index.js";
import { runTickets } from "./tickets/index.js";
import { getPackageVersion } from "./update/version.js";
import { runUpdate, checkAutoUpdate } from "./update/index.js";

const args = process.argv.slice(2);
const command = args[0];

/**
 * Get config, but allow help requests to proceed without authentication.
 * For help-only invocations, provides a stub config so the router can
 * intercept --help before any API calls.
 */
function configOrHelp(subArgs: string[]) {
  if (isHelpRequested(subArgs) || subArgs.length === 0) {
    // Try loading config, but don't fail — help should always work
    const config = loadConfig();
    if (config) return config;
    // Return stub config; the router will exit for help before any API call
    return { apiKey: "", url: "" };
  }
  return requireConfig();
}

function usage(exitCode: number = 1): never {
  console.error(`hlx — Helix CLI workbench

Usage:
  hlx login <server-url>          Authenticate with a Helix server
  hlx login --manual              Paste API key manually
  hlx token add --token <key> [--url <server>] [--name <alias>] [--current]
  hlx org current|list|switch     Manage org context
  hlx tickets list|latest|get     Discover and inspect tickets
  hlx tickets create|rerun|continue  Ticket actions
  hlx tickets artifacts|artifact  Inspect step artifacts
  hlx tickets bundle <id> --out <dir>  Bundle for Codex
  hlx inspect repos               List repositories and inspection types
  hlx inspect db --repo <name> "<sql>"
  hlx inspect logs --repo <name> "<query>"
  hlx inspect api --repo <name> <path>
  hlx comments list [--ticket <id>] [--helix-only] [--since <iso-date>]
  hlx comments post [--ticket <id>] <message>
  hlx update                    Check for and apply updates from GitHub main
  hlx update --enable-auto      Enable automatic update checks
  hlx update --disable-auto     Disable automatic update checks
  hlx --version                 Show version`);

  process.exit(exitCode);
}

// Commands that skip the auto-update check
const SKIP_AUTO_UPDATE = new Set(["--version", "-v", "update", "--help", "-h"]);

try {
  // Run auto-update check before command dispatch (unless skipped)
  if (!SKIP_AUTO_UPDATE.has(command)) {
    await checkAutoUpdate();
  }

  switch (command) {
    case "login":
      await runLogin(args.slice(1));
      break;

    case "token":
      await runToken(args.slice(1));
      break;

    case "inspect": {
      const config = configOrHelp(args.slice(1));
      await runInspect(config, args.slice(1));
      break;
    }

    case "comments": {
      const config = configOrHelp(args.slice(1));
      await runComments(config, args.slice(1));
      break;
    }

    case "org":
      await runOrg(args.slice(1));
      break;

    case "tickets": {
      const config = configOrHelp(args.slice(1));
      await runTickets(config, args.slice(1));
      break;
    }

    case "update":
      await runUpdate(args.slice(1));
      break;

    case "--version":
    case "-v":
      console.log(getPackageVersion());
      break;

    case "--help":
    case "-h":
      usage(0);
      break;

    default:
      if (command) console.error(`Unknown command: ${command}`);
      usage();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

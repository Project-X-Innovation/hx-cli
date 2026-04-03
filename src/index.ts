#!/usr/bin/env node

import { requireConfig } from "./lib/config.js";
import { runInspect } from "./inspect/index.js";
import { runLogin } from "./login.js";

const args = process.argv.slice(2);
const command = args[0];

function usage(): never {
  console.error(`hx — Helix CLI for production inspection

Usage:
  hx login <server-url>       Authenticate with a Helix server
  hx login --manual           Paste API key manually
  hx inspect repos             List repositories and inspection types
  hx inspect db --repo <name> "<sql>"
  hx inspect logs --repo <name> "<query>"
  hx inspect api --repo <name> <path>
  hx --version                 Show version`);
  process.exit(1);
}

switch (command) {
  case "login":
    await runLogin(args.slice(1));
    break;

  case "inspect": {
    const config = requireConfig();
    await runInspect(config, args.slice(1));
    break;
  }

  case "--version":
  case "-v":
    console.log("0.1.0");
    break;

  default:
    if (command) console.error(`Unknown command: ${command}`);
    usage();
}

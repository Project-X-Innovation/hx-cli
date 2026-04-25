#!/usr/bin/env node

import { createRequire } from "node:module";
import { requireConfig } from "./lib/config.js";
import { runComments } from "./comments/index.js";
import { runInspect } from "./inspect/index.js";
import { runLogin } from "./login.js";
import { runArtifacts } from "./artifacts/index.js";

const require = createRequire(import.meta.url);
const pkgVersion = (require("../package.json") as { version: string }).version;

const args = process.argv.slice(2);
const command = args[0];

function usage(): never {
  console.error(`hlx — Helix CLI for production inspection

Usage:
  hlx login <server-url>       Authenticate with a Helix server
  hlx login --manual           Paste API key manually
  hlx inspect repos             List repositories and inspection types
  hlx inspect db --repo <name> "<sql>"
  hlx inspect logs --repo <name> "<query>"
  hlx inspect api --repo <name> <path>
  hlx comments list [--ticket <id>] [--helix-only] [--since <iso-date>]
  hlx comments post [--ticket <id>] <message>
  hlx artifacts ticket <ticket-id>
                                List artifacts for a ticket
  hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>
                                Retrieve step artifacts for a run
  hlx --version                 Show version`);
  process.exit(1);
}

try {
  switch (command) {
    case "login":
      await runLogin(args.slice(1));
      break;

    case "inspect": {
      const config = requireConfig();
      await runInspect(config, args.slice(1));
      break;
    }

    case "comments": {
      const config = requireConfig();
      await runComments(config, args.slice(1));
      break;
    }

    case "artifacts": {
      const config = requireConfig();
      await runArtifacts(config, args.slice(1));
      break;
    }

    case "--version":
    case "-v":
      console.log(pkgVersion);
      break;

    default:
      if (command) console.error(`Unknown command: ${command}`);
      usage();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

import type { HxConfig } from "../lib/config.js";
import { getFlag } from "../lib/flags.js";
import { cmdTicketsList } from "./list.js";
import { cmdTicketsLatest } from "./latest.js";
import { cmdTicketsGet } from "./get.js";
import { cmdTicketsCreate } from "./create.js";
import { cmdTicketsRerun } from "./rerun.js";
import { cmdTicketsContinue } from "./continue.js";
import { cmdTicketsArtifacts } from "./artifacts.js";
import { cmdTicketsArtifact } from "./artifact.js";
import { cmdTicketsBundle } from "./bundle.js";

function resolveTicketId(args: string[]): string {
  const flagValue = getFlag(args, "--ticket");
  if (flagValue) return flagValue;

  const envValue = process.env.HELIX_TICKET_ID;
  if (envValue) return envValue;

  // Try first positional arg (non-flag)
  const positional = args.find((a) => !a.startsWith("--"));
  if (positional) return positional;

  console.error("Error: No ticket ID provided. Use --ticket <id>, set HELIX_TICKET_ID, or pass as positional arg.");
  process.exit(1);
}

function ticketsUsage(): never {
  console.error(`Usage:
  hlx tickets list [--user <email>] [--status <status>] [--status-not-in <s1,s2>] [--archived] [--sprint <id>]
  hlx tickets latest [--status-not-in <s1,s2>] [--archived] [--sprint <id>]
  hlx tickets get <ticket-id>
  hlx tickets create --title <title> --description <desc> --repos <repo1,repo2>
  hlx tickets rerun <ticket-id>
  hlx tickets continue <ticket-id> "continuation context"
  hlx tickets artifacts <ticket-id>
  hlx tickets artifact <ticket-id> --step <stepId> --repo <repoKey> [--run <runId>]
  hlx tickets bundle <ticket-id> --out <dir>`);
  process.exit(1);
}

export async function runTickets(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "list":
      await cmdTicketsList(config, rest);
      break;

    case "latest":
      await cmdTicketsLatest(config, rest);
      break;

    case "get": {
      const ticketId = resolveTicketId(rest);
      await cmdTicketsGet(config, ticketId);
      break;
    }

    case "create":
      await cmdTicketsCreate(config, rest);
      break;

    case "rerun": {
      const ticketId = resolveTicketId(rest);
      await cmdTicketsRerun(config, ticketId);
      break;
    }

    case "continue": {
      const ticketId = resolveTicketId(rest);
      await cmdTicketsContinue(config, ticketId, rest);
      break;
    }

    case "artifacts": {
      const ticketId = resolveTicketId(rest);
      await cmdTicketsArtifacts(config, ticketId);
      break;
    }

    case "artifact": {
      const ticketId = resolveTicketId(rest);
      await cmdTicketsArtifact(config, ticketId, rest);
      break;
    }

    case "bundle": {
      const ticketId = resolveTicketId(rest);
      await cmdTicketsBundle(config, ticketId, rest);
      break;
    }

    default:
      if (subcommand) console.error(`Unknown tickets command: ${subcommand}`);
      ticketsUsage();
  }
}

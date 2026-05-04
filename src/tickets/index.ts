import type { HxConfig } from "../lib/config.js";
import { isHelpRequested } from "../lib/flags.js";
import { extractTicketRef, resolveTicket } from "../lib/resolve-ticket.js";
import { cmdTicketsList } from "./list.js";
import { cmdTicketsLatest } from "./latest.js";
import { cmdTicketsGet } from "./get.js";
import { cmdTicketsCreate } from "./create.js";
import { cmdTicketsRerun } from "./rerun.js";
import { cmdTicketsContinue } from "./continue.js";
import { cmdTicketsArtifacts } from "./artifacts.js";
import { cmdTicketsArtifact } from "./artifact.js";
import { cmdTicketsBundle } from "./bundle.js";

function ticketsUsage(exitCode: number = 1): never {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Usage:
  hlx tickets list [--user <email>] [--status <status>] [--status-not-in <s1,s2>] [--archived] [--sprint <id>] [--json]
  hlx tickets latest [--status-not-in <s1,s2>] [--archived] [--sprint <id>]
  hlx tickets get <ticket-ref> [--json]
  hlx tickets create --title <title> --description <desc> --repos <repo1,repo2> [--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>]
  hlx tickets rerun <ticket-ref>
  hlx tickets continue <ticket-ref> "continuation context"
  hlx tickets artifacts <ticket-ref> [--run <runId>]
  hlx tickets artifact <ticket-ref> --step <stepId> --repo <repoKey> [--run <runId>]
  hlx tickets bundle <ticket-ref> --out <dir>

Ticket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).`);
  process.exit(exitCode);
}

export async function runTickets(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    ticketsUsage(0);
  }

  switch (subcommand) {
    case "list":
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx tickets list [--user <email>] [--status <status>] [--status-not-in <s1,s2>] [--archived] [--sprint <id>] [--json]");
        process.exit(0);
      }
      await cmdTicketsList(config, rest);
      break;

    case "latest":
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx tickets latest [--status-not-in <s1,s2>] [--archived] [--sprint <id>]");
        process.exit(0);
      }
      await cmdTicketsLatest(config, rest);
      break;

    case "get": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx tickets get <ticket-ref> [--json]\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
        process.exit(0);
      }
      const rawRef = extractTicketRef(rest);
      const resolved = await resolveTicket(config, rawRef);
      await cmdTicketsGet(config, resolved.id, rest);
      break;
    }

    case "create":
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx tickets create --title <title> --description <desc> --repos <repo1,repo2> [--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>]");
        process.exit(0);
      }
      await cmdTicketsCreate(config, rest);
      break;

    case "rerun": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx tickets rerun <ticket-ref>\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
        process.exit(0);
      }
      const rawRef = extractTicketRef(rest);
      const resolved = await resolveTicket(config, rawRef);
      await cmdTicketsRerun(config, resolved.id);
      break;
    }

    case "continue": {
      if (isHelpRequested(rest)) {
        console.log('Usage: hlx tickets continue <ticket-ref> "continuation context"\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).');
        process.exit(0);
      }
      const rawRef = extractTicketRef(rest);
      const resolved = await resolveTicket(config, rawRef);
      await cmdTicketsContinue(config, resolved.id, rest, rawRef);
      break;
    }

    case "artifacts": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx tickets artifacts <ticket-ref> [--run <runId>]\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
        process.exit(0);
      }
      const rawRef = extractTicketRef(rest);
      const resolved = await resolveTicket(config, rawRef);
      await cmdTicketsArtifacts(config, resolved.id, rest);
      break;
    }

    case "artifact": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx tickets artifact <ticket-ref> --step <stepId> --repo <repoKey> [--run <runId>]\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
        process.exit(0);
      }
      const rawRef = extractTicketRef(rest);
      const resolved = await resolveTicket(config, rawRef);
      await cmdTicketsArtifact(config, resolved.id, rest);
      break;
    }

    case "bundle": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx tickets bundle <ticket-ref> --out <dir>\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
        process.exit(0);
      }
      const rawRef = extractTicketRef(rest);
      const resolved = await resolveTicket(config, rawRef);
      await cmdTicketsBundle(config, resolved.id, rest);
      break;
    }

    default:
      if (subcommand) console.error(`Unknown tickets command: ${subcommand}`);
      ticketsUsage();
  }
}

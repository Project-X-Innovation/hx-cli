import type { HxConfig } from "../lib/config.js";
import { isHelpRequested } from "../lib/flags.js";
import { extractTicketRef, resolveTicket } from "../lib/resolve-ticket.js";
import { cmdList } from "./list.js";
import { cmdPost } from "./post.js";

function commentsUsage(exitCode: number = 1): never {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Usage:
  hlx comments list [--ticket <ref>] [--helix-only] [--since <iso-date>]
  hlx comments post [--ticket <ref>] <message>

Ticket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).`);
  process.exit(exitCode);
}

export async function runComments(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    commentsUsage(0);
  }

  switch (subcommand) {
    case "list": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx comments list [--ticket <ref>] [--helix-only] [--since <iso-date>]");
        process.exit(0);
      }
      const rawRef = extractTicketRef(rest);
      const resolved = await resolveTicket(config, rawRef);
      await cmdList(config, resolved.id, rest);
      break;
    }

    case "post": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx comments post [--ticket <ref>] <message>");
        process.exit(0);
      }
      const rawRef = extractTicketRef(rest);
      const resolved = await resolveTicket(config, rawRef);
      await cmdPost(config, resolved.id, rest);
      break;
    }

    default:
      if (subcommand) console.error(`Unknown comments command: ${subcommand}`);
      commentsUsage();
  }
}

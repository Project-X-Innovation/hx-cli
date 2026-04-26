import type { HxConfig } from "../lib/config.js";
import { getFlag } from "../lib/flags.js";
import { cmdList } from "./list.js";
import { cmdPost } from "./post.js";

function resolveTicketId(args: string[]): string {
  const flagValue = getFlag(args, "--ticket");
  if (flagValue) return flagValue;

  const envValue = process.env.HELIX_TICKET_ID;
  if (envValue) return envValue;

  console.error("Error: No ticket ID provided. Use --ticket <id> or set HELIX_TICKET_ID env var.");
  process.exit(1);
}

function commentsUsage(): never {
  console.error(`Usage:
  hlx comments list [--ticket <id>] [--helix-only] [--since <iso-date>]
  hlx comments post [--ticket <id>] <message>`);
  process.exit(1);
}

export async function runComments(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "list": {
      const ticketId = resolveTicketId(rest);
      await cmdList(config, ticketId, rest);
      break;
    }

    case "post": {
      const ticketId = resolveTicketId(rest);
      await cmdPost(config, ticketId, rest);
      break;
    }

    default:
      if (subcommand) console.error(`Unknown comments command: ${subcommand}`);
      commentsUsage();
  }
}

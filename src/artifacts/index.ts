import type { HxConfig } from "../lib/config.js";
import { cmdTicketArtifacts } from "./ticket.js";
import { cmdRunArtifacts } from "./run.js";

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function resolveTicketId(args: string[]): string {
  const flagValue = getFlag(args, "--ticket");
  if (flagValue) return flagValue;

  const envValue = process.env.HELIX_TICKET_ID;
  if (envValue) return envValue;

  console.error("Error: No ticket ID provided. Use --ticket <id> or set HELIX_TICKET_ID env var.");
  process.exit(1);
}

function artifactsUsage(): never {
  console.error(`Usage:
  hlx artifacts ticket <ticket-id>
                                List artifacts for a ticket
  hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>
                                Retrieve step artifacts for a run`);
  process.exit(1);
}

export async function runArtifacts(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "ticket": {
      // Ticket ID is a positional arg, or fall back to --ticket flag / env var
      const ticketId = rest[0] && !rest[0].startsWith("--") ? rest[0] : resolveTicketId(rest);
      await cmdTicketArtifacts(config, ticketId, rest);
      break;
    }

    case "run": {
      const ticketId = resolveTicketId(rest);
      await cmdRunArtifacts(config, ticketId, rest);
      break;
    }

    default:
      if (subcommand) console.error(`Unknown artifacts command: ${subcommand}`);
      artifactsUsage();
  }
}

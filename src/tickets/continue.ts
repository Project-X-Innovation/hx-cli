import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getPositionalArgs, isHelpRequested } from "../lib/flags.js";

type RerunResponse = {
  run: { id: string };
};

export async function cmdTicketsContinue(config: HxConfig, ticketId: string, args: string[], rawRef?: string): Promise<void> {
  if (isHelpRequested(args)) {
    console.log('Usage: hlx tickets continue <ticket-ref> "continuation context"\n\nTicket references accept: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).');
    process.exit(0);
  }

  // Collect continuation context from positional args, excluding the ticket reference
  // which may still be present in args when passed as a positional argument
  const positional = getPositionalArgs(args, ["--ticket"]);
  const refToFilter = rawRef ?? ticketId;
  if (positional.length > 0 && positional[0] === refToFilter) {
    positional.shift();
  }
  const continuationContext = positional.join(" ").trim();

  if (!continuationContext) {
    console.error("Error: Continuation context is required.");
    console.error('Usage: hlx tickets continue <ticket-ref> "your continuation context"');
    process.exit(1);
  }

  const data = (await hxFetch(config, `/tickets/${ticketId}/rerun`, {
    method: "POST",
    body: { continuationContext },
    basePath: "/api",
  })) as RerunResponse;

  console.log(`Continue started (run ID: ${data.run.id})`);
}

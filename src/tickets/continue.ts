import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getPositionalArgs } from "../lib/flags.js";

type RerunResponse = {
  run: { id: string };
};

export async function cmdTicketsContinue(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  // Collect continuation context from positional args, excluding the ticket ID
  // which may still be present in args when passed as a positional argument
  const positional = getPositionalArgs(args, ["--ticket"]);
  if (positional.length > 0 && positional[0] === ticketId) {
    positional.shift();
  }
  const continuationContext = positional.join(" ").trim();

  if (!continuationContext) {
    console.error("Error: Continuation context is required.");
    console.error('Usage: hlx tickets continue <ticket-id> "your continuation context"');
    process.exit(1);
  }

  const data = (await hxFetch(config, `/tickets/${ticketId}/rerun`, {
    method: "POST",
    body: { continuationContext },
    basePath: "/api",
  })) as RerunResponse;

  console.log(`Continue started (run ID: ${data.run.id})`);
}

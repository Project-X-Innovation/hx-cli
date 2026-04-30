import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { requireFlag, getFlag, isHelpRequested } from "../lib/flags.js";

type CreateTicketResponse = {
  ticket: { id: string; shortId: string; status: string };
  run?: { id: string };
};

export async function cmdTicketsCreate(config: HxConfig, args: string[]): Promise<void> {
  if (isHelpRequested(args)) {
    console.log("Usage: hlx tickets create --title <title> --description <desc> --repos <repo1,repo2>");
    process.exit(0);
  }

  const title = requireFlag(args, "--title", "--title <title> is required.");
  const description = requireFlag(args, "--description", "--description <desc> is required.");
  const reposRaw = requireFlag(args, "--repos", "--repos <repo1,repo2> is required.");
  const repositoryIds = reposRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  if (repositoryIds.length === 0) {
    console.error("Error: At least one repository ID is required in --repos.");
    process.exit(1);
  }

  const data = (await hxFetch(config, "/tickets", {
    method: "POST",
    body: { title, description, repositoryIds },
    basePath: "/api",
  })) as CreateTicketResponse;

  console.log(`Ticket created:`);
  console.log(`  ID:       ${data.ticket.id}`);
  console.log(`  Short ID: ${data.ticket.shortId}`);
  console.log(`  Status:   ${data.ticket.status}`);
  if (data.run) {
    console.log(`  Run ID:   ${data.run.id}`);
  }
}

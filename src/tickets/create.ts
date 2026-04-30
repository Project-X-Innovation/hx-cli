import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { requireFlag, getFlag } from "../lib/flags.js";

type CreateTicketResponse = {
  ticket: { id: string; shortId?: string; mode?: string; status: string };
  run?: { id: string };
};

const VALID_MODES = ["AUTO", "BUILD", "FIX", "RESEARCH", "EXECUTE"] as const;

export async function cmdTicketsCreate(config: HxConfig, args: string[]): Promise<void> {
  const title = requireFlag(args, "--title", "--title <title> is required.");
  const description = requireFlag(args, "--description", "--description <desc> is required.");
  const reposRaw = requireFlag(args, "--repos", "--repos <repo1,repo2> is required.");
  const repositoryIds = reposRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  if (repositoryIds.length === 0) {
    console.error("Error: At least one repository ID is required in --repos.");
    process.exit(1);
  }

  const modeRaw = getFlag(args, "--mode");
  let mode: string | undefined;
  if (modeRaw !== undefined) {
    const normalized = modeRaw.toUpperCase();
    if (!(VALID_MODES as readonly string[]).includes(normalized)) {
      console.error(`Error: Invalid mode "${modeRaw}". Allowed values: ${VALID_MODES.join(", ")}`);
      process.exit(1);
    }
    mode = normalized;
  }

  const data = (await hxFetch(config, "/tickets", {
    method: "POST",
    body: { title, description, repositoryIds, ...(mode && { mode }) },
    basePath: "/api",
  })) as CreateTicketResponse;

  console.log(`Ticket created:`);
  console.log(`  ID:       ${data.ticket.id}`);
  console.log(`  Short ID: ${data.ticket.shortId ?? "(pending)"}`);
  console.log(`  Status:   ${data.ticket.status}`);
  if (data.ticket.mode) {
    console.log(`  Mode:     ${data.ticket.mode}`);
  }
  if (data.run) {
    console.log(`  Run ID:   ${data.run.id}`);
  }
}

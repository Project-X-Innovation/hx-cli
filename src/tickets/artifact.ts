import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getFlag } from "../lib/flags.js";

type TicketDetail = {
  currentRun?: { id: string };
  runs: Array<{ id: string }>;
};

type StepArtifactResponse = {
  files: Array<{
    filename: string;
    content: string;
  }>;
};

export async function cmdTicketsArtifact(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  const stepId = getFlag(args, "--step");
  const repoKey = getFlag(args, "--repo");

  if (!stepId || !repoKey) {
    console.error("Error: --step and --repo are required.");
    console.error("Usage: hlx tickets artifact <ticket-id> --step <stepId> --repo <repoKey> [--run <runId>]");
    process.exit(1);
  }

  let runId = getFlag(args, "--run");

  // If no run ID provided, fetch latest from ticket detail
  if (!runId) {
    const ticket = (await hxFetch(config, `/tickets/${ticketId}`, { basePath: "/api" })) as TicketDetail;
    runId = ticket.currentRun?.id ?? ticket.runs[0]?.id;
    if (!runId) {
      console.error("Error: No runs found for this ticket. Specify --run explicitly.");
      process.exit(1);
    }
  }

  const data = (await hxFetch(config, `/tickets/${ticketId}/runs/${runId}/step-artifacts/${stepId}`, {
    basePath: "/api",
    queryParams: { repoKey },
  })) as StepArtifactResponse;

  if (!data.files || data.files.length === 0) {
    console.log("No artifact files found for this step/repo.");
    return;
  }

  for (let i = 0; i < data.files.length; i++) {
    const file = data.files[i]!;
    if (data.files.length > 1) {
      console.log(`--- ${file.filename} ---`);
    }
    console.log(file.content);
  }
}

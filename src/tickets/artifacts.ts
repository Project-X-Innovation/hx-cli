import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getFlag } from "../lib/flags.js";

type ArtifactsResponse = {
  items: Array<{
    label: string;
    repoUrl: string;
    branch: string;
    path: string;
  }>;
  stepArtifactSummary: Array<{
    stepId: string;
    repoKey: string;
  }>;
};

type TicketDetail = {
  currentRun?: { id: string };
  runs: Array<{ id: string }>;
};

type TicketResponse = { ticket: TicketDetail };

export async function cmdTicketsArtifacts(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  const runId = getFlag(args, "--run");
  const data = (await hxFetch(config, `/tickets/${ticketId}/artifacts`, {
    basePath: "/api",
    ...(runId ? { queryParams: { runId } } : {}),
  })) as ArtifactsResponse;

  if (data.items.length > 0) {
    console.log("Artifacts:\n");
    for (const item of data.items) {
      console.log(`  ${item.label}`);
      console.log(`    Repo:   ${item.repoUrl}`);
      console.log(`    Branch: ${item.branch}`);
      console.log(`    Path:   ${item.path}`);
      console.log();
    }
  } else {
    console.log("No artifacts found.\n");
  }

  if (data.stepArtifactSummary.length > 0) {
    console.log("Step Artifact Summary:\n");
    for (const entry of data.stepArtifactSummary) {
      console.log(`  Step: ${entry.stepId}  Repo: ${entry.repoKey}`);
    }
    console.log("\nUse: hlx tickets artifact <ticket-id> --step <stepId> --repo <repoKey>");
  } else {
    console.log("No step artifacts found.");
  }

  // Combined empty-result: show run ID and follow-up suggestion
  if (data.items.length === 0 && data.stepArtifactSummary.length === 0) {
    let resolvedRunId: string | undefined = runId;

    if (!resolvedRunId) {
      try {
        const resp = (await hxFetch(config, `/tickets/${ticketId}`, { basePath: "/api" })) as TicketResponse;
        const ticket = resp.ticket;
        resolvedRunId = ticket.currentRun?.id ?? ticket.runs[0]?.id;

        if (!resolvedRunId) {
          console.log("\nNo runs available for this ticket.");
          return;
        }
      } catch {
        console.log("\nCould not resolve the run ID for this ticket.");
        return;
      }
    }

    console.log(`\nRun ID: ${resolvedRunId}`);
    console.log(`Use: hlx tickets artifact <ticket-ref> --run ${resolvedRunId} --step <stepId> --repo <repoKey>`);
  }
}

import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

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

export async function cmdTicketsArtifacts(config: HxConfig, ticketId: string): Promise<void> {
  const data = (await hxFetch(config, `/tickets/${ticketId}/artifacts`, { basePath: "/api" })) as ArtifactsResponse;

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
}

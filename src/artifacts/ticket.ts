import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type ArtifactResponse = {
  items: Array<{
    id: string;
    label: string;
    repoUrl: string;
    runId: string;
    branch: string;
    path: string;
    url: string;
  }>;
  stepArtifactSummary: Array<{
    stepId: string;
    repoKey: string;
  }>;
};

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

export async function cmdTicketArtifacts(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  const runId = getFlag(args, "--run");

  const queryParams: Record<string, string> = {};
  if (runId) {
    queryParams.runId = runId;
  }

  const data = (await hxFetch(config, `/tickets/${ticketId}/artifacts`, {
    basePath: "/api",
    queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
  })) as ArtifactResponse;

  if ((!data.items || data.items.length === 0) && (!data.stepArtifactSummary || data.stepArtifactSummary.length === 0)) {
    console.log("No artifacts found for this ticket.");
    return;
  }

  if (data.items && data.items.length > 0) {
    console.log("Artifacts:");
    for (const item of data.items) {
      console.log(`  ${item.label}`);
      console.log(`    Run:    ${item.runId}`);
      console.log(`    Branch: ${item.branch}`);
      console.log(`    Repo:   ${item.repoUrl}`);
      console.log(`    URL:    ${item.url}`);
      console.log();
    }
  }

  if (data.stepArtifactSummary && data.stepArtifactSummary.length > 0) {
    console.log("Step Artifacts:");
    for (const step of data.stepArtifactSummary) {
      console.log(`  Step: ${step.stepId}  Repo: ${step.repoKey}`);
    }
  }
}

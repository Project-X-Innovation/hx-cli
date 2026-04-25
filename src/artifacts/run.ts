import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type StepArtifactResponse = {
  stepId: string;
  repoKey: string;
  files: Array<{
    name: string;
    content: string;
    contentType: string;
  }>;
};

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

export async function cmdRunArtifacts(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  const runId = args[0] && !args[0].startsWith("--") ? args[0] : undefined;
  const stepId = getFlag(args, "--step");
  const repoKey = getFlag(args, "--repo-key");

  if (!runId) {
    console.error("Error: Run ID is required. Usage: hlx artifacts run <run-id> --ticket <id> --step <step-id> --repo-key <key>");
    process.exit(1);
  }

  if (!stepId) {
    console.error("Error: --step flag is required for run artifact retrieval.");
    process.exit(1);
  }

  if (!repoKey) {
    console.error("Error: --repo-key flag is required for run artifact retrieval.");
    process.exit(1);
  }

  const data = (await hxFetch(config, `/tickets/${ticketId}/runs/${runId}/step-artifacts/${stepId}`, {
    basePath: "/api",
    queryParams: { repoKey },
  })) as StepArtifactResponse;

  if (!data.files || data.files.length === 0) {
    console.log("No step artifacts found.");
    return;
  }

  console.log(`Step: ${data.stepId}  Repo: ${data.repoKey}`);
  console.log();

  for (const file of data.files) {
    console.log(`--- ${file.name} (${file.contentType}) ---`);
    console.log(file.content);
    console.log();
  }
}

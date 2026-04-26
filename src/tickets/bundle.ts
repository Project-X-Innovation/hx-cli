import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { requireFlag } from "../lib/flags.js";

type TicketDetail = {
  id: string;
  currentRun?: { id: string };
  runs: Array<{ id: string }>;
};

type ArtifactsResponse = {
  stepArtifactSummary: Array<{
    stepId: string;
    repoKey: string;
  }>;
};

type StepArtifactResponse = {
  files: Array<{
    filename: string;
    content: string;
  }>;
};

export async function cmdTicketsBundle(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  const outDir = requireFlag(args, "--out", "--out <dir> is required.");

  // 1. Fetch ticket detail
  const ticket = (await hxFetch(config, `/tickets/${ticketId}`, { basePath: "/api" })) as TicketDetail;

  const runId = ticket.currentRun?.id ?? ticket.runs[0]?.id;
  if (!runId) {
    console.error("Error: No runs found for this ticket.");
    process.exit(1);
  }

  // 2. Fetch artifacts
  const artifacts = (await hxFetch(config, `/tickets/${ticketId}/artifacts`, { basePath: "/api" })) as ArtifactsResponse;

  // 3. Create output directory
  mkdirSync(outDir, { recursive: true });

  // 4. Write ticket.json
  writeFileSync(join(outDir, "ticket.json"), JSON.stringify(ticket, null, 2) + "\n", "utf8");

  // 5. Fetch and write each step artifact
  let totalFiles = 0;
  for (const entry of artifacts.stepArtifactSummary) {
    try {
      const data = (await hxFetch(config, `/tickets/${ticketId}/runs/${runId}/step-artifacts/${entry.stepId}`, {
        basePath: "/api",
        queryParams: { repoKey: entry.repoKey },
      })) as StepArtifactResponse;

      if (data.files && data.files.length > 0) {
        const artifactDir = join(outDir, "artifacts", entry.stepId, entry.repoKey);
        mkdirSync(artifactDir, { recursive: true });
        for (const file of data.files) {
          writeFileSync(join(artifactDir, file.filename), file.content, "utf8");
          totalFiles++;
        }
      }
    } catch {
      // Skip artifacts that fail to fetch (permissions, missing data, etc.)
      console.error(`Warning: Could not fetch artifact for step=${entry.stepId} repo=${entry.repoKey}`);
    }
  }

  // 6. Write manifest.json
  const manifest = {
    ticketId: ticket.id,
    bundledAt: new Date().toISOString(),
    cliVersion: "1.2.0",
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(`Bundle created at: ${outDir}`);
  console.log(`  ticket.json`);
  console.log(`  manifest.json`);
  console.log(`  ${totalFiles} artifact file(s)`);
}

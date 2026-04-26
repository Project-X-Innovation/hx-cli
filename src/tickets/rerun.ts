import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type RerunResponse = {
  run: { id: string };
};

export async function cmdTicketsRerun(config: HxConfig, ticketId: string): Promise<void> {
  const data = (await hxFetch(config, `/tickets/${ticketId}/rerun`, {
    method: "POST",
    body: {},
    basePath: "/api",
  })) as RerunResponse;

  console.log(`Rerun started (run ID: ${data.run.id})`);
}

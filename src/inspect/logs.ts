import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { resolveRepo } from "../lib/resolve-repo.js";

export async function cmdLogs(config: HxConfig, repoNameOrId: string, query: string, limit?: number): Promise<void> {
  const repoId = await resolveRepo(config, repoNameOrId);
  const body: Record<string, unknown> = { query };
  if (limit !== undefined) body.limit = limit;
  const result = await hxFetch(config, `/${repoId}/logs`, {
    method: "POST",
    body,
  });
  console.log(JSON.stringify(result, null, 2));
}

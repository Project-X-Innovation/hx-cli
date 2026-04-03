import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { resolveRepo } from "../lib/resolve-repo.js";

export async function cmdDb(config: HxConfig, repoNameOrId: string, query: string): Promise<void> {
  const repoId = await resolveRepo(config, repoNameOrId);
  const result = await hxFetch(config, `/${repoId}/database`, {
    method: "POST",
    body: { query },
  });
  console.log(JSON.stringify(result, null, 2));
}

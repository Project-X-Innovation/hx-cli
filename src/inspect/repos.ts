import type { HxConfig } from "../lib/config.js";
import { listRepos } from "../lib/resolve-repo.js";

export async function cmdRepos(config: HxConfig): Promise<void> {
  const repos = await listRepos(config);
  if (repos.length === 0) {
    console.log("No repositories with inspection credentials configured.");
    return;
  }
  for (const r of repos) {
    console.log(`${r.displayName}  ${r.id}  [${r.types.join(", ")}]`);
  }
}

import type { HxConfig } from "./config.js";
import { hxFetch } from "./http.js";

type RepoInfo = { id: string; displayName: string; types: string[] };

export async function listRepos(config: HxConfig): Promise<RepoInfo[]> {
  const result = (await hxFetch(config, "/repositories")) as { repos: RepoInfo[] };
  return result.repos;
}

export async function resolveRepo(config: HxConfig, nameOrId: string): Promise<string> {
  const repos = await listRepos(config);

  // Exact ID match
  const byId = repos.find((r) => r.id === nameOrId);
  if (byId) return byId.id;

  // Exact display name match (case-insensitive)
  const lower = nameOrId.toLowerCase();
  const byName = repos.find((r) => r.displayName.toLowerCase() === lower);
  if (byName) return byName.id;

  // Partial match
  const partial = repos.find((r) => r.displayName.toLowerCase().includes(lower));
  if (partial) return partial.id;

  console.error(`Repository "${nameOrId}" not found. Available:`);
  for (const r of repos) {
    console.error(`  ${r.displayName}  (${r.id})  [${r.types.join(", ")}]`);
  }
  process.exit(1);
}

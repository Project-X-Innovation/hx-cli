import type { HxConfig } from "./config.js";
import { hxFetch } from "./http.js";

type RepoInfo = { id: string; displayName: string; types: string[] };

export async function listRepos(config: HxConfig): Promise<RepoInfo[]> {
  const result = (await hxFetch(config, "/repositories")) as { repos: RepoInfo[] };
  return result.repos;
}

export async function resolveRepo(config: HxConfig, nameOrId: string): Promise<string> {
  let repos: RepoInfo[];
  try {
    repos = await listRepos(config);
  } catch (error) {
    throw new Error("Failed to fetch repository list: " + (error instanceof Error ? error.message : String(error)));
  }

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

/**
 * Resolve multiple repo names/keys/IDs to internal IDs in a single API call.
 * Throws an Error (not process.exit) listing all unresolved entries so the
 * caller can format the final error message.
 */
export async function resolveAllRepos(config: HxConfig, namesOrIds: string[]): Promise<string[]> {
  let repos: RepoInfo[];
  try {
    repos = await listRepos(config);
  } catch (error) {
    throw new Error("Failed to fetch repository list: " + (error instanceof Error ? error.message : String(error)));
  }

  const resolved: string[] = [];
  const unknown: string[] = [];

  for (const entry of namesOrIds) {
    // Exact ID match
    const byId = repos.find((r) => r.id === entry);
    if (byId) { resolved.push(byId.id); continue; }

    // Exact display name match (case-insensitive)
    const lower = entry.toLowerCase();
    const byName = repos.find((r) => r.displayName.toLowerCase() === lower);
    if (byName) { resolved.push(byName.id); continue; }

    // Partial match
    const partial = repos.find((r) => r.displayName.toLowerCase().includes(lower));
    if (partial) { resolved.push(partial.id); continue; }

    unknown.push(entry);
  }

  if (unknown.length > 0) {
    const availableList = repos.map((r) => `  ${r.displayName}  (${r.id})  [${r.types.join(", ")}]`).join("\n");
    throw new Error(
      `Unknown repository${unknown.length > 1 ? "ies" : ""}: ${unknown.join(", ")}\nAvailable repositories:\n${availableList}`
    );
  }

  return resolved;
}

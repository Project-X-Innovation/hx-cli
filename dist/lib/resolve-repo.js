import { hxFetch } from "./http.js";
export async function listRepos(config) {
    const result = (await hxFetch(config, "/repositories"));
    return result.repositories;
}
export async function resolveRepo(config, nameOrId) {
    const repos = await listRepos(config);
    // Exact ID match
    const byId = repos.find((r) => r.repositoryId === nameOrId);
    if (byId)
        return byId.repositoryId;
    // Exact display name match (case-insensitive)
    const lower = nameOrId.toLowerCase();
    const byName = repos.find((r) => r.displayName.toLowerCase() === lower);
    if (byName)
        return byName.repositoryId;
    // Partial match
    const partial = repos.find((r) => r.displayName.toLowerCase().includes(lower));
    if (partial)
        return partial.repositoryId;
    console.error(`Repository "${nameOrId}" not found. Available:`);
    for (const r of repos) {
        console.error(`  ${r.displayName}  (${r.repositoryId})  [${r.types.join(", ")}]`);
    }
    process.exit(1);
}

import { listRepos } from "../lib/resolve-repo.js";
export async function cmdRepos(config) {
    const repos = await listRepos(config);
    if (repos.length === 0) {
        console.log("No repositories with inspection credentials configured.");
        return;
    }
    for (const r of repos) {
        console.log(`${r.displayName}  ${r.repositoryId}  [${r.types.join(", ")}]`);
    }
}

import { hxFetch } from "../lib/http.js";
import { resolveRepo } from "../lib/resolve-repo.js";
export async function cmdApi(config, repoNameOrId, path) {
    const repoId = await resolveRepo(config, repoNameOrId);
    const result = await hxFetch(config, `/${repoId}/api`, {
        queryParams: { path },
    });
    console.log(JSON.stringify(result, null, 2));
}

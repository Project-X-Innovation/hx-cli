import { hxFetch } from "../lib/http.js";
import { resolveRepo } from "../lib/resolve-repo.js";
export async function cmdDb(config, repoNameOrId, query) {
    const repoId = await resolveRepo(config, repoNameOrId);
    const result = await hxFetch(config, `/${repoId}/database`, {
        method: "POST",
        body: { query },
    });
    console.log(JSON.stringify(result, null, 2));
}

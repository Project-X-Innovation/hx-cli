import { hxFetch } from "../lib/http.js";
import { resolveRepo } from "../lib/resolve-repo.js";
export async function cmdLogs(config, repoNameOrId, query, limit) {
    const repoId = await resolveRepo(config, repoNameOrId);
    const body = { query };
    if (limit !== undefined)
        body.limit = limit;
    const result = await hxFetch(config, `/${repoId}/logs`, {
        method: "POST",
        body,
    });
    console.log(JSON.stringify(result, null, 2));
}

export async function hxFetch(config, path, options = {}) {
    const method = options.method ?? "GET";
    const url = new URL(`${config.url}/api/inspect${path}`);
    if (options.queryParams) {
        for (const [key, value] of Object.entries(options.queryParams)) {
            url.searchParams.set(key, value);
        }
    }
    const headers = {};
    if (config.apiKey.startsWith("hxi_")) {
        headers["X-API-Key"] = config.apiKey;
    }
    else {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
    let body;
    if (options.body) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
    }
    const response = await fetch(url.toString(), { method, headers, body });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error(`Error: HTTP ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 500)}` : ""}`);
        process.exit(1);
    }
    return response.json();
}

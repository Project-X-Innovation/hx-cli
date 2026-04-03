import type { HxConfig } from "./config.js";

export async function hxFetch(
  config: HxConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown>; queryParams?: Record<string, string> } = {},
): Promise<unknown> {
  const method = options.method ?? "GET";
  const url = new URL(`${config.url}/api/inspect${path}`);

  if (options.queryParams) {
    for (const [key, value] of Object.entries(options.queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {};
  if (config.apiKey.startsWith("hxi_")) {
    headers["X-API-Key"] = config.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  let body: string | undefined;
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

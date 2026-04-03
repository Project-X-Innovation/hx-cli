import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const CONFIG_DIR = join(homedir(), ".hx");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export function loadConfig() {
    // Env vars take priority
    const apiKey = process.env.HELIX_API_KEY ?? process.env.HELIX_INSPECT_TOKEN ?? process.env.HELIX_INSPECT_API_KEY;
    const url = process.env.HELIX_URL ?? process.env.HELIX_INSPECT_BASE_URL ?? process.env.HELIX_INSPECT_URL;
    if (apiKey && url) {
        return { apiKey, url: url.replace(/\/+$/, "") };
    }
    // Fall back to config file
    try {
        const raw = readFileSync(CONFIG_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (typeof parsed.apiKey === "string" && typeof parsed.url === "string") {
            return { apiKey: parsed.apiKey, url: parsed.url.replace(/\/+$/, "") };
        }
    }
    catch {
        // No config file or invalid
    }
    return null;
}
export function saveConfig(config) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
}
export function requireConfig() {
    const config = loadConfig();
    if (!config) {
        console.error("Not authenticated. Run `hx login <server-url>` or set HELIX_API_KEY + HELIX_URL env vars.");
        process.exit(1);
    }
    return config;
}

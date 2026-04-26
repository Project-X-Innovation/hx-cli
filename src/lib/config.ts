import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type HxConfig = {
  apiKey: string;
  url: string;
  orgId?: string;
  orgName?: string;
};

const CONFIG_DIR = join(homedir(), ".hlx");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function loadConfig(): HxConfig | null {
  // Env vars take priority
  const apiKey = process.env.HELIX_API_KEY ?? process.env.HELIX_INSPECT_TOKEN ?? process.env.HELIX_INSPECT_API_KEY;
  const url = process.env.HELIX_URL ?? process.env.HELIX_INSPECT_BASE_URL ?? process.env.HELIX_INSPECT_URL;
  if (apiKey && url) {
    return { apiKey, url: url.replace(/\/+$/, "") };
  }

  // Fall back to config file
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.apiKey === "string" && typeof parsed.url === "string") {
      return {
        apiKey: parsed.apiKey,
        url: parsed.url.replace(/\/+$/, ""),
        orgId: typeof parsed.orgId === "string" ? parsed.orgId : undefined,
        orgName: typeof parsed.orgName === "string" ? parsed.orgName : undefined,
      };
    }
  } catch {
    // No config file or invalid
  }

  return null;
}

export function saveConfig(config: HxConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const data: Record<string, string> = { apiKey: config.apiKey, url: config.url };
  if (config.orgId) data.orgId = config.orgId;
  if (config.orgName) data.orgName = config.orgName;
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function requireConfig(): HxConfig {
  const config = loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `hlx login <server-url>` or set HELIX_API_KEY + HELIX_URL env vars.");
    process.exit(1);
  }
  return config;
}

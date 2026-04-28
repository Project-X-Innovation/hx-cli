import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type InstallSource = {
  mode: "github" | "unknown";
  repo?: string;
  branch?: string;
  commit?: string;
};

export type HxConfig = {
  apiKey: string;
  url: string;
<<<<<<< HEAD
  orgId?: string;
  orgName?: string;
=======
  autoUpdate?: boolean;
  installSource?: InstallSource;
>>>>>>> origin/staging
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

/** Read the full raw config from disk, including optional update fields. */
export function loadFullConfig(): Partial<HxConfig> {
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as Partial<HxConfig>;
  } catch {
    return {};
  }
}

/** Read-merge-write: merges the provided fields into the existing config file without destroying unrelated fields. */
export function saveConfig(updates: Partial<HxConfig>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
<<<<<<< HEAD
  const data: Record<string, string> = { apiKey: config.apiKey, url: config.url };
  if (config.orgId) data.orgId = config.orgId;
  if (config.orgName) data.orgName = config.orgName;
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
=======
  let existing: Record<string, unknown> = {};
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // No existing file or invalid — start fresh
  }
  const merged = { ...existing, ...updates };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + "\n", "utf8");
>>>>>>> origin/staging
}

export function requireConfig(): HxConfig {
  const config = loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `hlx login <server-url>` or set HELIX_API_KEY + HELIX_URL env vars.");
    process.exit(1);
  }
  return config;
}

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type InstallSource = {
  mode: "github" | "npm" | "unknown";
  repo?: string;
  branch?: string;
  commit?: string;
  version?: string;
};

export type HxConfig = {
  apiKey: string;
  url: string;
  orgId?: string;
  orgName?: string;
  autoUpdate?: boolean;
  installSource?: InstallSource;
};

export type OrgEntry = {
  orgId: string;
  orgName: string;
  token: string;
  url: string;
  alias?: string;
};

export type MultiTokenConfig = {
  orgs: OrgEntry[];
  currentOrg?: string;
  autoUpdate?: boolean;
  installSource?: InstallSource;
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

  // Fall back to multi-token config file
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Multi-token config: orgs array with currentOrg pointer
    if (Array.isArray(parsed.orgs)) {
      const orgs = parsed.orgs as OrgEntry[];
      const currentOrg = typeof parsed.currentOrg === "string" ? parsed.currentOrg : undefined;

      let entry: OrgEntry | undefined;
      if (currentOrg) {
        entry = orgs.find((o) => o.orgId === currentOrg);
      } else if (orgs.length === 1) {
        // Convenience: single org doesn't need currentOrg set
        entry = orgs[0];
      }

      if (entry) {
        return {
          apiKey: entry.token,
          url: entry.url.replace(/\/+$/, ""),
          orgId: entry.orgId,
          orgName: entry.orgName,
        };
      }
      return null;
    }

    // Legacy single-token config — migration is out of scope, return null
    if (typeof parsed.apiKey === "string") {
      return null;
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

/** Read and parse multi-token config. Returns null if file missing/invalid/legacy. */
export function loadRawConfig(): MultiTokenConfig | null {
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(parsed.orgs)) {
      return {
        orgs: parsed.orgs as OrgEntry[],
        currentOrg: typeof parsed.currentOrg === "string" ? parsed.currentOrg : undefined,
        autoUpdate: typeof parsed.autoUpdate === "boolean" ? parsed.autoUpdate : undefined,
        installSource: parsed.installSource as InstallSource | undefined,
      };
    }
  } catch {
    // No config file or invalid
  }
  return null;
}

/** Returns all configured org entries (empty array if none). */
export function getOrgEntries(): OrgEntry[] {
  const config = loadRawConfig();
  return config?.orgs ?? [];
}

/** Find an org entry by exact orgId match, then by exact alias match. */
export function getOrgEntry(orgIdOrAlias: string): OrgEntry | undefined {
  const entries = getOrgEntries();
  return entries.find((o) => o.orgId === orgIdOrAlias) ?? entries.find((o) => o.alias === orgIdOrAlias);
}

/** Add or replace an org entry. If makeCurrent or no currentOrg exists, sets currentOrg. */
export function addOrgEntry(entry: OrgEntry, makeCurrent: boolean): void {
  mkdirSync(CONFIG_DIR, { recursive: true });

  let existing: Record<string, unknown> = {};
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Start fresh
  }

  const orgs: OrgEntry[] = Array.isArray(existing.orgs) ? (existing.orgs as OrgEntry[]) : [];

  // Validate alias uniqueness
  if (entry.alias) {
    const conflict = orgs.find((o) => o.alias === entry.alias && o.orgId !== entry.orgId);
    if (conflict) {
      throw new Error(`Alias "${entry.alias}" is already used by org ${conflict.orgId} (${conflict.orgName}).`);
    }
  }

  // Replace existing entry with same orgId or append
  const idx = orgs.findIndex((o) => o.orgId === entry.orgId);
  if (idx >= 0) {
    orgs[idx] = entry;
  } else {
    orgs.push(entry);
  }

  const currentOrg = typeof existing.currentOrg === "string" ? existing.currentOrg : undefined;
  const newCurrentOrg = makeCurrent || !currentOrg ? entry.orgId : currentOrg;

  const merged = {
    ...existing,
    orgs,
    currentOrg: newCurrentOrg,
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + "\n", "utf8");
}

/** Set currentOrg to the given orgId. Fails if no entry exists for that orgId. */
export function setCurrentOrg(orgId: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true });

  let existing: Record<string, unknown> = {};
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("No config file found. Run `hlx token add` first.");
  }

  const orgs: OrgEntry[] = Array.isArray(existing.orgs) ? (existing.orgs as OrgEntry[]) : [];
  if (!orgs.find((o) => o.orgId === orgId)) {
    throw new Error(`No configured entry for org ${orgId}.`);
  }

  existing.currentOrg = orgId;
  writeFileSync(CONFIG_FILE, JSON.stringify(existing, null, 2) + "\n", "utf8");
}

/** Mask a token for display. Returns hxi_<first8>... */
export function maskToken(token: string): string {
  const prefix = "hxi_";
  if (!token.startsWith(prefix) || token.length <= prefix.length + 8) {
    return token;
  }
  return `${token.slice(0, prefix.length + 8)}...`;
}

/** Read-merge-write: merges the provided fields into the existing config file without destroying unrelated fields. */
export function saveConfig(updates: Partial<HxConfig>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // No existing file or invalid — start fresh
  }
  const merged = { ...existing, ...updates };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + "\n", "utf8");
}

export function requireConfig(): HxConfig {
  const config = loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `hlx token add --token <key> --url <server>` or set HELIX_API_KEY + HELIX_URL env vars.");
    process.exit(1);
  }
  return config;
}

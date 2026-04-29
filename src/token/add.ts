import { getFlag, hasFlag } from "../lib/flags.js";
import { addOrgEntry, getOrgEntries, loadRawConfig, maskToken, type OrgEntry } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type MeResponse = {
  user: { id: string; email: string; name: string | null };
  organization: { id: string; name: string };
};

export async function cmdTokenAdd(args: string[]): Promise<void> {
  const token = getFlag(args, "--token");
  if (!token) {
    console.error("Error: --token is required.\nUsage: hlx token add --token <hxi_key> [--url <server>] [--name <alias>] [--current]");
    process.exit(1);
  }

  if (!token.startsWith("hxi_")) {
    console.error("Error: Token must start with 'hxi_'. Got: " + maskToken(token));
    process.exit(1);
  }

  let url = getFlag(args, "--url");
  if (!url) {
    // Try to get URL from an existing org entry
    const entries = getOrgEntries();
    if (entries.length > 0) {
      url = entries[0].url;
    } else {
      console.error("Error: --url is required when no orgs are configured.\nUsage: hlx token add --token <hxi_key> --url <server>");
      process.exit(1);
    }
  }
  url = url.replace(/\/+$/, "");

  const alias = getFlag(args, "--name");
  const makeCurrent = hasFlag(args, "--current");

  // Validate token by calling /api/auth/me
  const tempConfig = { apiKey: token, url };
  let data: MeResponse;
  try {
    data = (await hxFetch(tempConfig, "/auth/me", { basePath: "/api" })) as MeResponse;
  } catch (err) {
    console.error(`Error: Token validation failed — ${err instanceof Error ? err.message : String(err)}`);
    console.error(`Token: ${maskToken(token)}`);
    process.exit(1);
  }

  if (!data.organization?.id || !data.organization?.name) {
    console.error("Error: Server response did not include organization details.");
    process.exit(1);
  }

  const entry: OrgEntry = {
    orgId: data.organization.id,
    orgName: data.organization.name,
    token,
    url,
    ...(alias ? { alias } : {}),
  };

  const rawConfig = loadRawConfig();
  const hasCurrentOrg = Boolean(rawConfig?.currentOrg);

  try {
    addOrgEntry(entry, makeCurrent || !hasCurrentOrg);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log(`Added token for ${data.organization.name} (${data.organization.id})`);
  console.log(`Token: ${maskToken(token)}`);
  if (makeCurrent || !hasCurrentOrg) {
    console.log("Set as current org.");
  }
}

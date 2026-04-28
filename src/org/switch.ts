import type { HxConfig } from "../lib/config.js";
import { saveConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type MeResponse = {
  availableOrganizations: Array<{ id: string; name: string }>;
};

type SwitchOrgResponse = {
  accessToken: string;
  organization: { id: string; name: string };
};

export async function cmdOrgSwitch(config: HxConfig, args: string[]): Promise<void> {
  const input = args.join(" ").trim();
  if (!input) {
    console.error("Error: Org name or ID is required.\nUsage: hlx org switch <org-name-or-id>");
    process.exit(1);
  }

  // Resolve org identifier: if it looks like a CUID, use it directly; otherwise resolve by name
  let organizationId = input;
  let orgName = input;

  const isCuid = /^c[a-z0-9]{20,}$/i.test(input);
  if (!isCuid) {
    const me = (await hxFetch(config, "/auth/me", { basePath: "/api" })) as MeResponse;
    const matches = me.availableOrganizations.filter(
      (o) => o.name.toLowerCase() === input.toLowerCase(),
    );
    if (matches.length === 0) {
      console.error(`Error: No organization found matching "${input}".`);
      console.error("Available organizations:");
      for (const org of me.availableOrganizations) {
        console.error(`  ${org.id}  ${org.name}`);
      }
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(`Error: Multiple organizations match "${input}". Use the org ID instead:`);
      for (const org of matches) {
        console.error(`  ${org.id}  ${org.name}`);
      }
      process.exit(1);
    }
    organizationId = matches[0].id;
    orgName = matches[0].name;
  }

  if (config.apiKey.startsWith("hxi_")) {
    // Local-only switch for API keys: preserve the key, update org in config
    saveConfig({ orgId: organizationId, orgName: orgName });
    console.log(`Switched to org: ${orgName} (${organizationId})`);
  } else {
    // JWT token path: call server to switch org and get new token
    const data = (await hxFetch(config, "/auth/switch-org", {
      method: "POST",
      body: { organizationId },
      basePath: "/api",
    })) as SwitchOrgResponse;

    const updatedConfig: HxConfig = {
      ...config,
      apiKey: data.accessToken,
      orgId: data.organization.id,
      orgName: data.organization.name,
    };

    saveConfig(updatedConfig);
    console.log(`Switched to org: ${data.organization.name} (${data.organization.id})`);
  }
}

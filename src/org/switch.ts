import type { HxConfig } from "../lib/config.js";
import { saveConfig, getOrgEntries, setCurrentOrg } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

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

  if (config.apiKey.startsWith("hxi_")) {
    // Multi-token local-only switch
    const entries = getOrgEntries();

    // Match by exact orgId, then exact alias, then case-insensitive orgName
    let matched = entries.find((o) => o.orgId === input);
    if (!matched) {
      matched = entries.find((o) => o.alias === input);
    }
    if (!matched) {
      const nameMatches = entries.filter(
        (o) => o.orgName.toLowerCase() === input.toLowerCase(),
      );
      if (nameMatches.length === 1) {
        matched = nameMatches[0];
      } else if (nameMatches.length > 1) {
        console.error(`Error: Multiple organizations match "${input}". Use the org ID instead:`);
        for (const org of nameMatches) {
          console.error(`  ${org.orgId}  ${org.orgName}`);
        }
        process.exit(1);
      }
    }

    if (!matched) {
      console.error(`Error: No configured organization matching "${input}".`);
      if (entries.length > 0) {
        console.error("Configured organizations:");
        for (const org of entries) {
          const aliasStr = org.alias ? ` (${org.alias})` : "";
          console.error(`  ${org.orgId}  ${org.orgName}${aliasStr}`);
        }
      } else {
        console.error("No organizations configured. Run `hlx token add` to add one.");
      }
      process.exit(1);
    }

    try {
      setCurrentOrg(matched.orgId);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    console.log(`Switched to org: ${matched.orgName} (${matched.orgId})`);
  } else {
    // JWT token path: call server to switch org and get new token
    // Resolve by name first if input doesn't look like a CUID
    let organizationId = input;

    const isCuid = /^c[a-z0-9]{20,}$/i.test(input);
    if (!isCuid) {
      type MeResponse = { availableOrganizations: Array<{ id: string; name: string }> };
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
    }

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

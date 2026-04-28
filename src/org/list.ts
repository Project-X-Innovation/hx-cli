import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type MeResponse = {
  user: { organizationId: string };
  organization: { id: string; name: string };
  availableOrganizations: Array<{ id: string; name: string }>;
};

export async function cmdOrgList(config: HxConfig): Promise<void> {
  const data = (await hxFetch(config, "/auth/me", { basePath: "/api" })) as MeResponse;

  if (data.availableOrganizations.length === 0) {
    console.log("No organizations available.");
    return;
  }

  console.log("Organizations:\n");
  for (const org of data.availableOrganizations) {
    const isCurrent = config.apiKey.startsWith("hxi_")
      ? org.id === config.orgId
      : org.id === data.organization.id;
    const marker = isCurrent ? " (current)" : "";
    console.log(`  ${org.id}  ${org.name}${marker}`);
  }
}

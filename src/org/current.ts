import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    organizationId: string;
  };
  organization: {
    id: string;
    name: string;
  };
};

export async function cmdOrgCurrent(config: HxConfig): Promise<void> {
  const data = (await hxFetch(config, "/auth/me", { basePath: "/api" })) as MeResponse;

  console.log(`Organization: ${data.organization.name}`);
  console.log(`Org ID:       ${data.organization.id}`);
  console.log(`User:         ${data.user.name ?? data.user.email}`);
  console.log(`Email:        ${data.user.email}`);
}

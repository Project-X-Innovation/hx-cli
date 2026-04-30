import { getOrgEntries, loadRawConfig } from "../lib/config.js";

export async function cmdOrgList(): Promise<void> {
  const entries = getOrgEntries();
  const rawConfig = loadRawConfig();
  const currentOrg = rawConfig?.currentOrg;

  if (entries.length === 0) {
    console.log("No organizations configured. Run `hlx token add` to add one.");
    return;
  }

  console.log("Organizations:\n");
  for (const entry of entries) {
    const isCurrent = entry.orgId === currentOrg;
    const aliasStr = entry.alias ? ` (${entry.alias})` : "";
    const currentStr = isCurrent ? " (current)" : "";
    console.log(`  ${entry.orgId}  ${entry.orgName}${aliasStr}${currentStr}`);
  }
}

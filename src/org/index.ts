import { requireConfig } from "../lib/config.js";
import { cmdOrgCurrent } from "./current.js";
import { cmdOrgList } from "./list.js";
import { cmdOrgSwitch } from "./switch.js";

function orgUsage(): never {
  console.error(`Usage:
  hlx org current   Show current org and user
  hlx org list      List configured organizations
  hlx org switch <org-name-or-id>  Switch to a different org`);
  process.exit(1);
}

export async function runOrg(args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "current": {
      const config = requireConfig();
      await cmdOrgCurrent(config);
      break;
    }

    case "list":
      await cmdOrgList();
      break;

    case "switch": {
      const config = requireConfig();
      await cmdOrgSwitch(config, rest);
      break;
    }

    default:
      if (subcommand) console.error(`Unknown org command: ${subcommand}`);
      orgUsage();
  }
}

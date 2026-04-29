import { cmdTokenAdd } from "./add.js";

function tokenUsage(): never {
  console.error(`Usage:
  hlx token add --token <hxi_key> [--url <server>] [--name <alias>] [--current]`);
  process.exit(1);
}

export async function runToken(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "add":
      await cmdTokenAdd(args.slice(1));
      break;

    default:
      if (subcommand) console.error(`Unknown token command: ${subcommand}`);
      tokenUsage();
  }
}

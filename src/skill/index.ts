import { isHelpRequested } from "../lib/flags.js";
import { getSkillContentDir } from "./paths.js";
import { cmdShow } from "./show.js";
import { cmdInstall } from "./install.js";

function skillUsage(exitCode: number = 1): never {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Usage:
  hlx skill show                              Print the bundled hlx-cli skill to stdout
  hlx skill install [--target <path>]         Install skill to a directory
  hlx skill install [--for <claude|codex>]    Install skill for a specific agent
  hlx skill install [--force]                 Overwrite existing installation`);
  process.exit(exitCode);
}

export function runSkill(args: string[]): void {
  // Validate bundled skill content exists before any subcommand
  const skillContentDir = getSkillContentDir();

  const subcommand = args[0];
  const rest = args.slice(1);

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    skillUsage(0);
  }

  switch (subcommand) {
    case "show":
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx skill show");
        process.exit(0);
      }
      cmdShow(skillContentDir);
      break;

    case "install":
      if (isHelpRequested(rest)) {
        console.log(`Usage: hlx skill install [--target <path>] [--for <claude|codex>] [--force]

Options:
  --target <path>         Install to <path>/hlx-cli/
  --for <claude|codex>    Install for a specific agent
  --force                 Overwrite existing installation`);
        process.exit(0);
      }
      cmdInstall(rest, skillContentDir);
      break;

    default:
      if (subcommand) console.error(`Unknown skill command: ${subcommand}`);
      skillUsage();
  }
}

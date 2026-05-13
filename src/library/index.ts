import type { HxConfig } from "../lib/config.js";
import { isHelpRequested } from "../lib/flags.js";
import { extractLibraryItemRef, resolveLibraryItem } from "../lib/resolve-library-item.js";
import { cmdList } from "./list.js";
import { cmdShow } from "./show.js";
import { runLibraryComments } from "./comments.js";

function libraryUsage(exitCode: number = 1): never {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Usage:
  hlx library list
  hlx library show <ref>
  hlx library comments list|post <ref> [options]

Item references accept: internal ID, ticket short ID (e.g. RSH-439), or title substring.`);
  process.exit(exitCode);
}

export async function runLibrary(config: HxConfig, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    libraryUsage(0);
  }

  switch (subcommand) {
    case "list": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx library list");
        process.exit(0);
      }
      await cmdList(config, rest);
      break;
    }

    case "show": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx library show <ref>");
        process.exit(0);
      }
      const rawRef = extractLibraryItemRef(rest);
      const resolved = await resolveLibraryItem(config, rawRef);
      await cmdShow(config, resolved.id, rest);
      break;
    }

    case "comments": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx library comments list|post <ref> [options]");
        process.exit(0);
      }
      // For comments, we need to resolve the item first
      const commentsArgs = rest;
      const commentsSubcmd = commentsArgs[0];
      const commentsRest = commentsArgs.slice(1);

      if (commentsSubcmd === "list" || commentsSubcmd === "post") {
        const rawRef = extractLibraryItemRef(commentsRest);
        const resolved = await resolveLibraryItem(config, rawRef);
        await runLibraryComments(config, resolved.id, [commentsSubcmd, ...commentsRest]);
      } else {
        await runLibraryComments(config, "", commentsArgs);
      }
      break;
    }

    default:
      if (subcommand) console.error(`Unknown library command: ${subcommand}`);
      libraryUsage();
  }
}

import type { HxConfig } from "../lib/config.js";
import { isHelpRequested } from "../lib/flags.js";
import { cmdCommentsList } from "./comments-list.js";
import { cmdCommentsPost } from "./comments-post.js";

function commentsUsage(exitCode: number = 1): never {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Usage:
  hlx library comments list <ref> [--section <slug>]
  hlx library comments post <ref> --section <slug> --rating <value> [message]

Rating values: thumbs-up (up), thumbs-down (down), love.
Section accepts both raw slugs and heading text (auto-slugified).`);
  process.exit(exitCode);
}

export async function runLibraryComments(config: HxConfig, resolvedId: string, args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    commentsUsage(0);
  }

  switch (subcommand) {
    case "list": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx library comments list <ref> [--section <slug>]");
        process.exit(0);
      }
      await cmdCommentsList(config, resolvedId, rest);
      break;
    }

    case "post": {
      if (isHelpRequested(rest)) {
        console.log("Usage: hlx library comments post <ref> --section <slug> --rating <value> [message]");
        process.exit(0);
      }
      await cmdCommentsPost(config, resolvedId, rest);
      break;
    }

    default:
      if (subcommand) console.error(`Unknown library comments command: ${subcommand}`);
      commentsUsage();
  }
}

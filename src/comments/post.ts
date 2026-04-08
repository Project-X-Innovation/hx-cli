import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type PostCommentResponse = {
  comment: { id: string };
};

export async function cmdPost(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  // Collect message from positional args (everything that isn't a flag or flag value)
  const positional: string[] = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--ticket" || args[i] === "--since") {
      i += 2; // skip flag and its value
      continue;
    }
    if (args[i]!.startsWith("--")) {
      i += 1;
      continue;
    }
    positional.push(args[i]!);
    i += 1;
  }

  const message = positional.join(" ").trim();
  if (!message) {
    console.error("Error: Message content is required.");
    process.exit(1);
  }

  const data = (await hxFetch(config, `/tickets/${ticketId}/comments`, {
    method: "POST",
    body: { content: message, isHelixTagged: true },
    basePath: "/api",
  })) as PostCommentResponse;

  console.log(`Comment posted (id: ${data.comment.id})`);
}

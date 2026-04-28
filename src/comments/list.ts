import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getFlag } from "../lib/flags.js";

type CommentResponse = {
  comments: Array<{
    id: string;
    author: { name: string | null; email: string };
    content: string;
    isHelixTagged: boolean;
    isAgentAuthored: boolean;
    createdAt: string;
  }>;
};

export async function cmdList(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  const helixOnly = args.includes("--helix-only");
  const sinceRaw = getFlag(args, "--since");

  const data = (await hxFetch(config, `/tickets/${ticketId}/comments`, {
    basePath: "/api",
  })) as CommentResponse;

  let comments = data.comments;

  if (helixOnly) {
    comments = comments.filter((c) => c.isHelixTagged);
  }

  if (sinceRaw) {
    const sinceDate = new Date(sinceRaw);
    if (!Number.isNaN(sinceDate.getTime())) {
      comments = comments.filter((c) => new Date(c.createdAt) > sinceDate);
    }
  }

  if (comments.length === 0) {
    console.log("No comments found.");
    return;
  }

  for (const comment of comments) {
    const authorLabel = comment.isAgentAuthored
      ? "Helix"
      : (comment.author.name ?? comment.author.email);
    const markers: string[] = [];
    if (comment.isHelixTagged) markers.push("Helix");
    if (comment.isAgentAuthored) markers.push("Agent");
    const markerStr = markers.length > 0 ? ` [${markers.join(", ")}]` : "";
    console.log(`[${comment.createdAt}] ${authorLabel}${markerStr}: ${comment.content}`);
  }
}

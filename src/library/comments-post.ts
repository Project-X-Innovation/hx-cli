import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getFlag, getPositionalArgs, requireFlag } from "../lib/flags.js";

const RATING_MAP: Record<string, string> = {
  "thumbs-up": "THUMBS_UP",
  "up": "THUMBS_UP",
  "thumbs-down": "THUMBS_DOWN",
  "down": "THUMBS_DOWN",
  "love": "LOVE",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function cmdCommentsPost(config: HxConfig, resolvedId: string, args: string[]): Promise<void> {
  let section = requireFlag(args, "--section", "--section <slug> is required for posting comments.");
  // Auto-slugify heading text if it contains spaces
  if (/\s/.test(section)) {
    section = slugify(section);
  }

  // Read --reply-to first to determine if --rating is required
  const replyTo = getFlag(args, "--reply-to");

  let rating: string | undefined;
  if (replyTo) {
    // Reply mode: --rating is optional
    const ratingRaw = getFlag(args, "--rating");
    if (ratingRaw) {
      rating = RATING_MAP[ratingRaw.toLowerCase()];
      if (!rating) {
        console.error(`Error: Unknown rating "${ratingRaw}". Valid values: thumbs-up (up), thumbs-down (down), love.`);
        process.exit(1);
      }
    }
  } else {
    // Top-level mode: --rating is required
    const ratingRaw = requireFlag(args, "--rating", "--rating <value> is required. Values: thumbs-up, thumbs-down, love, up, down.");
    rating = RATING_MAP[ratingRaw.toLowerCase()];
    if (!rating) {
      console.error(`Error: Unknown rating "${ratingRaw}". Valid values: thumbs-up (up), thumbs-down (down), love.`);
      process.exit(1);
    }
  }

  // Remaining positional args = message text
  const positional = getPositionalArgs(args, ["--section", "--rating", "--reply-to", "--item"]);
  const content = positional.length > 0 ? positional.join(" ") : undefined;

  const body: Record<string, unknown> = { anchor: section };
  if (rating) body.rating = rating;
  if (content) body.content = content;
  if (replyTo) body.parentCommentId = replyTo;

  try {
    await hxFetch(config, `/library/items/${resolvedId}/comments`, {
      basePath: "/api",
      method: "POST",
      body,
    });

    const label = rating ? `[${Object.entries(RATING_MAP).find(([, v]) => v === rating)?.[0] ?? rating}]` : "[reply]";
    const textPart = content ? `: "${content}"` : "";
    console.log(`Posted: ${label} on ${section}${textPart}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error posting comment: ${message}`);
    process.exit(1);
  }
}

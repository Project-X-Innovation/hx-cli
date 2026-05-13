import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type LibraryItemDetail = {
  item: {
    id: string;
    title: string;
    content: string | null;
  };
};

type CommentSummary = Record<string, { THUMBS_UP: number; LOVE: number; THUMBS_DOWN: number; total: number }>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function cmdShow(config: HxConfig, resolvedId: string, _args: string[]): Promise<void> {
  const detail = (await hxFetch(config, `/library/items/${resolvedId}`, { basePath: "/api" })) as LibraryItemDetail;
  const item = detail.item;

  if (!item.content) {
    console.log(`# ${item.title} (${item.id})\n\nNo content available.`);
    return;
  }

  // Fetch comment summary
  let summary: CommentSummary = {};
  try {
    const summaryData = (await hxFetch(config, `/library/items/${resolvedId}/comments/summary`, { basePath: "/api" })) as { summary: CommentSummary };
    summary = summaryData.summary;
  } catch {
    // Summary unavailable, continue without it
  }

  console.log(`# ${item.title} (${item.id})\n`);

  // Parse headings from markdown and annotate
  const lines = item.content.split("\n");
  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const [, hashes, text] = headingMatch;
      const slug = slugify(text);
      const sectionSummary = summary[slug];

      let annotation = `${hashes} ${text} [${slug}]`;
      if (sectionSummary && sectionSummary.total > 0) {
        const parts: string[] = [];
        if (sectionSummary.THUMBS_UP > 0) parts.push(`${sectionSummary.THUMBS_UP} thumbs-up`);
        if (sectionSummary.LOVE > 0) parts.push(`${sectionSummary.LOVE} love`);
        if (sectionSummary.THUMBS_DOWN > 0) parts.push(`${sectionSummary.THUMBS_DOWN} thumbs-down`);
        annotation += ` (${sectionSummary.total} comment${sectionSummary.total !== 1 ? "s" : ""}: ${parts.join(", ")})`;
      }
      console.log(annotation);
    } else {
      // Skip non-heading content for brevity
    }
  }
}

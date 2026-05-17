import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getFlag } from "../lib/flags.js";

type LibraryComment = {
  id: string;
  anchor: string;
  rating: string | null;
  content: string | null;
  authorUser: { name: string | null; email: string };
  parentCommentId: string | null;
  createdAt: string;
};

type CommentsResponse = { comments: LibraryComment[] };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10);
}

export async function cmdCommentsList(config: HxConfig, resolvedId: string, args: string[]): Promise<void> {
  // Parse optional --section flag
  let sectionFilter = getFlag(args, "--section");
  if (sectionFilter && /\s/.test(sectionFilter)) {
    // Auto-slugify if it contains spaces (heading text)
    sectionFilter = slugify(sectionFilter);
  }

  const queryParams: Record<string, string> = {};
  if (sectionFilter) queryParams.anchor = sectionFilter;

  let data: CommentsResponse;
  try {
    data = (await hxFetch(config, `/library/items/${resolvedId}/comments`, {
      basePath: "/api",
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    })) as CommentsResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error fetching comments: ${message}`);
    process.exit(1);
  }

  const comments = data.comments;

  if (comments.length === 0) {
    console.log("No comments found.");
    return;
  }

  // Group by anchor
  const grouped: Record<string, LibraryComment[]> = {};
  for (const c of comments) {
    if (!grouped[c.anchor]) grouped[c.anchor] = [];
    grouped[c.anchor].push(c);
  }

  for (const [anchor, sectionComments] of Object.entries(grouped)) {
    const topLevel = sectionComments.filter((c) => c.parentCommentId === null);
    console.log(`\n## ${anchor} (${topLevel.length} comment${topLevel.length !== 1 ? "s" : ""})`);

    for (const comment of topLevel) {
      const author = comment.authorUser.name ?? comment.authorUser.email;
      const ratingLabel = comment.rating ? comment.rating.toLowerCase().replace("_", "-") : "reply";
      const text = comment.content ? `: "${comment.content}"` : "";
      console.log(`  (${comment.id}) [${ratingLabel}] ${author} (${formatDate(comment.createdAt)})${text}`);

      // Show replies
      const replies = sectionComments.filter((c) => c.parentCommentId === comment.id);
      for (const reply of replies) {
        const replyAuthor = reply.authorUser.name ?? reply.authorUser.email;
        const replyText = reply.content ? `: "${reply.content}"` : "";
        console.log(`    -> (${reply.id}) [reply] ${replyAuthor} (${formatDate(reply.createdAt)})${replyText}`);
      }
    }
  }
}

import type { HxConfig } from "./config.js";
import { hxFetch } from "./http.js";
import { getFlag } from "./flags.js";

type LibraryItem = {
  id: string;
  title: string;
  ticketShortId?: string | null;
  [key: string]: unknown;
};

type LibraryItemsResponse = { items: LibraryItem[] };

/**
 * Extract a library item reference from CLI args.
 * Priority: --item flag > first positional arg.
 */
export function extractLibraryItemRef(args: string[]): string {
  const flagValue = getFlag(args, "--item");
  if (flagValue) return flagValue;

  // First positional arg (non-flag)
  const positional = args.find((a) => !a.startsWith("-"));
  if (positional) return positional;

  console.error("Error: No library item reference provided. Use --item <ref> or pass as positional arg.");
  console.error("Accepted formats: internal ID (cuid), ticket short ID (e.g. RSH-439), or title substring.");
  process.exit(1);
}

/**
 * Resolve a library item reference to the canonical { id, title } by fetching
 * the library items list from the API.
 */
export async function resolveLibraryItem(
  config: HxConfig,
  ref: string,
): Promise<{ id: string; title: string }> {
  let items: LibraryItem[];
  try {
    const data = (await hxFetch(config, "/library/items", { basePath: "/api" })) as LibraryItemsResponse;
    items = data.items;
  } catch (error) {
    throw new Error(
      "Failed to fetch library items for resolution: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }

  // 1. Exact cuid match
  const byId = items.find((i) => i.id === ref);
  if (byId) return { id: byId.id, title: byId.title };

  // 2. Ticket short ID match (case-insensitive)
  if (/^[A-Z]+-\d+$/i.test(ref)) {
    const refLower = ref.toLowerCase();
    const byShortId = items.find((i) =>
      i.ticketShortId?.toLowerCase() === refLower,
    );
    if (byShortId) return { id: byShortId.id, title: byShortId.title };
  }

  // 3. Title substring match (case-insensitive)
  const refLower = ref.toLowerCase();
  const titleMatches = items.filter((i) =>
    i.title.toLowerCase().includes(refLower),
  );
  if (titleMatches.length === 1) {
    return { id: titleMatches[0].id, title: titleMatches[0].title };
  }
  if (titleMatches.length > 1) {
    const list = titleMatches.map((i) => `  ${i.title} (${i.id})`).join("\n");
    throw new Error(
      `Ambiguous library item reference "${ref}" matches multiple items:\n${list}\nUse the full ID or ticket short ID instead.`,
    );
  }

  throw new Error(
    `Library item "${ref}" not found. Accepted formats: internal ID, ticket short ID (e.g. RSH-439), or title substring.`,
  );
}

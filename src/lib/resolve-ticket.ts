import type { HxConfig } from "./config.js";
import { hxFetch } from "./http.js";
import { getFlag } from "./flags.js";

type TicketItem = {
  id: string;
  shortId: string;
  [key: string]: unknown;
};

type TicketsResponse = { items: TicketItem[] };

/**
 * Extract a raw ticket reference from CLI args.
 * Priority: --ticket flag > HELIX_TICKET_ID env var > first positional arg.
 */
export function extractTicketRef(args: string[]): string {
  const flagValue = getFlag(args, "--ticket");
  if (flagValue) return flagValue;

  const envValue = process.env.HELIX_TICKET_ID;
  if (envValue) return envValue;

  // First positional arg (non-flag)
  const positional = args.find((a) => !a.startsWith("-"));
  if (positional) return positional;

  console.error("Error: No ticket reference provided. Use --ticket <ref>, set HELIX_TICKET_ID, or pass as positional arg.");
  console.error("Accepted formats: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).");
  process.exit(1);
}

/**
 * Pure function: match a ticket reference against a list of ticket items.
 * Returns the matched item, or null if no match or ambiguous.
 *
 * Match priority:
 *  1. Exact internal ID match
 *  2. Exact short ID match (case-insensitive)
 *  3. Numeric ticket number match (suffix after last '-' in shortId)
 *
 * Returns null for ambiguous numeric matches (multiple items share the same suffix).
 */
export function matchTicket(
  items: Array<{ id: string; shortId: string }>,
  ref: string,
): { id: string; shortId: string } | null {
  // 1. Exact internal ID match
  const byId = items.find((t) => t.id === ref);
  if (byId) return byId;

  // 2. Exact short ID match (case-insensitive)
  const refLower = ref.toLowerCase();
  const byShortId = items.find((t) => t.shortId.toLowerCase() === refLower);
  if (byShortId) return byShortId;

  // 3. Numeric ticket number match
  const refNum = parseInt(ref, 10);
  if (!isNaN(refNum) && String(refNum) === ref.trim()) {
    const matches: Array<{ id: string; shortId: string }> = [];
    for (const item of items) {
      const dashIdx = item.shortId.lastIndexOf("-");
      if (dashIdx >= 0) {
        const suffix = item.shortId.slice(dashIdx + 1);
        const suffixNum = parseInt(suffix, 10);
        if (!isNaN(suffixNum) && suffixNum === refNum) {
          matches.push(item);
        }
      }
    }
    if (matches.length === 1) return matches[0]!;
    // Ambiguous (>1) or no match (0) — return null
    return null;
  }

  return null;
}

/**
 * Resolve a ticket reference (internal ID, short ID, or numeric number) to
 * the canonical { id, shortId } by fetching the ticket list from the API.
 */
export async function resolveTicket(
  config: HxConfig,
  ref: string,
): Promise<{ id: string; shortId: string }> {
  let items: TicketItem[];
  try {
    const data = (await hxFetch(config, "/tickets", { basePath: "/api" })) as TicketsResponse;
    items = data.items;
  } catch (error) {
    throw new Error(
      "Failed to fetch ticket list for resolution: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }

  const matched = matchTicket(items, ref);
  if (matched) return matched;

  // Check for ambiguous numeric match for better error messaging
  const refNum = parseInt(ref, 10);
  if (!isNaN(refNum) && String(refNum) === ref.trim()) {
    const ambiguous: Array<{ id: string; shortId: string }> = [];
    for (const item of items) {
      const dashIdx = item.shortId.lastIndexOf("-");
      if (dashIdx >= 0) {
        const suffix = item.shortId.slice(dashIdx + 1);
        const suffixNum = parseInt(suffix, 10);
        if (!isNaN(suffixNum) && suffixNum === refNum) {
          ambiguous.push(item);
        }
      }
    }
    if (ambiguous.length > 1) {
      const list = ambiguous.map((t) => `  ${t.shortId} (${t.id})`).join("\n");
      throw new Error(
        `Ambiguous ticket number "${ref}" matches multiple tickets in org "${config.orgName ?? "unknown"}":\n${list}\nUse the full short ID or internal ID instead.`,
      );
    }
  }

  throw new Error(
    `Ticket "${ref}" not found in org "${config.orgName ?? "unknown"}". ` +
      `Accepted formats: internal ID, short ID (e.g. BLD-339), or ticket number (e.g. 339).`,
  );
}

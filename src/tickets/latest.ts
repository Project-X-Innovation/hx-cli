import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getFlag, hasFlag } from "../lib/flags.js";
import { printTicketDetail } from "./get.js";

type TicketItem = {
  id: string;
  shortId: string;
  title: string;
  status: string;
  updatedAt: string;
};

type TicketsResponse = { items: TicketItem[] };

export async function cmdTicketsLatest(config: HxConfig, args: string[]): Promise<void> {
  const queryParams: Record<string, string> = {};

  if (hasFlag(args, "--archived")) {
    queryParams.archived = "true";
  }

  const statusNotIn = getFlag(args, "--status-not-in");
  if (statusNotIn) {
    queryParams.statusNotIn = statusNotIn;
  }

  const sprintId = getFlag(args, "--sprint");
  if (sprintId) {
    queryParams.sprintId = sprintId;
  }

  const data = (await hxFetch(config, "/tickets", {
    basePath: "/api",
    queryParams,
  })) as TicketsResponse;

  if (data.items.length === 0) {
    console.log("No tickets found.");
    return;
  }

  // Backend returns sorted by updatedAt desc, so first item is latest
  const latest = data.items[0]!;
  await printTicketDetail(config, latest.id);
}

import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getFlag, hasFlag } from "../lib/flags.js";

type TicketItem = {
  id: string;
  shortId: string;
  title: string;
  status: string;
  updatedAt: string;
  reporter: { id: string; email: string; name: string | null };
};

type TicketsResponse = { items: TicketItem[] };

type Member = { id: string; email: string; name: string | null };
type MembersResponse = { members: Member[] };

async function resolveUserId(config: HxConfig, input: string): Promise<string> {
  const data = (await hxFetch(config, "/organization/members", { basePath: "/api" })) as MembersResponse;

  // Try exact email match first
  const byEmail = data.members.find((m) => m.email.toLowerCase() === input.toLowerCase());
  if (byEmail) return byEmail.id;

  // Try case-insensitive name match
  const byName = data.members.find((m) => m.name?.toLowerCase() === input.toLowerCase());
  if (byName) return byName.id;

  console.error(`Error: No user found matching "${input}".`);
  console.error("Available members:");
  for (const m of data.members) {
    console.error(`  ${m.email}${m.name ? ` (${m.name})` : ""}`);
  }
  process.exit(1);
}

export async function cmdTicketsList(config: HxConfig, args: string[]): Promise<void> {
  const queryParams: Record<string, string> = {};

  // --archived (boolean flag)
  if (hasFlag(args, "--archived")) {
    queryParams.archived = "true";
  }

  // --status-not-in <statuses>
  const statusNotIn = getFlag(args, "--status-not-in");
  if (statusNotIn) {
    queryParams.statusNotIn = statusNotIn;
  }

  // --sprint <id>
  const sprintId = getFlag(args, "--sprint");
  if (sprintId) {
    queryParams.sprintId = sprintId;
  }

  // --user <email-or-name> -> resolve to reporterUserId
  const userInput = getFlag(args, "--user");
  if (userInput) {
    const reporterUserId = await resolveUserId(config, userInput);
    queryParams.reporterUserId = reporterUserId;
  }

  // --status <status> (client-side filter since API doesn't have direct status param)
  const statusFilter = getFlag(args, "--status");

  const data = (await hxFetch(config, "/tickets", {
    basePath: "/api",
    queryParams,
  })) as TicketsResponse;

  let items = data.items;

  // Apply client-side status filter
  if (statusFilter) {
    items = items.filter((t) => t.status.toLowerCase() === statusFilter.toLowerCase());
  }

  if (items.length === 0) {
    console.log("No tickets found.");
    return;
  }

  for (const ticket of items) {
    const reporter = ticket.reporter.name ?? ticket.reporter.email;
    const updated = new Date(ticket.updatedAt).toLocaleString();
    console.log(`${ticket.shortId}  ${ticket.status.padEnd(12)}  ${reporter.padEnd(20)}  ${updated}  ${ticket.title}`);
  }
}

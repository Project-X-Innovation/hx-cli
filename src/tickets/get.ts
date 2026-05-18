import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { hasFlag } from "../lib/flags.js";

type RelatedTicket = {
  id: string;
  title: string;
  status: string;
  shortId: string;
  mode: string;
  approvalStatus: string | null;
};

type TicketDetail = {
  id: string;
  shortId: string;
  title: string;
  description: string | null;
  status: string;
  branchName: string;
  reporter: { id: string; email: string; name: string | null };
  repositories: Array<{ displayName: string; repoUrl: string }>;
  runs: Array<{
    id: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
  }>;
  mergeQueueStatus: string | null;
  approvalStatus: string | null;
  isArchived: boolean;
  afterTicketId: string | null;
  afterTicket: RelatedTicket | null;
  implementFromTicketId: string | null;
  implementFromTicket: RelatedTicket | null;
  referencedTicketIds: string[];
  referencedTickets: RelatedTicket[];
};

type TicketResponse = { ticket: TicketDetail };

const TERMINAL_STATUSES = new Set(["failed", "error", "cancelled", "completed", "succeeded"]);

/**
 * Safely format a date value for display.
 * Returns a human-readable string, "in progress", "N/A", or "unknown".
 */
export function formatDate(value: string | null | undefined, runStatus?: string): string {
  if (value === null || value === undefined) {
    if (runStatus && TERMINAL_STATUSES.has(runStatus.toLowerCase())) {
      return "N/A";
    }
    return "in progress";
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return "unknown";
  }
  return d.toLocaleString();
}

export async function printTicketDetail(config: HxConfig, ticketId: string): Promise<TicketDetail> {
  const data = (await hxFetch(config, `/tickets/${ticketId}`, { basePath: "/api" })) as TicketResponse;
  const ticket = data.ticket;

  console.log(`Title:        ${ticket.title}`);
  console.log(`Short ID:     ${ticket.shortId}`);
  console.log(`Status:       ${ticket.status}`);
  console.log(`Branch:       ${ticket.branchName}`);
  console.log(`Reporter:     ${ticket.reporter.name ?? ticket.reporter.email}`);
  console.log(`Archived:     ${ticket.isArchived}`);

  if (ticket.mergeQueueStatus) {
    console.log(`Merge Status: ${ticket.mergeQueueStatus}`);
  }
  if (ticket.approvalStatus) {
    console.log(`Approval:     ${ticket.approvalStatus}`);
  }

  if (ticket.afterTicket) {
    console.log(`Depends on:   ${ticket.afterTicket.shortId} (${ticket.afterTicket.title}) - ${ticket.afterTicket.status}`);
  }
  if (ticket.implementFromTicket) {
    console.log(`Implements:   ${ticket.implementFromTicket.shortId} (${ticket.implementFromTicket.title}) - ${ticket.implementFromTicket.status}`);
  }
  if (ticket.referencedTickets && ticket.referencedTickets.length > 0) {
    const refs = ticket.referencedTickets.map((r) => `${r.shortId} (${r.title}) - ${r.status}`).join(", ");
    console.log(`References:   ${refs}`);
  }

  if (ticket.repositories.length > 0) {
    console.log(`\nRepositories:`);
    for (const repo of ticket.repositories) {
      console.log(`  ${repo.displayName}  ${repo.repoUrl}`);
    }
  }

  if (ticket.runs.length > 0) {
    console.log(`\nRuns:`);
    for (const run of ticket.runs) {
      const created = formatDate(run.startedAt);
      const completed = formatDate(run.finishedAt, run.status);
      console.log(`  ${run.id}  ${run.status.padEnd(12)}  ${created}  ${completed}`);
    }
  }

  if (ticket.description) {
    const desc = ticket.description.length > 500 ? ticket.description.slice(0, 500) + "..." : ticket.description;
    console.log(`\nDescription:\n${desc}`);
  }

  return ticket;
}

export async function cmdTicketsGet(config: HxConfig, ticketId: string, args?: string[]): Promise<void> {
  const jsonOutput = args && hasFlag(args, "--json");

  if (jsonOutput) {
    const data = (await hxFetch(config, `/tickets/${ticketId}`, { basePath: "/api" })) as TicketResponse;
    console.log(JSON.stringify(data.ticket, null, 2));
  } else {
    await printTicketDetail(config, ticketId);
  }
}

import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

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
    createdAt: string;
    completedAt: string | null;
  }>;
  mergeQueueStatus: string | null;
  isArchived: boolean;
};

export async function printTicketDetail(config: HxConfig, ticketId: string): Promise<void> {
  const ticket = (await hxFetch(config, `/tickets/${ticketId}`, { basePath: "/api" })) as TicketDetail;

  console.log(`Title:        ${ticket.title}`);
  console.log(`Short ID:     ${ticket.shortId}`);
  console.log(`Status:       ${ticket.status}`);
  console.log(`Branch:       ${ticket.branchName}`);
  console.log(`Reporter:     ${ticket.reporter.name ?? ticket.reporter.email}`);
  console.log(`Archived:     ${ticket.isArchived}`);

  if (ticket.mergeQueueStatus) {
    console.log(`Merge Status: ${ticket.mergeQueueStatus}`);
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
      const created = new Date(run.createdAt).toLocaleString();
      const completed = run.completedAt ? new Date(run.completedAt).toLocaleString() : "in progress";
      console.log(`  ${run.id}  ${run.status.padEnd(12)}  ${created}  ${completed}`);
    }
  }

  if (ticket.description) {
    const desc = ticket.description.length > 500 ? ticket.description.slice(0, 500) + "..." : ticket.description;
    console.log(`\nDescription:\n${desc}`);
  }
}

export async function cmdTicketsGet(config: HxConfig, ticketId: string): Promise<void> {
  await printTicketDetail(config, ticketId);
}

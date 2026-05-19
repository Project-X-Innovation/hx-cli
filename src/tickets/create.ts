import { readFileSync, accessSync, statSync, constants } from "node:fs";
import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { requireFlag, getFlag, isHelpRequested } from "../lib/flags.js";
import { resolveAllRepos } from "../lib/resolve-repo.js";
import { resolveTicket } from "../lib/resolve-ticket.js";

type CreateTicketResponse = {
  ticket: { id: string; shortId?: string; mode?: string; status: string };
  run?: { id: string };
};

const VALID_MODES = ["AUTO", "BUILD", "FIX", "RESEARCH", "EXECUTE"] as const;

export async function cmdTicketsCreate(config: HxConfig, args: string[]): Promise<void> {
  if (isHelpRequested(args)) {
    console.log("Usage: hlx tickets create --title <title> --description <desc> | --description-file <path> --repos <name1,name2> [--mode <AUTO|BUILD|FIX|RESEARCH|EXECUTE>] [--after <ticket-ref>] [--reference <ref1,ref2>] [--implement-from <ticket-ref>]");
    process.exit(0);
  }

  const title = requireFlag(args, "--title", "--title <title> is required.");

  // --- Description handling: --description and --description-file are mutually exclusive ---
  const descriptionRaw = getFlag(args, "--description");
  const descriptionFile = getFlag(args, "--description-file");

  if (descriptionRaw !== undefined && descriptionFile !== undefined) {
    console.error("Error: --description and --description-file are mutually exclusive.");
    process.exit(1);
  }

  if (descriptionRaw === undefined && descriptionFile === undefined) {
    console.error("Error: Either --description <text> or --description-file <path> is required.");
    process.exit(1);
  }

  let description: string;

  if (descriptionFile !== undefined) {
    // Read description from file
    try {
      description = readFileSync(descriptionFile, "utf-8");
    } catch (err) {
      console.error(`Error: Cannot read file: ${descriptionFile}: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else {
    // --description was provided; check if the value is a readable file path
    try {
      accessSync(descriptionRaw!, constants.R_OK);
      if (statSync(descriptionRaw!).isFile()) {
        console.error(`Error: --description value appears to be a file path ("${descriptionRaw}"). Use --description-file <path> to load from a file.`);
        process.exit(1);
      }
    } catch {
      // Not a readable file — use as literal description (this is expected)
    }
    description = descriptionRaw!;
  }

  // --- Repo resolution ---
  const reposRaw = requireFlag(args, "--repos", "--repos <repo1,repo2> is required.");
  const repoEntries = reposRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  if (repoEntries.length === 0) {
    console.error("Error: At least one repository is required in --repos.");
    process.exit(1);
  }

  let repositoryIds: string[];
  try {
    repositoryIds = await resolveAllRepos(config, repoEntries);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Run "hlx inspect repos" to see available repositories.');
    process.exit(1);
  }

  const modeRaw = getFlag(args, "--mode");
  let mode: string | undefined;
  if (modeRaw !== undefined) {
    const normalized = modeRaw.toUpperCase();
    if (!(VALID_MODES as readonly string[]).includes(normalized)) {
      console.error(`Error: Invalid mode "${modeRaw}". Allowed values: ${VALID_MODES.join(", ")}`);
      process.exit(1);
    }
    mode = normalized;
  }

  // --- Relationship flags ---
  const afterRef = getFlag(args, "--after");
  const referenceRaw = getFlag(args, "--reference");
  const implementFromRef = getFlag(args, "--implement-from");

  let afterTicketId: string | undefined;
  if (afterRef) {
    try {
      const resolved = await resolveTicket(config, afterRef);
      afterTicketId = resolved.id;
      console.log(`Resolved --after "${afterRef}" to ${resolved.shortId} (${resolved.id})`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  let implementFromTicketId: string | undefined;
  if (implementFromRef) {
    try {
      const resolved = await resolveTicket(config, implementFromRef);
      implementFromTicketId = resolved.id;
      console.log(`Resolved --implement-from "${implementFromRef}" to ${resolved.shortId} (${resolved.id})`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  let referencedTicketIds: string[] | undefined;
  if (referenceRaw) {
    const refs = referenceRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    if (refs.length > 5) {
      console.error("Error: --reference accepts at most 5 ticket references.");
      process.exit(1);
    }
    referencedTicketIds = [];
    for (const ref of refs) {
      try {
        const resolved = await resolveTicket(config, ref);
        referencedTicketIds.push(resolved.id);
        console.log(`Resolved --reference "${ref}" to ${resolved.shortId} (${resolved.id})`);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }
  }

  let data: CreateTicketResponse;
  try {
    data = (await hxFetch(config, "/tickets", {
      method: "POST",
      body: {
        title,
        description,
        repositoryIds,
        ...(mode && { mode }),
        ...(afterTicketId && { afterTicketId }),
        ...(implementFromTicketId && { implementFromTicketId }),
        ...(referencedTicketIds && referencedTicketIds.length > 0 && { referencedTicketIds }),
      },
      basePath: "/api",
    })) as CreateTicketResponse;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Attempt to extract server error from em-dash separated response body
    const dashIdx = msg.indexOf(" — ");
    if (dashIdx !== -1) {
      const bodyPart = msg.slice(dashIdx + 3);
      try {
        const parsed = JSON.parse(bodyPart);
        if (parsed.error) {
          console.error(`Error: ${parsed.error}`);
          process.exit(1);
        }
      } catch {
        // JSON parse failed — fall through to raw message
      }
    }
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  console.log(`Ticket created:`);
  console.log(`  ID:       ${data.ticket.id}`);
  console.log(`  Short ID: ${data.ticket.shortId ?? "(pending)"}`);
  console.log(`  Status:   ${data.ticket.status}`);
  if (data.ticket.mode) {
    console.log(`  Mode:     ${data.ticket.mode}`);
  }
  if (data.run) {
    console.log(`  Run ID:   ${data.run.id}`);
  }
}

import { readFileSync } from "node:fs";
import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";
import { getFlag } from "../lib/flags.js";

export async function cmdTicketsUpdateDescription(config: HxConfig, ticketId: string, args: string[]): Promise<void> {
  const filePath = getFlag(args, "--file");
  const text = getFlag(args, "--text");

  if (filePath !== undefined && text !== undefined) {
    console.error("Error: --file and --text are mutually exclusive.");
    process.exit(1);
  }

  if (filePath === undefined && text === undefined) {
    console.error("Error: Either --file <path> or --text <string> is required.");
    process.exit(1);
  }

  let description: string;

  if (filePath !== undefined) {
    try {
      description = readFileSync(filePath, "utf-8");
    } catch (err) {
      console.error(`Error: Cannot read file: ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else {
    description = text!;
  }

  await hxFetch(config, `/tickets/${ticketId}`, {
    method: "PATCH",
    body: { description },
    basePath: "/api",
  });

  console.log(`Description updated for ticket ${ticketId}.`);
}

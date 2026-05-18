import type { HxConfig } from "../lib/config.js";
import { hxFetch } from "../lib/http.js";

type LibraryItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

type LibraryItemsResponse = { items: LibraryItem[] };

export async function cmdList(config: HxConfig, _args: string[]): Promise<void> {
  const data = (await hxFetch(config, "/library/items", { basePath: "/api" })) as LibraryItemsResponse;
  const items = data.items;

  if (items.length === 0) {
    console.log("No library items found.");
    return;
  }

  // Table header
  const idWidth = 14;
  const titleWidth = 40;
  const statusWidth = 12;
  const dateWidth = 12;

  console.log(
    "ID".padEnd(idWidth) +
    "Title".padEnd(titleWidth) +
    "Status".padEnd(statusWidth) +
    "Date".padEnd(dateWidth),
  );
  console.log("-".repeat(idWidth + titleWidth + statusWidth + dateWidth));

  for (const item of items) {
    const id = item.id.length > idWidth - 2 ? item.id.slice(0, idWidth - 2) + ".." : item.id;
    const title = item.title.length > titleWidth - 2 ? item.title.slice(0, titleWidth - 2) + ".." : item.title;
    const date = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : "";

    console.log(
      id.padEnd(idWidth) +
      title.padEnd(titleWidth) +
      item.status.padEnd(statusWidth) +
      date.padEnd(dateWidth),
    );
  }
}

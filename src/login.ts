import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { exec } from "node:child_process";
import { createInterface } from "node:readline";
import { saveConfig } from "./lib/config.js";

function openBrowser(url: string): void {
  const cmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${cmd} "${url}"`);
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runLogin(args: string[]): Promise<void> {
  const isManual = args.includes("--manual");
  const serverUrl = args.find((a) => !a.startsWith("--"))?.replace(/\/+$/, "");

  if (isManual) {
    const url = serverUrl ?? await prompt("Helix server URL: ");
    const apiKey = await prompt("API key (hxi_...): ");
    if (!url || !apiKey) {
      console.error("Both URL and API key are required.");
      process.exit(1);
    }
    saveConfig({ apiKey, url: url.replace(/\/+$/, "") });
    console.error("Saved to ~/.hx/config.json");
    return;
  }

  if (!serverUrl) {
    console.error("Usage: hx login <server-url>");
    console.error("       hx login --manual");
    process.exit(1);
  }

  const state = randomBytes(16).toString("hex");

  const result = await new Promise<{ key: string }>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end();
        return;
      }

      const key = url.searchParams.get("key");
      const returnedState = url.searchParams.get("state");

      if (returnedState !== state) {
        res.writeHead(400);
        res.end("State mismatch — possible CSRF. Please try again.");
        reject(new Error("State mismatch"));
        server.close();
        return;
      }

      if (!key) {
        res.writeHead(400);
        res.end("No key received.");
        reject(new Error("No key in callback"));
        server.close();
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h2>Authenticated!</h2><p>You can close this tab and return to your terminal.</p></body></html>");
      resolve({ key });
      server.close();
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start local server"));
        return;
      }
      const port = addr.port;
      const authUrl = `${serverUrl}/auth/cli?port=${port}&state=${state}`;
      console.error(`Opening browser to authorize...`);
      console.error(authUrl);
      openBrowser(authUrl);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      reject(new Error("Login timed out after 2 minutes"));
      server.close();
    }, 120_000);
  });

  saveConfig({ apiKey: result.key, url: serverUrl });
  console.error("Authenticated! Config saved to ~/.hx/config.json");
}

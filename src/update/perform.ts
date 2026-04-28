import { execSync } from "node:child_process";
import { CANONICAL_REPO, CANONICAL_BRANCH } from "./check.js";

/**
 * Execute the self-update via npm install -g from the canonical GitHub repo.
 * Returns a structured result — never throws.
 */
export function performUpdate(options?: {
  quiet?: boolean;
}): { success: boolean; error?: string } {
  const quiet = options?.quiet ?? false;
  const installSpec = `github:${CANONICAL_REPO}#${CANONICAL_BRANCH}`;

  try {
    execSync(`npm install -g ${installSpec}`, {
      timeout: 120_000,
      stdio: quiet ? ["pipe", "pipe", "pipe"] : "inherit",
      env: { ...process.env, HLX_SKIP_UPDATE_CHECK: "1" },
    });
    return { success: true };
  } catch (err: unknown) {
    let message = "Update failed";
    if (err instanceof Error) {
      const execErr = err as Error & { stderr?: Buffer | string };
      if (execErr.stderr) {
        message = String(execErr.stderr).trim() || message;
      } else {
        message = err.message;
      }
    }
    return { success: false, error: message };
  }
}

import { spawnSync } from "node:child_process";
import { NPM_PACKAGE } from "./check.js";

/**
 * Execute the self-update via npm install -g from the npm registry.
 * Returns a structured result — never throws.
 *
 * When `quiet` is true, stderr is captured and returned for downstream
 * diagnostic use (e.g. surfacing npm tar warnings on validation failure).
 */
export function performUpdate(options?: {
  quiet?: boolean;
}): { success: boolean; error?: string; stderr?: string } {
  const quiet = options?.quiet ?? false;
  const installSpec = `${NPM_PACKAGE}@latest`;

  const result = spawnSync(`npm install -g ${installSpec}`, {
    timeout: 120_000,
    stdio: quiet ? ["pipe", "pipe", "pipe"] : "inherit",
    shell: true,
    encoding: "utf8",
    env: { ...process.env, HLX_SKIP_UPDATE_CHECK: "1" },
  });

  // Handle spawn-level failure (e.g. npm not found)
  if (result.error) {
    return {
      success: false,
      error: `Failed to start npm: ${result.error.message}`,
      stderr: quiet ? (result.stderr ?? undefined) : undefined,
    };
  }

  if (result.status !== 0) {
    const message =
      (quiet && result.stderr ? result.stderr.trim() : "") || "Update failed";
    return {
      success: false,
      error: message,
      stderr: quiet ? (result.stderr ?? undefined) : undefined,
    };
  }

  return {
    success: true,
    stderr: quiet ? (result.stderr ?? undefined) : undefined,
  };
}

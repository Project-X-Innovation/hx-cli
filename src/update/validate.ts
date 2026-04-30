import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Validate that the globally-installed helix-cli package is usable.
 *
 * 1. Resolves the global node_modules path via `npm root -g`.
 * 2. Checks that the bin target (`dist/index.js`) exists on disk.
 * 3. Runs `node <binTarget> --version` to confirm the CLI can start.
 *
 * Returns a structured result — never throws.
 */
export function validateInstall(): {
  valid: boolean;
  binTargetPath: string;
  error?: string;
} {
  // Resolve global node_modules path
  const rootResult = spawnSync("npm root -g", {
    shell: true,
    encoding: "utf8",
    timeout: 15_000,
  });

  if (rootResult.error || rootResult.status !== 0 || !rootResult.stdout?.trim()) {
    const detail =
      rootResult.error?.message ??
      rootResult.stderr?.trim() ??
      "empty output";
    return {
      valid: false,
      binTargetPath: "",
      error: `Failed to resolve global npm root: ${detail}`,
    };
  }

  const globalRoot = rootResult.stdout.trim();

  // Construct the bin target path from the known package bin contract
  const binTargetPath = join(
    globalRoot,
    "@projectxinnovation",
    "helix-cli",
    "dist",
    "index.js",
  );

  // Check file existence
  if (!existsSync(binTargetPath)) {
    return {
      valid: false,
      binTargetPath,
      error: `Bin target missing: ${binTargetPath}`,
    };
  }

  // Run version check to confirm the CLI can start
  const versionResult = spawnSync(`node "${binTargetPath}" --version`, {
    shell: true,
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, HLX_SKIP_UPDATE_CHECK: "1" },
  });

  if (versionResult.error || versionResult.status !== 0 || versionResult.signal) {
    const detail =
      versionResult.error?.message ??
      versionResult.stderr?.trim() ??
      `exit code ${versionResult.status}`;
    return {
      valid: false,
      binTargetPath,
      error: `Version check failed: ${detail}`,
    };
  }

  return { valid: true, binTargetPath };
}

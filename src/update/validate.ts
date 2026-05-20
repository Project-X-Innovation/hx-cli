import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Validate a staged update directory before swapping it into the live install.
 *
 * 1. Checks that `<stagingDir>/dist/index.js` exists on disk.
 * 2. Checks that `<stagingDir>/package.json` exists on disk.
 * 3. Runs `node <stagingDir>/dist/index.js --version` to confirm the CLI can start.
 *
 * Returns a structured result — never throws.
 */
export function validateStaged(stagingDir: string): {
  valid: boolean;
  error?: string;
} {
  const entrypoint = join(stagingDir, "dist", "index.js");
  const packageJson = join(stagingDir, "package.json");

  // Check entrypoint existence
  if (!existsSync(entrypoint)) {
    return {
      valid: false,
      error: `Entrypoint missing: ${entrypoint}`,
    };
  }

  // Check package.json existence
  if (!existsSync(packageJson)) {
    return {
      valid: false,
      error: `package.json missing: ${packageJson}`,
    };
  }

  // Run version check to confirm the CLI can start
  const result = spawnSync("node", [entrypoint, "--version"], {
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, HLX_SKIP_UPDATE_CHECK: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0 || result.signal) {
    const detail =
      result.error?.message ??
      result.stderr?.trim() ??
      `exit code ${result.status}`;
    return {
      valid: false,
      error: `Version check failed: ${detail}`,
    };
  }

  const output = result.stdout?.trim();
  if (!output) {
    return {
      valid: false,
      error: "Version check produced no output",
    };
  }

  return { valid: true };
}

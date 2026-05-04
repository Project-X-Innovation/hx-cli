import {
  loadFullConfig,
  saveConfig,
  type InstallSource,
} from "../lib/config.js";
import {
  fetchLatestVersion,
  isNewerVersion,
  CANONICAL_REPO,
  CANONICAL_BRANCH,
} from "./check.js";
import { getPackageVersion } from "./version.js";
import { performUpdate } from "./perform.js";
import { validateInstall } from "./validate.js";

/**
 * Check whether an installSource matches a canonical source.
 * Accepts both legacy "github" mode (repo/branch check) and "npm" mode.
 */
function isCanonicalSource(source: InstallSource | undefined): boolean {
  if (!source) return false;
  if (source.mode === "npm") return true;
  return (
    source.mode === "github" &&
    source.repo === CANONICAL_REPO &&
    source.branch === CANONICAL_BRANCH
  );
}

/**
 * hlx update command handler.
 *
 * Flags:
 *   --enable-auto   Enable automatic update checks
 *   --disable-auto  Disable automatic update checks
 *   (no flags)      Check for and apply updates from npm
 */
export async function runUpdate(args: string[]): Promise<void> {
  // Handle --enable-auto / --disable-auto flags
  if (args.includes("--enable-auto")) {
    saveConfig({ autoUpdate: true });
    console.log("Auto-update enabled. The CLI will check for updates on each invocation.");
    return;
  }

  if (args.includes("--disable-auto")) {
    saveConfig({ autoUpdate: false });
    console.log("Auto-update disabled.");
    return;
  }

  // Run the update check flow
  console.log("Checking for updates...");

  const remoteVersion = fetchLatestVersion();
  if (remoteVersion === null) {
    console.error(
      "Failed to check for updates. Could not reach the npm registry.",
    );
    process.exit(1);
  }

  const localVersion = getPackageVersion();

  if (!isNewerVersion(remoteVersion, localVersion)) {
    console.log("Already up to date.");
    return;
  }

  console.log(`Update available: ${localVersion} → ${remoteVersion}`);

  const result = performUpdate({ quiet: false });

  if (!result.success) {
    console.error(`Update failed: ${result.error}`);
    process.exit(1);
  }

  // Validate the installed package before declaring success
  const validation = validateInstall();
  if (!validation.valid) {
    console.error(`\nUpdate validation failed: ${validation.error}`);
    if (result.stderr) {
      console.error(`\nnpm output:\n${result.stderr}`);
    }
    console.error(`\nThe update installed a broken package. To recover:`);
    console.error(`  1. Run: npm install -g @projectxinnovation/helix-cli@latest`);
    console.error(`  2. Or re-run 'hlx update' to retry.`);
    process.exit(1);
  }

  // Persist install-source metadata on success
  saveConfig({
    installSource: {
      mode: "npm",
      version: remoteVersion,
    },
  });

  console.log("Update complete. Changes take effect on the next invocation.");
}

/**
 * Pre-command auto-update check.
 * Runs before command dispatch when autoUpdate is enabled.
 * Silently skips on network failure or non-canonical installs — never blocks command execution.
 */
export async function checkAutoUpdate(): Promise<void> {
  // Loop-prevention guard
  if (process.env.HLX_SKIP_UPDATE_CHECK) {
    return;
  }

  const config = loadFullConfig();

  // Only run when autoUpdate is explicitly enabled
  if (config.autoUpdate !== true) {
    return;
  }

  // Only auto-update when install source is recognized as canonical
  if (!isCanonicalSource(config.installSource)) {
    console.error(
      "Warning: autoUpdate is enabled but install source is unrecognized. Run `hlx update` first to set up update metadata.",
    );
    return;
  }

  const localVersion = getPackageVersion();

  // Check remote version — silently skip on failure
  const remoteVersion = fetchLatestVersion();
  if (remoteVersion === null) {
    return;
  }

  // Already current
  if (!isNewerVersion(remoteVersion, localVersion)) {
    return;
  }

  // Perform quiet update
  console.error(`Updating CLI (${localVersion} → ${remoteVersion})...`);
  const result = performUpdate({ quiet: true });

  if (result.success) {
    const validation = validateInstall();
    if (!validation.valid) {
      console.error(`Warning: auto-update installed a broken package (${validation.error}). Run 'hlx update' to retry.`);
      if (result.stderr) {
        console.error(`npm output:\n${result.stderr}`);
      }
      return;
    }
    saveConfig({
      installSource: {
        mode: "npm",
        version: remoteVersion,
      },
    });
    console.error("Updated to latest. Changes take effect on the next invocation.");
  } else {
    console.error(`Warning: auto-update failed (${result.error}). Continuing with current version.`);
  }
}

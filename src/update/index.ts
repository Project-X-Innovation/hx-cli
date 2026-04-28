import {
  loadFullConfig,
  saveConfig,
  type InstallSource,
} from "../lib/config.js";
import {
  fetchRemoteSha,
  CANONICAL_REPO,
  CANONICAL_BRANCH,
} from "./check.js";
import { performUpdate } from "./perform.js";

/**
 * Check whether an installSource matches the canonical GitHub source.
 */
function isCanonicalSource(source: InstallSource | undefined): boolean {
  if (!source) return false;
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
 *   (no flags)      Check for and apply updates from GitHub main
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

  const remoteSha = fetchRemoteSha();
  if (remoteSha === null) {
    console.error(
      "Failed to check for updates. Could not reach GitHub or git is not installed.",
    );
    process.exit(1);
  }

  const config = loadFullConfig();
  const localSha = config.installSource?.commit;

  if (localSha && remoteSha.toLowerCase() === localSha.toLowerCase()) {
    console.log("Already up to date.");
    return;
  }

  console.log(
    localSha
      ? `Update available: ${localSha.slice(0, 7)} → ${remoteSha.slice(0, 7)}`
      : `Installing latest from ${CANONICAL_REPO}#${CANONICAL_BRANCH}...`,
  );

  const result = performUpdate({ quiet: false });

  if (!result.success) {
    console.error(`Update failed: ${result.error}`);
    process.exit(1);
  }

  // Persist install-source metadata on success
  saveConfig({
    installSource: {
      mode: "github",
      repo: CANONICAL_REPO,
      branch: CANONICAL_BRANCH,
      commit: remoteSha,
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

  const localSha = config.installSource!.commit;
  if (!localSha) {
    return;
  }

  // Check remote SHA — silently skip on failure
  const remoteSha = fetchRemoteSha();
  if (remoteSha === null) {
    return;
  }

  // Already current
  if (remoteSha.toLowerCase() === localSha.toLowerCase()) {
    return;
  }

  // Perform quiet update
  console.error(`Updating CLI (${localSha.slice(0, 7)} → ${remoteSha.slice(0, 7)})...`);
  const result = performUpdate({ quiet: true });

  if (result.success) {
    saveConfig({
      installSource: {
        mode: "github",
        repo: CANONICAL_REPO,
        branch: CANONICAL_BRANCH,
        commit: remoteSha,
      },
    });
    console.error("Updated to latest. Changes take effect on the next invocation.");
  } else {
    console.error(`Warning: auto-update failed (${result.error}). Continuing with current version.`);
  }
}

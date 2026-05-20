import {
  loadFullConfig,
  saveConfig,
  type InstallSource,
} from "../lib/config.js";
import {
  fetchLatestRelease,
  getGitHubToken,
  CANONICAL_REPO,
  CANONICAL_BRANCH,
} from "./check.js";
import { getPackageVersion } from "./version.js";
import { performStagedUpdate } from "./perform.js";

/**
 * Check whether an installSource matches a canonical source.
 * Accepts both legacy "npm" mode and "github" mode (repo/branch check).
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
 *   (no flags)      Check for and apply updates from GitHub
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

  const token = getGitHubToken();
  const result = await fetchLatestRelease(token);

  if (result.authRequired) {
    console.error(
      "Failed to check for updates: GitHub authentication required.\n\n" +
        "The helix-cli repository requires authentication to access release assets.\n" +
        "Provide a GitHub token using one of these methods:\n\n" +
        "  1. Set the GITHUB_TOKEN environment variable\n" +
        "  2. Set the GH_TOKEN environment variable\n" +
        "  3. Run `gh auth login` to authenticate the GitHub CLI\n",
    );
    process.exit(1);
  }

  if (!result.release) {
    console.error(
      "Failed to check for updates. Could not reach GitHub or no release found.",
    );
    process.exit(1);
  }

  const config = loadFullConfig();
  const installSource = config.installSource;

  // Migration detection: npm-sourced or unknown installs
  if (
    !installSource ||
    installSource.mode === "npm" ||
    installSource.mode === "unknown"
  ) {
    console.log("Switching install source from npm to GitHub main...");
  }

  const localSha = installSource?.commit;
  const remoteSha = result.release.commitSha;

  if (localSha && remoteSha.toLowerCase() === localSha.toLowerCase()) {
    console.log("Already up to date.");
    return;
  }

  const version = getPackageVersion();
  console.log(`Update available: ${version} → ${remoteSha.slice(0, 7)}`);

  const updateResult = await performStagedUpdate(
    result.release.assetUrl,
    remoteSha,
    token,
  );

  if (!updateResult.success) {
    console.error(`Update failed: ${updateResult.error}`);
    console.error(
      "\nTo recover, retry with:\n" +
        "  hlx update\n\n" +
        "Or download the latest release manually from:\n" +
        "  https://github.com/Project-X-Innovation/helix-cli/releases/latest\n",
    );
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

  // Discover auth token
  const token = getGitHubToken();

  // Check latest release — silently skip on failure
  const result = await fetchLatestRelease(token);

  if (result.authRequired) {
    console.error(
      "Warning: could not check for updates — GitHub authentication required. Run `hlx update` for details.",
    );
    return;
  }

  if (!result.release) {
    console.error("Warning: could not check for updates.");
    return;
  }

  const localSha = config.installSource?.commit;
  const remoteSha = result.release.commitSha;

  // Already current
  if (localSha && remoteSha.toLowerCase() === localSha.toLowerCase()) {
    return;
  }

  // Perform staged update
  const version = getPackageVersion();
  console.error(`Updating CLI (${version} → ${remoteSha.slice(0, 7)})...`);

  const updateResult = await performStagedUpdate(
    result.release.assetUrl,
    remoteSha,
    token,
  );

  if (updateResult.success) {
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
    console.error(
      `Warning: auto-update failed (${updateResult.error}). Continuing with current version.`,
    );
  }
}

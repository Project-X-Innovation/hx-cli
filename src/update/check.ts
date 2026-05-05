import { execSync } from "node:child_process";

export const CANONICAL_REPO_URL =
  "https://github.com/Project-X-Innovation/helix-cli.git";
export const CANONICAL_BRANCH = "main";
export const CANONICAL_REPO = "Project-X-Innovation/helix-cli";

/** npm package name for registry queries. */
export const NPM_PACKAGE = "@projectxinnovation/helix-cli";

/**
 * Fetch the latest published version from the npm registry.
 * Returns null on any failure (package not published, network error, npm not found).
 */
export function fetchLatestVersion(): string | null {
  try {
    const output = execSync(
      `npm view ${NPM_PACKAGE} version`,
      { timeout: 10_000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const version = output.trim();
    if (version && /^\d+\.\d+\.\d+/.test(version)) {
      return version;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compare two semver version strings (major.minor.patch).
 * Returns true only if remote is strictly newer than local.
 * Returns false on parse failure (defensive).
 */
export function isNewerVersion(remote: string, local: string): boolean {
  const rParts = remote.split(".").map(Number);
  const lParts = local.split(".").map(Number);
  if (rParts.length < 3 || lParts.length < 3) return false;
  if (rParts.some(isNaN) || lParts.some(isNaN)) return false;

  for (let i = 0; i < 3; i++) {
    if (rParts[i] > lParts[i]) return true;
    if (rParts[i] < lParts[i]) return false;
  }
  return false;
}

/**
 * Fetch the latest commit SHA from the canonical GitHub repo main branch.
 * Uses `git ls-remote` — no rate limit, lightweight, requires git binary.
 * Returns null on any failure (git not found, network error, parse error).
 */
export function fetchRemoteSha(): string | null {
  try {
    const output = execSync(
      `git ls-remote ${CANONICAL_REPO_URL} refs/heads/${CANONICAL_BRANCH}`,
      { timeout: 10_000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const sha = output.trim().split(/\s+/)[0];
    if (sha && /^[0-9a-f]{40}$/i.test(sha)) {
      return sha;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compare a local installed SHA against the remote main HEAD.
 */
export function isUpdateAvailable(localSha: string): {
  available: boolean;
  remoteSha: string | null;
} {
  const remoteSha = fetchRemoteSha();
  if (remoteSha === null) {
    return { available: false, remoteSha: null };
  }
  return {
    available: remoteSha.toLowerCase() !== localSha.toLowerCase(),
    remoteSha,
  };
}

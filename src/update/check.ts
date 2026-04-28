import { execSync } from "node:child_process";

export const CANONICAL_REPO_URL =
  "https://github.com/Project-X-Innovation/helix-cli.git";
export const CANONICAL_BRANCH = "main";
export const CANONICAL_REPO = "Project-X-Innovation/helix-cli";

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

import { execSync } from "node:child_process";

export const CANONICAL_REPO_URL =
  "https://github.com/Project-X-Innovation/helix-cli.git";
export const CANONICAL_BRANCH = "main";
export const CANONICAL_REPO = "Project-X-Innovation/helix-cli";

/** Information about the latest GitHub Release. */
export type ReleaseInfo = {
  commitSha: string;
  assetUrl: string;
};

/** Result of checking for an available update. */
export type ReleaseCheckResult = {
  available: boolean;
  release: ReleaseInfo | null;
  authRequired?: boolean;
};

/**
 * Discover a GitHub auth token from the environment or `gh` CLI.
 * Returns null when no token is found (fine for public repos).
 */
export function getGitHubToken(): string | null {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

  try {
    const token = execSync("gh auth token", {
      timeout: 5_000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (token) return token;
  } catch {
    // gh CLI not installed or not authenticated — continue without token
  }

  return null;
}

/**
 * Fetch the latest GitHub Release tagged `latest` from the canonical repo.
 *
 * Returns release metadata on success, null if no release exists or on
 * network error, or an object with `authRequired: true` when the API
 * responds with 401/403 (private repo, missing auth).
 */
export async function fetchLatestRelease(
  token?: string | null,
): Promise<{
  release: ReleaseInfo | null;
  authRequired?: boolean;
}> {
  const url = `https://api.github.com/repos/${CANONICAL_REPO}/releases/tags/latest`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (response.status === 401 || response.status === 403) {
      return { release: null, authRequired: true };
    }

    if (response.status === 404) {
      return { release: null };
    }

    if (!response.ok) {
      return { release: null };
    }

    const data = (await response.json()) as {
      target_commitish?: string;
      assets?: Array<{
        name?: string;
        url?: string;
        browser_download_url?: string;
      }>;
    };

    const commitSha = data.target_commitish;
    if (!commitSha || !/^[0-9a-f]{7,40}$/i.test(commitSha)) {
      return { release: null };
    }

    // Find the tarball asset
    const asset = data.assets?.find((a) => a.name === "helix-cli.tgz");
    if (!asset?.url) {
      return { release: null };
    }

    return {
      release: {
        commitSha,
        assetUrl: asset.url,
      },
    };
  } catch {
    // Network error, DNS failure, timeout, etc.
    return { release: null };
  }
}

/**
 * Compare a local installed SHA against the latest release.
 */
export async function isUpdateAvailable(
  localSha: string,
  token?: string | null,
): Promise<ReleaseCheckResult> {
  const result = await fetchLatestRelease(token);

  if (result.authRequired) {
    return { available: false, release: null, authRequired: true };
  }

  if (!result.release) {
    return { available: false, release: null };
  }

  return {
    available:
      result.release.commitSha.toLowerCase() !== localSha.toLowerCase(),
    release: result.release,
  };
}

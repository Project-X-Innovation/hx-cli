import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

import { validateStaged } from "./validate.js";

const STAGING_BASE = join(homedir(), ".hlx", "staging");

/**
 * Resolve the package install root from the running CLI's location.
 * At runtime this file lives at dist/update/perform.js, so the package
 * root is two directories up (../../).
 */
export function getInstallRoot(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return join(thisDir, "..", "..");
}

/**
 * Recursively copy a directory tree from src to dest.
 * Used as a fallback when rename fails (e.g. cross-filesystem EXDEV).
 */
function copyDirRecursive(src: string, dest: string): void {
  execSync(
    process.platform === "win32"
      ? `xcopy "${src}" "${dest}" /E /I /Q /Y`
      : `cp -R "${src}" "${dest}"`,
    { stdio: "pipe" },
  );
}

/**
 * Attempt a rename, falling back to copy+delete on EXDEV (cross-filesystem).
 * On Windows, retries once after 500ms on any error (file locking).
 */
function safeRename(oldPath: string, newPath: string): void {
  try {
    renameSync(oldPath, newPath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      // Cross-filesystem: copy then delete
      copyDirRecursive(oldPath, newPath);
      rmSync(oldPath, { recursive: true, force: true });
      return;
    }
    if (process.platform === "win32") {
      // Windows file-locking: retry once after 500ms
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
      renameSync(oldPath, newPath);
      return;
    }
    throw err;
  }
}

/**
 * Download a GitHub Release asset, extract, validate, and swap into the
 * live install location.
 *
 * Staged install flow:
 *   1. Download the tarball to a staging directory.
 *   2. Extract via system `tar`.
 *   3. Validate the staged candidate (entrypoint + --version).
 *   4. Rename-based swap with .bak backup dirs for rollback.
 *   5. Clean up staging and backup on success; restore on failure.
 */
export async function performStagedUpdate(
  assetUrl: string,
  commitSha: string,
  token?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const stagingDir = join(STAGING_BASE, commitSha);
  const tarballPath = join(STAGING_BASE, `${commitSha}.tgz`);

  try {
    // Ensure staging base exists
    mkdirSync(STAGING_BASE, { recursive: true });

    // Clean any prior staging for this SHA
    if (existsSync(stagingDir)) {
      rmSync(stagingDir, { recursive: true, force: true });
    }
    mkdirSync(stagingDir, { recursive: true });

    // ---- Download ----
    const headers: Record<string, string> = {
      Accept: "application/octet-stream",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(assetUrl, { headers });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Download failed: ${msg}` };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Download failed: HTTP ${response.status} ${response.statusText}`,
      };
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    writeFileSync(tarballPath, buffer);

    // ---- Extract ----
    try {
      execSync(`tar -xzf "${tarballPath}" -C "${stagingDir}"`, {
        stdio: "pipe",
        timeout: 30_000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Extraction failed: ${msg}` };
    }

    // ---- Validate ----
    const validation = validateStaged(stagingDir);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.error}`,
      };
    }

    // ---- Swap ----
    const installRoot = getInstallRoot();
    const liveDist = join(installRoot, "dist");
    const liveSkillContent = join(installRoot, "skill-content");
    const livePackageJson = join(installRoot, "package.json");
    const liveBuildMeta = join(installRoot, "build-metadata.json");

    const backupDist = join(installRoot, "dist.bak");
    const backupSkillContent = join(installRoot, "skill-content.bak");
    const backupPackageJson = join(installRoot, "package.json.bak");

    // Remove any leftover backup dirs from a prior failed swap
    for (const p of [backupDist, backupSkillContent, backupPackageJson]) {
      if (existsSync(p)) {
        rmSync(p, { recursive: true, force: true });
      }
    }

    const stagedDist = join(stagingDir, "dist");
    const stagedSkillContent = join(stagingDir, "skill-content");
    const stagedPackageJson = join(stagingDir, "package.json");
    const stagedBuildMeta = join(stagingDir, "build-metadata.json");

    try {
      // Back up live directories
      if (existsSync(liveDist)) {
        safeRename(liveDist, backupDist);
      }
      if (existsSync(liveSkillContent)) {
        safeRename(liveSkillContent, backupSkillContent);
      }
      if (existsSync(livePackageJson)) {
        copyFileSync(livePackageJson, backupPackageJson);
      }

      // Move staged into live
      safeRename(stagedDist, liveDist);

      if (existsSync(stagedSkillContent)) {
        safeRename(stagedSkillContent, liveSkillContent);
      }
      if (existsSync(stagedPackageJson)) {
        copyFileSync(stagedPackageJson, livePackageJson);
      }
      if (existsSync(stagedBuildMeta)) {
        copyFileSync(stagedBuildMeta, liveBuildMeta);
      }
    } catch (err: unknown) {
      // ---- Rollback ----
      try {
        // Restore backups
        if (existsSync(backupDist)) {
          if (existsSync(liveDist)) {
            rmSync(liveDist, { recursive: true, force: true });
          }
          safeRename(backupDist, liveDist);
        }
        if (existsSync(backupSkillContent)) {
          if (existsSync(liveSkillContent)) {
            rmSync(liveSkillContent, { recursive: true, force: true });
          }
          safeRename(backupSkillContent, liveSkillContent);
        }
        if (existsSync(backupPackageJson)) {
          copyFileSync(backupPackageJson, livePackageJson);
        }
      } catch {
        // Rollback itself failed — the best we can do is report
      }

      const msg = err instanceof Error ? err.message : String(err);
      if (
        process.platform === "win32" &&
        msg.includes("EPERM")
      ) {
        return {
          success: false,
          error: `Swap failed: ${msg}\n\nClose any programs accessing the hlx installation directory and retry with 'hlx update'.`,
        };
      }
      return { success: false, error: `Swap failed: ${msg}` };
    }

    // ---- Cleanup ----
    // Remove backups and staging on success
    for (const p of [backupDist, backupSkillContent, backupPackageJson]) {
      if (existsSync(p)) {
        rmSync(p, { recursive: true, force: true });
      }
    }

    return { success: true };
  } finally {
    // Always clean up staging artifacts
    try {
      if (existsSync(stagingDir)) {
        rmSync(stagingDir, { recursive: true, force: true });
      }
      if (existsSync(tarballPath)) {
        rmSync(tarballPath, { force: true });
      }
    } catch {
      // Best-effort cleanup
    }
  }
}

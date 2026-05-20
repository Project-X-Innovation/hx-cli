import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFullConfig } from "../lib/config.js";

/**
 * Read the package version from package.json at runtime.
 * At runtime this file lives at dist/update/version.js,
 * so package.json is two directories up (../../package.json).
 *
 * When the config file contains an installSource.commit SHA,
 * appends the short SHA in parentheses: e.g. "1.3.4 (c8620a5)".
 * Falls back to semver-only if the SHA is absent or config is unreadable.
 */
export function getPackageVersion(): string {
  let semver = "unknown";
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(thisDir, "..", "..", "package.json");
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    semver = pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }

  try {
    const config = loadFullConfig();
    const commit = config.installSource?.commit;
    if (commit && typeof commit === "string" && commit.length >= 7) {
      return `${semver} (${commit.slice(0, 7)})`;
    }
  } catch {
    // Config read failure — fall back to semver-only
  }

  return semver;
}

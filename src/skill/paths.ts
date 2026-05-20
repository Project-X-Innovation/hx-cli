import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Subdirectory name used for the installed skill. */
export const SKILL_DIR_NAME = "hlx-cli";

/**
 * Resolve the absolute path to the bundled skill-content/ directory.
 *
 * At runtime this file lives at dist/skill/paths.js, so the package
 * root is two directories up (../../) and skill-content/ sits there.
 *
 * If the directory is missing (corrupt install), writes an error to
 * stderr and exits non-zero.
 */
export function getSkillContentDir(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const skillDir = join(thisDir, "..", "..", "skill-content");

  if (!existsSync(skillDir)) {
    process.stderr.write(
      "Error: Bundled skill content is missing from this installation.\n" +
        "Reinstall the CLI to restore it:\n\n" +
        "  hlx update\n\n" +
        "Or download the latest release from:\n" +
        "  https://github.com/Project-X-Innovation/helix-cli/releases/latest\n\n",
    );
    process.exit(1);
  }

  return skillDir;
}

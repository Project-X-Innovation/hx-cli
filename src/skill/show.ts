import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Print the bundled SKILL.md content to stdout.
 * Exits non-zero if the file is missing.
 */
export function cmdShow(skillContentDir: string): void {
  const skillPath = join(skillContentDir, "SKILL.md");

  if (!existsSync(skillPath)) {
    process.stderr.write(
      "Error: SKILL.md not found in bundled skill content.\n" +
        "Reinstall the CLI to restore it:\n\n" +
        "  npm install -g git+https://github.com/Project-X-Innovation/helix-cli.git#main\n\n",
    );
    process.exit(1);
  }

  const content = readFileSync(skillPath, "utf8");
  process.stdout.write(content);
}

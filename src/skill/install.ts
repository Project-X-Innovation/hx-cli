import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getFlag, hasFlag } from "../lib/flags.js";
import { SKILL_DIR_NAME } from "./paths.js";

/**
 * Copy the bundled skill files to a target directory.
 *
 * Target resolution (three-tier priority):
 * 1. --target <path>  -> <path>/hlx-cli/
 * 2. --for <agent>    -> ~/.<agent>/skills/hlx-cli/
 * 3. Auto-detect      -> whichever of ~/.claude/skills or ~/.codex/skills exists
 *
 * Safety:
 * - Refuses to overwrite an existing destination unless --force is passed.
 * - Atomic install: on failure, removes partially-created destination.
 */
export function cmdInstall(args: string[], skillContentDir: string): void {
  const targetFlag = getFlag(args, "--target");
  const forFlag = getFlag(args, "--for");
  const force = hasFlag(args, "--force");

  const dest = resolveDestination(targetFlag, forFlag);

  // No-overwrite check
  if (existsSync(dest) && !force) {
    process.stderr.write(
      `Error: Destination already exists: ${dest}\n` +
        "Pass --force to overwrite the existing installation.\n",
    );
    process.exit(1);
  }

  // Force mode: remove existing destination first
  if (existsSync(dest) && force) {
    rmSync(dest, { recursive: true, force: true });
  }

  // Atomic install with rollback
  try {
    mkdirSync(dest, { recursive: true });

    // Copy SKILL.md
    copyFileSync(join(skillContentDir, "SKILL.md"), join(dest, "SKILL.md"));

    // Copy references/ if it exists
    const refsDir = join(skillContentDir, "references");
    if (existsSync(refsDir)) {
      const destRefs = join(dest, "references");
      mkdirSync(destRefs, { recursive: true });
      for (const file of readdirSync(refsDir)) {
        copyFileSync(join(refsDir, file), join(destRefs, file));
      }
    }
  } catch (err) {
    // Clean up partial destination
    try {
      rmSync(dest, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
    throw err;
  }

  process.stderr.write(`Skill installed to ${dest}\n`);
}

/**
 * Resolve the install destination from flags or auto-detection.
 */
function resolveDestination(
  targetFlag: string | undefined,
  forFlag: string | undefined,
): string {
  // Priority 1: explicit --target
  if (targetFlag) {
    return join(targetFlag, SKILL_DIR_NAME);
  }

  // Priority 2: --for <agent>
  if (forFlag) {
    if (forFlag !== "claude" && forFlag !== "codex") {
      process.stderr.write(
        `Error: Unknown agent "${forFlag}". Use --for claude or --for codex.\n`,
      );
      process.exit(1);
    }
    const skillsDir = join(homedir(), `.${forFlag}`, "skills");
    mkdirSync(skillsDir, { recursive: true });
    return join(skillsDir, SKILL_DIR_NAME);
  }

  // Priority 3: auto-detect
  const home = homedir();
  const claudeSkills = join(home, ".claude", "skills");
  const codexSkills = join(home, ".codex", "skills");
  const claudeExists = existsSync(claudeSkills);
  const codexExists = existsSync(codexSkills);

  if (claudeExists && codexExists) {
    process.stderr.write(
      "Error: Both ~/.claude/skills/ and ~/.codex/skills/ exist.\n" +
        "Specify which agent to install for with --for claude or --for codex.\n",
    );
    process.exit(1);
  }

  if (claudeExists) {
    return join(claudeSkills, SKILL_DIR_NAME);
  }

  if (codexExists) {
    return join(codexSkills, SKILL_DIR_NAME);
  }

  process.stderr.write(
    "Error: No agent skills directory found.\n" +
      "Neither ~/.claude/skills/ nor ~/.codex/skills/ exists.\n" +
      "Specify a target directory with --target <path>.\n",
  );
  process.exit(1);
}

import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { getSkillContentDir, SKILL_DIR_NAME } from "./paths.js";
import { cmdShow } from "./show.js";
import { cmdInstall } from "./install.js";

describe("SKILL_DIR_NAME", () => {
  it('equals "hlx-cli"', () => {
    assert.strictEqual(SKILL_DIR_NAME, "hlx-cli");
  });
});

describe("getSkillContentDir", () => {
  it("returns a path that exists", () => {
    const dir = getSkillContentDir();
    assert.ok(existsSync(dir), `skill content dir should exist: ${dir}`);
  });

  it("returned directory contains SKILL.md", () => {
    const dir = getSkillContentDir();
    const skillMd = join(dir, "SKILL.md");
    assert.ok(existsSync(skillMd), `SKILL.md should exist in ${dir}`);
  });

  it("returned directory contains references/", () => {
    const dir = getSkillContentDir();
    const refs = join(dir, "references");
    assert.ok(existsSync(refs), `references/ should exist in ${dir}`);
  });
});

describe("cmdShow", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "skill-show-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes SKILL.md content to stdout", () => {
    const content = "---\nname: test-skill\n---\n# Test Skill\n";
    writeFileSync(join(tmpDir, "SKILL.md"), content);

    // Capture stdout
    const chunks: Buffer[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk: string | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
      return true;
    };

    try {
      cmdShow(tmpDir);
    } finally {
      process.stdout.write = originalWrite;
    }

    const output = Buffer.concat(chunks).toString("utf8");
    assert.strictEqual(output, content);
  });
});

describe("cmdInstall", () => {
  let tmpDir: string;
  let skillSrc: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "skill-install-"));
    // Create a fake skill source directory
    skillSrc = join(tmpDir, "skill-src");
    mkdirSync(skillSrc, { recursive: true });
    writeFileSync(join(skillSrc, "SKILL.md"), "# Test Skill\n");
    mkdirSync(join(skillSrc, "references"));
    writeFileSync(
      join(skillSrc, "references", "commands.md"),
      "# Commands\n",
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("--target flag", () => {
    it("installs to <target>/hlx-cli/", () => {
      const targetDir = join(tmpDir, "target");
      mkdirSync(targetDir);

      cmdInstall(["--target", targetDir], skillSrc);

      const dest = join(targetDir, "hlx-cli");
      assert.ok(existsSync(dest), "destination directory should exist");
      assert.ok(
        existsSync(join(dest, "SKILL.md")),
        "SKILL.md should be installed",
      );
      assert.ok(
        existsSync(join(dest, "references", "commands.md")),
        "references/commands.md should be installed",
      );
    });

    it("installed SKILL.md matches source byte-for-byte", () => {
      const targetDir = join(tmpDir, "target");
      mkdirSync(targetDir);

      cmdInstall(["--target", targetDir], skillSrc);

      const srcContent = readFileSync(join(skillSrc, "SKILL.md"), "utf8");
      const destContent = readFileSync(
        join(targetDir, "hlx-cli", "SKILL.md"),
        "utf8",
      );
      assert.strictEqual(destContent, srcContent);
    });
  });

  describe("no-overwrite safety", () => {
    it("exits non-zero when destination exists without --force", () => {
      const targetDir = join(tmpDir, "target");
      mkdirSync(targetDir);

      // First install succeeds
      cmdInstall(["--target", targetDir], skillSrc);

      // Second install without --force should exit
      const originalExit = process.exit;
      const originalStderrWrite = process.stderr.write;
      let exitCode: number | undefined;
      let stderrOutput = "";

      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`process.exit(${code})`);
      }) as never;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrOutput += String(chunk);
        return true;
      }) as typeof process.stderr.write;

      try {
        cmdInstall(["--target", targetDir], skillSrc);
      } catch {
        // Expected: process.exit throws
      } finally {
        process.exit = originalExit;
        process.stderr.write = originalStderrWrite;
      }

      assert.strictEqual(exitCode, 1, "should exit with code 1");
      assert.ok(
        stderrOutput.includes("--force"),
        "error message should mention --force",
      );
    });
  });

  describe("--force flag", () => {
    it("overwrites existing destination", () => {
      const targetDir = join(tmpDir, "target");
      mkdirSync(targetDir);

      // First install
      cmdInstall(["--target", targetDir], skillSrc);

      // Modify source to verify overwrite
      writeFileSync(join(skillSrc, "SKILL.md"), "# Updated Skill\n");

      // Second install with --force
      cmdInstall(["--target", targetDir, "--force"], skillSrc);

      const content = readFileSync(
        join(targetDir, "hlx-cli", "SKILL.md"),
        "utf8",
      );
      assert.strictEqual(content, "# Updated Skill\n");
    });
  });

  describe("auto-detection", () => {
    it("exits non-zero when neither skills dir exists", () => {
      const originalExit = process.exit;
      const originalStderrWrite = process.stderr.write;
      let exitCode: number | undefined;
      let stderrOutput = "";

      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`process.exit(${code})`);
      }) as never;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrOutput += String(chunk);
        return true;
      }) as typeof process.stderr.write;

      try {
        // No --target and no --for: auto-detect fails because
        // we won't have ~/.claude/skills or ~/.codex/skills in
        // the test environment (or if they do exist, both exist)
        cmdInstall([], skillSrc);
      } catch {
        // Expected
      } finally {
        process.exit = originalExit;
        process.stderr.write = originalStderrWrite;
      }

      assert.ok(
        exitCode !== undefined,
        "should have called process.exit",
      );
      assert.ok(
        stderrOutput.includes("--target") || stderrOutput.includes("--for"),
        "error message should mention --target or --for",
      );
    });
  });

  describe("--for flag validation", () => {
    it("rejects unknown agent name", () => {
      const originalExit = process.exit;
      const originalStderrWrite = process.stderr.write;
      let exitCode: number | undefined;
      let stderrOutput = "";

      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`process.exit(${code})`);
      }) as never;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrOutput += String(chunk);
        return true;
      }) as typeof process.stderr.write;

      try {
        cmdInstall(["--for", "unknown-agent"], skillSrc);
      } catch {
        // Expected
      } finally {
        process.exit = originalExit;
        process.stderr.write = originalStderrWrite;
      }

      assert.strictEqual(exitCode, 1, "should exit with code 1");
      assert.ok(
        stderrOutput.includes("unknown-agent"),
        "error message should mention the bad agent name",
      );
    });
  });

  describe("atomic install rollback", () => {
    it("does not leave a partial directory on copy failure", () => {
      const targetDir = join(tmpDir, "target-atomic");
      mkdirSync(targetDir);

      // Create a source dir WITHOUT SKILL.md to trigger a copy error
      const brokenSrc = join(tmpDir, "broken-src");
      mkdirSync(brokenSrc, { recursive: true });
      // No SKILL.md — copyFileSync will throw ENOENT

      try {
        cmdInstall(["--target", targetDir], brokenSrc);
      } catch {
        // Expected: copy failure
      }

      const dest = join(targetDir, "hlx-cli");
      assert.ok(
        !existsSync(dest),
        "partial destination should be cleaned up",
      );
    });
  });
});

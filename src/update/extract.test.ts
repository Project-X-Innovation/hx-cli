import { describe, it, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";

import { extractTarGz } from "./extract.js";

// ---------------------------------------------------------------------------
// Test helpers: programmatic tarball creation
// ---------------------------------------------------------------------------

interface TarEntry {
  name: string;
  content?: string; // omit for directories
  typeflag?: string; // '0' = file (default), '5' = dir, 'x' = PAX header
}

/**
 * Build a tar header block (512 bytes) for a single entry.
 * This creates a minimal USTAR-compatible header with a valid checksum.
 */
function makeTarHeader(
  name: string,
  size: number,
  typeflag: string,
): Buffer {
  const header = Buffer.alloc(512);

  // name (bytes 0-99)
  header.write(name, 0, Math.min(name.length, 100), "ascii");

  // mode (bytes 100-107): 0o755 for dirs, 0o644 for files
  const mode = typeflag === "5" ? "0000755" : "0000644";
  header.write(mode + "\0", 100, 8, "ascii");

  // uid (bytes 108-115)
  header.write("0001000\0", 108, 8, "ascii");

  // gid (bytes 116-123)
  header.write("0001000\0", 116, 8, "ascii");

  // size (bytes 124-135) — octal, 11 digits, null terminated
  const sizeStr = size.toString(8).padStart(11, "0");
  header.write(sizeStr + "\0", 124, 12, "ascii");

  // mtime (bytes 136-147)
  const mtime = Math.floor(Date.now() / 1000)
    .toString(8)
    .padStart(11, "0");
  header.write(mtime + "\0", 136, 12, "ascii");

  // typeflag (byte 156)
  header.write(typeflag || "0", 156, 1, "ascii");

  // magic (bytes 257-262): "ustar\0"
  header.write("ustar\0", 257, 6, "ascii");

  // version (bytes 263-264): "00"
  header.write("00", 263, 2, "ascii");

  // Compute checksum: initially write 8 spaces at bytes 148-155
  header.write("        ", 148, 8, "ascii");
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    sum += header[i];
  }
  const checksumStr = sum.toString(8).padStart(6, "0") + "\0 ";
  header.write(checksumStr, 148, 8, "ascii");

  return header;
}

/**
 * Create a gzip-compressed tar archive from an array of entries.
 * Returns a Buffer suitable for writing as a .tgz file.
 */
function createTestTarGz(entries: TarEntry[]): Buffer {
  const parts: Buffer[] = [];

  for (const entry of entries) {
    const isDir =
      entry.typeflag === "5" ||
      (!entry.typeflag && !entry.content && entry.name.endsWith("/"));
    const typeflag = entry.typeflag || (isDir ? "5" : "0");
    const data = entry.content ? Buffer.from(entry.content, "utf-8") : Buffer.alloc(0);
    const size = typeflag === "5" ? 0 : data.length;

    const header = makeTarHeader(entry.name, size, typeflag);
    parts.push(header);

    if (size > 0) {
      parts.push(data);
      // Pad data to 512-byte boundary
      const remainder = size % 512;
      if (remainder !== 0) {
        parts.push(Buffer.alloc(512 - remainder));
      }
    }
  }

  // Two 512-byte zero blocks mark end of archive
  parts.push(Buffer.alloc(1024));

  const tarBuf = Buffer.concat(parts);
  return gzipSync(tarBuf);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractTarGz", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("extracts a representative CI-shaped tarball with correct layout and content", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "extract-"));
    const destDir = join(tmpDir, "staged");
    mkdirSync(destDir, { recursive: true });

    const tgz = createTestTarGz([
      { name: "dist/", typeflag: "5" },
      { name: "dist/index.js", content: '#!/usr/bin/env node\nconsole.log("hlx");\n' },
      { name: "dist/update/", typeflag: "5" },
      { name: "dist/update/perform.js", content: "// perform\n" },
      { name: "skill-content/", typeflag: "5" },
      { name: "skill-content/SKILL.md", content: "# Skill\n" },
      { name: "package.json", content: '{"name":"test","version":"0.0.1"}\n' },
      { name: "build-metadata.json", content: '{"sha":"abc123"}\n' },
    ]);

    const tarballPath = join(tmpDir, "test.tgz");
    writeFileSync(tarballPath, tgz);

    extractTarGz(tarballPath, destDir);

    // Verify expected files and directories
    assert.ok(existsSync(join(destDir, "dist", "index.js")), "dist/index.js should exist");
    assert.ok(existsSync(join(destDir, "dist", "update", "perform.js")), "dist/update/perform.js should exist");
    assert.ok(existsSync(join(destDir, "skill-content", "SKILL.md")), "skill-content/SKILL.md should exist");
    assert.ok(existsSync(join(destDir, "package.json")), "package.json should exist");
    assert.ok(existsSync(join(destDir, "build-metadata.json")), "build-metadata.json should exist");

    // Verify content
    assert.strictEqual(
      readFileSync(join(destDir, "dist", "index.js"), "utf-8"),
      '#!/usr/bin/env node\nconsole.log("hlx");\n',
    );
    assert.strictEqual(
      readFileSync(join(destDir, "package.json"), "utf-8"),
      '{"name":"test","version":"0.0.1"}\n',
    );
    assert.strictEqual(
      readFileSync(join(destDir, "build-metadata.json"), "utf-8"),
      '{"sha":"abc123"}\n',
    );
  });

  it("extracts to a path containing a colon (original GNU tar failure mode)", () => {
    // On macOS/Linux, a colon in a directory name is valid.
    // On Windows, colons in directory names are not allowed, so
    // we use a parenthesized name instead.  Both cases validate that
    // the extraction does NOT depend on an external tar binary.
    const specialChar = process.platform === "win32" ? "(staging)" : "staging:test";
    tmpDir = mkdtempSync(join(tmpdir(), "extract-"));
    const destDir = join(tmpDir, specialChar);
    mkdirSync(destDir, { recursive: true });

    const tgz = createTestTarGz([
      { name: "dist/", typeflag: "5" },
      { name: "dist/index.js", content: "// index\n" },
      { name: "package.json", content: "{}\n" },
    ]);

    const tarballPath = join(tmpDir, "test.tgz");
    writeFileSync(tarballPath, tgz);

    // This would fail with GNU tar: "Cannot connect to C: resolve failed"
    // Our in-process extraction must succeed regardless of path characters.
    extractTarGz(tarballPath, destDir);

    assert.ok(existsSync(join(destDir, "dist", "index.js")), "dist/index.js should exist in colon path");
    assert.strictEqual(
      readFileSync(join(destDir, "dist", "index.js"), "utf-8"),
      "// index\n",
    );
  });

  it("throws on corrupt tarball input", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "extract-"));
    const destDir = join(tmpDir, "staged");
    mkdirSync(destDir, { recursive: true });

    // Write garbage bytes that cannot be decompressed by gunzipSync
    const tarballPath = join(tmpDir, "corrupt.tgz");
    writeFileSync(tarballPath, Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]));

    assert.throws(
      () => extractTarGz(tarballPath, destDir),
      (err: unknown) => err instanceof Error,
      "Should throw an error for corrupt tarball",
    );
  });

  it("handles an empty archive (two zero blocks) without error", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "extract-"));
    const destDir = join(tmpDir, "staged");
    mkdirSync(destDir, { recursive: true });

    // A valid tar archive with only the end-of-archive marker
    const emptyTar = Buffer.alloc(1024); // two 512-byte zero blocks
    const tgz = gzipSync(emptyTar);

    const tarballPath = join(tmpDir, "empty.tgz");
    writeFileSync(tarballPath, tgz);

    extractTarGz(tarballPath, destDir);

    // Destination should be empty (no files created)
    const contents = readdirSync(destDir);
    assert.strictEqual(contents.length, 0, "No files should be created from empty archive");
  });

  it("skips PAX extended headers and extracts the subsequent file", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "extract-"));
    const destDir = join(tmpDir, "staged");
    mkdirSync(destDir, { recursive: true });

    // PAX extended header entry (typeflag 'x') contains key-value metadata
    // that should be skipped, followed by the actual file entry.
    const paxData = "20 path=dist/index.js\n";

    const tgz = createTestTarGz([
      {
        name: "PaxHeader/dist/index.js",
        content: paxData,
        typeflag: "x",
      },
      {
        name: "dist/index.js",
        content: "// hello from pax test\n",
      },
    ]);

    const tarballPath = join(tmpDir, "pax.tgz");
    writeFileSync(tarballPath, tgz);

    extractTarGz(tarballPath, destDir);

    // The PAX header should be skipped; the regular file should be extracted
    assert.ok(existsSync(join(destDir, "dist", "index.js")), "dist/index.js should exist after PAX header");
    assert.strictEqual(
      readFileSync(join(destDir, "dist", "index.js"), "utf-8"),
      "// hello from pax test\n",
    );
    // The PAX header directory should NOT be created
    assert.ok(
      !existsSync(join(destDir, "PaxHeader")),
      "PaxHeader directory should not be created",
    );
  });

  it("throws on truncated tar entry (header claims more data than exists)", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "extract-"));
    const destDir = join(tmpDir, "staged");
    mkdirSync(destDir, { recursive: true });

    // Build a tarball where the header claims 10000 bytes but the archive
    // is truncated after only a few data blocks.
    const header = Buffer.alloc(512);
    const name = "dist/large-file.js";
    header.write(name, 0, name.length, "ascii");
    header.write("0000644\0", 100, 8, "ascii");
    header.write("0001000\0", 108, 8, "ascii");
    header.write("0001000\0", 116, 8, "ascii");
    // Claim 10000 bytes of data
    const sizeStr = (10000).toString(8).padStart(11, "0");
    header.write(sizeStr + "\0", 124, 12, "ascii");
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, "0");
    header.write(mtime + "\0", 136, 12, "ascii");
    header.write("0", 156, 1, "ascii"); // regular file
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    // Compute checksum
    header.write("        ", 148, 8, "ascii");
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += header[i];
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");

    // Only provide 512 bytes of data (< 10000 claimed)
    const data = Buffer.alloc(512, 0x41); // 'A' padding
    const terminator = Buffer.alloc(1024); // end-of-archive
    const tarBuf = Buffer.concat([header, data, terminator]);
    const tgz = gzipSync(tarBuf);

    const tarballPath = join(tmpDir, "truncated.tgz");
    writeFileSync(tarballPath, tgz);

    assert.throws(
      () => extractTarGz(tarballPath, destDir),
      (err: unknown) =>
        err instanceof Error && err.message.includes("Truncated tar entry"),
      "Should throw on truncated tar entry",
    );
  });
});

import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

/**
 * Read a null-terminated ASCII string from a tar header buffer at `offset`,
 * up to `length` bytes.
 */
function readString(buf: Buffer, offset: number, length: number): string {
  let end = offset;
  const limit = offset + length;
  while (end < limit && buf[end] !== 0) {
    end++;
  }
  return buf.toString("ascii", offset, end);
}

/**
 * Parse an octal size field from a tar header.  Returns 0 for empty fields.
 */
function readOctal(buf: Buffer, offset: number, length: number): number {
  const str = readString(buf, offset, length).trim();
  if (str.length === 0) return 0;
  return parseInt(str, 8);
}

/**
 * Compute the tar header checksum for validation.
 * The checksum is the sum of all bytes in the 512-byte header block,
 * treating the 8-byte checksum field (bytes 148-155) as spaces (0x20).
 */
function computeChecksum(header: Buffer): number {
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    // Bytes 148-155 are the checksum field itself; treat as spaces
    sum += i >= 148 && i < 156 ? 0x20 : header[i];
  }
  return sum;
}

/**
 * Check whether a 512-byte block is entirely zeros (end-of-archive marker).
 */
function isZeroBlock(buf: Buffer, offset: number): boolean {
  for (let i = offset; i < offset + 512; i++) {
    if (buf[i] !== 0) return false;
  }
  return true;
}

/**
 * Extract a `.tgz` (gzip-compressed tar) archive to a destination directory,
 * using only Node.js built-in modules.
 *
 * This replaces the prior `execSync('tar -xzf ...')` call to eliminate the
 * dependency on an external `tar` binary.  GNU tar (shipped with Git for
 * Windows) interprets Windows drive-letter colons (e.g. `C:\...`) as
 * remote-host syntax, breaking extraction on the most common Windows
 * developer setup.
 *
 * @throws on any extraction error (corrupt tarball, IO failure, path
 *         traversal attempt).  The caller is expected to catch and convert
 *         the exception into a structured `{ success: false, error }` result.
 */
export function extractTarGz(tarballPath: string, destDir: string): void {
  const compressed = readFileSync(tarballPath);
  const tar = gunzipSync(compressed);

  const resolvedDest = resolve(destDir);
  let offset = 0;

  while (offset + 512 <= tar.length) {
    // --- Read header block ------------------------------------------------
    const header = tar.subarray(offset, offset + 512);

    // Two consecutive zero blocks mark end-of-archive
    if (isZeroBlock(tar, offset)) {
      if (offset + 1024 <= tar.length && isZeroBlock(tar, offset + 512)) {
        break; // end of archive
      }
      // Single zero block — could be padding; skip it
      offset += 512;
      continue;
    }

    // --- Parse header fields ----------------------------------------------
    const name = readString(header, 0, 100);
    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header[156]);
    const prefix = readString(header, 345, 155);

    // Validate checksum
    const storedChecksum = readOctal(header, 148, 8);
    const computed = computeChecksum(header);
    if (storedChecksum !== computed) {
      throw new Error(
        `Corrupt tar header at offset ${offset}: checksum mismatch (stored=${storedChecksum}, computed=${computed})`,
      );
    }

    // Full entry name: if USTAR prefix is non-empty, prepend it
    let entryName = prefix ? `${prefix}/${name}` : name;

    // Strip leading slashes for safety
    entryName = entryName.replace(/^\/+/, "");

    // Reject path-traversal attempts
    if (entryName.split("/").includes("..")) {
      throw new Error(
        `Path traversal detected in tar entry: ${entryName}`,
      );
    }

    const fullPath = resolve(destDir, entryName);
    if (!fullPath.startsWith(resolvedDest)) {
      throw new Error(
        `Path traversal detected: entry "${entryName}" resolves outside destination`,
      );
    }

    // Data starts immediately after the 512-byte header
    const dataStart = offset + 512;
    // Data is padded to the next 512-byte boundary
    const dataBlocks = Math.ceil(size / 512) * 512;

    // Bounds check: ensure the claimed data does not extend past the buffer
    if (size > 0 && dataStart + size > tar.length) {
      throw new Error(
        `Truncated tar entry "${entryName}": expected ${size} bytes at offset ${dataStart}, but archive is only ${tar.length} bytes`,
      );
    }

    if (typeflag === "5") {
      // Directory
      mkdirSync(fullPath, { recursive: true });
    } else if (typeflag === "0" || typeflag === "\0") {
      // Regular file
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, tar.subarray(dataStart, dataStart + size));
    } else if (typeflag === "x" || typeflag === "g") {
      // PAX extended header or global PAX header — skip data blocks
    }
    // Other type flags (symlinks, etc.) are silently skipped for safety

    // Advance past header + data blocks
    offset = dataStart + dataBlocks;
  }
}

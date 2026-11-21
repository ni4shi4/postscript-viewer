/**
 * Shared constants and helpers for Ghostscript WASM asset scripts.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";

/** Cloudflare Workers static asset limit per file (25 MiB). */
export const WORKERS_STATIC_ASSET_MAX_BYTES = 25 * 1024 * 1024;

export const GS_WASM_SHA256_FILE = "gs-wasm.sha256";

/**
 * @param {string} filePath
 * @returns {Promise<string>} lowercase hex SHA-256
 */
export async function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * @param {string} hashFilePath
 * @returns {Promise<string>} lowercase hex SHA-256
 */
export async function readExpectedSha256(hashFilePath) {
  const content = await readFile(hashFilePath, "utf8");
  const token = content.trim().split(/\s+/)[0] ?? "";
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error(`invalid ${GS_WASM_SHA256_FILE}`);
  }
  return token.toLowerCase();
}

/**
 * @param {number} sizeBytes
 * @returns {string | undefined} error message, or undefined when within limit
 */
export function workersStaticAssetSizeError(sizeBytes) {
  if (sizeBytes > WORKERS_STATIC_ASSET_MAX_BYTES) {
    return `gs.wasm is ${String(sizeBytes)} bytes (limit ${String(WORKERS_STATIC_ASSET_MAX_BYTES)}); not copying`;
  }
  return undefined;
}

/**
 * @param {string} destWasm
 */
export async function removeDestWasmIfPresent(destWasm) {
  try {
    await unlink(destWasm);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * @param {object} options
 * @param {string} options.sourceWasm
 * @param {string} options.destWasm
 * @param {string} options.expectedHashPath
 * @returns {Promise<{ ok: true; size: number } | { ok: false; exitCode: 1 }>}
 */
export async function installWasmIfSha256Matches({ sourceWasm, destWasm, expectedHashPath }) {
  const { size } = await stat(sourceWasm);

  const sizeError = workersStaticAssetSizeError(size);
  if (sizeError !== undefined) {
    console.error(sizeError);
    return { ok: false, exitCode: 1 };
  }

  const actualHash = await computeFileSha256(sourceWasm);
  let expectedHash;
  try {
    expectedHash = await readExpectedSha256(expectedHashPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return { ok: false, exitCode: 1 };
  }

  if (actualHash !== expectedHash) {
    await removeDestWasmIfPresent(destWasm);
    console.error(
      `gs.wasm SHA-256 mismatch (expected ${expectedHash}, got ${actualHash}); not copying`,
    );
    return { ok: false, exitCode: 1 };
  }

  await mkdir(path.dirname(destWasm), { recursive: true });
  await copyFile(sourceWasm, destWasm);

  return { ok: true, size };
}

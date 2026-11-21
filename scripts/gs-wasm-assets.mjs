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

export const GS_WASM_FILE_NAME = "gs.wasm";
export const GS_GLUE_FILE_NAME = "gs.mjs";

export const GS_WASM_RELEASE_REPO = "ni4shi4/postscript-viewer";
export const GS_WASM_RELEASE_TAG = "gs-wasm-v1";

const DEFAULT_RELEASE_DOWNLOAD_BASE = `https://github.com/${GS_WASM_RELEASE_REPO}/releases/download/${GS_WASM_RELEASE_TAG}`;

/**
 * @param {string} fileName
 * @returns {string}
 */
export function releaseAssetDownloadUrl(fileName) {
  const base = process.env.GS_WASM_RELEASE_BASE_URL ?? DEFAULT_RELEASE_DOWNLOAD_BASE;
  return `${base.replace(/\/$/, "")}/${fileName}`;
}

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
 * @returns {Promise<Map<string, string>>} fileName → lowercase hex SHA-256
 */
export async function readExpectedSha256Entries(hashFilePath) {
  const content = await readFile(hashFilePath, "utf8");
  const entries = new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    const hashToken = parts[0] ?? "";
    const fileName = parts[1];
    if (fileName === undefined || !/^[a-f0-9]{64}$/i.test(hashToken)) {
      throw new Error(`invalid ${GS_WASM_SHA256_FILE}`);
    }
    entries.set(fileName, hashToken.toLowerCase());
  }
  return entries;
}

/**
 * @param {string} hashFilePath
 * @param {string} fileName
 * @returns {Promise<string>} lowercase hex SHA-256
 */
export async function readExpectedSha256ForFile(hashFilePath, fileName) {
  const entries = await readExpectedSha256Entries(hashFilePath);
  const hash = entries.get(fileName);
  if (hash === undefined) {
    throw new Error(`missing ${fileName} in ${GS_WASM_SHA256_FILE}`);
  }
  return hash;
}

/**
 * @param {number} sizeBytes
 * @param {string} fileName
 * @returns {string | undefined} error message, or undefined when within limit
 */
export function workersStaticAssetSizeError(sizeBytes, fileName) {
  if (sizeBytes > WORKERS_STATIC_ASSET_MAX_BYTES) {
    return `${fileName} is ${String(sizeBytes)} bytes (limit ${String(WORKERS_STATIC_ASSET_MAX_BYTES)}); not copying`;
  }
  return undefined;
}

/**
 * @param {string} destPath
 */
export async function removeDestIfPresent(destPath) {
  try {
    await unlink(destPath);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * @param {object} options
 * @param {string} options.destWasm
 * @param {string} options.destGlue
 */
export async function removeInstalledGsAssets({ destWasm, destGlue }) {
  await removeDestIfPresent(destWasm);
  await removeDestIfPresent(destGlue);
}

/**
 * @param {object} options
 * @param {string} options.sourcePath
 * @param {string} options.destPath
 * @param {string} options.expectedHashPath
 * @param {string} options.assetFileName key in gs-wasm.sha256
 * @returns {Promise<{ ok: true; size: number } | { ok: false; exitCode: 1 }>}
 */
export async function installAssetIfSha256Matches({
  sourcePath,
  destPath,
  expectedHashPath,
  assetFileName,
}) {
  const { size } = await stat(sourcePath);

  const sizeError = workersStaticAssetSizeError(size, assetFileName);
  if (sizeError !== undefined) {
    console.error(sizeError);
    return { ok: false, exitCode: 1 };
  }

  const actualHash = await computeFileSha256(sourcePath);
  let expectedHash;
  try {
    expectedHash = await readExpectedSha256ForFile(expectedHashPath, assetFileName);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return { ok: false, exitCode: 1 };
  }

  if (actualHash !== expectedHash) {
    await removeDestIfPresent(destPath);
    console.error(
      `${assetFileName} SHA-256 mismatch (expected ${expectedHash}, got ${actualHash}); not copying`,
    );
    return { ok: false, exitCode: 1 };
  }

  await mkdir(path.dirname(destPath), { recursive: true });
  await copyFile(sourcePath, destPath);

  return { ok: true, size };
}

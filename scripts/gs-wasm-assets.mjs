/**
 * Shared constants and helpers for Ghostscript WASM asset scripts.
 */

import { copyFile, mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

/** Cloudflare Workers static asset limit per file (25 MiB). */
export const WORKERS_STATIC_ASSET_MAX_BYTES = 25 * 1024 * 1024;

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
 * @returns {Promise<number>} copied file size in bytes
 */
export async function installGsWasmAsset({ sourcePath, destPath }) {
  const { size } = await stat(sourcePath);
  await mkdir(path.dirname(destPath), { recursive: true });
  await copyFile(sourcePath, destPath);
  return size;
}

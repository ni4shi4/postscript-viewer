/**
 * Fetch gs.wasm and gs.mjs from a GitHub release and install into the repo.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GS_GLUE_FILE_NAME,
  GS_WASM_FILE_NAME,
  installGsWasmAsset,
  releaseAssetDownloadUrl,
  removeInstalledGsAssets,
  workersStaticAssetSizeError,
} from "./gs-wasm-assets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destWasm = path.join(repoRoot, "public", GS_WASM_FILE_NAME);
const destGlue = path.join(repoRoot, "src", "generated", "ghostscript", GS_GLUE_FILE_NAME);

/** @type {ReadonlyArray<{ fileName: string; destPath: string }>} */
const RELEASE_ASSETS = [
  { fileName: GS_WASM_FILE_NAME, destPath: destWasm },
  { fileName: GS_GLUE_FILE_NAME, destPath: destGlue },
];

/**
 * @param {string} fileName
 * @returns {Promise<{ ok: true; buffer: Buffer } | { ok: false; message: string }>}
 */
async function downloadReleaseAsset(fileName) {
  const url = releaseAssetDownloadUrl(fileName);
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `failed to fetch ${fileName} from ${url}: ${detail}` };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `failed to fetch ${fileName} from ${url}: HTTP ${String(response.status)}`,
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const sizeError = workersStaticAssetSizeError(buffer.length, fileName);
  if (sizeError !== undefined) {
    return { ok: false, message: sizeError };
  }

  return { ok: true, buffer };
}

/**
 * @returns {Promise<number>} process exit code
 */
async function main() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "gs-wasm-fetch-"));
  try {
    for (const { fileName } of RELEASE_ASSETS) {
      const download = await downloadReleaseAsset(fileName);
      if (!download.ok) {
        console.error(download.message);
        await removeInstalledGsAssets({ destWasm, destGlue });
        return 1;
      }
      await writeFile(path.join(tempDir, fileName), download.buffer);
    }

    let wasmSize = 0;
    for (const { fileName, destPath } of RELEASE_ASSETS) {
      const tempPath = path.join(tempDir, fileName);
      const size = await installGsWasmAsset({ sourcePath: tempPath, destPath });
      if (fileName === GS_WASM_FILE_NAME) {
        wasmSize = size;
      }
    }

    console.log(wasmSize);
    return 0;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

process.exit(await main());

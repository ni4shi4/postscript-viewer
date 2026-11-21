/**
 * Copy Ghostscript WASM (gs.wasm) from ghostscript-wasm-esm into public/gs.wasm.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import { copyFile, mkdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Cloudflare Workers static asset limit per file (25 MiB). */
const WORKERS_STATIC_ASSET_MAX_BYTES = 25 * 1024 * 1024;

const GS_WASM_SHA256_FILE = "gs-wasm.sha256";

const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve("ghostscript-wasm-esm/package.json"));
const sourceWasm = path.join(packageRoot, "gs.wasm");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destWasm = path.join(repoRoot, "public", "gs.wasm");
const expectedHashPath = path.join(repoRoot, GS_WASM_SHA256_FILE);

/**
 * @param {string} filePath
 * @returns {Promise<string>} lowercase hex SHA-256
 */
async function computeFileSha256(filePath) {
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
async function readExpectedSha256(hashFilePath) {
  const content = await readFile(hashFilePath, "utf8");
  const token = content.trim().split(/\s+/)[0] ?? "";
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error(`invalid ${GS_WASM_SHA256_FILE}`);
  }
  return token.toLowerCase();
}

/**
 * @returns {Promise<number>} process exit code
 */
async function main() {
  const { size } = await stat(sourceWasm);

  if (size > WORKERS_STATIC_ASSET_MAX_BYTES) {
    console.error(
      `gs.wasm is ${size} bytes (limit ${WORKERS_STATIC_ASSET_MAX_BYTES}); not copying`,
    );
    return 1;
  }

  const actualHash = await computeFileSha256(sourceWasm);
  let expectedHash;
  try {
    expectedHash = await readExpectedSha256(expectedHashPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }

  if (actualHash !== expectedHash) {
    try {
      await unlink(destWasm);
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") {
        throw error;
      }
    }
    console.error(
      `gs.wasm SHA-256 mismatch (expected ${expectedHash}, got ${actualHash}); not copying`,
    );
    return 1;
  }

  await mkdir(path.dirname(destWasm), { recursive: true });
  await copyFile(sourceWasm, destWasm);

  console.log(size);
  return 0;
}

process.exit(await main());

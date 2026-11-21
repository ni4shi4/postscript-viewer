/**
 * Copy Ghostscript WASM (gs.wasm) from ghostscript-wasm-esm into public/gs.wasm.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { installWasmIfSha256Matches } from "./gs-wasm-assets.mjs";

const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve("ghostscript-wasm-esm/package.json"));
const sourceWasm = path.join(packageRoot, "gs.wasm");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destWasm = path.join(repoRoot, "public", "gs.wasm");
const expectedHashPath = path.join(repoRoot, "gs-wasm.sha256");

/**
 * @returns {Promise<number>} process exit code
 */
async function main() {
  const result = await installWasmIfSha256Matches({ sourceWasm, destWasm, expectedHashPath });
  if (!result.ok) {
    return result.exitCode;
  }
  console.log(result.size);
  return 0;
}

process.exit(await main());

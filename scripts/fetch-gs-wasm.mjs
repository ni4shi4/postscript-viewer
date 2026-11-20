/**
 * Copy Ghostscript WASM (gs.wasm) from ghostscript-wasm-esm into public/gs.wasm.
 */

import { createRequire } from "node:module";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Cloudflare Workers static asset limit per file (25 MiB). */
const WORKERS_STATIC_ASSET_MAX_BYTES = 25 * 1024 * 1024;

const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve("ghostscript-wasm-esm/package.json"));
const sourceWasm = path.join(packageRoot, "gs.wasm");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destWasm = path.join(repoRoot, "public", "gs.wasm");

const { size } = await stat(sourceWasm);

if (size > WORKERS_STATIC_ASSET_MAX_BYTES) {
  console.error(`gs.wasm is ${size} bytes (limit ${WORKERS_STATIC_ASSET_MAX_BYTES}); not copying`);
  process.exit(1);
}

await mkdir(path.dirname(destWasm), { recursive: true });
await copyFile(sourceWasm, destWasm);

console.log(size);

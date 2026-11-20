/**
 * Place Ghostscript WASM (gs.wasm) into public/gs.wasm for static serving.
 *
 * Candidate npm packages (choose in a follow-up commit; do not add deps here):
 * - @jspawn/ghostscript-wasm (v0.0.2, 2022-08)
 * - ghostscript-wasm-esm (v1.0.1, 2025-11, ESM + TypeScript types)
 *
 * After wiring a package, copy the wasm artifact from the build you actually ship
 * and re-measure file size: raw, gzip, and brotli. Workers static assets cap a
 * single file at 25 MiB (an older gs.wasm was ~15.4 MiB raw; confirm per build).
 *
 * This script is a stub until fetch logic is implemented.
 */

console.error(
  "scripts/fetch-gs-wasm.mjs: not implemented — wasm fetch and copy to public/gs.wasm is pending",
);
process.exit(1);

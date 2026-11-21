import { execSync } from "node:child_process";

import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

function resolveBuildCommitSha(): string | undefined {
  const fromEnv = process.env.BUILD_COMMIT_SHA?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }

  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

const buildCommitSha = resolveBuildCommitSha();

export default defineConfig({
  define: {
    BUILD_COMMIT_SHA: buildCommitSha !== undefined ? JSON.stringify(buildCommitSha) : "undefined",
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/pdfjs-dist/standard_fonts/*",
          dest: "pdfjs/standard_fonts",
          rename: { stripBase: true },
        },
        {
          src: "node_modules/pdfjs-dist/cmaps/*",
          dest: "pdfjs/cmaps",
          rename: { stripBase: true },
        },
        {
          src: "node_modules/pdfjs-dist/wasm/*",
          dest: "pdfjs/wasm",
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
});

import { execSync } from "node:child_process";
import { resolve } from "node:path";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

import { hreflangAlternatesPlugin } from "./vite/hreflang-alternates-plugin.js";

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
    preact(),
    hreflangAlternatesPlugin(process.env.SITE_ORIGIN),
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
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        en: resolve(import.meta.dirname, "en/index.html"),
      },
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
});

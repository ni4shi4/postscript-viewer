import { execSync } from "node:child_process";

import { defineConfig } from "vite";

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
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
});
/**
 * Build gs.wasm and gs.mjs via Docker (emscripten/emsdk) and install into the repo.
 */

import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GS_WASM_SHA256_FILE, installWasmIfSha256Matches } from "./gs-wasm-assets.mjs";

const DOCKER_IMAGE = "postscript-viewer-gs-wasm";
const DYNAMIC_EXECUTION_PATTERN = /\b(eval|new\s+Function)\b/;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerContext = path.join(repoRoot, "docker", "ghostscript-wasm");
const destWasm = path.join(repoRoot, "public", "gs.wasm");
const destGlue = path.join(repoRoot, "src", "generated", "ghostscript", "gs.mjs");
const expectedHashPath = path.join(repoRoot, GS_WASM_SHA256_FILE);

/**
 * @param {string[]} args
 * @param {string} label
 */
function runDocker(args, label) {
  const result = spawnSync("docker", args, { stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${String(result.status ?? "unknown")})`);
  }
}

/**
 * @param {string} artifactDir
 */
async function exportArtifactsFromImage(artifactDir) {
  const containerName = `postscript-viewer-gs-wasm-export-${process.pid}`;
  try {
    runDocker(["create", "--name", containerName, DOCKER_IMAGE], "docker create");
    for (const name of ["gs.wasm", "gs.mjs"]) {
      runDocker(
        ["cp", `${containerName}:/out/${name}`, path.join(artifactDir, name)],
        `docker cp ${name}`,
      );
    }
  } finally {
    spawnSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  }
}

/**
 * @param {string} gluePath
 */
async function assertGlueHasNoDynamicExecution(gluePath) {
  const glue = await readFile(gluePath, "utf8");
  if (DYNAMIC_EXECUTION_PATTERN.test(glue)) {
    throw new Error(`${path.basename(gluePath)} contains eval or new Function`);
  }
}

/**
 * @returns {Promise<number>} process exit code
 */
async function main() {
  runDocker(["build", "-t", DOCKER_IMAGE, dockerContext], "docker build");

  const artifactDir = await mkdtemp(path.join(os.tmpdir(), "gs-wasm-artifacts-"));
  try {
    await exportArtifactsFromImage(artifactDir);

    const sourceWasm = path.join(artifactDir, "gs.wasm");
    const sourceGlue = path.join(artifactDir, "gs.mjs");

    const wasmResult = await installWasmIfSha256Matches({
      sourceWasm,
      destWasm,
      expectedHashPath,
    });
    if (!wasmResult.ok) {
      return wasmResult.exitCode;
    }

    await assertGlueHasNoDynamicExecution(sourceGlue);

    await mkdir(path.dirname(destGlue), { recursive: true });
    await copyFile(sourceGlue, destGlue);

    console.log(wasmResult.size);
    return 0;
  } finally {
    await rm(artifactDir, { recursive: true, force: true });
  }
}

process.exit(await main());

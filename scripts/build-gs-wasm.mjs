/**
 * Build gs.wasm and gs.mjs via Docker (emscripten/emsdk) and install into the repo.
 */

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GS_GLUE_FILE_NAME,
  GS_WASM_FILE_NAME,
  installGsWasmAsset,
  removeInstalledGsAssets,
  workersStaticAssetSizeError,
} from "./gs-wasm-assets.mjs";

const DOCKER_IMAGE = "postscript-viewer-gs-wasm";
const DYNAMIC_EXECUTION_PATTERN = /\b(eval|new\s+Function)\b/;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerContext = path.join(repoRoot, "docker", "ghostscript-wasm");
const destWasm = path.join(repoRoot, "public", GS_WASM_FILE_NAME);
const destGlue = path.join(repoRoot, "src", "generated", "ghostscript", GS_GLUE_FILE_NAME);

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
    for (const name of [GS_WASM_FILE_NAME, GS_GLUE_FILE_NAME]) {
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
 * @returns {() => Promise<number>}
 */
function createInstallFailureHandler() {
  return async (exitCode) => {
    await removeInstalledGsAssets({ destWasm, destGlue });
    return exitCode;
  };
}

/**
 * @param {object} options
 * @param {string} options.sourceWasm
 * @param {string} options.sourceGlue
 * @param {() => Promise<number>} options.failInstall
 * @returns {Promise<number>}
 */
async function installBuiltArtifacts({ sourceWasm, sourceGlue, failInstall }) {
  try {
    await assertGlueHasNoDynamicExecution(sourceGlue);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return failInstall(1);
  }

  const wasmSize = (await stat(sourceWasm)).size;
  const wasmSizeError = workersStaticAssetSizeError(wasmSize, GS_WASM_FILE_NAME);
  if (wasmSizeError !== undefined) {
    console.error(wasmSizeError);
    return failInstall(1);
  }

  const glueSize = (await stat(sourceGlue)).size;
  const glueSizeError = workersStaticAssetSizeError(glueSize, GS_GLUE_FILE_NAME);
  if (glueSizeError !== undefined) {
    console.error(glueSizeError);
    return failInstall(1);
  }

  await installGsWasmAsset({ sourcePath: sourceWasm, destPath: destWasm });
  await installGsWasmAsset({ sourcePath: sourceGlue, destPath: destGlue });

  console.log(wasmSize);
  return 0;
}

/**
 * @returns {Promise<number>} process exit code
 */
async function main() {
  const failInstall = createInstallFailureHandler();

  try {
    runDocker(["build", "-t", DOCKER_IMAGE, dockerContext], "docker build");

    const artifactDir = await mkdtemp(path.join(os.tmpdir(), "gs-wasm-artifacts-"));
    try {
      await exportArtifactsFromImage(artifactDir);

      const sourceWasm = path.join(artifactDir, GS_WASM_FILE_NAME);
      const sourceGlue = path.join(artifactDir, GS_GLUE_FILE_NAME);

      return await installBuiltArtifacts({ sourceWasm, sourceGlue, failInstall });
    } finally {
      await rm(artifactDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return failInstall(1);
  }
}

process.exit(await main());

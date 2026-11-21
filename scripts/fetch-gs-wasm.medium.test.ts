import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  constants,
  copyFile,
  mkdtemp,
  mkdir,
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/** Same limit as `scripts/fetch-gs-wasm.mjs` (Cloudflare Workers static asset cap). */
const WORKERS_STATIC_ASSET_MAX_BYTES = 25 * 1024 * 1024;

const GS_WASM_SHA256_FILE = "gs-wasm.sha256";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_FETCH_SCRIPT = path.join(REPO_ROOT, "scripts", "fetch-gs-wasm.mjs");

type TempRepoLayout = {
  repoRoot: string;
  fetchScript: string;
  hashFile: string;
  destWasm: string;
  packageWasm: string;
};

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  return createHash("sha256").update(bytes).digest("hex");
}

async function createTempRepo(): Promise<TempRepoLayout> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "fetch-gs-wasm-"));
  tempDirs.push(repoRoot);

  const fetchScript = path.join(repoRoot, "scripts", "fetch-gs-wasm.mjs");
  const packageDir = path.join(repoRoot, "node_modules", "ghostscript-wasm-esm");
  const packageWasm = path.join(packageDir, "gs.wasm");

  await mkdir(path.dirname(fetchScript), { recursive: true });
  await mkdir(path.join(repoRoot, "public"), { recursive: true });
  await mkdir(packageDir, { recursive: true });

  await copyFile(PRODUCTION_FETCH_SCRIPT, fetchScript);
  await writeFile(
    path.join(packageDir, "package.json"),
    JSON.stringify({ name: "ghostscript-wasm-esm", version: "1.0.1" }),
  );

  return {
    repoRoot,
    fetchScript,
    hashFile: path.join(repoRoot, GS_WASM_SHA256_FILE),
    destWasm: path.join(repoRoot, "public", "gs.wasm"),
    packageWasm,
  };
}

async function runFetchScript(layout: TempRepoLayout): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [layout.fetchScript], { stdio: "pipe" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
}

async function writeOversizedWasm(filePath: string): Promise<void> {
  const handle = await open(filePath, "w");
  try {
    await handle.truncate(WORKERS_STATIC_ASSET_MAX_BYTES + 1);
  } finally {
    await handle.close();
  }
}

describe("fetch-gs-wasm.mjs", () => {
  it("copies gs.wasm when SHA-256 matches the hash file", async () => {
    const layout = await createTempRepo();
    const wasmBytes = new TextEncoder().encode("wasm-test-payload");
    await writeFile(layout.packageWasm, wasmBytes);
    const expectedHash = await sha256HexOfBytes(wasmBytes);
    await writeFile(layout.hashFile, `${expectedHash}\n`);

    const exitCode = await runFetchScript(layout);

    expect(exitCode).toBe(0);
    expect(await pathExists(layout.destWasm)).toBe(true);
    expect(await readFile(layout.destWasm)).toEqual(Buffer.from(wasmBytes));
  });

  it("exits with code 1 and removes existing public/gs.wasm on hash mismatch", async () => {
    const layout = await createTempRepo();
    const wasmBytes = new TextEncoder().encode("wasm-test-payload");
    await writeFile(layout.packageWasm, wasmBytes);
    await writeFile(layout.hashFile, `${"0".repeat(64)}\n`);
    await writeFile(layout.destWasm, new TextEncoder().encode("stale wasm"));

    const exitCode = await runFetchScript(layout);

    expect(exitCode).toBe(1);
    expect(await pathExists(layout.destWasm)).toBe(false);
  });

  it("fails when the hash file format is invalid", async () => {
    const layout = await createTempRepo();
    await writeFile(layout.packageWasm, new TextEncoder().encode("wasm"));
    await writeFile(layout.hashFile, "not-a-valid-sha256\n");

    const exitCode = await runFetchScript(layout);

    expect(exitCode).toBe(1);
    expect(await pathExists(layout.destWasm)).toBe(false);
  });

  it("fails when source wasm exceeds the Workers static asset size limit", async () => {
    const layout = await createTempRepo();
    await writeOversizedWasm(layout.packageWasm);
    await writeFile(layout.hashFile, `${"a".repeat(64)}\n`);

    const exitCode = await runFetchScript(layout);

    expect(exitCode).toBe(1);
    expect(await pathExists(layout.destWasm)).toBe(false);
  });
});

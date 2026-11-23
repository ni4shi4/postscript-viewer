import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
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

/** Align with `scripts/gs-wasm-assets.mjs` (not imported: no TypeScript declarations for that module). */
const WORKERS_STATIC_ASSET_MAX_BYTES = 25 * 1024 * 1024;
const GS_WASM_FILE_NAME = "gs.wasm";
const GS_GLUE_FILE_NAME = "gs.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_FETCH_SCRIPT = path.join(REPO_ROOT, "scripts", "fetch-gs-wasm.mjs");
const PRODUCTION_ASSETS_MODULE = path.join(REPO_ROOT, "scripts", "gs-wasm-assets.mjs");

type TempRepoLayout = {
  repoRoot: string;
  fetchScript: string;
  destWasm: string;
  destGlue: string;
  baseUrl: string;
};

let tempDirs: string[] = [];
let servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  servers = [];
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

async function startAssetServer(
  assets: Record<string, Uint8Array | Buffer>,
): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    const fileName = path.basename(req.url ?? "");
    const body = assets[fileName];
    if (body === undefined) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.end(body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("failed to bind HTTP server");
  }
  servers.push(server);
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

type CreateTempRepoOptions = {
  wasmBytes: Uint8Array;
  glueBytes: Uint8Array;
  serverAssets?: Record<string, Uint8Array | Buffer>;
  hashFileContent?: string;
};

async function createTempRepo(options: CreateTempRepoOptions): Promise<TempRepoLayout> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "fetch-gs-wasm-"));
  tempDirs.push(repoRoot);

  const scriptsDir = path.join(repoRoot, "scripts");
  const fetchScript = path.join(scriptsDir, "fetch-gs-wasm.mjs");

  await mkdir(scriptsDir, { recursive: true });
  await mkdir(path.join(repoRoot, "public"), { recursive: true });
  await mkdir(path.join(repoRoot, "src", "generated", "ghostscript"), { recursive: true });

  await copyFile(PRODUCTION_FETCH_SCRIPT, fetchScript);
  await copyFile(PRODUCTION_ASSETS_MODULE, path.join(scriptsDir, "gs-wasm-assets.mjs"));

  if (options.hashFileContent !== undefined) {
    await writeFile(path.join(repoRoot, "gs-wasm.sha256"), options.hashFileContent);
  }

  const serverAssets: Record<string, Uint8Array | Buffer> = options.serverAssets ?? {
    [GS_WASM_FILE_NAME]: options.wasmBytes,
    [GS_GLUE_FILE_NAME]: options.glueBytes,
  };
  const { baseUrl } = await startAssetServer(serverAssets);

  return {
    repoRoot,
    fetchScript,
    destWasm: path.join(repoRoot, "public", GS_WASM_FILE_NAME),
    destGlue: path.join(repoRoot, "src", "generated", "ghostscript", GS_GLUE_FILE_NAME),
    baseUrl,
  };
}

async function runFetchScript(layout: TempRepoLayout): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [layout.fetchScript], {
      stdio: "pipe",
      env: { ...process.env, GS_WASM_RELEASE_BASE_URL: layout.baseUrl },
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
}

async function writeOversizedFile(filePath: string): Promise<void> {
  const handle = await open(filePath, "w");
  try {
    await handle.truncate(WORKERS_STATIC_ASSET_MAX_BYTES + 1);
  } finally {
    await handle.close();
  }
}

describe("fetch-gs-wasm.mjs", () => {
  it("installs gs.wasm and gs.mjs without a hash file", async () => {
    const wasmBytes = new TextEncoder().encode("wasm-test-payload");
    const glueBytes = new TextEncoder().encode("glue-test-payload");
    const layout = await createTempRepo({ wasmBytes, glueBytes });

    const exitCode = await runFetchScript(layout);

    expect(exitCode).toBe(0);
    expect(await pathExists(layout.destWasm)).toBe(true);
    expect(await pathExists(layout.destGlue)).toBe(true);
    expect(await readFile(layout.destWasm)).toEqual(Buffer.from(wasmBytes));
    expect(await readFile(layout.destGlue)).toEqual(Buffer.from(glueBytes));
  });

  it("installs gs.wasm and gs.mjs even when a stale hash file is present", async () => {
    const wasmBytes = new TextEncoder().encode("wasm-test-payload");
    const glueBytes = new TextEncoder().encode("glue-test-payload");
    const layout = await createTempRepo({
      wasmBytes,
      glueBytes,
      hashFileContent: `${"0".repeat(64)}  ${GS_WASM_FILE_NAME}\n${"0".repeat(64)}  ${GS_GLUE_FILE_NAME}\n`,
    });

    const exitCode = await runFetchScript(layout);

    expect(exitCode).toBe(0);
    expect(await pathExists(layout.destWasm)).toBe(true);
    expect(await pathExists(layout.destGlue)).toBe(true);
    expect(await readFile(layout.destWasm)).toEqual(Buffer.from(wasmBytes));
    expect(await readFile(layout.destGlue)).toEqual(Buffer.from(glueBytes));
  });

  it("fails when downloaded gs.wasm exceeds the Workers static asset size limit", async () => {
    const glueBytes = new TextEncoder().encode("glue");
    const oversizedPath = path.join(os.tmpdir(), `oversized-wasm-${String(process.pid)}`);
    await writeOversizedFile(oversizedPath);
    const wasmBytes = await readFile(oversizedPath);
    await rm(oversizedPath, { force: true });

    const layout = await createTempRepo({
      wasmBytes,
      glueBytes,
    });

    const exitCode = await runFetchScript(layout);

    expect(exitCode).toBe(1);
    expect(await pathExists(layout.destWasm)).toBe(false);
    expect(await pathExists(layout.destGlue)).toBe(false);
  });

  it("does not leave partial assets when a release download fails", async () => {
    const wasmBytes = new TextEncoder().encode("wasm-only");
    const layout = await createTempRepo({
      wasmBytes,
      glueBytes: new TextEncoder().encode("unused"),
      serverAssets: {
        [GS_WASM_FILE_NAME]: wasmBytes,
      },
    });
    await writeFile(layout.destWasm, new TextEncoder().encode("stale wasm"));
    await writeFile(layout.destGlue, new TextEncoder().encode("stale glue"));

    const exitCode = await runFetchScript(layout);

    expect(exitCode).toBe(1);
    expect(await pathExists(layout.destWasm)).toBe(false);
    expect(await pathExists(layout.destGlue)).toBe(false);
  });
});

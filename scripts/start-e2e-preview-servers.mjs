/**
 * Build once, then serve large E2E tests from viewer and security-header preview ports.
 */

import { execSync, spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  E2E_PREVIEW_PORT,
  E2E_PREVIEW_SERVERS_READY,
  E2E_SECURITY_PREVIEW_PORT,
  previewOriginForPort,
} from "../e2e/e2e-preview-ports.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const previewOrigin = previewOriginForPort(E2E_PREVIEW_PORT);
const securityPreviewOrigin = previewOriginForPort(E2E_SECURITY_PREVIEW_PORT);

/** @typedef {import('node:child_process').ChildProcess} ChildProcess */

/** @type {ChildProcess[]} */
const previewProcesses = [];

/**
 * @param {string} npmScript
 * @param {number} port
 * @returns {ChildProcess}
 */
function spawnPreviewServer(npmScript, port) {
  const host = new URL(previewOriginForPort(port)).hostname;
  const child = spawn("npm", ["run", npmScript, "--", "--port", String(port), "--host", host], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout?.on("data", (chunk) => process.stderr.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  child.on("exit", (code, signal) => {
    if (signal !== null) {
      return;
    }
    if (code === 0) {
      return;
    }
    terminatePreviewServers();
    process.exit(code ?? 1);
  });

  return child;
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
async function waitForHttpOk(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function terminatePreviewServers() {
  for (const child of previewProcesses) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
    }
  }
}

execSync("npm run build", { cwd: repoRoot, stdio: "inherit" });

previewProcesses.push(spawnPreviewServer("preview", E2E_PREVIEW_PORT));
previewProcesses.push(spawnPreviewServer("preview:e2e", E2E_SECURITY_PREVIEW_PORT));

const startupTimeoutMs = 180_000;
await waitForHttpOk(previewOrigin, startupTimeoutMs);
await waitForHttpOk(securityPreviewOrigin, startupTimeoutMs);

console.log(E2E_PREVIEW_SERVERS_READY);

await Promise.race([once(process, "SIGTERM"), once(process, "SIGINT")]);
terminatePreviewServers();
process.exit(0);

import { defineConfig, devices } from "@playwright/test";

import e2ePreviewPorts from "./e2e/e2e-preview-ports.json" with { type: "json" };

const previewOrigin = `http://127.0.0.1:${e2ePreviewPorts.viewerPort}`;
const securityPreviewOrigin = `http://127.0.0.1:${e2ePreviewPorts.securityPort}`;

const reuseExistingServer = !process.env.CI;
const webServerTimeoutMs = 180_000;

function createE2ePreviewWebServer() {
  return {
    command: "npm run preview:e2e-servers",
    reuseExistingServer,
    timeout: webServerTimeoutMs,
    gracefulShutdown: { signal: "SIGTERM" as const, timeout: 3_000 },
    wait: { stdout: new RegExp(e2ePreviewPorts.readyMessage) },
  };
}

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.large.spec.ts",
  fullyParallel: false,
  projects: [
    {
      name: "chromium",
      testMatch: "viewer.large.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: previewOrigin,
      },
    },
    {
      name: "chromium-security-headers",
      testMatch: "security-headers.large.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: securityPreviewOrigin,
      },
    },
  ],
  webServer: createE2ePreviewWebServer(),
});

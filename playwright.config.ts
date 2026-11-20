import { defineConfig, devices } from "@playwright/test";

/** Preview server port for large E2E tests (single source of truth). */
export const E2E_PREVIEW_PORT = 4173;

const previewOrigin = `http://127.0.0.1:${E2E_PREVIEW_PORT}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.large.spec.ts",
  fullyParallel: false,
  use: {
    baseURL: previewOrigin,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${E2E_PREVIEW_PORT}`,
    url: previewOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

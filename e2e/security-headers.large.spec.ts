import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { attachCspViolationMonitor } from "./support/csp-violation-monitor";
import { expectPdfFrameShowsBlobSrc } from "./support/expect-pdf-frame";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const minimalPsPath = path.join(fixturesDir, "minimal.ps");

test("serves CSP headers on preview and shows a PDF without policy violations", async ({
  page,
}) => {
  const cspMonitor = await attachCspViolationMonitor(page);

  try {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const headers = response!.headers();
    const contentSecurityPolicy =
      headers["content-security-policy"] ?? headers["Content-Security-Policy"];
    expect(contentSecurityPolicy).toBeDefined();
    expect(contentSecurityPolicy!.length).toBeGreaterThan(0);

    await page.getByTestId("file-input").setInputFiles(minimalPsPath);
    await expectPdfFrameShowsBlobSrc(page);

    expect(await cspMonitor.violationCount()).toBe(0);
  } finally {
    cspMonitor.dispose();
  }
});

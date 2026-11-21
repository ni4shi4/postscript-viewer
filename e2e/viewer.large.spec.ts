import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { expect, test } from "@playwright/test";

import { expectPdfFrameShowsBlobPdf } from "./support/expect-pdf-frame";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const minimalPsPath = path.join(fixturesDir, "minimal.ps");
const notGzipPsPath = path.join(fixturesDir, "not-gzip.ps");

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows a trust notice near the file picker", async ({ page }) => {
  const trustNotice = page.getByTestId("trust-notice");
  await expect(trustNotice).toBeVisible();
  await expect(trustNotice).toContainText("信頼できる PostScript");
});

test("displays a PDF blob when a .ps file is selected", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles(minimalPsPath);
  await expectPdfFrameShowsBlobPdf(page);
});

test("displays a PDF blob when a gzip-compressed .ps.gz file is selected", async ({ page }) => {
  const postScriptBytes = readFileSync(minimalPsPath);
  const gzipBody = gzipSync(postScriptBytes);

  await page.getByTestId("file-input").setInputFiles({
    name: "minimal.ps.gz",
    mimeType: "application/gzip",
    buffer: gzipBody,
  });

  await expectPdfFrameShowsBlobPdf(page);
});

test("shows an error for a mislabeled .ps.gz, then recovers after a valid .ps", async ({
  page,
}) => {
  await page.getByTestId("file-input").setInputFiles({
    name: "broken.ps.gz",
    mimeType: "application/gzip",
    buffer: readFileSync(notGzipPsPath),
  });

  const viewerStatus = page.getByTestId("viewer-status");
  await expect(viewerStatus).toBeVisible();
  await expect(viewerStatus).not.toBeEmpty();

  const pdfFrame = page.getByTestId("pdf-frame");
  await expect(pdfFrame).toBeHidden();

  await page.getByTestId("file-input").setInputFiles(minimalPsPath);
  await expectPdfFrameShowsBlobPdf(page);
});

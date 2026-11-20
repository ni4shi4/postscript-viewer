import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { expect, test, type Page } from "@playwright/test";

const PDF_MAGIC = "%PDF-";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const minimalPsPath = path.join(fixturesDir, "minimal.ps");
const notGzipPsPath = path.join(fixturesDir, "not-gzip.ps");

async function expectPdfFrameShowsBlobPdf(page: Page): Promise<void> {
  const pdfFrame = page.getByTestId("pdf-frame");
  await expect(pdfFrame).toBeVisible();

  const src = await pdfFrame.getAttribute("src");
  expect(src).not.toBeNull();
  expect(src).toMatch(/^blob:/);

  const pdfHeader = await page.evaluate(
    async ({ blobUrl, magic }) => {
      const response = await fetch(blobUrl);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      return new TextDecoder().decode(bytes.subarray(0, magic.length));
    },
    { blobUrl: src as string, magic: PDF_MAGIC },
  );

  expect(pdfHeader).toBe(PDF_MAGIC);
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
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

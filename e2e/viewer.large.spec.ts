import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { expect, test, type Page } from "@playwright/test";

import { expectPdfCanvasHasSignificantInk } from "./support/expect-canvas-ink";
import { expectPdfCanvasShowsRenderedPdf } from "./support/expect-pdf-canvas";
import { beginWatchingPdfJsStandardFontData } from "./support/expect-pdfjs-standard-font-request";
import {
  emulateBuiltInPdfViewer,
  emulateNoBuiltInPdfViewer,
} from "./support/emulate-pdf-viewer-capability";
import { expectPdfFrameShowsBlobPdf, expectPdfFrameShowsBlobSrc } from "./support/expect-pdf-frame";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const minimalPsPath = path.join(fixturesDir, "minimal.ps");
const notGzipPsPath = path.join(fixturesDir, "not-gzip.ps");
const textHelveticaPsPath = path.join(fixturesDir, "text-helvetica.ps");
const withTextPsPath = path.join(fixturesDir, "with-text.ps");

async function readPdfBlobByteLength(page: Page): Promise<number> {
  const src = await expectPdfFrameShowsBlobSrc(page);
  return page.evaluate(async (blobUrl) => {
    const response = await fetch(blobUrl);
    return (await response.arrayBuffer()).byteLength;
  }, src);
}
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await emulateBuiltInPdfViewer(page);
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

test("redisplays the converted PDF after a full page reload", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles(minimalPsPath);
  await expectPdfFrameShowsBlobPdf(page);

  await page.reload();
  await expectPdfFrameShowsBlobPdf(page);
});

test("redisplays the converted PDF after leaving and going back", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles(minimalPsPath);
  await expectPdfFrameShowsBlobPdf(page);

  await page.goto("data:text/html,<p>away</p>");
  await page.goBack();
  await expectPdfFrameShowsBlobPdf(page);
});

test("replaces the stored PDF when a different PostScript file is converted", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles(minimalPsPath);
  await expectPdfFrameShowsBlobPdf(page);
  const firstPdfByteLength = await readPdfBlobByteLength(page);

  await page.getByTestId("file-input").setInputFiles(withTextPsPath);
  await expectPdfFrameShowsBlobPdf(page);
  const secondPdfByteLength = await readPdfBlobByteLength(page);
  expect(secondPdfByteLength).not.toBe(firstPdfByteLength);

  await page.reload();
  await expectPdfFrameShowsBlobPdf(page);
  const restoredPdfByteLength = await readPdfBlobByteLength(page);
  expect(restoredPdfByteLength).toBe(secondPdfByteLength);
});

test.describe("when built-in PDF viewer is unavailable", () => {
  test.beforeEach(async ({ page }) => {
    await emulateNoBuiltInPdfViewer(page);
    await page.goto("/");
  });

  test("displays a rendered PDF on canvas when a .ps file is selected", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(minimalPsPath);
    await expectPdfCanvasShowsRenderedPdf(page);
  });

  test("renders text ink on canvas when a PostScript file with standard-font text is selected", async ({
    page,
  }) => {
    await page.getByTestId("file-input").setInputFiles(textHelveticaPsPath);
    await expectPdfCanvasShowsRenderedPdf(page);
    await expectPdfCanvasHasSignificantInk(page);
  });

  test("fetches pdf.js standard font data when rendering standard-font text", async ({ page }) => {
    const standardFontDataWatch = beginWatchingPdfJsStandardFontData(page);
    await page.getByTestId("file-input").setInputFiles(textHelveticaPsPath);
    await expectPdfCanvasShowsRenderedPdf(page);
    await standardFontDataWatch.expectFetched();
  });
});

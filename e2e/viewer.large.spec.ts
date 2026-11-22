import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { expectPdfCanvasHasSignificantInk } from "./support/expect-canvas-ink";
import { beginWatchingPdfJsStandardFontData } from "./support/expect-pdfjs-standard-font-request";
import {
  emulateBuiltInPdfViewer,
  emulateNoBuiltInPdfViewer,
} from "./support/emulate-pdf-viewer-capability";
import { expectPdfFrameShowsBlobPdf, expectPdfFrameShowsBlobSrc } from "./support/expect-pdf-frame";
import { MAX_PDF_HISTORY_ENTRIES } from "../src/core/domain/limits";
import {
  activateHistoryEntryAndExpectCanvas,
  activateHistoryEntryAndExpectPdfFrame,
  convertPostScriptViaFilePicker,
  convertPostScriptViaFilePickerOnCanvas,
  expectViewerFileName,
} from "./support/wait-viewer-conversion";

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

function historyItemSelectButton(row: Locator): Locator {
  return row.locator(".history-item__select");
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

test("shows the page heading and a descriptive document title", async ({ page }) => {
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();

  const title = await page.title();
  expect(title).not.toBe("");
  expect(title).not.toBe("postscript-viewer");
});

test("displays a PDF blob when a .ps file is selected", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
});

const layoutHeightTolerancePx = 3;

async function readViewerSurfaceLayout(page: Page) {
  return page.evaluate(() => {
    const selectors = {
      toolbar: ".toolbar",
      footer: ".app-footer",
      viewer: "main.viewer",
      viewerSurface: ".viewer-surface",
      pdfFrame: '[data-testid="pdf-frame"]',
    } as const;

    const layout: Record<
      keyof typeof selectors,
      { top: number; height: number; bottom: number } | null
    > = {
      toolbar: null,
      footer: null,
      viewer: null,
      viewerSurface: null,
      pdfFrame: null,
    };

    for (const key of Object.keys(selectors) as Array<keyof typeof selectors>) {
      const element = document.querySelector(selectors[key]);
      if (element === null) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      layout[key] = { top: rect.top, height: rect.height, bottom: rect.bottom };
    }

    return {
      viewportHeight: window.innerHeight,
      ...layout,
    };
  });
}

function expectMainViewerFillsRemainingViewport(
  layout: Awaited<ReturnType<typeof readViewerSurfaceLayout>>,
): void {
  expect(layout.toolbar).not.toBeNull();
  expect(layout.footer).not.toBeNull();
  expect(layout.viewer).not.toBeNull();

  const toolbarBottom = layout.toolbar!.bottom;
  const footerTop = layout.footer!.top;
  const remainingHeight = footerTop - toolbarBottom;

  expect(remainingHeight).toBeGreaterThan(150);
  expect(layout.viewer!.height).toBeGreaterThan(remainingHeight - layoutHeightTolerancePx);
  expect(layout.viewer!.height).toBeLessThan(remainingHeight + layoutHeightTolerancePx);
  expect(layout.viewer!.top).toBeGreaterThan(toolbarBottom - layoutHeightTolerancePx);
  expect(layout.viewer!.top).toBeLessThan(toolbarBottom + layoutHeightTolerancePx);
  expect(layout.viewer!.bottom).toBeGreaterThan(footerTop - layoutHeightTolerancePx);
  expect(layout.viewer!.bottom).toBeLessThan(footerTop + layoutHeightTolerancePx);
}

function expectPdfFrameFillsMainViewer(
  layout: Awaited<ReturnType<typeof readViewerSurfaceLayout>>,
): void {
  expect(layout.viewer).not.toBeNull();
  expect(layout.pdfFrame).not.toBeNull();

  const viewerHeight = layout.viewer!.height;
  const viewerTop = layout.viewer!.top;
  const viewerBottom = layout.viewer!.bottom;

  expect(layout.pdfFrame!.height).toBeGreaterThan(150);
  expect(layout.pdfFrame!.height).toBeGreaterThan(viewerHeight - layoutHeightTolerancePx);
  expect(layout.pdfFrame!.height).toBeLessThan(viewerHeight + layoutHeightTolerancePx);
  expect(layout.pdfFrame!.top).toBeGreaterThan(viewerTop - layoutHeightTolerancePx);
  expect(layout.pdfFrame!.top).toBeLessThan(viewerTop + layoutHeightTolerancePx);
  expect(layout.pdfFrame!.bottom).toBeGreaterThan(viewerBottom - layoutHeightTolerancePx);
  expect(layout.pdfFrame!.bottom).toBeLessThan(viewerBottom + layoutHeightTolerancePx);
}

test("fills the main viewer with the PDF preview between the toolbar and footer", async ({
  page,
}) => {
  const initialLayout = await readViewerSurfaceLayout(page);
  expectMainViewerFillsRemainingViewport(initialLayout);

  await convertPostScriptViaFilePicker(page, minimalPsPath);

  const convertedLayout = await readViewerSurfaceLayout(page);
  expectMainViewerFillsRemainingViewport(convertedLayout);
  expectPdfFrameFillsMainViewer(convertedLayout);
});

test("displays a PDF blob when a gzip-compressed .ps.gz file is selected", async ({ page }) => {
  const postScriptBytes = readFileSync(minimalPsPath);
  const gzipBody = gzipSync(postScriptBytes);

  await convertPostScriptViaFilePicker(page, {
    name: "minimal.ps.gz",
    mimeType: "application/gzip",
    buffer: gzipBody,
  });
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

  await convertPostScriptViaFilePicker(page, minimalPsPath);
});

test("redisplays the converted PDF after a full page reload", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);

  await page.reload();
  await expectPdfFrameShowsBlobPdf(page);
});

test("keeps the selected file name visible after conversion completes", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
});

test("redisplays the saved file name after a full page reload", async ({ page }) => {
  const expectedFileName = path.basename(minimalPsPath);

  await convertPostScriptViaFilePicker(page, minimalPsPath);

  await page.reload();
  await expectPdfFrameShowsBlobPdf(page);
  await expectViewerFileName(page, expectedFileName);
});

test("replaces the displayed file name when a different PostScript file is converted", async ({
  page,
}) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await convertPostScriptViaFilePicker(page, withTextPsPath);
});

test("redisplays the converted PDF after leaving and going back", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);

  await page.goto("data:text/html,<p>away</p>");
  await page.goBack();
  await expectPdfFrameShowsBlobPdf(page);
});

test("replaces the stored PDF when a different PostScript file is converted", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  const firstPdfByteLength = await readPdfBlobByteLength(page);

  await convertPostScriptViaFilePicker(page, withTextPsPath);
  const secondPdfByteLength = await readPdfBlobByteLength(page);
  expect(secondPdfByteLength).not.toBe(firstPdfByteLength);

  await page.reload();
  await expectPdfFrameShowsBlobPdf(page);
  const restoredPdfByteLength = await readPdfBlobByteLength(page);
  expect(restoredPdfByteLength).toBe(secondPdfByteLength);
});

test("lists converted files in the history sidebar and switches preview on selection", async ({
  page,
}) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  const minimalPdfByteLength = await readPdfBlobByteLength(page);

  await convertPostScriptViaFilePicker(page, withTextPsPath);
  const withTextPdfByteLength = await readPdfBlobByteLength(page);
  expect(withTextPdfByteLength).not.toBe(minimalPdfByteLength);

  const historyItems = page.getByTestId("history-item");
  await expect(historyItems).toHaveCount(2);

  const withTextBaseName = path.basename(withTextPsPath);
  const withTextRow = historyItems.filter({ hasText: withTextBaseName });
  await expect(historyItemSelectButton(withTextRow)).toHaveAttribute("aria-current", "true");

  const minimalBaseName = path.basename(minimalPsPath);
  const minimalRow = historyItems.filter({ hasText: minimalBaseName });
  await activateHistoryEntryAndExpectPdfFrame(
    page,
    historyItemSelectButton(minimalRow),
    minimalBaseName,
  );
  expect(await readPdfBlobByteLength(page)).toBe(minimalPdfByteLength);
});

test("reflects history deletions in the sidebar and clears the preview when the selection is removed", async ({
  page,
}) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await convertPostScriptViaFilePicker(page, withTextPsPath);
  await expect(page.getByTestId("history-item")).toHaveCount(2);

  const withTextRow = page
    .getByTestId("history-item")
    .filter({ hasText: path.basename(withTextPsPath) });
  await withTextRow.getByTestId("history-delete").click();
  await expect(page.getByTestId("history-item")).toHaveCount(1);
  await expect(page.getByTestId("pdf-frame")).toBeHidden();

  await activateHistoryEntryAndExpectPdfFrame(
    page,
    historyItemSelectButton(page.getByTestId("history-item")),
    path.basename(minimalPsPath),
  );

  await page.getByTestId("history-clear-all").click();
  await expect(page.getByTestId("history-item")).toHaveCount(0);
  await expect(page.getByTestId("history-empty")).toBeVisible();
  await expect(page.getByTestId("pdf-frame")).toBeHidden();
});

test("restores the history list after a full page reload", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await convertPostScriptViaFilePicker(page, withTextPsPath);
  await expect(page.getByTestId("history-item")).toHaveCount(2);

  await page.reload();
  await expect(page.getByTestId("history-item")).toHaveCount(2);
  await expectPdfFrameShowsBlobPdf(page);
  await expectViewerFileName(page, path.basename(withTextPsPath));
});

test("keeps only the newest history entries when more than the limit are saved", async ({
  page,
}) => {
  const postScriptBytes = readFileSync(minimalPsPath);

  for (let index = 0; index < MAX_PDF_HISTORY_ENTRIES + 1; index += 1) {
    await convertPostScriptViaFilePicker(page, {
      name: `history-${index}.ps`,
      mimeType: "application/postscript",
      buffer: postScriptBytes,
    });
  }

  const historySidebar = page.getByTestId("history-sidebar");
  await expect(page.getByTestId("history-item")).toHaveCount(MAX_PDF_HISTORY_ENTRIES);
  await expect(historySidebar.getByText("history-0.ps")).toHaveCount(0);
  await expect(historySidebar.getByText(`history-${MAX_PDF_HISTORY_ENTRIES}.ps`)).toBeVisible();
});

test.describe("when built-in PDF viewer is unavailable", () => {
  test.beforeEach(async ({ page }) => {
    await emulateNoBuiltInPdfViewer(page);
    await page.goto("/");
  });

  test("displays a rendered PDF on canvas when a .ps file is selected", async ({ page }) => {
    await convertPostScriptViaFilePickerOnCanvas(page, minimalPsPath);
  });

  test("renders text ink on canvas when a PostScript file with standard-font text is selected", async ({
    page,
  }) => {
    await convertPostScriptViaFilePickerOnCanvas(page, textHelveticaPsPath);
    await expectPdfCanvasHasSignificantInk(page);
  });

  test("fetches pdf.js standard font data when rendering standard-font text", async ({ page }) => {
    const standardFontDataWatch = beginWatchingPdfJsStandardFontData(page);
    await convertPostScriptViaFilePickerOnCanvas(page, textHelveticaPsPath);
    await standardFontDataWatch.expectFetched();
  });

  test("switches canvas preview when a different history entry is selected", async ({ page }) => {
    await convertPostScriptViaFilePickerOnCanvas(page, minimalPsPath);
    await convertPostScriptViaFilePickerOnCanvas(page, withTextPsPath);

    const minimalBaseName = path.basename(minimalPsPath);
    const minimalRow = page.getByTestId("history-item").filter({ hasText: minimalBaseName });
    await activateHistoryEntryAndExpectCanvas(
      page,
      historyItemSelectButton(minimalRow),
      minimalBaseName,
    );
  });
});

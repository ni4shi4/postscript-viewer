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
import {
  centerOf,
  readRecordedParentInput,
  settleFrames,
  startRecordingParentInput,
} from "./support/parent-input-recorder";
import { expectPdfFrameShowsBlobPdf, expectPdfFrameShowsBlobSrc } from "./support/expect-pdf-frame";
import e2ePreviewPorts from "./e2e-preview-ports.json" with { type: "json" };
import { MAX_PDF_HISTORY_ENTRIES } from "../src/core/domain/limits";
import {
  activateHistoryEntryAndExpectCanvas,
  activateHistoryEntryAndExpectPdfFrame,
  convertPostScriptViaFilePicker,
  convertPostScriptViaFilePickerOnCanvas,
  expectSelectedFileInHistory,
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

test("shows the drop card with a trust notice before a file is selected", async ({ page }) => {
  await expect(page.getByTestId("drop-card")).toBeVisible();
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

test("shows the document bar with the file name only after a PostScript file is converted", async ({
  page,
}) => {
  const documentBar = page.getByTestId("document-bar");
  await expect(documentBar).toBeHidden();

  await convertPostScriptViaFilePicker(page, minimalPsPath);

  await expect(documentBar).toBeVisible();
  await expect(page.getByTestId("document-bar-file-name")).toHaveText("minimal.ps");
  await expect(page.getByTestId("download-pdf")).toBeVisible();
});

async function expectDownloadedPdf(page: Page, expectedFileName: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  const requestsDuringDownload: string[] = [];
  const onRequest = (request: { url: () => string }): void => {
    requestsDuringDownload.push(request.url());
  };
  page.on("request", onRequest);

  try {
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("download-pdf").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(expectedFileName);
    const savedPath = await download.path();
    expect(savedPath).not.toBeNull();
    const pdfHeader = readFileSync(savedPath!).subarray(0, 5).toString("ascii");
    expect(pdfHeader).toBe("%PDF-");
    expect(requestsDuringDownload).toEqual([]);
  } finally {
    page.off("request", onRequest);
  }
}

test("downloads the converted PDF from the document bar without additional network requests", async ({
  page,
}) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await expect(page.getByTestId("download-pdf")).toHaveAccessibleName("minimal.pdf をダウンロード");

  await expectDownloadedPdf(page, "minimal.pdf");
});

test("downloads a past document selected from the history", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await convertPostScriptViaFilePicker(page, withTextPsPath);
  await expect(page.getByTestId("document-bar-file-name")).toHaveText("with-text.ps");

  const minimalBaseName = path.basename(minimalPsPath);
  const minimalRow = page.getByTestId("history-item").filter({ hasText: minimalBaseName });
  await activateHistoryEntryAndExpectPdfFrame(
    page,
    historyItemSelectButton(minimalRow),
    minimalBaseName,
  );
  await expect(page.getByTestId("document-bar-file-name")).toHaveText(minimalBaseName);

  await expectDownloadedPdf(page, "minimal.pdf");
});

const layoutHeightTolerancePx = 3;

async function readViewerSurfaceLayout(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.height = "100dvh";
    document.body.appendChild(probe);
    const viewportHeightUsed = probe.getBoundingClientRect().height;
    probe.remove();

    const selectors = {
      toolbar: ".toolbar",
      footer: ".app-footer",
      historySidebar: '[data-testid="history-sidebar"]',
      viewerSurface: ".viewer-surface",
      documentBar: '[data-testid="document-bar"]',
      pdfFrame: '[data-testid="pdf-frame"]',
    } as const;

    const layout: Record<
      keyof typeof selectors,
      { top: number; height: number; bottom: number } | null
    > = {
      toolbar: null,
      footer: null,
      historySidebar: null,
      viewerSurface: null,
      documentBar: null,
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
      viewportHeightUsed,
      ...layout,
    };
  });
}

function expectViewerSurfaceFitsViewportWithToolbarAndFooter(
  layout: Awaited<ReturnType<typeof readViewerSurfaceLayout>>,
): void {
  expect(layout.toolbar).not.toBeNull();
  expect(layout.footer).not.toBeNull();
  expect(layout.viewerSurface).not.toBeNull();
  const { viewportHeightUsed } = layout;
  const total = layout.toolbar!.height + layout.viewerSurface!.height + layout.footer!.height;

  expect(total).toBeGreaterThan(viewportHeightUsed - layoutHeightTolerancePx);
  expect(total).toBeLessThan(viewportHeightUsed + layoutHeightTolerancePx);
}

function expectViewerSurfaceBetweenToolbarAndFooterWithinViewport(
  layout: Awaited<ReturnType<typeof readViewerSurfaceLayout>>,
): void {
  expect(layout.toolbar).not.toBeNull();
  expect(layout.footer).not.toBeNull();
  expect(layout.viewerSurface).not.toBeNull();

  const toolbarBottom = layout.toolbar!.bottom;
  const surfaceTop = layout.viewerSurface!.top;
  const { viewportHeightUsed } = layout;

  expect(surfaceTop).toBeGreaterThan(toolbarBottom - layoutHeightTolerancePx);
  expect(surfaceTop).toBeLessThan(toolbarBottom + layoutHeightTolerancePx);
  expect(layout.footer!.bottom).toBeLessThan(viewportHeightUsed + layoutHeightTolerancePx);
  expect(layout.footer!.top).toBeGreaterThan(
    layout.viewerSurface!.bottom - layoutHeightTolerancePx,
  );
  expect(layout.footer!.top).toBeLessThan(layout.viewerSurface!.bottom + layoutHeightTolerancePx);
}

function expectHistorySidebarMatchesViewerSurfaceHeight(
  layout: Awaited<ReturnType<typeof readViewerSurfaceLayout>>,
): void {
  expect(layout.historySidebar).not.toBeNull();
  expect(layout.viewerSurface).not.toBeNull();

  const sidebarHeight = layout.historySidebar!.height;
  const surfaceHeight = layout.viewerSurface!.height;

  expect(sidebarHeight).toBeGreaterThan(surfaceHeight - layoutHeightTolerancePx);
  expect(sidebarHeight).toBeLessThan(surfaceHeight + layoutHeightTolerancePx);
}

function expectPdfFrameFillsViewerSurfaceBelowDocumentBar(
  layout: Awaited<ReturnType<typeof readViewerSurfaceLayout>>,
): void {
  expect(layout.viewerSurface).not.toBeNull();
  expect(layout.documentBar).not.toBeNull();
  expect(layout.pdfFrame).not.toBeNull();

  const surfaceTop = layout.viewerSurface!.top;
  const surfaceBottom = layout.viewerSurface!.bottom;
  const barTop = layout.documentBar!.top;
  const barBottom = layout.documentBar!.bottom;

  expect(layout.documentBar!.height).toBeGreaterThan(0);
  expect(barTop).toBeGreaterThan(surfaceTop - layoutHeightTolerancePx);
  expect(barTop).toBeLessThan(surfaceTop + layoutHeightTolerancePx);

  const expectedFrameHeight = surfaceBottom - barBottom;
  expect(layout.pdfFrame!.height).toBeGreaterThan(150);
  expect(layout.pdfFrame!.height).toBeGreaterThan(expectedFrameHeight - layoutHeightTolerancePx);
  expect(layout.pdfFrame!.height).toBeLessThan(expectedFrameHeight + layoutHeightTolerancePx);
  expect(layout.pdfFrame!.top).toBeGreaterThan(barBottom - layoutHeightTolerancePx);
  expect(layout.pdfFrame!.top).toBeLessThan(barBottom + layoutHeightTolerancePx);
  expect(layout.pdfFrame!.bottom).toBeGreaterThan(surfaceBottom - layoutHeightTolerancePx);
  expect(layout.pdfFrame!.bottom).toBeLessThan(surfaceBottom + layoutHeightTolerancePx);
}

test("fits the header, viewer surface and footer into the viewport for the PDF preview", async ({
  page,
}) => {
  const initialLayout = await readViewerSurfaceLayout(page);
  expectViewerSurfaceFitsViewportWithToolbarAndFooter(initialLayout);
  expectViewerSurfaceBetweenToolbarAndFooterWithinViewport(initialLayout);
  expect(initialLayout.historySidebar).toBeNull();

  await convertPostScriptViaFilePicker(page, minimalPsPath);

  const convertedLayout = await readViewerSurfaceLayout(page);
  expectViewerSurfaceFitsViewportWithToolbarAndFooter(convertedLayout);
  expectViewerSurfaceBetweenToolbarAndFooterWithinViewport(convertedLayout);
  expectHistorySidebarMatchesViewerSurfaceHeight(convertedLayout);
  expectPdfFrameFillsViewerSurfaceBelowDocumentBar(convertedLayout);

  await page.setViewportSize({ width: 400, height: 720 });
  const narrowLayout = await readViewerSurfaceLayout(page);
  expectViewerSurfaceFitsViewportWithToolbarAndFooter(narrowLayout);
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

  await expect(page.getByTestId("drop-card").getByTestId("viewer-status")).toBeVisible();
  await expect(page.getByTestId("drop-card").getByTestId("viewer-file-name")).toHaveText(
    "broken.ps.gz",
  );

  const pdfFrame = page.getByTestId("pdf-frame");
  await expect(pdfFrame).toBeHidden();

  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await expect(page.getByTestId("drop-card")).toBeHidden();
});

async function dropPostScriptOnViewerSurface(page: Page, filePath: string): Promise<void> {
  const base64 = readFileSync(filePath).toString("base64");
  const fileName = path.basename(filePath);
  const dataTransfer = await page.evaluateHandle(
    ({ base64Body, name }) => {
      const bytes = Uint8Array.from(atob(base64Body), (char) => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name));
      return transfer;
    },
    { base64Body: base64, name: fileName },
  );
  await page.getByTestId("viewer-surface").dispatchEvent("dragenter", { dataTransfer });
  await expect(page.getByTestId("viewer-surface")).toHaveAttribute("data-dragging", "true");
  await page.getByTestId("viewer-surface").dispatchEvent("drop", { dataTransfer });
}

test("converts a .ps file dropped onto the drop card", async ({ page }) => {
  await dropPostScriptOnViewerSurface(page, minimalPsPath);

  await expectSelectedFileInHistory(page, "minimal.ps");
  await expectPdfFrameShowsBlobPdf(page);
  await expect(page.getByTestId("viewer-surface")).not.toHaveAttribute("data-dragging", "true");
});

test("converts a .ps file dropped while another PDF is displayed", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);

  await dropPostScriptOnViewerSurface(page, withTextPsPath);

  await expectSelectedFileInHistory(page, "with-text.ps");
  await expectPdfFrameShowsBlobPdf(page);
});

test("redisplays the converted PDF after a full page reload", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);

  await page.reload();
  await expectPdfFrameShowsBlobPdf(page);
});

test("hides the drop card and lists the file in the history after conversion completes", async ({
  page,
}) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await expect(page.getByTestId("drop-card")).toBeHidden();
});

test("redisplays the saved file name after a full page reload", async ({ page }) => {
  const expectedFileName = path.basename(minimalPsPath);

  await convertPostScriptViaFilePicker(page, minimalPsPath);

  await page.reload();
  await expectPdfFrameShowsBlobPdf(page);
  await expectSelectedFileInHistory(page, expectedFileName);
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
  await expect(page.getByTestId("drop-card")).toBeVisible();

  await activateHistoryEntryAndExpectPdfFrame(
    page,
    historyItemSelectButton(page.getByTestId("history-item")),
    path.basename(minimalPsPath),
  );

  await page.getByTestId("history-clear-all").click();
  await expect(page.getByTestId("history-item")).toHaveCount(0);
  await expect(page.getByTestId("history-sidebar")).toHaveCount(0);
  await expect(page.getByTestId("pdf-frame")).toBeHidden();
  await expect(page.getByTestId("drop-card")).toBeVisible();
});

test("restores the history list after a full page reload", async ({ page }) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await convertPostScriptViaFilePicker(page, withTextPsPath);
  await expect(page.getByTestId("history-item")).toHaveCount(2);

  await page.reload();
  await expect(page.getByTestId("history-item")).toHaveCount(2);
  await expectPdfFrameShowsBlobPdf(page);
  await expectSelectedFileInHistory(page, path.basename(withTextPsPath));
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

test("toggles the history sidebar into a rail and keeps the state after a reload", async ({
  page,
}) => {
  await expect(page.getByTestId("history-sidebar")).toHaveCount(0);
  await convertPostScriptViaFilePicker(page, minimalPsPath);

  await expect(page.getByTestId("history-convert-another")).toBeVisible();
  await page.getByRole("button", { name: "履歴を閉じる" }).click();
  await expect(page.getByTestId("history-item")).toHaveCount(0);
  await expect(page.getByTestId("history-rail-convert")).toBeVisible();

  await page.reload();
  await expectPdfFrameShowsBlobPdf(page);
  await expect(page.getByRole("button", { name: "履歴を開く" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByTestId("history-item")).toHaveCount(0);
});

test("returns to the drop card from convert-another and converts the next file", async ({
  page,
}) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  await expect(page.getByTestId("drop-card")).toBeHidden();

  await page.getByTestId("history-convert-another").click();

  await expect(page.getByTestId("drop-card")).toBeVisible();
  await expect(page.getByTestId("pdf-frame")).toBeHidden();
  await expect(page.getByTestId("history-convert-another")).toHaveCount(0);
  await expect(page.getByTestId("history-item")).toHaveCount(1);
  await expect(
    page.getByTestId("drop-card").getByRole("button", { name: "ファイルを選択" }),
  ).toBeFocused();

  await convertPostScriptViaFilePicker(page, withTextPsPath);
  await expect(page.getByTestId("drop-card")).toBeHidden();
  await expect(page.getByTestId("history-item")).toHaveCount(2);
  await expectSelectedFileInHistory(page, path.basename(withTextPsPath));
});

test("delivers clicks and wheel input over the PDF to the frame instead of the page", async ({
  page,
}) => {
  await convertPostScriptViaFilePicker(page, minimalPsPath);
  const pdfFrame = page.getByTestId("pdf-frame");
  await startRecordingParentInput(page);

  const center = await centerOf(pdfFrame);
  await page.mouse.click(center.x, center.y);
  await page.mouse.wheel(0, 200);
  // Absence of events cannot be polled for; wait for rendering frames so queued input is dispatched.
  await settleFrames(page);

  expect(await readRecordedParentInput(page)).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-testid")))
    .toBe("pdf-frame");
});

const siteOrigin = e2ePreviewPorts.siteOrigin;
const expectedAlternateLinks = [
  { hreflang: "ja", href: `${siteOrigin}/` },
  { hreflang: "en", href: `${siteOrigin}/en/` },
  { hreflang: "x-default", href: `${siteOrigin}/en/` },
] as const;

async function readAlternateLinks(page: Page) {
  return page.evaluate(() =>
    Array.from(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).map((link) => ({
      hreflang: link.getAttribute("hreflang"),
      href: link.getAttribute("href"),
    })),
  );
}

test("declares the Japanese page language, heading and hreflang alternates on /", async ({
  page,
}) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PostScript ビューア");
  expect(await readAlternateLinks(page)).toEqual(expectedAlternateLinks);
});

test.describe("English page at /en/", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/");
  });

  test("declares the English page language, heading and hreflang alternates", async ({ page }) => {
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("PostScript Viewer");
    expect(await readAlternateLinks(page)).toEqual(expectedAlternateLinks);
  });

  test("displays a PDF blob when a .ps file is selected", async ({ page }) => {
    await convertPostScriptViaFilePicker(page, minimalPsPath);
  });
});

test("navigates to /en/ from the English link in the footer of /", async ({ page }) => {
  await page.getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PostScript Viewer");
});

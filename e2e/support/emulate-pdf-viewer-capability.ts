import type { Page } from "@playwright/test";

async function emulatePdfViewerEnabled(page: Page, enabled: boolean): Promise<void> {
  await page.addInitScript((value) => {
    Object.defineProperty(navigator, "pdfViewerEnabled", {
      get: () => value,
      configurable: true,
    });
  }, enabled);
}

export async function emulateBuiltInPdfViewer(page: Page): Promise<void> {
  await emulatePdfViewerEnabled(page, true);
}

export async function emulateNoBuiltInPdfViewer(page: Page): Promise<void> {
  await emulatePdfViewerEnabled(page, false);
}

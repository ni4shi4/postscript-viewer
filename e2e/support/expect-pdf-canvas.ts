import { expect, type Page } from "@playwright/test";

export async function expectPdfCanvasShowsRenderedPdf(page: Page): Promise<void> {
  const pdfCanvasContainer = page.getByTestId("pdf-canvas-container");
  await expect(pdfCanvasContainer).toBeVisible();

  const canvas = pdfCanvasContainer.locator("canvas").first();
  await expect(canvas).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const renderedCanvas = document.querySelector(
          '[data-testid="pdf-canvas-container"] canvas',
        );
        if (!(renderedCanvas instanceof HTMLCanvasElement)) {
          return false;
        }
        return renderedCanvas.width > 0 && renderedCanvas.height > 0;
      }),
    )
    .toBe(true);

  const pdfFrame = page.getByTestId("pdf-frame");
  await expect(pdfFrame).toBeHidden();
}

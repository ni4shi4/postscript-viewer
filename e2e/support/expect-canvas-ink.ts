import { expect, type Page } from "@playwright/test";

const DARK_PIXEL_CHANNEL_MAX = 200;
const DEFAULT_MIN_INK_PIXELS = 100;

type ExpectPdfCanvasInkOptions = {
  minInkPixels?: number;
};

export async function expectPdfCanvasHasSignificantInk(
  page: Page,
  options?: ExpectPdfCanvasInkOptions,
): Promise<void> {
  const minInkPixels = options?.minInkPixels ?? DEFAULT_MIN_INK_PIXELS;

  const pdfCanvasContainer = page.getByTestId("pdf-canvas-container");
  await expect(pdfCanvasContainer).toBeVisible();

  const canvas = pdfCanvasContainer.locator("canvas").first();
  await expect(canvas).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(
        ({ channelMax }) => {
          const renderedCanvas = document.querySelector(
            '[data-testid="pdf-canvas-container"] canvas',
          );
          if (!(renderedCanvas instanceof HTMLCanvasElement)) {
            return 0;
          }
          if (renderedCanvas.width === 0 || renderedCanvas.height === 0) {
            return 0;
          }
          const context = renderedCanvas.getContext("2d");
          if (context === null) {
            return 0;
          }
          const { data } = context.getImageData(0, 0, renderedCanvas.width, renderedCanvas.height);
          let inkPixels = 0;
          for (let i = 0; i < data.length; i += 4) {
            const red = data[i];
            const green = data[i + 1];
            const blue = data[i + 2];
            const alpha = data[i + 3];
            if (alpha > 0 && red <= channelMax && green <= channelMax && blue <= channelMax) {
              inkPixels += 1;
            }
          }
          return inkPixels;
        },
        { channelMax: DARK_PIXEL_CHANNEL_MAX },
      ),
    )
    .toBeGreaterThan(minInkPixels);
}

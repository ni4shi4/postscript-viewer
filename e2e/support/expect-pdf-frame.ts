import { expect, type Page } from "@playwright/test";

const PDF_MAGIC = "%PDF-";

export async function expectPdfFrameShowsBlobSrc(page: Page): Promise<string> {
  const pdfFrame = page.getByTestId("pdf-frame");
  await expect(pdfFrame).toBeVisible();

  const src = await pdfFrame.getAttribute("src");
  expect(src).not.toBeNull();
  expect(src).toMatch(/^blob:/);
  return src as string;
}

export async function expectPdfFrameShowsBlobPdf(page: Page): Promise<void> {
  const src = await expectPdfFrameShowsBlobSrc(page);

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

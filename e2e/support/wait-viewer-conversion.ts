import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import { expectPdfCanvasShowsRenderedPdf } from "./expect-pdf-canvas";
import { expectPdfFrameShowsBlobPdf } from "./expect-pdf-frame";

export type PostScriptFilePickerInput =
  | string
  | ReadonlyArray<string>
  | {
      name: string;
      mimeType: string;
      buffer: Buffer;
    }
  | ReadonlyArray<{
      name: string;
      mimeType: string;
      buffer: Buffer;
    }>;

export function expectedFileNameFromPickerInput(files: PostScriptFilePickerInput): string {
  if (typeof files === "string") {
    return path.basename(files);
  }
  const first = Array.isArray(files) ? files[0] : files;
  if (first === undefined) {
    throw new Error("file picker input is empty");
  }
  if (typeof first === "string") {
    return path.basename(first);
  }
  return first.name;
}

export async function expectViewerFileName(page: Page, fileName: string): Promise<void> {
  const fileNameDisplay = page.getByTestId("viewer-file-name");
  await expect(fileNameDisplay).toBeVisible();
  await expect(fileNameDisplay).toHaveText(fileName);
}

async function submitPostScriptFilePicker(
  page: Page,
  files: PostScriptFilePickerInput,
): Promise<void> {
  await page.getByTestId("file-input").setInputFiles(files);
}

export async function convertPostScriptViaFilePicker(
  page: Page,
  files: PostScriptFilePickerInput,
): Promise<void> {
  await submitPostScriptFilePicker(page, files);
  await expectViewerFileName(page, expectedFileNameFromPickerInput(files));
  await expectPdfFrameShowsBlobPdf(page);
}

export async function convertPostScriptViaFilePickerOnCanvas(
  page: Page,
  files: PostScriptFilePickerInput,
): Promise<void> {
  await submitPostScriptFilePicker(page, files);
  await expectViewerFileName(page, expectedFileNameFromPickerInput(files));
  await expectPdfCanvasShowsRenderedPdf(page);
}

export async function activateHistoryEntryAndExpectPdfFrame(
  page: Page,
  selectButton: Locator,
  fileName: string,
): Promise<void> {
  await selectButton.click();
  await expectViewerFileName(page, fileName);
  await expectPdfFrameShowsBlobPdf(page);
}

export async function activateHistoryEntryAndExpectCanvas(
  page: Page,
  selectButton: Locator,
  fileName: string,
): Promise<void> {
  await selectButton.click();
  await expectViewerFileName(page, fileName);
  await expectPdfCanvasShowsRenderedPdf(page);
}

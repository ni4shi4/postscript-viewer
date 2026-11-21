import type { PdfViewer } from "../ports/pdf-viewer";

export type FakePdfViewer = PdfViewer & {
  getDisplayedPdf(): Uint8Array | undefined;
};

export function createFakePdfViewer(): FakePdfViewer {
  let displayed: Uint8Array | undefined;

  return {
    show(pdf) {
      displayed = pdf;
    },
    clear() {
      displayed = undefined;
    },
    getDisplayedPdf() {
      return displayed;
    },
  };
}

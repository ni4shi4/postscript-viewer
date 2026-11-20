export type PdfViewer = {
  show(pdf: Uint8Array): void;
  clear(): void;
};

export type Locale = "ja" | "en";

export type Messages = {
  intlLocale: string;
  formatSeconds: (seconds: number) => string;

  appTitle: string;
  appDescription: string;

  convertingStatus: string;
  notGzipError: string;
  conversionTimeout: (limit: string) => string;
  inputTooLarge: (limit: string) => string;
  decompressedTooLarge: (limit: string) => string;
  conversionFailed: (detail: string) => string;

  limitsNoticeLabel: string;
  limitLabelInputSize: string;
  limitLabelDecompressedSize: string;
  limitLabelConversionTime: string;

  privacyNotice: string;
  trustNotice: string;

  pdfFrameTitle: string;
  dropOverlayLabel: string;
  dropCardHeading: string;
  dropCardFormats: string;
  dropCardOr: string;
  pickFileButton: string;
  fileInputLabel: string;

  historyButton: string;
  convertButton: string;
  historyHeading: string;
  historyOpenLabel: string;
  historyCloseLabel: string;
  convertAnotherRail: string;
  convertAnotherFile: string;
  clearHistory: string;
  closeLabel: string;
  removeFromHistory: (fileName: string) => string;

  downloadButton: string;
  downloadPdfLabel: (fileName: string) => string;

  sourceCodeLink: string;
  alternateLanguage: { label: string; href: string; lang: Locale };
};

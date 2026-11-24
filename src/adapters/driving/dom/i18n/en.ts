import type { Messages } from "./messages";

export const en = {
  intlLocale: "en-US",
  formatSeconds: (seconds) => `${seconds} s`,

  appTitle: "PostScript Viewer",
  appDescription: "Convert PostScript files to PDF and view them in your browser",

  convertingStatus: "Converting PostScript to PDF…",
  notGzipError: "Not in gzip format. For .gz files, choose a gzip-compressed PostScript file",
  conversionTimeout: (limit) => `Conversion exceeded the time limit (${limit})`,
  inputTooLarge: (limit) => `File size exceeds the limit (${limit})`,
  decompressedTooLarge: (limit) => `Decompressed size exceeds the limit (${limit})`,
  conversionFailed: (detail) => `Could not convert PostScript to PDF (${detail})`,

  limitsNoticeLabel: "Accepted limits",
  limitLabelInputSize: "File size",
  limitLabelDecompressedSize: "Decompressed size",
  limitLabelConversionTime: "Conversion time limit",

  privacyNotice: "Files are processed on your device and never sent to a server",
  trustNotice: "Only open PostScript files you trust",

  pdfFrameTitle: "Converted PDF",
  dropOverlayLabel: "Drop here to convert",
  dropCardHeading: "Drop a PostScript file here",
  dropCardFormats: "Supports .ps and .ps.gz",
  dropCardOr: "or",
  pickFileButton: "Choose file",
  fileInputLabel: "Choose a PostScript file",

  historyButton: "History",
  convertButton: "Convert",
  historyHeading: "Conversion history",
  historyOpenLabel: "Open history",
  historyCloseLabel: "Close history",
  convertAnotherRail: "Convert",
  convertAnotherFile: "Convert another file",
  clearHistory: "Clear all",
  closeLabel: "Close",
  removeFromHistory: (fileName) => `Remove ${fileName} from history`,

  downloadButton: "Download",
  downloadPdfLabel: (fileName) => `Download ${fileName}`,

  sourceCodeLink: "Source code",
  alternateLanguage: { label: "日本語", href: "/", lang: "ja" },
} satisfies Messages;

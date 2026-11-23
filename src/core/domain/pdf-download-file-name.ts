import { isGzipFileName } from "./decompress";

export const CONVERTED_PDF_DOWNLOAD_FILE_NAME = "converted.pdf";

const POSTSCRIPT_SUFFIX = ".ps";
const GZIP_SUFFIX_LENGTH = ".gz".length;
const POSTSCRIPT_SUFFIX_LENGTH = POSTSCRIPT_SUFFIX.length;

function endsWithPostScriptSuffix(fileName: string): boolean {
  return (
    fileName.length >= POSTSCRIPT_SUFFIX_LENGTH &&
    fileName.slice(-POSTSCRIPT_SUFFIX_LENGTH).toLowerCase() === POSTSCRIPT_SUFFIX
  );
}

function stripGzipSuffixOnce(fileName: string): string {
  if (!isGzipFileName(fileName)) {
    return fileName;
  }
  return fileName.slice(0, -GZIP_SUFFIX_LENGTH);
}

function stripPostScriptSuffixOnce(fileName: string): string {
  if (!endsWithPostScriptSuffix(fileName)) {
    return fileName;
  }
  return fileName.slice(0, -POSTSCRIPT_SUFFIX_LENGTH);
}

export function pdfDownloadFileName(postScriptFileName: string): string {
  const stem = stripPostScriptSuffixOnce(stripGzipSuffixOnce(postScriptFileName));
  if (stem.length === 0) {
    return CONVERTED_PDF_DOWNLOAD_FILE_NAME;
  }
  return `${stem}.pdf`;
}

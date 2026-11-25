import { describe, expect, it } from "vitest";

import { CONVERTED_PDF_DOWNLOAD_FILE_NAME, pdfDownloadFileName } from "./pdf-download-file-name";

describe("pdfDownloadFileName", () => {
  it.each([
    { input: "sample.ps", expected: "sample.pdf" },
    { input: "sample.ps.gz", expected: "sample.pdf" },
    { input: "sample.PS.GZ", expected: "sample.pdf" },
    { input: "sample.gz", expected: "sample.pdf" },
    { input: "sample", expected: "sample.pdf" },
    { input: "sample.gz.ps", expected: "sample.gz.pdf" },
  ])("maps $input to $expected", ({ input, expected }) => {
    expect(pdfDownloadFileName(input)).toBe(expected);
  });

  it.each([".ps", ".gz", ".ps.gz"])("uses fallback for empty stem (%s)", (input) => {
    expect(pdfDownloadFileName(input)).toBe(CONVERTED_PDF_DOWNLOAD_FILE_NAME);
  });
});

import { describe, expect, it } from "vitest";

import { convertPostScriptToPdfWithModule } from "./convert-postscript-to-pdf";
import { createFakeGhostscriptModule } from "./fake-ghostscript-module";

const POSTSCRIPT = new TextEncoder().encode("%!PS-Adobe-3.0\n");
const VALID_PDF = new TextEncoder().encode("%PDF-1.4\n");
const NOT_PDF = new TextEncoder().encode("not a pdf");

describe("convertPostScriptToPdfWithModule", () => {
  it("returns PDF bytes when Ghostscript exits successfully", () => {
    const { module, listVirtualFilePaths } = createFakeGhostscriptModule({
      kind: "success",
      pdfBytes: VALID_PDF,
    });

    const pdf = convertPostScriptToPdfWithModule(module, POSTSCRIPT);

    expect(pdf).toEqual(VALID_PDF);
    expect(listVirtualFilePaths()).toEqual([]);
  });

  it("throws when Ghostscript exits with a non-zero code", () => {
    const { module, listVirtualFilePaths } = createFakeGhostscriptModule({
      kind: "non-zero-exit",
      exitCode: 1,
    });

    expect(() => convertPostScriptToPdfWithModule(module, POSTSCRIPT)).toThrow(
      /Ghostscript exited with status/,
    );
    expect(listVirtualFilePaths()).toEqual([]);
  });

  it("throws when output does not start with the PDF magic", () => {
    const { module, listVirtualFilePaths } = createFakeGhostscriptModule({
      kind: "invalid-pdf-output",
      outputBytes: NOT_PDF,
    });

    expect(() => convertPostScriptToPdfWithModule(module, POSTSCRIPT)).toThrow(
      /Ghostscript output is not a PDF/,
    );
    expect(listVirtualFilePaths()).toEqual([]);
  });
});

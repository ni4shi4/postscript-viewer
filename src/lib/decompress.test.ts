import { gzip } from "pako";
import { describe, expect, it } from "vitest";

import { decompressGzip, isGzipFileName } from "./decompress";

const POSTSCRIPT_HEADER = "%!PS-Adobe-3.0\n";
const NOT_GZIP_MESSAGE = "File is not in gzip format";

describe("isGzipFileName", () => {
  it("detects .gz suffix case-insensitively", () => {
    expect(isGzipFileName("document.ps.gz")).toBe(true);
    expect(isGzipFileName("document.ps.GZ")).toBe(true);
    expect(isGzipFileName("document.ps")).toBe(false);
    expect(isGzipFileName("document.gz.ps")).toBe(false);
  });
});

describe("decompressGzip", () => {
  it("round-trips gzip-compressed bytes", () => {
    const raw = new TextEncoder().encode(POSTSCRIPT_HEADER);
    const compressed = gzip(raw);
    const decompressed = decompressGzip(compressed);
    expect(decompressed).toEqual(raw);
  });

  it("rejects PostScript bytes without gzip magic", () => {
    const postscript = new TextEncoder().encode(POSTSCRIPT_HEADER);
    expect(() => decompressGzip(postscript)).toThrow(NOT_GZIP_MESSAGE);
  });

  it("rejects empty input", () => {
    expect(() => decompressGzip(new Uint8Array(0))).toThrow(NOT_GZIP_MESSAGE);
  });

  it("rejects single-byte input", () => {
    expect(() => decompressGzip(new Uint8Array([0x1f]))).toThrow(NOT_GZIP_MESSAGE);
  });

  it("does not mask pako errors when gzip magic is present", () => {
    const corruptGzip = new Uint8Array([0x1f, 0x8b, 0x00, 0x00]);
    expect(() => decompressGzip(corruptGzip)).toThrow();
    try {
      decompressGzip(corruptGzip);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toBe(NOT_GZIP_MESSAGE);
    }
  });
});

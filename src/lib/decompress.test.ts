import { gzip } from "pako";
import { describe, expect, it } from "vitest";

import { decompressGzip, isGzipFileName } from "./decompress";

const POSTSCRIPT_HEADER = "%!PS-Adobe-3.0\n";

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
});

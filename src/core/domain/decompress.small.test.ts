import { gzip } from "pako";
import { describe, expect, it } from "vitest";

import { NotGzipError, decompressGzip, isGzipFileName } from "./decompress";
import { MAX_DECOMPRESSED_POSTSCRIPT_BYTES, TooLargeError } from "./limits";

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

  it("rejects PostScript bytes without gzip magic", () => {
    const postscript = new TextEncoder().encode(POSTSCRIPT_HEADER);
    expect(() => decompressGzip(postscript)).toThrow(NotGzipError);
  });

  it.each([
    { label: "empty input", data: new Uint8Array(0) },
    { label: "single-byte input", data: new Uint8Array([0x1f]) },
  ])("rejects $label", ({ data }) => {
    expect(() => decompressGzip(data)).toThrow(NotGzipError);
  });

  it("does not mask pako errors when gzip magic is present", () => {
    const corruptGzip = new Uint8Array([0x1f, 0x8b, 0x00, 0x00]);
    const act = () => decompressGzip(corruptGzip);
    expect(act).toThrow(Error);
    expect(act).not.toThrow(NotGzipError);
  });

  it("rejects gzip output that exceeds the decompressed byte limit", () => {
    const expanded = new Uint8Array(MAX_DECOMPRESSED_POSTSCRIPT_BYTES + 1);
    const compressed = gzip(expanded);
    expect(() => decompressGzip(compressed)).toThrow(TooLargeError);
  });
});

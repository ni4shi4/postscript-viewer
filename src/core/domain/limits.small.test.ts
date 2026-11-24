import { describe, expect, it } from "vitest";

import {
  MAX_DECOMPRESSED_POSTSCRIPT_BYTES,
  MAX_POSTSCRIPT_INPUT_BYTES,
  TooLargeError,
  assertWithinByteLimit,
  formattedByteLimit,
  conversionTimeLimitInSeconds,
} from "./limits";

describe("assertWithinByteLimit", () => {
  it.each([
    { limit: "input" as const, max: MAX_POSTSCRIPT_INPUT_BYTES },
    { limit: "decompressed" as const, max: MAX_DECOMPRESSED_POSTSCRIPT_BYTES },
  ])("accepts $limit data at the limit", ({ limit, max }) => {
    expect(() => assertWithinByteLimit(max, limit)).not.toThrow();
  });

  it.each([
    { limit: "input" as const, max: MAX_POSTSCRIPT_INPUT_BYTES },
    { limit: "decompressed" as const, max: MAX_DECOMPRESSED_POSTSCRIPT_BYTES },
  ])("rejects $limit data above the limit", ({ limit, max }) => {
    expect(() => assertWithinByteLimit(max + 1, limit)).toThrow(TooLargeError);
  });
});

describe("formattedByteLimit", () => {
  it("reflects configured MiB limits", () => {
    expect(formattedByteLimit("input")).toBe("32 MiB");
    expect(formattedByteLimit("decompressed")).toBe("32 MiB");
  });
});

describe("conversionTimeLimitInSeconds", () => {
  it("reflects the configured conversion duration", () => {
    expect(conversionTimeLimitInSeconds()).toBe(60);
  });
});

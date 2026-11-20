import { describe, expect, it } from "vitest";

import type {
  ConvertFailureMessage,
  ConvertRequestMessage,
  ConvertSuccessMessage,
} from "./messages";
import {
  isConvertFailureMessage,
  isConvertRequestMessage,
  isConvertSuccessMessage,
  isWorkerToMainMessage,
} from "./messages";

describe("isConvertRequestMessage", () => {
  it("accepts a valid convert request", () => {
    const message: ConvertRequestMessage = {
      type: "convert",
      id: "req-1",
      postScript: new Uint8Array([1, 2, 3]),
      fileName: "sample.ps",
    };
    expect(isConvertRequestMessage(message)).toBe(true);
  });

  it("rejects invalid shapes", () => {
    expect(isConvertRequestMessage(null)).toBe(false);
    expect(isConvertRequestMessage({ type: "success", id: "x", pdf: new Uint8Array() })).toBe(
      false,
    );
    expect(
      isConvertRequestMessage({
        type: "convert",
        id: 1,
        postScript: new Uint8Array(),
        fileName: "a.ps",
      }),
    ).toBe(false);
  });
});

describe("isConvertSuccessMessage", () => {
  it("accepts a valid success message", () => {
    const message: ConvertSuccessMessage = {
      type: "success",
      id: "req-1",
      pdf: new Uint8Array([37, 80, 68, 70]),
    };
    expect(isConvertSuccessMessage(message)).toBe(true);
  });

  it("rejects other message types", () => {
    expect(isConvertSuccessMessage({ type: "failure", id: "x", error: "err" })).toBe(false);
  });
});

describe("isConvertFailureMessage", () => {
  it("accepts a valid failure message", () => {
    const message: ConvertFailureMessage = {
      type: "failure",
      id: "req-1",
      error: "Ghostscript failed",
    };
    expect(isConvertFailureMessage(message)).toBe(true);
  });

  it("rejects invalid error fields", () => {
    expect(isConvertFailureMessage({ type: "failure", id: "x", error: 404 })).toBe(false);
  });
});

describe("isWorkerToMainMessage", () => {
  it("accepts success and failure", () => {
    const success: ConvertSuccessMessage = {
      type: "success",
      id: "id",
      pdf: new Uint8Array(),
    };
    const failure: ConvertFailureMessage = {
      type: "failure",
      id: "id",
      error: "boom",
    };
    expect(isWorkerToMainMessage(success)).toBe(true);
    expect(isWorkerToMainMessage(failure)).toBe(true);
    expect(isWorkerToMainMessage({ type: "convert", id: "id" })).toBe(false);
  });
});

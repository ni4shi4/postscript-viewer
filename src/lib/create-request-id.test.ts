import { afterEach, describe, expect, it, vi } from "vitest";

import { createRequestId } from "./create-request-id";

const CONSECUTIVE_CALL_COUNT = 100;
const SAMPLE_COUNT = 32;

describe("createRequestId", { concurrent: false }, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns unique ids on consecutive calls when randomUUID is unavailable", () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", {
      getRandomValues,
      randomUUID: undefined,
    });

    const ids = new Set<string>();
    for (let i = 0; i < CONSECUTIVE_CALL_COUNT; i += 1) {
      const id = createRequestId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });

  it("returns unique ids when randomUUID is available", () => {
    const ids = new Set<string>();
    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      const id = createRequestId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });
});

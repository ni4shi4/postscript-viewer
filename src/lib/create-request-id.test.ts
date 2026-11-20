import { describe, expect, it } from "vitest";

import { createRequestId } from "./create-request-id";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SAMPLE_COUNT = 32;

describe("createRequestId", () => {
  it("returns lowercase UUID v4 strings with RFC 4122 variant", () => {
    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      const id = createRequestId();
      expect(id).toMatch(UUID_V4_PATTERN);
    }
  });
});

import { describe, expect, it } from "vitest";

import { SOURCE_REPOSITORY_URL, sourceRepositoryUrl } from "./source-repository-url";

const VALID_SHA = "a".repeat(40);

describe("sourceRepositoryUrl", () => {
  it("returns the default repository URL when commit SHA is omitted", () => {
    expect(sourceRepositoryUrl()).toBe(SOURCE_REPOSITORY_URL);
    expect(sourceRepositoryUrl(undefined)).toBe(SOURCE_REPOSITORY_URL);
  });

  it("appends the commit SHA to the tree URL when valid", () => {
    expect(sourceRepositoryUrl(VALID_SHA)).toBe(`${SOURCE_REPOSITORY_URL}/tree/${VALID_SHA}`);
  });

  it.each(["", "abc", "g".repeat(40), "A".repeat(40), `${VALID_SHA}extra`])(
    "falls back to the default URL for invalid SHA %j",
    (sha) => {
      expect(sourceRepositoryUrl(sha)).toBe(SOURCE_REPOSITORY_URL);
    },
  );
});

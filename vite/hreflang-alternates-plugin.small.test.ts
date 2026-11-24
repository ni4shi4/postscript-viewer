import { describe, expect, it } from "vitest";

import { createHreflangAlternateTags, normalizeSiteOrigin } from "./hreflang-alternates-plugin.js";

const origin = "https://example.com";

describe("createHreflangAlternateTags", () => {
  it("returns the ja, en and x-default alternate links for the origin", () => {
    expect(createHreflangAlternateTags(origin).map((tag) => tag.attrs)).toEqual([
      { rel: "alternate", hreflang: "ja", href: `${origin}/` },
      { rel: "alternate", hreflang: "en", href: `${origin}/en/` },
      { rel: "alternate", hreflang: "x-default", href: `${origin}/en/` },
    ]);
  });

  it("ignores a trailing slash on the origin", () => {
    expect(createHreflangAlternateTags(`${origin}/`)).toEqual(createHreflangAlternateTags(origin));
  });

  it.each([undefined, "", "   "])("returns no links when the origin is %j", (value) => {
    expect(createHreflangAlternateTags(value)).toEqual([]);
  });

  it.each([
    "https://example.com/path",
    "https://example.com/?q=1",
    "https://example.com/#hash",
    "ftp://example.com",
    "example.com",
    "not a url",
  ])("rejects %j", (value) => {
    expect(() => createHreflangAlternateTags(value)).toThrow(/SITE_ORIGIN/);
  });
});

describe("normalizeSiteOrigin", () => {
  it("keeps an explicit port", () => {
    expect(normalizeSiteOrigin("http://localhost:8080/")).toBe("http://localhost:8080");
  });
});

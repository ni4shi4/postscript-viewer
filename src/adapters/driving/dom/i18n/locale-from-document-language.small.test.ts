import { describe, expect, it } from "vitest";

import { localeFromDocumentLanguage } from "./locale-from-document-language";

describe("localeFromDocumentLanguage", () => {
  it.each(["en", "en-US", "EN", " en-GB "])("treats %j as English", (lang) => {
    expect(localeFromDocumentLanguage(lang)).toBe("en");
  });

  it.each(["ja", "ja-JP", "", "fr", "english"])("treats %j as Japanese", (lang) => {
    expect(localeFromDocumentLanguage(lang)).toBe("ja");
  });
});

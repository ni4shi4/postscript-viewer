import type { Locale } from "./messages";

export function localeFromDocumentLanguage(lang: string): Locale {
  const primary = lang.trim().toLowerCase().split("-")[0];
  return primary === "en" ? "en" : "ja";
}

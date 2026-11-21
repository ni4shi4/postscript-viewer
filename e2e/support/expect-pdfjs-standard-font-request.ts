import { expect, type Page } from "@playwright/test";

function isSameOriginStandardFontUrl(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === origin && parsed.pathname.includes("standard_fonts");
  } catch {
    return false;
  }
}

export type PdfJsStandardFontDataWatch = {
  expectFetched: () => Promise<void>;
};

export function beginWatchingPdfJsStandardFontData(page: Page): PdfJsStandardFontDataWatch {
  const origin = new URL(page.url()).origin;
  const matchesStandardFontData = (url: string): boolean =>
    isSameOriginStandardFontUrl(url, origin);

  const requestPromise = page.waitForRequest((request) => matchesStandardFontData(request.url()));
  const responsePromise = page.waitForResponse((response) =>
    matchesStandardFontData(response.url()),
  );

  return {
    async expectFetched() {
      await requestPromise;
      const response = await responsePromise;
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);
    },
  };
}

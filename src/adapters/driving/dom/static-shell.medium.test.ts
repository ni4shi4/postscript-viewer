// @vitest-environment jsdom

import { h, render } from "preact";
import { act } from "preact/test-utils";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

import { messagesFor, MessagesContext } from "./i18n/messages-context";
import type { Locale } from "./i18n/messages";
import { App } from "./static-shell";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function mountApp(locale: Locale = "ja"): void {
  document.body.replaceChildren();
  const mount = document.createElement("div");
  mount.id = "mount-app";
  document.body.append(mount);
  act(() => {
    render(h(MessagesContext.Provider, { value: messagesFor(locale) }, h(App, null)), mount);
  });
}

describe("static shell toolbar layout", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("links the file input to limit and notice descriptions by id", () => {
    mountApp();

    const fileInput = document.querySelector<HTMLInputElement>('[data-testid="file-input"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput?.getAttribute("aria-describedby")).toBe(
      "file-limits-notice privacy-notice trust-notice",
    );

    for (const id of ["file-limits-notice", "privacy-notice", "trust-notice"] as const) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("shows the PS icon in the header as a decorative image of /favicon.svg", () => {
    mountApp();

    const mark = document.querySelector<HTMLImageElement>('[data-testid="app-mark"]');
    expect(mark).not.toBeNull();
    expect(mark!.tagName).toBe("IMG");
    expect(mark!.getAttribute("src")).toBe("/favicon.svg");
    expect(mark!.getAttribute("alt")).toBe("");
    expect(document.querySelector("header.toolbar")!.contains(mark)).toBe(true);
  });

  it("shows the header on one row with the title as the only h1 and no steps list", () => {
    mountApp();

    const header = document.querySelector("header.toolbar");
    expect(header).not.toBeNull();
    expect(header!.querySelector("h1")?.textContent).toBe("PostScript ビューア");
    expect(header!.textContent).toContain(
      "PostScript ファイルをブラウザ内で PDF に変換して表示します",
    );
    expect(header!.querySelector("ol")).toBeNull();
    expect(header!.querySelector("button, input, label")).toBeNull();
    expect(document.body.textContent).not.toContain("使い方");
  });

  it("shows the drop card with picker, limits and notices when no document is selected", () => {
    mountApp();

    const card = document.querySelector<HTMLElement>('[data-testid="drop-card"]');
    expect(card).not.toBeNull();
    expect(card!.hidden).toBe(false);
    expect(card!.textContent).toContain("PostScript ファイルをここにドロップ");
    expect(card!.textContent).toContain(".ps / .ps.gz に対応しています");

    const fileInput = document.querySelector<HTMLInputElement>('[data-testid="file-input"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput!.accept).toBe(".ps,.gz");
    // カードが隠れても動くよう、input はカードの外に常に存在する。
    expect(card!.contains(fileInput)).toBe(false);
    const pickButton = Array.from(card!.querySelectorAll("button")).find(
      (button) => button.textContent === "ファイルを選択",
    );
    expect(pickButton).toBeDefined();
    let clicked = 0;
    fileInput!.addEventListener("click", () => {
      clicked += 1;
    });
    pickButton!.click();
    expect(clicked).toBe(1);

    for (const id of ["file-limits-notice", "privacy-notice", "trust-notice"] as const) {
      expect(card!.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(document.querySelector('[data-testid="file-picker-placeholder"]')).toBeNull();
  });

  it("keeps the PDF frame and canvas container outside the drop card", () => {
    mountApp();

    const card = document.querySelector('[data-testid="drop-card"]');
    for (const testId of ["pdf-frame", "pdf-canvas-container"] as const) {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      expect(element).not.toBeNull();
      expect(card!.contains(element)).toBe(false);
    }
  });
});

describe("static shell localization", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("shows English UI texts when the locale is en", () => {
    mountApp("en");

    expect(document.querySelector("h1")?.textContent).toBe("PostScript Viewer");
    const card = document.querySelector<HTMLElement>('[data-testid="drop-card"]')!;
    expect(card.textContent).toContain("Drop a PostScript file here");
    expect(
      Array.from(card.querySelectorAll("button")).some(
        (button) => button.textContent === "Choose file",
      ),
    ).toBe(true);

    const limits = document.querySelector<HTMLElement>('[data-testid="file-limits-notice"]')!;
    expect(limits.textContent).toContain("File size");
    expect(limits.textContent).toContain("Decompressed size");
    expect(limits.textContent).toContain("Conversion time limit");
    expect(document.body.textContent).not.toContain("ファイルを選択");
  });

  it.each([
    { locale: "ja", linkName: "English", href: "/en/", hrefLang: "en" },
    { locale: "en", linkName: "日本語", href: "/", hrefLang: "ja" },
  ] as const)(
    "links the footer to the other language when the locale is $locale",
    ({ locale, linkName, href, hrefLang }) => {
      mountApp(locale);

      const link = Array.from(document.querySelectorAll("a")).find(
        (anchor) => anchor.textContent === linkName,
      );
      expect(link).toBeDefined();
      expect(link!.getAttribute("href")).toBe(href);
      expect(link!.getAttribute("hreflang")).toBe(hrefLang);
    },
  );
});

describe("index.html favicon", () => {
  it("links /favicon.svg as an SVG icon in the document head", () => {
    const html = readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
    const doc = new DOMParser().parseFromString(html, "text/html");

    const icon = doc.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("href")).toBe("/favicon.svg");
    expect(icon!.getAttribute("type")).toBe("image/svg+xml");
  });
});

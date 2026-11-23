// @vitest-environment jsdom

import { h, render } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "./static-shell";

function mountApp(): void {
  document.body.replaceChildren();
  const mount = document.createElement("div");
  mount.id = "mount-app";
  document.body.append(mount);
  act(() => {
    render(h(App, null), mount);
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

    const fileInput = card!.querySelector<HTMLInputElement>('[data-testid="file-input"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput!.accept).toBe(".ps,.gz");
    expect(fileInput!.closest("label")?.textContent).toContain("ファイルを選択");

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

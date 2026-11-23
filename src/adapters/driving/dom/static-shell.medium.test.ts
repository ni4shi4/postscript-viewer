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

function nextElementSiblingSkippingText(element: Element): Element | null {
  let next: ChildNode | null = element.nextSibling;
  while (next !== null) {
    if (next instanceof Element) {
      return next;
    }
    next = next.nextSibling;
  }
  return null;
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

  it("places the file name on the same row as the file input", () => {
    mountApp();

    const fileInput = document.querySelector<HTMLInputElement>('[data-testid="file-input"]');
    const fileName = document.querySelector('[data-testid="viewer-file-name"]');
    const status = document.querySelector('[data-testid="viewer-status"]');
    const placeholder = document.querySelector('[data-testid="file-picker-placeholder"]');
    expect(fileInput).not.toBeNull();
    expect(fileName).not.toBeNull();
    expect(status).not.toBeNull();
    expect(placeholder).not.toBeNull();

    const pickerRow = fileInput!.closest(".file-picker__row");
    expect(pickerRow).not.toBeNull();
    expect(fileName!.closest(".file-picker__row")).toBe(pickerRow);
    expect(pickerRow?.contains(fileInput!)).toBe(true);

    expect(status!.closest(".file-selection-meta")).not.toBeNull();
    expect(fileName!.closest(".file-selection-meta")).toBeNull();

    expect(fileInput!.classList.contains("file-picker__input")).toBe(true);
    expect(fileInput!.closest(".file-picker__button")).not.toBeNull();
    expect(placeholder!.hasAttribute("hidden")).toBe(false);
    expect(fileName!.hasAttribute("hidden")).toBe(true);

    const download = document.querySelector('[data-testid="download-pdf"]');
    expect(download).not.toBeNull();
    expect(download!.closest(".file-picker__row")).toBe(pickerRow);
    expect(download!.closest(".file-selection-meta")).toBeNull();
    expect(download!.closest(".toolbar-block--limits")).toBeNull();
    expect(download!.closest(".notice-box")).toBeNull();
    expect(download!.hasAttribute("hidden")).toBe(true);
    expect(nextElementSiblingSkippingText(fileName!)?.getAttribute("data-testid")).toBe(
      "download-pdf",
    );
  });

  it("groups privacy and trust notices without elements between them", () => {
    mountApp();

    const privacy = document.getElementById("privacy-notice");
    const trust = document.getElementById("trust-notice");
    expect(privacy).not.toBeNull();
    expect(trust).not.toBeNull();
    expect(privacy!.closest(".notice-box")).toBe(trust!.closest(".notice-box"));
    expect(nextElementSiblingSkippingText(privacy!)).toBe(trust);
  });

  it("keeps file limits outside the file picker label", () => {
    mountApp();

    const limits = document.getElementById("file-limits-notice");
    const filePicker = document.querySelector(".file-picker");
    expect(limits).not.toBeNull();
    expect(filePicker).not.toBeNull();
    expect(filePicker!.contains(limits)).toBe(false);
    expect(limits!.closest(".toolbar-block--limits")).not.toBeNull();
  });
});

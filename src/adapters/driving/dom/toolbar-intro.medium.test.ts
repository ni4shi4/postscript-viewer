// @vitest-environment jsdom

import { h, render } from "preact";
import { beforeEach, describe, expect, it } from "vitest";

import { ToolbarIntro } from "./static-shell";

describe("ToolbarIntro", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const mount = document.createElement("div");
    document.body.append(mount);
    render(h(ToolbarIntro, null), mount);
  });

  it("shows the favicon as the first element in the heading", () => {
    const h1 = document.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toContain("PostScript ビューア");

    const firstChild = h1?.firstElementChild;
    expect(firstChild?.tagName).toBe("IMG");

    const mark = document.querySelector<HTMLImageElement>('[data-testid="app-mark"]');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("src")).toBe("/favicon.svg");
    expect(mark?.getAttribute("alt")).toBe("");
  });
});

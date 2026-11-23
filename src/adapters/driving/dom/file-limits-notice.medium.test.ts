// @vitest-environment jsdom

import { h, render } from "preact";
import { beforeEach, describe, expect, it } from "vitest";

import { formattedByteLimit, formattedConversionTimeLimit } from "../../../core/domain/limits";
import { FileLimitsNotice } from "./file-limits-notice";

describe("FileLimitsNotice", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    const mount = document.createElement("div");
    document.body.append(mount);
    render(h(FileLimitsNotice, null), mount);
  });

  it("shows configured byte and conversion time limits as labeled items", () => {
    const notice = document.querySelector<HTMLElement>('[data-testid="file-limits-notice"]');
    expect(notice).not.toBeNull();
    expect(notice?.tagName).toBe("DL");

    const terms = notice?.querySelectorAll("dt");
    const definitions = notice?.querySelectorAll("dd");
    expect(terms?.length).toBe(3);
    expect(definitions?.length).toBe(3);

    expect(notice?.textContent).toContain("ファイルサイズ");
    expect(notice?.textContent).toContain(formattedByteLimit("input"));
    expect(notice?.textContent).toContain("展開後のサイズ");
    expect(notice?.textContent).toContain(formattedByteLimit("decompressed"));
    expect(notice?.textContent).toContain("変換の制限時間");
    expect(notice?.textContent).toContain(formattedConversionTimeLimit());
  });
});

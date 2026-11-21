// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it } from "vitest";

import { formattedByteLimit, formattedConversionTimeLimit } from "../../../core/domain/limits";
import { applyFileLimitsNotice } from "./file-limits-notice";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function loadIndexBody(): void {
  const indexHtml = readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(indexHtml);
  if (bodyMatch === null) {
    throw new Error("index.html body not found");
  }
  document.body.innerHTML = bodyMatch[1];
}

describe("applyFileLimitsNotice", () => {
  beforeEach(() => {
    loadIndexBody();
  });

  it("shows configured byte and conversion time limits", () => {
    applyFileLimitsNotice();

    const notice = document.querySelector<HTMLElement>('[data-testid="file-limits-notice"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain(formattedByteLimit("input"));
    expect(notice?.textContent).toContain(formattedByteLimit("decompressed"));
    expect(notice?.textContent).toContain(formattedConversionTimeLimit());
    expect(notice?.textContent).toContain("受け付ける上限");
  });
});

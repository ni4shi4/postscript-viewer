import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const INDEX_HTML_PATH = path.join(REPO_ROOT, "index.html");
const FAVICON_PATH = path.join(REPO_ROOT, "public", "favicon.svg");

const FAVICON_LINK_PATTERN =
  /<link\s+rel="icon"\s+href="\/favicon\.svg"\s+type="image\/svg\+xml"\s*\/?>/g;

describe("tab favicon", () => {
  it("links the SVG favicon once from index.html", () => {
    const html = readFileSync(INDEX_HTML_PATH, "utf8");
    const matches = [...html.matchAll(FAVICON_LINK_PATTERN)];
    expect(matches).toHaveLength(1);
  });

  it("ships an SVG favicon without script and with dark-mode colors", () => {
    const svg = readFileSync(FAVICON_PATH, "utf8");
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).not.toMatch(/<script/i);
    expect(svg).toMatch(/prefers-color-scheme:\s*dark/);
  });
});

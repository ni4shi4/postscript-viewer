import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const HEADERS_PATH = path.join(REPO_ROOT, "public", "_headers");

function parseHeadersBlocks(content: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  let currentPath: string | undefined;
  let currentHeaders = new Map<string, string>();

  const finishBlock = (): void => {
    if (currentPath === undefined) {
      return;
    }
    blocks.set(currentPath, currentHeaders);
  };

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    if (line.startsWith("  ") && currentPath !== undefined) {
      const colon = trimmed.indexOf(":");
      if (colon === -1) {
        throw new Error(`Invalid header line in _headers: ${trimmed}`);
      }
      const name = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      currentHeaders.set(name, value);
      continue;
    }

    finishBlock();
    currentPath = trimmed;
    currentHeaders = new Map();
  }

  finishBlock();
  return blocks;
}

function cspDirectiveSourceList(csp: string, directiveName: string): readonly string[] {
  const directives = csp
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  for (const directive of directives) {
    const tokens = directive.split(/\s+/);
    if (tokens[0] === directiveName) {
      return tokens.slice(1);
    }
  }
  return [];
}

function loadRootWildcardHeaders(): Map<string, string> {
  const content = readFileSync(HEADERS_PATH, "utf8");
  const blocks = parseHeadersBlocks(content);
  const headers = blocks.get("/*");
  if (headers === undefined) {
    throw new Error("Missing /* block in public/_headers");
  }
  return headers;
}

describe("public/_headers security policy for /*", () => {
  it("sets CSP, X-Content-Type-Options, and Referrer-Policy as required", () => {
    const headers = loadRootWildcardHeaders();

    const csp = headers.get("Content-Security-Policy");
    expect(csp).toBeDefined();

    const cspValue = csp!;
    expect(cspValue).toContain("object-src 'none'");
    expect(cspValue).toContain("base-uri 'self'");
    expect(cspValue).toContain("frame-ancestors 'self'");
    expect(cspValue).toContain("script-src 'self' 'wasm-unsafe-eval'");

    const scriptSrc = cspDirectiveSourceList(cspValue, "script-src");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");

    const allSourceTokens = cspValue
      .split(";")
      .flatMap((directive) => directive.trim().split(/\s+/).slice(1));
    expect(allSourceTokens).not.toContain("'unsafe-inline'");

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBeDefined();
  });
});

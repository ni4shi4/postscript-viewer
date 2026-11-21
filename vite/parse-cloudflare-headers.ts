/**
 * Parses header lines from a Cloudflare Pages-style `_headers` file.
 * Path patterns are ignored; indented `Name: value` lines are collected.
 */
export function parseCloudflareHeadersFile(content: string): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith("  ")) {
      continue;
    }

    const trimmed = line.trimEnd();
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (name.length > 0 && value.length > 0) {
      headers[name] = value;
    }
  }

  return headers;
}

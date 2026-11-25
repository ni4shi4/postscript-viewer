import type { HtmlTagDescriptor, Plugin } from "vite";

const LOCALE_ALTERNATES = [
  { hreflang: "ja", path: "/" },
  { hreflang: "en", path: "/en/" },
  { hreflang: "x-default", path: "/en/" },
] as const;

/**
 * Returns the origin without a trailing slash, or undefined when no origin is configured.
 * Throws when a value is given but is not a plain http(s) origin.
 */
export function normalizeSiteOrigin(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(withoutTrailingSlash);
  } catch {
    throw new Error(`SITE_ORIGIN must be an http(s) origin such as https://example.com: ${raw}`);
  }

  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  const isOriginOnly =
    url.pathname === "/" && url.search === "" && url.hash === "" && url.username === "";
  if (!isHttp || !isOriginOnly || url.origin !== withoutTrailingSlash.toLowerCase()) {
    throw new Error(`SITE_ORIGIN must be an http(s) origin without path, query or hash: ${raw}`);
  }

  return url.origin;
}

export function createHreflangAlternateTags(origin: string | undefined): HtmlTagDescriptor[] {
  const normalized = normalizeSiteOrigin(origin);
  if (normalized === undefined) {
    return [];
  }

  return LOCALE_ALTERNATES.map(({ hreflang, path }) => ({
    tag: "link",
    attrs: { rel: "alternate", hreflang, href: `${normalized}${path}` },
    injectTo: "head",
  }));
}

export function hreflangAlternatesPlugin(siteOrigin: string | undefined): Plugin {
  const tags = createHreflangAlternateTags(siteOrigin);

  return {
    name: "hreflang-alternates",
    transformIndexHtml() {
      return tags;
    },
  };
}

import { readFileSync } from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

import { parseCloudflareHeadersFile } from "./parse-cloudflare-headers.js";

export function cloudflareHeadersPreviewPlugin(headersFilePath: string): Plugin {
  const absoluteHeadersPath = path.resolve(headersFilePath);

  return {
    name: "cloudflare-headers-preview",
    configurePreviewServer(server) {
      const headers = parseCloudflareHeadersFile(readFileSync(absoluteHeadersPath, "utf8"));

      server.middlewares.use((_request, response, next) => {
        for (const [name, value] of Object.entries(headers)) {
          response.setHeader(name, value);
        }
        next();
      });
    },
  };
}

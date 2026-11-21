import { mergeConfig } from "vite";

import baseConfig from "./vite.config.js";
import { cloudflareHeadersPreviewPlugin } from "./vite/cloudflare-headers-preview-plugin.js";

export default mergeConfig(baseConfig, {
  plugins: [cloudflareHeadersPreviewPlugin("public/_headers")],
});

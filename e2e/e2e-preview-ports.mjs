import ports from "./e2e-preview-ports.json" with { type: "json" };

/** Preview server port for viewer large E2E tests. */
export const E2E_PREVIEW_PORT = ports.viewerPort;

/** Preview server port for security-headers E2E (Cloudflare `_headers` on preview). */
export const E2E_SECURITY_PREVIEW_PORT = ports.securityPort;

export const E2E_PREVIEW_SERVERS_READY = ports.readyMessage;

/**
 * @param {number} port
 * @returns {string}
 */
export function previewOriginForPort(port) {
  return `http://127.0.0.1:${port}`;
}

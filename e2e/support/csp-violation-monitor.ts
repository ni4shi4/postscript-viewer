import type { ConsoleMessage, Page } from "@playwright/test";

const CSP_CONSOLE_SUBSTRING = "Content Security Policy";

export type CspViolationMonitor = {
  dispose: () => void;
  violationCount: () => Promise<number>;
};

export async function attachCspViolationMonitor(page: Page): Promise<CspViolationMonitor> {
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", () => {
      const globals = globalThis as { e2eCspViolationCount?: number };
      globals.e2eCspViolationCount = (globals.e2eCspViolationCount ?? 0) + 1;
    });
  });

  let consoleCspErrorCount = 0;

  const onConsole = (message: ConsoleMessage) => {
    if (message.type() !== "error") {
      return;
    }
    if (message.text().includes(CSP_CONSOLE_SUBSTRING)) {
      consoleCspErrorCount += 1;
    }
  };

  page.on("console", onConsole);

  return {
    dispose: () => {
      page.off("console", onConsole);
    },
    async violationCount(): Promise<number> {
      const domViolations = await page.evaluate(
        () => (globalThis as { e2eCspViolationCount?: number }).e2eCspViolationCount ?? 0,
      );
      return domViolations + consoleCspErrorCount;
    },
  };
}

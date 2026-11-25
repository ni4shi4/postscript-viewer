import type { Locator, Page } from "@playwright/test";

declare global {
  interface Window {
    parentInputEvents?: string[];
  }
}

/** Records pointerdown / wheel events that reach the parent document (capture phase). */
export async function startRecordingParentInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const events: string[] = [];
    window.parentInputEvents = events;
    for (const type of ["pointerdown", "wheel"]) {
      document.addEventListener(type, () => events.push(type), {
        capture: true,
      });
    }
  });
}

export async function readRecordedParentInput(page: Page): Promise<string[]> {
  return page.evaluate(() => window.parentInputEvents ?? []);
}

/** Resolves after the browser has processed two frames, so queued input has been dispatched. */
export async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

export async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("Element has no bounding box");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { createIframePdfViewer } from "./iframe-pdf-viewer";

const SAMPLE_PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);

type BlobUrlRegistry = {
  getActiveCount: () => number;
  isRevoked: (url: string) => boolean;
};

function installBlobUrlRegistry(): BlobUrlRegistry {
  const active = new Set<string>();
  let nextId = 0;

  globalThis.URL.createObjectURL = () => {
    const url = `blob:fake/${String(nextId)}`;
    nextId += 1;
    active.add(url);
    return url;
  };

  globalThis.URL.revokeObjectURL = (url: string) => {
    active.delete(url);
  };

  return {
    getActiveCount: () => active.size,
    isRevoked: (url: string) => !active.has(url),
  };
}

function queryPdfFrame(): HTMLIFrameElement {
  const frame = document.querySelector<HTMLIFrameElement>('[data-testid="pdf-frame"]');
  if (frame === null) {
    throw new Error("pdf frame is missing");
  }
  return frame;
}

describe("createIframePdfViewer", () => {
  let blobUrls: BlobUrlRegistry;

  beforeEach(() => {
    blobUrls = installBlobUrlRegistry();
    const frame = document.createElement("iframe");
    frame.setAttribute("data-testid", "pdf-frame");
    frame.hidden = true;
    document.body.replaceChildren(frame);
  });

  it("shows the iframe with a blob URL when displayPdf is called", () => {
    const pdfFrame = queryPdfFrame();
    const viewer = createIframePdfViewer({ pdfFrame });

    viewer.show(SAMPLE_PDF);

    expect(pdfFrame.hidden).toBe(false);
    expect(pdfFrame.getAttribute("src")?.startsWith("blob:")).toBe(true);
    expect(blobUrls.getActiveCount()).toBe(1);
  });

  it("hides the iframe and revokes the blob URL on clear", () => {
    const pdfFrame = queryPdfFrame();
    const viewer = createIframePdfViewer({ pdfFrame });

    viewer.show(SAMPLE_PDF);
    const previousSrc = pdfFrame.getAttribute("src");
    expect(previousSrc).not.toBeNull();

    viewer.clear();

    expect(pdfFrame.hidden).toBe(true);
    expect(pdfFrame.hasAttribute("src")).toBe(false);
    expect(blobUrls.getActiveCount()).toBe(0);
    if (previousSrc !== null) {
      expect(blobUrls.isRevoked(previousSrc)).toBe(true);
    }
  });

  it("keeps only one active blob URL when show is called twice", () => {
    const pdfFrame = queryPdfFrame();
    const viewer = createIframePdfViewer({ pdfFrame });

    viewer.show(SAMPLE_PDF);
    const firstSrc = pdfFrame.getAttribute("src");
    expect(firstSrc).not.toBeNull();

    viewer.show(new Uint8Array([37, 80, 68, 70, 45, 50, 46, 48]));

    expect(blobUrls.getActiveCount()).toBe(1);
    if (firstSrc !== null) {
      expect(blobUrls.isRevoked(firstSrc)).toBe(true);
    }
    const secondSrc = pdfFrame.getAttribute("src");
    expect(secondSrc).not.toBe(firstSrc);
    expect(secondSrc?.startsWith("blob:")).toBe(true);
  });
});

// @vitest-environment jsdom

import path from "node:path";
import { pathToFileURL } from "node:url";

import { GlobalWorkerOptions } from "pdfjs-dist";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type PdfJsPdfViewerModule = typeof import("./pdfjs-pdf-viewer");

let createPdfJsPdfViewer: PdfJsPdfViewerModule["createPdfJsPdfViewer"];

const SINGLE_PAGE_PDF = Uint8Array.from(
  atob(
    "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kIG9iagogMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzMgMCBSXQovQ291bnQgMQovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDQgMCBSCj4+Cj4+Ci9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKNSAwIG9iago8PAovTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgooSGVsbG8pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMyOCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMSAwIFIKPgo+c3RhcnR4cmVmCjQyMQolJUVPRgo=",
  ),
  (character) => character.charCodeAt(0),
);

const TWO_PAGE_PDF = Uint8Array.from(
  atob(
    "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kIG9iagogMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzMgMCBSIDQgMCBSXQovQ291bnQgMgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDUgMCBSCj4+Cj4+Ci9Db250ZW50cyA2IDAgUgo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDUgMCBSCj4+Cj4+Ci9Db250ZW50cyA3IDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKNiAwIG9iago8PAovTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgooT25lKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjcgMCBvYmoKPDwKL0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMTIgVGYKKFR3bykgVGoKRVQKZW5kc3RyZWFtCmVuZG9qCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MCAwMDAwMCBuIAowMDAwMDAwMzk1IDAwMDAwIG4gCjAwMDAwMDA1NTAgMDAwMDAgbiAKMDAwMDAwMDYzNyAwMDAwMCBuIAowMDAwMDAwNzI0IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgOAovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKODA5CiUlRU9G",
  ),
  (character) => character.charCodeAt(0),
);

function queryPdfCanvasContainer(): HTMLElement {
  const container = document.querySelector<HTMLElement>('[data-testid="pdf-canvas-container"]');
  if (container === null) {
    throw new Error("pdf canvas container is missing");
  }
  return container;
}

function installLayoutWidth(width: number): void {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return width;
    },
  });
}

describe("createPdfJsPdfViewer", () => {
  beforeAll(async () => {
    GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.resolve(
        import.meta.dirname,
        "../../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
      ),
    ).href;
    ({ createPdfJsPdfViewer } = await import("./pdfjs-pdf-viewer"));
  });

  beforeEach(() => {
    installLayoutWidth(400);
    const container = document.createElement("div");
    container.setAttribute("data-testid", "pdf-canvas-container");
    container.hidden = true;
    container.style.width = "400px";
    document.body.replaceChildren(container);
  });

  it("shows canvases after show completes and hides them after clear", async () => {
    const pdfCanvasContainer = queryPdfCanvasContainer();
    const viewer = createPdfJsPdfViewer({ pdfCanvasContainer });

    viewer.show(SINGLE_PAGE_PDF);

    await vi.waitFor(() => {
      expect(pdfCanvasContainer.hidden).toBe(false);
      expect(pdfCanvasContainer.querySelectorAll("canvas").length).toBe(1);
    });

    viewer.clear();

    expect(pdfCanvasContainer.hidden).toBe(true);
    expect(pdfCanvasContainer.querySelectorAll("canvas").length).toBe(0);
  });

  it("renders one canvas per page in order", async () => {
    const pdfCanvasContainer = queryPdfCanvasContainer();
    const viewer = createPdfJsPdfViewer({ pdfCanvasContainer });

    viewer.show(TWO_PAGE_PDF);

    await vi.waitFor(() => {
      expect(pdfCanvasContainer.querySelectorAll("canvas").length).toBe(2);
    });

    const canvases = [...pdfCanvasContainer.querySelectorAll("canvas")];
    expect(canvases.length).toBe(2);
    expect(canvases[0]?.nextElementSibling).toBe(canvases[1] ?? null);
  });
});

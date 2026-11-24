import "./app.css";

import { createIndexedDbPdfStore } from "./adapters/driven/pdf-store-indexeddb/indexeddb-pdf-store";
import { createIframePdfViewer } from "./adapters/driven/pdf-viewer-iframe/iframe-pdf-viewer";
import { createPdfJsPdfViewer } from "./adapters/driven/pdf-viewer-pdfjs/pdfjs-pdf-viewer";
import { createRequestId } from "./adapters/driven/postscript-converter/create-request-id";
import { createWorkerPostScriptConverter } from "./adapters/driven/postscript-converter/worker-postscript-converter";
import { mountViewerApp } from "./adapters/driving/dom/static-shell";
import { queryViewerDom } from "./adapters/driving/dom/viewer-ui";
import type { PdfViewer } from "./core/ports/pdf-viewer";
import { createViewerApp } from "./core/usecases/create-viewer-app";

const connectViewerApp = mountViewerApp({ commitSha: BUILD_COMMIT_SHA, locale: "ja" });

function navigatorHasBuiltInPdfViewer(): boolean {
  return navigator.pdfViewerEnabled === true;
}

function queryPdfCanvasContainer(): HTMLElement {
  const pdfCanvasContainer = document.querySelector<HTMLElement>(
    '[data-testid="pdf-canvas-container"]',
  );
  if (pdfCanvasContainer === null) {
    throw new Error("Required page elements are missing");
  }
  return pdfCanvasContainer;
}

const viewerDom = queryViewerDom();
const postScriptConverter = createWorkerPostScriptConverter();

const pdfViewer: PdfViewer = navigatorHasBuiltInPdfViewer()
  ? createIframePdfViewer(viewerDom)
  : createPdfJsPdfViewer({ pdfCanvasContainer: queryPdfCanvasContainer() });
const pdfStore = createIndexedDbPdfStore();
const viewerApp = createViewerApp({
  postScriptConverter,
  pdfViewer,
  pdfStore,
  createDocumentId: createRequestId,
  now: () => Date.now(),
});

connectViewerApp(viewerApp);
void viewerApp.restore();

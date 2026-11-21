import "./app.css";

import { createIframePdfViewer } from "./adapters/driven/pdf-viewer-iframe/iframe-pdf-viewer";
import { createPdfJsPdfViewer } from "./adapters/driven/pdf-viewer-pdfjs/pdfjs-pdf-viewer";
import { createRequestId } from "./adapters/driven/postscript-converter/create-request-id";
import { createWorkerPostScriptConverter } from "./adapters/driven/postscript-converter/worker-postscript-converter";
import { applyFooterPageHost } from "./adapters/driving/dom/footer-page-host";
import { applyFooterSourceRepositoryLink } from "./adapters/driving/dom/footer-source-link";
import { queryViewerDom, startViewerDomUi } from "./adapters/driving/dom/viewer-ui";
import type { PdfViewer } from "./core/ports/pdf-viewer";
import { createViewerApp } from "./core/usecases/create-viewer-app";

applyFooterSourceRepositoryLink(BUILD_COMMIT_SHA);
applyFooterPageHost();

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

const viewerApp = createViewerApp({
  postScriptConverter,
  pdfViewer,
  createDocumentId: createRequestId,
});

startViewerDomUi(viewerDom, viewerApp);

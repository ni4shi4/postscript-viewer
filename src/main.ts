import "./app.css";

import { createIframePdfViewer } from "./adapters/driven/pdf-viewer-iframe/iframe-pdf-viewer";
import { createRequestId } from "./adapters/driven/postscript-converter/create-request-id";
import { createWorkerPostScriptConverter } from "./adapters/driven/postscript-converter/worker-postscript-converter";
import { queryViewerDom, startViewerDomUi } from "./adapters/driving/dom/viewer-ui";
import { createViewerApp } from "./core/usecases/create-viewer-app";

const viewerDom = queryViewerDom();
const postScriptConverter = createWorkerPostScriptConverter();
const pdfViewer = createIframePdfViewer(viewerDom);
const viewerApp = createViewerApp({
  postScriptConverter,
  pdfViewer,
  createDocumentId: createRequestId,
});

startViewerDomUi(viewerDom, viewerApp);

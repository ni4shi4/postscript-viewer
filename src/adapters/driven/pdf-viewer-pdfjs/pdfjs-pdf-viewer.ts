import {
  getDocument,
  GlobalWorkerOptions,
  OutputScale,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from "pdfjs-dist";

import type { PdfViewer } from "../../../core/ports/pdf-viewer";

if (GlobalWorkerOptions.workerSrc.length === 0) {
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
}

export type PdfJsPdfViewerDom = {
  pdfCanvasContainer: HTMLElement;
};

type PdfJsDocumentInitParameters = {
  data: Uint8Array;
  isEvalSupported: false;
};

export function createPdfJsPdfViewer(dom: PdfJsPdfViewerDom): PdfViewer {
  let renderGeneration = 0;
  let activeDocument: PDFDocumentProxy | undefined;
  const activeRenderTasks: RenderTask[] = [];

  const cancelActiveRenderTasks = (): void => {
    for (const task of activeRenderTasks) {
      task.cancel();
    }
    activeRenderTasks.length = 0;
  };

  const destroyActiveDocument = (): void => {
    if (activeDocument === undefined) {
      return;
    }
    void activeDocument.cleanup();
    activeDocument = undefined;
  };

  const clearRenderedCanvases = (): void => {
    dom.pdfCanvasContainer.replaceChildren();
  };

  const teardownActiveRender = (): void => {
    cancelActiveRenderTasks();
    destroyActiveDocument();
    clearRenderedCanvases();
  };

  const hideContainer = (): void => {
    dom.pdfCanvasContainer.hidden = true;
  };

  const resolveLayoutWidth = (): number => {
    const { pdfCanvasContainer } = dom;
    const containerWidth = pdfCanvasContainer.clientWidth;
    if (containerWidth > 0) {
      return containerWidth;
    }
    const parentWidth = pdfCanvasContainer.parentElement?.clientWidth ?? 0;
    if (parentWidth > 0) {
      return parentWidth;
    }
    return globalThis.innerWidth > 0 ? globalThis.innerWidth : 1;
  };

  const appendRenderedPage = async (
    page: PDFPageProxy,
    layoutWidth: number,
    generation: number,
  ): Promise<void> => {
    if (generation !== renderGeneration) {
      return;
    }

    const unscaledViewport = page.getViewport({ scale: 1 });
    const cssScale = layoutWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale: cssScale });
    const outputScale = new OutputScale();

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D context is unavailable");
    }

    canvas.width = Math.ceil(viewport.width * outputScale.sx);
    canvas.height = Math.ceil(viewport.height * outputScale.sy);
    canvas.style.width = `${String(Math.floor(viewport.width))}px`;
    canvas.style.height = `${String(Math.floor(viewport.height))}px`;

    const renderTask = page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: outputScale.scaled ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0] : undefined,
    });
    activeRenderTasks.push(renderTask);

    try {
      await renderTask.promise;
    } finally {
      const taskIndex = activeRenderTasks.indexOf(renderTask);
      if (taskIndex !== -1) {
        activeRenderTasks.splice(taskIndex, 1);
      }
    }

    if (generation !== renderGeneration) {
      return;
    }

    dom.pdfCanvasContainer.append(canvas);
  };

  const renderPdf = async (pdf: Uint8Array, generation: number): Promise<void> => {
    const pdfData = pdf.slice();
    let loadingTask;
    try {
      loadingTask = getDocument({
        data: pdfData,
        isEvalSupported: false,
      } satisfies PdfJsDocumentInitParameters as Parameters<typeof getDocument>[0]);
    } catch (error) {
      if (generation === renderGeneration) {
        console.error(error);
        hideContainer();
      }
      return;
    }

    let pdfDocument: PDFDocumentProxy;
    try {
      pdfDocument = await loadingTask.promise;
    } catch (error) {
      if (generation === renderGeneration) {
        console.error(error);
        teardownActiveRender();
        hideContainer();
      }
      return;
    }

    if (generation !== renderGeneration) {
      void pdfDocument.cleanup();
      return;
    }

    activeDocument = pdfDocument;
    const layoutWidth = resolveLayoutWidth();
    const pageCount = pdfDocument.numPages;

    try {
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        if (generation !== renderGeneration) {
          return;
        }
        const page = await pdfDocument.getPage(pageNumber);
        await appendRenderedPage(page, layoutWidth, generation);
      }
    } catch (error) {
      if (generation === renderGeneration) {
        console.error(error);
        teardownActiveRender();
        hideContainer();
      }
      return;
    }

    if (generation !== renderGeneration) {
      return;
    }

    if (dom.pdfCanvasContainer.childElementCount === 0) {
      hideContainer();
      return;
    }

    dom.pdfCanvasContainer.hidden = false;
  };

  return {
    show(pdf) {
      renderGeneration += 1;
      const generation = renderGeneration;
      teardownActiveRender();
      void renderPdf(pdf, generation);
    },
    clear() {
      renderGeneration += 1;
      teardownActiveRender();
      hideContainer();
    },
  };
}

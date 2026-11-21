import { ConversionAbortedError } from "../domain/conversion-aborted";
import { ConversionTimeoutError } from "../domain/conversion-timeout";
import { NotGzipError, decompressGzip, isGzipFileName } from "../domain/decompress";
import { TooLargeError, assertWithinByteLimit } from "../domain/limits";
import type { PdfStore } from "../ports/pdf-store";
import type { PdfViewer } from "../ports/pdf-viewer";
import type { PostScriptConverter } from "../ports/postscript-converter";
import type { ViewerApp } from "../ports/viewer-app";
import { createViewerStore } from "../state/viewer-store";
import type { ViewerError } from "../state/viewer-state";

export type CreateViewerAppDeps = {
  postScriptConverter: PostScriptConverter;
  pdfViewer: PdfViewer;
  createDocumentId: () => string;
  pdfStore: PdfStore;
};

function viewerErrorFromUnknown(err: unknown): ViewerError {
  if (err instanceof NotGzipError) {
    return { kind: "not-gzip" };
  }
  if (err instanceof TooLargeError) {
    return { kind: "too-large", limit: err.limit };
  }
  if (err instanceof ConversionTimeoutError) {
    return { kind: "timeout" };
  }
  if (err instanceof Error) {
    return { kind: "conversion-failed", detail: err.message };
  }
  return { kind: "conversion-failed", detail: String(err) };
}

function readRawPostScriptBytes(data: Uint8Array): Uint8Array {
  assertWithinByteLimit(data.length, "input");
  return data;
}

function readGzipPostScriptBytes(data: Uint8Array): Uint8Array {
  assertWithinByteLimit(data.length, "input");
  return decompressGzip(data);
}

function readPostScriptBytes(fileName: string, data: Uint8Array): Uint8Array {
  return isGzipFileName(fileName) ? readGzipPostScriptBytes(data) : readRawPostScriptBytes(data);
}

function clearPdfStore(pdfStore: PdfStore): void {
  void pdfStore.clear().catch((err: unknown) => {
    console.error(err);
  });
}

async function saveReadyPdf(
  pdfStore: PdfStore,
  isStillActive: () => boolean,
  entry: { fileName: string; pdf: Uint8Array },
): Promise<void> {
  if (!isStillActive()) {
    return;
  }
  try {
    await pdfStore.save(entry);
    if (!isStillActive()) {
      try {
        await pdfStore.clear();
      } catch (clearErr: unknown) {
        console.error(clearErr);
      }
    }
  } catch (err: unknown) {
    console.error(err);
  }
}

export function createViewerApp(deps: CreateViewerAppDeps): ViewerApp {
  const store = createViewerStore();
  const { pdfStore } = deps;
  let activeDocumentId: string | undefined;
  let activeRestoreId: string | undefined;
  let abortController: AbortController | undefined;

  const abortActiveConversion = (): void => {
    if (abortController !== undefined) {
      abortController.abort();
      abortController = undefined;
    }
  };

  const isDocumentActive = (documentId: string): boolean => activeDocumentId === documentId;

  return {
    async openPostScript(input) {
      abortActiveConversion();
      activeRestoreId = undefined;

      const documentId = deps.createDocumentId();
      activeDocumentId = documentId;
      abortController = new AbortController();
      const { signal } = abortController;

      clearPdfStore(pdfStore);
      store.beginConverting(documentId, input.fileName, { kind: "started" });
      deps.pdfViewer.clear();

      try {
        const postScript = readPostScriptBytes(input.fileName, input.data);
        const pdf = await deps.postScriptConverter.convert(postScript, {
          fileName: input.fileName,
          signal,
          onProgress: (progress) => {
            if (!isDocumentActive(documentId)) {
              return;
            }
            store.updateConvertingProgress(documentId, progress);
          },
        });

        if (!isDocumentActive(documentId)) {
          return;
        }

        store.setReady(documentId);
        deps.pdfViewer.show(pdf);
        void saveReadyPdf(pdfStore, () => isDocumentActive(documentId), {
          fileName: input.fileName,
          pdf,
        });
      } catch (err: unknown) {
        if (!isDocumentActive(documentId)) {
          return;
        }
        if (err instanceof ConversionAbortedError) {
          return;
        }
        clearPdfStore(pdfStore);
        store.setError(documentId, viewerErrorFromUnknown(err));
        deps.pdfViewer.clear();
      }
    },

    async restore() {
      const restoreId = deps.createDocumentId();
      activeRestoreId = restoreId;

      const entry = await pdfStore.load();
      if (activeRestoreId !== restoreId) {
        return;
      }
      if (activeDocumentId !== undefined) {
        activeRestoreId = undefined;
        return;
      }
      if (entry === undefined) {
        activeRestoreId = undefined;
        return;
      }

      store.setRestoredReady(restoreId, entry.fileName);
      deps.pdfViewer.show(entry.pdf);
      activeRestoreId = undefined;
    },

    cancel() {
      abortActiveConversion();
      activeDocumentId = undefined;
      activeRestoreId = undefined;
      clearPdfStore(pdfStore);
      store.clear();
      deps.pdfViewer.clear();
    },

    getState() {
      return store.getState();
    },

    subscribe(listener) {
      return store.subscribe(listener);
    },
  };
}

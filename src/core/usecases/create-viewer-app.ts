import { ConversionAbortedError } from "../domain/conversion-aborted";
import { NotGzipError, decompressGzip, isGzipFileName } from "../domain/decompress";
import { TooLargeError, assertWithinByteLimit } from "../domain/limits";
import type { PdfViewer } from "../ports/pdf-viewer";
import type { PostScriptConverter } from "../ports/postscript-converter";
import type { ViewerApp } from "../ports/viewer-app";
import { createViewerStore } from "../state/viewer-store";
import type { ViewerError } from "../state/viewer-state";

export type CreateViewerAppDeps = {
  postScriptConverter: PostScriptConverter;
  pdfViewer: PdfViewer;
  createDocumentId: () => string;
};

function viewerErrorFromUnknown(err: unknown): ViewerError {
  if (err instanceof NotGzipError) {
    return { kind: "not-gzip" };
  }
  if (err instanceof TooLargeError) {
    return { kind: "too-large", limit: err.limit };
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

export function createViewerApp(deps: CreateViewerAppDeps): ViewerApp {
  const store = createViewerStore();
  let activeDocumentId: string | undefined;
  let abortController: AbortController | undefined;

  const abortActiveConversion = (): void => {
    if (abortController !== undefined) {
      abortController.abort();
      abortController = undefined;
    }
  };

  return {
    async openPostScript(input) {
      abortActiveConversion();

      const documentId = deps.createDocumentId();
      activeDocumentId = documentId;
      abortController = new AbortController();
      const { signal } = abortController;

      store.beginConverting(documentId, input.fileName, { kind: "started" });
      deps.pdfViewer.clear();

      try {
        const postScript = readPostScriptBytes(input.fileName, input.data);
        const pdf = await deps.postScriptConverter.convert(postScript, {
          fileName: input.fileName,
          signal,
          onProgress: (progress) => {
            if (activeDocumentId !== documentId) {
              return;
            }
            store.updateConvertingProgress(documentId, progress);
          },
        });

        if (activeDocumentId !== documentId) {
          return;
        }

        store.setReady(documentId);
        deps.pdfViewer.show(pdf);
      } catch (err: unknown) {
        if (activeDocumentId !== documentId) {
          return;
        }
        if (err instanceof ConversionAbortedError) {
          return;
        }
        store.setError(documentId, viewerErrorFromUnknown(err));
        deps.pdfViewer.clear();
      }
    },

    cancel() {
      abortActiveConversion();
      activeDocumentId = undefined;
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

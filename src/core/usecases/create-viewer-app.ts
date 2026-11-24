import { ConversionAbortedError } from "../domain/conversion-aborted";
import { ConversionTimeoutError } from "../domain/conversion-timeout";
import { NotGzipError, decompressGzip, isGzipFileName } from "../domain/decompress";
import { TooLargeError, assertWithinByteLimit } from "../domain/limits";
import type { PdfStore } from "../ports/pdf-store";
import type { PdfViewer } from "../ports/pdf-viewer";
import type { PostScriptConverter } from "../ports/postscript-converter";
import type { ViewerApp } from "../ports/viewer-app";
import { createViewerStore } from "../state/viewer-store";
import { selectedViewerDocument, type ViewerError } from "../state/viewer-state";

export type CreateViewerAppDeps = {
  postScriptConverter: PostScriptConverter;
  pdfViewer: PdfViewer;
  createDocumentId: () => string;
  pdfStore: PdfStore;
  now: () => number;
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

async function syncHistoryState(
  pdfStore: PdfStore,
  store: ReturnType<typeof createViewerStore>,
): Promise<void> {
  const metas = await pdfStore.list();
  store.setHistoryFromMetas(metas);
}

async function putReadyPdf(
  deps: CreateViewerAppDeps,
  store: ReturnType<typeof createViewerStore>,
  isStillActive: () => boolean,
  entry: { id: string; fileName: string; pdf: Uint8Array },
): Promise<void> {
  if (!isStillActive()) {
    return;
  }
  try {
    await deps.pdfStore.put({
      id: entry.id,
      fileName: entry.fileName,
      savedAt: deps.now(),
      pdf: entry.pdf,
    });
    if (!isStillActive()) {
      try {
        await deps.pdfStore.remove(entry.id);
      } catch (removeErr: unknown) {
        console.error(removeErr);
      }
      return;
    }
    await syncHistoryState(deps.pdfStore, store);
  } catch (err: unknown) {
    console.error(err);
  }
}

function isHistoryDocumentId(
  state: ReturnType<ReturnType<typeof createViewerStore>["getState"]>,
  id: string,
): boolean {
  const viewerDocument = state.documents.find((entry) => entry.id === id);
  if (viewerDocument === undefined) {
    return false;
  }
  return viewerDocument.savedAt !== undefined && viewerDocument.status.kind === "ready";
}

export function createViewerApp(deps: CreateViewerAppDeps): ViewerApp {
  const store = createViewerStore();
  const { pdfStore } = deps;
  let activeDocumentId: string | undefined;
  let activeRestoreId: string | undefined;
  let activeSelectId: string | undefined;
  let abortController: AbortController | undefined;

  const abortActiveConversion = (): void => {
    if (abortController !== undefined) {
      abortController.abort();
      abortController = undefined;
    }
  };

  const discardSessionAndDeselect = (): void => {
    abortActiveConversion();
    activeDocumentId = undefined;
    activeRestoreId = undefined;
    activeSelectId = undefined;
    store.clearSessionDocuments();
    store.selectDocumentId(undefined);
    deps.pdfViewer.clear();
  };

  const isDocumentActive = (documentId: string): boolean => activeDocumentId === documentId;

  return {
    async openPostScript(input) {
      abortActiveConversion();
      activeRestoreId = undefined;
      activeSelectId = undefined;

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
        void putReadyPdf(deps, store, () => isDocumentActive(documentId), {
          id: documentId,
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
        store.setError(documentId, viewerErrorFromUnknown(err));
        deps.pdfViewer.clear();
      }
    },

    async restore() {
      const restoreId = deps.createDocumentId();
      activeRestoreId = restoreId;

      const metas = await pdfStore.list();
      if (activeRestoreId !== restoreId) {
        return;
      }
      if (activeDocumentId !== undefined) {
        activeRestoreId = undefined;
        return;
      }
      if (metas.length === 0) {
        activeRestoreId = undefined;
        return;
      }

      store.setHistoryFromMetas(metas);
      const latest = metas[0]!;
      store.selectDocumentId(latest.id);

      const entry = await pdfStore.get(latest.id);
      if (activeRestoreId !== restoreId) {
        return;
      }
      if (entry === undefined) {
        activeRestoreId = undefined;
        return;
      }

      deps.pdfViewer.show(entry.pdf);
      activeRestoreId = undefined;
    },

    cancel() {
      discardSessionAndDeselect();
    },

    // 表示中の文書を閉じて「何も表示していない」状態に戻る。履歴は残す。
    // 変換が済んだ文書は、保存中であれば保存を続けて履歴に残す（cancel は保存も取り消す）。
    closeDocument() {
      const selected = selectedViewerDocument(store.getState());
      if (selected?.status.kind !== "ready") {
        discardSessionAndDeselect();
        return;
      }
      activeRestoreId = undefined;
      activeSelectId = undefined;
      store.selectDocumentId(undefined);
      deps.pdfViewer.clear();
    },

    async selectDocument(id) {
      const metasProbe = await pdfStore.list();
      if (!metasProbe.some((meta) => meta.id === id)) {
        return;
      }

      const selectId = deps.createDocumentId();
      activeSelectId = selectId;
      activeRestoreId = undefined;

      abortActiveConversion();
      activeDocumentId = undefined;

      if (activeSelectId !== selectId) {
        return;
      }

      const entry = await pdfStore.get(id);
      if (activeSelectId !== selectId) {
        return;
      }
      if (entry === undefined) {
        return;
      }

      const metas = await pdfStore.list();
      if (activeSelectId !== selectId) {
        return;
      }

      store.clearSessionDocuments();
      store.setHistoryFromMetas(metas);
      store.selectDocumentId(id);
      deps.pdfViewer.show(entry.pdf);
      activeSelectId = undefined;
    },

    async deleteDocument(id) {
      const metasBefore = await pdfStore.list();
      if (!metasBefore.some((meta) => meta.id === id)) {
        return;
      }

      const wasSelected = store.getState().selectedDocumentId === id;

      await pdfStore.remove(id);
      await syncHistoryState(pdfStore, store);

      if (wasSelected) {
        store.selectDocumentId(undefined);
        deps.pdfViewer.clear();
      }
    },

    async clearHistory() {
      const stateBefore = store.getState();
      const selectedId = stateBefore.selectedDocumentId;
      const selectedWasHistory =
        selectedId !== undefined && isHistoryDocumentId(stateBefore, selectedId);

      await pdfStore.removeAll();
      store.clearHistoryDocuments();
      await syncHistoryState(pdfStore, store);

      if (selectedWasHistory) {
        store.selectDocumentId(undefined);
        deps.pdfViewer.clear();
      }
    },

    getState() {
      return store.getState();
    },

    subscribe(listener) {
      return store.subscribe(listener);
    },
  };
}

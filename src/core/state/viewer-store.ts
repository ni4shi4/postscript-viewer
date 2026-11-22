import type { PdfStoreHistoryMeta } from "../ports/pdf-store";
import type { ConversionProgress } from "../ports/postscript-converter";
import type { ViewerDocument, ViewerError, ViewerState } from "./viewer-state";

export type ViewerStore = {
  getState(): ViewerState;
  subscribe(listener: (state: ViewerState) => void): () => void;
  beginConverting(id: string, fileName: string, progress: ConversionProgress): void;
  updateConvertingProgress(id: string, progress: ConversionProgress): void;
  setReady(id: string): void;
  setError(id: string, error: ViewerError): void;
  setHistoryFromMetas(metas: PdfStoreHistoryMeta[]): void;
  selectDocumentId(id: string | undefined): void;
  clearSessionDocuments(): void;
  clearHistoryDocuments(): void;
  removeHistoryDocument(id: string): void;
};

const emptyViewerState = (): ViewerState => ({
  documents: [],
  selectedDocumentId: undefined,
});

function isSessionDocument(viewerDocument: ViewerDocument): boolean {
  if (viewerDocument.status.kind === "converting" || viewerDocument.status.kind === "error") {
    return true;
  }
  return viewerDocument.savedAt === undefined;
}

function historyDocumentsFromMetas(metas: PdfStoreHistoryMeta[]): ViewerDocument[] {
  return metas.map((meta) => ({
    id: meta.id,
    fileName: meta.fileName,
    savedAt: meta.savedAt,
    status: { kind: "ready" as const },
  }));
}

function mergeHistoryAndSession(
  metas: PdfStoreHistoryMeta[],
  current: ViewerDocument[],
): ViewerDocument[] {
  const sessionDocuments = current.filter(isSessionDocument);
  const historyDocuments = historyDocumentsFromMetas(metas);
  const metaIds = new Set(metas.map((meta) => meta.id));
  const sessionOutsideHistory = sessionDocuments.filter(
    (viewerDocument) => !metaIds.has(viewerDocument.id),
  );
  return [...historyDocuments, ...sessionOutsideHistory];
}

export function createViewerStore(): ViewerStore {
  let state = emptyViewerState();
  const listeners = new Set<(next: ViewerState) => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  const replaceState = (next: ViewerState): void => {
    state = next;
    notify();
  };

  const updateSelectedDocument = (
    id: string,
    update: (viewerDocument: ViewerDocument) => ViewerDocument,
  ): void => {
    if (state.selectedDocumentId !== id) {
      return;
    }
    const index = state.documents.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return;
    }
    const nextDocuments = state.documents.slice();
    nextDocuments[index] = update(nextDocuments[index]!);
    replaceState({ ...state, documents: nextDocuments });
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    beginConverting: (id, fileName, progress) => {
      const withoutSessions = state.documents.filter(
        (viewerDocument) => !isSessionDocument(viewerDocument),
      );
      const viewerDocument: ViewerDocument = {
        id,
        fileName,
        status: { kind: "converting", progress },
      };
      replaceState({
        documents: [...withoutSessions, viewerDocument],
        selectedDocumentId: id,
      });
    },
    updateConvertingProgress: (id, progress) => {
      updateSelectedDocument(id, (viewerDocument) => {
        if (viewerDocument.status.kind !== "converting") {
          return viewerDocument;
        }
        return {
          ...viewerDocument,
          status: { kind: "converting", progress },
        };
      });
    },
    setReady: (id) => {
      updateSelectedDocument(id, (viewerDocument) => ({
        ...viewerDocument,
        status: { kind: "ready" },
      }));
    },
    setError: (id, error) => {
      updateSelectedDocument(id, (viewerDocument) => ({
        ...viewerDocument,
        status: { kind: "error", error },
      }));
    },
    setHistoryFromMetas: (metas) => {
      const documents = mergeHistoryAndSession(metas, state.documents);
      const selectedStillExists =
        state.selectedDocumentId !== undefined &&
        documents.some((viewerDocument) => viewerDocument.id === state.selectedDocumentId);
      replaceState({
        documents,
        selectedDocumentId: selectedStillExists ? state.selectedDocumentId : undefined,
      });
    },
    selectDocumentId: (id) => {
      if (id === undefined) {
        replaceState({ ...state, selectedDocumentId: undefined });
        return;
      }
      if (!state.documents.some((viewerDocument) => viewerDocument.id === id)) {
        return;
      }
      replaceState({ ...state, selectedDocumentId: id });
    },
    clearSessionDocuments: () => {
      const documents = state.documents.filter(
        (viewerDocument) => !isSessionDocument(viewerDocument),
      );
      const selectedRemoved =
        state.selectedDocumentId !== undefined &&
        !documents.some((viewerDocument) => viewerDocument.id === state.selectedDocumentId);
      replaceState({
        documents,
        selectedDocumentId: selectedRemoved ? undefined : state.selectedDocumentId,
      });
    },
    clearHistoryDocuments: () => {
      const documents = state.documents.filter(isSessionDocument);
      const selectedRemoved =
        state.selectedDocumentId !== undefined &&
        !documents.some((viewerDocument) => viewerDocument.id === state.selectedDocumentId);
      replaceState({
        documents,
        selectedDocumentId: selectedRemoved ? undefined : state.selectedDocumentId,
      });
    },
    removeHistoryDocument: (id) => {
      const documents = state.documents.filter((viewerDocument) => viewerDocument.id !== id);
      const selectedRemoved = state.selectedDocumentId === id;
      replaceState({
        documents,
        selectedDocumentId: selectedRemoved ? undefined : state.selectedDocumentId,
      });
    },
  };
}

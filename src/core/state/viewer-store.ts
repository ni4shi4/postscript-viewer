import type { ConversionProgress } from "../ports/postscript-converter";
import type { ViewerDocument, ViewerError, ViewerState } from "./viewer-state";

export type ViewerStore = {
  getState(): ViewerState;
  subscribe(listener: (state: ViewerState) => void): () => void;
  beginConverting(id: string, fileName: string, progress: ConversionProgress): void;
  updateConvertingProgress(id: string, progress: ConversionProgress): void;
  setReady(id: string): void;
  setRestoredReady(id: string, fileName: string): void;
  setError(id: string, error: ViewerError): void;
  clear(): void;
};

const emptyViewerState = (): ViewerState => ({
  documents: [],
  selectedDocumentId: undefined,
});

export function createViewerStore(): ViewerStore {
  let state = emptyViewerState();
  const listeners = new Set<(next: ViewerState) => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  const replaceSelectedDocument = (viewerDocument: ViewerDocument): void => {
    state = {
      documents: [viewerDocument],
      selectedDocumentId: viewerDocument.id,
    };
    notify();
  };

  const updateSelectedDocument = (
    id: string,
    update: (viewerDocument: ViewerDocument) => ViewerDocument,
  ): void => {
    if (state.selectedDocumentId !== id) {
      return;
    }
    const current = state.documents.find((entry) => entry.id === id);
    if (current === undefined) {
      return;
    }
    replaceSelectedDocument(update(current));
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
      replaceSelectedDocument({
        id,
        fileName,
        status: { kind: "converting", progress },
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
    setRestoredReady: (id, fileName) => {
      replaceSelectedDocument({
        id,
        fileName,
        status: { kind: "ready" },
      });
    },
    setError: (id, error) => {
      updateSelectedDocument(id, (viewerDocument) => ({
        ...viewerDocument,
        status: { kind: "error", error },
      }));
    },
    clear: () => {
      state = emptyViewerState();
      notify();
    },
  };
}

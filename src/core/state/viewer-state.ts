import type { ConversionProgress } from "../ports/postscript-converter";

import type { ByteLimitKind } from "../domain/limits";

export type ViewerError =
  | { kind: "not-gzip" }
  | { kind: "too-large"; limit: ByteLimitKind }
  | { kind: "timeout" }
  | { kind: "conversion-failed"; detail: string };

export type ViewerDocumentStatus =
  | { kind: "converting"; progress: ConversionProgress }
  | { kind: "ready" }
  | { kind: "error"; error: ViewerError };

export type ViewerDocument = {
  id: string;
  fileName: string;
  status: ViewerDocumentStatus;
  savedAt?: number;
};

export type ViewerState = {
  documents: ViewerDocument[];
  selectedDocumentId: string | undefined;
};

export function selectedViewerDocument(state: ViewerState): ViewerDocument | undefined {
  const { selectedDocumentId, documents } = state;
  if (selectedDocumentId === undefined) {
    return undefined;
  }
  return documents.find((viewerDocument) => viewerDocument.id === selectedDocumentId);
}

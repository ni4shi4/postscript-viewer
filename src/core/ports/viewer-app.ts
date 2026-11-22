import type { ViewerState } from "../state/viewer-state";

export type ViewerApp = {
  openPostScript(input: { fileName: string; data: Uint8Array }): Promise<void>;
  restore(): Promise<void>;
  cancel(): void;
  selectDocument(id: string): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  clearHistory(): Promise<void>;
  getState(): ViewerState;
  subscribe(listener: (state: ViewerState) => void): () => void;
};

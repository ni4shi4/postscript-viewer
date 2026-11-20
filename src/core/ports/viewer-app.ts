import type { ViewerState } from "../state/viewer-state";

export type ViewerApp = {
  openPostScript(input: { fileName: string; data: Uint8Array }): Promise<void>;
  cancel(): void;
  getState(): ViewerState;
  subscribe(listener: (state: ViewerState) => void): () => void;
};

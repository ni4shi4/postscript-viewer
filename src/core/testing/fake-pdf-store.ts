import type { PdfStore, PdfStoreEntry } from "../ports/pdf-store";

export type FakePdfStore = PdfStore & {
  getStored(): PdfStoreEntry | undefined;
  setStored(entry: PdfStoreEntry | undefined): void;
  setSaveDelay(delay: () => Promise<void>): void;
  setLoadDelay(delay: () => Promise<void>): void;
};

export function createFakePdfStore(): FakePdfStore {
  let stored: PdfStoreEntry | undefined;
  let saveDelay: (() => Promise<void>) | undefined;
  let loadDelay: (() => Promise<void>) | undefined;

  return {
    async save(entry) {
      if (saveDelay !== undefined) {
        await saveDelay();
      }
      stored = entry;
    },
    async load() {
      if (loadDelay !== undefined) {
        await loadDelay();
      }
      return stored;
    },
    async clear() {
      stored = undefined;
    },
    getStored() {
      return stored;
    },
    setStored(entry) {
      stored = entry;
    },
    setSaveDelay(delay) {
      saveDelay = delay;
    },
    setLoadDelay(delay) {
      loadDelay = delay;
    },
  };
}

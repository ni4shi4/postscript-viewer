import {
  nextPdfHistoryInsertionOrder,
  pdfHistoryIdsToEvict,
  sortPdfHistoryMetasNewestFirst,
  type PdfStore,
  type PdfStoreEntry,
  type PdfStoreHistoryEntry,
  type PdfStoreHistoryMeta,
  type PdfStoreHistoryMetaWithOrder,
} from "../ports/pdf-store";

type FakeHistoryRecord = PdfStoreHistoryMetaWithOrder & {
  pdf: Uint8Array;
};

export type FakePdfStore = PdfStore & {
  getStored(): PdfStoreEntry | undefined;
  setStored(entry: PdfStoreEntry | undefined): void;
  setSaveDelay(delay: () => Promise<void>): void;
  setLoadDelay(delay: () => Promise<void>): void;
};

function toHistoryMeta(record: FakeHistoryRecord): PdfStoreHistoryMeta {
  const { id, fileName, savedAt } = record;
  return { id, fileName, savedAt };
}

function putHistoryRecord(
  records: Map<string, FakeHistoryRecord>,
  entry: PdfStoreHistoryEntry,
): void {
  const existing = [...records.values()];
  const evictIds = pdfHistoryIdsToEvict(existing, entry.id);
  for (const id of evictIds) {
    records.delete(id);
  }
  const prior = records.get(entry.id);
  const order = prior === undefined ? nextPdfHistoryInsertionOrder(existing) : prior.order;
  records.set(entry.id, { ...entry, order });
}

export function createFakePdfStore(): FakePdfStore {
  let stored: PdfStoreEntry | undefined;
  const history = new Map<string, FakeHistoryRecord>();
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
    async put(entry) {
      putHistoryRecord(history, entry);
    },
    async list() {
      return sortPdfHistoryMetasNewestFirst([...history.values()].map(toHistoryMeta));
    },
    async get(id) {
      const record = history.get(id);
      if (record === undefined) {
        return undefined;
      }
      const { id: entryId, fileName, savedAt, pdf } = record;
      return { id: entryId, fileName, savedAt, pdf };
    },
    async remove(id) {
      history.delete(id);
    },
    async removeAll() {
      history.clear();
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

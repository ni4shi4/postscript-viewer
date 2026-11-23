import {
  nextPdfHistoryInsertionOrder,
  pdfHistoryIdsToEvict,
  sortPdfHistoryMetasNewestFirst,
  type PdfStore,
  type PdfStoreHistoryEntry,
  type PdfStoreHistoryMeta,
  type PdfStoreHistoryMetaWithOrder,
} from "../ports/pdf-store";

type FakeHistoryRecord = PdfStoreHistoryMetaWithOrder & {
  pdf: Uint8Array;
};

export type FakePdfStore = PdfStore & {
  setSaveDelay(delay: () => Promise<void>): void;
  setListDelay(delay: () => Promise<void>): void;
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
  const history = new Map<string, FakeHistoryRecord>();
  let saveDelay: (() => Promise<void>) | undefined;
  let listDelay: (() => Promise<void>) | undefined;

  return {
    async put(entry) {
      if (saveDelay !== undefined) {
        await saveDelay();
      }
      putHistoryRecord(history, entry);
    },
    async list() {
      if (listDelay !== undefined) {
        await listDelay();
      }
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
    setSaveDelay(delay) {
      saveDelay = delay;
    },
    setListDelay(delay) {
      listDelay = delay;
    },
  };
}

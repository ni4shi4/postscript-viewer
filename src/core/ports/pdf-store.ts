import { MAX_PDF_HISTORY_ENTRIES } from "../domain/limits";

export type PdfStoreHistoryMeta = {
  id: string;
  fileName: string;
  savedAt: number;
};

export type PdfStoreHistoryEntry = PdfStoreHistoryMeta & {
  pdf: Uint8Array;
};

export type PdfStoreHistoryMetaWithOrder = PdfStoreHistoryMeta & {
  order: number;
};

export type PdfStore = {
  put(entry: PdfStoreHistoryEntry): Promise<void>;
  list(): Promise<PdfStoreHistoryMeta[]>;
  get(id: string): Promise<PdfStoreHistoryEntry | undefined>;
  remove(id: string): Promise<void>;
  removeAll(): Promise<void>;
};

export function sortPdfHistoryMetasNewestFirst(
  metas: PdfStoreHistoryMeta[],
): PdfStoreHistoryMeta[] {
  return metas.toSorted((left, right) => right.savedAt - left.savedAt);
}

export function pdfHistoryIdsToEvict(
  existing: PdfStoreHistoryMetaWithOrder[],
  putId: string,
  maxEntries: number = MAX_PDF_HISTORY_ENTRIES,
): string[] {
  const withoutPutId = existing.filter((entry) => entry.id !== putId);
  const nextCount = withoutPutId.length + 1;
  if (nextCount <= maxEntries) {
    return [];
  }
  const sortedOldestFirst = withoutPutId.toSorted(comparePdfHistoryByAge);
  const removeCount = nextCount - maxEntries;
  return sortedOldestFirst.slice(0, removeCount).map((entry) => entry.id);
}

export function comparePdfHistoryByAge(
  left: PdfStoreHistoryMetaWithOrder,
  right: PdfStoreHistoryMetaWithOrder,
): number {
  if (left.savedAt !== right.savedAt) {
    return left.savedAt - right.savedAt;
  }
  return left.order - right.order;
}

export function nextPdfHistoryInsertionOrder(existing: PdfStoreHistoryMetaWithOrder[]): number {
  if (existing.length === 0) {
    return 0;
  }
  return Math.max(...existing.map((entry) => entry.order)) + 1;
}

import {
  nextPdfHistoryInsertionOrder,
  pdfHistoryIdsToEvict,
  sortPdfHistoryMetasNewestFirst,
  type PdfStore,
  type PdfStoreHistoryEntry,
  type PdfStoreHistoryMeta,
  type PdfStoreHistoryMetaWithOrder,
} from "../../../core/ports/pdf-store";

const PDF_STORE_DB_NAME = "postscript-viewer-pdf";
const PDF_STORE_LEGACY_OBJECT_STORE_NAME = "pdf";
const PDF_STORE_META_OBJECT_STORE_NAME = "pdf-history-meta";
const PDF_STORE_BODY_OBJECT_STORE_NAME = "pdf-history-body";
const PDF_STORE_LEGACY_ENTRY_KEY = "latest";
export const PDF_STORE_MIGRATED_LATEST_ID = "migrated-latest";
const PDF_STORE_DB_VERSION = 3;

type LegacyLatestPdfEntry = {
  fileName: string;
  pdf: Uint8Array;
};

type StoredPdfHistoryMeta = PdfStoreHistoryMetaWithOrder;

const HISTORY_STORE_NAMES = [
  PDF_STORE_META_OBJECT_STORE_NAME,
  PDF_STORE_BODY_OBJECT_STORE_NAME,
] as const;

function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function isLegacyLatestPdfEntry(value: unknown): value is LegacyLatestPdfEntry {
  if (value === undefined || value === null || typeof value !== "object") {
    return false;
  }
  if (!("fileName" in value) || !("pdf" in value)) {
    return false;
  }
  const { fileName, pdf } = value;
  return typeof fileName === "string" && pdf instanceof Uint8Array;
}

function ensureHistoryObjectStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(PDF_STORE_META_OBJECT_STORE_NAME)) {
    db.createObjectStore(PDF_STORE_META_OBJECT_STORE_NAME);
  }
  if (!db.objectStoreNames.contains(PDF_STORE_BODY_OBJECT_STORE_NAME)) {
    db.createObjectStore(PDF_STORE_BODY_OBJECT_STORE_NAME);
  }
}

function ensureLegacyObjectStoreForMigration(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(PDF_STORE_LEGACY_OBJECT_STORE_NAME)) {
    db.createObjectStore(PDF_STORE_LEGACY_OBJECT_STORE_NAME);
  }
}

function removeLegacyObjectStoreIfPresent(db: IDBDatabase): void {
  if (db.objectStoreNames.contains(PDF_STORE_LEGACY_OBJECT_STORE_NAME)) {
    db.deleteObjectStore(PDF_STORE_LEGACY_OBJECT_STORE_NAME);
  }
}

function copyLegacyLatestIntoHistoryIfPresent(
  metaStore: IDBObjectStore,
  bodyStore: IDBObjectStore,
  entry: unknown,
  savedAt: number,
): void {
  if (!isLegacyLatestPdfEntry(entry)) {
    return;
  }
  const meta: StoredPdfHistoryMeta = {
    id: PDF_STORE_MIGRATED_LATEST_ID,
    fileName: entry.fileName,
    savedAt,
    order: 0,
  };
  metaStore.put(meta, meta.id);
  bodyStore.put(entry.pdf, meta.id);
}

function migrateLegacyLatestThenRemoveLegacyStore(
  db: IDBDatabase,
  transaction: IDBTransaction,
  savedAt: number,
): void {
  const legacyStore = transaction.objectStore(PDF_STORE_LEGACY_OBJECT_STORE_NAME);
  const metaStore = transaction.objectStore(PDF_STORE_META_OBJECT_STORE_NAME);
  const bodyStore = transaction.objectStore(PDF_STORE_BODY_OBJECT_STORE_NAME);
  const request = legacyStore.get(PDF_STORE_LEGACY_ENTRY_KEY);

  const removeLegacyStoreAfterRead = () => {
    removeLegacyObjectStoreIfPresent(db);
  };

  request.addEventListener("success", () => {
    copyLegacyLatestIntoHistoryIfPresent(metaStore, bodyStore, request.result, savedAt);
    removeLegacyStoreAfterRead();
  });
  request.addEventListener("error", () => {
    removeLegacyStoreAfterRead();
  });
}

function upgradeFromVersionOne(db: IDBDatabase, transaction: IDBTransaction): void {
  ensureLegacyObjectStoreForMigration(db);
  ensureHistoryObjectStores(db);
  migrateLegacyLatestThenRemoveLegacyStore(db, transaction, Date.now());
}

function upgradeFromVersionTwo(db: IDBDatabase): void {
  ensureHistoryObjectStores(db);
  removeLegacyObjectStoreIfPresent(db);
}

function runUpgradeNeeded(db: IDBDatabase, transaction: IDBTransaction, oldVersion: number): void {
  if (oldVersion === 0) {
    ensureHistoryObjectStores(db);
    return;
  }
  if (oldVersion < 2) {
    upgradeFromVersionOne(db, transaction);
    return;
  }
  if (oldVersion < 3) {
    upgradeFromVersionTwo(db);
  }
}

function openPdfStoreDatabase(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    const request = indexedDB.open(PDF_STORE_DB_NAME, PDF_STORE_DB_VERSION);
    request.addEventListener("error", () => {
      resolve(undefined);
    });
    request.addEventListener("blocked", () => {
      resolve(undefined);
    });
    request.addEventListener("upgradeneeded", (event) => {
      const db = request.result;
      const transaction = request.transaction;
      if (transaction === null) {
        return;
      }
      runUpgradeNeeded(db, transaction, event.oldVersion);
    });
    request.addEventListener("success", () => {
      resolve(request.result);
    });
  });
}

function runObjectStoreTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(storeName, mode);
    } catch {
      resolve(undefined);
      return;
    }
    transaction.addEventListener("error", () => {
      resolve(undefined);
    });
    transaction.addEventListener("abort", () => {
      resolve(undefined);
    });
    let request: IDBRequest<T>;
    let result: T | undefined;
    try {
      request = run(transaction.objectStore(storeName));
    } catch {
      resolve(undefined);
      return;
    }
    request.addEventListener("error", () => {
      resolve(undefined);
    });
    request.addEventListener("success", () => {
      result = request.result;
    });
    transaction.addEventListener("complete", () => {
      resolve(result);
    });
  });
}

function runHistoryStoresTransaction(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (metaStore: IDBObjectStore, bodyStore: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([...HISTORY_STORE_NAMES], mode);
    } catch {
      resolve();
      return;
    }
    transaction.addEventListener("error", () => {
      resolve();
    });
    transaction.addEventListener("abort", () => {
      resolve();
    });
    try {
      const metaStore = transaction.objectStore(PDF_STORE_META_OBJECT_STORE_NAME);
      const bodyStore = transaction.objectStore(PDF_STORE_BODY_OBJECT_STORE_NAME);
      run(metaStore, bodyStore);
    } catch {
      resolve();
      return;
    }
    transaction.addEventListener("complete", () => {
      resolve();
    });
  });
}

function parseStoredMeta(value: unknown): StoredPdfHistoryMeta | undefined {
  if (value === undefined || value === null || typeof value !== "object") {
    return undefined;
  }
  if (!("id" in value) || !("fileName" in value) || !("savedAt" in value) || !("order" in value)) {
    return undefined;
  }
  const { id, fileName, savedAt, order } = value;
  if (
    typeof id !== "string" ||
    typeof fileName !== "string" ||
    typeof savedAt !== "number" ||
    typeof order !== "number"
  ) {
    return undefined;
  }
  return { id, fileName, savedAt, order };
}

async function getAllHistoryMetas(db: IDBDatabase): Promise<StoredPdfHistoryMeta[]> {
  const records = await runObjectStoreTransaction<unknown[]>(
    db,
    PDF_STORE_META_OBJECT_STORE_NAME,
    "readonly",
    (store) => store.getAll(),
  );
  if (records === undefined) {
    return [];
  }
  const metas: StoredPdfHistoryMeta[] = [];
  for (const record of records) {
    const parsed = parseStoredMeta(record);
    if (parsed !== undefined) {
      metas.push(parsed);
    }
  }
  return metas;
}

async function putHistoryEntry(db: IDBDatabase, entry: PdfStoreHistoryEntry): Promise<void> {
  const existingMetas = await getAllHistoryMetas(db);
  const evictIds = pdfHistoryIdsToEvict(existingMetas, entry.id);
  const prior = existingMetas.find((meta) => meta.id === entry.id);
  const order = prior === undefined ? nextPdfHistoryInsertionOrder(existingMetas) : prior.order;
  const meta: StoredPdfHistoryMeta = {
    id: entry.id,
    fileName: entry.fileName,
    savedAt: entry.savedAt,
    order,
  };
  await runHistoryStoresTransaction(db, "readwrite", (metaStore, bodyStore) => {
    for (const id of evictIds) {
      metaStore.delete(id);
      bodyStore.delete(id);
    }
    metaStore.put(meta, meta.id);
    bodyStore.put(entry.pdf, meta.id);
  });
}

async function listHistoryMetas(db: IDBDatabase): Promise<PdfStoreHistoryMeta[]> {
  const metas = await getAllHistoryMetas(db);
  return sortPdfHistoryMetasNewestFirst(
    metas.map(({ id, fileName, savedAt }) => ({ id, fileName, savedAt })),
  );
}

async function getHistoryEntry(
  db: IDBDatabase,
  id: string,
): Promise<PdfStoreHistoryEntry | undefined> {
  const rawMeta = await runObjectStoreTransaction<unknown>(
    db,
    PDF_STORE_META_OBJECT_STORE_NAME,
    "readonly",
    (store) => store.get(id),
  );
  const meta = parseStoredMeta(rawMeta);
  if (meta === undefined) {
    return undefined;
  }
  const pdf = await runObjectStoreTransaction<Uint8Array>(
    db,
    PDF_STORE_BODY_OBJECT_STORE_NAME,
    "readonly",
    (store) => store.get(id),
  );
  if (!(pdf instanceof Uint8Array)) {
    return undefined;
  }
  return { id: meta.id, fileName: meta.fileName, savedAt: meta.savedAt, pdf };
}

async function removeHistoryEntry(db: IDBDatabase, id: string): Promise<void> {
  await runHistoryStoresTransaction(db, "readwrite", (metaStore, bodyStore) => {
    metaStore.delete(id);
    bodyStore.delete(id);
  });
}

async function removeAllHistoryEntries(db: IDBDatabase): Promise<void> {
  await runHistoryStoresTransaction(db, "readwrite", (metaStore, bodyStore) => {
    metaStore.clear();
    bodyStore.clear();
  });
}

async function withDatabase<T>(unavailable: T, run: (db: IDBDatabase) => Promise<T>): Promise<T> {
  if (!isIndexedDbAvailable()) {
    return unavailable;
  }
  try {
    const db = await openPdfStoreDatabase();
    if (db === undefined) {
      return unavailable;
    }
    try {
      return await run(db);
    } finally {
      db.close();
    }
  } catch {
    return unavailable;
  }
}

export function createIndexedDbPdfStore(): PdfStore {
  return {
    async put(entry) {
      await withDatabase(undefined, async (db) => {
        await putHistoryEntry(db, entry);
        return undefined;
      });
    },
    async list() {
      return withDatabase([], async (db) => listHistoryMetas(db));
    },
    async get(id) {
      return withDatabase(undefined, async (db) => getHistoryEntry(db, id));
    },
    async remove(id) {
      await withDatabase(undefined, async (db) => {
        await removeHistoryEntry(db, id);
        return undefined;
      });
    },
    async removeAll() {
      await withDatabase(undefined, async (db) => {
        await removeAllHistoryEntries(db);
        return undefined;
      });
    },
  };
}

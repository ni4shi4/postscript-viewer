import type { PdfStore, PdfStoreEntry } from "../../../core/ports/pdf-store";

const PDF_STORE_DB_NAME = "postscript-viewer-pdf";
const PDF_STORE_OBJECT_STORE_NAME = "pdf";
const PDF_STORE_ENTRY_KEY = "latest";
const PDF_STORE_DB_VERSION = 1;

function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
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
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PDF_STORE_OBJECT_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_OBJECT_STORE_NAME);
      }
    });
    request.addEventListener("success", () => {
      resolve(request.result);
    });
  });
}

function runObjectStoreTransaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(PDF_STORE_OBJECT_STORE_NAME, mode);
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
      request = run(transaction.objectStore(PDF_STORE_OBJECT_STORE_NAME));
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

async function putEntry(db: IDBDatabase, entry: PdfStoreEntry): Promise<void> {
  await runObjectStoreTransaction(db, "readwrite", (store) =>
    store.put(entry, PDF_STORE_ENTRY_KEY),
  );
}

async function getEntry(db: IDBDatabase): Promise<PdfStoreEntry | undefined> {
  const entry = await runObjectStoreTransaction<PdfStoreEntry>(db, "readonly", (store) =>
    store.get(PDF_STORE_ENTRY_KEY),
  );
  if (entry === undefined || entry === null) {
    return undefined;
  }
  if (typeof entry !== "object" || !("fileName" in entry) || !("pdf" in entry)) {
    return undefined;
  }
  const { fileName, pdf } = entry;
  if (typeof fileName !== "string" || !(pdf instanceof Uint8Array)) {
    return undefined;
  }
  return { fileName, pdf };
}

async function deleteEntry(db: IDBDatabase): Promise<void> {
  await runObjectStoreTransaction(db, "readwrite", (store) => store.delete(PDF_STORE_ENTRY_KEY));
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
    async save(entry) {
      await withDatabase(undefined, async (db) => {
        await putEntry(db, entry);
        return undefined;
      });
    },
    async load() {
      return withDatabase(undefined, async (db) => getEntry(db));
    },
    async clear() {
      await withDatabase(undefined, async (db) => {
        await deleteEntry(db);
        return undefined;
      });
    },
  };
}

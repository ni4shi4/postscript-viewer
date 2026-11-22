import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PDF_HISTORY_ENTRIES } from "../../../core/domain/limits";
import type { PdfStoreEntry } from "../../../core/ports/pdf-store";
import { PDF_STORE_MIGRATED_LATEST_ID, createIndexedDbPdfStore } from "./indexeddb-pdf-store";

const PDF_STORE_DB_NAME = "postscript-viewer-pdf";
const PDF_STORE_LEGACY_OBJECT_STORE_NAME = "pdf";
const PDF_STORE_LEGACY_ENTRY_KEY = "latest";

const SAMPLE_PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
const OTHER_PDF = new Uint8Array([37, 80, 68, 70, 45, 50, 46, 48]);

async function deleteAllIndexedDatabases(): Promise<void> {
  const databases = await indexedDB.databases();
  await Promise.all(
    databases.map((info) => {
      if (info.name === undefined) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(info.name!);
        const finish = () => {
          resolve();
        };
        request.addEventListener("success", finish);
        request.addEventListener("error", finish);
        request.addEventListener("blocked", finish);
      });
    }),
  );
}

async function seedVersionOneLatest(entry: PdfStoreEntry): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.open(PDF_STORE_DB_NAME, 1);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PDF_STORE_LEGACY_OBJECT_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_LEGACY_OBJECT_STORE_NAME);
      }
    });
    request.addEventListener("success", () => {
      const db = request.result;
      const transaction = db.transaction(PDF_STORE_LEGACY_OBJECT_STORE_NAME, "readwrite");
      transaction
        .objectStore(PDF_STORE_LEGACY_OBJECT_STORE_NAME)
        .put(entry, PDF_STORE_LEGACY_ENTRY_KEY);
      transaction.addEventListener("complete", () => {
        db.close();
        resolve();
      });
      transaction.addEventListener("error", () => {
        db.close();
        resolve();
      });
      transaction.addEventListener("abort", () => {
        db.close();
        resolve();
      });
    });
    request.addEventListener("error", () => {
      resolve();
    });
  });
}

describe("createIndexedDbPdfStore", () => {
  beforeEach(async () => {
    await deleteAllIndexedDatabases();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists the latest entry across save, load, and clear", async () => {
    const store = createIndexedDbPdfStore();

    await store.save({ fileName: "doc.ps", pdf: SAMPLE_PDF });

    const loaded = await store.load();
    expect(loaded).toEqual({
      fileName: "doc.ps",
      pdf: SAMPLE_PDF,
    });

    await store.save({ fileName: "other.ps", pdf: OTHER_PDF });

    const reloaded = await store.load();
    expect(reloaded).toEqual({
      fileName: "other.ps",
      pdf: OTHER_PDF,
    });

    await store.clear();

    expect(await store.load()).toBeUndefined();
  });

  it("does not throw when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    const store = createIndexedDbPdfStore();

    await expect(store.save({ fileName: "doc.ps", pdf: SAMPLE_PDF })).resolves.toBeUndefined();
    await expect(store.clear()).resolves.toBeUndefined();
    await expect(store.load()).resolves.toBeUndefined();
    await expect(
      store.put({
        id: "a",
        fileName: "a.ps",
        savedAt: 1,
        pdf: SAMPLE_PDF,
      }),
    ).resolves.toBeUndefined();
    await expect(store.list()).resolves.toEqual([]);
    await expect(store.get("a")).resolves.toBeUndefined();
    await expect(store.remove("a")).resolves.toBeUndefined();
    await expect(store.removeAll()).resolves.toBeUndefined();
  });

  it("stores history entries, lists newest first without bodies, and loads by id", async () => {
    const store = createIndexedDbPdfStore();

    await store.put({
      id: "older",
      fileName: "older.ps",
      savedAt: 100,
      pdf: SAMPLE_PDF,
    });
    await store.put({
      id: "newer",
      fileName: "newer.ps",
      savedAt: 200,
      pdf: OTHER_PDF,
    });

    const listed = await store.list();
    expect(listed).toEqual([
      { id: "newer", fileName: "newer.ps", savedAt: 200 },
      { id: "older", fileName: "older.ps", savedAt: 100 },
    ]);
    expect(listed.every((entry) => !("pdf" in entry))).toBe(true);

    expect(await store.get("newer")).toEqual({
      id: "newer",
      fileName: "newer.ps",
      savedAt: 200,
      pdf: OTHER_PDF,
    });

    await store.remove("older");
    expect(await store.list()).toEqual([{ id: "newer", fileName: "newer.ps", savedAt: 200 }]);
    expect(await store.get("older")).toBeUndefined();

    await store.removeAll();
    expect(await store.list()).toEqual([]);
  });

  it("overwrites the same id and evicts oldest entries when over the limit", async () => {
    const store = createIndexedDbPdfStore();
    const pdf = new Uint8Array([1]);

    for (let index = 0; index < MAX_PDF_HISTORY_ENTRIES; index += 1) {
      await store.put({
        id: `entry-${index}`,
        fileName: `file-${index}.ps`,
        savedAt: index,
        pdf,
      });
    }

    await store.put({
      id: "overflow",
      fileName: "overflow.ps",
      savedAt: MAX_PDF_HISTORY_ENTRIES,
      pdf,
    });

    const ids = (await store.list()).map((entry) => entry.id);
    expect(ids).toHaveLength(MAX_PDF_HISTORY_ENTRIES);
    expect(ids).not.toContain("entry-0");
    expect(ids).toContain("overflow");

    await store.put({
      id: "entry-1",
      fileName: "updated.ps",
      savedAt: MAX_PDF_HISTORY_ENTRIES + 1,
      pdf: OTHER_PDF,
    });
    expect(await store.get("entry-1")).toEqual({
      id: "entry-1",
      fileName: "updated.ps",
      savedAt: MAX_PDF_HISTORY_ENTRIES + 1,
      pdf: OTHER_PDF,
    });
  });

  it("evicts by insertion order when savedAt ties", async () => {
    const store = createIndexedDbPdfStore();
    const pdf = new Uint8Array([1]);
    const savedAt = 5_000;

    for (let index = 0; index < MAX_PDF_HISTORY_ENTRIES; index += 1) {
      await store.put({
        id: `tie-${index}`,
        fileName: `tie-${index}.ps`,
        savedAt,
        pdf,
      });
    }

    await store.put({
      id: "tie-overflow",
      fileName: "tie-overflow.ps",
      savedAt,
      pdf,
    });

    const listed = await store.list();
    expect(listed.map((entry) => entry.id)).not.toContain("tie-0");
    expect(listed.map((entry) => entry.id)).toContain("tie-overflow");
  });

  it("migrates a version 1 latest entry into history", async () => {
    await seedVersionOneLatest({ fileName: "legacy.ps", pdf: SAMPLE_PDF });

    const store = createIndexedDbPdfStore();

    const listed = await store.list();
    expect(listed).toEqual([
      {
        id: PDF_STORE_MIGRATED_LATEST_ID,
        fileName: "legacy.ps",
        savedAt: expect.any(Number),
      },
    ]);

    const loaded = await store.get(PDF_STORE_MIGRATED_LATEST_ID);
    expect(loaded).toEqual({
      id: PDF_STORE_MIGRATED_LATEST_ID,
      fileName: "legacy.ps",
      savedAt: listed[0]!.savedAt,
      pdf: SAMPLE_PDF,
    });

    expect(await store.load()).toEqual({ fileName: "legacy.ps", pdf: SAMPLE_PDF });
  });
});

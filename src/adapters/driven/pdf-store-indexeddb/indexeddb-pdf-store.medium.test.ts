import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createIndexedDbPdfStore } from "./indexeddb-pdf-store";

const SAMPLE_PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
const OTHER_PDF = new Uint8Array([37, 80, 68, 70, 45, 50, 46, 48]);

describe("createIndexedDbPdfStore", () => {
  beforeEach(async () => {
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
  });
});

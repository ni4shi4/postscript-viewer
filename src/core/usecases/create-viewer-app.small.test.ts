import { gzip } from "pako";
import { describe, expect, it } from "vitest";

import { ConversionAbortedError } from "../domain/conversion-aborted";
import { ConversionTimeoutError } from "../domain/conversion-timeout";
import {
  MAX_DECOMPRESSED_POSTSCRIPT_BYTES,
  MAX_PDF_HISTORY_ENTRIES,
  MAX_POSTSCRIPT_INPUT_BYTES,
} from "../domain/limits";
import { selectedViewerDocument } from "../state/viewer-state";
import type { ViewerState } from "../state/viewer-state";
import type { PdfStore } from "../ports/pdf-store";
import { createSequentialDocumentIdFactory } from "../testing/fake-create-document-id";
import { createFakePdfStore } from "../testing/fake-pdf-store";
import { createFakePdfViewer } from "../testing/fake-pdf-viewer";
import { createFakePostScriptConverter } from "../testing/fake-postscript-converter";
import { createViewerApp } from "./create-viewer-app";

const POSTSCRIPT_BYTES = new TextEncoder().encode("%!PS-Adobe-3.0\n");
const SAMPLE_PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
const OTHER_PDF = new Uint8Array([37, 80, 68, 70, 45, 50, 46, 48]);

function createTestViewerApp(options?: { now?: () => number; pdfStore?: PdfStore }) {
  const postScriptConverter = createFakePostScriptConverter();
  const pdfViewer = createFakePdfViewer();
  const backingPdfStore = createFakePdfStore();
  const pdfStoreForApp = options?.pdfStore ?? backingPdfStore;
  let time = 0;
  const app = createViewerApp({
    postScriptConverter,
    pdfViewer,
    pdfStore: pdfStoreForApp,
    createDocumentId: createSequentialDocumentIdFactory(),
    now:
      options?.now ??
      (() => {
        time += 1;
        return time;
      }),
  });
  return { app, postScriptConverter, pdfViewer, pdfStore: backingPdfStore };
}

function withGetBlockedOnId(
  pdfStore: ReturnType<typeof createFakePdfStore>,
  blockedId: string,
  blocked: Promise<void>,
): PdfStore {
  const originalGet = pdfStore.get.bind(pdfStore);
  return {
    ...pdfStore,
    async get(id) {
      if (id === blockedId) {
        await blocked;
      }
      return originalGet(id);
    },
  };
}

function hasSessionDocument(state: ViewerState): boolean {
  return state.documents.some(
    (viewerDocument) =>
      viewerDocument.status.kind === "converting" ||
      viewerDocument.status.kind === "error" ||
      viewerDocument.savedAt === undefined,
  );
}

function selectedStatus(app: ReturnType<typeof createViewerApp>) {
  return selectedViewerDocument(app.getState())?.status;
}

function documentFileName(app: ReturnType<typeof createViewerApp>) {
  return selectedViewerDocument(app.getState())?.fileName;
}

function statusKinds(states: ViewerState[]): string[] {
  return states.map((state) => {
    const doc = selectedViewerDocument(state);
    if (doc === undefined) {
      return "none";
    }
    return doc.status.kind;
  });
}

async function waitForConversions(
  postScriptConverter: ReturnType<typeof createFakePostScriptConverter>,
  count: number,
): Promise<void> {
  while (postScriptConverter.getConversions().length < count) {
    await Promise.resolve();
  }
}

describe("createViewerApp", () => {
  it("opens a .ps file, converts to PDF, and shows it in the viewer", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    const openPromise = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });

    await waitForConversions(postScriptConverter, 1);
    expect(selectedStatus(app)?.kind).toBe("converting");
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();

    postScriptConverter.completeAt(0, SAMPLE_PDF);
    await openPromise;

    expect(selectedStatus(app)?.kind).toBe("ready");
    expect(pdfViewer.getDisplayedPdf()).toEqual(SAMPLE_PDF);
    expect(postScriptConverter.getConversions()[0]?.postScript).toEqual(POSTSCRIPT_BYTES);
  });

  it("decompresses .ps.gz and passes expanded bytes to the converter", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();
    const compressed = gzip(POSTSCRIPT_BYTES);

    const openPromise = app.openPostScript({
      fileName: "sample.ps.gz",
      data: compressed,
    });

    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.completeAt(0, SAMPLE_PDF);
    await openPromise;

    expect(selectedStatus(app)?.kind).toBe("ready");
    expect(pdfViewer.getDisplayedPdf()).toEqual(SAMPLE_PDF);
    expect(postScriptConverter.getConversions()[0]?.postScript).toEqual(POSTSCRIPT_BYTES);
  });

  it("rejects an oversize .ps file without calling the converter", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();
    const oversize = new Uint8Array(MAX_POSTSCRIPT_INPUT_BYTES + 1);

    await app.openPostScript({
      fileName: "huge.ps",
      data: oversize,
    });

    expect(selectedStatus(app)).toEqual({
      kind: "error",
      error: { kind: "too-large", limit: "input" },
    });
    expect(postScriptConverter.getConversions()).toHaveLength(0);
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("rejects a small gzip that expands beyond the limit without calling the converter", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();
    const expanded = new Uint8Array(MAX_DECOMPRESSED_POSTSCRIPT_BYTES + 1);
    const compressed = gzip(expanded);

    await app.openPostScript({
      fileName: "bomb.ps.gz",
      data: compressed,
    });

    expect(selectedStatus(app)).toEqual({
      kind: "error",
      error: { kind: "too-large", limit: "decompressed" },
    });
    expect(postScriptConverter.getConversions()).toHaveLength(0);
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("rejects non-gzip content under a .gz name without calling the converter", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    await app.openPostScript({
      fileName: "broken.ps.gz",
      data: POSTSCRIPT_BYTES,
    });

    expect(selectedStatus(app)).toEqual({
      kind: "error",
      error: { kind: "not-gzip" },
    });
    expect(postScriptConverter.getConversions()).toHaveLength(0);
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("enters conversion-failed error state when the converter rejects", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    const openPromise = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });

    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.failAt(0, new Error("Ghostscript failed"));
    await openPromise;

    expect(selectedStatus(app)).toEqual({
      kind: "error",
      error: { kind: "conversion-failed", detail: "Ghostscript failed" },
    });
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("enters timeout error state when the converter rejects with ConversionTimeoutError", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    const openPromise = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });

    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.failAt(0, new ConversionTimeoutError());
    await openPromise;

    expect(selectedStatus(app)).toEqual({
      kind: "error",
      error: { kind: "timeout" },
    });
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("recovers to ready after a failed open when a valid file is opened next", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    const failedOpen = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.failAt(0, new Error("first failure"));
    await failedOpen;

    const recoveryOpen = app.openPostScript({
      fileName: "recovery.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 2);
    postScriptConverter.completeAt(1, SAMPLE_PDF);
    await recoveryOpen;

    expect(selectedStatus(app)?.kind).toBe("ready");
    expect(pdfViewer.getDisplayedPdf()).toEqual(SAMPLE_PDF);
  });

  it("clears the previous PDF while a new file is converting", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    const firstOpen = app.openPostScript({
      fileName: "first.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.completeAt(0, SAMPLE_PDF);
    await firstOpen;
    expect(pdfViewer.getDisplayedPdf()).toEqual(SAMPLE_PDF);

    const secondOpen = app.openPostScript({
      fileName: "second.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 2);
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
    expect(selectedStatus(app)?.kind).toBe("converting");

    postScriptConverter.completeAt(1, OTHER_PDF);
    await secondOpen;

    expect(pdfViewer.getDisplayedPdf()).toEqual(OTHER_PDF);
  });

  it("aborts the previous conversion when another file is opened and ignores its late completion", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    const firstOpen = app.openPostScript({
      fileName: "first.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);

    const secondOpen = app.openPostScript({
      fileName: "second.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 2);
    expect(postScriptConverter.getConversions()[0]?.signal.aborted).toBe(true);
    expect(postScriptConverter.getConversions()).toHaveLength(2);
    expect(documentFileName(app)).toBe("second.ps");

    postScriptConverter.completeAt(0, SAMPLE_PDF);
    postScriptConverter.completeAt(1, OTHER_PDF);
    await firstOpen;
    await secondOpen;

    expect(selectedStatus(app)?.kind).toBe("ready");
    expect(pdfViewer.getDisplayedPdf()).toEqual(OTHER_PDF);
    expect(documentFileName(app)).toBe("second.ps");
  });

  it("cancel clears state and hides the PDF", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    void app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    expect(selectedStatus(app)?.kind).toBe("converting");

    app.cancel();

    expect(app.getState().selectedDocumentId).toBeUndefined();
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();

    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.completeAt(0, SAMPLE_PDF);
    expect(app.getState().selectedDocumentId).toBeUndefined();
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("does not enter error state when the converter rejects with ConversionAbortedError", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    const openPromise = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });

    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.failAt(0, new ConversionAbortedError());
    await openPromise;

    expect(selectedStatus(app)?.kind).toBe("converting");
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("notifies subscribers of state transitions and stops after unsubscribe", async () => {
    const { app, postScriptConverter } = createTestViewerApp();
    const received: ViewerState[] = [];

    const unsubscribe = app.subscribe((state) => {
      received.push(state);
    });

    const openPromise = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.completeAt(0, SAMPLE_PDF);
    await openPromise;

    expect(statusKinds(received)).toEqual(["none", "converting", "converting", "ready"]);

    unsubscribe();
    const lengthAfterUnsubscribe = received.length;

    const ignoredOpen = app.openPostScript({
      fileName: "another.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 2);
    postScriptConverter.completeAt(1, OTHER_PDF);
    await ignoredOpen;

    expect(received).toHaveLength(lengthAfterUnsubscribe);
  });

  it("persists the converted PDF when conversion succeeds", async () => {
    const { app, postScriptConverter, pdfStore } = createTestViewerApp();

    const openPromise = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.completeAt(0, SAMPLE_PDF);
    await openPromise;

    const metas = await pdfStore.list();
    expect(metas).toHaveLength(1);
    const entry = await pdfStore.get(metas[0]!.id);
    expect(entry).toEqual({
      id: "doc-1",
      fileName: "sample.ps",
      savedAt: 1,
      pdf: SAMPLE_PDF,
    });
  });

  it("keeps history when conversion fails", async () => {
    const { app, postScriptConverter, pdfStore } = createTestViewerApp();

    await pdfStore.put({ id: "doc-old", fileName: "old.ps", savedAt: 1, pdf: SAMPLE_PDF });

    const openPromise = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.failAt(0, new Error("conversion failed"));
    await openPromise;

    const metas = await pdfStore.list();
    expect(metas).toEqual([{ id: "doc-old", fileName: "old.ps", savedAt: 1 }]);
  });

  it("restores and shows a persisted PDF", async () => {
    const { app, pdfViewer, pdfStore } = createTestViewerApp();
    await pdfStore.put({ id: "doc-saved", fileName: "saved.ps", savedAt: 5, pdf: SAMPLE_PDF });

    await app.restore();

    expect(selectedStatus(app)?.kind).toBe("ready");
    expect(documentFileName(app)).toBe("saved.ps");
    expect(pdfViewer.getDisplayedPdf()).toEqual(SAMPLE_PDF);
  });

  it("does nothing on restore when no PDF is persisted", async () => {
    const { app, pdfViewer } = createTestViewerApp();

    await app.restore();

    expect(app.getState().selectedDocumentId).toBeUndefined();
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("prioritizes a new conversion started during restore", async () => {
    const { app, postScriptConverter, pdfViewer, pdfStore } = createTestViewerApp();
    await pdfStore.put({ id: "doc-saved", fileName: "saved.ps", savedAt: 1, pdf: SAMPLE_PDF });

    let releaseList: (() => void) | undefined;
    const listBlocked = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    pdfStore.setListDelay(() => listBlocked);

    const restorePromise = app.restore();

    const openPromise = app.openPostScript({
      fileName: "new.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);

    releaseList!();
    await restorePromise;

    postScriptConverter.completeAt(0, OTHER_PDF);
    await openPromise;

    expect(documentFileName(app)).toBe("new.ps");
    expect(pdfViewer.getDisplayedPdf()).toEqual(OTHER_PDF);
  });

  it("does not keep a late save after cancel", async () => {
    const { app, postScriptConverter, pdfStore } = createTestViewerApp();

    let releaseSave: (() => void) | undefined;
    const saveBlocked = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    pdfStore.setSaveDelay(() => saveBlocked);

    void app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.completeAt(0, SAMPLE_PDF);
    await Promise.resolve();

    app.cancel();
    releaseSave!();
    await Promise.resolve();
    await Promise.resolve();

    expect(await pdfStore.list()).toHaveLength(0);
  });

  it("selects a history entry and shows its PDF", async () => {
    const { app, pdfViewer, pdfStore } = createTestViewerApp();

    await pdfStore.put({ id: "doc-a", fileName: "a.ps", savedAt: 1, pdf: SAMPLE_PDF });
    await pdfStore.put({ id: "doc-b", fileName: "b.ps", savedAt: 2, pdf: OTHER_PDF });

    await app.selectDocument("doc-a");

    expect(documentFileName(app)).toBe("a.ps");
    expect(pdfViewer.getDisplayedPdf()).toEqual(SAMPLE_PDF);
    expect(app.getState().selectedDocumentId).toBe("doc-a");
  });

  it("does nothing when selecting a missing history id", async () => {
    const { app, postScriptConverter, pdfViewer } = createTestViewerApp();

    void app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    expect(selectedStatus(app)?.kind).toBe("converting");

    await app.selectDocument("missing");

    expect(selectedStatus(app)?.kind).toBe("converting");
    expect(postScriptConverter.getConversions()[0]?.signal.aborted).toBe(false);
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("keeps the latest selection when two history entries are selected in quick succession", async () => {
    const pdfStore = createFakePdfStore();
    await pdfStore.put({ id: "doc-a", fileName: "a.ps", savedAt: 1, pdf: SAMPLE_PDF });
    await pdfStore.put({ id: "doc-b", fileName: "b.ps", savedAt: 2, pdf: OTHER_PDF });

    let releaseFirstGet: (() => void) | undefined;
    const firstGetBlocked = new Promise<void>((resolve) => {
      releaseFirstGet = resolve;
    });
    const delayedStore = withGetBlockedOnId(pdfStore, "doc-a", firstGetBlocked);

    const { app, pdfViewer } = createTestViewerApp({ pdfStore: delayedStore });

    const firstSelect = app.selectDocument("doc-a");
    await Promise.resolve();
    const secondSelect = app.selectDocument("doc-b");
    releaseFirstGet!();
    await firstSelect;
    await secondSelect;

    expect(documentFileName(app)).toBe("b.ps");
    expect(pdfViewer.getDisplayedPdf()).toEqual(OTHER_PDF);
    expect(app.getState().selectedDocumentId).toBe("doc-b");
  });

  it("removes the converting session document when a history entry is selected", async () => {
    const { app, postScriptConverter, pdfStore, pdfViewer } = createTestViewerApp();

    await pdfStore.put({ id: "doc-a", fileName: "a.ps", savedAt: 1, pdf: SAMPLE_PDF });

    void app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    expect(selectedStatus(app)?.kind).toBe("converting");
    expect(hasSessionDocument(app.getState())).toBe(true);

    await app.selectDocument("doc-a");

    expect(hasSessionDocument(app.getState())).toBe(false);
    expect(documentFileName(app)).toBe("a.ps");
    expect(pdfViewer.getDisplayedPdf()).toEqual(SAMPLE_PDF);
    expect(postScriptConverter.getConversions()[0]?.signal.aborted).toBe(true);
  });

  it("deletes a history entry and clears the viewer when it was selected", async () => {
    const { app, pdfViewer, pdfStore } = createTestViewerApp();
    await pdfStore.put({ id: "doc-a", fileName: "a.ps", savedAt: 1, pdf: SAMPLE_PDF });

    await app.restore();
    expect(pdfViewer.getDisplayedPdf()).toEqual(SAMPLE_PDF);

    await app.deleteDocument("doc-a");

    expect(await pdfStore.list()).toHaveLength(0);
    expect(app.getState().selectedDocumentId).toBeUndefined();
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });

  it("does not delete a converting document", async () => {
    const { app, postScriptConverter } = createTestViewerApp();

    void app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);

    const documentId = app.getState().selectedDocumentId;
    expect(documentId).toBeDefined();

    await app.deleteDocument(documentId!);

    expect(selectedStatus(app)?.kind).toBe("converting");
  });

  it("clears history but keeps an in-flight conversion", async () => {
    const { app, postScriptConverter, pdfStore } = createTestViewerApp();
    await pdfStore.put({ id: "doc-old", fileName: "old.ps", savedAt: 1, pdf: SAMPLE_PDF });

    void app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    expect(selectedStatus(app)?.kind).toBe("converting");

    await app.clearHistory();

    expect(await pdfStore.list()).toHaveLength(0);
    expect(app.getState().documents).toHaveLength(1);
    expect(selectedStatus(app)?.kind).toBe("converting");
    expect(postScriptConverter.getConversions()[0]?.signal.aborted).toBe(false);
  });

  it("evicts the oldest history entry when an eleventh PDF is saved", async () => {
    const { app, postScriptConverter, pdfStore } = createTestViewerApp();

    for (let index = 0; index < MAX_PDF_HISTORY_ENTRIES; index += 1) {
      const openPromise = app.openPostScript({
        fileName: `file-${index}.ps`,
        data: POSTSCRIPT_BYTES,
      });
      await waitForConversions(postScriptConverter, index + 1);
      postScriptConverter.completeAt(index, SAMPLE_PDF);
      await openPromise;
    }

    const openPromise = app.openPostScript({
      fileName: "latest.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, MAX_PDF_HISTORY_ENTRIES + 1);
    postScriptConverter.completeAt(MAX_PDF_HISTORY_ENTRIES, OTHER_PDF);
    await openPromise;

    const metas = await pdfStore.list();
    expect(metas).toHaveLength(MAX_PDF_HISTORY_ENTRIES);
    expect(metas.some((meta) => meta.fileName === "file-0.ps")).toBe(false);
    expect(metas[0]?.fileName).toBe("latest.ps");
  });

  it("keeps history after cancel", async () => {
    const { app, postScriptConverter, pdfStore, pdfViewer } = createTestViewerApp();

    const openPromise = app.openPostScript({
      fileName: "sample.ps",
      data: POSTSCRIPT_BYTES,
    });
    await waitForConversions(postScriptConverter, 1);
    postScriptConverter.completeAt(0, SAMPLE_PDF);
    await openPromise;

    app.cancel();

    const metas = await pdfStore.list();
    expect(metas).toHaveLength(1);
    expect(app.getState().selectedDocumentId).toBeUndefined();
    expect(pdfViewer.getDisplayedPdf()).toBeUndefined();
  });
});

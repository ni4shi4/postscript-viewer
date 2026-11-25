// @vitest-environment jsdom

import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerError, ViewerState } from "../../../core/state/viewer-state";
import { App } from "./static-shell";
import { queryViewerDom } from "./viewer-ui";

const CONVERSION_PROGRESS = { kind: "started" as const };

type OpenPostScriptCall = { fileName: string; data: Uint8Array };

type FakeViewerApp = ViewerApp & {
  replaceState(state: ViewerState): void;
  getOpenPostScriptCalls(): readonly OpenPostScriptCall[];
  getReadReadyPdfCalls(): readonly string[];
};

function mountViewerAppUi(app: FakeViewerApp): void {
  document.body.replaceChildren();
  const mount = document.createElement("div");
  mount.id = "mount-app";
  document.body.append(mount);
  act(() => {
    render(h(App, { app }), mount);
  });
}

function replaceViewerState(app: FakeViewerApp, state: ViewerState): void {
  act(() => {
    app.replaceState(state);
  });
}

function createFakeViewerApp(
  initial: ViewerState = { documents: [], selectedDocumentId: undefined },
): FakeViewerApp {
  let state = initial;
  const listeners = new Set<(next: ViewerState) => void>();
  const openCalls: OpenPostScriptCall[] = [];
  const readReadyPdfCalls: string[] = [];

  const replaceState = (next: ViewerState): void => {
    state = next;
    for (const listener of listeners) {
      listener(state);
    }
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    replaceState(next) {
      state = next;
      for (const listener of listeners) {
        listener(state);
      }
    },
    async openPostScript(input) {
      openCalls.push({ fileName: input.fileName, data: input.data });
    },
    async restore() {},
    cancel() {},
    closeDocument() {
      replaceState({ ...state, selectedDocumentId: undefined });
    },
    async selectDocument() {},
    async deleteDocument() {},
    async clearHistory() {},
    async readReadyPdf(id) {
      readReadyPdfCalls.push(id);
      const document = state.documents.find((candidate) => candidate.id === id);
      return document === undefined
        ? undefined
        : { fileName: document.fileName, pdf: new Uint8Array([37, 80, 68, 70]) };
    },
    getReadReadyPdfCalls: () => readReadyPdfCalls,
    getOpenPostScriptCalls: () => openCalls,
  };
}

function documentState(
  id: string,
  fileName: string,
  status: { kind: "converting" } | { kind: "ready" } | { kind: "error"; error: ViewerError },
): ViewerState {
  const viewerStatus =
    status.kind === "converting"
      ? { kind: "converting" as const, progress: CONVERSION_PROGRESS }
      : status.kind === "ready"
        ? { kind: "ready" as const }
        : { kind: "error" as const, error: status.error };

  return {
    documents: [{ id, fileName, status: viewerStatus }],
    selectedDocumentId: id,
  };
}

function queryStatusPanel(): HTMLParagraphElement {
  const panel = document.querySelector<HTMLParagraphElement>('[data-testid="viewer-status"]');
  if (panel === null) {
    throw new Error("viewer status is missing");
  }
  return panel;
}

function queryDropCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('[data-testid="drop-card"]');
  if (card === null) {
    throw new Error("drop card is missing");
  }
  return card;
}

function queryFileNameDisplay(): HTMLParagraphElement {
  const display = document.querySelector<HTMLParagraphElement>('[data-testid="viewer-file-name"]');
  if (display === null) {
    throw new Error("viewer file name display is missing");
  }
  return display;
}

async function fileWithBytes(name: string, bytes: Uint8Array): Promise<File> {
  const copy = new Uint8Array(bytes);
  if (typeof File !== "undefined") {
    const file = new File([copy], name);
    if (typeof file.arrayBuffer === "function") {
      return file;
    }
  }
  return {
    name,
    async arrayBuffer() {
      return copy.buffer;
    },
  } as File;
}

function createFileList(file: File): FileList {
  const fileList = {
    0: file,
    length: 1,
    item(index: number) {
      return index === 0 ? file : null;
    },
    *[Symbol.iterator]() {
      yield file;
    },
  };
  return fileList as FileList;
}

function dispatchFileSelection(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: createFileList(file),
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>((resolve) => {
    queueMicrotask(() => queueMicrotask(resolve));
  });
}

function querySurface(): HTMLElement {
  const surface = document.querySelector<HTMLElement>('[data-testid="viewer-surface"]');
  if (surface === null) {
    throw new Error("viewer surface is missing");
  }
  return surface;
}

function dispatchDrag(
  target: Element,
  type: "dragenter" | "dragover" | "dragleave" | "drop",
  files: readonly File[] = [],
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types: ["Files"], files },
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("viewer app UI", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("hides the status panel when no document is selected", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    const status = queryStatusPanel();
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe("");
  });

  it("shows a non-empty status while converting", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(app, documentState("d1", "sample.ps", { kind: "converting" }));

    const status = queryStatusPanel();
    expect(status.hidden).toBe(false);
    expect(status.textContent).not.toBe("");
  });

  it("hides the status panel when the document is ready", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(app, documentState("d1", "sample.ps", { kind: "ready" }));

    const status = queryStatusPanel();
    expect(status.hidden).toBe(true);
  });

  it("shows the configured limit for input too-large errors", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(
      app,
      documentState("d1", "huge.ps", {
        kind: "error",
        error: { kind: "too-large", limit: "input" },
      }),
    );

    const status = queryStatusPanel();
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain("32 MiB");
    expect(status.textContent).toContain("ファイルサイズ");
  });

  it("shows the configured limit for decompressed too-large errors", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(
      app,
      documentState("d1", "bomb.ps.gz", {
        kind: "error",
        error: { kind: "too-large", limit: "decompressed" },
      }),
    );

    const status = queryStatusPanel();
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain("32 MiB");
    expect(status.textContent).toContain("展開後");
  });

  it("shows the configured limit for timeout errors", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(
      app,
      documentState("d1", "sample.ps", {
        kind: "error",
        error: { kind: "timeout" },
      }),
    );

    const status = queryStatusPanel();
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain("60 秒");
    expect(status.textContent).toContain("制限時間");
  });

  it("shows a gzip-related message for not-gzip errors", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(
      app,
      documentState("d1", "bad.ps.gz", { kind: "error", error: { kind: "not-gzip" } }),
    );

    const status = queryStatusPanel();
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain("gzip");
  });

  it("shows conversion error detail in the status panel", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);
    const detail = "Ghostscript exited with status 1";

    replaceViewerState(
      app,
      documentState("d1", "sample.ps", {
        kind: "error",
        error: { kind: "conversion-failed", detail },
      }),
    );

    const status = queryStatusPanel();
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain(detail);
  });

  it("clears an error status when the document becomes ready", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(
      app,
      documentState("d1", "sample.ps", {
        kind: "error",
        error: { kind: "conversion-failed", detail: "failed" },
      }),
    );
    replaceViewerState(app, documentState("d1", "sample.ps", { kind: "ready" }));

    const status = queryStatusPanel();
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe("");
  });

  it("shows the drop card when no document is selected", () => {
    mountViewerAppUi(createFakeViewerApp());

    expect(queryDropCard().hidden).toBe(false);
  });

  it("shows the converting message and file name inside the drop card", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(app, documentState("d1", "sample.ps", { kind: "converting" }));

    const card = queryDropCard();
    expect(card.hidden).toBe(false);
    expect(card.contains(queryStatusPanel())).toBe(true);
    expect(card.contains(queryFileNameDisplay())).toBe(true);
    expect(queryStatusPanel().textContent).toContain("変換しています");
  });

  it("shows the error message and file name inside the drop card", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(
      app,
      documentState("d1", "bad.ps", {
        kind: "error",
        error: { kind: "conversion-failed", detail: "failed" },
      }),
    );

    const card = queryDropCard();
    expect(card.hidden).toBe(false);
    expect(card.contains(queryStatusPanel())).toBe(true);
    expect(queryStatusPanel().textContent).toBe("failed");
    expect(queryFileNameDisplay().textContent).toBe("bad.ps");
  });

  it("hides the drop card while the selected document is ready and shows it again after clearing", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(app, documentState("d1", "ready.ps", { kind: "ready" }));
    expect(queryDropCard().hidden).toBe(true);

    replaceViewerState(app, { documents: [], selectedDocumentId: undefined });
    expect(queryDropCard().hidden).toBe(false);
  });

  it("hides the file name display when no document is selected", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    const fileNameDisplay = queryFileNameDisplay();
    expect(fileNameDisplay.hidden).toBe(true);
    expect(fileNameDisplay.textContent).toBe("");
  });

  it("shows the selected file name while converting", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(app, documentState("d1", "sample.ps", { kind: "converting" }));

    const fileNameDisplay = queryFileNameDisplay();
    expect(fileNameDisplay.hidden).toBe(false);
    expect(fileNameDisplay.textContent).toBe("sample.ps");
  });

  it("shows the selected file name when the document is ready", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(app, documentState("d1", "ready.ps", { kind: "ready" }));

    const fileNameDisplay = queryFileNameDisplay();
    expect(fileNameDisplay.hidden).toBe(false);
    expect(fileNameDisplay.textContent).toBe("ready.ps");
  });

  it("shows the selected file name when the document has an error", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(
      app,
      documentState("d1", "bad.ps", {
        kind: "error",
        error: { kind: "conversion-failed", detail: "failed" },
      }),
    );

    const fileNameDisplay = queryFileNameDisplay();
    expect(fileNameDisplay.hidden).toBe(false);
    expect(fileNameDisplay.textContent).toBe("bad.ps");
  });

  it("clears the file name display when the document is cleared", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(app, documentState("d1", "sample.ps", { kind: "ready" }));
    replaceViewerState(app, { documents: [], selectedDocumentId: undefined });

    const fileNameDisplay = queryFileNameDisplay();
    expect(fileNameDisplay.hidden).toBe(true);
    expect(fileNameDisplay.textContent).toBe("");
  });

  it("keeps the file name visible after the file input is reset", async () => {
    const app = createFakeViewerApp();
    const bytes = new Uint8Array([37, 33, 80, 83]);
    const originalOpenPostScript = app.openPostScript.bind(app);
    app.openPostScript = async (input) => {
      await originalOpenPostScript(input);
      replaceViewerState(app, documentState("d1", input.fileName, { kind: "converting" }));
    };
    mountViewerAppUi(app);
    const dom = queryViewerDom();
    const file = await fileWithBytes("demo.ps", bytes);

    await act(async () => {
      dispatchFileSelection(dom.fileInput, file);
      await flushAsyncWork();
    });

    expect(dom.fileInput.value).toBe("");
    const fileNameDisplay = queryFileNameDisplay();
    expect(fileNameDisplay.hidden).toBe(false);
    expect(fileNameDisplay.textContent).toBe("demo.ps");
  });

  it("forwards selected files to the viewer app and resets the input", async () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);
    const dom = queryViewerDom();
    const bytes = new Uint8Array([37, 33, 80, 83]);
    const file = await fileWithBytes("demo.ps", bytes);

    await act(async () => {
      dispatchFileSelection(dom.fileInput, file);
      await flushAsyncWork();
    });

    const calls = app.getOpenPostScriptCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.fileName).toBe("demo.ps");
    expect(calls[0]?.data).toEqual(bytes);
    expect(dom.fileInput.value).toBe("");
  });

  describe("file drop", () => {
    it("highlights the surface while files are dragged over it and clears it on leave", () => {
      mountViewerAppUi(createFakeViewerApp());
      const surface = querySurface();
      expect(surface.hasAttribute("data-dragging")).toBe(false);

      dispatchDrag(surface, "dragenter");
      expect(surface.hasAttribute("data-dragging")).toBe(true);

      dispatchDrag(surface, "dragleave");
      expect(surface.hasAttribute("data-dragging")).toBe(false);
    });

    it("keeps the highlight when the pointer moves between child elements", () => {
      mountViewerAppUi(createFakeViewerApp());
      const surface = querySurface();
      const card = queryDropCard();

      dispatchDrag(surface, "dragenter");
      dispatchDrag(card, "dragenter");
      dispatchDrag(surface, "dragleave");

      expect(surface.hasAttribute("data-dragging")).toBe(true);

      dispatchDrag(card, "dragleave");
      expect(surface.hasAttribute("data-dragging")).toBe(false);
    });

    it("shows the drop overlay only while a PDF is displayed", () => {
      const app = createFakeViewerApp();
      mountViewerAppUi(app);
      const surface = querySurface();

      dispatchDrag(surface, "dragenter");
      expect(document.querySelector<HTMLElement>('[data-testid="drop-overlay"]')?.hidden).toBe(
        true,
      );
      dispatchDrag(surface, "dragleave");

      replaceViewerState(app, documentState("d1", "ready.ps", { kind: "ready" }));
      dispatchDrag(surface, "dragenter");
      const overlay = document.querySelector<HTMLElement>('[data-testid="drop-overlay"]');
      expect(overlay?.hidden).toBe(false);
      expect(overlay?.textContent).toContain("ここにドロップして変換");
    });

    it("starts a conversion with the first dropped file and clears the highlight", async () => {
      const app = createFakeViewerApp();
      const originalOpenPostScript = app.openPostScript.bind(app);
      app.openPostScript = async (input) => {
        await originalOpenPostScript(input);
        replaceViewerState(app, documentState("d1", input.fileName, { kind: "converting" }));
      };
      mountViewerAppUi(app);
      const surface = querySurface();
      const bytes = new Uint8Array([37, 33, 80, 83]);
      const first = await fileWithBytes("dropped.ps", bytes);
      const second = await fileWithBytes("other.ps", bytes);

      dispatchDrag(surface, "dragenter");
      let dropEvent: Event | undefined;
      await act(async () => {
        dropEvent = dispatchDrag(surface, "drop", [first, second]);
        await flushAsyncWork();
      });

      expect(dropEvent?.defaultPrevented).toBe(true);
      expect(surface.hasAttribute("data-dragging")).toBe(false);
      expect(queryFileNameDisplay().textContent).toBe("dropped.ps");
      expect(queryStatusPanel().textContent).toContain("変換しています");
      expect(app.getOpenPostScriptCalls()).toHaveLength(1);
    });

    it("also accepts drops while a PDF is displayed", async () => {
      const app = createFakeViewerApp();
      const originalOpenPostScript = app.openPostScript.bind(app);
      app.openPostScript = async (input) => {
        await originalOpenPostScript(input);
        replaceViewerState(app, documentState("d2", input.fileName, { kind: "converting" }));
      };
      mountViewerAppUi(app);
      replaceViewerState(app, documentState("d1", "ready.ps", { kind: "ready" }));
      const file = await fileWithBytes("next.ps", new Uint8Array([37, 33]));

      await act(async () => {
        dispatchDrag(querySurface(), "drop", [file]);
        await flushAsyncWork();
      });

      expect(queryFileNameDisplay().textContent).toBe("next.ps");
    });

    it("hides the drop heading while converting", () => {
      const app = createFakeViewerApp();
      mountViewerAppUi(app);
      const heading = queryDropCard().querySelector<HTMLElement>("h2");
      expect(heading?.hidden).toBe(false);

      replaceViewerState(app, documentState("d1", "sample.ps", { kind: "converting" }));
      expect(heading?.hidden).toBe(true);
    });
  });
});

function barVisible(): boolean {
  const bar = document.querySelector<HTMLElement>('[data-testid="document-bar"]');
  return bar !== null && !bar.hidden;
}

describe("document bar", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is not shown while the drop card is shown", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);
    expect(barVisible()).toBe(false);

    replaceViewerState(app, documentState("d1", "sample.ps", { kind: "converting" }));
    expect(barVisible()).toBe(false);
  });

  it("shows the file name and a download button named after the PDF when a document is ready", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);

    replaceViewerState(app, documentState("d1", "with-text.ps.gz", { kind: "ready" }));

    expect(barVisible()).toBe(true);
    const name = document.querySelector<HTMLElement>('[data-testid="document-bar-file-name"]');
    expect(name?.textContent).toBe("with-text.ps.gz");
    expect(name?.title).toBe("with-text.ps.gz");
    const button = document.querySelector<HTMLButtonElement>('[data-testid="download-pdf"]');
    expect(button?.getAttribute("aria-label")).toBe("with-text.pdf をダウンロード");
    expect(button?.textContent).toContain("ダウンロード");
  });

  it("downloads the selected document as a PDF when the button is pressed", async () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);
    replaceViewerState(app, documentState("d1", "with-text.ps", { kind: "ready" }));

    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="download-pdf"]')?.click();
      await flushAsyncWork();
    });

    expect(app.getReadReadyPdfCalls()).toEqual(["d1"]);
    expect(downloads).toEqual(["with-text.pdf"]);
  });

  it("disappears when the document is closed", () => {
    const app = createFakeViewerApp();
    mountViewerAppUi(app);
    replaceViewerState(app, documentState("d1", "with-text.ps", { kind: "ready" }));
    expect(barVisible()).toBe(true);

    act(() => {
      app.closeDocument();
    });

    expect(barVisible()).toBe(false);
  });
});

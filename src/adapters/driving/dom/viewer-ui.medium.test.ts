// @vitest-environment jsdom

import { h, render } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerError, ViewerState } from "../../../core/state/viewer-state";
import { App } from "./static-shell";
import { queryViewerDom } from "./viewer-ui";

const CONVERSION_PROGRESS = { kind: "started" as const };

type OpenPostScriptCall = { fileName: string; data: Uint8Array };

type FakeViewerApp = ViewerApp & {
  replaceState(state: ViewerState): void;
  getOpenPostScriptCalls(): readonly OpenPostScriptCall[];
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
    async selectDocument() {},
    async deleteDocument() {},
    async clearHistory() {},
    async readReadyPdf() {
      return undefined;
    },
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
});

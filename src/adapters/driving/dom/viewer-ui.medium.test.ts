// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it } from "vitest";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerError, ViewerState } from "../../../core/state/viewer-state";
import { queryViewerDom, startViewerDomUi } from "./viewer-ui";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const CONVERSION_PROGRESS = { kind: "started" as const };

type OpenPostScriptCall = { fileName: string; data: Uint8Array };

type FakeViewerApp = ViewerApp & {
  replaceState(state: ViewerState): void;
  getOpenPostScriptCalls(): readonly OpenPostScriptCall[];
};

function loadIndexBody(): void {
  const indexHtml = readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(indexHtml);
  if (bodyMatch === null) {
    throw new Error("index.html body not found");
  }
  document.body.innerHTML = bodyMatch[1];
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
    cancel() {},
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

describe("startViewerDomUi", () => {
  beforeEach(() => {
    loadIndexBody();
  });

  it("hides the status panel when no document is selected", () => {
    const app = createFakeViewerApp();
    const dom = queryViewerDom();
    startViewerDomUi(dom, app);

    const status = queryStatusPanel();
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe("");
  });

  it("shows a non-empty status while converting", () => {
    const app = createFakeViewerApp();
    const dom = queryViewerDom();
    startViewerDomUi(dom, app);

    app.replaceState(documentState("d1", "sample.ps", { kind: "converting" }));

    const status = queryStatusPanel();
    expect(status.hidden).toBe(false);
    expect(status.textContent).not.toBe("");
  });

  it("hides the status panel when the document is ready", () => {
    const app = createFakeViewerApp();
    const dom = queryViewerDom();
    startViewerDomUi(dom, app);

    app.replaceState(documentState("d1", "sample.ps", { kind: "ready" }));

    const status = queryStatusPanel();
    expect(status.hidden).toBe(true);
  });

  it("shows a gzip-related message for not-gzip errors", () => {
    const app = createFakeViewerApp();
    const dom = queryViewerDom();
    startViewerDomUi(dom, app);

    app.replaceState(
      documentState("d1", "bad.ps.gz", { kind: "error", error: { kind: "not-gzip" } }),
    );

    const status = queryStatusPanel();
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain("gzip");
  });

  it("shows conversion error detail in the status panel", () => {
    const app = createFakeViewerApp();
    const dom = queryViewerDom();
    startViewerDomUi(dom, app);
    const detail = "Ghostscript exited with status 1";

    app.replaceState(
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
    const dom = queryViewerDom();
    startViewerDomUi(dom, app);

    app.replaceState(
      documentState("d1", "sample.ps", {
        kind: "error",
        error: { kind: "conversion-failed", detail: "failed" },
      }),
    );
    app.replaceState(documentState("d1", "sample.ps", { kind: "ready" }));

    const status = queryStatusPanel();
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe("");
  });

  it("forwards selected files to the viewer app and resets the input", async () => {
    const app = createFakeViewerApp();
    const dom = queryViewerDom();
    startViewerDomUi(dom, app);
    const bytes = new Uint8Array([37, 33, 80, 83]);
    const file = await fileWithBytes("demo.ps", bytes);

    dispatchFileSelection(dom.fileInput, file);
    await flushAsyncWork();

    const calls = app.getOpenPostScriptCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.fileName).toBe("demo.ps");
    expect(calls[0]?.data).toEqual(bytes);
    expect(dom.fileInput.value).toBe("");
  });
});

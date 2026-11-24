// @vitest-environment jsdom

import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import { createSequentialDocumentIdFactory } from "../../../core/testing/fake-create-document-id";
import { createFakePdfStore } from "../../../core/testing/fake-pdf-store";
import { createFakePdfViewer } from "../../../core/testing/fake-pdf-viewer";
import { createFakePostScriptConverter } from "../../../core/testing/fake-postscript-converter";
import { createViewerApp } from "../../../core/usecases/create-viewer-app";
import type { ViewerState } from "../../../core/state/viewer-state";
import { App } from "./static-shell";

const DESCRIPTION = "PostScript ファイルをブラウザ内で PDF に変換して表示します";
const EMPTY: ViewerState = { documents: [], selectedDocumentId: undefined };

type Fake = ViewerApp & { replaceState(state: ViewerState): void; selectCalls: string[] };

function createFakeViewerApp(initial: ViewerState = EMPTY): Fake {
  let state = initial;
  const listeners = new Set<(next: ViewerState) => void>();
  const selectCalls: string[] = [];
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
    async openPostScript() {},
    async restore() {},
    cancel() {},
    closeDocument() {},
    async selectDocument(id) {
      selectCalls.push(id);
    },
    async deleteDocument() {},
    async clearHistory() {},
    selectCalls,
  };
}

// matchMedia はブラウザという外部境界。幅の判定結果だけをスタブする。
function stubViewportWidth(compact: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: compact && query === "(max-width: 480px)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function mountApp(app: Fake): void {
  document.body.replaceChildren();
  const mount = document.createElement("div");
  mount.id = "mount-app";
  document.body.append(mount);
  act(() => {
    render(h(App, { app }), mount);
  });
}

function setState(app: Fake, state: ViewerState): void {
  act(() => {
    app.replaceState(state);
  });
}

function history(selected: boolean): ViewerState {
  return {
    documents: [
      { id: "a", fileName: "a.ps", savedAt: 2, status: { kind: "ready" } },
      { id: "b", fileName: "b.ps", savedAt: 1, status: { kind: "ready" } },
    ],
    selectedDocumentId: selected ? "a" : undefined,
  };
}

function byTestId(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

function click(id: string): void {
  act(() => {
    byTestId(id)?.click();
  });
}

function pressEscape(): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
}

describe("compact viewport history bottom sheet", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.localStorage.clear();
    stubViewportWidth(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the description under the title only while no PDF is displayed", () => {
    const app = createFakeViewerApp();
    mountApp(app);
    expect(document.querySelector("header")?.textContent).toContain(DESCRIPTION);

    setState(app, history(false));
    expect(document.querySelector("header")?.textContent).toContain(DESCRIPTION);

    setState(app, history(true));
    expect(document.querySelector("header")?.textContent).not.toContain(DESCRIPTION);
  });

  it("shows the history button only with history and the convert button only with a PDF", () => {
    const app = createFakeViewerApp();
    mountApp(app);
    expect(byTestId("history-sheet-button")).toBeNull();
    expect(byTestId("compact-convert")).toBeNull();

    setState(app, history(false));
    expect(byTestId("history-sheet-button")?.textContent).toContain("履歴");
    expect(byTestId("compact-convert")).toBeNull();

    setState(app, history(true));
    expect(byTestId("compact-convert")?.textContent).toContain("変換");
    const buttons = Array.from(document.querySelectorAll("header button"));
    expect(buttons.map((b) => b.getAttribute("data-testid"))).toEqual([
      "history-sheet-button",
      "compact-convert",
    ]);
  });

  it("does not render the sidebar or rail", () => {
    const app = createFakeViewerApp(history(true));
    mountApp(app);

    expect(byTestId("history-sidebar")).toBeNull();
    expect(byTestId("history-toggle")).toBeNull();
  });

  it("returns to the drop card from the convert button without opening the picker, keeping the history", async () => {
    const pdfStore = createFakePdfStore();
    await pdfStore.put({
      id: "a",
      fileName: "a.ps",
      savedAt: 1,
      pdf: new Uint8Array([37, 80, 68, 70]),
    });
    const app = createViewerApp({
      postScriptConverter: createFakePostScriptConverter(),
      pdfViewer: createFakePdfViewer(),
      pdfStore,
      createDocumentId: createSequentialDocumentIdFactory(),
      now: () => 2,
    });
    document.body.replaceChildren();
    const mount = document.createElement("div");
    mount.id = "mount-app";
    document.body.append(mount);
    await act(async () => {
      render(h(App, { app }), mount);
      await app.restore();
    });
    let opens = 0;
    byTestId("file-input")?.addEventListener("click", () => {
      opens += 1;
    });
    expect(byTestId("drop-card")?.hidden).toBe(true);

    byTestId("compact-convert")?.focus();
    click("compact-convert");

    expect(byTestId("drop-card")?.hidden).toBe(false);
    expect(byTestId("compact-convert")).toBeNull();
    expect(byTestId("history-sheet-button")).not.toBeNull();
    expect(byTestId("history-sheet")).toBeNull();
    const pickButton = Array.from(byTestId("drop-card")?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === "ファイルを選択",
    );
    expect(document.activeElement).toBe(pickButton);
    expect(opens).toBe(0);

    click("history-sheet-button");
    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(1);
  });

  it("opens a modal dialog with the history list and focus inside, without the convert-another button", () => {
    const app = createFakeViewerApp(history(true));
    mountApp(app);
    expect(byTestId("history-sheet")).toBeNull();

    click("history-sheet-button");
    const sheet = byTestId("history-sheet");
    expect(sheet?.getAttribute("role")).toBe("dialog");
    expect(sheet?.getAttribute("aria-modal")).toBe("true");
    expect(sheet?.textContent).toContain("変換履歴");
    expect(sheet?.querySelectorAll('[data-testid="history-item"]')).toHaveLength(2);
    expect(byTestId("history-clear-all")).not.toBeNull();
    expect(byTestId("history-convert-another")).toBeNull();
    expect(sheet?.contains(document.activeElement)).toBe(true);
    expect(byTestId("history-sheet-button")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on scrim tap, Escape, and item selection, returning focus to the button", () => {
    const app = createFakeViewerApp(history(true));
    mountApp(app);

    click("history-sheet-button");
    click("history-sheet-scrim");
    expect(byTestId("history-sheet")).toBeNull();
    expect(document.activeElement).toBe(byTestId("history-sheet-button"));

    click("history-sheet-button");
    pressEscape();
    expect(byTestId("history-sheet")).toBeNull();

    click("history-sheet-button");
    act(() => {
      document.querySelector<HTMLButtonElement>(".history-item__select")?.click();
    });
    expect(app.selectCalls).toEqual(["a"]);
    expect(byTestId("history-sheet")).toBeNull();
  });

  it("has a close button with an accessible name that closes the sheet and returns focus", () => {
    const app = createFakeViewerApp(history(true));
    mountApp(app);

    click("history-sheet-button");
    const close = byTestId("history-sheet-close");
    expect(close?.getAttribute("aria-label")).toBe("閉じる");
    expect(byTestId("history-sheet")?.contains(close ?? null)).toBe(true);

    click("history-sheet-close");
    expect(byTestId("history-sheet")).toBeNull();
    expect(document.activeElement).toBe(byTestId("history-sheet-button"));
  });

  it("toggles with the history button", () => {
    const app = createFakeViewerApp(history(true));
    mountApp(app);
    click("history-sheet-button");
    click("history-sheet-button");
    expect(byTestId("history-sheet")).toBeNull();
  });

  it("does not open by itself after remount and does not touch the sidebar preference", () => {
    const app = createFakeViewerApp(history(true));
    mountApp(app);
    click("history-sheet-button");
    expect(window.localStorage.length).toBe(0);

    mountApp(createFakeViewerApp(history(true)));
    expect(byTestId("history-sheet")).toBeNull();

    // PC で閉じた保存値があっても、スマホのシートは閉じた状態から始まり、開閉で保存値は変わらない。
    window.localStorage.setItem("history-sidebar-open", "true");
    mountApp(createFakeViewerApp(history(true)));
    click("history-sheet-button");
    click("history-sheet-scrim");
    expect(window.localStorage.getItem("history-sidebar-open")).toBe("true");
  });

  it("closes the sheet when the history becomes empty and stays closed when it returns", () => {
    const app = createFakeViewerApp(history(true));
    mountApp(app);
    click("history-sheet-button");

    setState(app, EMPTY);
    expect(byTestId("history-sheet")).toBeNull();
    expect(byTestId("history-sheet-button")).toBeNull();

    setState(app, history(false));
    expect(byTestId("history-sheet")).toBeNull();
  });
});

describe("wide viewport", () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubViewportWidth(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the sidebar and the description in the header, with no sheet buttons", () => {
    const app = createFakeViewerApp(history(true));
    mountApp(app);

    expect(byTestId("history-sidebar")).not.toBeNull();
    expect(byTestId("history-sheet-button")).toBeNull();
    expect(byTestId("compact-convert")).toBeNull();
    expect(document.querySelector("header")?.textContent).toContain(DESCRIPTION);
  });
});

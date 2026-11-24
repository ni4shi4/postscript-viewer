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
import type { ViewerDocument, ViewerState } from "../../../core/state/viewer-state";
import { ja } from "./i18n/ja";
import { App } from "./static-shell";
import {
  formatHistorySavedAt,
  isReadyHistoryDocument,
  readyHistoryDocuments,
} from "./history-sidebar";

type FakeViewerApp = ViewerApp & {
  replaceState(state: ViewerState): void;
  getSelectDocumentCalls(): readonly string[];
  getDeleteDocumentCalls(): readonly string[];
  getClearHistoryCalls(): number;
};

function createFakeViewerApp(
  initial: ViewerState = { documents: [], selectedDocumentId: undefined },
): FakeViewerApp {
  let state = initial;
  const listeners = new Set<(next: ViewerState) => void>();
  const selectCalls: string[] = [];
  const deleteCalls: string[] = [];
  let clearHistoryCalls = 0;

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
    async deleteDocument(id) {
      deleteCalls.push(id);
    },
    async clearHistory() {
      clearHistoryCalls += 1;
    },
    async readReadyPdf() {
      return undefined;
    },
    getSelectDocumentCalls: () => selectCalls,
    getDeleteDocumentCalls: () => deleteCalls,
    getClearHistoryCalls: () => clearHistoryCalls,
  };
}

function mountApp(app: FakeViewerApp): void {
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

function historyDocument(
  id: string,
  fileName: string,
  savedAt: number,
  selected: boolean,
): ViewerState {
  const documents: ViewerDocument[] = [{ id, fileName, savedAt, status: { kind: "ready" } }];
  return {
    documents,
    selectedDocumentId: selected ? id : undefined,
  };
}

function queryHistorySidebar(): HTMLElement {
  const sidebar = document.querySelector<HTMLElement>('[data-testid="history-sidebar"]');
  if (sidebar === null) {
    throw new Error("history sidebar is missing");
  }
  return sidebar;
}

function queryToggle(): HTMLButtonElement {
  const toggle = document.querySelector<HTMLButtonElement>('[data-testid="history-toggle"]');
  if (toggle === null) {
    throw new Error("history toggle is missing");
  }
  return toggle;
}

const SAMPLE_PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);

// 状態遷移まで本物の ViewerApp で確かめる（外部境界の port だけフェイク）。履歴を 1 件持ち、最新を表示した状態で始める。
async function mountRealAppShowingHistory(): Promise<void> {
  const pdfStore = createFakePdfStore();
  await pdfStore.put({ id: "doc-a", fileName: "a.ps", savedAt: 1, pdf: SAMPLE_PDF });
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
}

function queryDropCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('[data-testid="drop-card"]');
  if (card === null) {
    throw new Error("drop card is missing");
  }
  return card;
}

function queryPickButton(): HTMLButtonElement {
  const button = Array.from(queryDropCard().querySelectorAll("button")).find(
    (candidate) => candidate.textContent === "ファイルを選択",
  );
  if (button === undefined) {
    throw new Error("pick button is missing");
  }
  return button;
}

function clickToggle(): void {
  act(() => {
    queryToggle().click();
  });
}

describe("history sidebar helpers", () => {
  it("formats savedAt for display", () => {
    const label = formatHistorySavedAt(Date.UTC(2024, 5, 15, 9, 30), ja);
    expect(label).not.toBe("");
  });

  it("lists only ready history documents", () => {
    const state: ViewerState = {
      documents: [
        { id: "h1", fileName: "saved.ps", savedAt: 1, status: { kind: "ready" } },
        {
          id: "s1",
          fileName: "converting.ps",
          status: { kind: "converting", progress: { kind: "started" } },
        },
      ],
      selectedDocumentId: "h1",
    };
    expect(isReadyHistoryDocument(state.documents[0]!)).toBe(true);
    expect(isReadyHistoryDocument(state.documents[1]!)).toBe(false);
    expect(readyHistoryDocuments(state)).toHaveLength(1);
    expect(readyHistoryDocuments(state)[0]?.fileName).toBe("saved.ps");
  });
});

describe("history sidebar UI", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not show the sidebar when there is no history", () => {
    const app = createFakeViewerApp();
    mountApp(app);

    expect(document.querySelector('[data-testid="history-sidebar"]')).toBeNull();
    expect(document.body.textContent).not.toContain("変換済みの履歴はまだありません");
  });

  it("shows the sidebar once at least one entry exists", () => {
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "first.ps", 1, false));

    expect(queryHistorySidebar().textContent).toContain("変換履歴");
    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(1);
  });

  it("renders history entries with selection highlight", () => {
    const app = createFakeViewerApp();
    mountApp(app);

    replaceViewerState(app, {
      documents: [
        { id: "newer", fileName: "newer.ps", savedAt: 20, status: { kind: "ready" } },
        { id: "older", fileName: "older.ps", savedAt: 10, status: { kind: "ready" } },
      ],
      selectedDocumentId: "newer",
    });

    const items = document.querySelectorAll('[data-testid="history-item"]');
    expect(items).toHaveLength(2);

    const selectedButton = document.querySelector<HTMLButtonElement>(
      ".history-item__select--selected",
    );
    expect(selectedButton).not.toBeNull();
    expect(selectedButton?.getAttribute("aria-current")).toBe("true");
    expect(selectedButton?.textContent).toContain("newer.ps");
  });

  it("omits in-progress session documents from the list", () => {
    const app = createFakeViewerApp();
    mountApp(app);

    replaceViewerState(app, {
      documents: [
        {
          id: "s1",
          fileName: "busy.ps",
          status: { kind: "converting", progress: { kind: "started" } },
        },
        { id: "h1", fileName: "done.ps", savedAt: 3, status: { kind: "ready" } },
      ],
      selectedDocumentId: "s1",
    });

    const historyItems = document.querySelectorAll('[data-testid="history-item"]');
    expect(historyItems).toHaveLength(1);
    expect(historyItems[0]?.textContent).toContain("done.ps");
    expect(queryHistorySidebar().textContent).not.toContain("busy.ps");
  });

  it("calls selectDocument when an entry is activated", async () => {
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "pick.ps", 5, false));

    const selectButton = document.querySelector<HTMLButtonElement>(".history-item__select");
    expect(selectButton).not.toBeNull();

    await act(async () => {
      selectButton?.click();
      await Promise.resolve();
    });

    expect(app.getSelectDocumentCalls()).toEqual(["doc-a"]);
  });

  it("calls deleteDocument when delete is pressed", async () => {
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "remove.ps", 5, true));

    const deleteButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="history-delete"]',
    );
    expect(deleteButton).not.toBeNull();
    expect(deleteButton?.getAttribute("aria-label")).toContain("remove.ps");

    await act(async () => {
      deleteButton?.click();
      await Promise.resolve();
    });

    expect(app.getDeleteDocumentCalls()).toEqual(["doc-a"]);
  });

  it("calls clearHistory when clear all is pressed", async () => {
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "clear.ps", 1, true));

    const clearAll = document.querySelector<HTMLButtonElement>('[data-testid="history-clear-all"]');
    expect(clearAll).not.toBeNull();

    await act(async () => {
      clearAll?.click();
      await Promise.resolve();
    });

    expect(app.getClearHistoryCalls()).toBe(1);
  });

  it("is open by default with a close button exposing aria-expanded", () => {
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, false));

    const toggle = queryToggle();
    expect(toggle.getAttribute("aria-label")).toBe("履歴を閉じる");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(1);
  });

  it("collapses to a rail with a labelled open button and expands again", () => {
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, false));

    clickToggle();
    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(0);
    expect(queryToggle().getAttribute("aria-expanded")).toBe("false");
    expect(queryToggle().textContent).toContain("履歴");

    clickToggle();
    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(1);
    expect(queryToggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("restores the collapsed state after remounting", () => {
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, false));
    clickToggle();

    const remounted = createFakeViewerApp(historyDocument("doc-a", "a.ps", 1, false));
    mountApp(remounted);
    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(0);
    expect(queryToggle().getAttribute("aria-expanded")).toBe("false");

    clickToggle();
    mountApp(createFakeViewerApp(historyDocument("doc-a", "a.ps", 1, false)));
    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(1);
  });

  it("keeps working when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, false));

    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(1);
    clickToggle();
    expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(0);
  });

  describe("convert another file buttons", () => {
    it("shows the button below the list only while a PDF is displayed and opens the picker", () => {
      const app = createFakeViewerApp();
      mountApp(app);

      replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, false));
      expect(document.querySelector('[data-testid="history-convert-another"]')).toBeNull();

      replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, true));
      const button = document.querySelector<HTMLButtonElement>(
        '[data-testid="history-convert-another"]',
      );
      expect(button?.textContent).toContain("別のファイルを変換");
    });

    it("shows the rail button only while a PDF is displayed", () => {
      const app = createFakeViewerApp();
      mountApp(app);
      replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, false));
      clickToggle();
      expect(document.querySelector('[data-testid="history-rail-convert"]')).toBeNull();

      replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, true));
      const button = document.querySelector<HTMLButtonElement>(
        '[data-testid="history-rail-convert"]',
      );
      expect(button?.textContent).toContain("変換する");
    });

    it("returns to the drop card without opening the picker, keeps the history and focuses the pick button", async () => {
      await mountRealAppShowingHistory();
      let pickerOpens = 0;
      document
        .querySelector<HTMLInputElement>('[data-testid="file-input"]')
        ?.addEventListener("click", () => {
          pickerOpens += 1;
        });
      expect(queryDropCard().hidden).toBe(true);

      const button = document.querySelector<HTMLButtonElement>(
        '[data-testid="history-convert-another"]',
      );
      button?.focus();
      act(() => {
        button?.click();
      });

      expect(queryDropCard().hidden).toBe(false);
      expect(document.querySelector('[data-testid="history-convert-another"]')).toBeNull();
      expect(document.querySelectorAll('[data-testid="history-item"]')).toHaveLength(1);
      expect(document.activeElement).toBe(queryPickButton());
      expect(pickerOpens).toBe(0);
    });

    it("does the same from the rail button of the closed sidebar", async () => {
      await mountRealAppShowingHistory();
      clickToggle();
      let pickerOpens = 0;
      document
        .querySelector<HTMLInputElement>('[data-testid="file-input"]')
        ?.addEventListener("click", () => {
          pickerOpens += 1;
        });

      const button = document.querySelector<HTMLButtonElement>(
        '[data-testid="history-rail-convert"]',
      );
      button?.focus();
      act(() => {
        button?.click();
      });

      expect(queryDropCard().hidden).toBe(false);
      expect(document.querySelector('[data-testid="history-rail-convert"]')).toBeNull();
      expect(document.querySelector('[data-testid="history-toggle"]')).not.toBeNull();
      expect(document.activeElement).toBe(queryPickButton());
      expect(pickerOpens).toBe(0);
    });
  });

  it("prevents the browser default when files are dropped on the sidebar", () => {
    const app = createFakeViewerApp();
    mountApp(app);
    replaceViewerState(app, historyDocument("doc-a", "a.ps", 1, true));

    for (const type of ["dragover", "drop"] as const) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: { types: ["Files"], files: [] } });
      queryHistorySidebar().dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });
});

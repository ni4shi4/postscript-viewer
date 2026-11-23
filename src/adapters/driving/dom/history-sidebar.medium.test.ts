// @vitest-environment jsdom

import { h, render } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerDocument, ViewerState } from "../../../core/state/viewer-state";
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
    async selectDocument(id) {
      selectCalls.push(id);
    },
    async deleteDocument(id) {
      deleteCalls.push(id);
    },
    async clearHistory() {
      clearHistoryCalls += 1;
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

describe("history sidebar helpers", () => {
  it("formats savedAt for display", () => {
    const label = formatHistorySavedAt(Date.UTC(2024, 5, 15, 9, 30));
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
  });

  it("shows an empty state when there is no history", () => {
    const app = createFakeViewerApp();
    mountApp(app);

    expect(queryHistorySidebar()).toBeTruthy();
    expect(document.querySelector('[data-testid="history-empty"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="history-clear-all"]')).toBeNull();
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
});

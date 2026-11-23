import type { ComponentChildren } from "preact";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerDocument, ViewerState } from "../../../core/state/viewer-state";
import { useHistorySidebarOpen } from "./history-sidebar-preference";

export function isReadyHistoryDocument(document: ViewerDocument): boolean {
  return document.savedAt !== undefined && document.status.kind === "ready";
}

export function readyHistoryDocuments(state: ViewerState): ViewerDocument[] {
  return state.documents.filter(isReadyHistoryDocument);
}

export function formatHistorySavedAt(savedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(savedAt));
}

function invokeViewerApp(
  app: ViewerApp | undefined,
  action: (viewerApp: ViewerApp) => Promise<void>,
): void {
  if (app === undefined) {
    return;
  }
  void action(app);
}

function Svg({ children, width = 20 }: { children: ComponentChildren; width?: number }) {
  return (
    <svg
      class="icon"
      width={width}
      height={width}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function PanelIcon() {
  return (
    <Svg>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export type HistorySidebarProps = {
  app: ViewerApp | undefined;
  state: ViewerState;
  // PDF を表示している間だけ、サイドバーから別ファイルの変換を始められる。
  canConvertAnother: boolean;
  onPickFile: () => void;
};

export function HistorySidebar({ app, state, canConvertAnother, onPickFile }: HistorySidebarProps) {
  const [open, setOpen] = useHistorySidebarOpen();
  const entries = readyHistoryDocuments(state);

  if (entries.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <aside
        class="history-sidebar history-sidebar--closed"
        data-testid="history-sidebar"
        aria-label="変換履歴"
      >
        <button
          type="button"
          class="rail-item"
          data-testid="history-toggle"
          aria-label="履歴を開く"
          aria-expanded="false"
          onClick={() => {
            setOpen(true);
          }}
        >
          <span class="rail-item__icon">
            <PanelIcon />
          </span>
          履歴
        </button>
        {canConvertAnother ? (
          <button
            type="button"
            class="rail-item rail-item--accent"
            data-testid="history-rail-convert"
            onClick={onPickFile}
          >
            <span class="rail-item__icon">
              <PlusIcon />
            </span>
            変換する
          </button>
        ) : null}
      </aside>
    );
  }

  return (
    <aside class="history-sidebar" data-testid="history-sidebar">
      <div class="history-sidebar__top">
        <h2 class="history-sidebar__heading">変換履歴</h2>
        <button
          type="button"
          class="history-sidebar__toggle"
          data-testid="history-toggle"
          aria-label="履歴を閉じる"
          aria-expanded="true"
          onClick={() => {
            setOpen(false);
          }}
        >
          <PanelIcon />
        </button>
      </div>
      <div class="history-sidebar__scroll">
        <ul class="history-sidebar__list">
          {entries.map((entry) => (
            <HistorySidebarItem
              key={entry.id}
              app={app}
              entry={entry}
              selected={state.selectedDocumentId === entry.id}
            />
          ))}
        </ul>
        <button
          type="button"
          class="history-sidebar__clear-all"
          data-testid="history-clear-all"
          onClick={() => {
            invokeViewerApp(app, (viewerApp) => viewerApp.clearHistory());
          }}
        >
          すべて削除
        </button>
        {canConvertAnother ? (
          <div class="history-sidebar__add">
            <button
              type="button"
              class="history-sidebar__add-button"
              data-testid="history-convert-another"
              onClick={onPickFile}
            >
              <PlusIcon />
              別のファイルを変換
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

type HistorySidebarItemProps = {
  app: ViewerApp | undefined;
  entry: ViewerDocument;
  selected: boolean;
};

function HistorySidebarItem({ app, entry, selected }: HistorySidebarItemProps) {
  const savedAt = entry.savedAt;
  if (savedAt === undefined) {
    return null;
  }
  const savedAtLabel = formatHistorySavedAt(savedAt);

  return (
    <li
      class={
        selected ? "history-sidebar__item history-sidebar__item--selected" : "history-sidebar__item"
      }
      data-testid="history-item"
    >
      <button
        type="button"
        class={
          selected ? "history-item__select history-item__select--selected" : "history-item__select"
        }
        aria-current={selected ? "true" : undefined}
        onClick={() => {
          invokeViewerApp(app, (viewerApp) => viewerApp.selectDocument(entry.id));
        }}
      >
        <span class="history-item__file-icon" aria-hidden="true">
          <Svg width={16}>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
          </Svg>
        </span>
        <span class="history-item__meta">
          <span class="history-item__name">{entry.fileName}</span>
          <time class="history-item__saved-at" dateTime={new Date(savedAt).toISOString()}>
            {savedAtLabel}
          </time>
        </span>
      </button>
      <button
        type="button"
        class="history-item__delete"
        data-testid="history-delete"
        aria-label={`${entry.fileName} を履歴から削除`}
        onClick={() => {
          invokeViewerApp(app, (viewerApp) => viewerApp.deleteDocument(entry.id));
        }}
      >
        <Svg width={14}>
          <path d="M6 6l12 12M18 6L6 18" />
        </Svg>
      </button>
    </li>
  );
}

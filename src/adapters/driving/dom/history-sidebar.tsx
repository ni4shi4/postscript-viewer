import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

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

export function ClockIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
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

export function PlusIcon() {
  return (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export type HistorySidebarProps = {
  app: ViewerApp | undefined;
  state: ViewerState;
  // PDF を表示している間だけ、サイドバーから別ファイルの変換へ（ドロップゾーンへ）戻れる。
  canConvertAnother: boolean;
  onConvertAnother: () => void;
};

export function HistorySidebar({
  app,
  state,
  canConvertAnother,
  onConvertAnother,
}: HistorySidebarProps) {
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
            onClick={onConvertAnother}
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
        <HistoryList app={app} state={state} entries={entries} />
        {canConvertAnother ? (
          <div class="history-sidebar__add">
            <button
              type="button"
              class="history-sidebar__add-button"
              data-testid="history-convert-another"
              onClick={onConvertAnother}
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

type HistoryListProps = {
  app: ViewerApp | undefined;
  state: ViewerState;
  entries: ViewerDocument[];
  onSelect?: () => void;
};

function HistoryList({ app, state, entries, onSelect }: HistoryListProps) {
  return (
    <>
      <ul class="history-sidebar__list">
        {entries.map((entry) => (
          <HistorySidebarItem
            key={entry.id}
            app={app}
            entry={entry}
            selected={state.selectedDocumentId === entry.id}
            onSelect={onSelect}
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
    </>
  );
}

const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])";

export type HistoryDrawerProps = {
  app: ViewerApp | undefined;
  state: ViewerState;
  open: boolean;
  onClose: () => void;
};

// スマホ用。PDF の上に重なる右側のドロワー。開閉は呼び出し側の一時的な状態で、保存しない。
export function HistoryDrawer({ app, state, open, onClose }: HistoryDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const entries = readyHistoryDocuments(state);
  const visible = open && entries.length > 0;

  useEffect(() => {
    if (!visible) {
      return;
    }
    drawerRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const drawer = drawerRef.current;
      if (drawer === null) {
        return;
      }
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === drawer)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (active !== null && !drawer.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div class="history-drawer__scrim" data-testid="history-drawer-scrim" onClick={onClose} />
      <div
        id="history-drawer"
        class="history-drawer"
        data-testid="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-drawer-heading"
        tabIndex={-1}
        ref={drawerRef}
      >
        <h2 id="history-drawer-heading" class="history-sidebar__heading">
          変換履歴
        </h2>
        <div class="history-sidebar__scroll">
          <HistoryList app={app} state={state} entries={entries} onSelect={onClose} />
        </div>
      </div>
    </>
  );
}

type HistorySidebarItemProps = {
  app: ViewerApp | undefined;
  entry: ViewerDocument;
  selected: boolean;
  onSelect?: () => void;
};

function HistorySidebarItem({ app, entry, selected, onSelect }: HistorySidebarItemProps) {
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
          onSelect?.();
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

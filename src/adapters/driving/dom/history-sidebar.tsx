import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerDocument, ViewerState } from "../../../core/state/viewer-state";
import type { Messages } from "./i18n/messages";
import { useMessages } from "./i18n/messages-context";
import { useHistorySidebarOpen } from "./history-sidebar-preference";

export function isReadyHistoryDocument(document: ViewerDocument): boolean {
  return document.savedAt !== undefined && document.status.kind === "ready";
}

export function readyHistoryDocuments(state: ViewerState): ViewerDocument[] {
  return state.documents.filter(isReadyHistoryDocument);
}

export function formatHistorySavedAt(savedAt: number, messages: Messages): string {
  return new Intl.DateTimeFormat(messages.intlLocale, {
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
  const messages = useMessages();
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
        aria-label={messages.historyHeading}
      >
        <button
          type="button"
          class="rail-item"
          data-testid="history-toggle"
          aria-label={messages.historyOpenLabel}
          aria-expanded="false"
          onClick={() => {
            setOpen(true);
          }}
        >
          <span class="rail-item__icon">
            <PanelIcon />
          </span>
          {messages.historyButton}
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
            {messages.convertAnotherRail}
          </button>
        ) : null}
      </aside>
    );
  }

  return (
    <aside class="history-sidebar" data-testid="history-sidebar">
      <div class="history-sidebar__top">
        <h2 class="history-sidebar__heading">{messages.historyHeading}</h2>
        <button
          type="button"
          class="history-sidebar__toggle"
          data-testid="history-toggle"
          aria-label={messages.historyCloseLabel}
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
              {messages.convertAnotherFile}
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
  const messages = useMessages();
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
        {messages.clearHistory}
      </button>
    </>
  );
}

const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])";

export type HistoryBottomSheetProps = {
  app: ViewerApp | undefined;
  state: ViewerState;
  open: boolean;
  onClose: () => void;
};

// スマホ用。画面下からせり上がるモーダルのボトムシート。開閉は呼び出し側の一時的な状態で、保存しない。
export function HistoryBottomSheet({ app, state, open, onClose }: HistoryBottomSheetProps) {
  const messages = useMessages();
  const sheetRef = useRef<HTMLDivElement>(null);
  const entries = readyHistoryDocuments(state);
  const visible = open && entries.length > 0;

  useEffect(() => {
    if (!visible) {
      return;
    }
    sheetRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const sheet = sheetRef.current;
      if (sheet === null) {
        return;
      }
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === sheet)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (active !== null && !sheet.contains(active)) {
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
      <div class="history-sheet__scrim" data-testid="history-sheet-scrim" onClick={onClose} />
      <div
        id="history-sheet"
        class="history-sheet"
        data-testid="history-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-sheet-heading"
        tabIndex={-1}
        ref={sheetRef}
      >
        <div class="history-sheet__grabber" aria-hidden="true" />
        <div class="history-sheet__top">
          <h2 id="history-sheet-heading" class="history-sheet__heading">
            {messages.historyHeading}
          </h2>
          <button
            type="button"
            class="history-sheet__close"
            data-testid="history-sheet-close"
            aria-label={messages.closeLabel}
            onClick={onClose}
          >
            <Svg>
              <path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </button>
        </div>
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
  const messages = useMessages();
  const savedAt = entry.savedAt;
  if (savedAt === undefined) {
    return null;
  }
  const savedAtLabel = formatHistorySavedAt(savedAt, messages);

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
        aria-label={messages.removeFromHistory(entry.fileName)}
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

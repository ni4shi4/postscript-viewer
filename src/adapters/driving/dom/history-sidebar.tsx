import type { ViewerApp } from "../../../core/ports/viewer-app";
import type { ViewerDocument, ViewerState } from "../../../core/state/viewer-state";

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

export type HistorySidebarProps = {
  app: ViewerApp | undefined;
  state: ViewerState;
};

export function HistorySidebar({ app, state }: HistorySidebarProps) {
  const entries = readyHistoryDocuments(state);
  const hasEntries = entries.length > 0;

  return (
    <aside class="history-sidebar" data-testid="history-sidebar">
      <h2 class="history-sidebar__heading">変換履歴</h2>
      <details class="history-sidebar__details" open>
        <summary class="history-sidebar__summary">変換履歴</summary>
        <div class="history-sidebar__panel">
          {hasEntries ? (
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
          ) : (
            <p class="history-sidebar__empty" data-testid="history-empty">
              変換済みの履歴はまだありません。
            </p>
          )}
          {hasEntries ? (
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
          ) : null}
        </div>
      </details>
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
    <li class="history-sidebar__item" data-testid="history-item">
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
        <span class="history-item__name">{entry.fileName}</span>
        <time class="history-item__saved-at" dateTime={new Date(savedAt).toISOString()}>
          {savedAtLabel}
        </time>
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
        削除
      </button>
    </li>
  );
}

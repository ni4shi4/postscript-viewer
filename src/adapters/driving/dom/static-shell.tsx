import { memo } from "preact/compat";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import { selectedViewerDocument, type ViewerState } from "../../../core/state/viewer-state";
import { DocumentBar } from "./document-bar";
import type { Locale } from "./i18n/messages";
import { MessagesContext, messagesFor, useMessages } from "./i18n/messages-context";
import { FileLimitsNotice } from "./file-limits-notice";
import { AppFooter, type AppFooterProps } from "./footer-source-link";
import { useCompactViewport } from "./compact-viewport";
import {
  ClockIcon,
  HistoryBottomSheet,
  HistorySidebar,
  PlusIcon,
  readyHistoryDocuments,
} from "./history-sidebar";
import {
  useFileDropTarget,
  usePreventBrowserFileDrop,
  useViewerDomUi,
  ViewerFileName,
  ViewerStatus,
} from "./viewer-ui";

export function ToolbarIntro({ compact = false }: { compact?: boolean }) {
  const messages = useMessages();
  return (
    <div class="toolbar-intro">
      <img
        src="/favicon.svg"
        alt=""
        width={30}
        height={30}
        class="app-mark"
        data-testid="app-mark"
      />
      <h1>{messages.appTitle}</h1>
      {compact ? null : (
        <>
          <span class="toolbar-intro__divider" aria-hidden="true" />
          <p class="toolbar-intro__description">{messages.appDescription}</p>
        </>
      )}
    </div>
  );
}

type CompactToolbarActionsProps = {
  showHistory: boolean;
  historyOpen: boolean;
  showConvert: boolean;
  historyButtonRef: { current: HTMLButtonElement | null };
  onToggleHistory: () => void;
  onConvertAnother: () => void;
};

function CompactToolbarActions(props: CompactToolbarActionsProps) {
  const messages = useMessages();
  return (
    <div class="toolbar-actions">
      {props.showHistory ? (
        <button
          type="button"
          class="toolbar-button"
          data-testid="history-sheet-button"
          aria-haspopup="dialog"
          aria-expanded={props.historyOpen}
          aria-controls="history-sheet"
          ref={props.historyButtonRef}
          onClick={props.onToggleHistory}
        >
          <ClockIcon />
          {messages.historyButton}
        </button>
      ) : null}
      {props.showConvert ? (
        <button
          type="button"
          class="btn-primary toolbar-button toolbar-button--primary"
          data-testid="compact-convert"
          onClick={props.onConvertAnother}
        >
          <PlusIcon />
          {messages.convertButton}
        </button>
      ) : null}
    </div>
  );
}

export function PrivacyNotice() {
  const messages = useMessages();
  return (
    <p id="privacy-notice" class="notice notice--ok">
      <svg
        class="icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      {messages.privacyNotice}
    </p>
  );
}

export function TrustNotice() {
  const messages = useMessages();
  return (
    <p class="notice notice--warn" id="trust-notice" data-testid="trust-notice">
      <svg
        class="icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M12 3l10 18H2z" />
        <path d="M12 10v4M12 17v.5" />
      </svg>
      {messages.trustNotice}
    </p>
  );
}

const ViewerMain = memo(function ViewerMain() {
  const messages = useMessages();
  return (
    <>
      <iframe title={messages.pdfFrameTitle} data-testid="pdf-frame" hidden />
      <div class="pdf-canvas-container" data-testid="pdf-canvas-container" hidden />
    </>
  );
});

function isPdfShown(state: ViewerState): boolean {
  return selectedViewerDocument(state)?.status.kind === "ready";
}

function isDocumentActive(state: ViewerState): boolean {
  return selectedViewerDocument(state) !== undefined;
}

function DropOverlay({ state }: { state: ViewerState }) {
  const messages = useMessages();
  return (
    <div class="drop-overlay" data-testid="drop-overlay" hidden={!isPdfShown(state)}>
      <p class="drop-overlay__label">{messages.dropOverlayLabel}</p>
    </div>
  );
}

type DropCardProps = {
  state: ViewerState;
  onPickFile: () => void;
  pickButtonRef: { current: HTMLButtonElement | null };
};

function DropCard({ state, onPickFile, pickButtonRef }: DropCardProps) {
  const messages = useMessages();
  return (
    <div class="drop-stage" data-testid="drop-card" hidden={isPdfShown(state)}>
      <section class="drop-card" aria-labelledby="drop-card-heading">
        <div class="drop-card__icon" aria-hidden="true">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
          </svg>
        </div>
        <h2
          id="drop-card-heading"
          class="drop-card__heading drop-card__pointer-only"
          hidden={isDocumentActive(state)}
        >
          {messages.dropCardHeading}
        </h2>
        <p class="drop-card__formats">{messages.dropCardFormats}</p>
        <p class="drop-card__or drop-card__pointer-only">{messages.dropCardOr}</p>
        <button type="button" class="btn-primary" ref={pickButtonRef} onClick={onPickFile}>
          {messages.pickFileButton}
        </button>
        <div class="drop-card__document">
          <ViewerFileName state={state} />
          <ViewerStatus state={state} />
        </div>
        <FileLimitsNotice />
        <div class="drop-card__notices">
          <PrivacyNotice />
          <TrustNotice />
        </div>
      </section>
    </div>
  );
}

export type AppProps = AppFooterProps & {
  app?: ViewerApp;
};

export function App({ commitSha, app }: AppProps) {
  const messages = useMessages();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerState = useViewerDomUi(app, fileInputRef);
  const dropTarget = useFileDropTarget(app);
  usePreventBrowserFileDrop();
  const openFilePicker = (): void => {
    fileInputRef.current?.click();
  };

  const pickButtonRef = useRef<HTMLButtonElement>(null);
  const focusPickButtonAfterClose = useRef(false);

  const compact = useCompactViewport();
  // スマホのボトムシート開閉は一時的な状態。PC のサイドバーの保存値（localStorage）とは独立している。
  const [sheetOpen, setSheetOpen] = useState(false);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const hasHistory = readyHistoryDocuments(viewerState).length > 0;
  const sheetShown = compact && hasHistory && sheetOpen;
  const closeSheet = useCallback((): void => {
    setSheetOpen(false);
  }, []);

  useEffect(() => {
    if (!compact || !hasHistory) {
      setSheetOpen(false);
    }
  }, [compact, hasHistory]);

  const wasSheetShown = useRef(false);
  useEffect(() => {
    if (wasSheetShown.current && !sheetShown) {
      historyButtonRef.current?.focus();
    }
    wasSheetShown.current = sheetShown;
  }, [sheetShown]);

  const pdfShown = isPdfShown(viewerState);

  // 「PDF を表示していない状態では必ずドロップゾーン」に揃えるため、変換ボタンは表示中の PDF を閉じて戻るだけ。
  const convertAnother = (): void => {
    if (app === undefined) {
      return;
    }
    focusPickButtonAfterClose.current = true;
    setSheetOpen(false);
    app.closeDocument();
  };

  // 押したボタン自体が消えるため、フォーカスが body に落ちないようカードの「ファイルを選択」へ移す。
  useEffect(() => {
    if (focusPickButtonAfterClose.current && !pdfShown) {
      focusPickButtonAfterClose.current = false;
      pickButtonRef.current?.focus();
    }
  }, [pdfShown]);

  return (
    <>
      <header class={compact ? "toolbar toolbar--compact" : "toolbar"}>
        <div class="toolbar__row">
          <ToolbarIntro compact={compact} />
          {compact ? (
            <CompactToolbarActions
              showHistory={hasHistory}
              historyOpen={sheetShown}
              showConvert={pdfShown}
              historyButtonRef={historyButtonRef}
              onToggleHistory={() => {
                setSheetOpen(!sheetOpen);
              }}
              onConvertAnother={convertAnother}
            />
          ) : null}
        </div>
        {compact && !pdfShown ? (
          <p class="toolbar__description">{messages.appDescription}</p>
        ) : null}
      </header>
      <main class="viewer">
        <input
          type="file"
          accept=".ps,.gz"
          class="file-picker__input"
          data-testid="file-input"
          aria-label={messages.fileInputLabel}
          aria-describedby="file-limits-notice privacy-notice trust-notice"
          ref={fileInputRef}
        />
        {compact ? (
          <HistoryBottomSheet app={app} state={viewerState} open={sheetOpen} onClose={closeSheet} />
        ) : (
          <HistorySidebar
            app={app}
            state={viewerState}
            canConvertAnother={pdfShown}
            onConvertAnother={convertAnother}
          />
        )}
        <div
          class="viewer-surface"
          data-testid="viewer-surface"
          data-dragging={dropTarget.dragging ? "true" : undefined}
          data-document-bar={pdfShown ? "true" : undefined}
          {...dropTarget.handlers}
        >
          <DocumentBar app={app} state={viewerState} hidden={!pdfShown} />
          <ViewerMain />
          <DropCard state={viewerState} onPickFile={openFilePicker} pickButtonRef={pickButtonRef} />
          {dropTarget.dragging ? <DropOverlay state={viewerState} /> : null}
        </div>
      </main>
      <footer class="app-footer">
        <AppFooter commitSha={commitSha} />
      </footer>
    </>
  );
}

function requireMountElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Static shell mount point is missing: ${id}`);
  }
  return element;
}

export type MountViewerAppOptions = AppFooterProps & {
  locale: Locale;
};

export function mountViewerApp(options: MountViewerAppOptions): (app: ViewerApp) => void {
  const mount = requireMountElement("mount-app");
  let viewerApp: ViewerApp | undefined;

  const renderRoot = (): void => {
    render(
      <MessagesContext.Provider value={messagesFor(options.locale)}>
        <App commitSha={options.commitSha} app={viewerApp} />
      </MessagesContext.Provider>,
      mount,
    );
  };

  renderRoot();

  return (app: ViewerApp) => {
    viewerApp = app;
    renderRoot();
  };
}

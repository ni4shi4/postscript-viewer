import { memo } from "preact/compat";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import { selectedViewerDocument, type ViewerState } from "../../../core/state/viewer-state";
import { FileLimitsNotice } from "./file-limits-notice";
import { AppFooter, type AppFooterProps } from "./footer-source-link";
import { useCompactViewport } from "./compact-viewport";
import {
  ClockIcon,
  HistoryDrawer,
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

const DESCRIPTION = "PostScript ファイルをブラウザ内で PDF に変換して表示します";

export function ToolbarIntro({ compact = false }: { compact?: boolean }) {
  return (
    <div class="toolbar-intro">
      <span class="logo-mark" aria-hidden="true">
        PS
      </span>
      <h1>PostScript ビューア</h1>
      {compact ? null : (
        <>
          <span class="toolbar-intro__divider" aria-hidden="true" />
          <p class="toolbar-intro__description">{DESCRIPTION}</p>
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
  onPickFile: () => void;
};

function CompactToolbarActions(props: CompactToolbarActionsProps) {
  return (
    <div class="toolbar-actions">
      {props.showHistory ? (
        <button
          type="button"
          class="toolbar-button"
          data-testid="history-drawer-button"
          aria-haspopup="dialog"
          aria-expanded={props.historyOpen}
          aria-controls="history-drawer"
          ref={props.historyButtonRef}
          onClick={props.onToggleHistory}
        >
          <ClockIcon />
          履歴
        </button>
      ) : null}
      {props.showConvert ? (
        <button
          type="button"
          class="btn-primary toolbar-button toolbar-button--primary"
          data-testid="compact-convert"
          onClick={props.onPickFile}
        >
          <PlusIcon />
          変換
        </button>
      ) : null}
    </div>
  );
}

export function PrivacyNotice() {
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
      ファイルはサーバーへ送信されず、お使いの端末内で処理されます
    </p>
  );
}

export function TrustNotice() {
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
      信頼できる PostScript ファイルだけを開いてください
    </p>
  );
}

const ViewerMain = memo(function ViewerMain() {
  return (
    <>
      <iframe title="変換された PDF" data-testid="pdf-frame" hidden />
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
  return (
    <div class="drop-overlay" data-testid="drop-overlay" hidden={!isPdfShown(state)}>
      <p class="drop-overlay__label">ここにドロップして変換</p>
    </div>
  );
}

function DropCard({ state, onPickFile }: { state: ViewerState; onPickFile: () => void }) {
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
          PostScript ファイルをここにドロップ
        </h2>
        <p class="drop-card__formats">.ps / .ps.gz に対応しています</p>
        <p class="drop-card__or drop-card__pointer-only">または</p>
        <button type="button" class="btn-primary" onClick={onPickFile}>
          ファイルを選択
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerState = useViewerDomUi(app, fileInputRef);
  const dropTarget = useFileDropTarget(app);
  usePreventBrowserFileDrop();
  const openFilePicker = (): void => {
    fileInputRef.current?.click();
  };

  const compact = useCompactViewport();
  // スマホのドロワー開閉は一時的な状態。PC のサイドバーの保存値（localStorage）とは独立している。
  const [drawerOpen, setDrawerOpen] = useState(false);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const hasHistory = readyHistoryDocuments(viewerState).length > 0;
  const drawerShown = compact && hasHistory && drawerOpen;
  const closeDrawer = useCallback((): void => {
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!compact || !hasHistory) {
      setDrawerOpen(false);
    }
  }, [compact, hasHistory]);

  const wasDrawerShown = useRef(false);
  useEffect(() => {
    if (wasDrawerShown.current && !drawerShown) {
      historyButtonRef.current?.focus();
    }
    wasDrawerShown.current = drawerShown;
  }, [drawerShown]);

  const pdfShown = isPdfShown(viewerState);

  return (
    <>
      <header class={compact ? "toolbar toolbar--compact" : "toolbar"}>
        <div class="toolbar__row">
          <ToolbarIntro compact={compact} />
          {compact ? (
            <CompactToolbarActions
              showHistory={hasHistory}
              historyOpen={drawerShown}
              showConvert={pdfShown}
              historyButtonRef={historyButtonRef}
              onToggleHistory={() => {
                setDrawerOpen(!drawerOpen);
              }}
              onPickFile={openFilePicker}
            />
          ) : null}
        </div>
        {compact && !pdfShown ? <p class="toolbar__description">{DESCRIPTION}</p> : null}
      </header>
      <main class="viewer">
        <input
          type="file"
          accept=".ps,.gz"
          class="file-picker__input"
          data-testid="file-input"
          aria-label="PostScript ファイルを選択"
          aria-describedby="file-limits-notice privacy-notice trust-notice"
          ref={fileInputRef}
        />
        {compact ? (
          <HistoryDrawer app={app} state={viewerState} open={drawerOpen} onClose={closeDrawer} />
        ) : (
          <HistorySidebar
            app={app}
            state={viewerState}
            canConvertAnother={pdfShown}
            onPickFile={openFilePicker}
          />
        )}
        <div
          class="viewer-surface"
          data-testid="viewer-surface"
          data-dragging={dropTarget.dragging ? "true" : undefined}
          {...dropTarget.handlers}
        >
          <ViewerMain />
          <DropCard state={viewerState} onPickFile={openFilePicker} />
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

export type MountViewerAppOptions = AppFooterProps;

export function mountViewerApp(options: MountViewerAppOptions): (app: ViewerApp) => void {
  const mount = requireMountElement("mount-app");
  let viewerApp: ViewerApp | undefined;

  const renderRoot = (): void => {
    render(<App commitSha={options.commitSha} app={viewerApp} />, mount);
  };

  renderRoot();

  return (app: ViewerApp) => {
    viewerApp = app;
    renderRoot();
  };
}

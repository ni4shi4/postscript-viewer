import { memo } from "preact/compat";
import { render } from "preact";
import { useRef } from "preact/hooks";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import { FileLimitsNotice } from "./file-limits-notice";
import { AppFooter, type AppFooterProps } from "./footer-source-link";
import { HistorySidebar } from "./history-sidebar";
import {
  useViewerDomUi,
  viewerFileNamePresentation,
  ViewerFileName,
  ViewerStatus,
} from "./viewer-ui";

export function ToolbarIntro() {
  return (
    <div class="toolbar-intro">
      <h1>PostScript ビューア</h1>
      <p class="toolbar-intro__description">
        ブラウザ内で PostScript を PDF に変換して表示します。
      </p>
      <h2>使い方</h2>
      <ol class="toolbar-intro__steps">
        <li>PostScript ファイルを選ぶ</li>
        <li>変換が終わるまで待つ</li>
        <li>表示された PDF を確認する</li>
      </ol>
    </div>
  );
}

export function PrivacyNotice() {
  return (
    <p id="privacy-notice" class="privacy-notice">
      ファイルはサーバーへ送信されず、すべてお使いの端末上で処理されます。
    </p>
  );
}

export function TrustNotice() {
  return (
    <p class="trust-notice" id="trust-notice" data-testid="trust-notice">
      <span class="trust-notice__symbol" aria-hidden="true">
        ⚠{" "}
      </span>
      信頼できる PostScript ファイルだけを開いてください。
    </p>
  );
}

const ViewerMain = memo(function ViewerMain() {
  return (
    <div class="viewer-surface">
      <iframe title="変換された PDF" data-testid="pdf-frame" hidden />
      <div class="pdf-canvas-container" data-testid="pdf-canvas-container" hidden />
    </div>
  );
});

export type AppProps = AppFooterProps & {
  app?: ViewerApp;
};

export function App({ commitSha, app }: AppProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerState = useViewerDomUi(app, fileInputRef);
  const fileNamePresentation = viewerFileNamePresentation(viewerState);

  return (
    <>
      <header class="toolbar">
        <ToolbarIntro />
        <div class="toolbar-block toolbar-block--file-selection">
          <div class="file-picker">
            <span class="file-picker__label">PostScript ファイル</span>
            <div class="file-picker__row">
              <label class="file-picker__button">
                ファイルを選択
                <input
                  type="file"
                  accept=".ps,.gz"
                  class="file-picker__input"
                  data-testid="file-input"
                  aria-describedby="file-limits-notice privacy-notice trust-notice"
                  ref={fileInputRef}
                />
              </label>
              <p
                class="file-picker__placeholder"
                data-testid="file-picker-placeholder"
                hidden={!fileNamePresentation.hidden}
              >
                ファイルが選択されていません
              </p>
              <ViewerFileName state={viewerState} />
            </div>
          </div>
          <div class="file-selection-meta">
            <ViewerStatus state={viewerState} />
          </div>
        </div>
        <section class="toolbar-block toolbar-block--limits" aria-labelledby="file-limits-heading">
          <h3 id="file-limits-heading" class="toolbar-block__heading">
            受け付ける上限
          </h3>
          <FileLimitsNotice />
        </section>
        <section class="notice-box toolbar-block toolbar-block--notices" aria-label="注意">
          <PrivacyNotice />
          <TrustNotice />
        </section>
      </header>
      <main class="viewer">
        <HistorySidebar app={app} state={viewerState} />
        <ViewerMain />
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

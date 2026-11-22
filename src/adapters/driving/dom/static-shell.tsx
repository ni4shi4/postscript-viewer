import { memo } from "preact/compat";
import { render } from "preact";
import { useRef } from "preact/hooks";

import type { ViewerApp } from "../../../core/ports/viewer-app";
import { FileLimitsNotice } from "./file-limits-notice";
import { AppFooter, type AppFooterProps } from "./footer-source-link";
import { useViewerDomUi, ViewerFileName, ViewerStatus } from "./viewer-ui";

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
      信頼できる PostScript ファイルだけを開いてください。
    </p>
  );
}

const ViewerMain = memo(function ViewerMain() {
  return (
    <main class="viewer">
      <iframe title="変換された PDF" data-testid="pdf-frame" hidden />
      <div class="pdf-canvas-container" data-testid="pdf-canvas-container" hidden />
    </main>
  );
});

export type AppProps = AppFooterProps & {
  app?: ViewerApp;
};

export function App({ commitSha, app }: AppProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerState = useViewerDomUi(app, fileInputRef);

  return (
    <>
      <header class="toolbar">
        <ToolbarIntro />
        <label class="file-picker">
          <span class="file-picker__label">PostScript ファイル</span>
          <input
            type="file"
            accept=".ps,.gz"
            data-testid="file-input"
            aria-describedby="file-limits-notice privacy-notice trust-notice"
            ref={fileInputRef}
          />
          <FileLimitsNotice />
        </label>
        <ViewerFileName state={viewerState} />
        <PrivacyNotice />
        <TrustNotice />
        <ViewerStatus state={viewerState} />
      </header>
      <ViewerMain />
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

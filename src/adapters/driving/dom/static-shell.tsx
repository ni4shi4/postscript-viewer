import { render } from "preact";

import { AppFooter, type AppFooterProps } from "./footer-source-link";
import { FileLimitsNotice } from "./file-limits-notice";

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

function requireMountElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Static shell mount point is missing: ${id}`);
  }
  return element;
}

export function mountStaticShell({ commitSha }: AppFooterProps): void {
  render(<ToolbarIntro />, requireMountElement("mount-toolbar-intro"));
  render(<FileLimitsNotice />, requireMountElement("mount-file-limits-notice"));
  render(<PrivacyNotice />, requireMountElement("mount-privacy-notice"));
  render(<TrustNotice />, requireMountElement("mount-trust-notice"));
  render(<AppFooter commitSha={commitSha} />, requireMountElement("mount-app-footer"));
}
